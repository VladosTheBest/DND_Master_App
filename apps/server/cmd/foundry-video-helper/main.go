package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"shadowedge/server/internal/videoprep"
	"strings"
	"time"
)

func main() {
	version := flag.Bool("version", false, "Версия помощника")
	data := flag.String("foundry-data", "", "Папка Data вашего Foundry")
	base := flag.String("foundry-url", "http://localhost:30000", "Адрес Foundry для просмотра на сайте")
	origins := flag.String("origins", "https://dnd-master-app.fly.dev,http://127.0.0.1:4189", "Дополнительные разрешённые Origin через запятую")
	flag.Parse()
	if *version {
		fmt.Println("Shadow Edge video helper 0.18.0")
		return
	}
	root, err := filepath.Abs(*data)
	if *data == "" || err != nil {
		log.Fatal("Укажите --foundry-data с существующей папкой Data")
	}
	if info, e := os.Stat(root); e != nil || !info.IsDir() {
		log.Fatal("Папка Data не найдена")
	}
	u, e := url.Parse(*base)
	if e != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		log.Fatal("Некорректный --foundry-url")
	}
	yt, e := exec.LookPath("yt-dlp")
	if e != nil {
		log.Fatal("Установите yt-dlp и добавьте в PATH")
	}
	ff, e := exec.LookPath("ffmpeg")
	if e != nil {
		log.Fatal("Установите FFmpeg и добавьте в PATH")
	}
	probe, e := exec.LookPath("ffprobe")
	if e != nil {
		log.Fatal("Не найден ffprobe из FFmpeg")
	}
	token := os.Getenv("SHADOW_EDGE_VIDEO_TOKEN")
	if token != "" && len(token) < 24 {
		log.Fatal("SHADOW_EDGE_VIDEO_TOKEN должен содержать минимум 24 символа")
	}
	if token == "" {
		config, e := os.UserConfigDir()
		if e != nil {
			log.Fatal(e)
		}
		config = filepath.Join(config, "ShadowEdge", "video-helper")
		if e = os.MkdirAll(config, 0700); e != nil {
			log.Fatal(e)
		}
		digest := sha256.Sum256([]byte(root))
		keyPath := filepath.Join(config, hex.EncodeToString(digest[:8])+".key")
		if existing, e := os.ReadFile(keyPath); e == nil {
			token = strings.TrimSpace(string(existing))
			if len(token) < 24 {
				log.Fatal("Некорректный сохранённый ключ помощника")
			}
		} else if !os.IsNotExist(e) {
			log.Fatal("Не удалось прочитать ключ помощника")
		}
		if token == "" {
			b := make([]byte, 24)
			if _, e = rand.Read(b); e != nil {
				log.Fatal(e)
			}
			token = hex.EncodeToString(b)
			file, e := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
			if e != nil {
				log.Fatal("Не удалось сохранить ключ помощника")
			}
			if _, e = file.WriteString(token); e != nil {
				file.Close()
				log.Fatal(e)
			}
			file.Close()
		}
	}
	allow := map[string]bool{u.Scheme + "://" + u.Host: true}
	for _, v := range strings.Split(*origins, ",") {
		allow[strings.TrimSpace(v)] = true
	}
	h := &videoprep.Helper{Root: root, FoundryURL: strings.TrimRight(*base, "/"), Token: token, Origins: allow, YTDLP: yt, FFmpeg: ff, FFprobe: probe}
	fmt.Println("Помощник видео: http://127.0.0.1:4197\nКлюч подключения (только для мастера):", token)
	log.Fatal((&http.Server{Addr: "127.0.0.1:4197", Handler: h, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192}).ListenAndServe())
}
