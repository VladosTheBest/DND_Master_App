package httpapi

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/jackc/pgx/v5"
)

func cloudFixture(t *testing.T) storageState {
	t.Helper()
	var state storageState
	err := json.Unmarshal([]byte(`{"authSecret":"synthetic-secret","users":[{"id":"u1","username":"Test","usernameKey":"test","oauthIdentities":[{"provider":"google","subject":"s1"},{"provider":"discord","subject":"s2"}],"subscription":{"planId":"gm","status":"active"}}],"campaigns":[{"id":"c1","ownerId":"u1","locations":[{"id":"l2","title":"Second"},{"id":"l1","title":"First"}],"players":[],"npcs":[{"id":"n1"}],"monsters":[{"id":"m1"}],"quests":[{"id":"q1"}],"lore":[{"id":"r1"}],"events":[{"id":"e1"}],"shops":[{"id":"shop1"}],"sessionPrep":[{"id":"prep1"}],"combatPlaylist":[{"id":"track1"}]}],"importedSessions":[{"id":"session1","campaignId":"c1","text":"Synthetic transcript","analysis":{"runId":"run1","summary":"Summary"}}],"aiProposals":[{"id":"p1","ownerId":"u1","campaignId":"c1","before":{"z":2,"a":1},"after":{"a":2,"z":3}}],"proposalAudits":[{"id":"audit1"}],"surveyInvites":[{"token":"synthetic-survey"}],"surveyResponses":[{"id":"response1"}],"characterInvites":[{"token":"synthetic-character"}],"characterSheets":[{"sheet":{"id":"sheet1"}}]}`), &state)
	if err != nil {
		t.Fatal(err)
	}
	state.SubscriptionAudits = []subscriptionAudit{{ID: "grant1", AccountID: "u1", ActorID: "u1", Action: "grant", Reason: "Synthetic grant", At: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), Next: state.Users[0].Subscription}}
	state.Feedback = []feedbackEntry{{ID: "feedback1", AccountID: "u1", SubmissionID: "synthetic-feedback", Type: "bug", Message: "Synthetic feedback", Status: "new", CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}}
	state.AIChatTurns = []aiChatTurn{{ID: "chat1", OwnerID: "u1", CampaignID: state.Campaigns[0].ID, Question: "Synthetic question", Answer: "Synthetic answer", CreatedAt: time.Now().UTC()}}
	return state
}

func TestCloudCodecRoundTrip(t *testing.T) {
	for _, state := range []storageState{{}, cloudFixture(t)} {
		meta, records, err := splitCloudState(state)
		if err != nil {
			t.Fatal(err)
		}
		for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
			records[i], records[j] = records[j], records[i]
		}
		restored, err := joinCloudState(meta, records)
		if err != nil {
			t.Fatal(err)
		}
		if cloudStateDigest(restored) != cloudStateDigest(state) {
			t.Fatal("lossy codec")
		}
		if strings.Contains(string(meta), "Synthetic transcript") || strings.Contains(string(meta), "Second") {
			t.Fatal("domain records leaked into metadata")
		}
	}
	state := cloudFixture(t)
	state.Campaigns = append(state.Campaigns, state.Campaigns[0])
	if _, _, err := splitCloudState(state); err == nil {
		t.Fatal("duplicate accepted")
	}
}

func TestCloudPublicObjectBoundary(t *testing.T) {
	for _, p := range []string{"/uploads/../backups/store.json", "/uploads/.proposals/a.png", "/uploads/.PROPOSALS./a.png", "/uploads/a/../../x", "/uploads/a\\b", "/uploads/", "/staging/a"} {
		if _, ok := publicObjectKey(p); ok {
			t.Fatalf("accepted %s", p)
		}
	}
	key, ok := publicObjectKey("/uploads/u/c/image.png")
	if !ok || key != "uploads/u/c/image.png" {
		t.Fatal("valid upload rejected")
	}
	recorder := httptest.NewRecorder()
	(&cloudAssets{}).handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/uploads/.proposals/a", nil))
	if recorder.Code != 404 {
		t.Fatal(recorder.Code)
	}
}

