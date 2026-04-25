package httpapi

type appModule struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
}

type dashboardCard struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Detail string `json:"detail"`
	Tone   string `json:"tone,omitempty"`
}

type quickFact struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Tone  string `json:"tone,omitempty"`
}

type relatedEntity struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Label  string `json:"label"`
	Reason string `json:"reason"`
}

type preparedCombatItem struct {
	EntityID string `json:"entityId"`
	Quantity int    `json:"quantity"`
}

type preparedCombatPlan struct {
	Title string               `json:"title,omitempty"`
	Items []preparedCombatItem `json:"items"`
}

type campaignPreparedCombat struct {
	Title     string               `json:"title,omitempty"`
	PlayerIDs []string             `json:"playerIds"`
	Items     []preparedCombatItem `json:"items"`
}

type heroArt struct {
	URL     string `json:"url,omitempty"`
	Alt     string `json:"alt,omitempty"`
	Caption string `json:"caption,omitempty"`
}

type playlistTrack struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

type galleryImage struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Caption string `json:"caption,omitempty"`
}

type playerFacingCard struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentHTML string `json:"contentHtml,omitempty"`
}

type abilityScores struct {
	STR int `json:"str"`
	DEX int `json:"dex"`
	CON int `json:"con"`
	INT int `json:"int"`
	WIS int `json:"wis"`
	CHA int `json:"cha"`
}

type statBlockEntry struct {
	Name        string `json:"name"`
	Subtitle    string `json:"subtitle,omitempty"`
	ToHit       string `json:"toHit,omitempty"`
	Damage      string `json:"damage,omitempty"`
	SaveDC      string `json:"saveDc,omitempty"`
	Description string `json:"description"`
}

type spellSlotSummary struct {
	Level string `json:"level"`
	Slots string `json:"slots"`
}

type spellcastingBlock struct {
	Title       string             `json:"title"`
	Ability     string             `json:"ability"`
	SaveDC      string             `json:"saveDc"`
	AttackBonus string             `json:"attackBonus"`
	Slots       []spellSlotSummary `json:"slots,omitempty"`
	Spells      []string           `json:"spells"`
	Description string             `json:"description,omitempty"`
}

type monsterLootEntry struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	Quantity string `json:"quantity"`
	Check    string `json:"check"`
	DC       string `json:"dc,omitempty"`
	Details  string `json:"details,omitempty"`
}

type monsterRewardProfile struct {
	Summary string             `json:"summary"`
	Loot    []monsterLootEntry `json:"loot"`
}

type npcStatBlock struct {
	Size                string             `json:"size"`
	CreatureType        string             `json:"creatureType"`
	Alignment           string             `json:"alignment"`
	ArmorClass          string             `json:"armorClass"`
	HitPoints           string             `json:"hitPoints"`
	Speed               string             `json:"speed"`
	ProficiencyBonus    string             `json:"proficiencyBonus,omitempty"`
	Challenge           string             `json:"challenge,omitempty"`
	Senses              string             `json:"senses,omitempty"`
	Languages           string             `json:"languages,omitempty"`
	SavingThrows        string             `json:"savingThrows,omitempty"`
	Skills              string             `json:"skills,omitempty"`
	Resistances         string             `json:"resistances,omitempty"`
	Immunities          string             `json:"immunities,omitempty"`
	ConditionImmunities string             `json:"conditionImmunities,omitempty"`
	AbilityScores       abilityScores      `json:"abilityScores"`
	Traits              []statBlockEntry   `json:"traits"`
	Actions             []statBlockEntry   `json:"actions"`
	BonusActions        []statBlockEntry   `json:"bonusActions,omitempty"`
	Reactions           []statBlockEntry   `json:"reactions,omitempty"`
	Spellcasting        *spellcastingBlock `json:"spellcasting,omitempty"`
}

