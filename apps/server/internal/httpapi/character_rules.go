package httpapi

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// The generated snapshot comes from the same edition-specific SRD catalogue
// and progression tables as the browser. It is embedded in the server binary.
//
//go:embed character_catalog.json
var characterCatalogJSON []byte

type characterCatalogOption struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Editions    []string `json:"editions"`
}
type characterClass struct {
	characterCatalogOption
	HitDie       int      `json:"hitDie"`
	SavingThrows []string `json:"savingThrows"`
	SkillCount   int      `json:"skillCount"`
	SkillIDs     []string `json:"skillIds"`
	SpellAbility string   `json:"spellAbility"`
	Caster       string   `json:"caster"`
	Subclasses   []struct {
		characterCatalogOption
		Level2014 int `json:"level2014"`
	} `json:"subclasses"`
}
type characterSpecies struct {
	characterCatalogOption
	Speed               int            `json:"speed"`
	Bonuses2014         map[string]int `json:"bonuses2014"`
	FlexibleBonuses2014 int            `json:"flexibleBonuses2014"`
	Traits              []string       `json:"traits"`
}
type characterBackground struct {
	characterCatalogOption
	SkillIDs      []string `json:"skillIds"`
	Abilities2024 []string `json:"abilities2024"`
	FeatID        string   `json:"featId"`
}
type characterFeat struct {
	characterCatalogOption
	Category string   `json:"category"`
	MinLevel int      `json:"minLevel"`
	Ability  []string `json:"ability"`
}
type characterSpell struct {
	characterCatalogOption
	Level       int      `json:"level"`
	Classes     []string `json:"classes"`
	Classes2024 []string `json:"classes2024"`
	School      string   `json:"school"`
	CastingTime string   `json:"castingTime"`
}
type characterSkill struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Ability string `json:"ability"`
}
type characterProgressionLevel struct {
	Level             int      `json:"level"`
	SubclassRequired  bool     `json:"subclassRequired"`
	ASIAvailable      bool     `json:"asiAvailable"`
	EpicBoonAvailable bool     `json:"epicBoonAvailable"`
	SpellCount        int      `json:"spellCount"`
	CantripCount      int      `json:"cantripCount"`
	PreparedCount     int      `json:"preparedCount"`
	PrepareFormula    string   `json:"prepareFormula"`
	SpellMode         string   `json:"spellMode"`
	SpellSlots        []int    `json:"spellSlots"`
	PactSlots         int      `json:"pactSlots"`
	PactSlotLevel     int      `json:"pactSlotLevel"`
	MaxSpellLevel     int      `json:"maxSpellLevel"`
	SpellIDs          []string `json:"spellIds"`
	CantripIDs        []string `json:"cantripIds"`
}
type characterCatalogue struct {
	Classes     []characterClass      `json:"classes"`
	Species     []characterSpecies    `json:"species"`
	Backgrounds []characterBackground `json:"backgrounds"`
	Feats       []characterFeat       `json:"feats"`
	Spells      []characterSpell      `json:"spells"`
	Skills      []characterSkill      `json:"skills"`
	Progression []struct {
		Edition string                      `json:"edition"`
		ClassID string                      `json:"classId"`
		Levels  []characterProgressionLevel `json:"levels"`
	} `json:"progression"`
	ValidationFixtures []struct {
		Name  string         `json:"name"`
		Draft characterDraft `json:"draft"`
		Valid bool           `json:"valid"`
		Stats characterStats `json:"stats"`
	} `json:"validationFixtures"`
}

var characterRules = func() characterCatalogue {
	var catalog characterCatalogue
	if err := json.Unmarshal(characterCatalogJSON, &catalog); err != nil {
		panic("invalid embedded character catalogue: " + err.Error())
	}
	return catalog
}()
var characterAbilities = []string{"str", "dex", "con", "int", "wis", "cha"}
var characterAbilityNames = map[string]string{"str": "Сила", "dex": "Ловкость", "con": "Телосложение", "int": "Интеллект", "wis": "Мудрость", "cha": "Харизма"}

type characterSavingThrow struct {
	Ability    string `json:"ability"`
	Name       string `json:"name"`
	Bonus      int    `json:"bonus"`
	Proficient bool   `json:"proficient"`
}
type characterSkillBonus struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Ability    string `json:"ability"`
	Bonus      int    `json:"bonus"`
	Proficient bool   `json:"proficient"`
}

