import "./shops.css";
import { createPortal } from "react-dom";
import builtInItemsRaw from "../../../../../dnd_items_150_ru_official_basic_rules_2014.json";
import { api } from "../../app/api";
import { ItemDetailModal } from "../items/ItemsPage";
import { ItemCategoryIcon } from "../items/ItemCategoryIcon";
import { buildBuiltInItemLookup, enrichRemoteItemWithBuiltInMetrics } from "../items/items.utils";
import type { Item } from "../items/items.types";
import { useItemsCatalogController } from "../items/useItemsCatalogController";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from "react";
import type {
  AIProposal,
  CampaignData,
  CampaignShop,
  ItemCatalogCategory,
  LocationEntity,
  ShopInventoryItem
} from "@shadow-edge/shared-types";

type RawBuiltInItem = {
  id?: number;
  name_ru?: string | null;
  name_en?: string | null;
  category?: string | null;
  subtype?: string | null;
  source?: string | null;
  buy_price_gp?: number | null;
  sell_price_gp?: number | null;
  description_ru?: string | null;
  effects_ru?: string | null;
};

type ShopDraft = {
  id: string;
  name: string;
  locationId: string;
  description: string;
  gmNotes: string;
  art?: CampaignShop["art"];
  gallery: NonNullable<CampaignShop["gallery"]>;
  inventory: ShopInventoryItem[];
};

type CatalogCategoryFilter = "all" | Item["category"];
type SortMode = "default" | "name" | "price";
type ShopIconName =
  | "shop"
  | "plus"
  | "search"
  | "sliders"
  | "location"
  | "coin"
  | "box"
  | "more"
  | "trash"
  | "shield"
  | "sword";

const customItemsStorageVersion = "v1";
const customItemsStorageKey = (campaignId: string) => `shadow-edge.items.custom.${customItemsStorageVersion}.${campaignId}`;

const itemCategoryLabels: Record<string, string> = {
  armor: "Доспехи",
  weapon: "Оружие",
  potion: "Алхимия",
  poison: "Яды",
  staff: "Посохи",
  ring: "Кольца",
  scroll: "Свитки",
  wand: "Палочки",
  tool: "Инструменты",
  gear: "Снаряжение",
  focus: "Фокусы",
  clothing: "Одежда",
  other: "Разное"
};

const rarityGroup = (value?: string | null) => {
 const text = (value || "").toLocaleLowerCase("ru-RU");
 if (text.startsWith("очень редк")) return "Очень редкие";
 if (text.startsWith("необычн")) return "Необычные";
 if (text.startsWith("обычн")) return "Обычные";
 if (text.startsWith("редк") && !text.includes("варьируется")) return "Редкие";
 if (text.startsWith("легендарн")) return "Легендарные";
 if (text.includes("артефакт")) return "Артефакты";
 return value || "Не указана";
};

const subtypeLabels: Record<string, string> = { light: "Лёгкая броня", medium: "Средняя броня", heavy: "Тяжёлая броня", shield: "Щит", simple_melee: "Простое рукопашное", simple_ranged: "Простое дальнобойное", martial_melee: "Воинское рукопашное", martial_ranged: "Воинское дальнобойное", holy_symbol: "Священный символ", arcane_focus: "Магическая фокусировка", druidic_focus: "Фокусировка друида", consumable: "Расходник", ammunition: "Боеприпасы", container: "Контейнер", gear: "Снаряжение", apparel: "Одежда", poison: "Яд", potion: "Зелье", tool: "Инструмент", gaming_set: "Игровой набор", "musical instrument": "Музыкальный инструмент", musical_instrument: "Музыкальный инструмент" };

const normalizeSearch = (value: string) =>
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
  return trimmed || undefined;
};

const normalizeOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeBuiltInCategory = (value?: string | null): Item["category"] => {
  if (value === "armor" || value === "weapon" || value === "focus" || value === "tool") {
    return value;
  }
  if (value === "item") {
    return "gear";
  }
  return "other";
};

const builtInItems: Item[] = ((builtInItemsRaw as RawBuiltInItem[]) ?? []).map((raw, index) => ({
  id: `builtin-${raw.id ?? raw.name_en ?? raw.name_ru ?? index}`,
  source: "builtin",
  name: normalizeOptionalText(raw.name_ru) ?? normalizeOptionalText(raw.name_en) ?? "Без названия",
  category: normalizeBuiltInCategory(raw.category),
  subcategory: normalizeOptionalText(raw.subtype),
  rarity: null,
  description:
    normalizeOptionalText(raw.description_ru) ??
    normalizeOptionalText(raw.effects_ru) ??
    "Описание отсутствует.",
  buyPriceGp: normalizeOptionalNumber(raw.buy_price_gp),
  sellPriceGp: normalizeOptionalNumber(raw.sell_price_gp),
  reference: normalizeOptionalText(raw.source) ?? null
}));

const builtInItemLookup = buildBuiltInItemLookup(builtInItems);

const loadCustomItems = (campaignId: string): Item[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(customItemsStorageKey(campaignId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const item = entry as Partial<Item>;
        if (!item.id || !item.name) {
          return null;
        }
        return {
          ...item,
          source: "custom",
          category: item.category ?? "other",
          description: item.description ?? "Описание отсутствует.",
          buyPriceGp: normalizeOptionalNumber(item.buyPriceGp),
          sellPriceGp: normalizeOptionalNumber(item.sellPriceGp)
        } as Item;
      })
      .filter(Boolean) as Item[];
  } catch {
    return [];
  }
};

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);

