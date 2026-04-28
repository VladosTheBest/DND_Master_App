import type {
  RuleCategoryFilter,
  RuleEntry
} from "./rules.types";
import {
  normalizeRulesSearchText,
  tokenizeRulesSearch
} from "./rules.utils";

const scoreExactField = (value: string, query: string, score: number) => (value === query ? score : 0);
const scoreIncludesField = (value: string, query: string, score: number) => (value.includes(query) ? score : 0);

const scoreTokenCoverage = (values: string[], tokens: string[], fullMatchScore: number, partialTokenScore: number) => {
  if (!tokens.length) {
    return 0;
  }

  const matchedTokenCount = tokens.filter((token) => values.some((value) => value.includes(token))).length;
  if (!matchedTokenCount) {
    return 0;
  }

  return (matchedTokenCount === tokens.length ? fullMatchScore : 0) + matchedTokenCount * partialTokenScore;
};

const buildSearchFields = (rule: RuleEntry) => {
  const titleRu = normalizeRulesSearchText(rule.titleRu);
  const titleEn = normalizeRulesSearchText(rule.titleEn);
  const aliasesRu = (rule.aliasesRu ?? []).map(normalizeRulesSearchText).filter(Boolean);
  const aliasesEn = (rule.aliasesEn ?? []).map(normalizeRulesSearchText).filter(Boolean);
  const tags = (rule.tags ?? []).map(normalizeRulesSearchText).filter(Boolean);
  const summary = normalizeRulesSearchText(rule.summaryRu);
  const ruleText = normalizeRulesSearchText(rule.ruleTextRu);
  const sourceSection = normalizeRulesSearchText(rule.sourceSection);

  return {
    aliases: [...aliasesRu, ...aliasesEn],
    summary,
    ruleText,
    sourceSection,
    tags,
    titleEn,
    titleRu
  };
};

const scoreRule = (rule: RuleEntry, query: string, tokens: string[]) => {
  const fields = buildSearchFields(rule);
  const priorityValues = [fields.titleRu, fields.titleEn, ...fields.aliases];
  const descriptiveValues = [fields.summary, fields.ruleText, fields.sourceSection, ...fields.tags];
  let score = 0;

  score += scoreExactField(fields.titleRu, query, 1200);
  score += scoreExactField(fields.titleEn, query, 1120);
  score += fields.aliases.some((value) => value === query) ? 1080 : 0;

  score += scoreIncludesField(fields.titleRu, query, 920);
  score += scoreIncludesField(fields.titleEn, query, 860);
  score += fields.aliases.some((value) => value.includes(query)) ? 810 : 0;
  score += fields.tags.some((value) => value === query) ? 620 : 0;
  score += fields.tags.some((value) => value.includes(query)) ? 520 : 0;
  score += scoreIncludesField(fields.sourceSection, query, 420);
  score += scoreIncludesField(fields.summary, query, 360);
  score += scoreIncludesField(fields.ruleText, query, 220);

  score += scoreTokenCoverage(priorityValues, tokens, 320, 44);
  score += scoreTokenCoverage(descriptiveValues, tokens, 180, 18);

  return score;
};

export function searchRules({
  category = "all",
  limit,
  query,
  rules
}: {
  rules: RuleEntry[];
  query: string;
  category?: RuleCategoryFilter;
  limit?: number;
}) {
  const normalizedQuery = normalizeRulesSearchText(query);
  const tokens = tokenizeRulesSearch(query);
  const scopedRules = category === "all" ? rules : rules.filter((rule) => rule.category === category);

  if (!normalizedQuery) {
    const sorted = [...scopedRules].sort((left, right) =>
      left.titleRu.localeCompare(right.titleRu, "ru-RU", { sensitivity: "base" })
    );
    return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  }

  const ranked = scopedRules
    .map((rule) => ({
      rule,
      score: scoreRule(rule, normalizedQuery, tokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.rule.titleRu.localeCompare(right.rule.titleRu, "ru-RU", { sensitivity: "base" });
    })
    .map((entry) => entry.rule);

  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}
