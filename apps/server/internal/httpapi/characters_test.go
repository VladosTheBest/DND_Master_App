package httpapi

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
)

func characterTestDraft(t *testing.T) characterDraft {
	t.Helper()
	for _, fixture := range characterRules.ValidationFixtures {
		if fixture.Valid && fixture.Draft.Edition == "2014" && fixture.Draft.ClassID == "fighter" && fixture.Draft.TargetLevel == 1 {
			return copyCharacterSheet(characterSheet{Draft: fixture.Draft}).Draft
		}
	}
	return characterDraft{Name: "Герой", PlayerName: "Игрок", Edition: "2014", ClassID: "fighter", SpeciesID: "human", BackgroundID: "acolyte", TargetLevel: 1, AbilityMethod: "standard", Abilities: map[string]int{"str": 15, "dex": 13, "con": 14, "int": 8, "wis": 12, "cha": 10}, AbilityBonuses: map[string]int{"str": 1, "dex": 1, "con": 1, "int": 1, "wis": 1, "cha": 1}, SkillIDs: []string{"athletics", "perception"}, Levels: []characterLevelChoice{{Level: 1, SpellIDs: []string{}, CantripIDs: []string{}, FeatureChoices: map[string][]string{"fighting-style": {"defense"}}}}}
}
func characterTestJSON(t *testing.T, value any) string {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}
func newCharacterTestStore(t *testing.T) (*campaignStore, campaignData) {
	t.Helper()
	s, c := newOrdinaryMutationTestStore(t)
	s.mu.Lock()
	for i := range s.data.Campaigns {
		if s.data.Campaigns[i].ID == c.ID {
			s.data.Campaigns[i].OwnerID = "owner"
			c = s.data.Campaigns[i]
		}
	}
	err := s.saveLocked()
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	return s, c
}
func TestCharacterInvitationLifecycleAndIsolation(t *testing.T) {
	handler := newAccountTestServer(t)
	owner := registerAccountTestUser(t, handler, "character-owner")
	outsider := registerAccountTestUser(t, handler, "character-outsider")
	campaignID := "campaign-shadow-edge"
	path := "/api/campaigns/" + campaignID + "/character-invite"
	for _, method := range []string{"GET", "POST", "DELETE"} {
		response := accountTestRequest(t, handler, method, path, `{"edition":"2014","level":1}`, outsider)
		if response.Code != 404 {
			t.Fatalf("outsider %s returned %d: %s", method, response.Code, response.Body.String())
		}
	}
	if response := accountTestRequest(t, handler, "GET", path, "", nil); response.Code != 401 {
		t.Fatalf("anonymous owner endpoint status=%d", response.Code)
	}
	noInvite := accountTestRequest(t, handler, "GET", path, "", owner)
	if noInvite.Code != 200 || !strings.Contains(noInvite.Body.String(), `"data":null`) {
		t.Fatalf("absent invite: %s", noInvite.Body.String())
	}
	create := accountTestRequest(t, handler, "POST", path, `{"edition":"2014","level":1}`, owner)
	if create.Code != 200 {
		t.Fatalf("create: %s", create.Body.String())
	}
	invite := decodeAccountTestData[characterInviteResponse](t, create)
	if len(invite.Token) != 64 || !strings.Contains(invite.URL, "/#characters/join/"+invite.Token) {
		t.Fatalf("bad invitation %#v", invite)
	}
	public := accountTestRequest(t, handler, "GET", "/api/character-invites/"+invite.Token, "", nil)
	if public.Code != 200 {
		t.Fatalf("public invitation: %s", public.Body.String())
	}
	metadata := decodeAccountTestData[map[string]any](t, public)
	if len(metadata) != 3 || metadata["campaignName"] == nil || metadata["edition"] != "2014" || metadata["level"] != float64(1) {
		t.Fatalf("public invitation leaks fields %#v", metadata)
	}
	if public.Header().Get("Cache-Control") == "" {
		t.Fatal("public invitation is cacheable")
	}
	stable := decodeAccountTestData[characterInviteResponse](t, accountTestRequest(t, handler, "POST", path, `{"edition":"any","level":5}`, owner))
	if stable.Token != invite.Token {
		t.Fatal("ordinary settings update rotated invitation")
	}
	rotated := decodeAccountTestData[characterInviteResponse](t, accountTestRequest(t, handler, "POST", path, `{"edition":"2014","level":1,"rotate":true}`, owner))
	if rotated.Token == invite.Token {
		t.Fatal("rotation reused invitation")
	}
	if response := accountTestRequest(t, handler, "GET", "/api/character-invites/"+invite.Token, "", nil); response.Code != 404 {
		t.Fatal("old invitation survives rotation")
	}
	if response := accountTestRequest(t, handler, "DELETE", path, "", owner); response.Code != 200 {
		t.Fatal("revoke failed")
	}
	if response := accountTestRequest(t, handler, "GET", "/api/character-invites/"+rotated.Token, "", nil); response.Code != 404 {
		t.Fatal("revoked invitation still resolves")
	}
}
func TestPublicCharacterSheetSubmissionPrivacyEditingAndDeletion(t *testing.T) {
	handler := newAccountTestServer(t)
	owner := registerAccountTestUser(t, handler, "sheet-owner")
	outsider := registerAccountTestUser(t, handler, "sheet-outsider")
	campaignID := "campaign-shadow-edge"
	ownerPath := "/api/campaigns/" + campaignID
	invite := decodeAccountTestData[characterInviteResponse](t, accountTestRequest(t, handler, "POST", ownerPath+"/character-invite", `{"edition":"2014","level":1}`, owner))
	draft := characterTestDraft(t)
	response := accountTestRequest(t, handler, "POST", "/api/character-invites/"+invite.Token, characterTestJSON(t, draft), nil)
	if response.Code != 201 {
		t.Fatalf("public create status=%d: %s", response.Code, response.Body.String())
	}
	created := decodeAccountTestData[createdCharacterSheet](t, response)
	if len(created.EditToken) != 64 || created.EditToken == invite.Token || created.PlayerID == "" {
		t.Fatalf("bad saved result %#v", created)
	}
	if created.Stats.MaxHP <= 0 {
		t.Fatal("server did not derive hit points")
	}
	publicPath := "/api/character-sheets/" + created.EditToken
	public := accountTestRequest(t, handler, "GET", publicPath, "", nil)
	if public.Code != 200 {
		t.Fatalf("own public sheet: %s", public.Body.String())
	}
	for _, secret := range []string{"editToken", "editTokenHash", "ownerId", "campaignId", "players", invite.Token, created.EditToken} {
		if strings.Contains(public.Body.String(), secret) {
			t.Fatalf("public sheet leaks %s", secret)
		}
	}
	if response := accountTestRequest(t, handler, "GET", "/api/character-sheets/"+invite.Token, "", nil); response.Code != 404 {
		t.Fatal("invite token can read individual sheet")
	}
	if response := accountTestRequest(t, handler, "GET", ownerPath+"/character-sheets", "", outsider); response.Code != 404 {
		t.Fatal("another owner can list sheets")
	}
	roster := accountTestRequest(t, handler, "GET", ownerPath+"/character-sheets", "", owner)
	if roster.Code != 200 || strings.Contains(roster.Body.String(), created.EditToken) {
		t.Fatalf("owner roster leaked edit token: %s", roster.Body.String())
	}
	campaign := decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "GET", ownerPath, "", owner))
	if len(campaign.Players) != 1 || campaign.Players[0].ID != created.PlayerID || campaign.Players[0].StatBlock == nil {
		t.Fatal("sheet did not create statted player")
	}
	draft.Name = "Обновлённый герой"
	update := accountTestRequest(t, handler, "PUT", publicPath, characterTestJSON(t, draft), nil)
	if update.Code != 200 {
		t.Fatalf("edit own sheet: %s", update.Body.String())
	}
	campaign = decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "GET", ownerPath, "", owner))
	if campaign.Players[0].Title != draft.Name {
		t.Fatal("edited name did not sync to campaign player")
	}
	accountTestRequest(t, handler, "DELETE", ownerPath+"/character-invite", "", owner)
	if response := accountTestRequest(t, handler, "GET", publicPath, "", nil); response.Code != 200 {
		t.Fatal("invite revocation destroyed an existing player's sheet")
	}
	if response := accountTestRequest(t, handler, "DELETE", ownerPath+"/character-sheets/"+created.ID, "", outsider); response.Code != 404 {
		t.Fatal("other account can delete sheet")
	}
	if response := accountTestRequest(t, handler, "DELETE", ownerPath+"/character-sheets/"+created.ID, "", owner); response.Code != 200 {
		t.Fatal("owner could not delete sheet")
	}
	if response := accountTestRequest(t, handler, "GET", publicPath, "", nil); response.Code != 404 {
		t.Fatal("deleted sheet remains accessible")
	}
}
func TestCharacterWritesRejectInvalidInputAndOversizedJSON(t *testing.T) {
	store, campaign := newCharacterTestStore(t)
	invite, err := store.setCharacterInvite("owner", campaign.ID, characterInviteInput{Edition: "2024", Level: 1})
	if err != nil {
		t.Fatal(err)
	}
	valid := characterTestDraft(t)
	if _, err := store.createCharacterSheet(invite.Token, valid); !errors.Is(err, errCharacterInvalid) {
		t.Fatalf("edition mismatch err=%v", err)
	}
	invite, err = store.setCharacterInvite("owner", campaign.ID, characterInviteInput{Edition: "any", Level: 2})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.createCharacterSheet(invite.Token, valid); !errors.Is(err, errCharacterInvalid) {
		t.Fatalf("level mismatch err=%v", err)
	}
	manager := newCharacterManager(store, "")
	for _, body := range []string{`{"notes":"` + strings.Repeat("x", 65*1024) + `"}`, `{} {}`, `{"maxHp":999}`, `null`} {
		request := httptest.NewRequest("POST", "/api/character-invites/"+invite.Token, strings.NewReader(body))
		recorder := httptest.NewRecorder()
		manager.handlePublicInvite(recorder, request)
		if recorder.Code != 400 {
			t.Fatalf("malformed character status=%d for size=%d", recorder.Code, len(body))
		}
	}
}
func TestCharacterPersistenceRestartAndTransactionalRollback(t *testing.T) {
	store, campaign := newCharacterTestStore(t)
	input := characterInviteInput{Edition: "2014", Level: 1}
	assertOrdinaryMutationRollsBack(t, store, func() error { _, err := store.setCharacterInvite("owner", campaign.ID, input); return err })
	invite, err := store.setCharacterInvite("owner", campaign.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	draft := characterTestDraft(t)
	assertOrdinaryMutationRollsBack(t, store, func() error { _, err := store.createCharacterSheet(invite.Token, draft); return err })
	created, err := store.createCharacterSheet(invite.Token, draft)
	if err != nil {
		t.Fatal(err)
	}
	assertOrdinaryMutationRollsBack(t, store, func() error { _, err := store.updateCharacterSheet(created.EditToken, draft); return err })
	assertOrdinaryMutationRollsBack(t, store, func() error { return store.revokeCharacterInvite("owner", campaign.ID) })
	assertOrdinaryMutationRollsBack(t, store, func() error { return store.deleteCharacterSheet("owner", campaign.ID, created.ID) })
	body, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), created.EditToken) {
		t.Fatal("raw edit token was persisted")
	}
	reloaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	sheet, err := reloaded.characterSheetByToken(created.EditToken)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(sheet.Draft, created.Draft) || sheet.Stats.MaxHP != created.Stats.MaxHP {
		t.Fatal("sheet changed across restart")
	}
	if _, err := reloaded.publicCharacterInvitation(invite.Token); err != nil {
		t.Fatal("invitation missing after restart")
	}
	if _, err := reloaded.deleteEntity(campaign.ID, created.PlayerID); err != nil {
		t.Fatal(err)
	}
	if _, err := reloaded.characterSheetByToken(created.EditToken); !errors.Is(err, errCharacterNotFound) {
		t.Fatal("deleting player did not revoke associated sheet")
	}
}
func TestCharacterSavedSheetDoesNotAliasStore(t *testing.T) {
	s, c := newCharacterTestStore(t)
	invite, err := s.setCharacterInvite("owner", c.ID, characterInviteInput{Edition: "2014", Level: 1})
	if err != nil {
		t.Fatal(err)
	}
	draft := characterTestDraft(t)
	created, err := s.createCharacterSheet(invite.Token, draft)
	if err != nil {
		t.Fatal(err)
	}
	originalSTR := created.Draft.Abilities["str"]
	created.Draft.Abilities["str"] = 99
	draft.Abilities["str"] = 98
	retrieved, err := s.characterSheetByToken(created.EditToken)
	if err != nil {
		t.Fatal(err)
	}
	if retrieved.Draft.Abilities["str"] != originalSTR {
		t.Fatal("returned/input map aliases persisted draft")
	}
}

