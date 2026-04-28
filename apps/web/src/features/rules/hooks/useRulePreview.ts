import { useMemo } from "react";
import type { RuleEntry } from "../rules.types";

export function useRulePreview({
  getRuleById,
  selectedRule
}: {
  selectedRule: RuleEntry | null;
  getRuleById: (ruleId: string) => RuleEntry | null;
}) {
  const relatedRules = useMemo(
    () =>
      (selectedRule?.relatedRuleIds ?? [])
        .map((ruleId) => getRuleById(ruleId))
        .filter((rule): rule is RuleEntry => Boolean(rule)),
    [getRuleById, selectedRule]
  );

  return {
    previewRule: selectedRule,
    relatedRules
  };
}
