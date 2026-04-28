export type RuleEdition = "5e-2024" | "5e-2014";

export type RuleCategory =
  | "combat"
  | "movement"
  | "conditions"
  | "checks"
  | "saving-throws"
  | "resting"
  | "spellcasting"
  | "damage"
  | "death"
  | "exploration"
  | "equipment"
  | "social"
  | "dm-tools";

export type RuleCategoryFilter = RuleCategory | "all";

export type RuleEntry = {
  id: string;
  edition: RuleEdition;
  titleRu: string;
  titleEn: string;
  category: RuleCategory;
  tags: string[];
  aliasesRu: string[];
  aliasesEn?: string[];
  summaryRu: string;
  ruleTextRu: string;
  examplesRu?: string[];
  relatedRuleIds?: string[];
  source: string;
  sourceSection: string;
  sourcePage?: number | null;
};

export type RulesDataset = {
  meta: {
    rulesCount: number;
    edition: string;
    source: string;
    attribution?: string;
    [key: string]: unknown;
  };
  rules: RuleEntry[];
};
