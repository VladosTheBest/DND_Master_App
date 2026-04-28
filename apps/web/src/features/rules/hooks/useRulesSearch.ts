import {
  useEffect,
  useMemo,
  useState
} from "react";
import { searchRules } from "../rulesSearch";
import {
  getRuleById,
  rulesEntries
} from "../rules.utils";
import type {
  RuleCategoryFilter,
  RuleEntry
} from "../rules.types";

export function useRulesSearch({
  initialQuery = "",
  initialRuleId
}: {
  initialQuery?: string;
  initialRuleId?: string;
} = {}) {
  const allRules = rulesEntries;
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<RuleCategoryFilter>("all");
  const [selectedRuleId, setSelectedRuleId] = useState(
    initialRuleId && getRuleById(initialRuleId) ? initialRuleId : allRules[0]?.id ?? ""
  );

  const results = useMemo(
    () =>
      searchRules({
        category: selectedCategory,
        query,
        rules: allRules
      }),
    [allRules, query, selectedCategory]
  );

  useEffect(() => {
    if (!results.length) {
      return;
    }

    if (!selectedRuleId || !results.some((rule) => rule.id === selectedRuleId)) {
      if (initialRuleId && results.some((rule) => rule.id === initialRuleId)) {
        setSelectedRuleId(initialRuleId);
        return;
      }
      setSelectedRuleId(results[0].id);
    }
  }, [initialRuleId, results, selectedRuleId]);

  const selectedRule = useMemo(
    () => (results.length ? getRuleById(selectedRuleId) ?? results[0] ?? null : null),
    [results, selectedRuleId]
  );

  const setSelectedRule = (rule: RuleEntry | null) => {
    setSelectedRuleId(rule?.id ?? "");
  };

  const clearSearch = () => {
    setQuery("");
    setSelectedCategory("all");
    setSelectedRuleId(initialRuleId && getRuleById(initialRuleId) ? initialRuleId : allRules[0]?.id ?? "");
  };

  return {
    allRules,
    clearSearch,
    getRuleById,
    query,
    results,
    selectedCategory,
    selectedRule,
    setQuery,
    setSelectedCategory,
    setSelectedRule
  };
}