func TestCloudPostgresIntegration(t *testing.T) {
	uri := os.Getenv("SHADOW_EDGE_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("isolated PostgreSQL not configured")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Path != "/shadow_edge_migration_test" {
		t.Fatal("requires dedicated migration test database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	admin, err := pgx.Connect(ctx, uri)
	if err != nil {
		t.Fatal("test database unavailable")
	}
	defer admin.Close(ctx)
	schema := "test_" + strings.ReplaceAll(newID("cloud"), "-", "_")
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	db, err := openCloudDatabase(parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.close()
	if other, err := openCloudDatabase(parsed.String()); err == nil {
		other.close()
		t.Fatal("second writer accepted")
	}
	state := cloudFixture(t)
	if err = db.saveState(state); err != nil {
		t.Fatal(err)
	}
	t.Run("storage attribution and existing objects", func(t *testing.T) {
		_, err := db.conn.Exec(ctx, `INSERT INTO storage_objects(object_key,sha256,size_bytes,source_mtime_ns,content_type) VALUES
		('uploads/u1/c1/a.png','test',100,0,'image/png'),
		('uploads/c1/legacy.png','test',40,0,'image/png'),
		('staging/u1/p1/b.png','test',30,0,'image/png'),
		('uploads/other/c1/c.png','test',900,0,'image/png'),
		('backups/u1/store.json','test',800,0,'application/json')`)
		if err != nil {
			t.Fatal(err)
		}
		if err = db.migrate(ctx); err != nil {
			t.Fatal(err)
		}
		u, err := db.storageUsage(ctx, "u1")
		if err != nil || u.MediaBytes != 140 || u.StagingBytes != 30 || u.ObjectCount != 3 || u.DatabaseBytes <= 0 || u.TotalBytes != 170+u.DatabaseBytes {
			t.Fatalf("usage: %+v %v", u, err)
		}
		if _, err = db.storageUsage(ctx, "other"); err == nil {
			t.Fatal("unknown account accepted")
		}
		_, err = db.conn.Exec(ctx, `UPDATE storage_objects SET size_bytes=20 WHERE object_key='uploads/u1/c1/a.png'`)
		if err != nil {
			t.Fatal(err)
		}
		u, err = db.storageUsage(ctx, "u1")
		if err != nil || u.MediaBytes != 60 || u.ObjectCount != 3 {
			t.Fatal("overwrite double counted")
		}
		_, err = db.conn.Exec(ctx, `INSERT INTO accounts(record_key,id,parent_id,kind,ordinal,payload) VALUES('u2','u2','','users',1,'{"usernameKey":"second"}')`)
		if err != nil {
			t.Fatal(err)
		}
		u, err = db.storageUsage(ctx, "u2")
		if err != nil || u.MediaBytes != 0 || u.StagingBytes != 0 || u.ObjectCount != 0 || u.DatabaseBytes <= 0 {
			t.Fatal("account isolation failed")
		}
		_, err = db.conn.Exec(ctx, `INSERT INTO accounts(record_key,id,parent_id,kind,ordinal,payload) VALUES('U1','U1','','users',2,'{"usernameKey":"collision"}')`)
		if err != nil {
			t.Fatal(err)
		}
		u, err = db.storageUsage(ctx, "u1")
		if err != nil || u.MediaBytes != 40 || u.StagingBytes != 0 {
			t.Fatal("ambiguous prefix charged")
		}
		if _, err = db.conn.Exec(ctx, `DELETE FROM accounts WHERE id IN ('u2','U1'); DELETE FROM storage_objects`); err != nil {
			t.Fatal(err)
		}
	})
	restored, exists, err := db.loadState()
	if err != nil || !exists || cloudStateDigest(restored) != cloudStateDigest(state) {
		t.Fatalf("SQL roundtrip failed: %v", err)
	}
	state.Users[0].OAuthIdentities[0], state.Users[0].OAuthIdentities[1] = state.Users[0].OAuthIdentities[1], state.Users[0].OAuthIdentities[0]
	state.Campaigns[0].Locations = state.Campaigns[0].Locations[1:]
	if err = db.saveState(state); err != nil {
		t.Fatal(err)
	}
	restored, _, err = db.loadState()
	if err != nil || cloudStateDigest(restored) != cloudStateDigest(state) {
		t.Fatal("update/delete lost data")
	}
	invalid := cloudFixture(t)
	invalid.Campaigns[0].OwnerID = "missing-user"
	if err = db.saveState(invalid); err == nil {
		t.Fatal("foreign key allowed")
	}
	restored, _, err = db.loadState()
	if err != nil || cloudStateDigest(restored) != cloudStateDigest(state) {
		t.Fatal("failed transaction changed data")
	}
	jobs, err := newAIJobManagerWithCloud(t.TempDir()+"/missing.json", db, true)
	if err != nil {
		t.Fatal(err)
	}
	jobs.jobs["job1"] = &storedAIJob{aiJob: aiJob{ID: "job1", State: "completed"}, OwnerID: "u1"}
	if err = jobs.saveLocked(); err != nil {
		t.Fatal(err)
	}
	jobs, err = newAIJobManagerWithCloud("ignored", db, false)
	if err != nil || len(jobs.jobs) != 1 {
		t.Fatal("job persistence failed")
	}
	if err = db.saveState(storageState{}); err != nil {
		t.Fatal("reverse-order delete:", err)
	}
	t.Run("verified S3 persistence", func(t *testing.T) {
		var mu sync.Mutex
		remote := map[string][]byte{}
		fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			defer mu.Unlock()
			switch r.Method {
			case "POST":
				if !r.URL.Query().Has("delete") {
					t.Error("unexpected S3 POST")
					return
				}
				var request struct {
					Objects []struct {
						Key string `xml:"Key"`
					} `xml:"Object"`
				}
				if err := xml.NewDecoder(r.Body).Decode(&request); err != nil {
					t.Error(err)
					return
				}
				for _, object := range request.Objects {
					delete(remote, "/test/"+object.Key)
				}
				w.Header().Set("Content-Type", "application/xml")
				io.WriteString(w, `<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></DeleteResult>`)
			case "PUT":
				body, _ := io.ReadAll(r.Body)
				remote[r.URL.Path] = body
				w.Header().Set("ETag", `"test"`)
			case "GET":
				body, ok := remote[r.URL.Path]
				if !ok {
					http.NotFound(w, r)
					return
				}
				if strings.Contains(r.URL.Path, "corrupt") {
					body = []byte("corrupt")
				}
				w.Header().Set("Content-Type", "image/png")
				w.Write(body)
			default:
				t.Error("unexpected S3 method")
			}
		}))
		defer fake.Close()
		client := s3.New(s3.Options{Region: "auto", BaseEndpoint: aws.String(fake.URL), UsePathStyle: true, Credentials: aws.AnonymousCredentials{}, RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired, ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired})
		root := t.TempDir()
		file := filepath.Join(root, "test.png")
		if err := os.WriteFile(file, []byte("synthetic image bytes"), 0600); err != nil {
			t.Fatal(err)
		}
		assets := &cloudAssets{db: db, client: client, bucket: "test", root: root, objects: map[string]cloudObject{}}
		if err := assets.publishUpload(ctx, file); err != nil {
			t.Fatal(err)
		}
		if len(assets.objects) != 1 {
			t.Fatal("missing verified manifest")
		}
		if err := assets.putFile(ctx, file, "uploads/corrupt.png", false); err == nil {
			t.Fatal("corrupt S3 object accepted")
		}
		if len(assets.objects) != 1 {
			t.Fatal("unverified object registered")
		}
		os.Remove(file)
		if err := assets.ensureLocal(ctx, file, "uploads/test.png"); err != nil {
			t.Fatal(err)
		}
		body, err := os.ReadFile(file)
		if err != nil || string(body) != "synthetic image bytes" {
			t.Fatal("cache restore failed")
		}
		rec := httptest.NewRecorder()
		assets.handler().ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/test.png", nil))
		if rec.Code != 200 || rec.Body.String() != string(body) {
			t.Fatal("S3 media proxy failed")
		}
		rec = httptest.NewRecorder()
		assets.serve(rec, httptest.NewRequest("HEAD", "/preview", nil), "uploads/test.png", true)
		if rec.Code != 200 || rec.Body.Len() != 0 || rec.Header().Get("Cache-Control") != "private, no-store" {
			t.Fatal("private HEAD proxy failed")
		}
		t.Run("four hour tile cache", func(t *testing.T) { testTileCacheLifecycle(t, db, assets, root) })
		source := filepath.Join(t.TempDir(), "store.json")
		original := cloudFixture(t)
		encoded, _ := json.Marshal(original)
		if err := os.WriteFile(source, encoded, 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := db.conn.Exec(ctx, "DELETE FROM app_meta WHERE key='state'"); err != nil {
			t.Fatal(err)
		}
		store, err := loadCloudCampaignStore(db, assets, Options{DataFile: source, UploadDir: root, ImportLegacyJSON: true})
		if err != nil {
			t.Fatal("migration:", err)
		}
		if cloudStateDigest(store.data) != cloudStateDigest(original) {
			t.Fatal("import changed state")
		}
		os.Remove(source)
		store, err = loadCloudCampaignStore(db, assets, Options{DataFile: source, UploadDir: root})
		if err != nil || cloudStateDigest(store.data) != cloudStateDigest(original) {
			t.Fatal("SQL restart depends on legacy source")
		}
	})
	db.conn.Close(ctx)
	if err = db.check(); err == nil {
		t.Fatal("lost writer connection did not fail closed")
	}
}
