import { useEffect, useRef } from "react";

const PAGE_SEARCH_FOCUS_EVENT = "shadow-edge:focus-page-search";

type PageSearchFocusRequest = {
  handled: boolean;
};

export function requestPageSearchFocus() {
  const detail: PageSearchFocusRequest = { handled: false };
  window.dispatchEvent(new CustomEvent<PageSearchFocusRequest>(PAGE_SEARCH_FOCUS_EVENT, { detail }));
  return detail.handled;
}

export function usePageSearchHotkey<T extends HTMLInputElement | HTMLTextAreaElement>() {
  const inputRef = useRef<T | null>(null);

  useEffect(() => {
    const handleFocusRequest = (event: Event) => {
      const request = (event as CustomEvent<PageSearchFocusRequest>).detail;
      if (!inputRef.current) {
        return;
      }

      request.handled = true;
      inputRef.current.focus();
      inputRef.current.select?.();
    };

    window.addEventListener(PAGE_SEARCH_FOCUS_EVENT, handleFocusRequest);
    return () => window.removeEventListener(PAGE_SEARCH_FOCUS_EVENT, handleFocusRequest);
  }, []);

  return inputRef;
}
