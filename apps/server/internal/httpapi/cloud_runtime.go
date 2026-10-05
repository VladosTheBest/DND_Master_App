package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

func cloudStateDigest(state storageState) string {
	body, _ := json.Marshal(state)
	return cloudJSONDigest(body)
}

func cloudJSONDigest(body []byte) string {
	var canonical any
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	_ = decoder.Decode(&canonical)
	body, _ = json.Marshal(canonical)
	digest := sha256.Sum256(body)
	return hex.EncodeToString(digest[:])
}

func loadCloudCampaignStore(db *cloudDatabase, assets *cloudAssets, options Options) (*campaignStore, error) {
	state, exists, err := db.loadState()
	if err != nil {
		return nil, err
	}
	if exists {
		var completed bool
		err = db.conn.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM migration_runs WHERE id='legacy-json-v1')").Scan(&completed)
		if err != nil {
			return nil, errors.New("read migration marker failed")
		}
		if !completed {
			legacy, readErr := readLegacyCloudSource(options.DataFile)
			if !options.ImportLegacyJSON || readErr != nil || cloudStateDigest(legacy) != cloudStateDigest(state) {
				return nil, errors.New("incomplete SQL migration; source and database must match before resuming")
			}
			if err = recordCloudMigration(db, state); err != nil {
				return nil, err
			}
		}
		return &campaignStore{path: options.DataFile, cloud: db, data: state}, nil
	}
	if !options.ImportLegacyJSON {
		return nil, errors.New("database is empty; explicit legacy import is required")
	}
	state, err = readLegacyCloudSource(options.DataFile)
	if err != nil {
		return nil, err
	}
	meta, records, err := splitCloudState(state)
	if err != nil {
		return nil, err
	}
	restored, err := joinCloudState(meta, records)
	if err != nil || cloudStateDigest(restored) != cloudStateDigest(state) {
		return nil, errors.New("migration codec roundtrip mismatch")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	defer cancel()
	if err = assets.syncTree(ctx, options.UploadDir, "uploads"); err != nil {
		return nil, err
	}
	if err = assets.syncTree(ctx, filepath.Clean(options.UploadDir)+".proposals", "staging"); err != nil {
		return nil, err
	}
	digest := cloudStateDigest(state)
	if err = assets.putFile(ctx, options.DataFile, path.Join("backups", "pre-postgres", digest, "store.json"), false); err != nil {
		return nil, err
	}
	for _, suffix := range []string{".bak", ".ai-jobs.json"} {
		if _, err = os.Stat(options.DataFile + suffix); err == nil {
			if err = assets.putFile(ctx, options.DataFile+suffix, path.Join("backups", "pre-postgres", digest, "store.json"+suffix), false); err != nil {
				return nil, err
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	// Catalog caches are reproducible, but retain a private migration snapshot too.
	for _, cache := range []string{options.BestiaryCacheFile, options.ItemCatalogCacheFile} {
		if cache == "" {
			continue
		}
		if _, statErr := os.Stat(cache); statErr == nil {
			if err = assets.putFile(ctx, cache, path.Join("backups", "catalog-cache", filepath.Base(cache)), false); err != nil {
				return nil, err
			}
		} else if !errors.Is(statErr, os.ErrNotExist) {
			return nil, statErr
		}
		details := strings.TrimSuffix(cache, filepath.Ext(cache)) + "-details"
		if err = assets.syncTree(ctx, details, path.Join("backups", "catalog-cache", filepath.Base(details))); err != nil {
			return nil, err
		}
	}
	if err = db.saveState(state); err != nil {
		return nil, err
	}
	loaded, _, err := db.loadState()
	if err != nil || cloudStateDigest(loaded) != digest {
		return nil, errors.New("database roundtrip verification failed; application was not started")
	}
	if err = recordCloudMigration(db, loaded); err != nil {
		return nil, err
	}
	return &campaignStore{path: options.DataFile, cloud: db, data: loaded}, nil
}

func readLegacyCloudSource(file string) (storageState, error) {
	var state storageState
	raw, err := os.ReadFile(file)
	if err != nil {
		return state, errors.New("legacy source unavailable; refusing to seed an empty database")
	}
	if !utf8.Valid(raw) {
		return state, errors.New("legacy source must be valid UTF-8")
	}
	decoder := json.NewDecoder(bytes.NewReader(bytes.TrimPrefix(raw, []byte{0xef, 0xbb, 0xbf})))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&state); err != nil {
		return state, fmt.Errorf("legacy schema validation failed: %w", err)
	}
	if err = decoder.Decode(new(any)); err != io.EOF {
		return state, errors.New("trailing data in legacy source")
	}
	return state, nil
}

func recordCloudMigration(db *cloudDatabase, state storageState) error {
	_, records, err := splitCloudState(state)
	if err != nil {
		return err
	}
	counts := map[string]int{}
	for _, record := range records {
		counts[record.Table]++
	}
	body, _ := json.Marshal(counts)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err = db.conn.Exec(ctx, `INSERT INTO migration_runs(id,source_digest,counts) VALUES('legacy-json-v1',$1,$2::jsonb)`, cloudStateDigest(state), string(body)); err != nil {
		return errors.New("record migration verification failed")
	}
	log.Printf("PostgreSQL migration verified: %s", body)
	return nil
}

// Pre-copy runs while the legacy app still serves traffic. Final import is only
// performed by the replacement server after the old process has stopped.
func PrepareCloudStorage(databaseURL, uploadDir, dataFile string) error {
	state, err := readLegacyCloudSource(dataFile)
	if err != nil {
		return err
	}
	meta, records, err := splitCloudState(state)
	if err != nil {
		return err
	}
	check, err := joinCloudState(meta, records)
	if err != nil || cloudStateDigest(check) != cloudStateDigest(state) {
		return errors.New("source roundtrip failed")
	}
	log.Printf("Legacy source validated: %d domain records", len(records))
	db, err := openCloudDatabase(databaseURL)
	if err != nil {
		return err
	}
	defer db.close()
	var migrated bool
	if err = db.conn.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM migration_runs WHERE id='legacy-json-v1')").Scan(&migrated); err != nil {
		return err
	}
	if migrated {
		return errors.New("database already migrated; legacy pre-copy is disabled")
	}
	assets, err := newCloudAssets(db, uploadDir)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()
	if err = assets.syncTree(ctx, uploadDir, "uploads"); err != nil {
		return err
	}
	if err = assets.syncTree(ctx, filepath.Clean(uploadDir)+".proposals", "staging"); err != nil {
		return err
	}
	return nil
}

