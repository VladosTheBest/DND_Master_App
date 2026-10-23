import { useWorkspaceGuard } from "../../app/workspace-route";
import { useWorkspaceListState } from "../../app/workspace-route";
import { AppModal } from "../../app/AppModal";
import { useWorkspaceRoute, navigateWorkspace, workspaceURL, readWorkspaceRoute } from "../../app/workspace-route";
import { confirmAction } from "../../app/confirm-action";
import type { CampaignData } from "@shadow-edge/shared-types";
import { CloseConfirmDialog } from "../../app/CloseConfirmDialog";
import { useNativeDialog } from "../../app/hooks/useNativeDialog";
import { isApiError } from "@shadow-edge/api-client";
import { customItemsAPI, useCustomItems, type CustomItemsPreview } from "./custom-items.api";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { browserStorage } from "../../app/browser-storage";
import "./items.css";
import { ItemCategoryIcon } from "./ItemCategoryIcon";
import builtInItemsRaw from "../../../../../dnd_items_150_ru_official_basic_rules_2014.json";
import { usePageSearchHotkey } from "../../app/hooks/usePageSearchHotkey";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties
} from "react";
import { createPortal } from "react-dom";
import type { ArmorType, Item, ItemCategory, ItemSource } from "./items.types";
import { buildBuiltInItemLookup, enrichRemoteItemWithBuiltInMetrics, isRemoteItem } from "./items.utils";
import { useItemsCatalogController } from "./useItemsCatalogController";

type RawBuiltInItem = {
  id?: number;
  name_ru?: string | null;
  name_en?: string | null;
  category?: string | null;
  subtype?: string | null;
  source?: string | null;
  buy_price_gp?: number | null;
  sell_price_gp?: number | null;
  weight_lb?: number | null;
  description_ru?: string | null;
  effects_ru?: string | null;
  source_section?: string | null;
  armor_class_base?: number | null;
  armor_class_bonus?: number | null;
  dex_bonus?: string | null;
  strength_requirement?: number | null;
  stealth_disadvantage?: boolean | null;
  damage?: string | null;
  properties?: string | null;
};

type ItemTab = "all" | "builtin" | "custom";
type PriceFilter = "all" | "under-10" | "10-100" | "100-500" | "500-plus";
type SortMode = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type ItemEditorMode = "closed" | "create" | "edit";
type Tone = "default" | "accent" | "success" | "warning" | "danger";
type ItemMetric = {
  label: string;
  value: string;
  tone?: Tone;
};

type ItemDraft = {
  name: string;
  category: ItemCategory;
  subcategory: string;
  armorType: ArmorType;
  rarity: string;
  description: string;
  buyPriceGp: string;
  sellPriceGp: string;
  weightLb: string;
  propertiesText: string;
  damage: string;
  damageType: string;
  armorClass: string;
  strengthRequirement: string;
  stealthDisadvantage: "" | "true" | "false";
};

type PersistedItemsUiState = {
  activeTab?: ItemTab;
  searchQuery?: string;
  categoryFilter?: ItemCategory | "all";
  armorTypeFilter?: ArmorType | "all";
  sourceFilter?: ItemSource | "all";
  priceFilter?: PriceFilter;
  sortMode?: SortMode;
};

const itemCategoryLabels: Record<ItemCategory, string> = {
  armor: "Броня",
  weapon: "Оружие",
  potion: "Зелье",
  poison: "Яд",
  staff: "Посох",
  ring: "Кольцо",
  scroll: "Свиток",
  wand: "Палочка",
  tool: "Инструмент",
  gear: "Снаряжение",
  focus: "Фокус",
  clothing: "Одежда",
  other: "Другое"
};

const itemSourceLabels: Record<ItemSource, string> = {
  builtin: "Базовые D&D",
  custom: "Мои предметы",
  "dndsu-magic": "DnD.su • магические",
  "dndsu-equipment": "DnD.su • снаряжение"
};

const armorTypeLabels: Record<Exclude<ArmorType, null>, string> = {
  light: "Лёгкая",
  medium: "Средняя",
  heavy: "Тяжёлая",
  shield: "Щит"
};

const sortModeLabels: Record<SortMode, string> = {
  "name-asc": "По названию (А-Я)",
  "name-desc": "По названию (Я-А)",
  "price-asc": "По цене (сначала дешевле)",
  "price-desc": "По цене (сначала дороже)"
};

const quickCategoryFilters: ItemCategory[] = ["armor", "weapon", "potion", "poison"];
const customItemsStorageVersion = "v1";

const itemCategoryGradients: Record<ItemCategory, string> = {
  armor: "linear-gradient(140deg, rgba(85, 120, 205, .78), rgba(42, 60, 101, .86))",
  weapon: "linear-gradient(140deg, rgba(137, 76, 185, .82), rgba(59, 35, 92, .9))",
  potion: "linear-gradient(140deg, rgba(71, 156, 188, .8), rgba(29, 76, 105, .9))",
  poison: "linear-gradient(140deg, rgba(86, 156, 104, .84), rgba(28, 74, 40, .94))",
  staff: "linear-gradient(140deg, rgba(106, 95, 209, .8), rgba(58, 45, 120, .92))",
  ring: "linear-gradient(140deg, rgba(121, 95, 196, .8), rgba(61, 46, 105, .92))",
  scroll: "linear-gradient(140deg, rgba(96, 122, 170, .8), rgba(44, 57, 86, .92))",
  wand: "linear-gradient(140deg, rgba(90, 134, 214, .8), rgba(39, 61, 112, .92))",
  tool: "linear-gradient(140deg, rgba(84, 129, 184, .78), rgba(34, 55, 90, .9))",
  gear: "linear-gradient(140deg, rgba(70, 104, 164, .76), rgba(32, 45, 72, .92))",
  focus: "linear-gradient(140deg, rgba(116, 92, 210, .8), rgba(48, 35, 103, .92))",
  clothing: "linear-gradient(140deg, rgba(89, 118, 176, .78), rgba(42, 54, 81, .92))",
  other: "linear-gradient(140deg, rgba(83, 104, 142, .75), rgba(34, 46, 67, .9))"
};

const rawSubtypeLabels: Record<string, string> = {
  light: "Лёгкая броня",
  medium: "Средняя броня",
  heavy: "Тяжёлая броня",
  shield: "Щит",
  simple_melee: "Простое рукопашное",
  simple_ranged: "Простое дальнобойное",
  martial_melee: "Воинское рукопашное",
  martial_ranged: "Воинское дальнобойное",
  arcane_focus: "Тайный фокус",
  druidic_focus: "Друидический фокус",
  holy_symbol: "Священный символ",
  gear: "Снаряжение",
  container: "Контейнер",
  consumable: "Расходник",
  apparel: "Одежда",
  tool: "Инструмент",
  potion: "Зелье",
  poison: "Яд",
  gaming_set: "Игровой набор",
  musical_instrument: "Музыкальный инструмент",
  "musical instrument": "Музыкальный инструмент",
  ammunition: "Боеприпасы"
};

const normalizeSearchValue = (value: string) =>
  value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeSubtypeKey = (value?: string | null) => {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLocaleLowerCase("en-US").replace(/\s+/g, "_") : undefined;
};

const isDefined = <T,>(value: T | null | undefined): value is T => value != null;

const normalizeOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeOptionalInteger = (value: unknown) => {
  const parsed = normalizeOptionalNumber(value);
  return typeof parsed === "number" ? Math.round(parsed) : null;
};

const normalizeOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }
  return null;
};

const splitPropertyText = (value?: string | null) =>
  (value ?? "")
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const titleCaseRussian = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);

const resolveBuiltInCategory = (rawCategory?: string | null, rawSubtype?: string | null): ItemCategory => {
  const normalizedSubtype = normalizeSubtypeKey(rawSubtype);
  switch (rawCategory) {
    case "armor":
      return "armor";
    case "weapon":
      return "weapon";
    case "focus":
      return "focus";
    case "tool":
    case "gaming_set":
    case "musical_instrument":
      return "tool";
    case "pack":
    case "ammo":
      return "gear";
    case "item":
      if (normalizedSubtype === "potion") {
        return "potion";
      }
      if (normalizedSubtype === "poison") {
        return "poison";
      }
      if (normalizedSubtype === "apparel") {
        return "clothing";
      }
      if (normalizedSubtype === "tool") {
        return "tool";
      }
      if (normalizedSubtype === "focus") {
        return "focus";
      }
      return "gear";
    default:
      return "other";
  }
};

