package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestFoundryAIShortQuotedAttackKeepsCompleteSource(t *testing.T) {
	campaign, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	var dragon knowledgeEntity
	for _, e := range campaignEntities(campaign) {
		if e.Title == "Чардалиновый дракон" {
			dragon = e
		}
	}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
		{Name: "Когти", Section: "actions", Index: -1, Description: "Рукопашная атака оружием: +11 к попаданию, досягаемость 5 фт., одна цель.", ToHit: "+11", Damage: "2d6+7 slashing", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 5}},
		{Name: "Зловещее присутствие", Section: "actions", Index: -1, Radius: 30, Mechanics: foundryMechanics{Kind: "save", SaveAbility: "wis", SaveDC: 16, Range: 30}},
		{Name: "Дыхание излучением", Section: "actions", Index: -1, Radius: 5, DailyUses: 5, Damage: "7d8 radiant", Mechanics: foundryMechanics{Kind: "save", SaveAbility: "dex", SaveDC: 16, Range: 120}},
	}}
	prepareFoundryAIProfile(&p, dragon)
	if p.Abilities[2].Radius != 0 || p.Abilities[2].DailyUses != 0 {
		t.Fatal("line width/recharge mistaken for circle/daily uses")
	}
	if err := validateFoundryAIProfile(&p, dragon); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(p.Abilities[0].Description, "Попадание") || strings.Contains(p.Abilities[0].Description, "Хвост") {
		t.Fatal("wrong passage boundary")
	}
	p.Abilities[0].Damage = "9d12 slashing"
	if validateFoundryAIProfile(&p, dragon) == nil {
		t.Fatal("invented damage accepted")
	}
}

func TestFoundryAIRealFrostmaidenTextFormats(t *testing.T) {
	campaign, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	var dragon, sephek knowledgeEntity
	for _, e := range campaignEntities(campaign) {
		if e.Title == "Чардалиновый дракон" {
			dragon = e
		}
		if e.Title == "Сефек Калтро" {
			sephek = e
		}
	}
	if dragon.StatBlock == nil || sephek.StatBlock == nil {
		t.Fatal("real source missing")
	}
	tests := []struct {
		e       knowledgeEntity
		profile foundryAIProfile
	}{
		{dragon, foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
			{Name: "Когти", Section: "actions", Index: 1, Description: "Атака когтями дракона.", Damage: "2d6+7 slashing", ToHit: "+11", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 5}},
			{Name: "Хвост", Section: "actions", Index: 2, Damage: "2d10+7 bludgeoning", ToHit: "+11", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 10}},
			{Name: "Крылья", Section: "actions", Index: 3, Damage: "2d4+7 bludgeoning", ToHit: "+11", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 10}},
			{Name: "Дыхание излучением", Section: "actions", Index: 5, Damage: "7d8 radiant", ItemType: "spell", Mechanics: foundryMechanics{Kind: "save", SaveDC: 16, SaveAbility: "dex", SaveDamage: "half", Range: 120}},
			{Name: "Зловещее присутствие", Section: "actions", Index: 4, ItemType: "feat", Mechanics: foundryMechanics{Kind: "save", SaveDC: 16, SaveAbility: "wis", Range: 30}},
			{Name: "Неизменяемая форма", Section: "traits", Index: 0, ItemType: "feat", Mechanics: foundryMechanics{Kind: "manual"}},
		}, Loot: []foundryAILoot{{Name: "Выдуманный предмет", Quantity: 0}}}},
		{sephek, foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
			{Name: "Ледяной длинный меч", Section: "actions", Index: 7, Damage: "1d8+3 slashing plus 2d4 cold", ToHit: "+5", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 5}},
			{Name: "Ледяной кинжал", Section: "actions", Index: 8, Damage: "1d4+3 piercing plus 2d4 cold", ToHit: "+5", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", AttackMode: "ranged", Range: 20}},
		}, Skills: []foundryAISkill{{ID: "prc", Proficient: 1}, {ID: "sur", Proficient: 1}}, Spells: []foundryAISpell{{ID: "misty-step-2014", Method: "innate", DailyUses: 1}}, CastingAbility: "cha"}},
	}
	for _, tc := range tests {
		t.Run(tc.e.Title, func(t *testing.T) {
			for _, format := range []string{"pdf", "markdown", "html"} {
				t.Run(format, func(t *testing.T) {
					raw, _ := json.Marshal(tc.e)
					var e knowledgeEntity
					json.Unmarshal(raw, &e)
					for _, entries := range foundryAISections(e.StatBlock) {
						for i := range entries {
							switch format {
							case "markdown":
								entries[i].Description = "**" + strings.ReplaceAll(entries[i].Description, ". ", ".**\n\n**") + "**"
							case "html":
								entries[i].Description = "<p>" + strings.ReplaceAll(entries[i].Description, ". ", ".</p><p>") + "</p>"
							}
						}
					}
					raw, _ = json.Marshal(tc.profile)
					var p foundryAIProfile
					json.Unmarshal(raw, &p)
					prepareFoundryAIProfile(&p, e)
					if err := validateFoundryAIProfile(&p, e); err != nil {
						t.Fatalf("%s %v %+v", format, err, p.Abilities)
					}
					for _, a := range p.Abilities {
						if a.Index != -1 {
							t.Fatalf("not extracted: %+v", a)
						}
					}
					if tc.e.Title == "Сефек Калтро" && (len(p.Spells) != 1 || p.CastingAbility != "cha") {
						t.Fatal("innate spell or casting ability lost")
					}
					if len(p.Loot) != 0 {
						t.Fatal("unrelated loot blocked setup")
					}
				})
			}
		})
	}
}

