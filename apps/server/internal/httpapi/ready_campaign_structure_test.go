package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestReadyCampaignHierarchyAndDossiers(t *testing.T) {
	body, err := readyCampaignFiles.ReadFile("ready_campaigns/icewind-dale-rus/presentation.json")
	if err != nil {
		t.Fatal(err)
	}
	var presentation struct {
		RootID string `json:"rootId"`
		Nodes  []struct {
			ID, EntityID, Title, Kind, ParentID string
			ChapterIDs                          []int
			NavigationGroup                     bool
			Pages                               []int
		} `json:"nodes"`
		Chapters []struct {
			ID, LevelMin int
			LevelMax     *int
			LevelLabel   string
			LevelPages   []int
		} `json:"chapters"`
		Items map[string]struct {
			ChapterIDs  []int
			LocationIDs []string
			Sections    []struct{ Kind, Text string }
			PlayerCards []struct {
				Title, Text, SourceKind string
				Pages                   []int
			}
			StatProfiles []struct {
				Title, Basis, Notes string
				Pages               []int
				StatBlock           *npcStatBlock
			}
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &presentation); err != nil {
		t.Fatal(err)
	}
	pack, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	parents, entityIDs, locationNodes := map[string]string{}, map[string]bool{}, map[string]int{}
	for _, group := range [][]knowledgeEntity{pack.Locations, pack.NPCs, pack.Monsters, pack.Quests, pack.Lore} {
		for _, entity := range group {
			entityIDs[entity.ID] = true
		}
	}
	for _, node := range presentation.Nodes {
		if _, duplicate := parents[node.ID]; duplicate {
			t.Fatalf("duplicate node %s", node.ID)
		}
		parents[node.ID] = node.ParentID
		if !entityIDs[node.EntityID] {
			t.Fatalf("broken entity link %s", node.ID)
		}
		if node.Kind != "npc" && !node.NavigationGroup {
			locationNodes[node.EntityID]++
		}
		if node.Kind == "npc" && len(node.Pages) == 0 {
			t.Fatalf("NPC relationship without source: %s", node.Title)
		}
		for _, chapter := range node.ChapterIDs {
			if chapter < 1 || chapter > 7 {
				t.Fatal("unknown chapter")
			}
		}
	}
	if parents[presentation.RootID] != "" {
		t.Fatal("adventure root must not have a parent")
	}
	for id, parent := range parents {
		if id != presentation.RootID && parent == "" {
			t.Fatalf("orphan node %s", id)
		}
		seen := map[string]bool{id: true}
		for parent != "" {
			if seen[parent] {
				t.Fatalf("cycle from %s", id)
			}
			seen[parent] = true
			next, ok := parents[parent]
			if !ok {
				t.Fatalf("missing parent %s", parent)
			}
			parent = next
		}
	}
	for _, location := range pack.Locations {
		if locationNodes[location.ID] != 1 {
			t.Fatalf("location is lost or duplicated: %s", location.Title)
		}
	}
	if len(presentation.Chapters) != 7 {
		t.Fatal("chapter scheme incomplete")
	}
	wantMin := []int{1, 4, 4, 6, 7, 8, 9}
	for i, chapter := range presentation.Chapters {
		if chapter.ID != i+1 || chapter.LevelMin != wantMin[i] || len(chapter.LevelPages) != 1 || chapter.LevelPages[0] != 10 {
			t.Fatal("level recommendation differs from book scheme")
		}
	}
	byTitle := map[string]string{}
	quotes := map[string]bool{}
	for _, material := range presentation.Items {
		for _, section := range material.Sections {
			if section.Kind == "read_aloud" {
				quotes[section.Text] = true
			}
		}
	}
	for _, entity := range pack.NPCs {
		byTitle[entity.Title] = entity.ID
	}
	hlin := presentation.Items[byTitle["Хлин Троллегуб"]]
	if len(hlin.PlayerCards) == 0 || len(hlin.StatProfiles) != 1 {
		t.Fatal("Hlin dossier missing appearance or stats")
	}
	if !strings.HasPrefix(hlin.StatProfiles[0].StatBlock.ArmorClass, "11") {
		t.Fatal("Hlin is unarmored in the source")
	}
	for _, action := range hlin.StatProfiles[0].StatBlock.Actions {
		if strings.Contains(strings.ToLower(action.Name+action.Description), "меч") {
			t.Fatal("Hlin's axes were lost")
		}
	}
	for _, title := range []string{"Амонатор", "Латандер", "Векна"} {
		if len(presentation.Items[byTitle[title]].StatProfiles) != 0 {
			t.Fatalf("a worshipper's statblock was assigned to %s", title)
		}
	}
	for _, location := range pack.Locations {
		if location.Category == "City" {
			found := false
			for _, chapter := range presentation.Items[location.ID].ChapterIDs {
				if chapter == 4 {
					found = true
				}
			}
			if !found {
				t.Fatalf("dragon attack stage missing for %s", location.Title)
			}
		}
	}
	for _, npc := range pack.NPCs {
		material := presentation.Items[npc.ID]
		if len(material.LocationIDs) == 0 {
			t.Fatalf("NPC missing navigation: %s", npc.Title)
		}
		for _, id := range material.LocationIDs {
			if locationNodes[id] != 1 {
				t.Fatalf("invalid NPC location %s", id)
			}
		}
		for _, profile := range material.StatProfiles {
			if profile.StatBlock == nil || profile.StatBlock.ArmorClass == "" || len(profile.Pages) == 0 {
				t.Fatalf("incomplete sourced stat profile: %s", npc.Title)
			}
		}
		for _, card := range material.PlayerCards {
			if len(card.Pages) == 0 || strings.Contains(card.Text, "Класс Доспеха") || strings.Contains(card.Text, "нейтрально-") {
				t.Fatalf("unsafe player card: %s", npc.Title)
			}
			if card.SourceKind == "quote" && !quotes[card.Text] {
				t.Fatalf("NPC scene was not a source read-aloud: %s", npc.Title)
			}
		}
	}
}
