import type {
  CampaignData,
  HeroArt,
  KnowledgeEntity,
  SearchResult
} from "@shadow-edge/shared-types";
import type {
  RuleCategory,
  RuleEntry
} from "../rules/rules.types";

export type GlobalSearchEntityResult = SearchResult & {
  type: "entity";
  art?: HeroArt;
};

export type GlobalSearchRuleResult = {
  type: "rule";
  id: string;
  kind: "rule";
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
  category: RuleCategory;
  source: string;
  sourceSection: string;
  rule: RuleEntry;
};

export type GlobalSearchDisplayResult = GlobalSearchEntityResult | GlobalSearchRuleResult;

export type UseGlobalSearchControllerArgs = {
  activeCampaignId: string;
  campaign: CampaignData | null;
  entityMap: Map<string, KnowledgeEntity>;
  pinnedIds: string[];
};