func TestFoundryAIPartialProfilePreservesGoodAttack(t *testing.T) {
	m, c, g := aiFixture(t)
	g.profile.Abilities = append(g.profile.Abilities, foundryAIAbility{Name: "Bogus", Section: "actions", Index: 9, Description: "Nothing in the source", Damage: "999d20 fire", Mechanics: foundryMechanics{Kind: "attack"}})
	g.profile.Loot = []foundryAILoot{{Name: "Gold", Quantity: 0}}
	p := foundryAIProposal(t, m, "configure")
	raw, _ := json.Marshal(p["profile"])
	var profile foundryAIProfile
	json.Unmarshal(raw, &profile)
	if len(profile.Abilities) != 1 || profile.Abilities[0].Damage != "1d8+3 piercing" || profile.Abilities[0].Mechanics.Kind != "attack" || len(profile.Notes) == 0 {
		t.Fatalf("lost good attack: %+v", profile)
	}
	if g.calls > 2 {
		t.Fatal("unbounded repair")
	}
	for _, campaign := range m.srv.store.data.Campaigns {
		if campaign.ID == c.CampaignID && campaign.Monsters[0].FoundryAI != nil {
			t.Fatal("preview modified source")
		}
	}
}

func TestFoundryAIBatchAboveSixtyAndHardLimit(t *testing.T) {
	m, c, g := aiFixture(t)
	for i := 0; i < 221; i++ {
		m.aiAttempts[c.OwnerID] = append(m.aiAttempts[c.OwnerID], time.Now())
	}
	foundryAIProposal(t, m, "configure")
	if g.calls != 1 {
		t.Fatal("campaign-size batch blocked")
	}
	for len(m.aiAttempts[c.OwnerID]) < 500 {
		m.aiAttempts[c.OwnerID] = append(m.aiAttempts[c.OwnerID], time.Now())
	}
	w := foundryCall(t, m, "POST", "v1/actors/ai/preview", map[string]any{"recordKey": "monster:ai-test", "mode": "configure", "edition": "2014"})
	if w.Code != 429 || g.calls != 1 {
		t.Fatal("hard quota bypass")
	}
}