func TestCharacterRulesRejectForgedBuilds(t *testing.T) {
	tests := []struct {
		name   string
		change func(*characterDraft)
	}{
		{"unsupported edition", func(d *characterDraft) { d.Edition = "2025" }},
		{"unknown class", func(d *characterDraft) { d.ClassID = "invented" }},
		{"unknown species", func(d *characterDraft) { d.SpeciesID = "invented" }},
		{"unknown background", func(d *characterDraft) { d.BackgroundID = "invented" }},
		{"base score outside standard array", func(d *characterDraft) { d.Abilities["str"] = 30 }},
		{"forged origin increase", func(d *characterDraft) { d.AbilityBonuses["str"] = 20 }},
		{"missing skill", func(d *characterDraft) { d.SkillIDs = nil }},
		{"duplicate skills", func(d *characterDraft) { d.SkillIDs = []string{"athletics", "athletics"} }},
		{"unknown skill", func(d *characterDraft) { d.SkillIDs[0] = "telepathy" }},
		{"missing level", func(d *characterDraft) { d.Levels = nil }},
		{"skipped level", func(d *characterDraft) { d.Levels[0].Level = 2 }},
		{"early ability increase", func(d *characterDraft) { d.Levels[0].ASI = map[string]int{"str": 2} }},
		{"early feat", func(d *characterDraft) { d.Levels[0].FeatID = "tough" }},
		{"early subclass", func(d *characterDraft) { d.Levels[0].SubclassID = "champion" }},
		{"unauthorized spell", func(d *characterDraft) { d.Levels[0].SpellIDs = []string{"wish-2014"} }},
		{"unauthorized cantrip", func(d *characterDraft) { d.Levels[0].CantripIDs = []string{"fire-bolt-2014"} }},
		{"overlong name", func(d *characterDraft) { d.Name = strings.Repeat("я", 121) }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			draft := characterTestDraft(t)
			test.change(&draft)
			if _, err := validateAndDeriveCharacter(draft); err == nil {
				t.Fatal("forged build was accepted")
			}
		})
	}
}

