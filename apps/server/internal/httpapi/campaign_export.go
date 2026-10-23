package httpapi

import (
	"encoding/json"
	"net/http"
	"time"
)

// Export is a portable document snapshot, not a server backup or an import token.
type campaignExport struct {
	Format     string            `json:"format"`
	Version    int               `json:"version"`
	ExportedAt string            `json:"exportedAt"`
	Media      string            `json:"media"`
	Campaign   campaignData      `json:"campaign"`
	Sessions   []importedSession `json:"sessions"`
	Characters []characterSheet  `json:"characters"`
}

func (srv *server) exportCampaign(w http.ResponseWriter, r *http.Request, user authUser, id string) {
	// Take one coherent snapshot of the campaign, transcripts and sheets.
	srv.store.mu.RLock()
	var result campaignExport
	found := false
	for _, campaign := range srv.store.data.Campaigns {
		if campaign.ID == id && campaign.OwnerID == user.ID {
			result.Campaign = campaign
			found = true
			break
		}
	}
	if !found {
		srv.store.mu.RUnlock()
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	result.Format = "shadow-edge-campaign"
	result.Version = 1
	result.ExportedAt = time.Now().UTC().Format(time.RFC3339)
	result.Media = "references-only: images and audio are not embedded; automatic import is not available"
	result.Campaign.OwnerID = ""
	result.Campaign.PlayerDisplayToken = ""
	result.Campaign.CustomItemImports = nil
	result.Sessions = []importedSession{}
	result.Characters = []characterSheet{}
	for _, session := range srv.store.data.ImportedSessions {
		if session.CampaignID == id {
			result.Sessions = append(result.Sessions, session)
		}
	}
	for _, sheet := range srv.store.data.CharacterSheets {
		if sheet.CampaignID == id {
			result.Characters = append(result.Characters, sheet.Sheet)
		}
	}
	// Encode while holding the read lock; nested slices must not race with mutation.
	raw, err := json.Marshal(result)
	srv.store.mu.RUnlock()
	if err != nil {
		writeError(w, 500, "export_failed", "Не удалось подготовить экспорт.")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Disposition", `attachment; filename="shadow-edge-campaign.json"`)
	writeJSON(w, 200, json.RawMessage(raw))
}
