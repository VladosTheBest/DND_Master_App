import type {
  CampaignData,
  KnowledgeEntity,
  SearchResult
} from "@shadow-edge/shared-types";
import type {
  GlobalSearchDisplayResult,
  GlobalSearchRuleResult
} from "./globalSearch.types";
import type { RuleEntry } from "../rules/rules.types";
import { getRuleCategoryLabel } from "../rules/rules.utils";

export const toGlobalSearchResult = (entity: KnowledgeEntity): SearchResult => ({
  id: entity.id,
  kind: entity.kind,
  title: entity.title,
  subtitle: entity.subtitle,
  summary: entity.summary,
  tags: entity.tags
});

export const buildGlobalSearchFallbackResults = (
  campaign: CampaignData,
  entityMap: Map<string, KnowledgeEntity>,
  pinnedIds: string[]
) => {
  const fallback = [
    ...pinnedIds
      .map((id) => entityMap.get(id))
      .filter((entity): entity is KnowledgeEntity => Boolean(entity))
      .map(toGlobalSearchResult),
    ...campaign.quests.slice(0, 3).map(toGlobalSearchResult),
    ...campaign.locations.slice(0, 3).map(toGlobalSearchResult),
    ...campaign.npcs.slice(0, 2).map(toGlobalSearchResult),
    ...campaign.monsters.slice(0, 2).map(toGlobalSearchResult)
  ];

  return fallback.slice(0, 10);
};

export const buildGlobalSearchDisplayResults = (
  results: SearchResult[],
  entityMap: Map<string, KnowledgeEntity>,
  ruleResults: RuleEntry[]
): GlobalSearchDisplayResult[] =>
  [
    ...results.map((result) => ({
      ...result,
      art: entityMap.get(result.id)?.art,
      type: "entity" as const
    })),
    ...ruleResults.map<GlobalSearchRuleResult>((rule) => ({
      category: rule.category,
      id: rule.id,
      kind: "rule",
      rule,
      source: rule.source,
      sourceSection: rule.sourceSection,
      subtitle: `Правило · ${getRuleCategoryLabel(rule.category)} · ${rule.sourceSection}`,
      summary: rule.summaryRu,
      tags: rule.tags,
      title: rule.titleRu,
      type: "rule"
    }))
  ];