const resolveBuiltInSubcategory = (rawSubtype?: string | null) => {
  const normalized = normalizeSubtypeKey(rawSubtype);
  if (!normalized) {
    return undefined;
  }
  return rawSubtypeLabels[normalized] ?? titleCaseRussian(normalized.replace(/_/g, " "));
};

const resolveBuiltInArmorType = (rawCategory?: string | null, rawSubtype?: string | null): ArmorType => {
  if (rawCategory !== "armor") {
    return null;
  }
  const normalizedSubtype = normalizeSubtypeKey(rawSubtype);
  return normalizedSubtype === "light" || normalizedSubtype === "medium" || normalizedSubtype === "heavy" || normalizedSubtype === "shield"
    ? normalizedSubtype
    : null;
};

const parseDamageParts = (rawDamage?: string | null) => {
  const value = normalizeOptionalText(rawDamage);
  if (!value) {
    return { damage: null, damageType: null };
  }
  const match = value.match(
    /^(.*?)(?:\s+)(дробящий|колющий|рубящий|огненный|холодный|кислотный|силовой|громовой|ядовитый|некротический|психический|излучением?|электрический)$/i
  );
  if (!match) {
    return { damage: value, damageType: null };
  }
  return {
    damage: match[1].trim(),
    damageType: match[2].trim()
  };
};

const buildBuiltInProperties = (raw: RawBuiltInItem, armorType: ArmorType) => {
  const values = new Set<string>();
  splitPropertyText(raw.properties).forEach((entry) => values.add(entry));

  if (armorType) {
    if (raw.dex_bonus === "full") {
      values.add("Полный модификатор Ловкости");
    }
    if (raw.dex_bonus === "max_2") {
      values.add("До +2 от Ловкости");
    }
    if (raw.dex_bonus === "none") {
      values.add("Без бонуса Ловкости");
    }
    if (raw.stealth_disadvantage) {
      values.add("Помеха на Скрытность");
    }
    if (raw.armor_class_bonus) {
      values.add(`+${raw.armor_class_bonus} к КД`);
    }
  }

  if (!values.size) {
    splitPropertyText(raw.effects_ru).forEach((entry) => values.add(entry));
  }

  return Array.from(values);
};

function normalizeBuiltInItem(raw: RawBuiltInItem): Item {
  const armorType = resolveBuiltInArmorType(raw.category, raw.subtype);
  const damageParts = parseDamageParts(raw.damage);
  const category = resolveBuiltInCategory(raw.category, raw.subtype);

  return {
    id: `builtin-${raw.id ?? raw.name_en ?? Math.random().toString(36).slice(2)}`,
    source: "builtin",
    name: normalizeOptionalText(raw.name_ru) ?? normalizeOptionalText(raw.name_en) ?? "Без названия",
    category,
    subcategory: resolveBuiltInSubcategory(raw.subtype),
    armorType,
    rarity: null,
    description:
      normalizeOptionalText(raw.description_ru) ??
      normalizeOptionalText(raw.effects_ru) ??
      normalizeOptionalText(raw.name_en) ??
      "Описание отсутствует.",
    buyPriceGp: normalizeOptionalNumber(raw.buy_price_gp),
    sellPriceGp: normalizeOptionalNumber(raw.sell_price_gp),
    weightLb: normalizeOptionalNumber(raw.weight_lb),
    properties: buildBuiltInProperties(raw, armorType),
    damage: damageParts.damage,
    damageType: damageParts.damageType,
    armorClass: normalizeOptionalInteger(raw.armor_class_base ?? raw.armor_class_bonus),
    strengthRequirement: normalizeOptionalInteger(raw.strength_requirement),
    stealthDisadvantage: normalizeOptionalBoolean(raw.stealth_disadvantage),
    reference: [normalizeOptionalText(raw.source), normalizeOptionalText(raw.source_section)].filter(Boolean).join(" • ") || null
  };
}

const builtInItems = ((builtInItemsRaw as RawBuiltInItem[]) ?? []).map(normalizeBuiltInItem);
const builtInItemLookup = buildBuiltInItemLookup(builtInItems);

function normalizeCustomItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = (raw as { source?: unknown }).source === "builtin" ? "builtin" : "custom";
  const id = normalizeOptionalText((raw as { id?: unknown }).id);
  const name = normalizeOptionalText((raw as { name?: unknown }).name);
  const categoryValue = (raw as { category?: unknown }).category;
  const category = typeof categoryValue === "string" && categoryValue in itemCategoryLabels ? (categoryValue as ItemCategory) : "other";
  const armorTypeValue = (raw as { armorType?: unknown }).armorType;
  const armorType =
    armorTypeValue === "light" || armorTypeValue === "medium" || armorTypeValue === "heavy" || armorTypeValue === "shield"
      ? armorTypeValue
      : null;
  const rawProperties = (raw as { properties?: unknown[] }).properties;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    source,
    name,
    category,
    subcategory: normalizeOptionalText((raw as { subcategory?: unknown }).subcategory),
    armorType,
    rarity: normalizeOptionalText((raw as { rarity?: unknown }).rarity) ?? null,
    description: normalizeOptionalText((raw as { description?: unknown }).description) ?? "Описание отсутствует.",
    buyPriceGp: normalizeOptionalNumber((raw as { buyPriceGp?: unknown }).buyPriceGp),
    sellPriceGp: normalizeOptionalNumber((raw as { sellPriceGp?: unknown }).sellPriceGp),
    weightLb: normalizeOptionalNumber((raw as { weightLb?: unknown }).weightLb),
    properties: Array.isArray(rawProperties)
      ? rawProperties.map((entry) => normalizeOptionalText(entry)).filter(isDefined)
      : [],
    damage: normalizeOptionalText((raw as { damage?: unknown }).damage) ?? null,
    damageType: normalizeOptionalText((raw as { damageType?: unknown }).damageType) ?? null,
    armorClass: normalizeOptionalInteger((raw as { armorClass?: unknown }).armorClass),
    strengthRequirement: normalizeOptionalInteger((raw as { strengthRequirement?: unknown }).strengthRequirement),
    stealthDisadvantage: normalizeOptionalBoolean((raw as { stealthDisadvantage?: unknown }).stealthDisadvantage),
    reference: normalizeOptionalText((raw as { reference?: unknown }).reference) ?? null
  };
}

const emptyItemDraft = (): ItemDraft => ({
  name: "",
  category: "gear",
  subcategory: "",
  armorType: null,
  rarity: "",
  description: "",
  buyPriceGp: "",
  sellPriceGp: "",
  weightLb: "",
  propertiesText: "",
  damage: "",
  damageType: "",
  armorClass: "",
  strengthRequirement: "",
  stealthDisadvantage: ""
});

const itemToDraft = (item: Item): ItemDraft => ({
  name: item.name,
  category: item.category,
  subcategory: item.subcategory ?? "",
  armorType: item.armorType ?? null,
  rarity: item.rarity ?? "",
  description: item.description,
  buyPriceGp: item.buyPriceGp != null ? String(item.buyPriceGp) : "",
  sellPriceGp: item.sellPriceGp != null ? String(item.sellPriceGp) : "",
  weightLb: item.weightLb != null ? String(item.weightLb) : "",
  propertiesText: item.properties?.join(", ") ?? "",
  damage: item.damage ?? "",
  damageType: item.damageType ?? "",
  armorClass: item.armorClass != null ? String(item.armorClass) : "",
  strengthRequirement: item.strengthRequirement != null ? String(item.strengthRequirement) : "",
  stealthDisadvantage:
    item.stealthDisadvantage == null ? "" : item.stealthDisadvantage ? "true" : "false"
});

const truncateInlineText = (value: string, maxLength = 118) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);

