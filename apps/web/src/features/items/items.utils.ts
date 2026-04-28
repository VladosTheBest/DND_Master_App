import type {
  ItemCatalogDetail,
  ItemCatalogSource,
  ItemCatalogSummary
} from "@shadow-edge/shared-types";
import type { Item, ItemSource } from "./items.types";

const remoteItemDetailsStorageVersion = "v1";
const remoteItemDetailsStorageKey = `shadow-edge.items.catalog-details.${remoteItemDetailsStorageVersion}`;
const maxCachedRemoteItems = 250;

type CachedRemoteItemDetail = {
  item: Item;
  updatedAt: number;
};

type CachedRemoteItemRecord = Record<string, CachedRemoteItemDetail>;

export const normalizeItemSearchQuery = (value: string) => value.trim().toLocaleLowerCase("ru-RU");

const normalizeItemLookupKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-яё]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueValues = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter(Boolean) as string[]));

const collectRemoteMetricKeys = (item: Item) =>
  uniqueValues([
    item.subcategory,
    item.name,
    item.subcategory?.split(",")[0]?.trim(),
    item.name.split(",")[0]?.trim(),
    ...Array.from(item.subcategory?.matchAll(/\(([^)]+)\)/g) ?? []).map((match) => match[1]?.trim() ?? ""),
    ...Array.from(item.name.matchAll(/\(([^)]+)\)/g) ?? []).map((match) => match[1]?.trim() ?? "")
  ]);

const mergeProperties = (primary: string[] | undefined, fallback: string[] | undefined) =>
  Array.from(new Set([...(primary ?? []), ...(fallback ?? [])].filter(Boolean)));

export const isRemoteItemSource = (source: ItemSource): source is ItemCatalogSource =>
  source === "dndsu-magic" || source === "dndsu-equipment";

export const isRemoteItem = (item: Item): boolean => isRemoteItemSource(item.source);

export const buildBuiltInItemLookup = (items: Item[]) => {
  const lookup = new Map<string, Item>();

  items.forEach((item) => {
    const key = normalizeItemLookupKey(item.name);
    if (key && !lookup.has(key)) {
      lookup.set(key, item);
    }
  });

  return lookup;
};

export const enrichRemoteItemWithBuiltInMetrics = (item: Item, builtInItemLookup: Map<string, Item>): Item => {
  if (!isRemoteItem(item)) {
    return item;
  }

  const baseItem = collectRemoteMetricKeys(item)
    .map((entry) => builtInItemLookup.get(normalizeItemLookupKey(entry)))
    .find(Boolean);

  if (!baseItem) {
    return item;
  }

  return {
    ...item,
    armorType: item.armorType ?? baseItem.armorType ?? null,
    weightLb: item.weightLb ?? baseItem.weightLb ?? null,
    properties: mergeProperties(item.properties, baseItem.properties),
    damage: item.damage ?? baseItem.damage ?? null,
    damageType: item.damageType ?? baseItem.damageType ?? null,
    armorClass: item.armorClass ?? baseItem.armorClass ?? null,
    strengthRequirement: item.strengthRequirement ?? baseItem.strengthRequirement ?? null,
    stealthDisadvantage: item.stealthDisadvantage ?? baseItem.stealthDisadvantage ?? null
  };
};

export const catalogSummaryToItem = (summary: ItemCatalogSummary): Item => ({
  id: summary.id,
  source: summary.source,
  name: summary.title,
  category: summary.category,
  subcategory: summary.subcategory,
  armorType: summary.armorType ?? null,
  rarity: summary.rarity ?? null,
  description: summary.summary.trim() || "Подробное описание загружается по запросу.",
  descriptionHtml: null,
  buyPriceGp: summary.buyPriceGp ?? null,
  buyPriceLabel: summary.buyPriceLabel ?? null,
  sellPriceGp: summary.sellPriceGp ?? null,
  sellPriceLabel: summary.sellPriceLabel ?? null,
  weightLb: null,
  properties: [],
  damage: null,
  damageType: null,
  armorClass: null,
  strengthRequirement: null,
  stealthDisadvantage: null,
  reference: summary.reference ?? null,
  referenceUrl: summary.url,
  searchText: [summary.englishTitle ?? "", summary.typeLabel, summary.sourceLabel].join(" ").trim(),
  detailLoaded: Boolean(summary.descriptionLoaded)
});