type knowledgeEntity struct {
	ID            string             `json:"id"`
	Kind          string             `json:"kind"`
	Title         string             `json:"title"`
	Subtitle      string             `json:"subtitle"`
	Summary       string             `json:"summary"`
	Content       string             `json:"content"`
	PlayerContent string             `json:"playerContent,omitempty"`
	PlayerCards   []playerFacingCard `json:"playerCards,omitempty"`
	Tags          []string           `json:"tags"`
	QuickFacts    []quickFact        `json:"quickFacts"`
	Related       []relatedEntity    `json:"related"`
	Art           *heroArt           `json:"art,omitempty"`
	Playlist      []playlistTrack    `json:"playlist,omitempty"`
	Gallery       []galleryImage     `json:"gallery,omitempty"`

	Category       string                `json:"category,omitempty"`
	Region         string                `json:"region,omitempty"`
	Danger         string                `json:"danger,omitempty"`
	ParentID       string                `json:"parentId,omitempty"`
	Role           string                `json:"role,omitempty"`
	Status         string                `json:"status,omitempty"`
	Importance     string                `json:"importance,omitempty"`
	LocationID     string                `json:"locationId,omitempty"`
	StatBlock      *npcStatBlock         `json:"statBlock,omitempty"`
	RewardProfile  *monsterRewardProfile `json:"rewardProfile,omitempty"`
	Urgency        string                `json:"urgency,omitempty"`
	IssuerID       string                `json:"issuerId,omitempty"`
	PreparedCombat *preparedCombatPlan   `json:"preparedCombat,omitempty"`
	Visibility     string                `json:"visibility,omitempty"`
}

type worldEventDialogueBranch struct {
	Title   string   `json:"title"`
	Lines   []string `json:"lines"`
	Outcome string   `json:"outcome,omitempty"`
}

type worldEvent struct {
	ID               string                     `json:"id"`
	Title            string                     `json:"title"`
	Date             string                     `json:"date"`
	Summary          string                     `json:"summary"`
	Type             string                     `json:"type"`
	LocationID       string                     `json:"locationId,omitempty"`
	LocationLabel    string                     `json:"locationLabel,omitempty"`
	SceneText        string                     `json:"sceneText"`
	DialogueBranches []worldEventDialogueBranch `json:"dialogueBranches"`
	Loot             []string                   `json:"loot"`
	Tags             []string                   `json:"tags"`
	Origin           string                     `json:"origin"`
}

type sessionPrepItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Status   string `json:"status"`
	Location string `json:"location"`
	Focus    string `json:"focus"`
}

type combatThresholds struct {
	Easy   int `json:"easy"`
	Medium int `json:"medium"`
	Hard   int `json:"hard"`
	Deadly int `json:"deadly"`
}

type combatEntry struct {
	ID               string        `json:"id"`
	EntityID         string        `json:"entityId"`
	EntityKind       string        `json:"entityKind"`
	Side             string        `json:"side"`
	Title            string        `json:"title"`
	Summary          string        `json:"summary"`
	Role             string        `json:"role"`
	ArmorClass       string        `json:"armorClass"`
	Initiative       int           `json:"initiative"`
	Challenge        string        `json:"challenge,omitempty"`
	Experience       int           `json:"experience"`
	MaxHitPoints     int           `json:"maxHitPoints"`
	CurrentHitPoints int           `json:"currentHitPoints"`
	Defeated         bool          `json:"defeated"`
	StatBlock        *npcStatBlock `json:"statBlock,omitempty"`
}

type activeCombat struct {
	ID                 string           `json:"id"`
	Title              string           `json:"title"`
	PartySize          int              `json:"partySize"`
	Thresholds         combatThresholds `json:"thresholds"`
	Round              int              `json:"round"`
	CurrentTurnEntryID string           `json:"currentTurnEntryId,omitempty"`
	Difficulty         string           `json:"difficulty,omitempty"`
	TargetAdjustedXP   int              `json:"targetAdjustedXp,omitempty"`
	TargetBaseXP       int              `json:"targetBaseXp,omitempty"`
	ActualBaseXP       int              `json:"actualBaseXp"`
	ActualAdjustedXP   int              `json:"actualAdjustedXp"`
	Entries            []combatEntry    `json:"entries"`
}

type lastCombatSummary struct {
	CombatID            string              `json:"combatId"`
	Title               string              `json:"title"`
	Outcome             string              `json:"outcome"`
	DefeatedCount       int                 `json:"defeatedCount"`
	TotalExperience     int                 `json:"totalExperience"`
	ExperiencePerPlayer int                 `json:"experiencePerPlayer"`
	Round               int                 `json:"round,omitempty"`
	Entries             []combatEntry       `json:"entries,omitempty"`
	PlayerRewards       []combatRewardShare `json:"playerRewards,omitempty"`
	FinishedAt          string              `json:"finishedAt,omitempty"`
}

type combatRewardShare struct {
	Title      string `json:"title"`
	Experience int    `json:"experience"`
}

