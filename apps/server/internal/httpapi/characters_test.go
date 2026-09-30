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

func TestCharacterPersonalityLimits(t *testing.T) {
	draft := characterTestDraft(t)
	draft.Personality = &characterPersonality{Backstory: strings.Repeat("Я", 3000), Flaws: strings.Repeat("😀", 1000)}
	if _, err := validateAndDeriveCharacter(draft); err != nil {
		t.Fatalf("valid Unicode personality: %v", err)
	}
	draft.Personality.Backstory += "Я"
	if _, err := validateAndDeriveCharacter(draft); err == nil {
		t.Fatal("oversized backstory accepted")
	}
	draft.Personality.Backstory = ""
	draft.Personality.Flaws += "😀"
	if _, err := validateAndDeriveCharacter(draft); err == nil {
		t.Fatal("oversized flaws accepted")
	}
}

func TestCharacterLandTerrain(t *testing.T) {
	fixture := func(edition string) characterDraft {
		for _, entry := range characterRules.ValidationFixtures {
			if entry.Valid && entry.Draft.Edition == edition && entry.Draft.ClassID == "druid" && entry.Draft.TargetLevel == 20 && characterSelectedSubclass(entry.Draft, 20) == "land" {
				d := copyCharacterSheet(characterSheet{Draft: entry.Draft}).Draft
				d.TargetLevel = 10
				d.Levels = d.Levels[:10]
				return d
			}
		}
		t.Fatal("missing Land druid fixture")
		return characterDraft{}
	}
	d := fixture("2024")
	d.LandTerrain = "polar"
	if _, err := validateAndDeriveCharacter(d); err != nil {
		t.Fatalf("current terrain: %v", err)
	}
	current, previous := characterLandGrantedSpells(d, 10), characterLandGrantedSpells(d, 9)
	if !characterHas(current, "cone-of-cold-2024") || characterHas(current, "wall-of-stone-2024") || !characterHas(previous, "wall-of-stone-2024") {
		t.Fatal("current terrain must update present grants and preserve earlier level grants")
	}
	body, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var roundtrip characterDraft
	if err := json.Unmarshal(body, &roundtrip); err != nil {
		t.Fatal(err)
	}
	if roundtrip.LandTerrain != "polar" || !reflect.DeepEqual(characterLandGrantedSpells(roundtrip, 10), current) {
		t.Fatal("rest choice lost in persistence")
	}
	d.LandTerrain = "underdark"
	if _, err := validateAndDeriveCharacter(d); err == nil {
		t.Fatal("legacy terrain accepted in 2024 rest field")
	}
	old := fixture("2014")
	old.Levels[2].FeatureChoices["land-terrain"] = []string{"underdark"}
	if !characterHas(characterFeatureRequirements(old, 3)["land-terrain"].options, "underdark") {
		t.Fatal("missing Underdark choice")
	}
	for _, id := range strings.Fields("spider-climb web gaseous-form stinking-cloud greater-invisibility stone-shape insect-plague cloudkill") {
		if !characterHas(characterLandGrantedSpells(old, 10), id+"-2014") {
			t.Fatalf("missing Underdark spell %s", id)
		}
	}
	old.LandTerrain = "polar"
	if _, err := validateAndDeriveCharacter(old); err == nil {
		t.Fatal("2024 rest choice accepted in 2014")
	}
	wrongClass := characterTestDraft(t)
	wrongClass.LandTerrain = "polar"
	if _, err := validateAndDeriveCharacter(wrongClass); err == nil {
		t.Fatal("Land rest choice accepted for fighter")
	}
}

