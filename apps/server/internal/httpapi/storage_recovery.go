package httpapi

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// A lost writer connection also loses its session advisory lock. Never reconnect
// underneath the in-memory cache: a fresh process must reload committed state.
type storageFailure struct{ operation, kind string }

func (e *storageFailure) Error() string {
	return "storage unavailable; process recovery required (" + e.operation + ":" + e.kind + ")"
}

func storageErrorKind(err error) string {
	var pg *pgconn.PgError
	var network net.Error
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.As(err, &pg):
		return "sqlstate_" + pg.Code
	case errors.As(err, &network):
		return "network"
	default:
		return "connection"
	}
}

func (p *cloudDatabase) fail(operation string, cause error) error {
	failure := &storageFailure{operation: operation, kind: storageErrorKind(cause)}
	if p.failure.CompareAndSwap(nil, failure) {
		// Underlying errors can contain connection strings or SQL payloads.
		log.Printf("storage state=failed operation=%s error_class=%s recovery=process_restart", failure.operation, failure.kind)
	}
	return p.failure.Load()
}

// Readiness must not wait behind a potentially 45-second database transaction.
func (p *cloudDatabase) readiness() error {
	if failure := p.failure.Load(); failure != nil {
		return failure
	}
	return nil
}

func storageReadinessGate(cloud *cloudDatabase, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cloud != nil && r.URL.Path != "/livez" && cloud.readiness() != nil {
			writeError(w, http.StatusServiceUnavailable, "storage_unavailable", "Хранилище временно недоступно.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func watchStorage(done <-chan struct{}, interval time.Duration, check func() error, onFailure func(error)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			if err := check(); err != nil {
				if onFailure != nil {
					onFailure(err)
				}
				return
			}
		}
	}
}
