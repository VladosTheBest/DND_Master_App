const allowedTagMap = new Map<string, string>([
  ["b", "strong"],
  ["strong", "strong"],
  ["i", "em"],
  ["em", "em"],
  ["u", "u"],
  ["span", "span"],
  ["font", "span"],
  ["p", "p"],
  ["div", "p"],
  ["h1", "h1"],
  ["h2", "h2"],
  ["h3", "h3"],
  ["h4", "h4"],
  ["h5", "h4"],
  ["h6", "h4"],
  ["ul", "ul"],
  ["ol", "ol"],
  ["li", "li"],
  ["blockquote", "blockquote"],
  ["br", "br"]
]);

const blockedTagNames = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "meta",
  "link"
]);

const allowedStyleProperties = [
  "color",
  "background-color",
  "font-size",
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-transform",
  "letter-spacing"
] as const;

const colorPattern = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i;
const fontSizePattern = /^\d+(?:\.\d+)?(px|rem|em|%)$/i;
const letterSpacingPattern = /^-?\d+(?:\.\d+)?(px|rem|em)$/i;
const textDecorationPattern = /^(none|underline|line-through|overline)(\s+(underline|line-through|overline))*$/i;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const escapePlayerFacingText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeStyleValue = (property: string, value: string) => {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || /url\s*\(|expression\s*\(|javascript:|data:|var\s*\(/i.test(cleaned)) {
    return "";
  }

  const lower = cleaned.toLowerCase();
  switch (property) {
    case "color":
    case "background-color":
      return colorPattern.test(cleaned) ? cleaned : "";
    case "font-size":
      return fontSizePattern.test(cleaned) ? cleaned : "";
    case "text-align":
      return ["left", "center", "right", "justify"].includes(lower) ? lower : "";
    case "font-weight":
      return ["normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900"].includes(lower)
        ? lower
        : "";
    case "font-style":
      return ["normal", "italic", "oblique"].includes(lower) ? lower : "";
    case "text-decoration":
      return textDecorationPattern.test(lower) ? lower : "";
    case "text-transform":
      return ["none", "uppercase", "lowercase", "capitalize"].includes(lower) ? lower : "";
    case "letter-spacing":
      return letterSpacingPattern.test(cleaned) ? cleaned : "";
    default:
      return "";
  }
};

const fontSizeFromLegacyValue = (value?: string | null) => {
  switch ((value ?? "").trim()) {
    case "1":
      return "0.85rem";
    case "2":
      return "0.95rem";
    case "3":
      return "1rem";
    case "4":
      return "1.15rem";
    case "5":
      return "1.3rem";
    case "6":
      return "1.55rem";
    case "7":
      return "1.8rem";
    default:
      return "";
  }
};

const collectSafeStyles = (element: HTMLElement) => {
  const styles = new Map<string, string>();

  allowedStyleProperties.forEach((property) => {
    const nextValue = normalizeStyleValue(property, element.style.getPropertyValue(property));
    if (nextValue) {
      styles.set(property, nextValue);
    }
  });

  if (element.tagName.toLowerCase() === "font") {
    const legacyColor = normalizeStyleValue("color", element.getAttribute("color") ?? "");
    if (legacyColor && !styles.has("color")) {
      styles.set("color", legacyColor);
    }
    const legacyFontSize = fontSizeFromLegacyValue(element.getAttribute("size"));
    if (legacyFontSize && !styles.has("font-size")) {
      styles.set("font-size", legacyFontSize);
    }
  }

  const align = normalizeStyleValue("text-align", element.getAttribute("align") ?? "");
  if (align && !styles.has("text-align")) {
    styles.set("text-align", align);
  }

  return Array.from(styles.entries())
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
};

const hasMeaningfulContent = (element: HTMLElement, mappedTag: string) => {
  if (mappedTag === "br") {
    return true;
  }
  if (mappedTag === "ul" || mappedTag === "ol") {
    return element.children.length > 0;
  }
  return Boolean(element.textContent?.trim() || element.querySelector("br, ul, ol"));
};

const sanitizeNode = (node: Node, document: Document): Node | DocumentFragment | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? "");
  }

  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  if (blockedTagNames.has(tagName)) {
    return null;
  }

  const mappedTag = allowedTagMap.get(tagName);
  if (!mappedTag) {
    const fragment = document.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeNode(child, document);
      if (sanitizedChild) {
        fragment.appendChild(sanitizedChild);
      }
    });
    return fragment.childNodes.length ? fragment : null;
  }

  if (mappedTag === "br") {
    return document.createElement("br");
  }

  const cleanElement = document.createElement(mappedTag);
  const styleValue = collectSafeStyles(node);
  if (styleValue) {
    cleanElement.setAttribute("style", styleValue);
  }

  Array.from(node.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child, document);
    if (sanitizedChild) {
      cleanElement.appendChild(sanitizedChild);
    }
  });

  return hasMeaningfulContent(cleanElement, mappedTag) ? cleanElement : null;
};

