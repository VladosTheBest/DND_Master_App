package httpapi

import (
	"bytes"
	"fmt"
	"image"
	"math"
	"strings"
)

// Raster tracing is opt-in or selected for explicitly described caves. It does
// not estimate coordinates with a language model and never redraws the bitmap.
func usesCaveRaster(in foundrySceneInput) bool {
	if in.WallMode == "cave" {
		return true
	}
	if in.WallMode == "ai" {
		return false
	}
	s := strings.ToLower(in.Title + " " + in.Prompt)
	return strings.Contains(s, "пещер") || strings.Contains(s, "cave") || strings.Contains(s, "grotto")
}

type rasterVertex struct{ x, y int }

func traceCaveRaster(raw []byte) (sessionMapLevelDocument, error) {
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return sessionMapLevelDocument{}, err
	}
	b := src.Bounds()
	scale := math.Min(1, 1200/float64(max(b.Dx(), b.Dy())))
	w, h := max(1, int(float64(b.Dx())*scale)), max(1, int(float64(b.Dy())*scale))
	gray := make([]int, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			r, g, bb, _ := src.At(b.Min.X+x*b.Dx()/w, b.Min.Y+y*b.Dy()/h).RGBA()
			gray[y*w+x] = int((299*r + 587*g + 114*bb) / 1000 / 257)
		}
	}
	// Box smoothing suppresses painted texture and grid pixels without moving
	// coordinates. The mask represents solid dark rock, not walkable ice/floor.
	sum := make([]int, (w+1)*(h+1))
	for y := 0; y < h; y++ {
		row := 0
		for x := 0; x < w; x++ {
			row += gray[y*w+x]
			sum[(y+1)*(w+1)+x+1] = sum[y*(w+1)+x+1] + row
		}
	}
	mask := make([]bool, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			x0, x1, y0, y1 := max(0, x-4), min(w, x+5), max(0, y-4), min(h, y+5)
			v := sum[y1*(w+1)+x1] - sum[y0*(w+1)+x1] - sum[y1*(w+1)+x0] + sum[y0*(w+1)+x0]
			mask[y*w+x] = v < 30*(x1-x0)*(y1-y0)
		}
	}
	// Closing fills small rock texture holes using a fixed 7px kernel.
	// It operates on the mask rather than closing entire room outlines.
	morph := func(input []bool, dilate bool, radius int) []bool {
		out := make([]bool, len(input))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				value := !dilate
				done := false
				for yy := max(0, y-radius); yy <= min(h-1, y+radius) && !done; yy++ {
					for xx := max(0, x-radius); xx <= min(w-1, x+radius); xx++ {
						if input[yy*w+xx] == dilate {
							value = dilate
							done = true
							break
						}
					}
				}
				out[y*w+x] = value
			}
		}
		return out
	}
	mask = morph(morph(mask, true, 3), false, 3)
	// Opening removes thin dark shadow bridges across cave mouths, while retaining
	// broad rock mass. It does not invent straight connections between chambers.
	mask = morph(morph(mask, false, 7), true, 7)
	// Remove isolated texture specks; keep the exterior rock and internal pillars.
	seen := make([]bool, len(mask))
	solid := 0
	minArea := max(16, w*h/2160)
	for start := range mask {
		if !mask[start] || seen[start] {
			continue
		}
		queue := []int{start}
		seen[start] = true
		for head := 0; head < len(queue); head++ {
			p := queue[head]
			x, y := p%w, p/w
			for _, d := range []rasterVertex{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
				xx, yy := x+d.x, y+d.y
				if xx < 0 || yy < 0 || xx >= w || yy >= h {
					continue
				}
				q := yy*w + xx
				if mask[q] && !seen[q] {
					seen[q] = true
					queue = append(queue, q)
				}
			}
		}
		if len(queue) < minArea {
			for _, p := range queue {
				mask[p] = false
			}
		} else {
			solid += len(queue)
		}
	}
	coverage := float64(solid) / float64(w*h)
	if coverage < .04 || coverage > .80 {
		return sessionMapLevelDocument{}, fmt.Errorf("Пиксельная трассировка не выделила тёмную скалу. Используйте AI-разметку или карту с контрастной границей скалы.")
	}
	edges := map[rasterVertex][]rasterVertex{}
	add := func(a, b rasterVertex) { edges[a] = append(edges[a], b) }
	isSolid := func(x, y int) bool { return x >= 0 && y >= 0 && x < w && y < h && mask[y*w+x] }
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if !isSolid(x, y) {
				continue
			}
			if !isSolid(x, y-1) {
				add(rasterVertex{x, y}, rasterVertex{x + 1, y})
			}
			if !isSolid(x+1, y) {
				add(rasterVertex{x + 1, y}, rasterVertex{x + 1, y + 1})
			}
			if !isSolid(x, y+1) {
				add(rasterVertex{x + 1, y + 1}, rasterVertex{x, y + 1})
			}
			if !isSolid(x-1, y) {
				add(rasterVertex{x, y + 1}, rasterVertex{x, y})
			}
		}
	}
	walls := []publicDisplayWall{}
	// Iterate scan order rather than map order so the same bitmap is reproducible.
	for y := 0; y <= h; y++ {
		for x := 0; x <= w; x++ {
			start := rasterVertex{x, y}
			for len(edges[start]) > 0 {
				path := []rasterVertex{start}
				cur := start
				for {
					nexts := edges[cur]
					if len(nexts) == 0 {
						break
					}
					next := nexts[len(nexts)-1]
					edges[cur] = nexts[:len(nexts)-1]
					path = append(path, next)
					cur = next
					if cur == start {
						break
					}
				}
				if len(path) < 4 {
					continue
				}
				// Two open halves avoid degenerate closed-polygon simplification.
				half := len(path) / 2
				simple := append(rasterSimplify(path[:half+1], 1.5), rasterSimplify(path[half:], 1.5)[1:]...)
				for i := 1; i < len(simple); i++ {
					a, c := simple[i-1], simple[i]
					if a == c || (a.x == 0 && c.x == 0) || (a.y == 0 && c.y == 0) || (a.x == w && c.x == w) || (a.y == h && c.y == h) {
						continue
					}
					walls = append(walls, publicDisplayWall{ID: fmt.Sprintf("raster-%d", len(walls)+1), Kind: "wall", Start: publicFogPoint{X: float64(a.x) / float64(w), Y: float64(a.y) / float64(h)}, End: publicFogPoint{X: float64(c.x) / float64(w), Y: float64(c.y) / float64(h)}})
				}
			}
		}
	}
	if len(walls) == 0 || len(walls) > 10000 {
		return sessionMapLevelDocument{}, fmt.Errorf("Слишком сложный контур скалы для безопасной трассировки.")
	}
	return sessionMapLevelDocument{Walls: walls, Lights: []sceneLight{}, Darkness: 0}, nil
}

func rasterSimplify(p []rasterVertex, epsilon float64) []rasterVertex {
	if len(p) < 3 {
		return p
	}
	a, b := p[0], p[len(p)-1]
	dx, dy := float64(b.x-a.x), float64(b.y-a.y)
	den := dx*dx + dy*dy
	best, index := 0., 0
	for i := 1; i < len(p)-1; i++ {
		px, py := float64(p[i].x-a.x), float64(p[i].y-a.y)
		t := 0.
		if den > 0 {
			t = math.Max(0, math.Min(1, (px*dx+py*dy)/den))
		}
		d := math.Hypot(px-t*dx, py-t*dy)
		if d > best {
			best, index = d, i
		}
	}
	if best <= epsilon {
		return []rasterVertex{a, b}
	}
	left := rasterSimplify(p[:index+1], epsilon)
	return append(left[:len(left)-1], rasterSimplify(p[index:], epsilon)...)
}
