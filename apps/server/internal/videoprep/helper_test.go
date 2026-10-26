package videoprep

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSourceValidation(t *testing.T) {
	valid := Source{URL: "https://youtu.be/SeaI-P8zXbQ?t=10", Duration: 300, Height: 1440}
	s, e := valid.Normalize()
	if e != nil || s.URL != "https://www.youtube.com/watch?v=SeaI-P8zXbQ" {
		t.Fatal(s, e)
	}
	for _, u := range []string{"file:///tmp/test", "https://youtube.com.evil.test/watch?v=SeaI-P8zXbQ", "https://127.0.0.1/watch?v=SeaI-P8zXbQ", "https://youtube.com/playlist?list=abc", "https://u:p@youtube.com/watch?v=SeaI-P8zXbQ", "https://youtube.com:444/watch?v=SeaI-P8zXbQ"} {
		v := valid
		v.URL = u
		if _, e := v.Normalize(); e == nil {
			t.Fatal("accepted", u)
		}
	}
	for _, duration := range []int{-1, 0, 601} {
		v := valid
		v.Duration = duration
		if _, e := v.Normalize(); e == nil {
			t.Fatal("duration", duration)
		}
	}
	other := s
	other.Height = 720
	if Key(other) == Key(s) {
		t.Fatal("quality shares cache")
	}
	other = s
	other.Start = 10
	if Key(other) == Key(s) {
		t.Fatal("range shares cache")
	}
}
func TestJobsAuthenticationCacheAndCommandArguments(t *testing.T) {
	h := &Helper{Root: t.TempDir(), FoundryURL: "http://localhost:30000", Token: strings.Repeat("k", 32), Origins: map[string]bool{"https://site.test": true}, YTDLP: "yt", FFmpeg: "ff", FFprobe: "probe"}
	calls := 0
	h.Run = func(_ context.Context, bin string, args ...string) ([]byte, error) {
		calls++
		if bin == "yt" {
			joined := strings.Join(args, " ")
			for _, part := range []string{"--ignore-config", "--download-sections *10-310", "height<=1440", "--use-extractors youtube", "--no-playlist"} {
				if !strings.Contains(joined, part) {
					t.Error("missing", part)
				}
			}
			return nil, nil
		}
		if bin == "probe" {
			return []byte(`{"streams":[{"width":2560,"height":1440}],"format":{"duration":"300"}}`), nil
		}
		return nil, os.WriteFile(args[len(args)-1], []byte("media"), 0600)
	}
	send := func(method, path, origin, key, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Origin", origin)
		r.Header.Set("Authorization", "Bearer "+key)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	body := `{"url":"https://youtu.be/SeaI-P8zXbQ","startSeconds":10,"durationSeconds":300,"maxHeight":1440}`
	if w := send("POST", "/jobs", "https://evil.test", h.Token, body); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := send("POST", "/jobs", "https://site.test", "bad", body); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if calls != 0 {
		t.Fatal("unauthorized process")
	}
	w := send("POST", "/jobs", "https://site.test", h.Token, body)
	if w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	var job Job
	json.Unmarshal(w.Body.Bytes(), &job)
	deadline := time.Now().Add(3 * time.Second)
	for {
		w = send("GET", "/jobs/"+job.ID, "https://site.test", h.Token, "")
		json.Unmarshal(w.Body.Bytes(), &job)
		if job.State != "working" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("timeout")
		}
		time.Sleep(time.Millisecond)
	}
	if job.State != "ready" || job.Result.Height != 1440 {
		t.Fatal(job)
	}
	count := calls
	s, _ := (Source{URL: "https://youtu.be/SeaI-P8zXbQ", Start: 10, Duration: 300, Height: 1440}).Normalize()
	result, e := h.prepare(s, Key(s))
	if e != nil || calls != count || !strings.HasSuffix(result.Path, ".mp4") {
		t.Fatal("cache", e, calls, count)
	}
	if _, e := os.Stat(filepath.Join(h.Root, "shadow-edge-gm", "video-cache", job.ID+"-pending.mp4")); !os.IsNotExist(e) {
		t.Fatal("pending left behind")
	}
}
