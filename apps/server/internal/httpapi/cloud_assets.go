package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

type cloudObject struct {
	Hash        string
	Size, Mtime int64
	ContentType string
}
type cloudAssets struct {
	db           *cloudDatabase
	client       *s3.Client
	bucket, root string
	mu           sync.Mutex
	objects      map[string]cloudObject
}

func newCloudAssets(db *cloudDatabase, root string) (*cloudAssets, error) {
	bucket := os.Getenv("BUCKET_NAME")
	endpoint := os.Getenv("AWS_ENDPOINT_URL_S3")
	if bucket == "" || !strings.HasPrefix(endpoint, "https://") {
		return nil, errors.New("private S3 bucket and HTTPS endpoint are required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("auto"))
	if err != nil {
		return nil, errors.New("load S3 configuration failed")
	}
	cfg.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	if _, err = client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)}); err != nil {
		return nil, errors.New("S3 bucket unavailable")
	}
	a := &cloudAssets{db: db, client: client, bucket: bucket, root: root, objects: map[string]cloudObject{}}
	db.mu.Lock()
	defer db.mu.Unlock()
	rows, err := db.conn.Query(ctx, "SELECT object_key,sha256,size_bytes,source_mtime_ns,content_type FROM storage_objects")
	if err != nil {
		return nil, errors.New("read object manifest failed")
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var object cloudObject
		if err = rows.Scan(&key, &object.Hash, &object.Size, &object.Mtime, &object.ContentType); err != nil {
			return nil, err
		}
		a.objects[key] = object
	}
	return a, rows.Err()
}

func (a *cloudAssets) putFile(ctx context.Context, filePath, key string, force bool) error {
	info, err := os.Lstat(filePath)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("only regular files can be migrated")
	}
	a.mu.Lock()
	old, exists := a.objects[key]
	a.mu.Unlock()
	if !force && exists && old.Size == info.Size() && old.Mtime == info.ModTime().UnixNano() {
		return nil
	}
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err = io.Copy(hash, file); err != nil {
		return err
	}
	digest := hash.Sum(nil)
	sha := hex.EncodeToString(digest)
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return err
	}
	contentType := mime.TypeByExtension(filepath.Ext(filePath))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	_, err = a.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(a.bucket), Key: aws.String(key), Body: file, ContentLength: aws.Int64(info.Size()), ContentType: aws.String(contentType), ChecksumSHA256: aws.String(base64.StdEncoding.EncodeToString(digest)), Metadata: map[string]string{"sha256": sha}})
	if err != nil {
		return errors.New("S3 upload failed")
	}
	// Verify the stored bytes, not only client-supplied metadata or multipart ETags.
	remote, err := a.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(a.bucket), Key: aws.String(key)})
	if err != nil {
		return errors.New("S3 verification read failed")
	}
	remoteHash := sha256.New()
	size, readErr := io.Copy(remoteHash, remote.Body)
	closeErr := remote.Body.Close()
	if readErr != nil || closeErr != nil || size != info.Size() || hex.EncodeToString(remoteHash.Sum(nil)) != sha {
		return errors.New("S3 content verification failed")
	}
	after, err := file.Stat()
	if err != nil || after.Size() != info.Size() || !after.ModTime().Equal(info.ModTime()) {
		return errors.New("source changed during migration; retry required")
	}
	a.db.mu.Lock()
	_, err = a.db.conn.Exec(ctx, `INSERT INTO storage_objects(object_key,sha256,size_bytes,source_mtime_ns,content_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(object_key) DO UPDATE SET sha256=excluded.sha256,size_bytes=excluded.size_bytes,source_mtime_ns=excluded.source_mtime_ns,content_type=excluded.content_type,verified_at=now()`, key, sha, size, info.ModTime().UnixNano(), contentType)
	a.db.mu.Unlock()
	if err != nil {
		return errors.New("persist object manifest failed")
	}
	a.mu.Lock()
	a.objects[key] = cloudObject{sha, size, info.ModTime().UnixNano(), contentType}
	a.mu.Unlock()
	return nil
}

func (a *cloudAssets) syncTree(ctx context.Context, root, prefix string) error {
	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	type item struct{ file, key string }
	queue := make(chan item, 32)
	var workers sync.WaitGroup
	var firstErr error
	var once sync.Once
	var completed atomic.Int64
	for i := 0; i < 12; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for task := range queue {
				if ctx.Err() != nil {
					continue
				}
				if err := a.putFile(ctx, task.file, task.key, false); err != nil {
					once.Do(func() { firstErr = err; cancel() })
				} else if count := completed.Add(1); count%1000 == 0 {
					log.Printf("cloud copy %s: %d verified files", prefix, count)
				}
			}
		}()
	}
	walkErr := filepath.WalkDir(root, func(file string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return errors.New("symlink in migration source")
		}
		if entry.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, file)
		if err != nil {
			return err
		}
		select {
		case queue <- item{file, path.Join(prefix, filepath.ToSlash(rel))}:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	close(queue)
	workers.Wait()
	log.Printf("cloud copy %s: %d files complete", prefix, completed.Load())
	if firstErr != nil {
		return firstErr
	}
	return walkErr
}

