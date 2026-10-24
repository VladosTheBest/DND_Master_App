import { InPlaceWikiPicker } from "./InPlaceWikiPicker";
import { insertEditableWiki } from "./inplace-wiki";
import { sanitizePlayerFacingHTML } from "../../player-facing-rich";
import { useLayoutEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { editableMarkdown } from "./inplace-markdown";

export function InPlaceText({
  value,
  editing,
  onChange,
  label,
  multiline = false,
  rich = false,
  html = false,
  className = "",
  placeholder = "Добавить…",
  entities,
  onOpen,
}: {
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  label: string;
  multiline?: boolean;
  rich?: boolean;
  html?: boolean;
  className?: string;
  placeholder?: string;
  entities?: Map<string, KnowledgeEntity>;
  onOpen?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    emitted = useRef<string | null>(null),
    mode = useRef("");
  const [wiki, setWiki] = useState<{
    x: number;
    y: number;
    range: Range;
    text: string;
  } | null>(null);
  function openWiki(x: number, y: number) {
    const selection = window.getSelection();
    if (
      !editing ||
      !rich ||
      !entities ||
      !selection?.rangeCount ||
      !selection.toString().trim()
    )
      return false;
    const range = selection.getRangeAt(0);
    if (!ref.current?.contains(range.commonAncestorContainer)) return false;
    setWiki({ x, y, range: range.cloneRange(), text: selection.toString() });
    return true;
  }
  useLayoutEffect(() => {
    const root = ref.current;
    if (
      !root ||
      (emitted.current === value && mode.current === `${rich}:${html}`)
    )
      return;
    mode.current = `${rich}:${html}`;
    if (!rich) root.textContent = value;
    else {
      root.innerHTML = html
        ? sanitizePlayerFacingHTML(value)
        : DOMPurify.sanitize(
            marked.parse(value, { async: false, gfm: true, breaks: true }),
            {
              ALLOWED_TAGS: [
                "p",
                "br",
                "h1",
                "h2",
                "h3",
                "h4",
                "strong",
                "b",
                "em",
                "i",
                "u",
                "s",
                "del",
                "ul",
                "ol",
                "li",
                "blockquote",
                "table",
                "thead",
                "tbody",
                "tr",
                "th",
                "td",
                "hr",
                "pre",
                "code",
                "a",
                "img",
              ],
              ALLOWED_ATTR: ["start", "href", "src", "alt", "title"],
              ALLOW_DATA_ATTR: false,
              ALLOW_ARIA_ATTR: false,
            },
          );
      if (!html)
        for (const table of root.querySelectorAll("table")) {
          const scroll = document.createElement("div");
          scroll.className = "formatted-table-scroll";
          scroll.tabIndex = 0;
          scroll.setAttribute("role", "region");
          scroll.setAttribute("aria-label", "Таблица");
          table.replaceWith(scroll);
          scroll.append(table);
        }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
        nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        if (node.parentElement?.closest("pre,code")) continue;
        const matches = [
          ...node.data.matchAll(/\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g),
        ];
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let offset = 0;
        for (const match of matches) {
          fragment.append(node.data.slice(offset, match.index));
          const span = document.createElement("span");
          span.dataset.wiki = match[0];
          span.textContent = match[2] ?? match[1];
          span.contentEditable = "false";
          span.className = "mention";
          const target = entities?.get(match[1].trim().toLocaleLowerCase());
          if (target) {
            span.dataset.entityId = target.id;
            span.setAttribute("role", "link");
            span.tabIndex = 0;
          }
          fragment.append(span);
          offset = match.index! + match[0].length;
        }
        fragment.append(node.data.slice(offset));
        node.replaceWith(fragment);
      }
    }
    emitted.current = value;
  }, [value, rich, html, entities]);
  function change() {
    if (!ref.current) return;
    let next: string;
    if (html) {
      const clone = ref.current.cloneNode(true) as HTMLDivElement;
      for (const link of clone.querySelectorAll<HTMLElement>("[data-wiki]"))
        link.replaceWith(
          document.createTextNode(link.dataset.wiki || link.textContent || ""),
        );
      next = sanitizePlayerFacingHTML(clone.innerHTML);
    } else
      next = rich
        ? editableMarkdown(ref.current)
        : ref.current.innerText.replace(
            multiline ? /\r/g : /[\r\n]+/g,
            multiline ? "" : " ",
          );
    emitted.current = next;
    onChange(next);
  }
  return (
    <>
      <div
        ref={ref}
        className={`inplace-text ${rich ? "formatted-text" : ""} ${className}`}
        role={editing ? "textbox" : undefined}
        aria-label={editing ? label : undefined}
        aria-multiline={(editing && multiline) || undefined}
        contentEditable={editing}
        suppressContentEditableWarning
        data-field={label}
        data-placeholder={editing ? placeholder : "—"}
        data-editing={editing || undefined}
        tabIndex={editing ? 0 : -1}
        title={
          editing && rich
            ? "Выделите текст и нажмите Ctrl+K, чтобы вставить ссылку"
            : undefined
        }
        onDoubleClick={(event) => {
          if (!editing) return;
          const link = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-wiki]",
          );
          if (!link || !ref.current?.contains(link)) return;
          const range = document.createRange();
          range.selectNode(link);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          const box = link.getBoundingClientRect();
          openWiki(box.x, box.bottom + 8);
        }}
        onContextMenu={(event) => {
          if (openWiki(event.clientX, event.clientY)) event.preventDefault();
        }}
        onInput={change}
        onPaste={(event) => {
          if (!editing) return;
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
        }}
        onDrop={(event) => {
          if (editing) event.preventDefault();
        }}
        onClick={(event) => {
          if (editing) {
            if ((event.target as HTMLElement).closest("a"))
              event.preventDefault();
            return;
          }
          const link = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-entity-id]",
          );
          if (link?.dataset.entityId) onOpen?.(link.dataset.entityId);
        }}
        onKeyDown={(event) => {
          if (
            editing &&
            rich &&
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "k"
          ) {
            const rect = window.getSelection()?.rangeCount
              ? window.getSelection()!.getRangeAt(0).getBoundingClientRect()
              : event.currentTarget.getBoundingClientRect();
            if (openWiki(rect.x, rect.bottom + 8)) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
          }
          const link = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-entity-id]",
          );
          if (
            !editing &&
            link?.dataset.entityId &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            onOpen?.(link.dataset.entityId);
          }
          if (editing && !multiline && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {wiki && entities && (
        <InPlaceWikiPicker
          entities={entities}
          label={wiki.text}
          x={wiki.x}
          y={wiki.y}
          onClose={() => {
            setWiki(null);
            ref.current?.focus({ preventScroll: true });
          }}
          onChoose={(entity, linkLabel) => {
            const root = ref.current;
            if (!root || !root.contains(wiki.range.commonAncestorContainer)) {
              setWiki(null);
              return;
            }
            if (
              !insertEditableWiki(
                root,
                wiki.range,
                wiki.text,
                entity,
                linkLabel,
              )
            ) {
              setWiki(null);
              return;
            }
            change();
            setWiki(null);
          }}
        />
      )}
    </>
  );
}
