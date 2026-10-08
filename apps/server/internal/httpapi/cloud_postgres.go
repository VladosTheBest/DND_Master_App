package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type cloudDatabase struct {
	mu        sync.Mutex
	conn      *pgx.Conn
	previous  map[string]cloudRecord
	failed    bool
	lastCheck time.Time
}

func openCloudDatabase(connectionURL string) (*cloudDatabase, error) {
	u, err := url.Parse(connectionURL)
	if err != nil || u.Host == "" {
		return nil, errors.New("invalid database configuration")
	}
	// Session locks must use the direct endpoint, never transaction pooling.
	if stringsHasFlyPooler(u.Hostname()) {
		u.Host = "direct." + u.Host[len("pgbouncer."):]
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgx.ParseConfig(u.String())
	if err != nil {
		return nil, errors.New("invalid database configuration")
	}
	config.RuntimeParams["application_name"] = "shadow-edge"
	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		return nil, errors.New("database connection failed")
	}
	p := &cloudDatabase{conn: conn, previous: map[string]cloudRecord{}}
	var locked bool
	if err = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock(734020261004)").Scan(&locked); err != nil || !locked {
		conn.Close(ctx)
		return nil, errors.New("database writer already running or unavailable; keep one application replica")
	}
	if err = p.migrate(ctx); err != nil {
		conn.Close(ctx)
		return nil, err
	}
	return p, nil
}

func stringsHasFlyPooler(host string) bool {
	return len(host) > len("pgbouncer..flympg.net") && host[:len("pgbouncer.")] == "pgbouncer." && host[len(host)-len(".flympg.net"):] == ".flympg.net"
}

func (p *cloudDatabase) close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = p.conn.Close(ctx)
}

func (p *cloudDatabase) check() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failed {
		return errors.New("database state requires restart")
	}
	if time.Since(p.lastCheck) < 3*time.Second {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := p.conn.Ping(ctx); err != nil {
		p.failed = true
		return errors.New("database unavailable")
	}
	p.lastCheck = time.Now()
	return nil
}