func TestCharacterRulesMatchBrowserFixtures(t *testing.T) {
	if len(characterRules.ValidationFixtures) < 72 {
		t.Fatal("missing shared character fixtures")
	}
	for _, fixture := range characterRules.ValidationFixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			stats, err := validateAndDeriveCharacter(fixture.Draft)
			if fixture.Valid && err != nil {
				t.Fatalf("browser-valid draft rejected: %v", err)
			}
			if !fixture.Valid && err == nil {
				t.Fatal("browser-invalid draft accepted")
			}
			if !fixture.Valid {
				return
			}
			if fixture.Stats.Level != 0 {
				if !reflect.DeepEqual(stats.Abilities, fixture.Stats.Abilities) || stats.MaxHP != fixture.Stats.MaxHP || stats.ArmorClass != fixture.Stats.ArmorClass || stats.Initiative != fixture.Stats.Initiative || stats.Speed != fixture.Stats.Speed || stats.ProficiencyBonus != fixture.Stats.ProficiencyBonus || stats.PassivePerception != fixture.Stats.PassivePerception {
					t.Fatalf("server core stats differ: got=%+v expected=%+v", stats, fixture.Stats)
				}
				if !reflect.DeepEqual(stats.SpellSlots, fixture.Stats.SpellSlots) || stats.PactSlots != fixture.Stats.PactSlots || stats.PactSlotLevel != fixture.Stats.PactSlotLevel || !reflect.DeepEqual(stats.SpellSaveDC, fixture.Stats.SpellSaveDC) || !reflect.DeepEqual(stats.SpellAttackBonus, fixture.Stats.SpellAttackBonus) {
					t.Fatal("server spellcasting stats differ from browser")
				}
				if !reflect.DeepEqual(stats.Skills, fixture.Stats.Skills) || !reflect.DeepEqual(stats.SavingThrows, fixture.Stats.SavingThrows) {
					t.Fatal("server skills or saving throws differ from browser")
				}
			}
		})
	}
}