type characterStats struct {
	Level             int                    `json:"level"`
	ClassName         string                 `json:"className"`
	SpeciesName       string                 `json:"speciesName"`
	BackgroundName    string                 `json:"backgroundName"`
	Abilities         map[string]int         `json:"abilities"`
	Modifiers         map[string]int         `json:"modifiers"`
	ProficiencyBonus  int                    `json:"proficiencyBonus"`
	MaxHP             int                    `json:"maxHp"`
	ArmorClass        int                    `json:"armorClass"`
	Initiative        int                    `json:"initiative"`
	Speed             int                    `json:"speed"`
	PassivePerception int                    `json:"passivePerception"`
	SpellSaveDC       *int                   `json:"spellSaveDc"`
	SpellAttackBonus  *int                   `json:"spellAttackBonus"`
	SpellSlots        []int                  `json:"spellSlots"`
	PactSlots         int                    `json:"pactSlots"`
	PactSlotLevel     int                    `json:"pactSlotLevel"`
	HitDice           string                 `json:"hitDice"`
	SavingThrows      []characterSavingThrow `json:"savingThrows"`
	Skills            []characterSkillBonus  `json:"skills"`
}

func characterHas(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}
func characterUnique(values []string) bool {
	seen := map[string]bool{}
	for _, v := range values {
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}
func characterModifier(score int) int { return int(math.Floor(float64(score-10) / 2)) }
func characterMapSum(values map[string]int) (int, error) {
	sum := 0
	for k, v := range values {
		if !characterHas(characterAbilities, k) || v < 0 || v > 2 {
			return 0, fmt.Errorf("недопустимое повышение характеристики")
		}
		sum += v
	}
	return sum, nil
}
func characterCatalogueSelections(draft characterDraft) (characterClass, characterSpecies, characterBackground, error) {
	var class characterClass
	for _, v := range characterRules.Classes {
		if v.ID == draft.ClassID && characterHas(v.Editions, draft.Edition) {
			class = v
			break
		}
	}
	var species characterSpecies
	for _, v := range characterRules.Species {
		if v.ID == draft.SpeciesID && characterHas(v.Editions, draft.Edition) {
			species = v
			break
		}
	}
	var background characterBackground
	for _, v := range characterRules.Backgrounds {
		if v.ID == draft.BackgroundID && characterHas(v.Editions, draft.Edition) {
			background = v
			break
		}
	}
	if class.ID == "" || species.ID == "" || background.ID == "" {
		return class, species, background, fmt.Errorf("класс, вид и предыстория должны принадлежать выбранной редакции и каталогу SRD")
	}
	return class, species, background, nil
}
func validateCharacterAbilities(d characterDraft, species characterSpecies, background characterBackground) (map[string]int, error) {
	if len(d.Abilities) != 6 {
		return nil, fmt.Errorf("задайте все шесть характеристик")
	}
	values := []int{}
	points := 0
	cost := map[int]int{8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}
	for _, ability := range characterAbilities {
		v, ok := d.Abilities[ability]
		if !ok || v < 8 || v > 15 {
			return nil, fmt.Errorf("базовые характеристики должны быть от 8 до 15")
		}
		values = append(values, v)
		points += cost[v]
	}
	switch d.AbilityMethod {
	case "standard":
		sort.Ints(values)
		expected := []int{8, 10, 12, 13, 14, 15}
		for i, v := range values {
			if v != expected[i] {
				return nil, fmt.Errorf("используйте стандартный набор 15, 14, 13, 12, 10, 8")
			}
		}
	case "point-buy":
		if points > 27 {
			return nil, fmt.Errorf("на характеристики доступно 27 очков")
		}
	default:
		return nil, fmt.Errorf("неизвестный способ выбора характеристик")
	}
	sum, err := characterMapSum(d.AbilityBonuses)
	if err != nil {
		return nil, err
	}
	if d.Edition == "2024" {
		if sum != 3 {
			return nil, fmt.Errorf("предыстория даёт +2/+1 либо +1/+1/+1")
		}
		for ability, v := range d.AbilityBonuses {
			if v > 0 && !characterHas(background.Abilities2024, ability) {
				return nil, fmt.Errorf("предыстория не повышает выбранную характеристику")
			}
		}
	} else {
		extra := 0
		for _, ability := range characterAbilities {
			v := d.AbilityBonuses[ability]
			fixed := species.Bonuses2014[ability]
			if v < fixed {
				return nil, fmt.Errorf("повышения должны соответствовать виду персонажа")
			}
			difference := v - fixed
			if difference > 0 && (fixed > 0 || difference > 1) {
				return nil, fmt.Errorf("гибкое повышение вида: +1 к разным характеристикам")
			}
			extra += difference
		}
		if extra != species.FlexibleBonuses2014 {
			return nil, fmt.Errorf("повышения должны соответствовать виду персонажа")
		}
	}
	result := map[string]int{}
	for _, ability := range characterAbilities {
		result[ability] = d.Abilities[ability] + d.AbilityBonuses[ability]
	}
	return result, nil
}
func validateAndDeriveCharacter(d characterDraft) (characterStats, error) {
	var empty characterStats
	if d.Edition != "2014" && d.Edition != "2024" {
		return empty, fmt.Errorf("выберите редакцию 2014 или 2024")
	}
	if d.TargetLevel < 1 || d.TargetLevel > 20 {
		return empty, fmt.Errorf("уровень должен быть от 1 до 20")
	}
	if strings.TrimSpace(d.Name) == "" || strings.TrimSpace(d.PlayerName) == "" || utf8.RuneCountInString(d.Name) > 120 || utf8.RuneCountInString(d.PlayerName) > 120 || utf8.RuneCountInString(d.Notes) > 6000 {
		return empty, fmt.Errorf("укажите имя до 120 символов; заметки — до 6000")
	}
	class, species, background, err := characterCatalogueSelections(d)
	if err != nil {
		return empty, err
	}
	abilities, err := validateCharacterAbilities(d, species, background)
	if err != nil {
		return empty, err
	}
	if len(d.SkillIDs) != class.SkillCount || !characterUnique(d.SkillIDs) {
		return empty, fmt.Errorf("выберите %d разных навыков класса", class.SkillCount)
	}
	for _, id := range d.SkillIDs {
		if !characterHas(class.SkillIDs, id) || characterHas(background.SkillIDs, id) {
			return empty, fmt.Errorf("навык недоступен классу или уже дан предысторией")
		}
	}
	if len(d.Levels) != d.TargetLevel {
		return empty, fmt.Errorf("заполните каждый уровень последовательно")
	}
	var progression []characterProgressionLevel
	for _, p := range characterRules.Progression {
		if p.Edition == d.Edition && p.ClassID == d.ClassID {
			progression = p.Levels
			break
		}
	}
	if len(progression) < d.TargetLevel {
		return empty, fmt.Errorf("нет правил для выбранного класса и уровня")
	}
	seenFeats := map[string]bool{}
	if d.Edition == "2024" && background.FeatID != "" {
		seenFeats[background.FeatID] = true
	}
	if d.Edition == "2024" {
		for _, id := range d.Levels[0].FeatureChoices["human-feat"] {
			seenFeats[id] = true
		}
	}
	for i, choice := range d.Levels {
		if choice.Level != i+1 {
			return empty, fmt.Errorf("уровни должны идти по порядку без пропусков")
		}
		options := progression[i]
		if err := validateCharacterLevel(d, class, choice, options, abilities, seenFeats, i); err != nil {
			return empty, fmt.Errorf("уровень %d: %w", i+1, err)
		}
		if err := validateCharacterFeatureChoices(d, i+1); err != nil {
			return empty, fmt.Errorf("уровень %d: %w", i+1, err)
		}
	}
	return deriveCharacterCore(d, class, species, background, abilities, progression[d.TargetLevel-1]), nil
}
func validateCharacterLevel(d characterDraft, class characterClass, choice characterLevelChoice, p characterProgressionLevel, abilities map[string]int, seenFeats map[string]bool, index int) error {
	if p.SubclassRequired {
		found := false
		for _, sub := range class.Subclasses {
			if sub.ID == choice.SubclassID && characterHas(sub.Editions, d.Edition) {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("выберите подкласс выбранной редакции")
		}
	} else if choice.SubclassID != "" {
		previousSubclass := ""
		for _, prior := range d.Levels[:index] {
			if prior.SubclassID != "" {
				previousSubclass = prior.SubclassID
			}
		}
		if previousSubclass == "" || previousSubclass != choice.SubclassID {
			return fmt.Errorf("подкласс выбирается только на положенном уровне и не меняется позже")
		}
	}
	asiSum, err := characterMapSum(choice.ASI)
	if err != nil {
		return err
	}
	if choice.FeatID != "" {
		var feat characterFeat
		for _, v := range characterRules.Feats {
			if v.ID == choice.FeatID && characterHas(v.Editions, d.Edition) {
				feat = v
				break
			}
		}
		if feat.ID == "" || seenFeats[feat.ID] || choice.Level < feat.MinLevel || (!p.ASIAvailable && !p.EpicBoonAvailable) || (feat.Category == "epic" && !p.EpicBoonAvailable) {
			return fmt.Errorf("эта черта недоступна на данном уровне или уже выбрана")
		}
		if feat.ID == "grappler" && (abilities["str"] < 13 && (d.Edition == "2014" || abilities["dex"] < 13)) {
			return fmt.Errorf("для черты Борец требуется Сила 13; в 2024 также подходит Ловкость 13")
		}
		if feat.ID == "boon-spell-recall" && class.Caster != "full" && class.Caster != "half" {
			return fmt.Errorf("эпический дар требует особенности Использование заклинаний")
		}
		seenFeats[feat.ID] = true
		if len(feat.Ability) > 0 && d.Edition == "2024" {
			if asiSum != 1 {
				return fmt.Errorf("черта повышает одну характеристику на 1")
			}
			for a, v := range choice.ASI {
				if v > 0 && !characterHas(feat.Ability, a) {
					return fmt.Errorf("выберите допустимую характеристику черты")
				}
			}
		} else if asiSum != 0 {
			return fmt.Errorf("черта не даёт это повышение характеристик")
		}
	} else if p.ASIAvailable || p.EpicBoonAvailable {
		if asiSum != 2 {
			return fmt.Errorf("выберите черту либо повышение характеристик на 2")
		}
	} else if asiSum != 0 {
		return fmt.Errorf("повышение характеристик недоступно на этом уровне")
	}
	for ability, v := range choice.ASI {
		cap := 20
		if strings.HasPrefix(choice.FeatID, "boon-") && d.Edition == "2024" {
			cap = 30
		}
		if abilities[ability]+v > cap {
			return fmt.Errorf("повышение не может дать характеристику выше %d", cap)
		}
		abilities[ability] += v
	}
	expectedSpellCount := p.SpellCount
	preparedCount := p.PreparedCount
	switch p.PrepareFormula {
	case "class-level+modifier":
		preparedCount = max(1, choice.Level+characterModifier(abilities[class.SpellAbility]))
	case "half-level+modifier":
		preparedCount = max(1, choice.Level/2+characterModifier(abilities[class.SpellAbility]))
		if choice.Level == 1 && d.Edition == "2014" {
			preparedCount = 0
		}
	}
	if p.SpellMode == "prepared" {
		expectedSpellCount = preparedCount
	}
	if len(choice.SpellIDs) != expectedSpellCount || !characterUnique(choice.SpellIDs) {
		return fmt.Errorf("выберите %d разных заклинаний", expectedSpellCount)
	}
	if len(choice.CantripIDs) != p.CantripCount || !characterUnique(choice.CantripIDs) {
		return fmt.Errorf("выберите %d разных заговоров", p.CantripCount)
	}
	for _, id := range choice.SpellIDs {
		if !characterHas(p.SpellIDs, id) {
			return fmt.Errorf("заклинание недоступно классу, уровню или редакции")
		}
		if characterHas(characterPicked(d, "evocation-savant", choice.Level-1), id) {
			return fmt.Errorf("заклинание уже дано особенностью Мастер воплощения")
		}
		if characterHas(characterLandGrantedSpells(d, choice.Level), id) {
			return fmt.Errorf("заклинание уже подготовлено особенностью Круг земли")
		}
	}
	for _, id := range choice.CantripIDs {
		if !characterHas(p.CantripIDs, id) {
			return fmt.Errorf("заговор недоступен классу или редакции")
		}
	}
	if p.SpellMode == "spellbook" {
		alwaysPrepared := characterWizardAlwaysPrepared(d, choice.Level)
		ordinaryBook := map[string]bool{}
		for _, id := range append(append([]string{}, choice.SpellIDs...), characterPicked(d, "evocation-savant", choice.Level)...) {
			if !characterHas(alwaysPrepared, id) {
				ordinaryBook[id] = true
			}
		}
		preparedCount = min(preparedCount, len(ordinaryBook))
		if len(choice.PreparedSpellIDs) != preparedCount || !characterUnique(choice.PreparedSpellIDs) {
			return fmt.Errorf("подготовьте %d заклинаний из книги", preparedCount)
		}
		for _, id := range choice.PreparedSpellIDs {
			if !ordinaryBook[id] {
				return fmt.Errorf("выберите заклинание из книги; всегда подготовленные особенности не занимают место подготовки")
			}
		}
	} else if len(choice.PreparedSpellIDs) > 0 {
		return fmt.Errorf("подготовка из книги недоступна этому классу")
	}
	if index > 0 {
		previous := d.Levels[index-1]
		removed := 0
		for _, id := range previous.SpellIDs {
			if !characterHas(choice.SpellIDs, id) && characterHas(p.SpellIDs, id) && !characterHas(characterLandGrantedSpells(d, choice.Level), id) {
				removed++
			}
		}
		if (p.SpellMode == "spellbook" && removed > 0) || (characterHas([]string{"bard", "sorcerer", "warlock", "ranger"}, d.ClassID) && removed > 1) {
			return fmt.Errorf("нельзя заменить столько заклинаний при повышении уровня")
		}
		removedCantrips := 0
		for _, id := range previous.CantripIDs {
			if !characterHas(choice.CantripIDs, id) {
				removedCantrips++
			}
		}
		cantripReplacementLimit := 0
		if d.Edition == "2024" {
			cantripReplacementLimit = 1
			if d.ClassID == "wizard" {
				cantripReplacementLimit = 100
			}
		}
		if removedCantrips > cantripReplacementLimit {
			return fmt.Errorf("нельзя заменить столько заговоров при повышении уровня")
		}
	}
	return nil
}
func deriveCharacterCore(d characterDraft, class characterClass, species characterSpecies, background characterBackground, abilities map[string]int, p characterProgressionLevel) characterStats {
	if d.TargetLevel == 20 && d.ClassID == "barbarian" {
		abilities["str"] += 4
		abilities["con"] += 4
	}
	if d.TargetLevel == 20 && d.ClassID == "monk" && d.Edition == "2024" {
		abilities["dex"] += 4
		abilities["wis"] += 4
	}
	modifiers := map[string]int{}
	for _, a := range characterAbilities {
		modifiers[a] = characterModifier(abilities[a])
	}
	proficiency := 2 + (d.TargetLevel-1)/4
	hp := max(1, class.HitDie+modifiers["con"]) + (d.TargetLevel-1)*max(1, class.HitDie/2+1+modifiers["con"])
	armor := 10 + modifiers["dex"]
	if d.ClassID == "barbarian" {
		armor = max(armor, 10+modifiers["dex"]+modifiers["con"])
	}
	if d.ClassID == "monk" {
		armor = max(armor, 10+modifiers["dex"]+modifiers["wis"])
	}
	if d.ClassID == "sorcerer" && (d.Edition == "2014" || d.TargetLevel >= 3) {
		hp += d.TargetLevel
		if d.Edition == "2014" {
			armor = max(armor, 13+modifiers["dex"])
		} else {
			armor = max(armor, 10+modifiers["dex"]+modifiers["cha"])
		}
	}
	if strings.Contains(species.ID, "hill-dwarf") || (d.Edition == "2024" && species.ID == "dwarf") {
		hp += d.TargetLevel
	}
	feats := []string{}
	if d.Edition == "2024" {
		feats = append(feats, background.FeatID)
	}
	for _, choice := range d.Levels {
		feats = append(feats, choice.FeatID)
		feats = append(feats, choice.FeatureChoices["human-feat"]...)
	}
	if characterHas(feats, "tough") || characterHas(feats, "tough-2014") || characterHas(feats, "tough-2024") {
		hp += 2 * d.TargetLevel
	}
	speed := species.Speed
	if d.Edition == "2024" && (species.ID == "lightfoot-halfling" || species.ID == "rock-gnome") {
		speed = 30
	}
	if d.ClassID == "barbarian" && d.TargetLevel >= 5 {
		speed += 10
	}
	if d.ClassID == "monk" && d.TargetLevel >= 2 {
		speed += 10 + ((d.TargetLevel-2)/4)*5
	}
	if d.Edition == "2024" && d.ClassID == "ranger" && d.TargetLevel >= 6 {
		speed += 10
	}
	passive := 10 + modifiers["wis"]
	if characterHas(characterSkillProficiencies(d, d.TargetLevel, ""), "perception") {
		passive += proficiency
	} else if d.ClassID == "bard" && d.TargetLevel >= 2 {
		passive += proficiency / 2
	}
	if characterHas(characterPicked(d, "expertise", d.TargetLevel), "perception") {
		passive += proficiency
	}
	stats := characterStats{Level: d.TargetLevel, ClassName: class.Name, SpeciesName: species.Name, BackgroundName: background.Name, Abilities: abilities, Modifiers: modifiers, ProficiencyBonus: proficiency, MaxHP: hp, ArmorClass: armor, Initiative: modifiers["dex"], Speed: speed, PassivePerception: passive, SpellSlots: append([]int{}, p.SpellSlots...), PactSlots: p.PactSlots, PactSlotLevel: p.PactSlotLevel, HitDice: fmt.Sprintf("%dd%d", d.TargetLevel, class.HitDie)}
	if d.Edition == "2024" && characterHas(feats, "alert") {
		stats.Initiative += proficiency
	}
	if d.Edition == "2014" && d.ClassID == "bard" && d.TargetLevel >= 2 {
		stats.Initiative += proficiency / 2
	}
	if d.Edition == "2014" && d.ClassID == "fighter" && d.TargetLevel >= 7 {
		stats.Initiative += (proficiency + 1) / 2
	}
	for _, ability := range characterAbilities {
		proficient := characterHas(class.SavingThrows, ability) || d.ClassID == "monk" && d.TargetLevel >= 14 || d.ClassID == "rogue" && d.TargetLevel >= 15 && (ability == "wis" || d.Edition == "2024" && ability == "cha")
		bonus := modifiers[ability]
		if proficient {
			bonus += proficiency
		}
		if d.ClassID == "paladin" && d.TargetLevel >= 6 {
			bonus += max(1, modifiers["cha"])
		}
		stats.SavingThrows = append(stats.SavingThrows, characterSavingThrow{Ability: ability, Name: characterAbilityNames[ability], Bonus: bonus, Proficient: proficient})
	}
	proficiencies := characterSkillProficiencies(d, d.TargetLevel, "")
	for _, skill := range characterRules.Skills {
		proficient := characterHas(proficiencies, skill.ID)
		bonus := modifiers[skill.Ability]
		if proficient {
			bonus += proficiency
			if characterHas(characterPicked(d, "expertise", d.TargetLevel), skill.ID) {
				bonus += proficiency
			}
		} else if d.ClassID == "bard" && d.TargetLevel >= 2 {
			bonus += proficiency / 2
		} else if d.Edition == "2014" && d.ClassID == "fighter" && d.TargetLevel >= 7 && characterHas([]string{"str", "dex", "con"}, skill.Ability) {
			bonus += (proficiency + 1) / 2
		}
		if d.Edition == "2024" && (characterHas(characterPicked(d, "divine-order", d.TargetLevel), "thaumaturge") && characterHas([]string{"arcana", "religion"}, skill.ID) || characterHas(characterPicked(d, "primal-order", d.TargetLevel), "magician") && characterHas([]string{"arcana", "nature"}, skill.ID)) {
			bonus += max(1, modifiers["wis"])
		}
		stats.Skills = append(stats.Skills, characterSkillBonus{ID: skill.ID, Name: skill.Name, Ability: skill.Ability, Bonus: bonus, Proficient: proficient})
	}
	spellAbility := ""
	if class.SpellAbility != "" && (p.MaxSpellLevel > 0 || p.CantripCount > 0) {
		spellAbility = class.SpellAbility
	}
	if spellAbility == "" && (species.ID == "high-elf" || species.ID == "tiefling" || d.Edition == "2024" && (species.ID == "wood-elf" || species.ID == "rock-gnome")) {
		spellAbility = "int"
		if d.Edition == "2014" && species.ID == "tiefling" {
			spellAbility = "cha"
		}
		if selected := characterPicked(d, "innate-ability", d.TargetLevel); len(selected) > 0 {
			spellAbility = selected[0]
		}
	}
	if spellAbility == "" {
		for _, feat := range characterRules.Feats {
			if strings.HasPrefix(feat.ID, "magic-initiate-") && characterHas(feats, feat.ID) {
				spellAbility = "int"
				if selected := characterPicked(d, feat.ID+"-ability", d.TargetLevel); len(selected) > 0 {
					spellAbility = selected[0]
				}
				break
			}
		}
	}
	if spellAbility != "" {
		attack := proficiency + modifiers[spellAbility]
		dc := 8 + attack
		stats.SpellAttackBonus = &attack
		stats.SpellSaveDC = &dc
	}
	return stats
}
func characterPlayerEntity(sheet characterSheet) knowledgeEntity {
	d := sheet.Draft
	stats := sheet.Stats
	subtitle := fmt.Sprintf("%s · %s · %d уровень · D&D %s", stats.SpeciesName, stats.ClassName, d.TargetLevel, d.Edition)
	score := stats.Abilities
	block := &npcStatBlock{Size: "Средний", CreatureType: "Гуманоид", ArmorClass: strconv.Itoa(stats.ArmorClass), HitPoints: strconv.Itoa(stats.MaxHP), Speed: fmt.Sprintf("%d фт.", stats.Speed), ProficiencyBonus: fmt.Sprintf("+%d", stats.ProficiencyBonus), AbilityScores: abilityScores{STR: score["str"], DEX: score["dex"], CON: score["con"], INT: score["int"], WIS: score["wis"], CHA: score["cha"]}, Traits: []statBlockEntry{}, Actions: []statBlockEntry{}}
	saves := []string{}
	for _, save := range stats.SavingThrows {
		if save.Proficient {
			saves = append(saves, fmt.Sprintf("%s %+d", save.Name, save.Bonus))
		}
	}
	block.SavingThrows = strings.Join(saves, ", ")
	skills := []string{}
	for _, skill := range stats.Skills {
		if skill.Proficient {
			skills = append(skills, fmt.Sprintf("%s %+d", skill.Name, skill.Bonus))
		}
	}
	block.Skills = strings.Join(skills, ", ")
	if stats.SpellSaveDC != nil {
		spells := append([]string{}, d.Levels[len(d.Levels)-1].CantripIDs...)
		ids := d.Levels[len(d.Levels)-1].SpellIDs
		if len(d.Levels[len(d.Levels)-1].PreparedSpellIDs) > 0 {
			ids = d.Levels[len(d.Levels)-1].PreparedSpellIDs
		}
		spells = append(spells, ids...)
		spells = append(spells, characterWizardAlwaysPrepared(d, d.TargetLevel)...)
		for i, id := range spells {
			for _, spell := range characterRules.Spells {
				if spell.ID == id {
					spells[i] = spell.Name
					break
				}
			}
		}
		block.Spellcasting = &spellcastingBlock{Title: "Заклинания", SaveDC: strconv.Itoa(*stats.SpellSaveDC), AttackBonus: fmt.Sprintf("%+d", *stats.SpellAttackBonus), Spells: spells}
	}
	return knowledgeEntity{ID: sheet.PlayerID, Revision: 1, Kind: "player", Title: d.Name, Subtitle: subtitle, Summary: strings.TrimSpace(d.PlayerName + " · " + stats.BackgroundName), Content: d.Notes, Tags: []string{"Лист персонажа", "D&D " + d.Edition, stats.ClassName}, QuickFacts: []quickFact{{Label: "Уровень", Value: strconv.Itoa(d.TargetLevel)}, {Label: "Хиты", Value: strconv.Itoa(stats.MaxHP)}, {Label: "Класс доспеха", Value: strconv.Itoa(stats.ArmorClass)}, {Label: "Игрок", Value: d.PlayerName}}, Related: []relatedEntity{}, Level: d.TargetLevel, StatBlock: block}
}