func TestCharacterKnownBeastForms(t *testing.T) {
	fixture := func(subclass string, level int) characterDraft {
		for _, entry := range characterRules.ValidationFixtures {
			if entry.Valid && entry.Draft.Edition == "2024" && entry.Draft.ClassID == "druid" && entry.Draft.TargetLevel == 20 && characterSelectedSubclass(entry.Draft, 20) == subclass {
				d := copyCharacterSheet(characterSheet{Draft: entry.Draft}).Draft
				d.TargetLevel, d.Levels = level, d.Levels[:level]
				return d
			}
		}
		t.Fatal("missing druid fixture")
		return characterDraft{}
	}
	for _, level := range []int{2, 4, 8, 20} {
		d := fixture("land", level)
		if _, err := validateAndDeriveCharacter(d); err != nil {
			t.Fatalf("valid forms at %d: %v", level, err)
		}
		group := characterFeatureRequirements(d, level)["wild-shape-forms"]
		if !characterHas(group.options, "octopus-2024") || characterHas(group.options, "bat-2024") != (level >= 8) {
			t.Fatalf("movement limit at %d", level)
		}
		for _, id := range []string{"giant-eagle-2024", "swarm-of-rats-2024", "mammoth-2024", "wolf-2014"} {
			d.Levels[level-1].FeatureChoices["wild-shape-forms"][0] = id
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatalf("illegal form accepted: %s at %d", id, level)
			}
		}
		delete(d.Levels[level-1].FeatureChoices, "wild-shape-forms")
		if _, err := validateAndDeriveCharacter(d); err == nil {
			t.Fatal("missing mandatory forms accepted")
		}
	}
	for _, level := range []int{17, 18} {
		d := fixture("moon", level)
		options := characterFeatureRequirements(d, level)["wild-shape-forms"].options
		if characterHas(options, "mammoth-2024") != (level == 18) {
			t.Fatalf("Moon CR limit at %d", level)
		}
	}
}
func TestCharacterSeenBeastForms2014(t *testing.T) {
	for _, level := range []int{2, 4, 8} {
		var d characterDraft
		for _, entry := range characterRules.ValidationFixtures {
			if entry.Valid && entry.Draft.Edition == "2014" && entry.Draft.ClassID == "druid" && entry.Draft.TargetLevel == 20 && characterSelectedSubclass(entry.Draft, 20) == "land" {
				d = copyCharacterSheet(characterSheet{Draft: entry.Draft}).Draft
				break
			}
		}
		if len(d.Levels) != 20 {
			t.Fatal("missing 2014 druid fixture")
		}
		d.TargetLevel, d.Levels = level, d.Levels[:level]
		group := characterFeatureRequirements(d, level)["wild-shape-seen"]
		if !group.optional || characterHas(group.options, "octopus-2014") != (level >= 4) || characterHas(group.options, "bat-2014") != (level >= 8) {
			t.Fatalf("incorrect old form limits at %d", level)
		}
		for _, ids := range [][]string{nil, {"wolf-2014"}} {
			d.Levels[level-1].FeatureChoices["wild-shape-seen"] = ids
			if _, err := validateAndDeriveCharacter(d); err != nil {
				t.Fatalf("legal optional forms at %d: %v", level, err)
			}
		}
		for _, ids := range [][]string{{"wolf-2024"}, {"mammoth-2014"}, {"wolf-2014", "wolf-2014"}} {
			d.Levels[level-1].FeatureChoices["wild-shape-seen"] = ids
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatalf("illegal seen forms accepted: %v", ids)
			}
		}
	}
}
func TestCharacterPHBBeastCompanion(t *testing.T) {
	var d characterDraft
	for _, entry := range characterRules.ValidationFixtures {
		if entry.Valid && entry.Draft.Edition == "2014" && entry.Draft.ClassID == "ranger" && entry.Draft.TargetLevel == 20 && characterSelectedSubclass(entry.Draft, 20) == "beast-master" {
			d = copyCharacterSheet(characterSheet{Draft: entry.Draft}).Draft
			break
		}
	}
	if len(d.Levels) != 20 {
		t.Fatal("missing beast master fixture")
	}
	d.Levels[2].FeatureChoices["companion-rules"] = []string{"phb"}
	for i := 2; i < len(d.Levels); i++ {
		delete(d.Levels[i].FeatureChoices, "primal-companion")
		d.Levels[i].FeatureChoices["ranger-companion"] = []string{"wolf-2014"}
	}
	if _, err := validateAndDeriveCharacter(d); err != nil {
		t.Fatalf("PHB companion: %v", err)
	}
	for _, id := range []string{"hawk-2014", "octopus-2014", "panther-2014"} {
		d.Levels[19].FeatureChoices["ranger-companion"] = []string{id}
		if _, err := validateAndDeriveCharacter(d); err != nil {
			t.Fatalf("legal PHB %s: %v", id, err)
		}
	}
	for _, id := range []string{"giant-owl-2014", "brown-bear-2014", "wolf-2024"} {
		d.Levels[19].FeatureChoices["ranger-companion"] = []string{id}
		if _, err := validateAndDeriveCharacter(d); err == nil {
			t.Fatalf("illegal PHB %s accepted", id)
		}
	}
	d.Levels[19].FeatureChoices["ranger-companion"] = []string{"wolf-2014"}
	d.Levels[19].FeatureChoices["primal-companion"] = []string{"land"}
	if _, err := validateAndDeriveCharacter(d); err == nil {
		t.Fatal("both companion types accepted")
	}
}
func TestCharacterTomeAndTalisman(t *testing.T) {
	for _, edition := range []string{"2014", "2024"} {
		var d characterDraft
		for _, entry := range characterRules.ValidationFixtures {
			if entry.Valid && entry.Draft.Edition == edition && entry.Draft.ClassID == "warlock" && entry.Draft.TargetLevel == 20 {
				d = copyCharacterSheet(characterSheet{Draft: entry.Draft}).Draft
				break
			}
		}
		if len(d.Levels) != 20 {
			t.Fatal("missing warlock fixture")
		}
		if edition == "2014" {
			d.TargetLevel, d.Levels = 3, d.Levels[:3]
			d.Levels[2].FeatureChoices["pact-boon"] = []string{"tome"}
			d.Levels[2].FeatureChoices["tome-cantrips"] = []string{"guidance-2014", "druidcraft-2014", "mending-2014"}
		}
		if _, err := validateAndDeriveCharacter(d); err != nil {
			t.Fatalf("valid Tome %s: %v", edition, err)
		}
		last := len(d.Levels) - 1
		saved := d.Levels[last].FeatureChoices["tome-cantrips"]
		delete(d.Levels[last].FeatureChoices, "tome-cantrips")
		if _, err := validateAndDeriveCharacter(d); err == nil {
			t.Fatal("missing book cantrips accepted")
		}
		d.Levels[last].FeatureChoices["tome-cantrips"] = saved
		if edition == "2014" {
			d.Levels[2].FeatureChoices["pact-boon"] = []string{"talisman"}
			delete(d.Levels[2].FeatureChoices, "tome-cantrips")
			if _, err := validateAndDeriveCharacter(d); err != nil {
				t.Fatalf("talisman: %v", err)
			}
		} else {
			d.Levels[last].FeatureChoices["tome-cantrips"][0] = d.Levels[last].CantripIDs[0]
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatal("already prepared book cantrip accepted")
			}
		}
	}
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
	draft.Personality = &characterPersonality{Backstory: "История\nНовая строка", Appearance: "Седые волосы", Traits: "Терпеливый", Ideals: "Милосердие", Bonds: "Родной город", Flaws: "Боязнь высоты"}
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
	readSheet := decodeAccountTestData[characterSheet](t, public)
	if !reflect.DeepEqual(readSheet.Draft.Personality, draft.Personality) {
		t.Fatal("personality changed during create/read")
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
	draft.Personality.Ideals = "Свобода"
	update := accountTestRequest(t, handler, "PUT", publicPath, characterTestJSON(t, draft), nil)
	if update.Code != 200 {
		t.Fatalf("edit own sheet: %s", update.Body.String())
	}
	readSheet = decodeAccountTestData[characterSheet](t, accountTestRequest(t, handler, "GET", publicPath, "", nil))
	if !reflect.DeepEqual(readSheet.Draft.Personality, draft.Personality) {
		t.Fatal("personality changed during update/read")
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

func TestCharacterArcanaReplacementLimits(t *testing.T) {
	var draft characterDraft
	for _, fixture := range characterRules.ValidationFixtures {
		if fixture.Draft.Edition == "2024" && fixture.Draft.ClassID == "cleric" && fixture.Draft.TargetLevel == 18 && characterSelectedSubclass(fixture.Draft, 18) == "arcana" {
			encoded, err := json.Marshal(fixture.Draft)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(encoded, &draft); err != nil {
				t.Fatal(err)
			}
			break
		}
	}
	if draft.TargetLevel != 18 {
		t.Fatal("missing Arcana level-18 fixture")
	}
	requirements := characterFeatureRequirements(draft, 18)
	for i, key := range []string{"domain-mastery-6", "domain-mastery-7"} {
		old := draft.Levels[16].FeatureChoices[key]
		for _, option := range requirements[key].options {
			if !characterHas(old, option) {
				draft.Levels[17].FeatureChoices[key] = []string{option}
				break
			}
		}
		err := validateCharacterFeatureChoices(draft, 18)
		if i == 0 && err != nil {
			t.Fatalf("single replacement rejected: %v", err)
		}
		if i == 1 && err == nil {
			t.Fatal("two mastery replacements accepted at the same level")
		}
	}
}

func TestCharacterOriginReplacementLimits(t *testing.T) {
	var draft characterDraft
	for _, fixture := range characterRules.ValidationFixtures {
		if fixture.Draft.Edition == "2014" && fixture.Draft.ClassID == "sorcerer" && fixture.Draft.TargetLevel == 3 && characterSelectedSubclass(fixture.Draft, 3) == "aberrant-mind" {
			encoded, err := json.Marshal(fixture.Draft)
			if err != nil {
				t.Fatal(err)
			}
			if err = json.Unmarshal(encoded, &draft); err != nil {
				t.Fatal(err)
			}
			break
		}
	}
	if draft.TargetLevel != 3 {
		t.Fatal("missing Aberrant Mind fixture")
	}
	for index, key := range []string{"origin-spell-0", "origin-spell-2"} {
		occupied := append(append([]string{}, draft.Levels[2].SpellIDs...), draft.Levels[2].CantripIDs...)
		occupied = append(occupied, characterCurrentOriginSpells(draft, 3)...)
		found := false
		for _, id := range characterFeatureRequirements(draft, 3)[key].options {
			if !characterHas(occupied, id) {
				draft.Levels[2].FeatureChoices[key] = []string{id}
				found = true
				break
			}
		}
		if !found {
			t.Fatal("missing replacement candidate")
		}
		_, err := validateAndDeriveCharacter(draft)
		if index == 0 && err != nil {
			t.Fatalf("single replacement rejected: %v", err)
		}
		if index == 1 && err == nil {
			t.Fatal("two origin replacements accepted")
		}
	}
}

func TestCharacterSubclassPoolRequirements(t *testing.T) {
	for _, test := range []struct {
		class, sub, key string
		level           int
		ids             []string
	}{
		{"monk", "four-elements", "disciplines", 3, []string{"water-whip", "fire-snake"}},
		{"monk", "kensei", "kensei-weapons", 3, []string{"club", "dagger"}},
		{"fighter", "rune-knight", "runes", 3, []string{"hill", "storm"}},
	} {
		t.Run(test.sub, func(t *testing.T) {
			var d characterDraft
			for _, fixture := range characterRules.ValidationFixtures {
				if fixture.Draft.Edition == "2014" && fixture.Draft.ClassID == test.class && fixture.Draft.TargetLevel == test.level && characterSelectedSubclass(fixture.Draft, test.level) == test.sub {
					data, _ := json.Marshal(fixture.Draft)
					json.Unmarshal(data, &d)
					break
				}
			}
			if d.TargetLevel == 0 {
				t.Fatal("missing fixture")
			}
			d.Levels[test.level-1].FeatureChoices[test.key] = test.ids
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatal("invalid initial selection accepted")
			}
		})
	}
}

func TestWarlockConditionalSpellChoices(t *testing.T) {
	for _, tc := range []struct {
		edition, sub, key, option, spell string
		level                            int
	}{
		{"2014", "genie", "genie-kind", "dao", "scorching-ray-2014", 3},
		{"2024", "vestige", "vestige-domain", "war", "guiding-bolt-2024", 3},
	} {
		t.Run(tc.sub, func(t *testing.T) {
			var d characterDraft
			for _, fixture := range characterRules.ValidationFixtures {
				if fixture.Draft.Edition == tc.edition && fixture.Draft.ClassID == "warlock" && fixture.Draft.TargetLevel == tc.level && characterSelectedSubclass(fixture.Draft, tc.level) == tc.sub {
					raw, _ := json.Marshal(fixture.Draft)
					if err := json.Unmarshal(raw, &d); err != nil {
						t.Fatal(err)
					}
					break
				}
			}
			if d.TargetLevel == 0 {
				t.Fatal("missing fixture")
			}
			at := 0
			if tc.edition == "2024" {
				at = 2
			}
			d.Levels[at].FeatureChoices[tc.key] = []string{tc.option}
			if _, err := validateAndDeriveCharacter(d); err != nil {
				t.Fatalf("valid patron rejected: %v", err)
			}
			d.Levels[tc.level-1].SpellIDs[0] = tc.spell
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatal("foreign expanded spell or free domain spell accepted as an ordinary choice")
			}
		})
	}
}

