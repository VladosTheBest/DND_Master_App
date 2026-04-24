import { useMemo } from "react";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { clamp } from "./app-shared";

const parseWikiLinkToken = (token: string) => {
  const match = token.match(/^\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/);
  if (!match) {
    return null;
  }

  return {
    targetTitle: match[1].trim(),
    label: (match[2] ?? match[1]).trim()
  };
};

export const createWikiLinkMarkup = (targetTitle: string, label: string) => {
  const safeTarget = targetTitle.replace(/\]\]/g, "").trim();
  const safeLabel = label.replace(/\]\]/g, "").replace(/\|/g, " ").trim();
  if (!safeTarget) {
    return label;
  }

  return safeLabel && safeLabel !== safeTarget ? `[[${safeTarget}|${safeLabel}]]` : `[[${safeTarget}]]`;
};

type RichSegment = {
  key: string;
  kind: "text" | "link";
  sourceStart: number;
  sourceEnd: number;
  raw: string;
  visibleText: string;
  targetTitle?: string;
};

type RichParagraph = {
  key: string;
  segments: RichSegment[];
};

const parseRichParagraphs = (content: string): RichParagraph[] => {
  const parts = content.split(/(\n+)/);
  const paragraphs: RichParagraph[] = [];
  let offset = 0;
  let paragraphIndex = 0;

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (/^\n+$/.test(part)) {
      offset += part.length;
      continue;
    }

    const segments: RichSegment[] = [];
    const tokenPattern = /\[\[[^[\]]+\]\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(part)) !== null) {
      if (match.index > cursor) {
        const rawText = part.slice(cursor, match.index);
        segments.push({
          key: `p${paragraphIndex}-text-${cursor}`,
          kind: "text",
          sourceStart: offset + cursor,
          sourceEnd: offset + match.index,
          raw: rawText,
          visibleText: rawText
        });
      }

      const parsed = parseWikiLinkToken(match[0]);
      const visibleText = parsed?.label ?? match[0];
      segments.push({
        key: `p${paragraphIndex}-link-${match.index}`,
        kind: "link",
        sourceStart: offset + match.index,
        sourceEnd: offset + match.index + match[0].length,
        raw: match[0],
        visibleText,
        targetTitle: parsed?.targetTitle
      });
      cursor = match.index + match[0].length;
    }

    if (cursor < part.length) {
      const rawText = part.slice(cursor);
      segments.push({
        key: `p${paragraphIndex}-tail-${cursor}`,
        kind: "text",
        sourceStart: offset + cursor,
        sourceEnd: offset + part.length,
        raw: rawText,
        visibleText: rawText
      });
    }

    paragraphs.push({
      key: `paragraph-${paragraphIndex}-${offset}`,
      segments
    });
    offset += part.length;
    paragraphIndex += 1;
  }

  return paragraphs;
};

const resolveSelectionOffsetWithinElement = (element: HTMLElement, node: Node, nodeOffset: number) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return 0;
  }
  return range.toString().length;
};

const resolveRichSelectionPoint = (node: Node, offset: number) => {
  const element =
    node instanceof HTMLElement
      ? node.closest<HTMLElement>("[data-rich-source-start]")
      : node.parentElement?.closest<HTMLElement>("[data-rich-source-start]") ?? null;

  if (!element || element.dataset.richLink === "true") {
    return null;
  }

  const sourceStart = Number(element.dataset.richSourceStart ?? "");
  const sourceEnd = Number(element.dataset.richSourceEnd ?? "");
  if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) {
    return null;
  }

  const localVisibleOffset = clamp(resolveSelectionOffsetWithinElement(element, node, offset), 0, element.textContent?.length ?? 0);
  return clamp(sourceStart + localVisibleOffset, sourceStart, sourceEnd);
};

export const resolveRichSelectionFromContainer = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const start = resolveRichSelectionPoint(range.startContainer, range.startOffset);
  const end = resolveRichSelectionPoint(range.endContainer, range.endOffset);
  if (start == null || end == null || start === end) {
    return null;
  }

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    text: selection.toString()
  };
};

export function RichParagraphs({
  content,
  entityByTitle,
  onMentionClick
}: {
  content: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  onMentionClick: (id: string) => void;
}) {
  const paragraphs = useMemo(() => parseRichParagraphs(content), [content]);

  return (
    <div className="rich">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.key}>
          {paragraph.segments.map((segment) => {
            if (segment.kind === "text") {
              return (
                <span
                  key={segment.key}
                  data-rich-link="false"
                  data-rich-source-end={segment.sourceEnd}
                  data-rich-source-start={segment.sourceStart}
                  className="rich-inline-text"
                >
                  {segment.visibleText}
                </span>
              );
            }

            const linked = segment.targetTitle ? entityByTitle.get(segment.targetTitle) : undefined;
            return linked ? (
              <button
                key={segment.key}
                className="mention"
                data-rich-link="true"
                data-rich-source-end={segment.sourceEnd}
                data-rich-source-start={segment.sourceStart}
                onClick={() => onMentionClick(linked.id)}
                type="button"
              >
                {segment.visibleText}
              </button>
            ) : (
              <span
                key={segment.key}
                data-rich-link="true"
                data-rich-source-end={segment.sourceEnd}
                data-rich-source-start={segment.sourceStart}
              >
                {segment.visibleText}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

