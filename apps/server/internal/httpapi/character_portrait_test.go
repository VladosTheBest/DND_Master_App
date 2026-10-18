package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCharacterPortraitValidationAndPersistence(t *testing.T) {
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, 40, 50)), nil); err != nil {
		t.Fatal(err)
	}
	portrait := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buffer.Bytes())
	for _, invalid := range []string{"https://example.com/image.jpg", "data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64,AAAA"} {
		if validateCharacterPortrait(invalid) == nil {
			t.Fatal("invalid portrait accepted")
		}
	}
	d := characterTestDraft(t)
	d.Portrait = portrait
	d.Equipment = []characterEquipmentItem{{Name: "Longsword", Type: "weapon", Quantity: 1}}
	store, campaign := newCharacterTestStore(t)
	invite, err := store.setCharacterInvite("owner", campaign.ID, characterInviteInput{Edition: "any", Level: 1})
	if err != nil {
		t.Fatal(err)
	}
	sheet, err := store.createCharacterSheet(invite.Token, d)
	if err != nil {
		t.Fatal(err)
	}
	got, err := store.characterSheetByToken(sheet.EditToken)
	if err != nil {
		t.Fatal(err)
	}
	if got.Draft.Portrait != portrait || len(got.Draft.Equipment) != 1 || got.Draft.Equipment[0].Name != "Longsword" {
		t.Fatal("portrait or inventory lost")
	}
	d.Equipment[0].Quantity = -1
	if _, err := validateAndDeriveCharacter(d); err == nil {
		t.Fatal("negative inventory accepted")
	}
}
func TestCharacterPortraitRequiresAccountAndSubscription(t *testing.T) {
	handler := newAccountTestServer(t)
	if result := accountTestRequest(t, handler, http.MethodPost, "/api/characters/portrait", `{"description":"hero"}`, nil); result.Code != 401 {
		t.Fatalf("anonymous: %d", result.Code)
	}
	cookies := registerAccountTestUser(t, handler, "portrait-account")
	if result := accountTestRequest(t, handler, http.MethodPost, "/api/characters/portrait", `{"description":"hero"}`, cookies); result.Code != 402 {
		t.Fatalf("inactive subscription: %d %s", result.Code, result.Body.String())
	}
}

func TestCharacterPortraitUsesConfiguredProviderAndRejectsForeignOrigin(t *testing.T) {
	auth, store := newTestAuthManager(t, AuthOptions{Username: "portrait-gm", Password: "secret"})
	login := httptest.NewRecorder()
	auth.handleLogin(login, httptest.NewRequest("POST", "http://localhost/api/auth/login", strings.NewReader(`{"username":"portrait-gm","password":"secret"}`)))
	if login.Code != 200 {
		t.Fatal(login.Body.String())
	}
	store.data.Users[0].Subscription = &accountSubscription{PlanID: "gm", Status: "active", CurrentPeriodStart: time.Now().Add(-time.Hour), CurrentPeriodEnd: time.Now().Add(time.Hour)}
	calls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var input map[string]any
		json.NewDecoder(r.Body).Decode(&input)
		if r.URL.Path != "/images/generations" || input["model"] != "test-portrait-model" || !strings.Contains(input["prompt"].(string), "portrait context") {
			t.Error("incorrect portrait payload")
		}
		json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"b64_json": base64.StdEncoding.EncodeToString(mapFixturePNG())}}})
	}))
	defer upstream.Close()
	srv := &server{auth: auth, store: store, characters: newCharacterManager(store, ""), generator: newEntityGenerator(AIOptions{Provider: "openai", BaseURL: upstream.URL, APIToken: "test", Model: "test", ImageModel: "test-portrait-model"})}
	invoke := func(origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "http://localhost/api/characters/portrait", strings.NewReader(`{"description":"portrait context"}`))
		r.Header.Set("Origin", origin)
		for _, c := range login.Result().Cookies() {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		srv.handleCharacterPortrait(w, r)
		return w
	}
	if w := invoke("https://foreign.example"); w.Code != 403 || calls != 0 {
		t.Fatalf("foreign origin %d", w.Code)
	}
	if w := invoke("http://localhost"); w.Code != 200 || calls != 1 || !strings.Contains(w.Body.String(), "data:image/png;base64,") {
		t.Fatalf("generation %d %s", w.Code, w.Body.String())
	}
	srv.characters.portraitFlights[store.data.Users[0].ID] = true
	if w := invoke("http://localhost"); w.Code != 409 || calls != 1 {
		t.Fatalf("parallel generation %d", w.Code)
	}
}
