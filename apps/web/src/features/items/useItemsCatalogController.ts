import { useEffect, useRef, useState } from "react";
import { api } from "../../app/api";
import type { Item } from "./items.types";
import {
  applyCatalogDetailToItem,
  catalogSummaryToItem,
  isRemoteItem,
  loadCachedRemoteItemDetails,
  mergeCatalogItemWithCachedDetail,
  rememberRemoteItemDetail
} from "./items.utils";

type UseItemsCatalogControllerParams = {
  campaignId: string;
};

type UseItemsCatalogControllerResult = {
  catalogItems: Item[];
  catalogLoading: boolean;
  catalogError: string;
  loadingCatalogItemIds: string[];
  ensureCatalogItemDetail: (itemId: string) => void;
};

export function useItemsCatalogController({
  campaignId
}: UseItemsCatalogControllerParams): UseItemsCatalogControllerResult {
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [loadingCatalogItemIds, setLoadingCatalogItemIds] = useState<string[]>([]);
  const catalogItemsRef = useRef<Item[]>([]);
  const loadingIdsRef = useRef<string[]>([]);

  useEffect(() => {
    catalogItemsRef.current = catalogItems;
  }, [catalogItems]);

  useEffect(() => {
    loadingIdsRef.current = loadingCatalogItemIds;
  }, [loadingCatalogItemIds]);

  useEffect(() => {
    let cancelled = false;

    setCatalogItems([]);
    setCatalogLoading(true);
    setCatalogError("");
    setLoadingCatalogItemIds([]);

    const cachedDetails = loadCachedRemoteItemDetails();

    api
      .browseItemCatalog()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setCatalogItems(
          result.items.map((summary) => {
            const summaryItem = catalogSummaryToItem(summary);
            const cachedItem = cachedDetails[summary.id]?.item;
            return cachedItem ? mergeCatalogItemWithCachedDetail(summaryItem, cachedItem) : summaryItem;
          })
        );
      })
      .catch((reason) => {
        if (cancelled) {
          return;
        }
        setCatalogItems([]);
        setCatalogError(reason instanceof Error ? reason.message : "Не удалось загрузить внешний каталог предметов.");
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const ensureCatalogItemDetail = (itemId: string) => {
    const target = catalogItemsRef.current.find((item) => item.id === itemId);
    if (!target || !isRemoteItem(target) || target.detailLoaded || loadingIdsRef.current.includes(itemId)) {
      return;
    }

    setLoadingCatalogItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));

    void api
      .getCatalogItem(itemId)
      .then((detail) => {
        setCatalogItems((current) =>
          current.map((item) => {
            if (item.id !== itemId) {
              return item;
            }
            const nextItem = applyCatalogDetailToItem(item, detail);
            rememberRemoteItemDetail(nextItem);
            return nextItem;
          })
        );
      })
      .catch(() => {
        // Keep summary cards usable even if a detail request fails.
      })
      .finally(() => {
        setLoadingCatalogItemIds((current) => current.filter((entryId) => entryId !== itemId));
      });
  };

  return {
    catalogItems,
    catalogLoading,
    catalogError,
    loadingCatalogItemIds,
    ensureCatalogItemDetail
  };
}
