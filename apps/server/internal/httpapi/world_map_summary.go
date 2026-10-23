package httpapi

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"golang.org/x/image/draw"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
)

type worldMapSummary struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Revision     int    `json:"revision"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Creative     bool   `json:"creative"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

func mapSummary(campaign string, m worldMapDocument) worldMapSummary {
	return worldMapSummary{m.ID, m.Title, m.Revision, m.Width, m.Height, m.Creative != "", "/api/campaigns/" + url.PathEscape(campaign) + "/world-maps/" + url.PathEscape(m.ID) + "?thumbnail=1"}
}

var thumbnailSlot = make(chan struct{}, 1)

func (srv *server) serveMapThumbnail(w http.ResponseWriter, r *http.Request, user authUser, campaign campaignData, m worldMapDocument) {
	key := fmt.Sprintf("%x", sha256.Sum256([]byte(user.ID+"\n"+campaign.ID+"\n"+m.ImageURL)))
	dir := filepath.Join(os.TempDir(), "shadow-edge-map-thumbnails")
	file := filepath.Join(dir, key+".jpg")
	if _, err := os.Stat(file); err != nil {
		select {
		case thumbnailSlot <- struct{}{}:
			defer func() { <-thumbnailSlot }()
		case <-r.Context().Done():
			return
		}
		if _, err = os.Stat(file); err != nil {
			_, data, e := srv.worldMapReference(r.Context(), user.ID, campaign.ID, m.ImageURL)
			if e != nil {
				writeError(w, 404, "thumbnail_unavailable", "Предпросмотр недоступен.")
				return
			}
			config, _, e := image.DecodeConfig(bytes.NewReader(data))
			if e != nil || int64(config.Width)*int64(config.Height) > 64000000 {
				writeError(w, 422, "thumbnail_unavailable", "Изображение слишком велико для предпросмотра.")
				return
			}
			src, _, e := image.Decode(bytes.NewReader(data))
			if e != nil {
				writeError(w, 422, "thumbnail_unavailable", "Предпросмотр недоступен.")
				return
			}
			width, height := config.Width, config.Height
			if width > 320 || height > 240 {
				scale := min(320.0/float64(width), 240.0/float64(height))
				width = max(1, int(float64(width)*scale))
				height = max(1, int(float64(height)*scale))
			}
			dst := image.NewRGBA(image.Rect(0, 0, width, height))
			draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
			draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
			var out bytes.Buffer
			if jpeg.Encode(&out, dst, &jpeg.Options{Quality: 75}) != nil || os.MkdirAll(dir, 0700) != nil || writeFileAtomically(file, out.Bytes(), 0600) != nil {
				writeError(w, 500, "thumbnail_unavailable", "Предпросмотр недоступен.")
				return
			}
		}
	}
	w.Header().Set("Cache-Control", "private, max-age=0, must-revalidate")
	w.Header().Set("ETag", "\""+key+"\"")
	http.ServeFile(w, r, file)
}
