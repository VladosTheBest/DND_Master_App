package httpapi

import "testing"

func TestFoundryAIKeepsSourceIdentityWhenModelRephrasesLabels(t *testing.T) {
	e := knowledgeEntity{StatBlock: &npcStatBlock{Actions: []statBlockEntry{
		{Name: "Скимитар", Description: "Рукопашная атака оружием: +6 к попаданию, досягаемость 5 футов. Попадание: 6 (1к6 + 3) рубящего урона плюс 14 (4к6) урона огнём."},
		{Name: "Адский огонь", Description: "Зелёное пламя, сфера радиусом 10 футов в пределах 120 футов. Спасбросок Ловкости Сл 15: 3к10 огнём плюс 2к10 некротической энергией."},
	}, Reactions: []statBlockEntry{{Name: "Возмездие исчадия (3/день)", Description: "Спасбросок Телосложения Сл 15, 4к10 некротического урона."}}}}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
		{Section: "actions", Index: 0, Name: "Scimitar attack", ItemType: "weapon", ToHit: "+6", Damage: "1d6+3 slashing plus 4d6 fire", Animation: "sword-blood", Mechanics: foundryMechanics{Kind: "attack", AttackMode: "melee", Range: 5}},
		{Section: "actions", Index: 1, Name: "Зелёный адский огонь", ItemType: "spell", Damage: "3d10[fire] + 2d10[necrotic]", Animation: "fireball", AnimationColor: "#55ff44", Radius: 10, Mechanics: foundryMechanics{Kind: "save", SaveAbility: "dex", SaveDC: 15, SaveDamage: "half", Range: 120}},
		{Section: "reactions", Index: 0, Name: "Возмездие исчадия", ItemType: "spell", Damage: "4d10 necrotic", DailyUses: 3, Mechanics: foundryMechanics{Kind: "save", SaveAbility: "con", SaveDC: 15, Activation: "reaction"}},
	}}
	if err := validateFoundryAIProfile(&p, e); err != nil {
		t.Fatal(err)
	}
	if p.Abilities[0].Name != "Скимитар" || p.Abilities[1].Name != "Адский огонь" || p.Abilities[2].Name != "Возмездие исчадия (3/день)" {
		t.Fatal("source identity lost")
	}
	p.Abilities[0].ToHit = "+99"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented attack bonus accepted")
	}
	p.Abilities[0].ToHit = "+6"
	p.Abilities[1].Mechanics.SaveDC = 99
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented DC accepted")
	}
	p.Abilities[1].Mechanics.SaveDC = 15
	p.Abilities[0].Index = -1
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("configure added an ability")
	}
}

func TestFoundryAIRephrasedLabelPassesHTTPPreviewAndApply(t *testing.T) {
	m, _, g := aiFixture(t)
	g.profile.Abilities[0].Name = "Дальний выстрел"
	p := foundryAIProposal(t, m, "configure")
	if g.calls != 1 {
		t.Fatal("display label caused a paid repair request")
	}
	w := foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": p["proposalId"]})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
func TestFoundryAIRecoversSkippedPassiveIndicesAndAverageDice(t *testing.T) {
	e := knowledgeEntity{StatBlock: &npcStatBlock{Actions: []statBlockEntry{{Name: "Multiattack"}, {Name: "Blade", Description: "Melee weapon attack: +6 to hit. Hit: 6 (1d6 +3) slashing plus 14 (4d6) fire."}, {Name: "Spellcasting"}, {Name: "Flame", Damage: "16 (3d10)", Description: "Dexterity DC 15: 16 (3d10) fire plus 11 (2d10) necrotic."}}}}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{{Section: "actions", Index: 0, Name: "Blade", ItemType: "weapon", ToHit: "+6", Damage: "6 (1d6 +3) slashing plus 14 (4d6) fire", Mechanics: foundryMechanics{Kind: "attack", AttackMode: "melee"}}, {Section: "actions", Index: 1, Name: "Flame", ItemType: "spell", Damage: "16 (3d10) fire plus 11 (2d10) necrotic", Mechanics: foundryMechanics{Kind: "save", SaveAbility: "dex", SaveDC: 15}}}}
	if err := validateFoundryAIProfile(&p, e); err != nil {
		t.Fatal(err)
	}
	if p.Abilities[0].Index != 1 || p.Abilities[1].Index != 3 || p.Abilities[1].Damage != "3d10 fire plus 2d10 necrotic" {
		t.Fatal("identity or damage lost")
	}
	p.Abilities[1].Damage = "16 (9d10) fire"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented dice accepted")
	}
	if got := foundryAIAbilityIndex([]statBlockEntry{{Name: "Bite"}, {Name: "Bite"}}, "Bite", 1); got != 1 {
		t.Fatal("ambiguous name remapped")
	}
}

func TestFoundryAISourceBonusesAndSkillAliases(t *testing.T) {
	source := statBlockEntry{Description: "6 (1d6+3) slashing plus 14 (4d6) fire"}
	if got := foundryAISourceDamage("1d6 slashing plus 4d6+3 fire", source); got != "1d6+3 slashing plus 4d6 fire" {
		t.Fatal(got)
	}
	if got := foundryAISourceDamage("2d6 fire", source); got != "2d6 fire" {
		t.Fatal("changed dice accepted")
	}
	source.Description = "1d6+3 or 1d6+5"
	if got := foundryAISourceDamage("1d6", source); got != "1d6" {
		t.Fatal("ambiguous bonus guessed")
	}
	e := knowledgeEntity{StatBlock: &npcStatBlock{Skills: "Магия +6"}}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Skills: []foundryAISkill{{ID: "arcana", Proficient: 1}}}
	if err := validateFoundryAIProfile(&p, e); err != nil {
		t.Fatal(err)
	}
	if p.Skills[0].ID != "arc" {
		t.Fatal("skill alias lost")
	}
	p.Skills[0].ID = "persuasion"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented source skill accepted")
	}
}

func TestFoundryAISchemaConstrainedEditionAndResources(t *testing.T) {
	schema := foundryAISchema("2014")
	props := schema["properties"].(map[string]any)
	spell := props["spells"].(map[string]any)["items"].(map[string]any)["properties"].(map[string]any)
	ids := spell["id"].(map[string]any)["enum"].([]string)
	if len(ids) == 0 {
		t.Fatal("empty spell catalog")
	}
	for _, id := range ids {
		if len(id) < 5 || id[len(id)-5:] != "-2014" {
			t.Fatal("mixed edition")
		}
	}
	if spell["dailyUses"].(map[string]any)["maximum"] != 20 {
		t.Fatal("resource unbounded")
	}
	if len(spell["method"].(map[string]any)["enum"].([]string)) != 2 {
		t.Fatal("method unbounded")
	}
}

func TestFoundryAIConfigureDropsOnlyUnsupportedSpellSuggestions(t *testing.T) {
	e := knowledgeEntity{Content: "The mage can cast Shield."}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Spells: []foundryAISpell{{ID: "shield-2014", Method: "innate"}, {ID: "fireball-2014", Method: "innate"}}}
	foundryAIKeepSourceSpells(&p, e)
	if len(p.Spells) != 1 || p.Spells[0].ID != "shield-2014" || len(p.Notes) != 1 {
		t.Fatal("source spell filter")
	}
	p.Mode = "enrich"
	p.Spells = append(p.Spells, foundryAISpell{ID: "fireball-2014", Method: "innate"})
	foundryAIKeepSourceSpells(&p, e)
	if len(p.Spells) != 2 {
		t.Fatal("enrich proposal lost")
	}
}
