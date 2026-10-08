package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFoundryAIFiendFeaturesBecomeSpells(t *testing.T) {
	e := knowledgeEntity{StatBlock: &npcStatBlock{Actions: []statBlockEntry{
		{Name: "Адский огонь", Description: "Зеленое пламя, сфера радиусом 10 футов в пределах 120 футов. Спасбросок Ловкости Сл 15: 3к10 огнём и 2к10 некротической энергией."},
		{Name: "Использование заклинаний", Description: "Базовая характеристика Харизма (Сл спасброска от заклинаний 15).\nНеограниченно: доспехи мага [mage armor].\n1/день каждое: изгнание [banishment]."},
	}}}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", CastingAbility: "cha", Abilities: []foundryAIAbility{{Section: "actions", Index: 0, Name: "Адский огонь", ItemType: "spell", Damage: "3d10[fire] + 2d10[necrotic]", Animation: "fireball", AnimationColor: "#55ff44", Radius: 10, Mechanics: foundryMechanics{Kind: "save", SaveAbility: "dex", SaveDC: 15, SaveDamage: "half", Range: 120}}}, Spells: []foundryAISpell{{ID: "banishment-2014", Method: "innate", DailyUses: 1}}}
	if err := validateFoundryAIProfile(&p, e); err != nil {
		t.Fatal(err)
	}
	if p.Abilities[0].Damage != "3d10 fire plus 2d10 necrotic" || p.CastingAbility != "cha" || p.SpellSaveDC != 15 {
		t.Fatalf("normalization: %+v", p)
	}
	p.Spells[0].DailyUses = 2
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented daily limit accepted")
	}
	p.Spells[0].DailyUses = 1
	p.Abilities[0].AnimationColor = "url(secret)"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invalid color accepted")
	}
	p.Abilities[0].AnimationColor = ""
	p.Abilities[0].Damage = "3d10 + @mod"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("dynamic formula accepted")
	}
}

func TestFoundryAIInstructionsParticipateInCache(t *testing.T) {
	m, _, g := aiFixture(t)
	body := map[string]any{"recordKey": "monster:ai-test", "mode": "enrich", "edition": "2014", "instructions": "Зелёный огонь"}
	preview := foundryCall(t, m, "POST", "v1/actors/ai/preview", body)
	if preview.Code != 200 {
		t.Fatal(preview.Body.String())
	}
	var response struct {
		Data struct {
			ProposalID string `json:"proposalId"`
		}
	}
	json.Unmarshal(preview.Body.Bytes(), &response)
	applied := foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": response.Data.ProposalID})
	if applied.Code != 200 {
		t.Fatal(applied.Body.String())
	}
	foundryCall(t, m, "POST", "v1/actors/ai/preview", body)
	if g.calls != 1 || !strings.Contains(g.payload, "Зелёный огонь") {
		t.Fatal("instructions lost or cache missed")
	}
	body["instructions"] = "Синий огонь"
	if w := foundryCall(t, m, "POST", "v1/actors/ai/preview", body); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if g.calls != 2 || !strings.Contains(g.payload, "Синий огонь") {
		t.Fatal("wrong instructions reused")
	}
	body["instructions"] = strings.Repeat("я", 4001)
	if w := foundryCall(t, m, "POST", "v1/actors/ai/preview", body); w.Code != 400 {
		t.Fatal("instruction bound")
	}
}

type foundryAIRepairGenerator struct{ *foundryAITestGenerator }

func (g *foundryAIRepairGenerator) requestConstrainedPatch(_ string, _ string, payload string, _ map[string]any) (json.RawMessage, error) {
	g.calls++
	g.payload = payload
	profile := g.profile
	profile.Abilities = append([]foundryAIAbility(nil), profile.Abilities...)
	if g.calls == 1 {
		profile.Abilities[0].Damage = "1d8 + @mod"
	}
	return json.Marshal(profile)
}
func TestFoundryAIRepairsInvalidModelFormulaOnce(t *testing.T) {
	m, _, base := aiFixture(t)
	g := &foundryAIRepairGenerator{base}
	m.srv.generator = g
	result := foundryAIProposal(t, m, "configure")
	if result["profile"] == nil || g.calls != 2 || !strings.Contains(g.payload, "validationError") {
		t.Fatal("bounded repair failed")
	}
	// An unrepairable model response stays an explicit failure and never loops.
	base.calls = 0
	base.profile.Abilities[0].Damage = "1d8 + @mod"
	m.srv.generator = base
	response := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:ai-test", "mode": "configure", "edition": "2014"})
	if response.Code != 502 || base.calls != 2 {
		t.Fatal("invalid profile accepted or unbounded repair")
	}
}
