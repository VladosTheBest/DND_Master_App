import "./shops.css";
import builtInItemsRaw from "../../../../../dnd_items_150_ru_official_basic_rules_2014.json";
import { api } from "../../app/api";
import { useItemsCatalogController } from "../items/useItemsCatalogController";
import type { Item } from "../items/items.types";
import { enrichRemoteItemWithBuiltInMetrics, buildBuiltInItemLookup } from "../items/items.utils";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent
} from "react";
import type {
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
  inventory: ShopInventoryItem[];
};

const customItemsStorageVersion = "v1";
const customItemsStorageKey = (campaignId: string) => `shadow-edge.items.custom.${customItemsStorageVersion}.${campaignId}`;

const itemCategoryLabels: Record<string, string> = {
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

const builtInItems: Item[] = ((builtInItemsRaw as RawBuiltInItem[]) ?? []).map((raw) => ({
  id: `builtin-${raw.id ?? raw.name_en ?? raw.name_ru ?? crypto.randomUUID()}`,
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
    inventory: draft.inventory
  };
};

export function ShopsPage({
  campaign,
  hydrateCampaign
}: {
  campaign: CampaignData;
  hydrateCampaign: (campaign: CampaignData) => void;
}) {
  const [selectedShopId, setSelectedShopId] = useState(campaign.shops[0]?.id ?? "");
  const [draft, setDraft] = useState<ShopDraft>(() => shopToDraft(campaign.shops[0]));
  const [customItems, setCustomItems] = useState<Item[]>(() => loadCustomItems(campaign.id));
  const [itemQuery, setItemQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { catalogItems, catalogLoading, catalogError, ensureCatalogItemDetail } = useItemsCatalogController({ campaignId: campaign.id });

  useEffect(() => {
    setCustomItems(loadCustomItems(campaign.id));
  }, [campaign.id]);

  useEffect(() => {
    const selected = campaign.shops.find((shop) => shop.id === selectedShopId) ?? campaign.shops[0] ?? null;
    setSelectedShopId(selected?.id ?? "");
    setDraft(shopToDraft(selected));
  }, [campaign.shops, selectedShopId]);

  const allItems = useMemo(
    () => [
      ...builtInItems,
      ...catalogItems.map((item) => enrichRemoteItemWithBuiltInMetrics(item, builtInItemLookup)),
      ...customItems
    ],
    [catalogItems, customItems]
  );

  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(itemQuery);
    return allItems
      .filter((item) => {
        if (!query) {
          return true;
        }
        return normalizeSearch([item.name, item.description, item.rarity, item.subcategory, item.reference].filter(Boolean).join(" ")).includes(query);
      })
      .slice(0, 30);
  }, [allItems, itemQuery]);

  const selectedShop = campaign.shops.find((shop) => shop.id === selectedShopId) ?? null;
  const totalPrice = draft.inventory.reduce((sum, entry) => {
    const liveItem = itemById.get(entry.itemId);
    const price = entry.priceMode === "manual" ? entry.manualPriceGp : liveItem ? itemPrice(liveItem) : entry.itemPriceGp;
    return price == null ? sum : sum + price * (entry.quantity ?? 1);
  }, 0);

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

  const handleCreateShop = () => {
    const next = shopToDraft(null);
    setSelectedShopId("");
    setDraft(next);
    setNotice("");
    setError("");
  };

  const handleSelectShop = (shopId: string) => {
    const shop = campaign.shops.find((entry) => entry.id === shopId) ?? null;
    setSelectedShopId(shop?.id ?? "");
    setDraft(shopToDraft(shop));
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
      inventory: [stockItem, ...current.inventory]
    }));
    setNotice("");
    setError("");
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
      <section className="card shops-head">
        <div className="notes-workspace-copy">
          <p className="eyebrow">Магазины</p>
          <h1>Магазины</h1>
          <p className="copy">Создавай лавки, привязывай их к локациям и собирай ассортимент из предметов кампании и каталога.</p>
        </div>
        <div className="actions">
          <button className="ghost" disabled={saving} onClick={handleCreateShop} type="button">
            Новый магазин
          </button>
          <button className="primary" disabled={saving} onClick={() => void handleSave()} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      {notice ? <div className="notes-status notes-status-success">{notice}</div> : null}
      {error ? <div className="notes-status notes-status-error">{error}</div> : null}
      {catalogError ? <div className="notes-status notes-status-error">Каталог предметов недоступен: {catalogError}</div> : null}

      <div className="shops-grid">
        <aside className="card shops-list-panel">
          <div className="row muted">
            <span>Магазины</span>
            <strong>{campaign.shops.length}</strong>
          </div>
          <div className="shops-list">
            {campaign.shops.length ? (
              campaign.shops.map((shop) => (
                <button
                  key={shop.id}
                  className={`shops-list-item ${shop.id === selectedShopId ? "active" : ""}`}
                  onClick={() => handleSelectShop(shop.id)}
                  type="button"
                >
                  <strong>{shop.name}</strong>
                  <small>{shop.locationLabel || "Без локации"} · {shop.inventory.length} товаров</small>
                </button>
              ))
            ) : (
              <p className="copy">Пока нет магазинов. Создай первую лавку и добавь товары справа.</p>
            )}
          </div>
        </aside>

        <section className="card shops-editor-panel">
          <div className="shops-editor-top">
            <label className="field field-full">
              <span>Название магазина</span>
              <input className="input" onChange={(event) => updateDraft("name", event.target.value)} placeholder="Лавка редкостей Элвина" value={draft.name} />
            </label>
            <label className="field">
              <span>Локация</span>
              <select className="input" onChange={(event) => updateDraft("locationId", event.target.value)} value={draft.locationId}>
                <option value="">Без локации</option>
                {campaign.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Заметка для мастера</span>
              <textarea className="input textarea" onChange={(event) => updateDraft("description", event.target.value)} placeholder="Хозяин, репутация, скидки, что спрятано под прилавком..." value={draft.description} />
            </label>
          </div>

          <div className="shops-summary-strip">
            <span>{draft.inventory.length} товаров</span>
            <span>Оценка витрины: {formatGold(totalPrice)}</span>
            {selectedShop ? (
              <button className="ghost danger" disabled={saving} onClick={() => void handleDeleteShop()} type="button">
                Удалить магазин
              </button>
            ) : null}
          </div>

          <div className="shops-inventory">
            <div className="shops-section-head">
              <div>
                <p className="eyebrow">Ассортимент</p>
                <strong>Товары в продаже</strong>
              </div>
            </div>
            {draft.inventory.length ? (
              draft.inventory.map((entry) => {
                const liveItem = itemById.get(entry.itemId);
                const effectivePrice = entry.priceMode === "manual" ? entry.manualPriceGp : liveItem ? itemPrice(liveItem) : entry.itemPriceGp;
                return (
                  <article className="shops-stock-row" key={entry.id}>
                    <div className="shops-stock-main">
                      <strong>{liveItem?.name ?? entry.itemName}</strong>
                      <small>{itemCategoryLabels[liveItem?.category ?? entry.category ?? "other"] ?? "Предмет"} · {entry.priceMode === "manual" ? "ручная цена" : "цена предмета"}</small>
                    </div>
                    <label className="field shops-price-mode">
                      <span>Цена</span>
                      <select className="input" onChange={(event) => updateInventoryItem(entry.id, { priceMode: event.target.value as "item" | "manual" })} value={entry.priceMode}>
                        <option value="item">Из предмета</option>
                        <option value="manual">Вручную</option>
                      </select>
                    </label>
                    <label className="field shops-price-input">
                      <span>{entry.priceMode === "manual" ? "Зм" : "Текущая"}</span>
                      <input
                        className="input"
                        disabled={entry.priceMode !== "manual"}
                        min={0}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateInventoryItem(entry.id, { manualPriceGp: normalizeOptionalNumber(event.target.value) })}
                        placeholder={formatGold(effectivePrice)}
                        type="number"
                        value={entry.priceMode === "manual" && entry.manualPriceGp != null ? String(entry.manualPriceGp) : ""}
                      />
                    </label>
                    <label className="field shops-qty-input">
                      <span>Кол-во</span>
                      <input
                        className="input"
                        min={0}
                        onChange={(event) => updateInventoryItem(entry.id, { quantity: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })}
                        type="number"
                        value={entry.quantity ?? 1}
                      />
                    </label>
                    <input
                      className="input shops-note-input"
                      onChange={(event) => updateInventoryItem(entry.id, { note: event.target.value })}
                      placeholder="Заметка: под заказ, проклят, торг уместен..."
                      value={entry.note ?? ""}
                    />
                    <button className="ghost shops-remove-btn" onClick={() => updateDraft("inventory", draft.inventory.filter((item) => item.id !== entry.id))} type="button">
                      Убрать
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="shops-empty">
                <h3>Витрина пуста</h3>
                <p className="copy">Найди предмет ниже и добавь его в магазин. Цена подтянется автоматически, но её можно переопределить.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="card shops-picker-panel">
          <div className="shops-section-head">
            <div>
              <p className="eyebrow">Каталог</p>
              <strong>{catalogLoading ? "Загружаю предметы..." : "Добавить товар"}</strong>
            </div>
          </div>
          <label className="field field-full">
            <span>Поиск предмета</span>
            <input className="input" onChange={(event) => setItemQuery(event.target.value)} placeholder="меч, зелье, кольцо, armor..." value={itemQuery} />
          </label>
          <div className="shops-picker-list">
            {filteredItems.map((item) => (
              <button className="shops-picker-item" key={item.id} onClick={() => handleAddItem(item)} type="button">
                <span>
                  <strong>{item.name}</strong>
                  <small>{itemCategoryLabels[item.category] ?? "Предмет"} · {item.reference ?? item.source}</small>
                </span>
                <em>{itemPriceLabel(item)}</em>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