func TestCharacterArtificerChoices(t *testing.T) {
	fixture := func(edition, sub string, through int) characterDraft {
		t.Helper()
		for _, item := range characterRules.ValidationFixtures {
			if item.Draft.Edition == edition && item.Draft.ClassID == "artificer" && item.Draft.TargetLevel == 20 && characterSelectedSubclass(item.Draft, 20) == sub {
				raw, _ := json.Marshal(item.Draft)
				var d characterDraft
				if err := json.Unmarshal(raw, &d); err != nil {
					t.Fatal(err)
				}
				d.TargetLevel = through
				d.Levels = d.Levels[:through]
				return d
			}
		}
		t.Fatal("missing Artificer fixture")
		return characterDraft{}
	}
	for _, edition := range []string{"2014", "2024"} {
		t.Run(edition, func(t *testing.T) {
			d := fixture(edition, "alchemist", 2)
			if _, err := validateAndDeriveCharacter(d); err != nil {
				t.Fatalf("valid base: %v", err)
			}
			key := "artificer-infusions"
			if edition == "2024" {
				key = "artificer-plans"
			}
			d.Levels[1].FeatureChoices[key] = d.Levels[1].FeatureChoices[key][:3]
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatal("missing formula accepted")
			}
			d = fixture(edition, "alchemist", 11)
			d.Levels[10].FeatureChoices["artificer-stored-magic"] = []string{"revivify-" + edition}
			if _, err := validateAndDeriveCharacter(d); err == nil {
				t.Fatal("invalid stored spell accepted")
			}
			d.Levels[10].FeatureChoices["artificer-stored-magic"] = []string{"cure-wounds-" + edition}
			if _, err := validateAndDeriveCharacter(d); err != nil {
				t.Fatalf("valid stored spell: %v", err)
			}
			d = fixture(edition, "alchemist", 3)
			if characterHas(d.Levels[0].FeatureChoices["artificer-tool"], "alchemist") {
				delete(d.Levels[2].FeatureChoices, "artificer-tool-replacement")
				if _, err := validateAndDeriveCharacter(d); err == nil {
					t.Fatal("missing replacement proficiency accepted")
				}
			} else {
				t.Fatal("fixture no longer exercises repeated proficiency")
			}
		})
	}
	for _, level := range []int{9, 10, 13, 14} {
		itemID, threshold := "winged-boots-2024", 10
		if level >= 13 {
			itemID, threshold = "amulet-of-health-2024", 14
		}
		d := fixture("2024", "alchemist", level)
		available := characterFeatureRequirements(d, level)["artificer-plans"].options
		if characterHas(available, itemID) != (level == threshold) {
			t.Fatalf("generic plan %s has wrong unlock level: %d", itemID, level)
		}
		d.Levels[level-1].FeatureChoices["artificer-plans"][0] = itemID
		_, err := validateAndDeriveCharacter(d)
		if (err == nil) != (level == threshold) {
			t.Fatalf("generic plan %s validation at %d: %v", itemID, level, err)
		}
	}
	cannons := fixture("2014", "artillerist", 15)
	if _, ok := characterFeatureRequirements(cannons, 14)["second-cannon-mode"]; ok {
		t.Fatal("second cannon available before fifteen")
	}
	cannons.Levels[14].FeatureChoices["cannon-mode"] = []string{"protector"}
	for _, mode := range []string{"protector", "none"} {
		cannons.Levels[14].FeatureChoices["second-cannon-mode"] = []string{mode}
		if _, err := validateAndDeriveCharacter(cannons); err != nil {
			t.Fatalf("valid second cannon %s: %v", mode, err)
		}
	}
	cannons.Levels[14].FeatureChoices["second-cannon-mode"] = []string{"unknown"}
	if _, err := validateAndDeriveCharacter(cannons); err == nil {
		t.Fatal("unknown second cannon accepted")
	}
	armor := fixture("2024", "armorer", 10)
	requirements := characterFeatureRequirements(armor, 10)
	selected := armor.Levels[9].FeatureChoices
	occupied := append(append([]string{}, selected["artificer-plans"]...), selected["artificer-armor-plan"]...)
	extra := characterExcept(requirements["artificer-armor-plan"].options, occupied)
	if len(extra) == 0 {
		t.Fatal("missing armor replacement")
	}
	normal := characterExcept(requirements["artificer-plans"].options, append(occupied, extra[0]))
	if len(normal) == 0 {
		t.Fatal("missing normal plan replacement")
	}
	selected["artificer-armor-plan"] = extra[:1]
	selected["artificer-plans"][0] = normal[0]
	if _, err := validateAndDeriveCharacter(armor); err == nil {
		t.Fatal("two replacements across armor and ordinary pools accepted")
	}
	armor = fixture("2024", "armorer", 9)
	delete(armor.Levels[8].FeatureChoices, "artificer-armor-plan")
	if _, err := validateAndDeriveCharacter(armor); err == nil {
		t.Fatal("missing extra armor plan accepted")
	}
	d := fixture("2024", "reanimator", 10)
	before := d.Levels[8].FeatureChoices["companion-modifications"]
	alternatives := characterExcept(characterFeatureRequirements(d, 10)["companion-modifications"].options, before)
	if len(alternatives) < 2 {
		t.Fatal("missing replacement modifications")
	}
	d.Levels[9].FeatureChoices["companion-modifications"] = alternatives[:2]
	if _, err := validateAndDeriveCharacter(d); err != nil {
		t.Fatalf("recreated companion: %v", err)
	}
}
