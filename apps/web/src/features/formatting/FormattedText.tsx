import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import "./formatting.css";

export function FormattedText({ content, entityByTitle, onMentionClick }: {
  content: string;
  entityByTitle?: Map<string, KnowledgeEntity>;
  onMentionClick?: (id: string) => void;
}) {
  const html = useMemo(() => {
    const parsed = marked.parse(content, { gfm: true, breaks: true, async: false });
    const fragment = DOMPurify.sanitize(parsed, {
      ALLOWED_TAGS: ["p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "del", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "pre", "code"],
      ALLOWED_ATTR: [], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true
    });
    // Resolve wiki mentions in text nodes after parsing, never through raw HTML interpolation.
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (node.parentElement?.closest("code, pre")) continue;
      const pattern = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
      const matches = [...node.data.matchAll(pattern)];
      if (!matches.length) continue;
      const replacement = document.createDocumentFragment(); let offset = 0;
      for (const match of matches) {
        replacement.append(node.data.slice(offset, match.index));
        const target = entityByTitle?.get(match[1].trim());
        const label = (match[2] ?? match[1]).trim();
        if (target && onMentionClick) {
          const button = document.createElement("button");
          button.type = "button"; button.className = "mention"; button.dataset.entityId = target.id; button.textContent = label;
          replacement.append(button);
        } else replacement.append(label);
        offset = match.index! + match[0].length;
      }
      replacement.append(node.data.slice(offset)); node.replaceWith(replacement);
    }
    for (const table of fragment.querySelectorAll("table")) {
      const scroll = document.createElement("div"); scroll.className = "formatted-table-scroll"; scroll.tabIndex = 0;
      scroll.setAttribute("role", "region"); scroll.setAttribute("aria-label", "Таблица");
      table.replaceWith(scroll); scroll.append(table);
    }
    const wrapper = document.createElement("div"); wrapper.append(fragment); return wrapper.innerHTML;
  }, [content, entityByTitle, onMentionClick]);
  return <div className="formatted-text" onClick={(event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-entity-id]");
    if (button && event.currentTarget.contains(button)) onMentionClick?.(button.dataset.entityId!);
  }} dangerouslySetInnerHTML={{ __html: html }} />;
}