export const applyCatalogDetailToItem = (item: Item, detail: ItemCatalogDetail): Item => ({
  ...item,
  source: detail.summary.source,
  name: detail.summary.title,
  category: detail.summary.category,
  subcategory: detail.summary.subcategory,
  armorType: detail.summary.armorType ?? null,
  rarity: detail.summary.rarity ?? null,
  description: detail.description.trim() || item.description,
  descriptionHtml: detail.descriptionHtml ?? null,
  buyPriceGp: detail.summary.buyPriceGp ?? item.buyPriceGp ?? null,
  buyPriceLabel: detail.summary.buyPriceLabel ?? item.buyPriceLabel ?? null,
  sellPriceGp: detail.summary.sellPriceGp ?? item.sellPriceGp ?? null,
  sellPriceLabel: detail.summary.sellPriceLabel ?? item.sellPriceLabel ?? null,
  weightLb: detail.weightLb ?? item.weightLb ?? null,
  properties: detail.properties?.length ? detail.properties : item.properties,
  damage: detail.damage ?? item.damage ?? null,
  damageType: detail.damageType ?? item.damageType ?? null,
  armorClass: detail.armorClass ?? item.armorClass ?? null,
  strengthRequirement: detail.strengthRequirement ?? item.strengthRequirement ?? null,
  stealthDisadvantage: detail.stealthDisadvantage ?? item.stealthDisadvantage ?? null,
  reference: detail.summary.reference ?? item.reference ?? null,
  referenceUrl: detail.sourceUrl,
  searchText: [detail.summary.englishTitle ?? "", detail.summary.typeLabel, detail.summary.sourceLabel].join(" ").trim(),
  detailLoaded: true
});

export const mergeCatalogItemWithCachedDetail = (summaryItem: Item, cachedItem: Item): Item =>
  cachedItem.detailLoaded
    ? {
        ...summaryItem,
        description: cachedItem.description || summaryItem.description,
        descriptionHtml: cachedItem.descriptionHtml ?? summaryItem.descriptionHtml ?? null,
        weightLb: cachedItem.weightLb ?? summaryItem.weightLb ?? null,
        properties: cachedItem.properties?.length ? cachedItem.properties : summaryItem.properties,
        damage: cachedItem.damage ?? summaryItem.damage ?? null,
        damageType: cachedItem.damageType ?? summaryItem.damageType ?? null,
        armorClass: cachedItem.armorClass ?? summaryItem.armorClass ?? null,
        strengthRequirement: cachedItem.strengthRequirement ?? summaryItem.strengthRequirement ?? null,
        stealthDisadvantage: cachedItem.stealthDisadvantage ?? summaryItem.stealthDisadvantage ?? null,
        detailLoaded: true
      }
    : summaryItem;

const remoteItemDetailCache = {
  load(): CachedRemoteItemRecord {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(remoteItemDetailsStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as CachedRemoteItemRecord;
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  },
  save(cache: CachedRemoteItemRecord) {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(remoteItemDetailsStorageKey, JSON.stringify(cache));
    } catch {
      // Ignore cache persistence failures and keep runtime behavior intact.
    }
  },
  remember(item: Item) {
    if (!isRemoteItem(item) || !item.detailLoaded) {
      return;
    }
    const current = remoteItemDetailCache.load();
    current[item.id] = {
      item,
      updatedAt: Date.now()
    };

    const trimmedEntries = Object.entries(current)
      .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
      .slice(0, maxCachedRemoteItems);

    remoteItemDetailCache.save(Object.fromEntries(trimmedEntries));
  }
};

export const loadCachedRemoteItemDetails = (): CachedRemoteItemRecord => remoteItemDetailCache.load();
export const rememberRemoteItemDetail = (item: Item) => remoteItemDetailCache.remember(item);
