/** Serialize the small, sanitized editing surface, preserving wiki targets and formatting. */
export function editableMarkdown(root: Node): string {
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/([*_\[\]<>`])/g, "\\$1");
  const visit = (node: Node): string => {
    if (node.nodeType === 3) return escape(node.textContent || "");
    if (node.nodeType !== 1) return "";
    const element = node as HTMLElement,
      tag = element.tagName.toLowerCase();
    const wiki = element.getAttribute("data-wiki");
    if (wiki && /^\[\[[^\[\]]+\]\]$/.test(wiki)) return wiki;
    const inner = () => Array.from(node.childNodes).map(visit).join("");
    const destination = (value: string) =>
      value
        .replace(/</g, "%3C")
        .replace(/>/g, "%3E")
        .replace(/[\r\n]/g, "");
    const title = element.getAttribute("title");
    const suffix = title
      ? ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : "";
    if (tag === "a") {
      const href = element.getAttribute("href");
      return href ? `[${inner()}](<${destination(href)}>${suffix})` : inner();
    }
    if (tag === "img") {
      const src = element.getAttribute("src");
      return src
        ? `![${escape(element.getAttribute("alt") || "")}]` +
            `(<${destination(src)}>${suffix})`
        : "";
    }
    if (tag === "br") return "\n";
    if (
      ["strong", "b", "em", "i", "del", "s", "u", "code"].includes(tag) &&
      !element.textContent
    )
      return "";
    if (tag === "strong" || tag === "b") return `**${inner()}**`;
    if (tag === "em" || tag === "i") return `*${inner()}*`;
    if (tag === "del" || tag === "s") return `~~${inner()}~~`;
    if (tag === "u") return `<u>${inner()}</u>`;
    if (tag === "pre")
      return `\n\n\`\`\`\n${element.textContent || ""}\n\`\`\`\n\n`;
    if (tag === "code")
      return `\`${(element.textContent || "").replace(/`/g, "\\`")}\``;
    if (/^h[1-4]$/.test(tag))
      return `\n\n${"#".repeat(Number(tag[1]))} ${inner().trim()}\n\n`;
    if (tag === "p" || tag === "div") return `${inner()}\n\n`;
    if (tag === "blockquote")
      return `\n\n${inner()
        .trim()
        .split("\n")
        .map((line) => "> " + line)
        .join("\n")}\n\n`;
    if (tag === "ul" || tag === "ol")
      return (
        "\n" +
        Array.from(element.children)
          .map(
            (li, index) =>
              `${tag === "ol" ? `${(Number(element.getAttribute("start")) || 1) + index}.` : "-"} ${Array.from(li.childNodes).map(visit).join("").trim().replace(/\n/g, "\n  ")}`,
          )
          .join("\n") +
        "\n\n"
      );
    if (tag === "table") {
      const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
        Array.from(row.children)
          .map((cell) =>
            Array.from(cell.childNodes)
              .map(visit)
              .join("")
              .trim()
              .replace(/\|/g, "\\|")
              .replace(/\n+/g, "<br>"),
          )
          .join(" | "),
      );
      if (!rows.length) return "";
      const columns = element.querySelector("tr")?.children.length || 1;
      return `\n\n| ${rows[0]} |\n| ${Array(columns).fill("---").join(" | ")} |\n${rows
        .slice(1)
        .map((row) => `| ${row} |`)
        .join("\n")}\n\n`;
    }
    if (tag === "hr") return "\n\n---\n\n";
    return inner();
  };
  return Array.from(root.childNodes).map(visit).join("").trim();
}
