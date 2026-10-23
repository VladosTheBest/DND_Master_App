package httpapi

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

func TestCampaignExportOwnerScopeAndNoCredentials(t *testing.T) {
	root := t.TempDir()
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: filepath.Join(root, "uploads")})
	if err != nil {
		t.Fatal(err)
	}
	owner := registerAccountTestUser(t, handler, "export-owner")
	other := registerAccountTestUser(t, handler, "export-other")
	campaign := decodeAccountTestData[campaignData](t, personalAIRequest(t, handler, "POST", "/api/campaigns", `{"title":"Export synthetic"}`, owner))
	path := "/api/campaigns/" + campaign.ID + "/export"
	for _, cookies := range []int{0, 1} {
		var code int
		if cookies == 0 {
			code = personalAIRequest(t, handler, "GET", path, "", nil).Code
		} else {
			code = personalAIRequest(t, handler, "GET", path, "", other).Code
		}
		if code != []int{401, 404}[cookies] {
			t.Fatal("export scope", code)
		}
	}
	response := personalAIRequest(t, handler, "GET", path, "", owner)
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" || !strings.Contains(response.Header().Get("Content-Disposition"), "attachment") {
		t.Fatal("export contract", response.Code)
	}
	result := decodeAccountTestData[campaignExport](t, response)
	if result.Format != "shadow-edge-campaign" || result.Version != 1 || result.Campaign.Title != campaign.Title || result.Campaign.OwnerID != "" || result.Campaign.PlayerDisplayToken != "" {
		t.Fatal("wrong export")
	}
	for _, secret := range []string{"passwordHash", "editTokenHash", "ciphertext", "authSecret", "playerDisplayToken"} {
		if strings.Contains(response.Body.String(), `"`+secret+`"`) {
			t.Fatal("credential exported", secret)
		}
	}
}

func TestReadyPlaythroughManualSceneCapabilities(t *testing.T) {
	root := t.TempDir()
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: filepath.Join(root, "uploads")})
	if err != nil {
		t.Fatal(err)
	}
	owner := registerAccountTestUser(t, handler, "scene-owner")
	other := registerAccountTestUser(t, handler, "scene-other")
	campaign := decodeAccountTestData[campaignData](t, personalAIRequest(t, handler, "POST", "/api/campaigns", `{"templateId":"icewind-dale-rus"}`, owner))
	base := "/api/campaigns/" + campaign.ID
	caps := decodeAccountTestData[map[string]bool](t, personalAIRequest(t, handler, "GET", base+"/capabilities", "", owner))
	if !caps["manualScenes"] || caps["aiScenes"] || caps["atlasEdit"] || !caps["immutableSource"] {
		t.Fatal(caps)
	}
	if personalAIRequest(t, handler, "GET", base+"/capabilities", "", other).Code != 404 {
		t.Fatal("capability leak")
	}
	// This API validates ownership of the media URL; no image generator is involved.
	body := `{"title":"Own playthrough scene","levels":[{"id":"ground","name":"Ground","imageUrl":"/uploads/` + campaign.OwnerID + `/` + campaign.ID + `/map.png","width":100,"height":100,"walls":[]}]}`
	created := personalAIRequest(t, handler, "POST", base+"/session-maps", body, owner)
	if created.Code != 200 {
		t.Fatal(created.Code, created.Body.String())
	}
	scene := decodeAccountTestData[sessionMapDocument](t, created)
	scene.Title = "Edited playthrough"
	raw, _ := json.Marshal(scene)
	if response := personalAIRequest(t, handler, "PUT", base+"/session-maps/"+scene.ID, string(raw), owner); response.Code != 200 {
		t.Fatal(response.Code, response.Body.String())
	}
	after := decodeAccountTestData[campaignData](t, personalAIRequest(t, handler, "GET", base, "", owner))
	if readyCampaignDigest(campaign) != readyCampaignDigest(after) || len(after.SessionMaps) != 1 {
		t.Fatal("template altered or scene absent")
	}
	if personalAIRequest(t, handler, "DELETE", base+"/session-maps/"+scene.ID, "", other).Code != 404 {
		t.Fatal("other owner deleted scene")
	}
	if personalAIRequest(t, handler, "DELETE", base+"/session-maps/"+scene.ID, "", owner).Code != 200 {
		t.Fatal("manual deletion failed")
	}
}
