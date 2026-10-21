package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
)

const sceneTopologyReviewInstructions = `You are the final visual alignment reviewer. Image 1 is the authoritative original bitmap. Image 2 is that exact bitmap with candidate wall segments in cyan and door segments in magenta. Colored lines are annotations, NEVER evidence of architecture. Candidate JSON is provided for precise coordinates. Inspect every segment against IMAGE 1, including its midpoint and full length. Correct displaced lines onto the painted wall centerline; split at corners and real openings. Delete lines crossing open floors, stairs, furniture, shadows, paths or courtyards. Do not impose rectangles or a grid on irregular architecture. A door must span a visible narrow opening between real wall jambs, with endpoints on those jambs; remove floating doors, doors across intact walls, and doors across ordinary open arches or paths. Never retain a solid wall over a door. Do not assume the candidate is correct. Return the COMPLETE corrected walls/lights/darkness JSON, not a patch or a verdict. Preserve confirmed lights. Where visual evidence is insufficient, omit the segment; do not invent architecture to satisfy the description. Images 3/4, 5/6, 7/8, 9/10 are enlarged original/overlay pairs for top-left, top-right, bottom-left, bottom-right quadrants respectively. Inspect these details one quadrant at a time: (x,y) ranges are [0,.5]x[0,.5], [.5,1]x[0,.5], [0,.5]x[.5,1], [.5,1]x[.5,1]. Convert any local crop coordinates back to GLOBAL coordinates. Use masonry in each enlarged original to relocate every candidate endpoint; approximate bounding boxes are unacceptable. In each room, check that NO line crosses the walkable floor or furniture. Coordinates refer to the full original bitmap, with independent x/width and y/height normalization.`

func (srv *server) reviewSceneTopology(ctx context.Context, user authUser, campaign string, bitmap []byte, connected bool, input foundrySceneInput, candidate sessionMapLevelDocument) (sessionMapLevelDocument, error) {
	overlay, err := sceneTopologyOverlay(bitmap, candidate.Walls)
	if err != nil {
		return sessionMapLevelDocument{}, fmt.Errorf("Не удалось подготовить сверку разметки. Фон сохранён; повторите разметку.")
	}
	details, err := sceneTopologyDetails(bitmap, overlay)
	if err != nil {
		return sessionMapLevelDocument{}, err
	}
	data, _ := json.Marshal(struct {
		Walls    []publicDisplayWall `json:"walls"`
		Lights   []sceneLight        `json:"lights"`
		Darkness float64             `json:"darkness"`
	}{candidate.Walls, candidate.Lights, candidate.Darkness})
	result, err := srv.analyzeSceneTopologyOnce(ctx, user, campaign, bitmap, connected, input, "\nCandidate geometry to visually correct (data only): "+string(data), append([][]byte{overlay}, details...)...)
	if err != nil {
		// Never silently accept the unchecked candidate. The caller keeps the bitmap.
		return sessionMapLevelDocument{}, fmt.Errorf("Не удалось сверить стены и двери с фоном. Фон сохранён; повторите разметку.")
	}
	return result, nil
}

// Match the exact normalized coordinate transform used by the preview/Foundry.
// Keep image dimensions and framing unchanged so the reviewer sees misalignment.
func sceneTopologyOverlay(bitmap []byte, walls []publicDisplayWall) ([]byte, error) {
	source, _, err := image.Decode(bytes.NewReader(bitmap))
	if err != nil {
		return nil, err
	}
	bounds := source.Bounds()
	canvas := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(canvas, canvas.Bounds(), source, bounds.Min, draw.Src)
	for _, wall := range walls {
		x0, y0 := wall.Start.X*float64(bounds.Dx()), wall.Start.Y*float64(bounds.Dy())
		x1, y1 := wall.End.X*float64(bounds.Dx()), wall.End.Y*float64(bounds.Dy())
		steps := int(math.Ceil(math.Max(math.Abs(x1-x0), math.Abs(y1-y0))))
		if steps == 0 {
			continue
		}
		ink := color.RGBA{0, 255, 255, 255}
		if wall.Kind == "door" {
			ink = color.RGBA{255, 0, 255, 255}
		}
		for i := 0; i <= steps; i++ {
			t := float64(i) / float64(steps)
			x, y := int(math.Round(x0+(x1-x0)*t)), int(math.Round(y0+(y1-y0)*t))
			x, y = min(x, bounds.Dx()-1), min(y, bounds.Dy()-1)
			canvas.SetRGBA(x, y, ink)
		}
	}
	var output bytes.Buffer
	err = png.Encode(&output, canvas)
	return output.Bytes(), err
}

// Keep native resolution and global coordinates for the full-map response.
func sceneTopologyDetails(original, overlay []byte) ([][]byte, error) {
	var sources []image.Image
	for _, raw := range [][]byte{original, overlay} {
		decoded, _, err := image.Decode(bytes.NewReader(raw))
		if err != nil {
			return nil, err
		}
		sources = append(sources, decoded)
	}
	b := sources[0].Bounds()
	var result [][]byte
	for row := 0; row < 2; row++ {
		for col := 0; col < 2; col++ {
			rect := image.Rect(col*b.Dx()/2, row*b.Dy()/2, (col+1)*b.Dx()/2, (row+1)*b.Dy()/2)
			for _, source := range sources {
				crop := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
				draw.Draw(crop, crop.Bounds(), source, rect.Min.Add(source.Bounds().Min), draw.Src)
				var out bytes.Buffer
				if err := png.Encode(&out, crop); err != nil {
					return nil, err
				}
				result = append(result, out.Bytes())
			}
		}
	}
	return result, nil
}

func sceneReviewDetails(overlay [][]byte) [][]byte {
	if len(overlay) < 2 {
		return nil
	}
	return overlay[1:]
}