const formatGold = (value?: number | null) => {
  if (value == null) {
    return "—";
  }

  const totalCopper = Math.round(value * 100);
  const gold = Math.floor(totalCopper / 100);
  const silver = Math.floor((totalCopper % 100) / 10);
  const copper = totalCopper % 10;
  const parts = [
    gold ? `${formatNumber(gold)} зм` : "",
    silver ? `${formatNumber(silver)} см` : "",
    copper ? `${formatNumber(copper)} мм` : ""
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "0 мм";
};
const formatWeight = (value?: number | null) => (value == null ? "—" : `${formatNumber(value)} фнт`);

const resolveBuyPriceLabel = (item: Item) => item.buyPriceLabel ?? formatGold(item.buyPriceGp);
const resolveSellPriceLabel = (item: Item) => item.sellPriceLabel ?? formatGold(item.sellPriceGp);

const resolveItemSourceTone = (source: ItemSource): Tone => {
  switch (source) {
    case "custom":
      return "success";
    case "dndsu-magic":
      return "warning";
    case "dndsu-equipment":
      return "accent";
    case "builtin":
    default:
      return "default";
  }
};

const getEffectivePrice = (item: Item) => item.buyPriceGp ?? item.sellPriceGp ?? null;

const matchesPriceFilter = (item: Item, filter: PriceFilter) => {
  if (filter === "all") {
    return true;
  }
  const price = getEffectivePrice(item);
  if (price == null) {
    return false;
  }
  if (filter === "under-10") {
    return price <= 10;
  }
  if (filter === "10-100") {
    return price > 10 && price <= 100;
  }
  if (filter === "100-500") {
    return price > 100 && price <= 500;
  }
  return price > 500;
};

const buildItemSearchText = (item: Item) =>
  normalizeSearchValue(
    [
      item.name,
      item.description,
      item.subcategory ?? "",
      item.rarity ?? "",
      item.properties?.join(" ") ?? "",
      item.damage ?? "",
      item.damageType ?? "",
      item.reference ?? "",
      item.searchText ?? "",
      item.buyPriceLabel ?? "",
      item.sellPriceLabel ?? "",
      itemCategoryLabels[item.category],
      item.armorType ? armorTypeLabels[item.armorType] : "",
      itemSourceLabels[item.source]
    ].join(" ")
  );

const compareItems = (sortMode: SortMode) => (left: Item, right: Item) => {
  if (sortMode === "price-asc" || sortMode === "price-desc") {
    const leftPrice = getEffectivePrice(left);
    const rightPrice = getEffectivePrice(right);

    if (leftPrice == null && rightPrice == null) {
      return left.name.localeCompare(right.name, "ru-RU");
    }
    if (leftPrice == null) {
      return 1;
    }
    if (rightPrice == null) {
      return -1;
    }
    if (leftPrice !== rightPrice) {
      return sortMode === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
    }
  }

  const nameCompare = left.name.localeCompare(right.name, "ru-RU");
  return sortMode === "name-desc" ? -nameCompare : nameCompare;
};

const buildCustomItemsStorageKey = (campaignId: string) =>
  `shadow-edge.items.custom.${customItemsStorageVersion}.${campaignId}`;

const buildItemsUiStorageKey = (campaignId: string) => `shadow-edge.items.ui.${customItemsStorageVersion}.${campaignId}`;


const itemsUiStateStorage = {
  load(campaignId: string): PersistedItemsUiState {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(buildItemsUiStorageKey(campaignId));
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as PersistedItemsUiState;
      return parsed ?? {};
    } catch {
      return {};
    }
  },
  save(campaignId: string, value: PersistedItemsUiState) {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(buildItemsUiStorageKey(campaignId), JSON.stringify(value));
    } catch {
      // Ignore storage failures and keep the in-memory session usable.
    }
  }
};