func (p *cloudDatabase) migrate(ctx context.Context) error {
	tx, err := p.conn.Begin(ctx)
	if err != nil {
		return errors.New("begin schema migration failed")
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app_meta(key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS subscription_plans(id text PRIMARY KEY, monthly_cents integer NOT NULL CHECK(monthly_cents>0), currency text NOT NULL DEFAULT 'USD', entitlements jsonb NOT NULL);
INSERT INTO subscription_plans VALUES ('starter',500,'USD','{"generations":100,"storageGB":2,"recordingHours":2}'),('gm',1000,'USD','{"generations":300,"storageGB":10,"recordingHours":6}'),('studio',2000,'USD','{"generations":800,"storageGB":30,"recordingHours":16}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS storage_objects(object_key text PRIMARY KEY, sha256 text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes>=0), source_mtime_ns bigint NOT NULL, content_type text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS usage_events(id text PRIMARY KEY, account_id text NOT NULL, metric text NOT NULL, quantity bigint NOT NULL CHECK(quantity>=0), occurred_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS usage_account_time ON usage_events(account_id,occurred_at);
CREATE TABLE IF NOT EXISTS payment_events(provider text NOT NULL, event_id text NOT NULL, account_id text, status text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL, PRIMARY KEY(provider,event_id));
CREATE TABLE IF NOT EXISTS migration_runs(id text PRIMARY KEY, source_digest text NOT NULL, counts jsonb NOT NULL, completed_at timestamptz NOT NULL DEFAULT now());`); err != nil {
		return errors.New("create platform schema failed")
	}
	for _, table := range append(append([]string{}, cloudTables...), "ai_jobs") {
		extra := ""
		switch table {
		case "accounts":
			extra = `, UNIQUE(id), username_key text GENERATED ALWAYS AS (payload->>'usernameKey') STORED UNIQUE NOT NULL`
		case "campaigns":
			extra = `, UNIQUE(id), owner_id text GENERATED ALWAYS AS (nullif(payload->>'ownerId','')) STORED REFERENCES accounts(id), revision integer GENERATED ALWAYS AS ((payload->>'revision')::integer) STORED`
		case "oauth_identities":
			extra = `, FOREIGN KEY(parent_id) REFERENCES accounts(id), provider text GENERATED ALWAYS AS (payload->>'provider') STORED NOT NULL, subject text GENERATED ALWAYS AS (payload->>'subject') STORED NOT NULL, UNIQUE(provider,subject) DEFERRABLE INITIALLY DEFERRED`
		case "subscriptions":
			extra = `, FOREIGN KEY(parent_id) REFERENCES accounts(id), UNIQUE(parent_id), plan_id text GENERATED ALWAYS AS (payload->>'planId') STORED REFERENCES subscription_plans(id), status text GENERATED ALWAYS AS (payload->>'status') STORED`
		case "subscription_audits":
			extra = `, account_id text GENERATED ALWAYS AS (payload->>'accountId') STORED NOT NULL REFERENCES accounts(id), actor_id text GENERATED ALWAYS AS (payload->>'actorId') STORED NOT NULL REFERENCES accounts(id)`
		case "feedback":
			extra = `, account_id text GENERATED ALWAYS AS (payload->>'accountId') STORED NOT NULL REFERENCES accounts(id), feedback_type text GENERATED ALWAYS AS (payload->>'type') STORED NOT NULL CHECK(feedback_type IN ('bug','suggestion','impression')), status text GENERATED ALWAYS AS (payload->>'status') STORED NOT NULL CHECK(status IN ('new','reviewing','closed')), submission_id text GENERATED ALWAYS AS (payload->>'submissionId') STORED NOT NULL, UNIQUE(account_id,submission_id)`
		case "entities", "world_events", "shops", "session_preparations", "playlist_tracks":
			extra = `, FOREIGN KEY(parent_id) REFERENCES campaigns(id)`
		case "game_sessions":
			extra = `, UNIQUE(id), campaign_id text GENERATED ALWAYS AS (nullif(payload->>'campaignId','')) STORED REFERENCES campaigns(id)`
		case "transcripts", "session_analyses":
			extra = `, FOREIGN KEY(parent_id) REFERENCES game_sessions(id), UNIQUE(parent_id)`
		default:
			extra = `, campaign_id text GENERATED ALWAYS AS (nullif(payload->>'campaignId','')) STORED, owner_id text GENERATED ALWAYS AS (nullif(payload->>'ownerId','')) STORED`
		}
		ddl := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s(record_key text PRIMARY KEY, id text NOT NULL, parent_id text NOT NULL, kind text NOT NULL, ordinal integer NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()%s); CREATE INDEX IF NOT EXISTS %s_parent_kind ON %s(parent_id,kind,ordinal);`, table, extra, table, table)
		if _, err = tx.Exec(ctx, ddl); err != nil {
			return fmt.Errorf("create %s schema failed", table)
		}
	}
	_, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS campaign_owner ON campaigns(owner_id); CREATE INDEX IF NOT EXISTS game_session_campaign ON game_sessions(campaign_id); INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING`)
	if err != nil {
		return errors.New("create database indexes failed")
	}
	if err = migrateStorageUsage(ctx, tx); err != nil {
		return fmt.Errorf("storage usage migration failed: %w", err)
	}
	if _, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS subscription_audit_account ON subscription_audits(account_id); INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT DO NOTHING`); err != nil {
		return errors.New("create subscription audit indexes failed")
	}
	if _, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS feedback_filters ON feedback(status,feedback_type); INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT DO NOTHING`); err != nil {
		return errors.New("create feedback indexes failed")
	}
	if _, err = tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS ai_chat_campaign_owner ON ai_chat_turns(campaign_id,owner_id); INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT DO NOTHING`); err != nil {
		return errors.New("create chat indexes failed")
	}
	if _, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES(7) ON CONFLICT DO NOTHING`); err != nil {
		return errors.New("create Foundry exchange schema failed")
	}
	if err = tx.Commit(ctx); err != nil {
		return errors.New("commit schema migration failed")
	}
	return nil
}

func (p *cloudDatabase) readGroup(key string, tables []string) (json.RawMessage, []cloudRecord, bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var meta json.RawMessage
	err := p.conn.QueryRow(ctx, "SELECT value FROM app_meta WHERE key=$1", key).Scan(&meta)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, false, nil
	}
	if err != nil {
		return nil, nil, false, errors.New("read database metadata failed")
	}
	records := []cloudRecord{}
	for _, table := range tables {
		rows, err := p.conn.Query(ctx, fmt.Sprintf("SELECT record_key,id,parent_id,kind,ordinal,payload FROM %s ORDER BY ordinal,record_key", table))
		if err != nil {
			return nil, nil, false, fmt.Errorf("read %s failed", table)
		}
		for rows.Next() {
			r := cloudRecord{Table: table}
			if err = rows.Scan(&r.Key, &r.ID, &r.Parent, &r.Kind, &r.Position, &r.Body); err != nil {
				rows.Close()
				return nil, nil, false, err
			}
			records = append(records, r)
			p.previous[table+"/"+r.Key] = r
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, nil, false, err
		}
	}
	return meta, records, true, nil
}

func (p *cloudDatabase) writeGroup(key string, meta json.RawMessage, records []cloudRecord, tables []string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failed {
		return errors.New("database state requires restart")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	tx, err := p.conn.Begin(ctx)
	if err != nil {
		p.failed = true
		return errors.New("begin database transaction failed")
	}
	defer tx.Rollback(context.Background())
	next := map[string]cloudRecord{}
	for _, r := range records {
		next[r.Table+"/"+r.Key] = r
	}
	for _, table := range tables {
		for _, r := range records {
			if r.Table != table {
				continue
			}
			old, exists := p.previous[table+"/"+r.Key]
			if exists && old.Position == r.Position && bytes.Equal(old.Body, r.Body) {
				continue
			}
			_, err = tx.Exec(ctx, fmt.Sprintf(`INSERT INTO %s(record_key,id,parent_id,kind,ordinal,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(record_key) DO UPDATE SET id=excluded.id,parent_id=excluded.parent_id,kind=excluded.kind,ordinal=excluded.ordinal,payload=excluded.payload,updated_at=now()`, table), r.Key, r.ID, r.Parent, r.Kind, r.Position, string(r.Body))
			if err != nil {
				return fmt.Errorf("persist %s failed", table)
			}
		}
	}
	for index := len(tables) - 1; index >= 0; index-- {
		table := tables[index]
		for key, r := range p.previous {
			if r.Table != table {
				continue
			}
			if _, exists := next[key]; !exists {
				if _, err = tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE record_key=$1", table), r.Key); err != nil {
					return fmt.Errorf("delete %s failed", table)
				}
			}
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO app_meta(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, string(meta)); err != nil {
		return errors.New("save database metadata failed")
	}
	if err = tx.Commit(ctx); err != nil {
		p.failed = true
		return errors.New("database commit outcome uncertain; restart required before serving requests")
	}
	for k, r := range p.previous {
		for _, table := range tables {
			if r.Table == table {
				delete(p.previous, k)
				break
			}
		}
	}
	for k, r := range next {
		p.previous[k] = r
	}
	return nil
}

func (p *cloudDatabase) loadState() (storageState, bool, error) {
	meta, records, exists, err := p.readGroup("state", cloudTables)
	if err != nil || !exists {
		return storageState{}, exists, err
	}
	state, err := joinCloudState(meta, records)
	return state, true, err
}

func (p *cloudDatabase) saveState(state storageState) error {
	meta, records, err := splitCloudState(state)
	if err != nil {
		return err
	}
	return p.writeGroup("state", meta, records, cloudTables)
}