func (a *cloudAssets) publishUpload(ctx context.Context, filePath string) error {
	rel, err := filepath.Rel(a.root, filePath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return errors.New("invalid upload path")
	}
	if err = a.putFile(ctx, filePath, path.Join("uploads", filepath.ToSlash(rel)), false); err != nil {
		return err
	}
	base := strings.TrimSuffix(filePath, filepath.Ext(filePath))
	descriptor := base + ".dzi"
	if _, err = os.Stat(descriptor); err == nil {
		descriptorRel, _ := filepath.Rel(a.root, descriptor)
		if err = a.putFile(ctx, descriptor, path.Join("uploads", filepath.ToSlash(descriptorRel)), false); err != nil {
			return err
		}
		// Tiles are disposable local cache; only originals and descriptors belong in S3.
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (a *cloudAssets) ensureLocal(ctx context.Context, filePath, key string) error {
	if info, err := os.Stat(filePath); err == nil && info.Mode().IsRegular() {
		return nil
	}
	remote, err := a.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(a.bucket), Key: aws.String(key)})
	if err != nil {
		return errors.New("S3 source missing")
	}
	defer remote.Body.Close()
	if err = os.MkdirAll(filepath.Dir(filePath), 0700); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(filePath), ".download-*")
	if err != nil {
		return err
	}
	temp := file.Name()
	defer os.Remove(temp)
	_, copyErr := io.Copy(file, remote.Body)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(temp, filePath)
}

func publicObjectKey(urlPath string) (string, bool) {
	if !strings.HasPrefix(urlPath, "/uploads/") || strings.ContainsAny(urlPath, "\\\x00") {
		return "", false
	}
	rel := strings.TrimPrefix(urlPath, "/uploads/")
	for _, segment := range strings.Split(rel, "/") {
		if segment == ".." || segment == "." || segment == "" {
			return "", false
		}
	}
	first := strings.Split(rel, "/")[0]
	if strings.EqualFold(strings.TrimRight(first, ". "), ".proposals") {
		return "", false
	}
	return "uploads/" + rel, true
}

func (a *cloudAssets) serve(w http.ResponseWriter, r *http.Request, key string, private bool) {
	if r.Method != "GET" && r.Method != "HEAD" {
		http.NotFound(w, r)
		return
	}
	input := &s3.GetObjectInput{Bucket: aws.String(a.bucket), Key: aws.String(key)}
	if value := r.Header.Get("Range"); value != "" {
		input.Range = aws.String(value)
	}
	if value := r.Header.Get("If-None-Match"); value != "" {
		input.IfNoneMatch = aws.String(value)
	}
	output, err := a.client.GetObject(r.Context(), input)
	if err != nil {
		var response *smithyhttp.ResponseError
		if errors.As(err, &response) {
			switch response.HTTPStatusCode() {
			case 404:
				http.NotFound(w, r)
				return
			case 304:
				w.WriteHeader(304)
				return
			case 416:
				w.WriteHeader(416)
				return
			}
		}
		http.Error(w, "Storage unavailable", 503)
		return
	}
	defer output.Body.Close()
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if private {
		w.Header().Set("Cache-Control", "private, no-store")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	if output.ContentType != nil {
		w.Header().Set("Content-Type", *output.ContentType)
	}
	if output.ETag != nil {
		w.Header().Set("ETag", *output.ETag)
	}
	w.Header().Set("Accept-Ranges", "bytes")
	if output.ContentLength != nil {
		w.Header().Set("Content-Length", fmt.Sprint(*output.ContentLength))
	}
	if output.LastModified != nil {
		w.Header().Set("Last-Modified", output.LastModified.UTC().Format(http.TimeFormat))
	}
	if output.ContentRange != nil {
		w.Header().Set("Content-Range", *output.ContentRange)
		w.WriteHeader(206)
	}
	if r.Method == "GET" {
		_, _ = io.Copy(w, output.Body)
	}
}

func (a *cloudAssets) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, ok := publicObjectKey(r.URL.Path)
		if !ok {
			http.NotFound(w, r)
			return
		}
		a.serve(w, r, key, false)
	})
}
