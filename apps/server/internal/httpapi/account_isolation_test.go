package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func newAccountTestServer(t *testing.T) http.Handler {
	t.Helper()

	handler, err := NewServer(Options{
		DataFile:  filepath.Join(t.TempDir(), "store.json"),
		UploadDir: filepath.Join(t.TempDir(), "uploads"),
	})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}

	return handler
}

func accountTestRequest(t *testing.T, handler http.Handler, method string, path string, body string, cookies []*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func registerAccountTestUser(t *testing.T, handler http.Handler, username string) []*http.Cookie {
	t.Helper()

	body := `{"username":` + strconvQuote(username) + `,"password":"secret123"}`
	recorder := accountTestRequest(t, handler, http.MethodPost, "/api/auth/register", body, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("register %q status = %d, body = %s", username, recorder.Code, recorder.Body.String())
	}

	return recorder.Result().Cookies()
}

func decodeAccountTestData[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()

	var envelope struct {
		Data T `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response body %q: %v", recorder.Body.String(), err)
	}

	return envelope.Data
}

func strconvQuote(value string) string {
	body, _ := json.Marshal(value)
	return string(body)
}

func TestFirstRegisteredAccountOwnsLegacyCampaigns(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "first-gm")

	recorder := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns", "", cookies)
	if recorder.Code != http.StatusOK {
		t.Fatalf("list campaigns status = %d, body = %s", recorder.Code, recorder.Body.String())
	}

	campaigns := decodeAccountTestData[[]campaignSummary](t, recorder)
	foundStarter := false
	for _, campaign := range campaigns {
		if campaign.ID == "campaign-shadow-edge" {
			foundStarter = true
			break
		}
	}
	if !foundStarter {
		t.Fatalf("expected first registered user to own starter legacy campaign, got %#v", campaigns)
	}
}

func TestCampaignsAreIsolatedBetweenAccounts(t *testing.T) {
	handler := newAccountTestServer(t)
	aliceCookies := registerAccountTestUser(t, handler, "alice-gm")
	bobCookies := registerAccountTestUser(t, handler, "bob-gm")

	aliceCreate := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Alice private","system":"D&D 5e","settingName":"A","inWorldDate":"1 Hammer","summary":"A"}`, aliceCookies)
	if aliceCreate.Code != http.StatusCreated {
		t.Fatalf("alice create status = %d, body = %s", aliceCreate.Code, aliceCreate.Body.String())
	}
	aliceCampaign := decodeAccountTestData[campaignData](t, aliceCreate)
	if aliceCampaign.OwnerID == "" {
		t.Fatal("expected created campaign to have ownerId")
	}

	bobCreate := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Bob private","system":"D&D 5e","settingName":"B","inWorldDate":"1 Hammer","summary":"B"}`, bobCookies)
	if bobCreate.Code != http.StatusCreated {
		t.Fatalf("bob create status = %d, body = %s", bobCreate.Code, bobCreate.Body.String())
	}
	bobCampaign := decodeAccountTestData[campaignData](t, bobCreate)

	bobList := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns", "", bobCookies)
	if bobList.Code != http.StatusOK {
		t.Fatalf("bob list status = %d, body = %s", bobList.Code, bobList.Body.String())
	}
	bobCampaigns := decodeAccountTestData[[]campaignSummary](t, bobList)
	for _, campaign := range bobCampaigns {
		if campaign.ID == aliceCampaign.ID {
			t.Fatalf("bob should not see alice campaign in list: %#v", bobCampaigns)
		}
	}

	bobReadAlice := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns/"+aliceCampaign.ID, "", bobCookies)
	if bobReadAlice.Code != http.StatusNotFound {
		t.Fatalf("expected bob reading alice campaign to get 404, got %d", bobReadAlice.Code)
	}

	aliceReadBob := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns/"+bobCampaign.ID, "", aliceCookies)
	if aliceReadBob.Code != http.StatusNotFound {
		t.Fatalf("expected alice reading bob campaign to get 404, got %d", aliceReadBob.Code)
	}

	bobUploadAlice := httptest.NewRecorder()
	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+aliceCampaign.ID+"/uploads", bytes.NewReader(nil))
	for _, cookie := range bobCookies {
		uploadRequest.AddCookie(cookie)
	}
	handler.ServeHTTP(bobUploadAlice, uploadRequest)
	if bobUploadAlice.Code != http.StatusNotFound {
		t.Fatalf("expected bob upload to alice campaign to get 404, got %d", bobUploadAlice.Code)
	}
}

func TestPublicPlayerLinksRemainUnauthenticated(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "public-gm")

	create := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Public campaign","system":"D&D 5e","settingName":"P","inWorldDate":"1 Hammer","summary":"P"}`, cookies)
	if create.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", create.Code, create.Body.String())
	}
	campaign := decodeAccountTestData[campaignData](t, create)

	share := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/initiative-share", "", cookies)
	if share.Code != http.StatusOK {
		t.Fatalf("share status = %d, body = %s", share.Code, share.Body.String())
	}
	shareResult := decodeAccountTestData[initiativeShareResponse](t, share)

	publicPage := accountTestRequest(t, handler, http.MethodGet, "/initiative/"+shareResult.Token, "", nil)
	if publicPage.Code != http.StatusOK {
		t.Fatalf("public initiative page status = %d", publicPage.Code)
	}

	legacyDisplay := accountTestRequest(t, handler, http.MethodGet, "/display/"+shareResult.Token, "", nil)
	if legacyDisplay.Code != http.StatusOK && legacyDisplay.Code != http.StatusMovedPermanently && legacyDisplay.Code != http.StatusFound {
		t.Fatalf("legacy display page status = %d", legacyDisplay.Code)
	}
}
