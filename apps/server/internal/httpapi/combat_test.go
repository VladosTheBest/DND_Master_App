package httpapi

import "testing"

func TestParseChallengeExperienceSupportsCommonFormats(t *testing.T) {
	tests := []struct {
		name      string
		challenge string
		expected  int
	}{
		{name: "plain challenge", challenge: "3", expected: 700},
		{name: "cr prefix", challenge: "CR 3", expected: 700},
		{name: "russian danger prefix", challenge: "Опасность 1/2", expected: 100},
		{name: "challenge with xp", challenge: "3 (700 XP)", expected: 700},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := parseChallengeExperience(test.challenge); actual != test.expected {
				t.Fatalf("expected %d XP for %q, got %d", test.expected, test.challenge, actual)
			}
		})
	}
}

func TestEnsureCombatEntriesBackfillsExperienceFromChallenge(t *testing.T) {
	entries := ensureCombatEntries([]combatEntry{
		{
			ID:         "enemy-entry",
			EntityID:   "monster-1",
			EntityKind: "monster",
			Side:       "enemy",
			Title:      "Custom Beast",
			Challenge:  "3",
			Experience: 0,
		},
		{
			ID:         "enemy-entry-statblock",
			EntityID:   "monster-2",
			EntityKind: "monster",
			Side:       "enemy",
			Title:      "Fallback Beast",
			Experience: 0,
			StatBlock: &npcStatBlock{
				Challenge: "CR 2",
			},
		},
	})

	if entries[0].Experience != 700 {
		t.Fatalf("expected challenge-only entry to gain 700 XP, got %d", entries[0].Experience)
	}
	if entries[1].Experience != 450 {
		t.Fatalf("expected stat block fallback entry to gain 450 XP, got %d", entries[1].Experience)
	}
	if entries[1].Challenge != "CR 2" {
		t.Fatalf("expected challenge to be restored from stat block, got %q", entries[1].Challenge)
	}
}