export const sanitizePlayerFacingHTML = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || typeof DOMParser === "undefined" || typeof document === "undefined") {
    return "";
  }

  const parser = new DOMParser();
  const source = parser.parseFromString(trimmed, "text/html");
  const output = document.implementation.createHTMLDocument("");
  const container = output.createElement("div");

  Array.from(source.body.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child, output);
    if (sanitizedChild) {
      container.appendChild(sanitizedChild);
    }
  });

  return container.innerHTML.trim();
};

const nodeToPlayerFacingText = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();
  const childText = Array.from(node.childNodes)
    .map((child) => nodeToPlayerFacingText(child))
    .join("");
  const normalizedChildText = childText
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  switch (tagName) {
    case "br":
      return "\n";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
      return normalizedChildText ? `## ${normalizedChildText}\n\n` : "";
    case "p":
      return normalizedChildText ? `${normalizedChildText}\n\n` : "";
    case "blockquote":
      return normalizedChildText
        ? `${normalizedChildText
            .split(/\n+/)
            .map((line) => `> ${collapseWhitespace(line)}`)
            .join("\n")}\n\n`
        : "";
    case "ul":
    case "ol":
      return childText ? `${childText}\n` : "";
    case "li":
      return normalizedChildText ? `- ${normalizedChildText}\n` : "";
    default:
      return childText;
  }
};

export const extractPlainTextFromPlayerFacingHTML = (value?: string) => {
  const sanitizedHtml = sanitizePlayerFacingHTML(value);
  if (!sanitizedHtml || typeof DOMParser === "undefined") {
    return "";
  }

  const parser = new DOMParser();
  const source = parser.parseFromString(sanitizedHtml, "text/html");
  const rawText = Array.from(source.body.childNodes)
    .map((child) => nodeToPlayerFacingText(child))
    .join("")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return rawText
    .split("\n")
    .map((line) => (line.startsWith("## ") || line.startsWith("- ") || line.startsWith("> ") ? line.trimEnd() : collapseWhitespace(line)))
    .join("\n")
    .trim();
};

export const playerFacingPlainTextToHTML = (value?: string) => {
  const normalized = value?.replace(/\r/g, "").trim() ?? "";
  if (!normalized) {
    return "";
  }

  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const html = blocks.flatMap((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    if (lines.every((line) => /^[-*•]\s+/.test(line))) {
      return [
        `<ul>${lines
          .map((line) => `<li>${escapePlayerFacingText(collapseWhitespace(line.replace(/^[-*•]\s+/, "")))}</li>`)
          .join("")}</ul>`
      ];
    }

    if (lines.every((line) => /^>\s?/.test(line))) {
      return [
        `<blockquote>${lines
          .map((line) => escapePlayerFacingText(collapseWhitespace(line.replace(/^>\s?/, ""))))
          .join("<br />")}</blockquote>`
      ];
    }

    const headingMatch = lines[0].match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4);
      const remainder = lines.slice(1);
      return [
        `<h${level}>${escapePlayerFacingText(collapseWhitespace(headingMatch[2]))}</h${level}>`,
        ...(remainder.length
          ? [`<p>${remainder.map((line) => escapePlayerFacingText(collapseWhitespace(line))).join("<br />")}</p>`]
          : [])
      ];
    }

    return [`<p>${lines.map((line) => escapePlayerFacingText(collapseWhitespace(line))).join("<br />")}</p>`];
  });

  return sanitizePlayerFacingHTML(html.join(""));
};

export const preparePlayerFacingHTMLImport = (value?: string) => {
  const sanitizedHtml = sanitizePlayerFacingHTML(value);
  if (!sanitizedHtml || typeof DOMParser === "undefined") {
    return {
      title: "",
      content: "",
      contentHtml: ""
    };
  }

  const normalizedHtml = /<[a-z][\s\S]*>/i.test(sanitizedHtml) ? sanitizedHtml : `<p>${sanitizedHtml}</p>`;
  const parser = new DOMParser();
  const source = parser.parseFromString(value ?? "", "text/html");
  const sanitizedDocument = parser.parseFromString(normalizedHtml, "text/html");
  const heading = sanitizedDocument.body.querySelector("h1, h2, h3, h4");

  return {
    title: source.title.trim() || heading?.textContent?.trim() || "",
    content: extractPlainTextFromPlayerFacingHTML(normalizedHtml),
    contentHtml: normalizedHtml
  };
};