const createCustomItemId = () =>
  `custom-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;

const createCustomItemFromDraft = (draft: ItemDraft, existingId?: string): Item => {
  const nextProperties = draft.propertiesText
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    id: existingId ?? createCustomItemId(),
    source: "custom",
    name: draft.name.trim(),
    category: draft.category,
    subcategory: normalizeOptionalText(draft.subcategory),
    armorType: draft.category === "armor" ? draft.armorType ?? null : null,
    rarity: normalizeOptionalText(draft.rarity) ?? null,
    description: draft.description.trim(),
    buyPriceGp: normalizeOptionalNumber(draft.buyPriceGp),
    sellPriceGp: normalizeOptionalNumber(draft.sellPriceGp),
    weightLb: normalizeOptionalNumber(draft.weightLb),
    properties: nextProperties,
    damage: draft.category === "weapon" ? normalizeOptionalText(draft.damage) ?? null : null,
    damageType: draft.category === "weapon" ? normalizeOptionalText(draft.damageType) ?? null : null,
    armorClass: draft.category === "armor" ? normalizeOptionalInteger(draft.armorClass) : null,
    strengthRequirement: draft.category === "armor" ? normalizeOptionalInteger(draft.strengthRequirement) : null,
    stealthDisadvantage: draft.category === "armor" ? normalizeOptionalBoolean(draft.stealthDisadvantage) : null,
    reference: null
  };
};

const createItemHeroStyle = (item: Item): CSSProperties => ({
  background: itemCategoryGradients[item.category],
  border: "1px solid rgba(159, 188, 255, .18)"
});

const filterVisibleMetrics = (metrics: ItemMetric[]) =>
  metrics.filter(
    (metric, index, list) =>
      metric.value !== "—" &&
      list.findIndex((entry) => entry.label === metric.label && entry.value === metric.value) === index
  );

const getItemMetrics = (item: Item): ItemMetric[] =>
  item.category === "armor"
    ? [
        {
          label: item.armorType === "shield" ? "Бонус к КД" : "Класс брони",
          value:
            item.armorClass == null
              ? "—"
              : item.armorType === "shield"
                ? `+${item.armorClass}`
                : String(item.armorClass)
        },
        { label: "Тип брони", value: item.armorType ? armorTypeLabels[item.armorType] : "—" },
        {
          label: "Сила",
          value: item.strengthRequirement != null ? `Требуется ${item.strengthRequirement}` : "Не требуется"
        },
        {
          label: "Скрытность",
          value: item.stealthDisadvantage == null ? "—" : item.stealthDisadvantage ? "Помеха" : "Без помехи",
          tone: item.stealthDisadvantage ? "danger" : "success"
        },
        { label: "Вес", value: formatWeight(item.weightLb) }
      ]
    : item.category === "weapon"
      ? [
          { label: "Урон", value: item.damage ?? "—", tone: "warning" },
          { label: "Тип урона", value: item.damageType ?? "—" },
          { label: "Вес", value: formatWeight(item.weightLb) }
        ]
      : [
          { label: "Подтип", value: item.subcategory ?? "—" },
          { label: "Категория", value: itemCategoryLabels[item.category] },
          { label: "Вес", value: formatWeight(item.weightLb) }
        ];

const getItemSummaryMetric = (item: Item) => {
  if (item.category === "armor") {
    return {
      label: item.armorType === "shield" ? "Бонус к КД" : "Класс брони",
      value: item.armorType === "shield" && item.armorClass != null ? `+${item.armorClass}` : String(item.armorClass ?? "—")
    };
  }

  if (item.category === "weapon") {
    return {
      label: "Урон",
      value: [item.damage, item.damageType].filter(Boolean).join(" ") || "—"
    };
  }

  return {
    label: item.subcategory ? "Подтип" : "Категория",
    value: item.subcategory ?? itemCategoryLabels[item.category]
  };
};

const createTabOptions = (officialCount: number, customCount: number) => [
  { id: "all" as const, label: "Все предметы", count: officialCount + customCount },
  { id: "builtin" as const, label: "Официальные", count: officialCount },
  { id: "custom" as const, label: "Кастомные", count: customCount }
];

function ItemBadge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  return <span className={`badge tone-${tone}`}>{label}</span>;
}

function CoinIcon() {
  return (
    <svg aria-hidden="true" className="items-coin-icon" viewBox="0 0 20 20">
      <circle cx="10" cy="10" fill="#f1c45c" r="7.2" />
      <circle cx="8.3" cy="7.7" fill="rgba(255, 245, 191, .46)" r="2.35" />
      <circle cx="10" cy="10" fill="none" opacity=".6" r="5" stroke="rgba(88, 54, 9, .72)" strokeWidth="1.1" />
      <path
        d="M10 6.4v7.2M7.4 8.4c0-1 1-1.8 2.6-1.8 1.5 0 2.6.7 2.6 1.8 0 1.2-.9 1.7-2.6 2.1-1.5.4-2.6.8-2.6 2 0 1.2 1.1 1.9 2.6 1.9 1.6 0 2.6-.8 2.6-1.9"
        fill="none"
        stroke="rgba(88, 54, 9, .85)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.15"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" className={`items-chevron-icon ${expanded ? "expanded" : ""}`} viewBox="0 0 16 16">
      <path
        d="M4.2 6.1 8 9.9l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="items-modal-close-icon" viewBox="0 0 20 20">
      <path
        d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}


function ItemStatCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <article className={`card preview-stat-card items-stat-card items-stat-card-${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function ItemPricePill({
  label,
  value,
  emphasize = false
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`items-price-pill ${emphasize ? "major" : ""}`}>
      <span className="items-price-icon">
        <CoinIcon />
      </span>
      <span className="items-price-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function ItemListCard({
  item,
  selected,
  onSelect
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
}) {
  const summaryMetric = getItemSummaryMetric(item);
  const cardMetrics = filterVisibleMetrics([
    summaryMetric,
    ...getItemMetrics(item).filter((metric) => metric.label !== summaryMetric.label)
  ])
    .filter((metric) => metric.label !== "Категория" && metric.label !== "Подтип")
    .slice(0, 3);
  const primaryPrice = item.buyPriceGp != null ? resolveBuyPriceLabel(item) : resolveSellPriceLabel(item);

  return (
    <article className={`items-list-card ${selected ? "selected" : ""}`}>
      <button
        aria-haspopup="dialog"
        aria-pressed={selected}
        className="items-list-card-trigger"
        onClick={onSelect}
        type="button"
      >
        <div className="items-list-card-head">
          <div className="items-list-card-copy">
            <div className="items-list-card-kicker">
              <span>{itemCategoryLabels[item.category]}</span>
              {item.subcategory && item.subcategory !== itemCategoryLabels[item.category] ? <span>{item.subcategory}</span> : null}
            </div>
            <div className="items-list-card-title"><ItemCategoryIcon category={item.category} /><strong>{item.name}</strong></div>
            <p>{truncateInlineText(item.description, 132)}</p>
          </div>

          <div className="items-list-card-aside">
            <div className="items-list-card-badges">
              <ItemBadge label={itemSourceLabels[item.source]} tone={resolveItemSourceTone(item.source)} />
              {item.rarity ? <ItemBadge label={item.rarity} tone="default" /> : null}
            </div>

            <div className="items-list-card-pricing">
              <ItemPricePill label={item.buyPriceGp != null ? "Покупка" : "Цена"} value={primaryPrice} emphasize />
              {item.buyPriceGp != null && item.sellPriceGp != null ? (
                <ItemPricePill label="Продажа" value={resolveSellPriceLabel(item)} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="items-list-card-meta">
          {cardMetrics.map((metric) => (
            <span key={`${item.id}-${metric.label}`} className="items-list-card-meta-item">
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </div>

        <div className="items-list-card-foot">
          <span className="items-list-card-expand-copy">Открыть подробности</span>
          <ChevronIcon expanded={false} />
        </div>
      </button>
    </article>
  );
}

export function ItemDetailModal({
  item,
  isLoadingDetail, detailError, onRetry,
  onClose,
  onEdit,
  onDelete
}: {
  item: Item;
  isLoadingDetail?: boolean; detailError?:string; onRetry?:()=>void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const metrics = filterVisibleMetrics(getItemMetrics(item));
  const primaryMetrics = metrics.slice(0, 3);
  const secondaryMetrics = metrics.slice(3);
  const detailLine =
    [item.armorType ? armorTypeLabels[item.armorType] : "", item.rarity ?? ""].filter(Boolean).join(" • ") ||
    "Справочная карточка для стола";
  const descriptionPending = isRemoteItem(item) && !item.detailLoaded;
  const descriptionText = isLoadingDetail
    ? "Загружаю полное описание из каталога..."
    : descriptionPending
      ? "Полное описание пока не загружено."
      : item.description.trim() || "Описание отсутствует.";

  useEffect(() => {
    if (!modalRef.current) {
      return;
    }
    modalRef.current.scrollTop = 0;
  }, [item.id]);

  const modal = (
    <AppModal label="Карточка предмета" onClose={onClose}>
      <div

        className="panel items-detail-modal"
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}

      >
        {detailError&&<p role="alert">{detailError} <button disabled={isLoadingDetail} onClick={onRetry}>Повторить описание</button></p>}
        <button aria-label="Закрыть карточку предмета" className="items-modal-close" onClick={onClose} type="button">
          <CloseIcon />
        </button>

        <div className="items-detail-stack items-modal-stack">
          <section className="items-detail-hero items-modal-hero" style={createItemHeroStyle(item)}>
            <div className="items-modal-hero-copy">
              <div className="items-detail-hero-top items-modal-hero-top">
                <div className="actions items-inline-actions">
                  <ItemBadge label={itemCategoryLabels[item.category]} tone="default" />
                  {item.subcategory ? <ItemBadge label={item.subcategory} tone="accent" /> : null}
                  <ItemBadge label={itemSourceLabels[item.source]} tone={resolveItemSourceTone(item.source)} />
                </div>
              </div>

              <div className="items-detail-title items-modal-title">
                <span>{item.subcategory ?? itemCategoryLabels[item.category]}</span>
                <strong>{item.name}</strong>
                <small>{detailLine}</small>
              </div>

              <p className={`items-modal-summary ${descriptionPending || isLoadingDetail ? "is-loading" : ""}`}>
                {descriptionText}
              </p>
            </div>

            <div aria-hidden="true" className="items-modal-hero-art">
              <div className="items-modal-hero-glow" />
              <div className="items-modal-hero-glyph">
                <ItemCategoryIcon category={item.category} />
              </div>
            </div>
          </section>

          <div className="items-modal-primary-row">
            {primaryMetrics.map((metric) => (
              <ItemStatCard key={`${item.id}-${metric.label}`} label={metric.label} tone={metric.tone} value={metric.value} />
            ))}

              <ItemPricePill label="Покупка" value={resolveBuyPriceLabel(item)} emphasize />
              <ItemPricePill label="Продажа" value={resolveSellPriceLabel(item)} />
            </div>
          {item.source === "custom" && onEdit && onDelete ? (
            <div className="actions items-detail-actions">
              <button className="ghost" onClick={onEdit} type="button">
                Редактировать
              </button>
              <button className="ghost danger-action" onClick={onDelete} type="button">
                Удалить
              </button>
            </div>
          ) : null}

          {secondaryMetrics.length ? (
            <section className="card mini items-detail-section">
              <div className="row">
                <strong>Характеристики</strong>
                <small>{secondaryMetrics.length}</small>
              </div>
              <div className="preview-stat-grid items-preview-stat-grid">
                {secondaryMetrics.map((metric) => (
                  <ItemStatCard key={`${item.id}-extra-${metric.label}`} label={metric.label} tone={metric.tone} value={metric.value} />
                ))}
              </div>
            </section>
          ) : null}

          {item.properties?.length ? (
            <section className="card mini items-detail-section">
              <div className="row">
                <strong>Свойства</strong>
                <small>{item.properties.length}</small>
              </div>
              <div className="items-property-list">
                {item.properties.map((property) => (
                  <span key={`${item.id}-${property}`} className="items-property-pill">
                    {property}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card mini items-detail-section">
            <strong>Дополнительно</strong>
            <div className="items-detail-meta">
              <span>Источник записи</span>
              <strong>{itemSourceLabels[item.source]}</strong>
              <span>Категория</span>
              <strong>{itemCategoryLabels[item.category]}</strong>
              {item.reference ? (
                <>
                  <span>Справочник</span>
                  <strong>{item.reference}</strong>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppModal>
  );

  return createPortal(modal, document.body);
}

function ItemEditorPanel({
  mode,
  draft,
  onCancel,
  onCategoryChange,
  onFieldChange,
  onSave,
  titleId,
  validationError, tools, busy
}: {
  mode: Exclude<ItemEditorMode, "closed">;
  draft: ItemDraft;
  onCancel: () => void;
  onCategoryChange: (category: ItemCategory) => void;
  onFieldChange: <Key extends keyof ItemDraft>(field: Key, value: ItemDraft[Key]) => void;
  onSave: () => void;
  titleId?: string;
  validationError?: string;
  tools?: ReactNode;
  busy?: boolean;
}) {
  const isArmor = draft.category === "armor";
  const isWeapon = draft.category === "weapon";

  return (
    <div className="items-detail-stack">
      <div className="row">
        <div className="stack tight">
          <p className="eyebrow">{mode === "create" ? "Создание" : "Редактирование"}</p>
          <strong id={titleId}>{mode === "create" ? "Создать предмет" : "Редактировать предмет"}</strong>
        </div>
        <ItemBadge label={mode === "create" ? "Новый" : "Custom"} tone={mode === "create" ? "accent" : "success"} />
      </div>

      {tools}
      {validationError ? <div className="notes-status notes-status-error">{validationError}</div> : null}

      <fieldset disabled={busy} className="form-grid items-editor-grid" style={{border:0,padding:0,minWidth:0}}>
        <label className="field field-full">
          <span>Название</span>
          <input
            autoFocus
            className="input"
            onChange={(event) => onFieldChange("name", event.target.value)}
            placeholder="Например: Кольчуга из мифрила"
            value={draft.name}
          />
        </label>

        <label className="field">
          <span>Категория</span>
          <select
            className="input"
            onChange={(event) => onCategoryChange(event.target.value as ItemCategory)}
            value={draft.category}
          >
            {Object.entries(itemCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Подкатегория</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("subcategory", event.target.value)}
            placeholder="Например: Лёгкая броня"
            value={draft.subcategory}
          />
        </label>

        <label className="field">
          <span>Редкость</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("rarity", event.target.value)}
            placeholder="Необязательно"
            value={draft.rarity}
          />
        </label>

        {isArmor ? (
          <label className="field">
            <span>Тип брони</span>
            <select
              className="input"
              onChange={(event) => onFieldChange("armorType", (event.target.value || null) as ArmorType)}
              value={draft.armorType ?? ""}
            >
              <option value="">Не указано</option>
              {Object.entries(armorTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>Цена покупки</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("buyPriceGp", event.target.value)}
            placeholder="Например: 75"
            value={draft.buyPriceGp}
          />
        </label>

        <label className="field">
          <span>Цена продажи</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("sellPriceGp", event.target.value)}
            placeholder="Например: 37.5"
            value={draft.sellPriceGp}
          />
        </label>

        <label className="field">
          <span>Вес</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("weightLb", event.target.value)}
            placeholder="Например: 55"
            value={draft.weightLb}
          />
        </label>

        {isWeapon ? (
          <>
            <label className="field">
              <span>Урон</span>
              <input
                className="input"
                onChange={(event) => onFieldChange("damage", event.target.value)}
                placeholder="Например: 1d8"
                value={draft.damage}
              />
            </label>

            <label className="field">
              <span>Тип урона</span>
              <input
                className="input"
                onChange={(event) => onFieldChange("damageType", event.target.value)}
                placeholder="Например: рубящий"
                value={draft.damageType}
              />
            </label>
          </>
        ) : null}

        {isArmor ? (
          <>
            <label className="field">
              <span>Класс брони</span>
              <input
                className="input"
                onChange={(event) => onFieldChange("armorClass", event.target.value)}
                placeholder="Например: 16"
                value={draft.armorClass}
              />
            </label>

            <label className="field">
              <span>Требование силы</span>
              <input
                className="input"
                onChange={(event) => onFieldChange("strengthRequirement", event.target.value)}
                placeholder="Например: 13"
                value={draft.strengthRequirement}
              />
            </label>

            <label className="field">
              <span>Помеха скрытности</span>
              <select
                className="input"
                onChange={(event) =>
                  onFieldChange("stealthDisadvantage", event.target.value as ItemDraft["stealthDisadvantage"])
                }
                value={draft.stealthDisadvantage}
              >
                <option value="">Не указано</option>
                <option value="true">Да</option>
                <option value="false">Нет</option>
              </select>
            </label>
          </>
        ) : null}

        <label className="field field-full">
          <span>Свойства</span>
          <input
            className="input"
            onChange={(event) => onFieldChange("propertiesText", event.target.value)}
            placeholder="Через запятую или с новой строки"
            value={draft.propertiesText}
          />
        </label>

        <label className="field field-full">
          <span>Описание</span>
          <textarea
            className="input textarea textarea-lg"
            onChange={(event) => onFieldChange("description", event.target.value)}
            placeholder="Коротко опиши, как предмет выглядит и зачем нужен мастеру за столом."
            value={draft.description}
          />
        </label>
      </fieldset>

      <div className="actions">
        <button className="ghost" disabled={busy} onClick={onCancel} type="button">
          Отмена
        </button>
        <button className="primary" disabled={busy} onClick={onSave} type="button">
          {mode === "create" ? "Создать предмет" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}

function ItemEditorModal({
  mode,
  draft,
  onCancel,
  onCategoryChange,
  onFieldChange,
  onSave,
  validationError, tools, busy
}: {
  mode: Exclude<ItemEditorMode, "closed">;
  draft: ItemDraft;
  onCancel: () => void;
  onCategoryChange: (category: ItemCategory) => void;
  onFieldChange: <Key extends keyof ItemDraft>(field: Key, value: ItemDraft[Key]) => void;
  onSave: () => void;
  validationError?: string;
  tools?: ReactNode;
  busy?: boolean;
}) {
  const dialogRef=useNativeDialog(true);
  const titleId = "items-editor-modal-title";
  const modal = (
    <dialog ref={dialogRef} className="app-native-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onCancel();}}>
      <div aria-labelledby={titleId} className="panel items-editor-panel items-editor-modal">
        <button aria-label="Закрыть форму предмета" className="items-modal-close items-editor-modal-close" onClick={onCancel} type="button">
          <CloseIcon />
        </button>

        <ItemEditorPanel
          tools={tools} busy={busy}
          draft={draft}
          mode={mode}
          onCancel={onCancel}
          onCategoryChange={onCategoryChange}
          onFieldChange={onFieldChange}
          onSave={onSave}
          titleId={titleId}
          validationError={validationError}
        />
      </div>
    </dialog>
  );

  return createPortal(modal, document.body);
}

type ItemsPageProps = {
  onCampaignChanged?:(campaign:CampaignData)=>void;
  ownerId: string;
  campaignId: string;
};

export function ItemsPage({ campaignId, ownerId, onCampaignChanged }: ItemsPageProps) {
  const route=useWorkspaceRoute();
  const searchInputRef = usePageSearchHotkey<HTMLInputElement>();
  const serverItems = useCustomItems(campaignId);
  const customItems = serverItems.items;
  const [importPreview, setImportPreview] = useState<CustomItemsPreview | null>(null);
  const [referenceChoices,setReferenceChoices]=useState<Record<string,string>>({});
  const [importItems, setImportItems] = useState<Item[]>([]);
  const [legacyStorageError,setLegacyStorageError]=useState(false);
  const [legacyRaw, setLegacyRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeRequested,setCloseRequested]=useState(false);
  const busyLock = useRef(false);
  const [editorRevision, setEditorRevision] = useState<number | undefined>();
  const [editorBase, setEditorBase] = useState<ItemDraft>(emptyItemDraft);
  const [itemConflict, setItemConflict] = useState<Item | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [activeTab, setActiveTab] = useWorkspaceListState<ItemTab>("items.tab","all");
  const [searchQuery, setSearchQuery] = useWorkspaceListState<string>("q","");
  const [categoryFilter, setCategoryFilter] = useWorkspaceListState<ItemCategory | "all">("items.category","all");
  const [armorTypeFilter, setArmorTypeFilter] = useWorkspaceListState<ArmorType | "all">("items.armor","all");
  const [sourceFilter, setSourceFilter] = useWorkspaceListState<ItemSource | "all">("items.source","all");
  const [priceFilter, setPriceFilter] = useWorkspaceListState<PriceFilter>("items.price","all");
  const [sortMode, setSortMode] = useWorkspaceListState<SortMode>("items.sort","name-asc");
  const [selectedItemId, setSelectedItemId] = useState("");
  useEffect(()=>{setSelectedItemId(route.target);setSearchQuery(route.query);},[route.target,route.query]);
  const [editorMode, setEditorMode] = useState<ItemEditorMode>("closed");
  const [editingItemId, setEditingItemId] = useState("");
  const [editorDraft, setEditorDraft] = useState<ItemDraft>(emptyItemDraft);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const itemDraft = useDeviceDraft({ownerId,campaignId,target:`item:${editorMode === "edit" ? editingItemId : "new"}`,revision:editorRevision ?? 0,
    enabled:editorMode!=="closed",dirty:JSON.stringify(editorDraft)!==JSON.stringify(editorBase),
    value:{draft:editorDraft,base:editorBase,id:editingItemId,revision:editorRevision,mode:editorMode},
    restore:({value})=>{if(!value.draft || typeof value.draft.name!=="string" || typeof value.id!=="string") {setError("Повреждённый черновик. Скачайте копию.");return;} setEditorDraft(value.draft);setEditorBase(value.base || emptyItemDraft());setEditingItemId(value.id);setEditorRevision(value.revision);}
  });
  useWorkspaceGuard(editorMode!=="closed"&&JSON.stringify(editorDraft)!==JSON.stringify(editorBase));
  const closeItemEditor=()=>{if(busyLock.current)return;if(JSON.stringify(editorDraft)!==JSON.stringify(editorBase)){setCloseRequested(true);return;}setEditorMode("closed");setItemConflict(null);};
  const prepareItemMerge = () => {
    if(!itemConflict)return;const current=itemToDraft(itemConflict),merged={...current};
    for(const key of Object.keys(editorDraft) as (keyof ItemDraft)[])if(JSON.stringify(editorDraft[key])!==JSON.stringify(editorBase[key]))Object.assign(merged,{[key]:editorDraft[key]});
    setEditorBase(current);setEditorDraft(merged);setEditorRevision(itemConflict.revision);setEditorMode("edit");setItemConflict(null);setError("");
  };
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const {
    catalogItems,
    catalogLoading,
    catalogError,
    loadingCatalogItemIds,
    ensureCatalogItemDetail, detailErrors, retryCatalog, hasMore, loadMore, catalogTotal
  } = useItemsCatalogController({ campaignId, filters:{q:deferredSearchQuery,sort:sortMode,price:priceFilter,category:categoryFilter==="all"?undefined:categoryFilter,armorType:armorTypeFilter==="all"?undefined:armorTypeFilter||undefined,source:sourceFilter==="dndsu-magic"||sourceFilter==="dndsu-equipment"?sourceFilter:undefined},enabled:sourceFilter!=="custom"&&sourceFilter!=="builtin" });

  useEffect(() => {
    setStorageHydrated(false);
    setLegacyRaw(browserStorage.getItem(buildCustomItemsStorageKey(campaignId)));
    setLegacyStorageError(browserStorage.keys()===null);
    const persistedUiState = itemsUiStateStorage.load(campaignId);

    if(!location.pathname.startsWith("/campaigns/")){
    setActiveTab(persistedUiState.activeTab ?? "all");
    setSearchQuery(route.query || persistedUiState.searchQuery || "");
    setCategoryFilter(persistedUiState.categoryFilter ?? "all");
    setArmorTypeFilter(persistedUiState.armorTypeFilter ?? "all");
    setSourceFilter(persistedUiState.sourceFilter ?? "all");
    setPriceFilter(persistedUiState.priceFilter ?? "all");
    setSortMode(persistedUiState.sortMode ?? "name-asc");
    }
    setSelectedItemId(route.target);
    setEditorMode("closed");
    setEditingItemId("");
    setEditorDraft(emptyItemDraft());
    setNotice("");
    setError("");
    setStorageHydrated(true);
  }, [campaignId]);


  useEffect(() => {
    if (!storageHydrated) {
      return;
    }
    itemsUiStateStorage.save(campaignId, {
      activeTab,
      searchQuery,
      categoryFilter,
      armorTypeFilter,
      sourceFilter,
      priceFilter,
      sortMode
    });
  }, [
    activeTab,
    armorTypeFilter,
    campaignId,
    categoryFilter,
    priceFilter,
    searchQuery,
    sortMode,
    sourceFilter,
    storageHydrated
  ]);

  useEffect(() => {
    if (categoryFilter !== "all" && categoryFilter !== "armor" && armorTypeFilter !== "all") {
      setArmorTypeFilter("all");
    }
  }, [armorTypeFilter, categoryFilter]);

  const officialItems = useMemo(
    () => [...builtInItems, ...catalogItems.map((item) => enrichRemoteItemWithBuiltInMetrics(item, builtInItemLookup))],
    [catalogItems]
  );
  const allItems = useMemo(() => [...officialItems, ...customItems], [customItems, officialItems]);

  const scopedItems = useMemo(() => {
    if (activeTab === "builtin") {
      return officialItems;
    }
    if (activeTab === "custom") {
      return customItems;
    }
    return allItems;
  }, [activeTab, allItems, customItems, officialItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(deferredSearchQuery);
    return scopedItems
      .filter((item) => {
        if (activeTab === "all" && sourceFilter !== "all" && item.source !== sourceFilter) {
          return false;
        }
        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }
        if (armorTypeFilter !== "all" && item.armorType !== armorTypeFilter) {
          return false;
        }
        if (!matchesPriceFilter(item, priceFilter)) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return buildItemSearchText(item).includes(normalizedQuery);
      })
      .sort(compareItems(sortMode));
  }, [activeTab, armorTypeFilter, categoryFilter, deferredSearchQuery, priceFilter, scopedItems, sortMode, sourceFilter]);

  useEffect(()=>{if(selectedItemId&&/^dndsu-/.test(selectedItemId))ensureCatalogItemDetail(selectedItemId);},[selectedItemId,ensureCatalogItemDetail]);
  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedItemId) ?? null,
    [allItems, selectedItemId]
  );

  const [visibleCount, setVisibleCount] = useState(48);
  useEffect(() => setVisibleCount(48), [activeTab, armorTypeFilter, categoryFilter, deferredSearchQuery, priceFilter, sortMode, sourceFilter]);

  useEffect(() => {
    if (!selectedItem || !isRemoteItem(selectedItem) || selectedItem.detailLoaded) {
      return;
    }
    ensureCatalogItemDetail(selectedItem.id);
  }, [ensureCatalogItemDetail, selectedItem]);



  useEffect(() => {
    if (editorMode !== "closed" || !selectedItemId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedItemId("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorMode, selectedItemId]);

  const tabOptions = useMemo(
    () => createTabOptions(officialItems.length, customItems.length),
    [customItems.length, officialItems.length]
  );

  const updateDraftField = <Key extends keyof ItemDraft>(field: Key, value: ItemDraft[Key]) => {
    setEditorDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateDraftCategory = (nextCategory: ItemCategory) => {
    setEditorDraft((current) => {
      const nextDraft: ItemDraft = {
        ...current,
        category: nextCategory
      };

      if (nextCategory !== "armor") {
        nextDraft.armorType = null;
        nextDraft.armorClass = "";
        nextDraft.strengthRequirement = "";
        nextDraft.stealthDisadvantage = "";
      } else if (!nextDraft.armorType) {
        nextDraft.armorType = "light";
      }

      if (nextCategory !== "weapon") {
        nextDraft.damage = "";
        nextDraft.damageType = "";
      }

      return nextDraft;
    });
  };

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const handleSelectItem = (itemId: string) => {
    clearMessages();
    navigateWorkspace(workspaceURL({...route,campaignId,section:"items",target:itemId,query:searchQuery}));
    setSelectedItemId(itemId);
    setEditorMode("closed");
    setEditingItemId("");
  };

  const handleCloseItemModal = () => {
    navigateWorkspace(workspaceURL({...route,campaignId,section:"items",target:"",query:searchQuery}));
    setSelectedItemId("");
  };

  const handleCreateItem = () => {
    clearMessages();
    setSelectedItemId("");
    setEditorMode("create"); setItemConflict(null); setEditorRevision(undefined);
    setEditingItemId(createCustomItemId());
    setEditorBase(emptyItemDraft());setEditorDraft(emptyItemDraft());
  };

  const handleEditItem = (item: Item) => {
    if (item.source !== "custom") {
      return;
    }
    clearMessages();
    setSelectedItemId("");
    setEditingItemId(item.id);
    setEditorMode("edit"); setItemConflict(null); setEditorRevision(item.revision);
    setEditorBase(itemToDraft(item));setEditorDraft(itemToDraft(item));
  };

  const revealSavedItem = (item: Item) => {
    setSearchQuery("");
    setSourceFilter((current) => (current !== "all" && current !== item.source ? "all" : current));
    setActiveTab((current) => (current === "builtin" ? "custom" : current));
    setCategoryFilter((current) => (current !== "all" && current !== item.category ? "all" : current));
    setArmorTypeFilter((current) =>
      current !== "all" && (item.category !== "armor" || item.armorType !== current) ? "all" : current
    );
    setPriceFilter((current) => (current !== "all" && !matchesPriceFilter(item, current) ? "all" : current));
  };

  const handleSaveItem = async () => {
    if(busyLock.current || itemDraft.candidate || itemConflict)return;
    if(!serverItems.document){setError("Сначала дождитесь загрузки серверного каталога.");return;}
    clearMessages();
    if (!editorDraft.name.trim()) {
      setError("Укажи название предмета.");
      return;
    }
    if (!editorDraft.description.trim()) {
      setError("Добавь описание, чтобы предмет можно было быстро понять прямо в карточке.");
      return;
    }

    const nextItem = createCustomItemFromDraft(editorDraft, editingItemId);
    busyLock.current=true;setBusy(true);
    try {
      const doc=await customItemsAPI.save(campaignId,nextItem,editorMode==="edit"?editorRevision:undefined);
      serverItems.apply(doc);itemDraft.clear();revealSavedItem(nextItem);setSelectedItemId(nextItem.id);setEditorMode("closed");setNotice("Предмет сохранён на сервере.");
      {const current=readWorkspaceRoute();if(current.campaignId===campaignId&&current.section==="items")navigateWorkspace(workspaceURL({...current,target:nextItem.id}),true);}
    } catch(reason) {if(isApiError(reason)&&reason.status===409&&reason.current)setItemConflict(reason.current as Item);setError(reason instanceof Error?reason.message:"Не удалось сохранить предмет.");}
    finally {busyLock.current=false;setBusy(false);}
  };

  const handleDeleteItem = async (item:Item) => {
    if(busyLock.current||item.source!=="custom"||!await confirmAction(`Удалить предмет «${item.name}» с сервера?`))return;
    busyLock.current=true;setBusy(true);
    try {serverItems.apply(await customItemsAPI.remove(campaignId,item));setSelectedItemId("");setEditorMode("closed");setNotice("Предмет удалён с сервера.");const current=readWorkspaceRoute();if(current.campaignId===campaignId&&current.section==="items")navigateWorkspace(workspaceURL({...current,target:""}),true);}
    catch(reason){setError(reason instanceof Error?reason.message:"Не удалось удалить предмет.");}
    finally{busyLock.current=false;setBusy(false);}
  };

  const exportCustomItems = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version:1, items:customItems}, null, 2)], {type:"application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "shadow-edge-custom-items.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const requestImportPreview = async (raw:string) => {
    if(busyLock.current)return;busyLock.current=true;setBusy(true);setImportPreview(null);setReferenceChoices({});
    try {
      const parsed=JSON.parse(raw),rows=Array.isArray(parsed)?parsed:parsed.items;
      if(!Array.isArray(rows)||!rows.length||rows.length>2000)throw new Error("Нужен непустой список до 2000 предметов.");
      const items=rows.map((raw:unknown)=>normalizeCustomItem(raw&&typeof raw==="object"?{...raw,source:"custom"}:raw));
      if(items.some(item=>!item))throw new Error("Есть повреждённые предметы. Исходная копия сохранена, импорт не выполнен.");
      const normalized=items as Item[];const preview=await customItemsAPI.preview(campaignId,normalized);
      setImportItems(normalized);setImportPreview(preview);setError("");
    }catch(reason){setError(reason instanceof Error?reason.message:"Не удалось подготовить перенос.");}
    finally{busyLock.current=false;setBusy(false);}
  };
  const previewImport = async(file?:File)=>{if(!file)return;if(file.size>2*1024*1024){setError("Файл больше 2 МиБ.");return;}await requestImportPreview(await file.text());};
  const commitImport = async()=>{
    if(busyLock.current||!importPreview)return;busyLock.current=true;setBusy(true);
    try{const doc=await customItemsAPI.import(campaignId,importItems,importPreview.revision,importPreview.campaignRevision,referenceChoices);serverItems.apply(doc);if(doc.campaign)onCampaignChanged?.(doc.campaign);setImportPreview(null);setNotice("Предметы перенесены на сервер. Исходная локальная копия сохранена.");}
    catch(reason){setError(reason instanceof Error?reason.message:"Перенос не подтверждён. Исходная копия сохранена.");setImportPreview(null);}
    finally{busyLock.current=false;setBusy(false);}
  };
  const exportLegacy=()=>{if(!legacyRaw)return;const url=URL.createObjectURL(new Blob([legacyRaw],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="shadow-edge-items-before-migration.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

  const armorFilterDisabled = categoryFilter !== "all" && categoryFilter !== "armor";
  const activeFilterCount = [categoryFilter, armorTypeFilter, sourceFilter, priceFilter].filter(value => value && value !== "all").length;
  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setArmorTypeFilter("all");
    setSourceFilter("all");
    setPriceFilter("all");
    setSortMode("name-asc");
  };

  return (
    <div className="items-workspace">
      <section className="card items-workspace-head">
        <div className="notes-workspace-copy">
          <h1>Предметы</h1>
          <p className="copy">Снаряжение, магические предметы и ваши находки</p>
          <p>Ваши предметы хранятся на сервере и доступны в этой кампании с других устройств.</p>
          <button className="ghost" type="button" disabled={!serverItems.document} onClick={exportCustomItems}>Экспорт моих предметов</button>
          <label>Импорт JSON <input style={{maxWidth:"100%",display:"block"}} disabled={busy} type="file" accept="application/json,.json" onChange={e=>{void previewImport(e.target.files?.[0]);e.target.value="";}}/></label>
          {legacyStorageError&&<p role="alert">Браузер не даёт прочитать старую локальную копию. Для её переноса разрешите хранилище или импортируйте ранее скачанный JSON. Серверные предметы доступны.</p>}
          {legacyRaw && <div className="card mini"><p>В этом браузере найдена прежняя локальная копия предметов этой кампании. Перенос выполняется только после предпросмотра и подтверждения; исходник останется на устройстве.</p>
            <button className="ghost" disabled={busy} onClick={()=>void requestImportPreview(legacyRaw)}>Предпросмотр переноса на сервер</button><button className="ghost" onClick={exportLegacy}>Скачать исходную локальную копию</button>
          </div>}
          {importPreview && <section className="card mini" aria-label="Предпросмотр переноса предметов">
            <p>{importPreview.alreadyImported?"Этот пакет уже перенесён. Повтор не создаст дубли и не восстановит удалённые предметы.":`Будет добавлено: ${importPreview.additions.length}. Уже существуют: ${importPreview.skipped}.`}</p>
            <p>При совпадении ID с другим содержимым будет создана отдельная копия. Существующие предметы не заменяются.</p>
            <p>Ссылок в ассортименте для переноса: {importPreview.referenceChanges.length}. Цены, количество и заметки позиций сохранятся.</p>
            {importPreview.referenceChoices.map(choice=>{const key=JSON.stringify([choice.shopId,choice.entryId]);return <label className="field" key={key}>Неоднозначная позиция «{choice.name}»<select value={referenceChoices[key]||""} onChange={e=>setReferenceChoices(old=>({...old,[key]:e.target.value}))}><option value="">Выберите связь перед переносом</option>{choice.options.map(item=><option value={item.id} key={item.id}>{item.id===choice.fromId?"Оставить основную запись":"Связать с импортируемой копией"}: {item.name} · {item.id}</option>)}</select><details><summary>Сравнить предметы</summary>{choice.options.map(item=><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}} key={item.id}>{JSON.stringify(item,null,2)}</pre>)}</details></label>})}
            {importPreview.warnings.map((warning,index)=><p role="alert" key={index}>{warning}</p>)}
            <ul>{importPreview.additions.map(item=><li style={{overflowWrap:"anywhere"}} key={item.id}>{item.name} · {item.id}</li>)}</ul>
            {!importPreview.alreadyImported&&<button className="primary" disabled={busy||importPreview.referenceChoices.some(choice=>!referenceChoices[JSON.stringify([choice.shopId,choice.entryId])])} onClick={()=>void commitImport()}>Подтвердить перенос на сервер</button>}
            <button className="ghost" disabled={busy} onClick={()=>setImportPreview(null)}>Закрыть предпросмотр</button>
          </section>}
          {serverItems.error&&<p role="alert">{serverItems.error}</p>}
          {!serverItems.document&&<p role="status">Загружаю серверные предметы…</p>}
        </div>

        <div className="actions">
          <button className="primary" disabled={busy || !serverItems.document} onClick={handleCreateItem} type="button">
            Создать предмет
          </button>
        </div>
      </section>

      {selectedItemId&&detailErrors[selectedItemId]&&<p role="alert">Описание предмета недоступно: {detailErrors[selectedItemId]} <button onClick={()=>ensureCatalogItemDetail(selectedItemId)}>Повторить описание</button></p>}
      {catalogLoading ? (
        <section className="card mini">
          <p className="copy">Подтягиваю внешний каталог предметов и подмешиваю его в общий поиск…</p>
        </section>
      ) : null}

      {catalogError ? (
        <section className="card mini">
          <p className="copy">Внешний каталог сейчас недоступен: {catalogError}</p><button onClick={retryCatalog}>Повторить загрузку каталога</button>
        </section>
      ) : null}

      <div className="items-workspace-grid">
        <aside className="card items-directory-panel">
          <div className="items-tab-row">
            {tabOptions.map((tab) => (
              <button
                key={tab.id}
                className={`tab items-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() =>
                  startTransition(() => {
                    clearMessages();
                    setActiveTab(tab.id);
                  })
                }
                type="button"
              >
                <span>{tab.label}</span>
                <small>{tab.count}</small>
              </button>
            ))}
          </div>

          <label className="field field-full">
            <span>Поиск</span>
            <input
              className="input"
              ref={searchInputRef}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Кольчуга, меч, тяжёлая броня, зелье..."
              value={searchQuery}
            />
          </label>

          <div className="items-quick-chip-row">
            {quickCategoryFilters.map((category) => {
              const active = categoryFilter === category;
              return (
                <button
                  key={category}
                  className={`chip items-quick-chip ${active ? "active" : ""}`}
                  onClick={() => setCategoryFilter(active ? "all" : category)}
                  type="button"
                >
                  {itemCategoryLabels[category]}
                </button>
              );
            })}
          </div>

          <details className="catalog-filter-disclosure">
            <summary>Фильтры{activeFilterCount ? ` · ${activeFilterCount}` : ""}</summary>
          <div className="items-filter-grid">
            <label className="field">
              <span>Категория</span>
              <select
                className="input"
                onChange={(event) => setCategoryFilter((event.target.value || "all") as ItemCategory | "all")}
                value={categoryFilter}
              >
                <option value="all">Все</option>
                {Object.entries(itemCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Тип брони</span>
              <select
                className="input"
                disabled={armorFilterDisabled}
                onChange={(event) => setArmorTypeFilter((event.target.value || "all") as ArmorType | "all")}
                value={armorTypeFilter ?? "all"}
              >
                <option value="all">Все</option>
                {Object.entries(armorTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {activeTab === "all" ? (
              <label className="field">
                <span>Источник</span>
                <select
                  className="input"
                  onChange={(event) => setSourceFilter((event.target.value || "all") as ItemSource | "all")}
                  value={sourceFilter}
                >
                  <option value="all">Все</option>
                  {Object.entries(itemSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <span>Цена</span>
              <select
                className="input"
                onChange={(event) => setPriceFilter((event.target.value || "all") as PriceFilter)}
                value={priceFilter}
              >
                <option value="all">Все</option>
                <option value="under-10">до 10 зм</option>
                <option value="10-100">10–100 зм</option>
                <option value="100-500">100–500 зм</option>
                <option value="500-plus">500+ зм</option>
              </select>
            </label>

            <div className="field items-filter-reset">
              <span>Фильтры</span>
              <button
                className="ghost fill"
                onClick={resetFilters}
                type="button"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
          </details>

          <div className="row muted items-directory-summary">
            <span>Найдено: {filteredItems.length}</span>
            <label className="field items-sort-field">
              <span>Сортировка</span>
              <select className="input" onChange={(event) => setSortMode(event.target.value as SortMode)} value={sortMode}>
                {Object.entries(sortModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

        </aside>

        <section className="card items-catalog-panel">
          {notice ? <div className="notes-status notes-status-success">{notice}</div> : null}
          {error && editorMode === "closed" ? <div className="notes-status notes-status-error">{error}</div> : null}

          <div className="items-catalog-header">
            <div className="stack tight">
              <h2>Каталог</h2>
            </div>

            <div className="items-catalog-summary">
              <span>{filteredItems.length} предметов</span>
            </div>
          </div>

          {editorMode === "create" || editorMode === "edit" ? (
            <ItemEditorModal
              draft={editorDraft}
              mode={editorMode}
              busy={busy}
              tools={<><DeviceDraftControls draft={itemDraft} label="черновик предмета"/>{itemConflict&&<section aria-label="Конфликт предмета"><p>Предмет изменился на сервере. Сравните версии; объединение сохранит остальные серверные поля и возьмёт ваши изменённые поля из формы.</p><details><summary>Актуальный предмет</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(itemConflict,null,2)}</pre></details><button className="ghost" onClick={prepareItemMerge}>Подготовить объединение предмета</button></section>}</>}
              onCancel={closeItemEditor}
              onCategoryChange={updateDraftCategory}
              onFieldChange={updateDraftField}
              onSave={() => void handleSaveItem()}
              validationError={error}
            />
          ) : null}

          {filteredItems.length ? (
            <div className="items-card-grid">
              {filteredItems.slice(0, visibleCount).map((item) => (
                <ItemListCard
                  key={item.id}
                  item={item}
                  onSelect={() => handleSelectItem(item.id)}
                  selected={editorMode === "closed" && selectedItemId === item.id}
                />
              ))}
            </div>
          ) : (
            <div className="items-preview-empty">
              <p className="eyebrow">Каталог</p>
              <h3>Список пуст по текущим фильтрам</h3>
              <p className="copy">Измените запрос или расширьте фильтры.</p>
              <button className="ghost" onClick={resetFilters} type="button">Показать все предметы</button>
            </div>
          )}

          {(visibleCount < filteredItems.length || hasMore) && (
            <div className="catalog-load-more">
              <span className="muted">Показано {Math.min(visibleCount,filteredItems.length)} · внешний каталог: {catalogTotal}</span>
              <button className="ghost" type="button" disabled={catalogLoading} onClick={() => {setVisibleCount((count) => count + 48);if(hasMore)void loadMore();}}>Показать ещё</button>
            </div>
          )}

          {editorMode === "closed" && selectedItem ? (
            <ItemDetailModal
              item={selectedItem}
              detailError={detailErrors[selectedItem.id]} onRetry={()=>ensureCatalogItemDetail(selectedItem.id)}
              isLoadingDetail={loadingCatalogItemIds.includes(selectedItem.id)}
              onClose={handleCloseItemModal}
              onDelete={() => void handleDeleteItem(selectedItem)}
              onEdit={() => handleEditItem(selectedItem)}
            />
          ) : null}
        </section>
      </div>
      <CloseConfirmDialog state={closeRequested?{title:"Закрыть форму предмета?",description:"Предмет ещё не сохранён на сервере. Локальная копия останется доступна для восстановления; при ошибке хранения скачайте её перед уходом.",confirmLabel:"Закрыть форму"}:null} onCancel={()=>setCloseRequested(false)} onConfirm={()=>{setEditorMode("closed");setItemConflict(null);setCloseRequested(false);}}/>
    </div>
  );
}
