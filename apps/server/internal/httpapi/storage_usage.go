package httpapi

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Views cover existing records immediately and cannot drift on overwrite/retry.
// Database bytes are logical JSON bytes, not PostgreSQL pages, indexes or WAL.
func migrateStorageUsage(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
CREATE INDEX IF NOT EXISTS storage_owner_prefix ON storage_objects ((split_part(object_key,'/',2)));
CREATE OR REPLACE VIEW account_storage_prefixes AS
 SELECT min(id) AS account_id, prefix FROM (
 SELECT id, coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(id)), '[^a-z0-9_-]', '-', 'g')),''),'campaign') AS prefix FROM accounts
 ) a GROUP BY prefix HAVING count(*)=1;
CREATE OR REPLACE VIEW campaign_storage_prefixes AS
 SELECT min(owner_id) AS account_id, prefix FROM (
 SELECT owner_id, coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(id)), '[^a-z0-9_-]', '-', 'g')),''),'campaign') AS prefix FROM campaigns
 ) c GROUP BY prefix HAVING count(*)=1;
CREATE OR REPLACE VIEW owned_storage_objects AS
 SELECT o.*, coalesce(a.account_id,c.account_id) AS account_id, split_part(o.object_key,'/',1) AS category
 FROM storage_objects o LEFT JOIN account_storage_prefixes a ON a.prefix=split_part(o.object_key,'/',2)
 LEFT JOIN campaign_storage_prefixes c ON c.prefix=split_part(o.object_key,'/',2)
 AND split_part(o.object_key,'/',1)='uploads' AND NOT EXISTS (
 SELECT 1 FROM accounts u WHERE coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(u.id)), '[^a-z0-9_-]', '-', 'g')),''),'campaign')=c.prefix)
 WHERE split_part(o.object_key,'/',1) IN ('uploads','staging') AND split_part(o.object_key,'/',3)<>'' AND coalesce(a.account_id,c.account_id) IS NOT NULL;
`)
	if err != nil {
		return err
	}
	parts := []string{}
	for _, table := range append(append([]string{}, cloudTables...), "ai_jobs") {
		owner, join := "", ""
		switch table {
		case "accounts":
			owner = "r.id"
		case "oauth_identities", "subscriptions":
			owner = "r.parent_id"
		case "subscription_audits", "feedback":
			owner = "r.account_id"
		case "campaigns":
			owner = "r.owner_id"
		case "entities", "world_events", "shops", "session_preparations", "playlist_tracks":
			owner, join = "c.owner_id", " LEFT JOIN campaigns c ON c.id=r.parent_id"
		case "game_sessions":
			owner, join = "coalesce(c.owner_id,nullif(r.payload->>'ownerId',''))", " LEFT JOIN campaigns c ON c.id=r.campaign_id"
		case "transcripts", "session_analyses":
			owner, join = "coalesce(c.owner_id,nullif(s.payload->>'ownerId',''))", " LEFT JOIN game_sessions s ON s.id=r.parent_id LEFT JOIN campaigns c ON c.id=s.campaign_id"
		default:
			owner, join = "coalesce(c.owner_id,r.owner_id)", " LEFT JOIN campaigns c ON c.id=r.campaign_id"
		}
		parts = append(parts, fmt.Sprintf("SELECT %s AS account_id, octet_length(r.payload::text)::bigint AS size_bytes FROM %s r%s", owner, table, join))
	}
	_, err = tx.Exec(ctx, `CREATE OR REPLACE VIEW account_database_records AS `+strings.Join(parts, " UNION ALL ")+`;
CREATE OR REPLACE VIEW account_storage_usage AS
 SELECT a.id AS account_id, coalesce(m.media_bytes,0)::bigint AS media_bytes,
 coalesce(m.staging_bytes,0)::bigint AS staging_bytes, coalesce(m.object_count,0)::bigint AS object_count,
 coalesce(d.database_bytes,0)::bigint AS database_bytes
 FROM accounts a LEFT JOIN (
 SELECT account_id, sum(size_bytes) FILTER (WHERE category='uploads') AS media_bytes,
 sum(size_bytes) FILTER (WHERE category='staging') AS staging_bytes, count(*) AS object_count
 FROM owned_storage_objects GROUP BY account_id
 ) m ON m.account_id=a.id LEFT JOIN (
 SELECT account_id,sum(size_bytes) AS database_bytes FROM account_database_records GROUP BY account_id
 ) d ON d.account_id=a.id;
INSERT INTO schema_migrations(version) VALUES(2),(3) ON CONFLICT DO NOTHING;`)
	return err
}

type storageUsage struct {
	Available     bool      `json:"available"`
	MediaBytes    int64     `json:"mediaBytes"`
	StagingBytes  int64     `json:"stagingBytes"`
	DatabaseBytes int64     `json:"databaseBytes"`
	TotalBytes    int64     `json:"totalBytes"`
	ObjectCount   int64     `json:"objectCount"`
	LimitBytes    *int64    `json:"limitBytes"`
	QuotaEnforced bool      `json:"quotaEnforced"`
	MeasuredAt    time.Time `json:"measuredAt"`
}

func (p *cloudDatabase) storageUsage(ctx context.Context, accountID string) (*storageUsage, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	u := &storageUsage{}
	err := p.conn.QueryRow(ctx, `SELECT media_bytes,staging_bytes,database_bytes,object_count,statement_timestamp() FROM account_storage_usage WHERE account_id=$1`, accountID).Scan(&u.MediaBytes, &u.StagingBytes, &u.DatabaseBytes, &u.ObjectCount, &u.MeasuredAt)
	if err != nil {
		return nil, err
	}
	u.Available = true
	u.TotalBytes = u.MediaBytes + u.StagingBytes + u.DatabaseBytes
	return u, nil
}
