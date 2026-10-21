package httpapi

import (
	"strings"
	"testing"
)

func TestSceneCreativeSnapshotValidation(t *testing.T) {
	c := foundryConnection{OwnerID: "owner", CampaignID: "campaign"}
	raw := `{"version":1,"background":"#777568","grid":false,"items":[]}`
	level := sessionMapLevelDocument{ID: "ground", Name: "Drawing", ImageURL: "/uploads/owner/campaign/bg.png", Width: 1600, Height: 1000, Creative: raw}
	doc := sessionMapDocument{ID: "scene", Title: "Drawing", Levels: []sessionMapLevelDocument{level}}
	if err := validateSessionMap(doc, c); err != nil {
		t.Fatal(err)
	}
	doc.Levels[0].Width = 800
	if validateSessionMap(doc, c) == nil {
		t.Fatal("accepted mismatching drawing size")
	}
	doc.Levels[0] = level
	doc.Levels[0].Creative = `{"version":1,"background":"#777568","grid":false,"items":[{"id":"image","kind":"image","x":100,"y":100,"w":100,"h":100,"rotation":0,"color":"#345b38","imageUrl":"/uploads/foreign/campaign/private.png"}]}`
	if validateSessionMap(doc, c) == nil {
		t.Fatal("accepted foreign embedded image")
	}
	doc.Levels[0].Creative = strings.ReplaceAll(doc.Levels[0].Creative, "/foreign/", "/owner/")
	if err := validateSessionMap(doc, c); err != nil {
		t.Fatal(err)
	}
	doc.Levels[0].Creative = strings.Repeat("x", 1024*1024+1)
	if validateSessionMap(doc, c) == nil {
		t.Fatal("accepted oversized drawing")
	}
}