type campaignData struct {
	ID                string                  `json:"id"`
	Title             string                  `json:"title"`
	System            string                  `json:"system"`
	SettingName       string                  `json:"settingName"`
	InWorldDate       string                  `json:"inWorldDate"`
	Summary           string                  `json:"summary"`
	Modules           []appModule             `json:"modules"`
	DashboardCards    []dashboardCard         `json:"dashboardCards"`
	Locations         []knowledgeEntity       `json:"locations"`
	Players           []knowledgeEntity       `json:"players"`
	NPCs              []knowledgeEntity       `json:"npcs"`
	Monsters          []knowledgeEntity       `json:"monsters"`
	Quests            []knowledgeEntity       `json:"quests"`
	Lore              []knowledgeEntity       `json:"lore"`
	Events            []worldEvent            `json:"events"`
	SessionPrep       []sessionPrepItem       `json:"sessionPrep"`
	CombatPlaylist    []playlistTrack         `json:"combatPlaylist"`
	PreparedCombat    *campaignPreparedCombat `json:"preparedCombat,omitempty"`
	ActiveCombat      *activeCombat           `json:"activeCombat,omitempty"`
	LastCombatSummary *lastCombatSummary      `json:"lastCombatSummary,omitempty"`
}

type campaignSummary struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	System      string `json:"system"`
	SettingName string `json:"settingName"`
	InWorldDate string `json:"inWorldDate"`
	Summary     string `json:"summary"`
}

type searchResult struct {
	ID       string   `json:"id"`
	Kind     string   `json:"kind"`
	Title    string   `json:"title"`
	Subtitle string   `json:"subtitle"`
	Summary  string   `json:"summary"`
	Tags     []string `json:"tags"`
}

type storageState struct {
	Campaigns []campaignData `json:"campaigns"`
	UpdatedAt string         `json:"updatedAt"`
}

type createCampaignInput struct {
	Title       string `json:"title"`
	System      string `json:"system"`
	SettingName string `json:"settingName"`
	InWorldDate string `json:"inWorldDate"`
	Summary     string `json:"summary"`
}

type updateCampaignInput struct {
	CombatPlaylist       []playlistTrack         `json:"combatPlaylist"`
	PreparedCombat       *campaignPreparedCombat `json:"preparedCombat"`
	UpdatePreparedCombat bool                    `json:"updatePreparedCombat,omitempty"`
}

type createWorldEventInput struct {
	Title            string                     `json:"title"`
	Date             string                     `json:"date,omitempty"`
	Summary          string                     `json:"summary"`
	Type             string                     `json:"type"`
	LocationID       string                     `json:"locationId,omitempty"`
	LocationLabel    string                     `json:"locationLabel,omitempty"`
	SceneText        string                     `json:"sceneText"`
	DialogueBranches []worldEventDialogueBranch `json:"dialogueBranches,omitempty"`
	Loot             []string                   `json:"loot,omitempty"`
	Tags             []string                   `json:"tags,omitempty"`
	Origin           string                     `json:"origin,omitempty"`
}

type createEntityInput struct {
	Kind           string                `json:"kind"`
	Title          string                `json:"title"`
	Subtitle       string                `json:"subtitle"`
	Summary        string                `json:"summary"`
	Content        string                `json:"content"`
	PlayerContent  string                `json:"playerContent,omitempty"`
	PlayerCards    []playerFacingCard    `json:"playerCards,omitempty"`
	Tags           []string              `json:"tags"`
	QuickFacts     []quickFact           `json:"quickFacts,omitempty"`
	Related        []relatedEntity       `json:"related,omitempty"`
	Art            *heroArt              `json:"art,omitempty"`
	Playlist       []playlistTrack       `json:"playlist,omitempty"`
	Gallery        []galleryImage        `json:"gallery,omitempty"`
	Category       string                `json:"category,omitempty"`
	Region         string                `json:"region,omitempty"`
	Danger         string                `json:"danger,omitempty"`
	ParentID       string                `json:"parentId,omitempty"`
	Role           string                `json:"role,omitempty"`
	Status         string                `json:"status,omitempty"`
	Importance     string                `json:"importance,omitempty"`
	LocationID     string                `json:"locationId,omitempty"`
	StatBlock      *npcStatBlock         `json:"statBlock,omitempty"`
	RewardProfile  *monsterRewardProfile `json:"rewardProfile,omitempty"`
	Urgency        string                `json:"urgency,omitempty"`
	IssuerID       string                `json:"issuerId,omitempty"`
	PreparedCombat *preparedCombatPlan   `json:"preparedCombat,omitempty"`
	Visibility     string                `json:"visibility,omitempty"`
}

type createEntityResult struct {
	Campaign campaignData    `json:"campaign"`
	Entity   knowledgeEntity `json:"entity"`
}

type deleteEntityResult struct {
	Campaign campaignData `json:"campaign"`
	EntityID string       `json:"entityId"`
	Kind     string       `json:"kind"`
}

type worldEventResult struct {
	Campaign campaignData `json:"campaign"`
	Event    worldEvent   `json:"event"`
}

