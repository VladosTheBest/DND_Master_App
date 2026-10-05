package httpapi

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

// Packs ship with the executable; no user store or upload directory is used as
// an authoring source. Only this repository can change a released adventure.
//
//go:embed ready_campaigns
var readyCampaignFiles embed.FS
var readyAssetModTime = time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)

var errReadyCampaignReadOnly = errors.New("Готовые Кампании: материалы приключения нельзя изменять. Игроки, бои и журнал прохождения доступны.")

type readyCampaignInfo struct {
	TemplateID  string `json:"templateId"`
	Version     int    `json:"version"`
	Label       string `json:"label"`
	ContentHash string `json:"contentHash"`
}

type readyCampaignCatalogEntry struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Summary     string         `json:"summary"`
	System      string         `json:"system"`
	Label       string         `json:"label"`
	Version     int            `json:"version"`
	SourcePages int            `json:"sourcePages"`
	Counts      map[string]int `json:"counts"`
}

func readReadyCampaign(id string) (campaignData, error) {
	if id != "icewind-dale-rus" {
		return campaignData{}, fmt.Errorf("ready campaign template not found")
	}
	body, err := readyCampaignFiles.ReadFile("ready_campaigns/" + id + "/campaign.json")
	if err != nil {
		return campaignData{}, err
	}
	var campaign campaignData
	if err = json.Unmarshal(body, &campaign); err != nil {
		return campaignData{}, err
	}
	return campaign, nil
}

func instantiateReadyCampaign(templateID, campaignID, ownerID string) (campaignData, error) {
	campaign, err := readReadyCampaign(templateID)
	if err != nil {
		return campaignData{}, err
	}
	campaign.ID, campaign.OwnerID = campaignID, ownerID
	// IDs must be unique across multiple playthroughs and SQL entity rows.
	ids := map[string]string{}
	collections := []*[]knowledgeEntity{&campaign.Locations, &campaign.NPCs, &campaign.Monsters, &campaign.Quests, &campaign.Lore}
	for _, entities := range collections {
		for _, entity := range *entities {
			ids[entity.ID] = campaignID + "-" + entity.ID
		}
	}
	for _, entities := range collections {
		for i := range *entities {
			e := &(*entities)[i]
			e.ID = ids[e.ID]
			e.ParentID, e.LocationID, e.IssuerID = ids[e.ParentID], ids[e.LocationID], ids[e.IssuerID]
			for j := range e.Related {
				e.Related[j].ID = ids[e.Related[j].ID]
			}
		}
	}
	for i := range campaign.WorldMaps {
		m := &campaign.WorldMaps[i]
		m.ID = campaignID + "-" + m.ID
		if m.Context != nil {
			m.Context.LocationID = ids[m.Context.LocationID]
		}
	}
	for i := range campaign.Events {
		campaign.Events[i].ID = campaignID + "-" + campaign.Events[i].ID
		campaign.Events[i].LocationID = ids[campaign.Events[i].LocationID]
	}
	for i := range campaign.Shops {
		campaign.Shops[i].ID = campaignID + "-" + campaign.Shops[i].ID
		campaign.Shops[i].LocationID = ids[campaign.Shops[i].LocationID]
	}
	campaign = ensureCampaignShape(campaign)
	campaign.ReadyCampaign = &readyCampaignInfo{TemplateID: templateID, Version: 1, Label: "Готовые Кампании"}
	campaign.ReadyCampaign.ContentHash = readyCampaignDigest(campaign)
	return campaign, nil
}

// Gameplay is intentionally excluded: players/character sheets, combat state,
// encounter preparation, playback, surveys, display tokens and imported sessions.
// Everything authored in the book, including media and entity revisions, is sealed.
func readyCampaignDigest(c campaignData) string {
	sealed := struct {
		ID, OwnerID, Title, System, SettingName, InWorldDate, Summary string
		Locations, NPCs, Monsters, Quests, Lore                       []knowledgeEntity
		Events                                                        []worldEvent
		Shops                                                         []campaignShop
		SessionPrep                                                   []sessionPrepItem
		WorldMaps                                                     []worldMapDocument
		TemplateID                                                    string
		Version                                                       int
	}{c.ID, c.OwnerID, c.Title, c.System, c.SettingName, c.InWorldDate, c.Summary,
		c.Locations, c.NPCs, c.Monsters, c.Quests, c.Lore, c.Events, c.Shops, c.SessionPrep, c.WorldMaps, "", 0}
	if c.ReadyCampaign != nil {
		sealed.TemplateID, sealed.Version = c.ReadyCampaign.TemplateID, c.ReadyCampaign.Version
	}
	body, _ := json.Marshal(sealed)
	digest := sha256.Sum256(body)
	return hex.EncodeToString(digest[:])
}

func (srv *server) handleReadyCampaigns(w http.ResponseWriter, r *http.Request) {
	if _, ok := srv.requireAuthUser(w, r); !ok {
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeError(w, 405, "method_not_allowed", "Only GET and HEAD are supported")
		return
	}
	segments := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/campaign-templates"), "/"), "/")
	if len(segments) == 1 && segments[0] == "" {
		c, err := readReadyCampaign("icewind-dale-rus")
		if err != nil {
			writeError(w, 500, "template_unavailable", "Не удалось прочитать готовую кампанию.")
			return
		}
		writeJSON(w, 200, []readyCampaignCatalogEntry{{ID: c.ID, Title: c.Title, Summary: c.Summary, System: c.System, Label: "Готовые Кампании", Version: 1, SourcePages: 323,
			Counts: map[string]int{"locations": len(c.Locations), "npcs": len(c.NPCs), "monsters": len(c.Monsters), "quests": len(c.Quests), "lore": len(c.Lore), "maps": len(c.WorldMaps), "events": len(c.Events), "shops": len(c.Shops)}}})
		return
	}
	if len(segments) < 4 || segments[0] != "icewind-dale-rus" || segments[1] != "assets" {
		writeError(w, 404, "not_found", "Материал кампании не найден.")
		return
	}
	name := strings.Join(segments[2:], "/")
	if !fs.ValidPath(name) || !strings.HasSuffix(name, ".webp") || (segments[2] != "maps" && segments[2] != "pages") {
		writeError(w, 404, "not_found", "Материал кампании не найден.")
		return
	}
	body, err := readyCampaignFiles.ReadFile("ready_campaigns/icewind-dale-rus/" + name)
	if err != nil {
		writeError(w, 404, "not_found", "Материал кампании не найден.")
		return
	}
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, readyAssetModTime, bytes.NewReader(body))
}
