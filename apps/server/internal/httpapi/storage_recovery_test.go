package httpapi

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgproto3"
)

// A real pgx TCP connection against an isolated wire peer. It can disappear
// between successful queries or during BEGIN/COMMIT; no production database.
func recoveryWireDB(t *testing.T, failQuery ...string) (*cloudDatabase, *atomic.Bool) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	drop := &atomic.Bool{}
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		backend := pgproto3.NewBackend(conn, conn)
		if _, err := backend.ReceiveStartupMessage(); err != nil {
			return
		}
		backend.Send(&pgproto3.AuthenticationOk{})
		backend.Send(&pgproto3.ParameterStatus{Name: "server_version", Value: "17.0"})
		backend.Send(&pgproto3.ParameterStatus{Name: "client_encoding", Value: "UTF8"})
		backend.Send(&pgproto3.ReadyForQuery{TxStatus: 'I'})
		if backend.Flush() != nil {
			return
		}
		for {
			message, err := backend.Receive()
			if err != nil {
				return
			}
			if drop.Load() {
				return
			}
			switch m := message.(type) {
			case *pgproto3.Query:
				if len(failQuery) > 0 && strings.EqualFold(strings.TrimSpace(m.String), failQuery[0]) {
					return
				}
				if strings.Contains(m.String, "-- ping") {
					backend.Send(&pgproto3.EmptyQueryResponse{})
				} else {
					backend.Send(&pgproto3.CommandComplete{CommandTag: []byte("BEGIN")})
				}
				backend.Send(&pgproto3.ReadyForQuery{TxStatus: 'I'})
			case *pgproto3.Parse:
				backend.Send(&pgproto3.ParseComplete{})
			case *pgproto3.Describe:
				backend.Send(&pgproto3.ParameterDescription{ParameterOIDs: []uint32{25, 25}})
				backend.Send(&pgproto3.NoData{})
			case *pgproto3.Bind:
				backend.Send(&pgproto3.BindComplete{})
			case *pgproto3.Execute:
				backend.Send(&pgproto3.CommandComplete{CommandTag: []byte("INSERT 0 1")})
			case *pgproto3.Sync:
				backend.Send(&pgproto3.ReadyForQuery{TxStatus: 'T'})
			case *pgproto3.Terminate:
				return
			}
			if backend.Flush() != nil {
				return
			}
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, "postgres://test@"+listener.Addr().String()+"/test?sslmode=disable")
	if err != nil {
		listener.Close()
		t.Fatal(err)
	}
	db := &cloudDatabase{conn: conn, done: make(chan struct{}), previous: map[string]cloudRecord{}}
	t.Cleanup(func() { db.close(); listener.Close() })
	return db, drop
}

func TestStorageRecoveryAfterConnectionLoss(t *testing.T) {
	db, drop := recoveryWireDB(t)
	if err := db.check(); err != nil {
		t.Fatal(err)
	}
	// The next real wire Ping fails after the earlier successful check.
	drop.Store(true)
	db.lastCheck = time.Time{}
	if err := db.check(); err == nil {
		t.Fatal("lost connection accepted")
	}
	if db.readiness() == nil {
		t.Fatal("unsafe cached writer remains ready")
	}
	called := make(chan error, 2)
	go watchStorage(db.done, time.Millisecond, db.check, func(err error) { called <- err })
	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("no automatic recovery notification")
	}
	select {
	case <-called:
		t.Fatal("duplicate recovery notification")
	case <-time.After(10 * time.Millisecond):
	}
	if !db.conn.IsClosed() {
		t.Fatal("failed writer connection must not be reused")
	}
}

func TestStorageReadinessDoesNotWaitForTransaction(t *testing.T) {
	db := &cloudDatabase{}
	db.mu.Lock()
	checked := make(chan error, 1)
	go func() { checked <- db.readiness() }()
	select {
	case err := <-checked:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("readiness blocked behind database mutex")
	}
	db.mu.Unlock()
}

func TestStorageBeginFailureAndUncertainCommitStayClosed(t *testing.T) {
	db, drop := recoveryWireDB(t)
	drop.Store(true)
	if err := db.writeGroup("state", []byte(`{}`), nil, nil); err == nil {
		t.Fatal("failed begin accepted")
	}
	if db.readiness() == nil {
		t.Fatal("begin failure must notify recovery")
	}
	t.Run("connection drops during COMMIT", func(t *testing.T) {
		db, _ := recoveryWireDB(t, "commit")
		if err := db.writeGroup("state", []byte(`{}`), nil, nil); err == nil {
			t.Fatal("lost COMMIT response accepted")
		}
		failure := db.failure.Load()
		if failure == nil || failure.operation != "commit_uncertain" {
			t.Fatalf("wrong recovery reason: %v", failure)
		}
		if len(db.previous) != 0 {
			t.Fatal("unconfirmed state installed in cache")
		}
	})
	for _, operation := range []string{"ping", "begin", "commit_uncertain"} {
		db := &cloudDatabase{}
		err := db.fail(operation, errors.New("password=DO_NOT_LOG sql=PRIVATE"))
		if strings.Contains(err.Error(), "DO_NOT_LOG") || strings.Contains(err.Error(), "PRIVATE") {
			t.Fatal("secret error detail exposed")
		}
		if db.readiness() == nil {
			t.Fatal("failure gate reset")
		}
		if next := db.fail("ping", context.DeadlineExceeded); next != err {
			t.Fatal("original failure lost")
		}
	}
}

func TestStorageMonitorStopsWithRuntime(t *testing.T) {
	done := make(chan struct{})
	close(done)
	watchStorage(done, time.Hour, func() error { t.Fatal("check after stop"); return nil }, func(error) { t.Fatal("recovery after shutdown") })
}

func TestStorageFailureBlocksWorkButNotLiveness(t *testing.T) {
	db := &cloudDatabase{}
	db.fail("commit_uncertain", errors.New("synthetic loss"))
	gate := storageReadinessGate(db, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))
	for _, path := range []string{"/healthz", "/api/auth/session", "/", "/livez"} {
		response := httptest.NewRecorder()
		gate.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		want := 503
		if path == "/livez" {
			want = 200
		}
		if response.Code != want {
			t.Fatalf("%s: got %d want %d", path, response.Code, want)
		}
	}
}
