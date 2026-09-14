package httpapi

import (
	"fmt"
	"strconv"
	"strings"
)

// Feature selections are validated in addition to the spell and ASI tables.
// A choice only exists at the level and for the origin/class that grants it.
type characterChoiceRequirement struct {
	count   int
	options []string
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
	result := characterPicked(d, "signature-spells", level)
	if d.Edition == "2024" {
		result = append(result, characterPicked(d, "spell-mastery-1", level)...)
		result = append(result, characterPicked(d, "spell-mastery-2", level)...)
	}
	return result
}
func characterSpellOptions(d characterDraft, classID string, spellLevel int) []string {
	result := []string{}
	for _, spell := range characterRules.Spells {
		if spell.Level == spellLevel && characterHas(spell.Editions, d.Edition) && characterHas(spell.Classes, classID) {
			result = append(result, spell.ID)
		}
	}
	return result
}

func characterLandGrantedSpells(d characterDraft, level int) []string {
	if d.ClassID != "druid" {
		return nil
	}
	selected := characterPicked(d, "land-terrain", level)
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
	for _, background := range characterRules.Backgrounds {
		if background.ID == d.BackgroundID {
			result = append(result, background.SkillIDs...)
		}
	}
	for _, key := range []string{"background-skills", "human-skill", "half-elf-skills", "elf-skill", "lore-skills"} {
		if key != exclude {
			result = append(result, characterPicked(d, key, through)...)
		}
	}
	if d.Edition == "2014" && d.SpeciesID == "high-elf" {
		result = append(result, "perception")
	}
	if d.SpeciesID == "half-orc" {
		result = append(result, "intimidation")
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
		if is24 && (d.SpeciesID == "high-elf" || d.SpeciesID == "wood-elf") {
			add("elf-skill", 1, characterExcept([]string{"insight", "perception", "survival"}, characterSkillProficiencies(d, level, "elf-skill")))
		}
		if d.SpeciesID == "high-elf" {
			add("elf-cantrip", 1, characterSpellOptions(d, "wizard", 0))
		}
		if is24 && characterHas([]string{"high-elf", "wood-elf", "rock-gnome", "tiefling"}, d.SpeciesID) {
			add("innate-ability", 1, []string{"int", "wis", "cha"})
		}
		if d.SpeciesID == "dragonborn" || c == "sorcerer" && !is24 {
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
	secondStyle := 10
	if is24 {
		secondStyle = 7
	}
	if c == "fighter" && characterInLevels(level, 1, secondStyle) || (c == "paladin" || c == "ranger") && level == 2 {
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
	if c == "bard" && level == 3 {
		add("lore-skills", 3, characterExcept(allSkills, characterSkillProficiencies(d, level, "lore-skills")))
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
		invocations := strings.Fields("armor-of-shadows eldritch-sight eyes-of-the-rune-keeper mask-of-many-faces misty-visions devils-sight agonizing-blast repelling-blast eldritch-spear pact-of-the-blade pact-of-the-chain one-with-shadows ascendant-step otherworldly-leap visions-of-distant-realms whispers-of-the-grave witch-sight")
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
			add("pact-boon", 1, []string{"blade", "chain"})
		}
		if characterInLevels(level, 11, 13, 15, 17) {
			circle := (level + 1) / 2
			add("mystic-arcanum-"+strconv.Itoa(circle), 1, characterSpellOptions(d, "warlock", circle))
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
	if c == "ranger" && level == 3 {
		options := []string{"colossus-slayer", "horde-breaker"}
		if !is24 {
			options = append(options, "giant-killer")
		}
		add("hunter-prey", 1, options)
	}
	if c == "druid" && !is24 && level == 3 {
		add("land-terrain", 1, terrain[:7])
	}
	if c == "wizard" && is24 && characterInLevels(level, 3, 5, 7, 9, 11, 13, 15, 17) {
		count := 1
		if level == 3 {
			count = 2
		}
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && characterHas(spell.Classes, "wizard") && spell.School == "Воплощение" && spell.Level > 0 && spell.Level <= (level+1)/2 && !characterHas(current.SpellIDs, spell.ID) && !characterHas(prior("evocation-savant"), spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("evocation-savant", count, options)
	}
	if c == "bard" && !is24 && characterInLevels(level, 6, 10, 14, 18) {
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && spell.Level <= (level+1)/2 && !characterHas(prior("magical-secrets"), spell.ID) && !characterHas(current.SpellIDs, spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("magical-secrets", 2, options)
	}
	if c == "bard" && is24 && level == 6 {
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && spell.Level <= 3 && (characterHas(spell.Classes, "cleric") || characterHas(spell.Classes, "druid") || characterHas(spell.Classes, "wizard")) && !characterHas(current.SpellIDs, spell.ID) && !characterHas(current.CantripIDs, spell.ID) {
				options = append(options, spell.ID)
			}
		}
		add("magical-discoveries", 2, options)
	}
	if c == "ranger" && (level == 7 || !is24 && characterInLevels(level, 11, 15)) {
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
	if is24 && c == "druid" && level == 3 {
		add("land-terrain", 1, []string{"arid", "polar", "temperate", "tropical"})
	}
	if !is24 && c == "druid" && level == 2 {
		add("land-cantrip", 1, characterExcept(characterSpellOptions(d, "druid", 0), current.CantripIDs))
	}
	if is24 && c == "sorcerer" && level == 6 {
		add("elemental-affinity", 1, strings.Fields("acid cold fire lightning poison"))
	}
	if c == "wizard" && level == 18 {
		book := append(append([]string{}, current.SpellIDs...), characterPicked(d, "evocation-savant", level)...)
		for _, circle := range []int{1, 2} {
			options := []string{}
			for _, spell := range characterRules.Spells {
				if characterHas(spell.Editions, d.Edition) && characterHas(book, spell.ID) && spell.Level == circle && (!is24 || spell.CastingTime == "Action") {
					options = append(options, spell.ID)
				}
			}
			add("spell-mastery-"+strconv.Itoa(circle), 1, options)
		}
	}
	if c == "wizard" && level == 20 {
		book := append(append([]string{}, current.SpellIDs...), characterPicked(d, "evocation-savant", level)...)
		options := []string{}
		for _, spell := range characterRules.Spells {
			if characterHas(spell.Editions, d.Edition) && characterHas(book, spell.ID) && spell.Level == 3 {
				options = append(options, spell.ID)
			}
		}
		add("signature-spells", 2, options)
	}
	return result
}
func validateCharacterFeatureChoices(d characterDraft, level int) error {
	requirements := characterFeatureRequirements(d, level)
	choices := d.Levels[level-1].FeatureChoices
	for key, values := range choices {
		if _, ok := requirements[key]; !ok && len(values) > 0 {
			return fmt.Errorf("выбор %s недоступен на этом уровне", key)
		}
	}
	for key, rule := range requirements {
		values := choices[key]
		if len(values) != rule.count || !characterUnique(values) {
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
