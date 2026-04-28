import rulesDatasetRaw from "./data/srd_5_2_1_rules_ru_200.json";
import type {
  RuleCategory,
  RuleCategoryFilter,
  RuleEntry,
  RulesDataset
} from "./rules.types";

export const rulesDataset = rulesDatasetRaw as RulesDataset;
export const rulesSourceLabel = rulesDataset.meta.source;
export const rulesAttribution = rulesDataset.meta.attribution?.trim() ?? "";
export const rulesEntries = rulesDataset.rules;
export const rulesById = new Map<string, RuleEntry>(rulesEntries.map((rule) => [rule.id, rule]));

export const ruleCategoryLabels: Record<RuleCategory, string> = {
  combat: "Бой",
  movement: "Передвижение",
  conditions: "Состояния",
  checks: "Проверки",
  "saving-throws": "Спасброски",
  resting: "Отдых",
  spellcasting: "Магия",
  damage: "Урон",
  death: "Смерть и 0 хитов",
  exploration: "Исследование",
  equipment: "Снаряжение",
  social: "Социальные правила",
  "dm-tools": "Инструменты мастера"
};

export const ruleCategoryTabOrder: RuleCategoryFilter[] = [
  "all",
  "combat",
  "movement",
  "conditions",
  "spellcasting",
  "death",
  "checks",
  "exploration",
  "equipment"
];

export const normalizeRulesSearchText = (value: string) =>
  value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[()[\]{}.,;:!?/\\'"`’"«»<>|+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenizeRulesSearch = (value: string) =>
  normalizeRulesSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

export const getRuleById = (ruleId: string) => rulesById.get(ruleId) ?? null;

export const getRuleCategoryLabel = (category: RuleCategory) => ruleCategoryLabels[category];

export const getRuleResultSubtitle = (rule: RuleEntry) =>
  `Правило · ${getRuleCategoryLabel(rule.category)} · ${rule.sourceSection}`;
