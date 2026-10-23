import type { ItemCatalogSource, CampaignItemCategory } from "@shadow-edge/shared-types";

export type ItemSource = "builtin" | "custom" | ItemCatalogSource;

export type ItemCategory = CampaignItemCategory;

export type ArmorType = "light" | "medium" | "heavy" | "shield" | null;

export type Item = {
  revision?: number;
  id: string;
  source: ItemSource;
  name: string;
  category: ItemCategory;
  subcategory?: string;
  armorType?: ArmorType;
  rarity?: string | null;
  description: string;
  buyPriceGp?: number | null;
  sellPriceGp?: number | null;
  weightLb?: number | null;
  properties?: string[];
  damage?: string | null;
  damageType?: string | null;
  armorClass?: number | null;
  strengthRequirement?: number | null;
  stealthDisadvantage?: boolean | null;
  reference?: string | null;
  referenceUrl?: string | null;
  descriptionHtml?: string | null;
  buyPriceLabel?: string | null;
  sellPriceLabel?: string | null;
  searchText?: string | null;
  detailLoaded?: boolean;
};