func TestFoundryAISealAttackRecovery(t *testing.T) {
	c, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	var seal knowledgeEntity
	for _, e := range campaignEntities(c) {
		if e.Title == "Тюлень" {
			seal = e
		}
	}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
		{Name: "Укус", Section: "actions", Index: -1, ToHit: "+4", Damage: "1d4+2 bludgeoning", Mechanics: foundryMechanics{Kind: "attack"}},
		{Name: "Хвост", Section: "actions", Index: -1, ToHit: "+2", Damage: "1 piercing", Mechanics: foundryMechanics{Kind: "manual"}},
	}}
	prepareFoundryAIProfile(&p, seal)
	if err := validateFoundryAIProfile(&p, seal); err != nil {
		t.Fatal(err)
	}
	if p.Abilities[0].ToHit != "+2" || p.Abilities[0].Damage != "1 piercing" || p.Abilities[1].ToHit != "+4" || p.Abilities[1].Damage != "1d4+2 bludgeoning" {
		t.Fatalf("source not recovered: %+v", p.Abilities)
	}
	for _, a := range p.Abilities {
		if a.Mechanics.Kind != "attack" || a.ItemType != "weapon" {
			t.Fatal("not an attack")
		}
	}
	if _, ok := foundryAITextAttack(statBlockEntry{Description: "Melee Weapon Attack: +4 to hit. Hit: 1d6 piercing if the target fails a saving throw."}); ok {
		t.Fatal("conditional damage guessed")
	}
}

func TestFoundryAIInstalledAnimationScope(t *testing.T) {
	m, _, g := aiFixture(t)
	g.profile.Abilities[0].SequencerAnimation = "jb2a.bite"
	input := map[string]any{"recordKey": "monster:ai-test", "mode": "configure", "edition": "2014", "animationOptions": []string{"jb2a.bite", "jb2a.tail"}}
	w := foundryCall(t, m, "POST", "v1/actors/ai/preview", input)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"sequencerAnimation":"jb2a.bite"`) {
		t.Fatal(w.Body.String())
	}
	if !strings.Contains(g.payload, "installedSequencerAnimations") {
		t.Fatal("catalog not sent")
	}
	input["animationOptions"] = []string{"https://bad.invalid/code.js"}
	if foundryCall(t, m, "POST", "v1/actors/ai/preview", input).Code != 400 {
		t.Fatal("arbitrary path accepted")
	}
}

func TestFoundryAIAnimationSchemaProviderBudget(t *testing.T) {
	options := make([]string, 256)
	for i := range options {
		options[i] = fmt.Sprintf("jb2a.effect%d", i)
	}
	for _, edition := range []string{"2014", "2024"} {
		schema := foundryAISchemaForOptions(edition, options)
		b, _ := json.Marshal(schema)
		var decoded any
		json.Unmarshal(b, &decoded)
		count := 0
		var visit func(any)
		visit = func(v any) {
			switch x := v.(type) {
			case map[string]any:
				if values, ok := x["enum"].([]any); ok {
					count += len(values)
				}
				for _, value := range x {
					visit(value)
				}
			case []any:
				for _, value := range x {
					visit(value)
				}
			}
		}
		visit(decoded)
		if count > 1000 {
			t.Fatalf("%s: %d enum values exceed provider limit", edition, count)
		}
		props := schema["properties"].(map[string]any)
		for _, key := range []string{"abilities", "spells"} {
			ref := props[key].(map[string]any)["items"].(map[string]any)["properties"].(map[string]any)["sequencerAnimation"].(map[string]any)["$ref"]
			if ref != "#/$defs/sequencerAnimation" {
				t.Fatal("catalog is not shared")
			}
		}
	}
}

func TestFoundryAIPassiveWaterBreathingIsNotSpell(t *testing.T) {
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Spells: []foundryAISpell{{ID: "water-breathing-2014", Method: "innate"}}}
	e := knowledgeEntity{Content: "Подводное дыхание. Существо может дышать только под водой."}
	foundryAIKeepSourceSpells(&p, e)
	if len(p.Spells) != 0 {
		t.Fatal("biological trait became spell")
	}
	e.Content = "Использование заклинаний. Может сотворять заклинание Подводное дыхание."
	p.Spells = []foundryAISpell{{ID: "water-breathing-2014", Method: "innate"}}
	foundryAIKeepSourceSpells(&p, e)
	if len(p.Spells) != 1 {
		t.Fatal("explicit spell removed")
	}
}