const formatGold = (value?: number | null) => (value == null ? "цена не указана" : `${formatNumber(value)} зм`);

const itemPrice = (item: Item) => item.buyPriceGp ?? item.sellPriceGp ?? null;

const itemPriceLabel = (item: Item) => item.buyPriceLabel ?? item.sellPriceLabel ?? formatGold(itemPrice(item));

const shopToDraft = (shop?: CampaignShop | null): ShopDraft => ({
  id: shop?.id ?? createId("shop"),
  name: shop?.name ?? "",
  locationId: shop?.locationId ?? "",
  description: shop?.description ?? "",
  gmNotes: shop?.gmNotes ?? "",
  art: shop?.art,
  gallery: shop?.gallery?.map(image => ({ ...image })) ?? [],
  inventory: shop?.inventory?.map((entry) => ({ ...entry })) ?? []
});

const draftToShop = (draft: ShopDraft, locations: LocationEntity[]): CampaignShop => {
  const location = locations.find((entry) => entry.id === draft.locationId);
  return {
    id: draft.id,
    name: draft.name.trim() || "Новый магазин",
    locationId: draft.locationId || undefined,
    locationLabel: location?.title,
    description: draft.description.trim() || undefined,
    gmNotes: draft.gmNotes.trim() || undefined,
    art: draft.art,
    gallery: draft.gallery,
    inventory: draft.inventory
  };
};


const itemSubtypeLabel = (item?: Item | null, fallbackCategory?: string) => {
  const category = item?.category ?? fallbackCategory ?? "other";
  const base = itemCategoryLabels[category] ?? "Предмет";
  return item?.subcategory ? `${base} (${subtypeLabels[item.subcategory] || item.subcategory})` : base;
};

function ShopIcon({ name }: { name: ShopIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8
  };

  switch (name) {
    case "shop":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M4.2 8.2h11.6l-1-3.5H5.2l-1 3.5Z" />
          <path {...common} d="M5.4 8.2v7.1h9.2V8.2" />
          <path {...common} d="M7.2 15.3v-4h2.2v4M11.2 11.3h1.9" />
        </svg>
      );
    case "plus":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 4.5v11M4.5 10h11" />
        </svg>
      );
    case "search":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="8.8" cy="8.8" r="4.8" />
          <path {...common} d="m12.4 12.4 3.3 3.3" />
        </svg>
      );
    case "sliders":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M4 6.2h5.2M12.4 6.2H16M4 13.8h3.4M10.6 13.8H16" />
          <circle {...common} cx="10.8" cy="6.2" r="1.6" />
          <circle {...common} cx="9" cy="13.8" r="1.6" />
        </svg>
      );
    case "location":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 17s4.3-4.6 4.3-8A4.3 4.3 0 0 0 10 4.7 4.3 4.3 0 0 0 5.7 9c0 3.4 4.3 8 4.3 8Z" />
          <circle {...common} cx="10" cy="9" r="1.5" />
        </svg>
      );
    case "coin":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <ellipse {...common} cx="10" cy="5.8" rx="5.2" ry="2.4" />
          <path {...common} d="M4.8 5.8v5.8c0 1.3 2.3 2.4 5.2 2.4s5.2-1.1 5.2-2.4V5.8M4.8 8.7c0 1.3 2.3 2.4 5.2 2.4s5.2-1.1 5.2-2.4" />
        </svg>
      );
    case "box":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="m10 3.8 5.4 3v6.4l-5.4 3-5.4-3V6.8l5.4-3Z" />
          <path {...common} d="m4.8 7 5.2 3 5.2-3M10 10v5.9" />
        </svg>
      );
    case "more":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <circle cx="5.6" cy="10" r="1.1" fill="currentColor" />
          <circle cx="10" cy="10" r="1.1" fill="currentColor" />
          <circle cx="14.4" cy="10" r="1.1" fill="currentColor" />
        </svg>
      );
    case "trash":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M5.2 6.4h9.6M8.3 6.4V4.8h3.4v1.6M6.5 8.2l.5 7h6l.5-7M8.8 9.7v3.8M11.2 9.7v3.8" />
        </svg>
      );
    case "shield":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 3.4 15 5v4.2c0 3.1-1.9 5.6-5 7.4-3.1-1.8-5-4.3-5-7.4V5l5-1.6Z" />
          <path {...common} d="M10 5.6v8.1M7.2 8.4h5.6" />
        </svg>
      );
    case "sword":
      return (
        <svg className="shops-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M13.9 3.8 7.8 9.9M5.3 12.4l2.3-2.3 2.3 2.3-2.3 2.3-2.3-2.3Z" />
          <path {...common} d="m4.2 15.8 2-2M6.1 8.9l5 5" />
        </svg>
      );
    default:
      return null;
  }
}

function CoinPrice({ value }: { value?: number | null }) {
  if (value == null) return <span className="shops-price-unknown">Цена не указана</span>;
  const unit = value > 0 && value < 0.1 ? "copper" : value > 0 && value < 1 ? "silver" : "gold";
  const amount = value * (unit === "copper" ? 100 : unit === "silver" ? 10 : 1);
  const label = `${formatNumber(amount)} (${unit === "gold" ? "золотые" : unit === "silver" ? "серебряные" : "медные"} монеты)`;
  return <span className="shops-money" aria-label={label} title={label}>
    <span aria-hidden="true">{formatNumber(amount)}</span><span className={`shops-coin ${unit}`} aria-hidden="true">{unit === "gold" ? "G" : unit === "silver" ? "S" : "C"}</span>
  </span>;
}

function ShopImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="shops-image-viewer" aria-label="Изображение магазина" onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <button type="button" autoFocus className="shops-secondary-action" onClick={onClose}>Закрыть изображение</button>
    <img src={src} alt={alt} />
  </dialog>, document.body);
}

function ShopThumb({ seed, active }: { seed: string; active?: boolean }) {
  return (
    <span className={`shops-thumb ${active ? "active" : ""}`} data-seed={seed.length % 6}>
      <ShopIcon name="shop" />
    </span>
  );
}

function ItemThumb({ item, category }: { item?: Item | null; category?: string }) {
  return (
    <ItemCategoryIcon category={item?.category ?? category} />
  );
}

export function ShopsPage({
  campaign,
  focusedShopId,
  hydrateCampaign
}: {
  campaign: CampaignData;
  focusedShopId?: string;
  hydrateCampaign: (campaign: CampaignData) => void;
}) {
  const [selectedShopId, setSelectedShopId] = useState(campaign.shops[0]?.id ?? "");
  const [draft, setDraft] = useState<ShopDraft>(() => shopToDraft(campaign.shops[0]));
  const [customItems, setCustomItems] = useState<Item[]>(() => loadCustomItems(campaign.id));
  const [itemQuery, setItemQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CatalogCategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [armorFilter, setArmorFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [catalogSort, setCatalogSort] = useState("name");
  const [visibleCount, setVisibleCount] = useState(48);
  const [stockQuery, setStockQuery] = useState("");
  const [stockCategory, setStockCategory] = useState("all");
  const [imageViewer, setImageViewer] = useState<{src: string; alt: string} | null>(null);
  useEffect(() => { setStockQuery(""); setStockCategory("all"); }, [selectedShopId]);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [draggingItemId, setDraggingItemId] = useState("");
  const [stockDropActive, setStockDropActive] = useState(false);
  const [selectedInfoItemId, setSelectedInfoItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageDirection, setImageDirection] = useState("");
  const [imageProposal, setImageProposal] = useState<AIProposal | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const appliedFocusedShopIdRef = useRef("");
  const {
    catalogItems,
    catalogLoading,
    catalogError,
    loadingCatalogItemIds,
    ensureCatalogItemDetail
  } = useItemsCatalogController({ campaignId: campaign.id });

  useEffect(() => {
    setCustomItems(loadCustomItems(campaign.id));
  }, [campaign.id]);

  useEffect(() => {
    const selected = campaign.shops.find((shop) => shop.id === selectedShopId) ?? campaign.shops[0] ?? null;
    setSelectedShopId(selected?.id ?? "");
    setDraft(shopToDraft(selected));
  }, [campaign.shops, selectedShopId]);
  useEffect(() => {
    let cancelled = false;
    setImageProposal(null); setImageDirection("");
    if (selectedShopId) void api.listAIProposals({ campaignId: campaign.id, status: "pending" }).then(proposals => {
      if (!cancelled) setImageProposal(proposals.find(p => p.target.entityKind === "shop" && p.target.entityId === selectedShopId) ?? null);
    }).catch(() => { /* Generation reports actionable connection errors separately. */ });
    return () => { cancelled = true; };
  }, [selectedShopId, campaign.id]);

  useEffect(() => {
    if (!focusedShopId || appliedFocusedShopIdRef.current === focusedShopId) {
      return;
    }
    const focused = campaign.shops.find((shop) => shop.id === focusedShopId);
    if (!focused) {
      return;
    }
    appliedFocusedShopIdRef.current = focusedShopId;
    setSelectedShopId(focused.id);
    setDraft(shopToDraft(focused));
  }, [campaign.shops, focusedShopId]);

  const allItems = useMemo(
    () => [
      ...builtInItems,
      ...catalogItems.map((item) => enrichRemoteItemWithBuiltInMetrics(item, builtInItemLookup)),
      ...customItems
    ],
    [catalogItems, customItems]
  );

  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  const filteredShops = useMemo(() => {
    const query = normalizeSearch(shopQuery);
    if (!query) {
      return campaign.shops;
    }
    return campaign.shops.filter((shop) =>
      normalizeSearch([shop.name, shop.locationLabel, shop.description].filter(Boolean).join(" ")).includes(query)
    );
  }, [campaign.shops, shopQuery]);

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(itemQuery);
    return allItems.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return normalizeSearch([item.name, item.description, item.rarity, item.subcategory, item.reference].filter(Boolean).join(" ")).includes(query);
    }).filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (rarityFilter !== "all" && rarityGroup(item.rarity) !== rarityFilter) return false;
      if (categoryFilter === "armor" && armorFilter !== "all" && (item.armorType || item.subcategory) !== armorFilter) return false;
      const price = itemPrice(item);
      if (priceFilter === "unknown") return price == null;
      if (priceFilter !== "all" && price == null) return false;
      if (priceFilter === "under-10" && price! >= 10) return false;
      if (priceFilter === "10-100" && (price! < 10 || price! > 100)) return false;
      if (priceFilter === "100-500" && (price! <= 100 || price! > 500)) return false;
      if (priceFilter === "500-plus" && price! <= 500) return false;
      return true;
    }).sort((a, b) => catalogSort === "name" ? a.name.localeCompare(b.name, "ru") :
      itemPrice(a) == null ? (itemPrice(b) == null ? 0 : 1) : itemPrice(b) == null ? -1 :
      (itemPrice(a)! - itemPrice(b)!) * (catalogSort === "price-desc" ? -1 : 1));
  }, [allItems, categoryFilter, itemQuery, sourceFilter, rarityFilter, armorFilter, priceFilter, catalogSort]);
  useEffect(() => setVisibleCount(48), [categoryFilter, itemQuery, sourceFilter, rarityFilter, armorFilter, priceFilter, catalogSort]);
  const rarities = useMemo(() => [...new Set(allItems.map(item => rarityGroup(item.rarity)))].sort(), [allItems]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(shopToDraft(campaign.shops.find(shop => shop.id === selectedShopId) ?? { id: draft.id, name: "", inventory: [] }));
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const selectedShop = campaign.shops.find((shop) => shop.id === selectedShopId) ?? null;
  const selectedLocation = campaign.locations.find((location) => location.id === draft.locationId) ?? null;
  const selectedInfoItem = selectedInfoItemId ? itemById.get(selectedInfoItemId) ?? null : null;
  const totalPrice = draft.inventory.reduce((sum, entry) => {
    const liveItem = itemById.get(entry.itemId);
    const price = entry.priceMode === "manual" ? entry.manualPriceGp : liveItem ? itemPrice(liveItem) : entry.itemPriceGp;
    return price == null ? sum : sum + price * (entry.quantity ?? 1);
  }, 0);

  const sortedInventory = useMemo(() => {
    const inventory = draft.inventory.filter(entry => (stockCategory === "all" || entry.category === stockCategory) && normalizeSearch(`${itemById.get(entry.itemId)?.name ?? entry.itemName} ${entry.note || ""}`).includes(normalizeSearch(stockQuery)));
    if (sortMode === "name") {
      inventory.sort((left, right) => {
        const leftItem = itemById.get(left.itemId);
        const rightItem = itemById.get(right.itemId);
        return (leftItem?.name ?? left.itemName).localeCompare(rightItem?.name ?? right.itemName, "ru");
      });
    }
    if (sortMode === "price") {
      inventory.sort((left, right) => {
        const leftItem = itemById.get(left.itemId);
        const rightItem = itemById.get(right.itemId);
        const leftPrice = left.priceMode === "manual" ? left.manualPriceGp : leftItem ? itemPrice(leftItem) : left.itemPriceGp;
        const rightPrice = right.priceMode === "manual" ? right.manualPriceGp : rightItem ? itemPrice(rightItem) : right.itemPriceGp;
        return (leftPrice ?? Number.MAX_SAFE_INTEGER) - (rightPrice ?? Number.MAX_SAFE_INTEGER);
      });
    }
    return inventory;
  }, [draft.inventory, itemById, sortMode, stockCategory, stockQuery]);

  const updateDraft = <Key extends keyof ShopDraft>(key: Key, value: ShopDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
    setError("");
  };

  const updateInventoryItem = (entryId: string, patch: Partial<ShopInventoryItem>) => {
    setDraft((current) => ({
      ...current,
      inventory: current.inventory.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
    }));
    setNotice("");
    setError("");
  };

  const shopImageUrl = draft.art?.url;
  const imagePreview = imageProposal?.mediaIntents.find(intent => intent.field === "art.url" && intent.status === "staged" && intent.selected !== false)?.previewUrl;
  const handleGenerateImage = async () => {
    if (!selectedShop || dirty || imageBusy) return;
    setImageBusy(true); setError(""); setNotice("");
    try {
      const result = await api.runCodexPrompt({ campaignId: campaign.id,
        imageTarget: { entityId: selectedShop.id, entityKind: "shop" }, includeImages: true,
        prompt: imageDirection.trim() });
      const proposals = await Promise.all(result.proposalIds.map(id => api.getAIProposal(id)));
      const proposal = proposals.find(p => p.status === "pending" && p.target.entityKind === "shop" && p.target.entityId === selectedShop.id);
      if (!proposal) throw new Error(result.warning || "Генератор не вернул изображение магазина. Проверь подключение Codex в AI-помощнике.");
      if (!proposal.mediaIntents.some(intent => intent.field === "art.url" && intent.status === "staged" && intent.selected !== false && intent.previewUrl)) {
        throw new Error(result.warning || "Генератор не подготовил изображение. Прежний вариант сохранён, можно повторить попытку.");
      }
      setImageProposal(proposal);
      if (imageProposal && imageProposal.id !== proposal.id) {
        try { await api.rejectAIProposal(imageProposal.id); }
        catch { setError("Новое изображение готово. Предыдущий вариант можно отклонить в черновиках AI."); }
      }
      setNotice(result.warning || "Изображение подготовлено. Просмотри его перед сохранением.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать изображение."); }
    finally { setImageBusy(false); }
  };
  const handleApplyImage = async () => {
    if (!imageProposal || dirty || imageBusy) return;
    setImageBusy(true); setError("");
    try {
      const result = await api.applyAIProposal(imageProposal.id);
      if (result.campaign) hydrateCampaign(result.campaign);
      setImageProposal(null); setNotice("Изображение сохранено и добавлено в галерею магазина.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить изображение."); }
    finally { setImageBusy(false); }
  };
  const handleRejectImage = async () => {
    if (!imageProposal) return;
    setImageBusy(true); setError("");
    try { await api.rejectAIProposal(imageProposal.id); setImageProposal(null); setNotice(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отклонить изображение."); }
    finally { setImageBusy(false); }
  };

  const handleCreateShop = async () => {
    if (dirty && !window.confirm("Создать новый магазин? Несохранённые изменения будут потеряны.")) return;
    setSaving(true);
    setNotice("");
    setError("");
    const nextShop: CampaignShop = {
      id: createId("shop"),
      name: `Новый магазин ${campaign.shops.length + 1}`,
      inventory: []
    };

    try {
      const updatedCampaign = await api.updateCampaign(campaign.id, {
        shops: [nextShop, ...campaign.shops]
      });
      hydrateCampaign(updatedCampaign);
      setSelectedShopId(nextShop.id);
      setDraft(shopToDraft(nextShop));
      startTransition(() => setNotice("Новый магазин создан."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать магазин.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectShop = (shopId: string) => {
    if (shopId === selectedShopId || saving || imageBusy) return;
    if (dirty && !window.confirm("Перейти в другой магазин? Несохранённые изменения будут потеряны.")) return;
    const shop = campaign.shops.find((entry) => entry.id === shopId) ?? null;
    setSelectedShopId(shop?.id ?? "");
    setDraft(shopToDraft(shop));
    setNotice("");
    setError("");
  };

  const handleResetDraft = () => {
    setDraft(shopToDraft(selectedShop));
    setNotice("");
    setError("");
  };

  const handleAddItem = (item: Item) => {
    ensureCatalogItemDetail(item.id);
    const stockItem: ShopInventoryItem = {
      id: createId("stock"),
      itemId: item.id,
      itemName: item.name,
      itemSource: item.source,
      category: item.category as ItemCatalogCategory,
      priceMode: "item",
      itemPriceGp: itemPrice(item),
      itemPriceLabel: itemPriceLabel(item),
      quantity: 1,
      note: ""
    };
    setDraft((current) => ({
      ...current,
      inventory: current.inventory.some(entry => entry.itemId === item.id)
        ? current.inventory.map(entry => entry.itemId === item.id ? { ...entry, quantity: (entry.quantity ?? 1) + 1 } : entry)
        : [stockItem, ...current.inventory]
    }));
    setNotice("");
    setError("");
  };

  const handleOpenItemInfo = (item: Item | undefined | null) => {
    if (!item) {
      return;
    }
    ensureCatalogItemDetail(item.id);
    setSelectedInfoItemId(item.id);
  };

  const handleCatalogDragStart = (event: DragEvent<HTMLElement>, item: Item) => {
    setDraggingItemId(item.id);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", item.id);
  };

  const handleCatalogDragEnd = () => {
    setDraggingItemId("");
    setStockDropActive(false);
  };

  const handleStockDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setStockDropActive(true);
  };

  const handleStockDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggingItemId;
    const item = itemById.get(itemId);
    if (item) {
      handleAddItem(item);
    }
    setDraggingItemId("");
    setStockDropActive(false);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError("Укажи название магазина.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const nextShop = draftToShop(draft, campaign.locations);
      const shops = selectedShop
        ? campaign.shops.map((shop) => (shop.id === nextShop.id ? nextShop : shop))
        : [nextShop, ...campaign.shops];
      const updatedCampaign = await api.updateCampaign(campaign.id, { shops });
      hydrateCampaign(updatedCampaign);
      setSelectedShopId(nextShop.id);
      startTransition(() => setNotice("Магазин сохранён."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить магазин.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!selectedShop || !window.confirm(`Удалить магазин «${selectedShop.name}»?`)) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updatedCampaign = await api.updateCampaign(campaign.id, {
        shops: campaign.shops.filter((shop) => shop.id !== selectedShop.id)
      });
      hydrateCampaign(updatedCampaign);
      setSelectedShopId(updatedCampaign.shops[0]?.id ?? "");
      setNotice("Магазин удалён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить магазин.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shops-workspace">
      <aside className="shops-panel shops-directory-panel">
        <div className="shops-panel-header">
          <div className="shops-title-row">
            <span className="shops-title-icon">
              <ShopIcon name="shop" />
            </span>
            <h1>Магазины</h1>
          </div>
          <button className="shops-primary-action" disabled={saving || imageBusy} onClick={() => void handleCreateShop()} type="button">
            <ShopIcon name="plus" />
            <span>Новый магазин</span>
          </button>
        </div>

        <div className="shops-search-row">
          <label className="shops-search-box">
            <ShopIcon name="search" />
            <input aria-label="Поиск магазинов" onChange={(event) => setShopQuery(event.target.value)} placeholder="Поиск магазинов..." value={shopQuery} />
          </label>

        </div>

        <div className="shops-list">
          {filteredShops.length ? (
            filteredShops.map((shop) => (
              <button
                key={shop.id}
                className={`shops-list-card ${shop.id === selectedShopId ? "active" : ""}`}
                aria-pressed={shop.id === selectedShopId}
                onClick={() => handleSelectShop(shop.id)}
                type="button"
              >
                {shop.art?.url ? <img className="shops-list-image" src={shop.art.url} alt="" loading="lazy" /> : <ShopThumb active={shop.id === selectedShopId} seed={shop.name} />}
                <span className="shops-list-copy">
                  <strong>{shop.name}</strong>
                  <small>{shop.locationLabel || "Без локации"}</small>
                  <small>Позиций: {shop.inventory.length}</small>
                </span>

              </button>
            ))
          ) : (
            <div className="shops-empty-state compact">
              <strong>Магазины не найдены</strong>
              <span>Смени поиск или создай новую лавку.</span>
            </div>
          )}
        </div>

        <div className="shops-directory-foot">Показано {filteredShops.length} из {campaign.shops.length} магазинов</div>
      </aside>

      {imageBusy ? <p role="status">Готовлю изображение магазина. Пожалуйста, дождись завершения…</p> : null}
      <main className="shops-panel shops-editor-panel" {...((saving || imageBusy) ? { inert: "" } : {})}>
        <div className="shops-editor-hero">
          <ShopThumb active seed={draft.name || "shop"} />
          <div className="shops-editor-title">
            <input
              className="shops-name-input"
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Название магазина"
              value={draft.name}
              aria-label="Название магазина"
            />
            <div className="shops-editor-meta">
              <label className="shops-select-pill">
                <ShopIcon name="location" />
                <select aria-label="Локация магазина" onChange={(event) => updateDraft("locationId", event.target.value)} value={draft.locationId}>
                  <option value="">Без локации</option>
                  {campaign.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.title}
                    </option>
                  ))}
                </select>
              </label>

            </div>
          </div>
          <div className="shops-hero-actions">
            {dirty ? <small role="status">Есть изменения</small> : null}
            <button className="shops-secondary-action" disabled={saving || imageBusy || !dirty} onClick={handleResetDraft} type="button">
              Отмена
            </button>
            <button className="shops-primary-action" disabled={saving || imageBusy} onClick={() => void handleSave()} type="button">
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>
          </div>
        </div>

        {notice || error || catalogError ? (
          <div className="shops-status-stack">
            {notice ? <div role="status" className="notes-status notes-status-success">{notice}</div> : null}
            {error ? <div role="alert" className="notes-status notes-status-error">{error}</div> : null}
            {catalogError ? <div className="notes-status notes-status-error">Каталог предметов недоступен: {catalogError}</div> : null}
          </div>
        ) : null}

        <div className={`shops-overview-grid ${draft.art?.url ? "has-image" : ""}`}>
          <label className="shops-description-card"><span className="shops-field-caption">Описание для посетителей</span>
            <textarea
              onChange={(event) => updateDraft("description", event.target.value)}
              aria-label="Описание магазина"
              placeholder="Что видят посетители: интерьер, владелец, атмосфера, условия торговли…"
              value={draft.description}
            />
            <span className="shops-edit-mark">✎</span>
          </label>
          {shopImageUrl ? <button type="button" aria-haspopup="dialog" className="shops-cover" aria-label={`Открыть изображение магазина «${draft.name}»`} onClick={() => setImageViewer({src: shopImageUrl, alt: draft.art?.alt || draft.name})}>
            <img src={shopImageUrl} alt={draft.art?.alt || draft.name} /><span>Открыть изображение ↗</span>
          </button> : null}
        </div>

        <details className="shops-image-details" open={Boolean(imagePreview)}><summary>Изображение магазина{draft.art?.url ? " · добавлено" : " · создать по описанию"}</summary>
        <section className="shops-art" aria-label="Изображение магазина">
          {imagePreview ? <button type="button" className="shops-cover" aria-label="Открыть предпросмотр изображения" onClick={() => setImageViewer({src: imagePreview, alt: "Предпросмотр изображения магазина"})}><img src={imagePreview} alt="Предпросмотр изображения магазина" /><span>Открыть предпросмотр ↗</span></button> : null}
          <div className="shops-art-controls">
            <strong>{imagePreview ? "Новое изображение · предпросмотр" : "Изображение магазина"}</strong>
            <p>По описанию и ассортименту, с учётом количества товаров. Утверждённые варианты сохраняются в галерее.</p>
            <details><summary>Пожелания к изображению</summary><label>Атмосфера и стиль<textarea value={imageDirection} disabled={imageBusy} onChange={e => setImageDirection(e.target.value)} placeholder="Например: тёплый свет свечей, тесная лавка алхимика…" /></label></details>
            {dirty || !selectedShop ? <small>Сначала сохрани магазин и ассортимент.</small> : null}
            {imageProposal ? <div className="shops-hero-actions">
              <button className="shops-primary-action" disabled={!imagePreview || imageBusy || dirty} onClick={() => void handleApplyImage()} type="button">Использовать изображение</button>
              <button className="shops-secondary-action" disabled={imageBusy || saving || dirty || !selectedShop} onClick={() => void handleGenerateImage()} type="button">Сгенерировать заново</button>
              <button className="shops-secondary-action" disabled={imageBusy} onClick={() => void handleRejectImage()} type="button">Отклонить</button>
            </div> : <button className="shops-secondary-action" disabled={imageBusy || saving || dirty || !selectedShop} onClick={() => void handleGenerateImage()} type="button">{imageBusy ? "Создаю изображение…" : shopImageUrl ? "Сгенерировать заново" : "Сгенерировать изображение"}</button>}
            {imageBusy ? <small role="status">Это может занять несколько минут. Дождись результата.</small> : null}
          </div>
        </section>
        </details>

        {draft.gallery.length > 0 ? <details className="shops-image-details shops-gallery"><summary>Галерея · {draft.gallery.length}</summary>
          <div className="shops-gallery-grid">{draft.gallery.map(image => <button key={image.url} type="button" aria-haspopup="dialog" aria-label={`Открыть: ${image.title || draft.name}`} onClick={() => setImageViewer({ src: image.url, alt: image.title || draft.name })}>
            <img src={image.url} alt={image.title || draft.name} loading="lazy" /><span>{image.title || "Изображение магазина"}</span>
          </button>)}</div>
        </details> : null}

        <details className="shops-gm-notes">
          <summary>Только мастеру · скрытые находки и проверки{draft.gmNotes.trim() ? " •" : ""}</summary>
          <label>Секреты магазина
            <textarea value={draft.gmNotes} onChange={event => updateDraft("gmNotes", event.target.value)} rows={6}
              placeholder={`Например: Внимательность СЛ 14 — царапины у потайного ящика.
Расследование СЛ 16 — двойное дно, внутри письмо.
Проницательность СЛ 12 — торговец скрывает происхождение кольца.`} />
          </label>
          <small>Эти записи хранятся отдельно от описания и не используются для изображения магазина.</small>
        </details>

        <section
          className={`shops-stock-section ${stockDropActive ? "drop-active" : ""}`}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStockDropActive(false); }}
          onDragOver={handleStockDragOver}
          onDrop={handleStockDrop}
        >
          <div className="shops-stock-head">
            <h2>Ассортимент <small>{draft.inventory.length}</small></h2>
            <button type="button" className="shops-secondary-action" onClick={() => document.getElementById("shop-catalog-search")?.focus()}>Добавить товары</button>
            <span className="shops-head-line" />
            <label className="shops-sort-select">
              <span>Сортировка:</span>
              <select onChange={(event) => setSortMode(event.target.value as SortMode)} value={sortMode}>
                <option value="default">По умолчанию</option>
                <option value="name">По названию</option>
                <option value="price">По цене</option>
              </select>
            </label>
          </div>

          <div className="shops-stock-toolbar">
            <label className="shops-search-box"><ShopIcon name="search" /><input aria-label="Поиск в ассортименте" placeholder="Найти на витрине…" value={stockQuery} onChange={e => setStockQuery(e.target.value)} /></label>
            <select aria-label="Категория ассортимента" value={stockCategory} onChange={e => setStockCategory(e.target.value)}><option value="all">Все категории</option>{Object.entries(itemCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <span className="shops-stock-total" title="Сумма известных цен с учётом количества; товары без цены не включены">Оценка <CoinPrice value={totalPrice} /></span>
          </div>
          {stockDropActive ? <p role="status">Отпустите, чтобы добавить товар</p> : null}
          <div className="shops-stock-table">


            {sortedInventory.length ? (
              sortedInventory.map((entry) => {
                const liveItem = itemById.get(entry.itemId);
                const effectivePrice = entry.priceMode === "manual" ? entry.manualPriceGp : liveItem ? itemPrice(liveItem) : entry.itemPriceGp;
                return (
                  <article className="shops-stock-row" key={entry.id}>

                    <button
                      className="shops-stock-product shops-stock-product-button"
                      disabled={!liveItem}
                      onClick={() => handleOpenItemInfo(liveItem)}
                      title={liveItem ? "Открыть карточку предмета" : "Предмет не найден в каталоге"}
                      type="button"
                    >
                      <ItemThumb category={entry.category} item={liveItem} />
                      <span><strong>{liveItem?.name ?? entry.itemName}</strong><small>{itemSubtypeLabel(liveItem, entry.category)}</small></span>
                    </button>
                    <div className="shops-stock-price"><CoinPrice value={effectivePrice} /><small>за штуку</small></div>
                    <details className="shops-stock-options"><summary>Цена и заметка{entry.priceMode === "manual" || entry.note ? " •" : ""}</summary>
                      <label>Цена<select aria-label={`Цена: ${entry.itemName}`} onChange={event => updateInventoryItem(entry.id, {priceMode: event.target.value as "item" | "manual"})} value={entry.priceMode}><option value="item">Из каталога</option><option value="manual">Своя цена</option></select></label>
                      {entry.priceMode === "manual" ? <label>В золотых монетах<input aria-label={`Своя цена в зм: ${entry.itemName}`} type="number" min={0} step="0.01" value={entry.manualPriceGp ?? ""} placeholder="Цена" onChange={event => updateInventoryItem(entry.id, {manualPriceGp: normalizeOptionalNumber(event.target.value)})} /></label> : null}
                      <label>Заметка мастера<input aria-label={`Заметка: ${entry.itemName}`} onChange={event => updateInventoryItem(entry.id, {note: event.target.value})} placeholder="Особенности товара…" value={entry.note ?? ""} /></label>
                    </details>
                    <div className="shops-quantity-cell">
                      <button aria-label={`Уменьшить количество: ${entry.itemName}`} disabled={(entry.quantity ?? 1) === 0} onClick={() => updateInventoryItem(entry.id, { quantity: Math.max(0, (entry.quantity ?? 1) - 1) })} type="button">
                        −
                      </button>
                      <input
                        min={0}
                        onChange={(event) => updateInventoryItem(entry.id, { quantity: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })}
                        type="number"
                        aria-label={`Количество: ${entry.itemName}`}
                        value={entry.quantity ?? 1}
                      />
                      <button aria-label={`Увеличить количество: ${entry.itemName}`} onClick={() => updateInventoryItem(entry.id, { quantity: (entry.quantity ?? 1) + 1 })} type="button">
                        +
                      </button>
                    </div>
                    <button
                      className="shops-delete-stock"
                      onClick={() => updateDraft("inventory", draft.inventory.filter((item) => item.id !== entry.id))}
                      title="Убрать товар"
                      aria-label={`Убрать товар: ${entry.itemName}`}
                      type="button"
                    >
                      <ShopIcon name="trash" />
                    </button>
                  </article>
                );
              })
            ) : (
              <div className={`shops-empty-state ${stockDropActive ? "drop-active" : ""}`}>
                <strong>{draft.inventory.length ? "Товары не найдены" : "Витрина пуста"}</strong>
                {draft.inventory.length ? <button type="button" className="shops-secondary-action" onClick={() => {setStockQuery(""); setStockCategory("all");}}>Сбросить поиск</button> : <span>Добавьте товары из каталога ниже.</span>}
              </div>
            )}
          </div>

          {selectedShop ? (
            <button className="shops-delete-shop" disabled={saving || imageBusy} onClick={() => void handleDeleteShop()} type="button">
              Удалить магазин
            </button>
          ) : null}
        </section>
      </main>

      <aside className="shops-panel shops-catalog-panel" {...((saving || imageBusy) ? { inert: "" } : {})}>
        <div className="shops-catalog-head">
          <div className="shops-title-row">
            <span className="shops-title-icon">
              <ShopIcon name="box" />
            </span>
            <h2>Каталог товаров</h2>
          </div>
        </div>

        <label className="shops-search-box">
          <ShopIcon name="search" />
          <input id="shop-catalog-search" aria-label="Поиск товаров" onChange={(event) => setItemQuery(event.target.value)} placeholder="Поиск в каталоге..." value={itemQuery} />
        </label>

        <details className="shops-filter-details"><summary>Фильтры{[categoryFilter,sourceFilter,rarityFilter,armorFilter,priceFilter].some(value => value !== "all") ? ` · ${[categoryFilter,sourceFilter,rarityFilter,armorFilter,priceFilter].filter(value => value !== "all").length}` : ""}</summary><div className="shops-catalog-filters">
          <label>Категория<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as CatalogCategoryFilter)}>
            <option value="all">Все категории</option>{Object.entries(itemCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Источник<select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="all">Все источники</option><option value="builtin">Базовые предметы</option><option value="custom">Мои предметы</option><option value="dndsu-equipment">DnD.su · снаряжение</option><option value="dndsu-magic">DnD.su · магические</option>
          </select></label>
          <label>Редкость<select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)}>
            <option value="all">Любая редкость</option>{rarities.map(value => <option key={value}>{value}</option>)}
          </select></label>
          <label>Цена<select value={priceFilter} onChange={e => setPriceFilter(e.target.value)}>
            <option value="all">Любая цена</option><option value="under-10">До 10 зм</option><option value="10-100">10–100 зм</option><option value="100-500">Больше 100–500 зм</option><option value="500-plus">Больше 500 зм</option><option value="unknown">Без цены</option>
          </select></label>
          {categoryFilter === "armor" ? <label>Тип брони<select value={armorFilter} onChange={e => setArmorFilter(e.target.value)}>
            <option value="all">Любой тип</option><option value="light">Лёгкая</option><option value="medium">Средняя</option><option value="heavy">Тяжёлая</option><option value="shield">Щиты</option>
          </select></label> : null}
          <label>Порядок<select value={catalogSort} onChange={e => setCatalogSort(e.target.value)}><option value="name">По названию</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select></label>
          <button type="button" className="shops-secondary-action" onClick={() => { setItemQuery(""); setCategoryFilter("all"); setSourceFilter("all"); setRarityFilter("all"); setArmorFilter("all"); setPriceFilter("all"); }}>Сбросить фильтры</button>
        </div>

        </details>
        <div className={`shops-catalog-drop ${stockDropActive ? "drop-active" : ""}`}
          onDragOver={handleStockDragOver} onDrop={handleStockDrop}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStockDropActive(false); }}>
          <strong>{stockDropActive ? "Отпусти товар здесь" : `Позиций в ассортименте: ${draft.inventory.length}`}</strong>
          <span>Перетащи сюда товар из каталога или нажми «Добавить»</span>
          <button type="button" className="shops-primary-action" disabled={!dirty || saving || imageBusy} onClick={() => void handleSave()}>Сохранить ассортимент</button>
        </div>
        <div className="shops-picker-list">
          {filteredItems.slice(0, visibleCount).map((item) => (
            <article
              className={`shops-picker-item ${draggingItemId === item.id ? "dragging" : ""}`}
              draggable
              key={item.id}
              onDragEnd={handleCatalogDragEnd}
              onDragStart={(event) => handleCatalogDragStart(event, item)}
            >
              <button className="shops-picker-info" onClick={() => handleOpenItemInfo(item)} type="button">
                <ItemThumb item={item} />
                <span className="shops-picker-copy">
                  <strong>{item.name}</strong>
                  <small>{itemSubtypeLabel(item)} · {item.rarity || "Без редкости"}</small>
                  <small>{item.buyPriceLabel || item.sellPriceLabel ? itemPriceLabel(item) : <CoinPrice value={itemPrice(item)} />}</small>
                </span>
              </button>
              <button className="shops-picker-add" onClick={() => handleAddItem(item)} title={`Добавить ${item.name} в магазин`} aria-label={`Добавить ${item.name}`} type="button">
                {draft.inventory.some(entry => entry.itemId === item.id) ? "+1" : "Добавить"}
              </button>
            </article>
          ))}
        </div>

        {!filteredItems.length ? <p role="status">Товаров не найдено. Измени запрос или сбрось фильтры.</p> : null}
        <div className="shops-catalog-foot" aria-live="polite">{catalogLoading ? "Загружаю внешний каталог…" : `Показано ${Math.min(visibleCount, filteredItems.length)} из ${filteredItems.length} товаров`}</div>
        {visibleCount < filteredItems.length ? <button className="shops-secondary-action" type="button" onClick={() => setVisibleCount(count => count + 48)}>Показать ещё 48</button> : null}
      </aside>
      {imageViewer ? <ShopImageViewer src={imageViewer.src} alt={imageViewer.alt} onClose={() => setImageViewer(null)} /> : null}
      {selectedInfoItem ? (
        <ItemDetailModal
          item={selectedInfoItem}
          isLoadingDetail={loadingCatalogItemIds.includes(selectedInfoItem.id)}
          onClose={() => setSelectedInfoItemId("")}
        />
      ) : null}
    </div>
  );
}
