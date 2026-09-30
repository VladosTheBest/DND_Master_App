package httpapi

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Feature selections are validated in addition to the spell and ASI tables.
// A choice only exists at the level and for the origin/class that grants it.
type characterChoiceRequirement struct {
	count    int
	options  []string
	optional bool
}

func characterSelectedSubclass(d characterDraft, through int) string {
	for _, level := range d.Levels {
		if level.Level <= through && level.SubclassID != "" {
			return level.SubclassID
		}
	}
	return ""
}

func characterIsDraconic(d characterDraft, through int) bool {
	id := characterSelectedSubclass(d, through)
	return d.ClassID == "sorcerer" && id == "draconic"
}

func characterSelectedSubclassData(d characterDraft, through int) characterSubclass {
	id := characterSelectedSubclass(d, through)
	for _, class := range characterRules.Classes {
		if class.ID == d.ClassID {
			base := class.Rules[d.Edition]
			for _, sub := range class.Subclasses {
				if sub.ID == id && characterHas(sub.Editions, d.Edition) {
					sub.Choices = append(append(base.Choices[:0:0], base.Choices...), sub.Choices...)
					sub.ChoicePools = append(append(base.ChoicePools[:0:0], base.ChoicePools...), sub.ChoicePools...)
					sub.Grants = append(append(base.Grants[:0:0], base.Grants...), sub.Grants...)
					return sub
				}
			}
			return base
		}
	}
	return characterSubclass{}
}

func characterPicked(d characterDraft, key string, through int) []string {
	result := []string{}
	for _, level := range d.Levels {
		if level.Level <= through {
			result = append(result, level.FeatureChoices[key]...)
		}
	}
	return result
}

func characterWizardAlwaysPrepared(d characterDraft, level int) []string {
	if d.ClassID != "wizard" {
		return nil
	}
	result := append(characterWizardSubclassGrants(d, level), characterPicked(d, "signature-spells", level)...)
	if d.Edition == "2024" {
		result = append(result, characterPicked(d, "spell-mastery-1", level)...)
		result = append(result, characterPicked(d, "spell-mastery-2", level)...)
	}
	return result
}
func characterSpellOptions(d characterDraft, classID string, spellLevel int) []string {
	result := []string{}
	for _, spell := range characterRules.Spells {
		if spell.Level == spellLevel && characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && characterHas(spell.Classes, classID) {
			result = append(result, spell.ID)
		}
	}
	return result
}

