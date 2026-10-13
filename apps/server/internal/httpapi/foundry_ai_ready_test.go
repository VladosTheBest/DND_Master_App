package httpapi

import (
	"encoding/json"
	"testing"
)

func TestFoundryAIReadyCampaignOverlayApplyCacheUndo(t *testing.T) {
	m, c, g := aiFixture(t)
	var campaign *campaignData
	for i := range m.srv.store.data.Campaigns {
		if m.srv.store.data.Campaigns[i].ID == c.CampaignID {
			campaign = &m.srv.store.data.Campaigns[i]
		}
	}
	*campaign = ensureCampaignShape(*campaign)
	campaign.ReadyCampaign = &readyCampaignInfo{}
	campaign.ReadyCampaign.ContentHash = readyCampaignDigest(*campaign)
	before, _ := json.Marshal(campaign.Monsters)
	p := foundryAIProposal(t, m, "configure")
	w := foundryCall(t, m, "POST", "v1/actors/ai/apply", map[string]any{"recordKey": "monster:ai-test", "proposalId": p["proposalId"]})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	after, _ := json.Marshal(campaign.Monsters)
	if string(before) != string(after) {
		t.Fatal("template mutated")
	}
	profile := campaign.FoundryActorProfiles["monster:ai-test"]
	if profile == nil {
		t.Fatal("overlay missing")
	}
	rows, _ := foundryRecords(m.srv.store.data, c.CampaignID)
	var actor knowledgeEntity
	for _, r := range rows {
		if r.Key == "monster:ai-test" {
			json.Unmarshal(r.Data, &actor)
		}
	}
	if actor.FoundryAI == nil || actor.FoundryAI.ID != profile.ID {
		t.Fatal("snapshot missing overlay")
	}
	if foundryAIProposal(t, m, "configure")["cached"] != true || g.calls != 1 {
		t.Fatal("uncached")
	}
	copy := ensureCampaignShape(*campaign)
	copy.FoundryActorProfiles["monster:ai-test"].Abilities[0].Name = "changed"
	if profile.Abilities[0].Name == "changed" {
		t.Fatal("snapshot aliases store")
	}
	restored, err := cloneStorageState(m.srv.store.data)
	if err != nil {
		t.Fatal(err)
	}
	rows, _ = foundryRecords(restored, c.CampaignID)
	found := false
	for _, r := range rows {
		if r.Key == "monster:ai-test" {
			var e knowledgeEntity
			json.Unmarshal(r.Data, &e)
			found = e.FoundryAI != nil
		}
	}
	if !found {
		t.Fatal("storage roundtrip lost profile")
	}
	w = foundryCall(t, m, "POST", "v1/actors/ai/undo", map[string]any{"recordKey": "monster:ai-test", "profileId": profile.ID})
	if w.Code != 200 || campaign.FoundryActorProfiles["monster:ai-test"] != nil {
		t.Fatal("undo failed", w.Body.String())
	}
	after, _ = json.Marshal(campaign.Monsters)
	if string(before) != string(after) {
		t.Fatal("undo mutated template")
	}
}

func TestFoundryAIExtractCombinedDragonActions(t *testing.T) {
	claw := "Когти. Рукопашная атака оружием: +11 к попаданию, досягаемость 5 фт., одна цель. Попадание: 14 (2к6 + 7) рубящего урона."
	tail := "Хвост. Рукопашная атака оружием: +11 к попаданию, досягаемость 10 фт., одна цель. Попадание: 18 (2к10 + 7) дробящего урона."
	breath := "Дыхание излучением (перезарядка 5–6). Дракон испускает энергетический луч линией длиной в 120 футов и шириной 5 футов. Все существа в этой линии должны совершить спасбросок Ловкости Сл 16, получая 31 (7к8) урона излучением при провале, или половину этого урона при успехе."
	e := knowledgeEntity{StatBlock: &npcStatBlock{Actions: []statBlockEntry{{Name: "Действия из источника", Description: claw + " " + tail + " " + breath}}}}
	p := foundryAIProfile{Mode: "configure", Edition: "2014", Abilities: []foundryAIAbility{
		{Section: "actions", Index: -1, Name: "Когти", Description: claw, ToHit: "+11", Damage: "2d6+7 slashing", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 5}},
		{Section: "actions", Index: -1, Name: "Хвост", Description: tail, ToHit: "+11", Damage: "2d10+7 bludgeoning", ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Range: 10}},
		{Section: "actions", Index: -1, Name: "Дыхание излучением", Description: breath, Damage: "7d8 radiant", ItemType: "spell", Mechanics: foundryMechanics{Kind: "save", SaveAbility: "dex", SaveDC: 16, SaveDamage: "half", Range: 120}},
	}}
	if err := validateFoundryAIProfile(&p, e); err != nil {
		t.Fatal(err)
	}
	p.Abilities[0].Damage = "8d6 fire"
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented damage accepted")
	}
	p.Abilities[0].Damage = "2d6+7 slashing"
	p.Abilities[0].Name = "Придуманная способность"
	p.Abilities[0].Description = "Несуществующая атака, не описанная в источнике."
	if validateFoundryAIProfile(&p, e) == nil {
		t.Fatal("invented excerpt accepted")
	}
}
