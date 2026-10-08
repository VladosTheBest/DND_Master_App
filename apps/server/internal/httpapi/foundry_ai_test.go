package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

type foundryAITestGenerator struct {
	entityGenerator
	calls   int
	payload string
	profile foundryAIProfile
}

func (g *foundryAITestGenerator) requestConstrainedPatch(_ string, _ string, payload string, _ map[string]any) (json.RawMessage, error) {
	g.calls++
	g.payload = payload
	raw, err := json.Marshal(g.profile)
	return raw, err
}
func aiFixture(t *testing.T) (*foundryManager, foundryConnection, *foundryAITestGenerator) {
	m, c := foundryFixture(t)
	e := knowledgeEntity{ID: "ai-test", Kind: "monster", Title: "Fixture archer", Content: "A guard", StatBlock: &npcStatBlock{Actions: []statBlockEntry{{Name: "Bow", ToHit: "+5", Damage: "1d8+3 piercing"}}}}
	for i := range m.srv.store.data.Campaigns {
		if m.srv.store.data.Campaigns[i].ID == c.CampaignID {
			m.srv.store.data.Campaigns[i].Monsters = []knowledgeEntity{e}
		}
	}
	m.srv.store.data.Users[0].Subscription = &accountSubscription{PlanID: "gm", Status: "active", CurrentPeriodStart: time.Now().Add(-time.Hour), CurrentPeriodEnd: time.Now().Add(time.Hour)}
	g := &foundryAITestGenerator{profile: foundryAIProfile{Abilities: []foundryAIAbility{{Section: "actions", Index: 0, Name: "Bow", ToHit: "+5", Damage: "1d8+3 piercing", Animation: "bow", Mechanics: foundryMechanics{Kind: "attack", AttackMode: "ranged"}}}}}
	m.srv.generator = g
	return m, c, g
}
func foundryAIProposal(t *testing.T, m *foundryManager, mode string) map[string]any {
	t.Helper()
	w := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:ai-test", "mode": mode, "edition": "2014"})
	if w.Code != 200 {
		t.Fatalf("preview %d %s", w.Code, w.Body)
	}
	var b struct {
		Data map[string]any `json:"data"`
	}
	if json.Unmarshal(w.Body.Bytes(), &b) != nil {
		t.Fatal("decode")
	}
	return b.Data
}
func TestFoundryAIReviewApplyCacheUndoAndSourceSafety(t *testing.T) {
	m, c, g := aiFixture(t)
	p := foundryAIProposal(t, m, "configure")
	if g.calls != 1 || strings.Contains(g.payload, "foundry-gm") || strings.Contains(g.payload, "TokenHash") {
		t.Fatal("generation scope")
	}
	for i := range m.srv.store.data.Campaigns {
		if m.srv.store.data.Campaigns[i].ID == c.CampaignID && m.srv.store.data.Campaigns[i].Monsters[0].FoundryAI != nil {
			t.Fatal("preview mutated source")
		}
	}
	w := foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": p["proposalId"]})
	if w.Code != 200 {
		t.Fatalf("apply %d %s", w.Code, w.Body)
	}
	var rows []foundryRecord
	rows, _ = foundryRecords(m.srv.store.data, c.CampaignID)
	var e knowledgeEntity
	json.Unmarshal(rows[0].Data, &e)
	if e.FoundryAI == nil || e.FoundryAI.Stale || e.StatBlock.Actions[0].Damage != "1d8+3 piercing" {
		t.Fatal("profile/source persistence")
	}
	again := foundryAIProposal(t, m, "configure")
	if again["cached"] != true || g.calls != 1 {
		t.Fatal("cache made paid call")
	}
	w = foundryCall(t, m, "POST", "v1/actors/ai/undo", map[string]any{"recordKey": "monster:ai-test", "profileId": e.FoundryAI.ID})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	rows, _ = foundryRecords(m.srv.store.data, c.CampaignID)
	json.Unmarshal(rows[0].Data, &e) // unmarshal a new value to avoid retaining omitted pointers
	var clean knowledgeEntity
	json.Unmarshal(rows[0].Data, &clean)
	if clean.FoundryAI != nil {
		t.Fatal("undo kept profile")
	}
}
func TestFoundryAIRejectsChangedSourceForeignProposalAndUnpaid(t *testing.T) {
	m, c, _ := aiFixture(t)
	p := foundryAIProposal(t, m, "enrich")
	pending := m.aiPending[p["proposalId"].(string)]
	pending.ConnectionID = "foreign"
	m.aiPending[p["proposalId"].(string)] = pending
	body := map[string]any{"recordKey": "monster:ai-test", "proposalId": p["proposalId"]}
	if w := foundryCall(t, m, "POST", "v1/actors/ai/apply", body); w.Code != 409 {
		t.Fatal("foreign proposal accepted")
	}
	pending.ConnectionID = c.ID
	m.aiPending[p["proposalId"].(string)] = pending
	for i := range m.srv.store.data.Campaigns {
		if m.srv.store.data.Campaigns[i].ID == c.CampaignID {
			m.srv.store.data.Campaigns[i].Monsters[0].Content = "Changed"
		}
	}
	if w := foundryCall(t, m, "POST", "v1/actors/ai/apply", body); w.Code != 409 {
		t.Fatal("changed source accepted")
	}
	m.srv.store.data.Users[0].Subscription = nil
	if w := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:ai-test", "mode": "enrich", "edition": "2014"}); w.Code != 402 {
		t.Fatal("unpaid call accepted")
	}
	if w := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:other-campaign", "mode": "enrich", "edition": "2014"}); w.Code != 404 {
		t.Fatal("foreign actor accepted")
	}
}
func TestFoundryAIExistingModeCannotInventDamageSpellsLoot(t *testing.T) {
	e := knowledgeEntity{StatBlock: &npcStatBlock{Actions: []statBlockEntry{{Name: "Bow", ToHit: "+5", Damage: "11d8+30 piercing"}}}}
	base := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{{Section: "actions", Index: 0, Name: "Bow", ToHit: "+5", Damage: "11d8+30 piercing", Mechanics: foundryMechanics{Kind: "attack"}}}}
	if err := validateFoundryAIProfile(&base, e); err != nil {
		t.Fatal(err)
	}
	for _, damage := range []string{"1d8+3 piercing", "10000 piercing", "11d8+30 piercing plus 11d8+30 piercing", "@level+1d8 piercing"} {
		p := base
		p.Abilities = append([]foundryAIAbility{}, base.Abilities...)
		p.Abilities[0].Damage = damage
		if validateFoundryAIProfile(&p, e) == nil {
			t.Fatalf("invented damage accepted: %s", damage)
		}
	}
	p := base
	p.Spells = []foundryAISpell{{ID: "fireball-2014", Method: "spell"}}
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented spell")
	}
	p = base
	p.Loot = []foundryAILoot{{Name: "Crown", Quantity: 1}}
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented loot")
	}
}
func TestFoundryAISnapshotStaleAndEditionCatalog(t *testing.T) {
	m, c, g := aiFixture(t)
	g.profile.Spells = []foundryAISpell{{ID: "fireball-2024", Method: "innate", DailyUses: 1}}
	w := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:ai-test", "mode": "enrich", "edition": "2024"})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var b struct {
		Data struct {
			ProposalID string `json:"proposalId"`
		} `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &b)
	foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": b.Data.ProposalID})
	rows, _ := foundryRecords(m.srv.store.data, c.CampaignID)
	spells := foundrySpells(rows)
	if len(spells) != 1 || spells[0].ID != "fireball-2024" {
		t.Fatal("profile spells absent from snapshot")
	}
	for i := range m.srv.store.data.Campaigns {
		if m.srv.store.data.Campaigns[i].ID == c.CampaignID {
			m.srv.store.data.Campaigns[i].Monsters[0].Content = "Changed"
		}
	}
	rows, _ = foundryRecords(m.srv.store.data, c.CampaignID)
	var e knowledgeEntity
	json.Unmarshal(rows[0].Data, &e)
	if !e.FoundryAI.Stale || len(foundrySpells(rows)) != 0 {
		t.Fatal("stale profile applied")
	}
}

func TestFoundryAIAtomicFailureAndConcurrentProfileConflict(t *testing.T) {
	m, c, _ := aiFixture(t)
	first := foundryAIProposal(t, m, "enrich")
	second := foundryAIProposal(t, m, "enrich")
	m.srv.store.atomicFileReplace = func(string, string) error { return fmtError("disk unavailable") }
	body := map[string]any{"recordKey": "monster:ai-test", "proposalId": first["proposalId"]}
	if w := foundryCall(t, m, "POST", "v1/actors/ai/apply", body); w.Code != 500 {
		t.Fatal("save failure not returned")
	}
	rows, _ := foundryRecords(m.srv.store.data, c.CampaignID)
	var entity knowledgeEntity
	json.Unmarshal(rows[0].Data, &entity)
	if entity.FoundryAI != nil {
		t.Fatal("failed persistence modified memory")
	}
	m.srv.store.atomicFileReplace = nil
	if w := foundryCall(t, m, "POST", "v1/actors/ai/apply", body); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": second["proposalId"]}); w.Code != 409 {
		t.Fatal("concurrent profile overwritten")
	}
	rows, _ = foundryRecords(m.srv.store.data, c.CampaignID)
	json.Unmarshal(rows[0].Data, &entity)
	id := entity.FoundryAI.ID
	if _, err := m.srv.store.updateEntity(c.CampaignID, entity.ID, createEntityInput{Kind: "monster", Title: "Updated", StatBlock: entity.StatBlock}); err != nil {
		t.Fatal(err)
	}
	rows, _ = foundryRecords(m.srv.store.data, c.CampaignID)
	var updated knowledgeEntity
	json.Unmarshal(rows[0].Data, &updated)
	if updated.FoundryAI == nil || updated.FoundryAI.ID != id || !updated.FoundryAI.Stale {
		t.Fatal("CRUD discarded profile instead of marking stale")
	}
}