func characterLandGrantedSpells(d characterDraft, level int) []string {
	if d.ClassID != "druid" || characterSelectedSubclass(d, level) != "land" {
		return nil
	}
	selected := characterPicked(d, "land-terrain", level)
	if d.Edition == "2024" && level == d.TargetLevel && d.LandTerrain != "" {
		selected = []string{d.LandTerrain}
	}
	if len(selected) == 0 {
		return nil
	}
	rows := map[string][]string{
		"arctic":    {"hold-person spike-growth", "sleet-storm slow", "freedom-of-movement ice-storm", "commune-with-nature cone-of-cold"},
		"coast":     {"mirror-image misty-step", "water-breathing water-walk", "control-water freedom-of-movement", "conjure-elemental scrying"},
		"desert":    {"blur silence", "create-food-and-water protection-from-energy", "blight hallucinatory-terrain", "insect-plague wall-of-stone"},
		"forest":    {"barkskin spider-climb", "call-lightning plant-growth", "divination freedom-of-movement", "commune-with-nature tree-stride"},
		"grassland": {"invisibility pass-without-trace", "daylight haste", "divination freedom-of-movement", "dream insect-plague"},
		"mountain":  {"spider-climb spike-growth", "lightning-bolt meld-into-stone", "stone-shape stoneskin", "passwall wall-of-stone"},
		"swamp":     {"acid-arrow darkness", "water-walk stinking-cloud", "freedom-of-movement locate-creature", "insect-plague scrying"},
		"underdark": {"spider-climb web", "gaseous-form stinking-cloud", "greater-invisibility stone-shape", "insect-plague cloudkill"},
	}
	if d.Edition == "2024" {
		rows = map[string][]string{
			"arid":      {"blur burning-hands fire-bolt", "fireball", "blight", "wall-of-stone"},
			"polar":     {"fog-cloud hold-person ray-of-frost", "sleet-storm", "ice-storm", "cone-of-cold"},
			"temperate": {"misty-step shocking-grasp sleep", "lightning-bolt", "freedom-of-movement", "tree-stride"},
			"tropical":  {"acid-splash ray-of-sickness web", "stinking-cloud", "polymorph", "insect-plague"},
		}
	}
	result := []string{}
	for index, ids := range rows[selected[0]] {
		if level >= 3+2*index {
			for _, id := range strings.Fields(ids) {
				result = append(result, id+"-"+d.Edition)
			}
		}
	}
	return result
}
func characterSkillProficiencies(d characterDraft, through int, exclude string) []string {
	result := append([]string{}, d.SkillIDs...)
	result = append(result, characterSelectedSubclassData(d, through).SkillIDs...)
	for _, background := range characterRules.Backgrounds {
		if background.ID == d.BackgroundID {
			result = append(result, background.SkillIDs...)
		}
	}
	for _, key := range []string{"background-skills", "human-skill", "half-elf-skills", "elf-skill", "lore-skills", "genie-skill", "totem-skills", "moon-skill", "fey-skill", "domain-skills", "enchanter-skill", "bladesong-skill", "fighter-training", "banneret-skill", "student-war-skill", "archer-skill", "archer-arcana", "archer-nature"} {
		if key != exclude {
			result = append(result, characterPicked(d, key, through)...)
		}
	}
	if d.Edition == "2014" && characterHas([]string{"high-elf", "wood-elf", "drow"}, d.SpeciesID) {
		result = append(result, "perception")
	}
	if d.SpeciesID == "half-orc" {
		result = append(result, "intimidation")
	}
	if through > 0 && through <= len(d.Levels) && exclude != "ghost-proficiency" {
		result = append(result, d.Levels[through-1].FeatureChoices["ghost-proficiency"]...)
	}
	return result
}
func characterExcept(values, excluded []string) []string {
	result := []string{}
	for _, id := range values {
		if !characterHas(excluded, id) {
			result = append(result, id)
		}
	}
	return result
}
func characterAllSkillIDs() []string {
	result := []string{}
	for _, s := range characterRules.Skills {
		result = append(result, s.ID)
	}
	return result
}
func characterInLevels(level int, levels ...int) bool {
	for _, l := range levels {
		if level == l {
			return true
		}
	}
	return false
}
func characterCurrentOriginSpells(d characterDraft, level int) []string {
	result := []string{}
	for key, ids := range d.Levels[level-1].FeatureChoices {
		if strings.HasPrefix(key, "origin-spell-") || key == "divine-bonus-spell" {
			result = append(result, ids...)
		}
	}
	return result
}
func characterPreparedOutsideTome(d characterDraft, level int) []string {
	current := d.Levels[level-1]
	result := append(append([]string{}, current.SpellIDs...), current.CantripIDs...)
	if characterHas(characterPicked(d, "invocations", level), "pact-of-the-chain") {
		result = append(result, "find-familiar-2024")
	}
	for _, table := range [][][]string{characterRules.TomeFixedGrants2024.Species[d.SpeciesID], characterRules.TomeFixedGrants2024.Patrons[characterSelectedSubclass(d, level)]} {
		if len(table) >= level {
			result = append(result, table[level-1]...)
		}
	}
	for _, step := range d.Levels {
		if step.Level > level {
			continue
		}
		for key, ids := range step.FeatureChoices {
			if !strings.HasPrefix(key, "tome-") && (strings.HasSuffix(key, "-cantrip") || strings.HasSuffix(key, "-cantrips") || strings.HasSuffix(key, "-spell")) {
				result = append(result, ids...)
			}
		}
	}
	return result
}
func characterFeatureRequirements(d characterDraft, level int) map[string]characterChoiceRequirement {
	result := map[string]characterChoiceRequirement{}
	add := func(key string, count int, options []string) {
		if count > 0 {
			result[key] = characterChoiceRequirement{count: count, options: options}
		}
	}
	prior := func(key string) []string { return characterPicked(d, key, level-1) }
	is24 := d.Edition == "2024"
	c := d.ClassID
	allSkills := characterAllSkillIDs()
	current := d.Levels[level-1]
	if c == "ranger" && !is24 && characterSelectedSubclass(d, level) == "beast-master" && level >= 3 {
		if level == 3 {
			add("companion-rules", 1, []string{"tasha", "phb"})
		}
		if characterHas(characterPicked(d, "companion-rules", level), "phb") {
			options := []string{}
			for _, form := range characterRules.BeastForms2014 {
				if form.Challenge <= 0.25 && characterHas([]string{"Tiny", "Small", "Medium"}, form.Size) {
					options = append(options, form.ID)
				}
			}
			add("ranger-companion", 1, options)
		}
	}
	if c == "druid" && !is24 && level >= 2 {
		maximum := 0.25
		if level >= 4 {
			maximum = 0.5
		}
		if level >= 8 {
			maximum = 1
		}
		if characterSelectedSubclass(d, level) == "moon" {
			maximum = 1
			if level >= 6 {
				maximum = float64(level / 3)
			}
		}
		options := []string{}
		for _, form := range characterRules.BeastForms2014 {
			if form.Challenge <= maximum && (!form.Fly || level >= 8) && (!form.Swim || level >= 4) {
				options = append(options, form.ID)
			}
		}
		result["wild-shape-seen"] = characterChoiceRequirement{count: len(options), options: options, optional: true}
	}
	if c == "druid" && is24 && level >= 2 {
		count, maximum := 4, 0.25
		if level >= 4 {
			count, maximum = 6, 0.5
		}
		if level >= 8 {
			count, maximum = 8, 1
		}
		if level >= 3 && characterSelectedSubclass(d, level) == "moon" {
			maximum = float64(level / 3)
		}
		options := []string{}
		for _, form := range characterRules.BeastForms2024 {
			if form.Challenge <= maximum && (!form.Fly || level >= 8) {
				options = append(options, form.ID)
			}
		}
		add("wild-shape-forms", count, options)
	}

	if c == "artificer" {
		tools := characterPicked(d, "artificer-tool", level)
		specialistTools := map[string][]string{"alchemist": {"alchemist"}, "armorer": {"smith"}, "artillerist": {"woodcarver"}, "battle-smith": {"smith"}, "cartographer": {"calligrapher", "cartographer"}, "reanimator": {"alchemist"}}
		grantedTools := specialistTools[characterSelectedSubclass(d, level)]
		if level == 3 {
			for _, tool := range tools {
				if characterHas(grantedTools, tool) {
					options := []string{}
					for _, choice := range characterSelectedSubclassData(d, level).Choices {
						if choice.ID == "artificer-tool" {
							for _, option := range choice.Options {
								if !characterHas(tools, option.ID) && !characterHas(grantedTools, option.ID) {
									options = append(options, option.ID)
								}
							}
						}
					}
					add("artificer-tool-replacement", 1, options)
					break
				}
			}
		}
		if level >= 11 {
			options := []string{"none"}
			maxCircle := 2
			if is24 {
				maxCircle = 3
			}
			for _, spell := range characterRules.Spells {
				castingTime := strings.ToLower(spell.CastingTime)
				if characterHas(spell.Editions, d.Edition) && characterHas(spell.Classes, "artificer") && spell.Level >= 1 && spell.Level <= maxCircle && (castingTime == "action" || castingTime == "1 action") && (!is24 || !strings.Contains(strings.ToLower(spell.Components), "consum")) {
					options = append(options, spell.ID)
				}
			}
			add("artificer-stored-magic", 1, options)
		}
	}

	if spec := characterSelectedSubclassData(d, level).ThirdCaster; spec != nil {
		for index, at := range spec.UnrestrictedAt {
			if at > level {
				continue
			}
			options := []string{}
			for _, spell := range characterRules.Spells {
				if characterHas(spell.Editions, d.Edition) && len(spell.SubclassOnly) == 0 && spell.Level > 0 && spell.Level <= (level+5)/6 && characterHas(spell.Classes, "wizard") && !characterHas(current.SpellIDs, spell.ID) {
					options = append(options, spell.ID)
				}
			}
			add("third-caster-free-"+strconv.Itoa(index), 1, options)
		}
	}

	for _, pool := range characterSelectedSubclassData(d, level).ChoicePools {
		if pool.ID == "primal-companion" && !is24 && characterHas(characterPicked(d, "companion-rules", level), "phb") {
			continue
		}
		count := 0
		for _, step := range pool.Counts {
			if step[0] <= level {
				count = step[1]
			}
		}
		options := []string{}
		for _, option := range pool.Options {
			if pool.ID == "artificer-plans" && characterHas(current.FeatureChoices["artificer-armor-plan"], option.ID) || pool.ID == "artificer-armor-plan" && characterHas(current.FeatureChoices["artificer-plans"], option.ID) {
				continue
			}
			if pool.ID == "ghost-proficiency" && characterHas(characterSkillProficiencies(d, level, "ghost-proficiency"), option.ID) {
				continue
			}

			if option.Level <= level {
				options = append(options, option.ID)
			}
		}
		add(pool.ID, count, options)
	}
	for _, choice := range characterSelectedSubclassData(d, level).Choices {
		if choice.Level == level && (choice.Requires == nil || characterHas(characterPicked(d, choice.Requires.ChoiceID, level), choice.Requires.OptionID)) {
			ids := []string{}
			for _, option := range choice.Options {
				ids = append(ids, option.ID)
			}
			add(choice.ID, choice.Count, ids)
		}
	}
	if spec := characterSelectedSubclassData(d, level).ReplaceableSpells; spec != nil {
		for index, entry := range spec.Entries {
			if entry.Level > level {
				continue
			}
			originalID := entry.ID + "-" + d.Edition
			circle := -1
			for _, spell := range characterRules.Spells {
				if spell.ID == originalID {
					circle = spell.Level
					break
				}
			}
			if circle < 0 {
				continue
			}
			options := []string{originalID}
			for _, spell := range characterRules.Spells {
				if spell.ID == originalID || !characterHas(spell.Editions, d.Edition) || spell.Level != circle || !characterHas(spec.Schools, spell.School) {
					continue
				}
				for _, class := range spec.Classes {
					if characterHas(spell.Classes, class) {
						options = append(options, spell.ID)
						break
					}
				}
			}
			add(fmt.Sprintf("origin-spell-%d", index), 1, options)
		}
	}
	if level == 1 {
		if d.BackgroundID == "custom" {
			add("background-skills", 2, characterExcept(allSkills, d.SkillIDs))
		}
		if is24 && d.SpeciesID == "human" {
			add("human-skill", 1, characterExcept(allSkills, characterSkillProficiencies(d, level, "human-skill")))
			bgFeat := ""
			for _, background := range characterRules.Backgrounds {
				if background.ID == d.BackgroundID {
					bgFeat = background.FeatID
				}
			}
			options := []string{}
			for _, feat := range characterRules.Feats {
				if feat.Category == "origin" && characterHas(feat.Editions, d.Edition) && feat.ID != bgFeat {
					options = append(options, feat.ID)
				}
			}
			add("human-feat", 1, options)
		}
		if d.SpeciesID == "half-elf" {
			add("half-elf-skills", 2, characterExcept(allSkills, characterSkillProficiencies(d, level, "half-elf-skills")))
		}
		if is24 && characterHas([]string{"high-elf", "wood-elf", "drow"}, d.SpeciesID) {
			add("elf-skill", 1, characterExcept([]string{"insight", "perception", "survival"}, characterSkillProficiencies(d, level, "elf-skill")))
		}
		if d.SpeciesID == "high-elf" {
			add("elf-cantrip", 1, characterSpellOptions(d, "wizard", 0))
		}
		if is24 && characterHas([]string{"high-elf", "wood-elf", "drow", "rock-gnome", "forest-gnome", "tiefling", "tiefling-abyssal", "tiefling-chthonic"}, d.SpeciesID) {
			add("innate-ability", 1, []string{"int", "wis", "cha"})
		}
		if d.SpeciesID == "dragonborn" || characterIsDraconic(d, level) && !is24 {
			add("ancestry", 1, strings.Fields("black blue brass bronze copper gold green red silver white"))
		}
		if d.SpeciesID == "goliath" {
			add("giant-ancestry", 1, strings.Fields("cloud fire frost hill stone storm"))
		}
	}
	allFeats := []string{}
	if is24 {
		for _, background := range characterRules.Backgrounds {
			if background.ID == d.BackgroundID {
				allFeats = append(allFeats, background.FeatID)
			}
		}
	}
	allFeats = append(allFeats, characterPicked(d, "human-feat", level)...)
	for _, step := range d.Levels {
		if step.Level <= level && step.FeatID != "" {
			allFeats = append(allFeats, step.FeatID)
		}
	}
	for _, feat := range allFeats {
		if strings.HasPrefix(feat, "magic-initiate-") && (level == 1 || current.FeatID == feat) {
			cls := strings.TrimPrefix(feat, "magic-initiate-")
			add(feat+"-cantrips", 2, characterSpellOptions(d, cls, 0))
			add(feat+"-spell", 1, characterSpellOptions(d, cls, 1))
			add(feat+"-ability", 1, []string{"int", "wis", "cha"})
		}
	}

	if c == "fighter" && is24 && level == 3 && characterSelectedSubclass(d, level) == "battlemaster" {
		for _, class := range characterRules.Classes {
			if class.ID == c {
				add("student-war-skill", 1, characterExcept(class.SkillIDs, characterSkillProficiencies(d, level, "student-war-skill")))
			}
		}
	}

	if c == "fighter" && !is24 && level == 7 && characterSelectedSubclass(d, level) == "banneret" {
		known := characterSkillProficiencies(d, level, "banneret-skill")
		options := []string{"persuasion"}
		if characterHas(known, "persuasion") {
			options = characterExcept(strings.Fields("animal-handling insight intimidation performance"), known)
		}
		add("banneret-skill", 1, options)
	}

	if c == "fighter" && level == 3 && characterSelectedSubclass(d, level) == "arcane-archer" {
		known := characterSkillProficiencies(d, 2, "")
		if !is24 {
			add("archer-skill", 1, characterExcept([]string{"arcana", "nature"}, known))
		} else {
			for _, id := range []string{"arcana", "nature"} {
				options := []string{id}
				if characterHas(known, id) {
					for _, class := range characterRules.Classes {
						if class.ID == "fighter" {
							options = characterExcept(class.SkillIDs, known)
						}
					}
				}
				add("archer-"+id, 1, options)
			}
		}
	}
	secondStyle := 10
	if is24 {
		secondStyle = 7
	}
	if c == "fighter" && (level == 1 || level == secondStyle && characterSelectedSubclass(d, level) == "champion") || (c == "paladin" || c == "ranger") && level == 2 {
		options := strings.Fields("archery defense great-weapon-fighting two-weapon-fighting")
		if !is24 && c == "paladin" {
			options = []string{"defense", "great-weapon-fighting"}
		}
		add("fighting-style", 1, characterExcept(options, prior("fighting-style")))
	}
	metaLevel := 3
	if is24 {
		metaLevel = 2
	}
	if c == "sorcerer" && characterInLevels(level, metaLevel, 10, 17) {
		count := 1
		if level == metaLevel || is24 {
			count = 2
		}
		add("metamagic", count, characterExcept(strings.Fields("careful distant empowered extended heightened quickened subtle twinned"), prior("metamagic")))
	}
	bardFirst, bardSecond := 3, 10
	if is24 {
		bardFirst, bardSecond = 2, 9
	}
	if c == "rogue" && characterInLevels(level, 1, 6) || c == "bard" && characterInLevels(level, bardFirst, bardSecond) || is24 && c == "ranger" && characterInLevels(level, 2, 9) || is24 && c == "wizard" && level == 2 {
		options := characterExcept(characterSkillProficiencies(d, level, ""), prior("expertise"))
		count := 2
		if c == "wizard" {
			count = 1
			filtered := []string{}
			for _, id := range options {
				if characterHas(strings.Fields("arcana history investigation medicine nature religion"), id) {
					filtered = append(filtered, id)
				}
			}
			options = filtered
		}
		if c == "ranger" && level == 2 {
			count = 1
		}
		add("expertise", count, options)
	}
	if c == "bard" && level == 3 && characterSelectedSubclass(d, level) == "lore" {
		add("lore-skills", 3, characterExcept(allSkills, characterSkillProficiencies(d, level, "lore-skills")))
	}
	if is24 && c == "bard" && level >= 3 && characterSelectedSubclass(d, level) == "moon" {
		add("moon-cantrip", 1, characterExcept(characterSpellOptions(d, "druid", 0), current.CantripIDs))
		if level == 3 {
			add("moon-skill", 1, characterExcept(strings.Fields("perception survival medicine animal-handling nature insight"), characterSkillProficiencies(d, level, "moon-skill")))
		}
	}
	if is24 && c == "paladin" && level == 3 && characterSelectedSubclass(d, level) == "noble-genies" {
		add("genie-skill", 1, characterExcept(strings.Fields("acrobatics performance intimidation persuasion"), characterSkillProficiencies(d, level, "genie-skill")))
	}
	if !is24 && c == "barbarian" && level == 6 && characterSelectedSubclass(d, level) == "totem-warrior" && characterHas(characterPicked(d, "totem-aspect", level), "tiger") {
		add("totem-skills", 2, characterExcept(strings.Fields("acrobatics athletics survival stealth"), characterSkillProficiencies(d, level, "totem-skills")))
	}
	if !is24 && c == "sorcerer" && characterSelectedSubclass(d, level) == "divine-soul" {
		options := []string{}
		affinity := "good"
		if picked := characterPicked(d, "divine-affinity", level); len(picked) > 0 {
			affinity = picked[0]
		}
		first := map[string]string{"good": "cure-wounds", "evil": "inflict-wounds", "law": "bless", "chaos": "bane", "neutral": "protection-from-evil-and-good"}[affinity] + "-2014"
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && (level == 1 && spell.ID == first || level > 1 && characterHas(spell.Classes, "cleric") && spell.Level > 0 && spell.Level <= min(9, (level+1)/2)) {
				options = append(options, spell.ID)
			}
		}
		add("divine-bonus-spell", 1, options)
	}
	if c == "cleric" {
		domain := characterSelectedSubclass(d, level)
		start := 1
		if is24 {
			start = 3
		}
		if level == start {
			choices := map[string]string{"knowledge": "arcana history nature religion", "nature": "survival nature animal-handling", "peace": "insight performance persuasion", "order": "intimidation persuasion"}
			if is24 {
				choices["arcana"] = "arcana history insight medicine persuasion religion"
			}
			if skills := choices[domain]; skills != "" {
				count := 1
				if domain == "knowledge" {
					count = 2
				}
				add("domain-skills", count, characterExcept(strings.Fields(skills), characterSkillProficiencies(d, level, "domain-skills")))
			}
			if domain == "nature" || !is24 && domain == "arcana" || domain == "death" {
				options := []string{}
				class := "wizard"
				count := 1
				if domain == "nature" {
					class = "druid"
				}
				if domain == "arcana" {
					count = 2
				}
				for _, spell := range characterRules.Spells {
					if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && spell.Level == 0 && !characterHas(current.CantripIDs, spell.ID) && ((domain == "death" && spell.School == "Некромантия") || (domain != "death" && characterHas(spell.Classes, class))) {
						options = append(options, spell.ID)
					}
				}
				add("domain-cantrips", count, options)
			}
		}
		if is24 && domain == "arcana" && level >= 3 {
			add("domain-cantrips", 2, characterExcept(characterSpellOptions(d, "wizard", 0), current.CantripIDs))
		}
		if domain == "arcana" && (level == 17 || is24 && level > 17) {
			for _, circle := range []int{6, 7, 8, 9} {
				add(fmt.Sprintf("domain-mastery-%d", circle), 1, characterSpellOptions(d, "wizard", circle))
			}
		}
	}
	if is24 && level == 1 && c == "cleric" {
		add("divine-order", 1, []string{"protector", "thaumaturge"})
		if characterHas(current.FeatureChoices["divine-order"], "thaumaturge") {
			add("order-cantrip", 1, characterExcept(characterSpellOptions(d, "cleric", 0), current.CantripIDs))
		}
	}
	if is24 && level == 1 && c == "druid" {
		add("primal-order", 1, []string{"warden", "magician"})
		if characterHas(current.FeatureChoices["primal-order"], "magician") {
			add("order-cantrip", 1, characterExcept(characterSpellOptions(d, "druid", 0), current.CantripIDs))
		}
	}
	if is24 && characterHas(strings.Fields("barbarian fighter paladin ranger rogue"), c) {
		total := 2
		if c == "fighter" {
			total = 3
			if level >= 4 {
				total++
			}
			if level >= 10 {
				total++
			}
			if level >= 16 {
				total++
			}
		}
		if c == "barbarian" {
			if level >= 4 {
				total++
			}
			if level >= 10 {
				total++
			}
		}
		weapons := strings.Fields("club dagger handaxe javelin light-hammer mace quarterstaff sickle spear light-crossbow shortbow sling battleaxe flail glaive greataxe greatsword halberd lance longsword maul morningstar pike rapier scimitar shortsword trident warhammer war-pick whip blowgun hand-crossbow heavy-crossbow longbow")
		if c == "rogue" {
			weapons = strings.Fields("dagger shortbow light-crossbow sling club mace quarterstaff sickle spear javelin handaxe light-hammer rapier scimitar shortsword whip hand-crossbow")
		}
		add("weapon-mastery", total-len(prior("weapon-mastery")), characterExcept(weapons, prior("weapon-mastery")))
	}
	if c == "warlock" {
		totals := []int{0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8}
		if is24 {
			totals = []int{1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10}
		}
		invocations := strings.Fields("armor-of-shadows eldritch-sight eyes-of-the-rune-keeper mask-of-many-faces misty-visions devils-sight agonizing-blast repelling-blast eldritch-spear pact-of-the-blade pact-of-the-chain pact-of-the-tome one-with-shadows ascendant-step otherworldly-leap visions-of-distant-realms whispers-of-the-grave witch-sight")
		minimum := map[string]int{"one-with-shadows": 5, "ascendant-step": 9, "otherworldly-leap": 9, "visions-of-distant-realms": 15, "whispers-of-the-grave": 9, "witch-sight": 15}
		if is24 {
			for _, id := range strings.Fields("devils-sight agonizing-blast repelling-blast eldritch-spear mask-of-many-faces misty-visions otherworldly-leap") {
				minimum[id] = 2
			}
			minimum["ascendant-step"] = 5
			minimum["whispers-of-the-grave"] = 7
			minimum["visions-of-distant-realms"] = 9
		}
		options := []string{}
		for _, id := range invocations {
			if characterHas(prior("invocations"), id) || level < minimum[id] || is24 && characterHas([]string{"eldritch-sight", "eyes-of-the-rune-keeper"}, id) || !is24 && strings.HasPrefix(id, "pact-") {
				continue
			}
			if characterHas([]string{"agonizing-blast", "repelling-blast", "eldritch-spear"}, id) && !characterHas(current.CantripIDs, "eldritch-blast-"+d.Edition) {
				continue
			}
			options = append(options, id)
		}
		add("invocations", totals[level-1]-len(prior("invocations")), options)
		if !is24 && level == 3 {
			add("pact-boon", 1, []string{"blade", "chain", "tome", "talisman"})
		}
		tome := is24 && characterHas(characterPicked(d, "invocations", level), "pact-of-the-tome") || !is24 && characterHas(characterPicked(d, "pact-boon", level), "tome")
		if tome && (is24 || level == 3) {
			cantrips, rituals := []string{}, []string{}
			alreadyPrepared := characterPreparedOutsideTome(d, level)
			for _, spell := range characterRules.Spells {
				if !characterHas(spell.Editions, d.Edition) || len(spell.Classes) == 0 || len(spell.SubclassOnly) > 0 || is24 && characterHas(alreadyPrepared, spell.ID) {
					continue
				}
				if spell.Level == 0 {
					cantrips = append(cantrips, spell.ID)
				}
				if spell.Level == 1 && spell.Ritual {
					rituals = append(rituals, spell.ID)
				}
			}
			add("tome-cantrips", 3, cantrips)
			if is24 {
				add("tome-rituals", 2, rituals)
			}
		}
		if characterInLevels(level, 11, 13, 15, 17) {
			circle := (level + 1) / 2
			options := characterSpellOptions(d, "warlock", circle)
			if !is24 && circle == 9 && characterSelectedSubclass(d, level) == "genie" {
				options = append(options, "wish-2014")
			}
			add("mystic-arcanum-"+strconv.Itoa(circle), 1, options)
		}
	}
	terrain := strings.Fields("arctic coast desert forest grassland mountain swamp underdark")
	if c == "ranger" && !is24 {
		if characterInLevels(level, 1, 6, 14) {
			add("favored-enemy", 1, characterExcept(strings.Fields("aberrations beasts celestials constructs dragons elementals fey fiends giants monstrosities oozes plants undead"), prior("favored-enemy")))
		}
		if characterInLevels(level, 1, 6, 10) {
			add("favored-terrain", 1, characterExcept(terrain, prior("favored-terrain")))
		}
	}
	if c == "ranger" && characterSelectedSubclass(d, level) == "hunter" && level == 3 {
		options := []string{"colossus-slayer", "horde-breaker"}
		if !is24 {
			options = append(options, "giant-killer")
		}
		add("hunter-prey", 1, options)
	}
	if c == "druid" && !is24 && level == 3 && characterSelectedSubclass(d, level) == "land" {
		add("land-terrain", 1, terrain)
	}

	if c == "wizard" && ((!is24 && level == 2) || (is24 && level == 3)) && characterSelectedSubclass(d, level) == "illusion" {
		options := []string{}
		known := characterHas(d.Levels[level-2].CantripIDs, "minor-illusion-"+d.Edition)
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && spell.Level == 0 && characterHas(spell.Classes, "wizard") && ((!known && spell.ID == "minor-illusion-"+d.Edition) || (known && !characterHas(current.CantripIDs, spell.ID))) {
				options = append(options, spell.ID)
			}
		}
		add("illusion-cantrip", 1, options)
	}
	if c == "wizard" && is24 && (characterSelectedSubclass(d, level) == "evocation" || characterSelectedSubclassData(d, level).SavantSchool != "") && characterInLevels(level, 3, 5, 7, 9, 11, 13, 15, 17) {
		count := 1
		if level == 3 {
			count = 2
		}
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && characterHas(spell.Classes, "wizard") && spell.School == func() string {
				if school := characterSelectedSubclassData(d, level).SavantSchool; school != "" {
					return school
				}
				return "Воплощение"
			}() && spell.Level > 0 && spell.Level <= (level+1)/2 && !characterHas(current.SpellIDs, spell.ID) && !characterHas(prior("evocation-savant"), spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("evocation-savant", count, options)
	}
	if c == "bard" && !is24 && (characterInLevels(level, 10, 14, 18) || level == 6 && characterSelectedSubclass(d, level) == "lore") {
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && spell.Level <= (level+1)/2 && !characterHas(prior("magical-secrets"), spell.ID) && !characterHas(current.SpellIDs, spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("magical-secrets", 2, options)
	}
	if c == "bard" && is24 && level == 6 && characterSelectedSubclass(d, level) == "lore" {
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && spell.Level <= 3 && (characterHas(spell.Classes, "cleric") || characterHas(spell.Classes, "druid") || characterHas(spell.Classes, "wizard")) && !characterHas(current.SpellIDs, spell.ID) && !characterHas(current.CantripIDs, spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("magical-discoveries", 2, options)
	}
	if c == "ranger" && characterSelectedSubclass(d, level) == "hunter" && (level == 7 || !is24 && characterInLevels(level, 11, 15)) {
		options := []string{"escape-the-horde", "multiattack-defense"}
		if !is24 {
			options = append(options, "steel-will")
		}
		if level == 11 {
			options = []string{"volley", "whirlwind"}
		}
		if level == 15 {
			options = []string{"evasion", "stand-against-the-tide", "uncanny-dodge"}
		}
		add("hunter-"+strconv.Itoa(level), 1, options)
	}
	if is24 && c == "cleric" && level == 7 {
		add("blessed-strikes", 1, []string{"divine-strike", "potent-spellcasting"})
	}
	if is24 && c == "druid" && level == 7 {
		add("elemental-fury", 1, []string{"primal-strike", "potent-spellcasting"})
	}
	if is24 && c == "druid" && level == 3 && characterSelectedSubclass(d, level) == "land" {
		add("land-terrain", 1, []string{"arid", "polar", "temperate", "tropical"})
	}
	if !is24 && c == "druid" && level == 2 && characterSelectedSubclass(d, level) == "land" {
		add("land-cantrip", 1, characterExcept(characterSpellOptions(d, "druid", 0), current.CantripIDs))
	}
	if is24 && characterIsDraconic(d, level) && level == 6 {
		add("elemental-affinity", 1, strings.Fields("acid cold fire lightning poison"))
	}
	if c == "wizard" && level == 18 {
		book := append(append([]string{}, current.SpellIDs...), characterWizardBookBonusSpells(d, level)...)
		for _, circle := range []int{1, 2} {
			options := []string{}
			for _, spell := range characterRules.Spells {
				if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && characterHas(book, spell.ID) && spell.Level == circle && (!is24 || spell.CastingTime == "Action") {
					options = append(options, spell.ID)
				}
			}
			add("spell-mastery-"+strconv.Itoa(circle), 1, options)
		}
	}
	if c == "wizard" && level == 20 {
		book := append(append([]string{}, current.SpellIDs...), characterWizardBookBonusSpells(d, level)...)
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && (len(spell.SubclassOnly) == 0 || d.ClassID == "wizard" && characterHas(spell.SubclassOnly, characterSelectedSubclass(d, 20))) && characterHas(book, spell.ID) && spell.Level == 3 {
				options = append(options, spell.ID)
			}
		}
		add("signature-spells", 2, options)
	}
	return result
}
func validateCharacterFeatureChoices(d characterDraft, level int) error {
	archerSkills := append(append([]string{}, d.Levels[level-1].FeatureChoices["archer-arcana"]...), d.Levels[level-1].FeatureChoices["archer-nature"]...)
	if !characterUnique(archerSkills) {
		return fmt.Errorf("два владения лучника должны быть разными")
	}

	for _, pool := range characterSelectedSubclassData(d, level).ChoicePools {
		if len(pool.Counts) > 0 && level == pool.Counts[0][0] {
			after := d.Levels[level-1].FeatureChoices[pool.ID]
			if len(characterExcept(pool.InitialRequired, after)) > 0 {
				return fmt.Errorf("не выполнены начальные требования: %s", pool.Name)
			}
			for _, group := range pool.InitialGroups {
				count := 0
				for _, id := range after {
					if characterHas(group.IDs, id) {
						count++
					}
				}
				if count != group.Count {
					return fmt.Errorf("не выполнены начальные группы: %s", pool.Name)
				}
			}
		}
		if level < 2 {
			continue
		}
		var mode string
		var levels []int
		json.Unmarshal(pool.ReplaceAt, &mode)
		json.Unmarshal(pool.ReplaceAt, &levels)
		allowed := 0
		if mode == "level" || characterInLevels(level, levels...) {
			allowed = 1
		}
		if mode == "recreate" {
			allowed = len(d.Levels[level-2].FeatureChoices[pool.ID])
		}
		if len(characterExcept(d.Levels[level-2].FeatureChoices[pool.ID], d.Levels[level-1].FeatureChoices[pool.ID])) > allowed {
			return fmt.Errorf("недопустимая замена: %s", pool.Name)
		}
	}

	requirements := characterFeatureRequirements(d, level)
	if d.ClassID == "artificer" && d.Edition == "2024" && level > 1 {
		previous, current := d.Levels[level-2].FeatureChoices, d.Levels[level-1].FeatureChoices
		before := append(append([]string{}, previous["artificer-plans"]...), previous["artificer-armor-plan"]...)
		after := append(append([]string{}, current["artificer-plans"]...), current["artificer-armor-plan"]...)
		if len(characterExcept(before, after)) > 1 {
			return fmt.Errorf("за уровень можно заменить одну схему, включая дополнительную схему Бронника")
		}
	}
	choices := d.Levels[level-1].FeatureChoices
	if spec := characterSelectedSubclassData(d, level).ReplaceableSpells; spec != nil {
		changes := 0
		selected := []string{}
		for index, entry := range spec.Entries {
			if entry.Level > level {
				continue
			}
			key := fmt.Sprintf("origin-spell-%d", index)
			before := []string{entry.ID + "-" + d.Edition}
			if level > 1 && len(d.Levels[level-2].FeatureChoices[key]) > 0 {
				before = d.Levels[level-2].FeatureChoices[key]
			}
			changes += len(characterExcept(choices[key], before))
			selected = append(selected, choices[key]...)
		}
		if changes > 1 {
			return fmt.Errorf("при повышении можно заменить только одно заклинание происхождения")
		}
		if !characterUnique(selected) {
			return fmt.Errorf("заклинания происхождения должны различаться")
		}
		for _, id := range selected {
			if characterHas(d.Levels[level-1].SpellIDs, id) || characterHas(d.Levels[level-1].CantripIDs, id) {
				return fmt.Errorf("заклинание происхождения не занимает обычный выбор")
			}
		}
	}
	if d.Edition == "2024" && d.ClassID == "cleric" && characterSelectedSubclass(d, level) == "arcana" && level > 3 {
		previous := d.Levels[level-2].FeatureChoices
		if len(characterExcept(choices["domain-cantrips"], previous["domain-cantrips"])) > 1 {
			return fmt.Errorf("при повышении можно заменить только один заговор домена")
		}
		if level > 17 {
			count := 0
			for _, circle := range []int{6, 7, 8, 9} {
				key := fmt.Sprintf("domain-mastery-%d", circle)
				count += len(characterExcept(choices[key], previous[key]))
			}
			if count > 1 {
				return fmt.Errorf("при повышении можно заменить только одно заклинание Магической искусности")
			}
		}
	}
	for key, values := range choices {
		if _, ok := requirements[key]; !ok && len(values) > 0 {
			return fmt.Errorf("выбор %s недоступен на этом уровне", key)
		}
	}
	for key, rule := range requirements {
		values := choices[key]
		if (!rule.optional && len(values) != rule.count) || len(values) > rule.count || !characterUnique(values) {
			return fmt.Errorf("%s: выберите %d разных вариантов", key, rule.count)
		}
		for _, id := range values {
			if !characterHas(rule.options, id) {
				return fmt.Errorf("%s: выбран недоступный вариант %s", key, id)
			}
		}
	}
	return nil
}

func characterWizardPreviouslyKnownBonus(d characterDraft, level int, id string) bool {
	if d.ClassID == "wizard" && characterHas(characterWizardSubclassGrants(d, level), id) {
		for _, step := range d.Levels {
			if step.Level < level && characterHas(step.SpellIDs, id) {
				return true
			}
		}
	}
	if d.ClassID != "wizard" {
		return false
	}
	for _, entry := range characterSelectedSubclassData(d, level).BookSpells {
		if entry.Level > level || entry.ID+"-"+d.Edition != id {
			continue
		}
		for _, step := range d.Levels {
			if step.Level < entry.Level && characterHas(step.SpellIDs, id) {
				return true
			}
		}
	}
	return false
}
func characterWizardBookBonusSpells(d characterDraft, level int) []string {
	result := append([]string{}, characterPicked(d, "evocation-savant", level)...)
	for _, entry := range characterSelectedSubclassData(d, level).BookSpells {
		id := entry.ID + "-" + d.Edition
		if entry.Level <= level && !characterWizardPreviouslyKnownBonus(d, level, id) {
			result = append(result, id)
		}
	}
	return result
}

func characterWizardSubclassGrants(d characterDraft, level int) []string {
	result := []string{}
	if d.ClassID != "wizard" {
		return result
	}
	for _, raw := range characterSelectedSubclassData(d, level).Grants {
		var pair []json.RawMessage
		if json.Unmarshal(raw, &pair) != nil || len(pair) != 2 {
			continue
		}
		var at int
		var ids []string
		if json.Unmarshal(pair[0], &at) != nil || json.Unmarshal(pair[1], &ids) != nil || at > level {
			continue
		}
		for _, id := range ids {
			result = append(result, id+"-"+d.Edition)
		}
	}
	return result
}

func characterThirdCasterSpells(d characterDraft, level int) []string {
	result := []string{}
	if level < 1 || level > len(d.Levels) {
		return result
	}
	for key, ids := range d.Levels[level-1].FeatureChoices {
		if strings.HasPrefix(key, "third-caster-free-") {
			result = append(result, ids...)
		}
	}
	return result
}

func characterConditionalSpells(d characterDraft, level int, expanded bool, all bool) []string {
	result := []string{}
	for _, spec := range characterSelectedSubclassData(d, level).ConditionalSpells {
		if spec.Expanded != expanded || !all && !characterHas(characterPicked(d, spec.ChoiceID, level), spec.OptionID) {
			continue
		}
		for _, raw := range spec.Entries {
			var pair []json.RawMessage
			var at int
			var ids []string
			if json.Unmarshal(raw, &pair) != nil || len(pair) != 2 || json.Unmarshal(pair[0], &at) != nil || json.Unmarshal(pair[1], &ids) != nil || at > level {
				continue
			}
			for _, id := range ids {
				result = append(result, id+"-"+d.Edition)
			}
		}
	}
	return result
}
