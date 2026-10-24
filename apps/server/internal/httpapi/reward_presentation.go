package httpapi

import "strings"

// Presentation accepts literal RGB colors only; it never stores CSS expressions.
func safeRewardColor(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if len(value) != 7 || value[0] != '#' {
		return ""
	}
	for _, r := range value[1:] {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f') {
			return ""
		}
	}
	return value
}

func sanitizeRewardPresentation(profile *monsterRewardProfile) *monsterRewardProfile {
	if profile == nil {
		return nil
	}
	result := *profile
	result.TextColor = safeRewardColor(profile.TextColor)
	result.BackgroundColor = safeRewardColor(profile.BackgroundColor)
	result.Loot = append([]monsterLootEntry(nil), profile.Loot...)
	for i := range result.Loot {
		result.Loot[i].TextColor = safeRewardColor(result.Loot[i].TextColor)
		result.Loot[i].BackgroundColor = safeRewardColor(result.Loot[i].BackgroundColor)
	}
	return &result
}

// Quest appearance is presentation only and cannot carry CSS expressions.
func sanitizeQuestAppearance(kind string, appearance *questAppearance) *questAppearance {
	if kind != "quest" || appearance == nil {
		return nil
	}
	result := *appearance
	result.TextColor = safeRewardColor(result.TextColor)
	result.BackgroundColor = safeRewardColor(result.BackgroundColor)
	result.AccentColor = safeRewardColor(result.AccentColor)
	if result.Density != "compact" && result.Density != "comfortable" {
		result.Density = ""
	}
	return &result
}