// Read-only operational check; it neither acquires the writer lock nor repairs data.
func CloudStorageStatus(databaseURL, dataFile string) error {
	u, err := url.Parse(databaseURL)
	if err != nil {
		return errors.New("invalid database configuration")
	}
	if stringsHasFlyPooler(u.Hostname()) {
		u.Host = "direct." + u.Host[len("pgbouncer."):]
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	conn, err := pgx.Connect(ctx, u.String())
	if err != nil {
		return errors.New("database unavailable")
	}
	defer conn.Close(ctx)
	if _, err = conn.Exec(ctx, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); err != nil {
		return err
	}
	defer conn.Exec(ctx, "ROLLBACK")
	db := &cloudDatabase{conn: conn, previous: map[string]cloudRecord{}}
	state, exists, err := db.loadState()
	if err != nil {
		return err
	}
	var objects, bytes int64
	if err = conn.QueryRow(ctx, "SELECT count(*),coalesce(sum(size_bytes),0) FROM storage_objects").Scan(&objects, &bytes); err != nil {
		return err
	}
	log.Printf("S3 manifest: %d verified objects, %d bytes; PostgreSQL initialized: %t", objects, bytes, exists)
	rows, err := conn.Query(ctx, "SELECT media_bytes,staging_bytes,database_bytes,object_count FROM account_storage_usage ORDER BY account_id")
	if err != nil {
		return err
	}
	accountCount := 0
	for rows.Next() {
		var media, staging, database, count int64
		if err = rows.Scan(&media, &staging, &database, &count); err != nil {
			rows.Close()
			return err
		}
		accountCount++
		log.Printf("Storage account #%d: media=%d staging=%d database=%d objects=%d", accountCount, media, staging, database, count)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	var unassigned, system int64
	if err = conn.QueryRow(ctx, `SELECT coalesce(sum(size_bytes) FILTER(WHERE split_part(object_key,'/',1) IN ('uploads','staging') AND NOT EXISTS(SELECT 1 FROM owned_storage_objects o WHERE o.object_key=s.object_key)),0),coalesce(sum(size_bytes) FILTER(WHERE split_part(object_key,'/',1) NOT IN ('uploads','staging')),0) FROM storage_objects s`).Scan(&unassigned, &system); err != nil {
		return err
	}
	log.Printf("Storage attribution: accounts=%d unassigned_media_bytes=%d system_bytes=%d", accountCount, unassigned, system)
	if exists {
		_, records, err := splitCloudState(state)
		if err != nil {
			return err
		}
		counts := map[string]int{}
		for _, record := range records {
			counts[record.Table]++
		}
		body, _ := json.Marshal(counts)
		log.Printf("Database domain counts: %s", body)
		var jobs int
		if err = conn.QueryRow(ctx, "SELECT count(*) FROM ai_jobs").Scan(&jobs); err != nil {
			return err
		}
		log.Printf("Database AI jobs: %d", jobs)
		legacy, err := readLegacyCloudSource(dataFile)
		if err != nil {
			return err
		}
		var digest string
		if err = conn.QueryRow(ctx, "SELECT source_digest FROM migration_runs WHERE id='legacy-json-v1'").Scan(&digest); err != nil {
			return err
		}
		log.Printf("Retained source matches verified import: %t", cloudStateDigest(legacy) == digest)
	}
	return nil
}