type deleteWorldEventResult struct {
	Campaign campaignData `json:"campaign"`
	EventID  string       `json:"eventId"`
}

type generateEntityDraftInput struct {
	Kind    string             `json:"kind"`
	Prompt  string             `json:"prompt"`
	Current *createEntityInput `json:"current,omitempty"`
}

type generateEntityDraftResult struct {
	Provider     string              `json:"provider"`
	Notes        []string            `json:"notes"`
	Entity       createEntityInput   `json:"entity"`
	LinkedDrafts []linkedEntityDraft `json:"linkedDrafts,omitempty"`
}

type formatPlayerFacingCardInput struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentHTML string `json:"contentHtml,omitempty"`
	EntityID    string `json:"entityId,omitempty"`
	EntityKind  string `json:"entityKind,omitempty"`
}

type formatPlayerFacingCardResult struct {
	Provider string           `json:"provider"`
	Notes    []string         `json:"notes"`
	Card     playerFacingCard `json:"card"`
}

type linkedEntityDraft struct {
	Role   string            `json:"role"`
	Note   string            `json:"note,omitempty"`
	Entity createEntityInput `json:"entity"`
}

type generateWorldEventInput struct {
	LocationID string                 `json:"locationId,omitempty"`
	Type       string                 `json:"type"`
	Prompt     string                 `json:"prompt,omitempty"`
	Current    *createWorldEventInput `json:"current,omitempty"`
}

type generateWorldEventResult struct {
	Provider string                `json:"provider"`
	Notes    []string              `json:"notes"`
	Event    createWorldEventInput `json:"event"`
}

type addCombatantItem struct {
	EntityID   string `json:"entityId"`
	Quantity   int    `json:"quantity"`
	Initiative int    `json:"initiative,omitempty"`
}

type manualCombatantInput struct {
	Title            string `json:"title"`
	Initiative       int    `json:"initiative"`
	Role             string `json:"role,omitempty"`
	ArmorClass       string `json:"armorClass,omitempty"`
	MaxHitPoints     int    `json:"maxHitPoints,omitempty"`
	CurrentHitPoints int    `json:"currentHitPoints,omitempty"`
}

type startCombatInput struct {
	Title              string                 `json:"title,omitempty"`
	PartySize          int                    `json:"partySize"`
	Thresholds         combatThresholds       `json:"thresholds"`
	TargetAdjustedXP   int                    `json:"targetAdjustedXp,omitempty"`
	TargetBaseXP       int                    `json:"targetBaseXp,omitempty"`
	Items              []addCombatantItem     `json:"items"`
	ManualParticipants []manualCombatantInput `json:"manualParticipants,omitempty"`
}

type updateCombatEntryInput struct {
	CurrentHitPoints *int   `json:"currentHitPoints,omitempty"`
	Defeated         *bool  `json:"defeated,omitempty"`
	Initiative       *int   `json:"initiative,omitempty"`
	EntityID         string `json:"entityId,omitempty"`
	Title            string `json:"title,omitempty"`
}

type updateCombatStateInput struct {
	CurrentTurnEntryID string `json:"currentTurnEntryId,omitempty"`
	NextTurn           bool   `json:"nextTurn,omitempty"`
	PlayersVictory     bool   `json:"playersVictory,omitempty"`
}

type combatResult struct {
	Campaign campaignData  `json:"campaign"`
	Combat   *activeCombat `json:"combat"`
}

type finishCombatResult struct {
	Campaign            campaignData       `json:"campaign"`
	CombatID            string             `json:"combatId"`
	DefeatedCount       int                `json:"defeatedCount"`
	TotalExperience     int                `json:"totalExperience"`
	ExperiencePerPlayer int                `json:"experiencePerPlayer"`
	DefeatedEntries     []combatEntry      `json:"defeatedEntries"`
	Summary             *lastCombatSummary `json:"summary,omitempty"`
}

type generateCombatInput struct {
	Title            string           `json:"title,omitempty"`
	Prompt           string           `json:"prompt"`
	MonsterCount     int              `json:"monsterCount"`
	Difficulty       string           `json:"difficulty"`
	PartySize        int              `json:"partySize"`
	PartyLevels      []int            `json:"partyLevels,omitempty"`
	Thresholds       combatThresholds `json:"thresholds"`
	CustomAdjustedXP int              `json:"customAdjustedXp,omitempty"`
}

type generateCombatResult struct {
	Campaign        campaignData      `json:"campaign"`
	Combat          *activeCombat     `json:"combat"`
	CreatedEntities []knowledgeEntity `json:"createdEntities"`
}
