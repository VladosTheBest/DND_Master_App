import { createWikiLinkMarkup } from "../entity-links/wiki-link-markup";

/** Replace a selection in a detached copy, then commit one native undoable edit.
 * Inserting only an inline fragment can make Chromium split its surrounding paragraph. */
export function insertEditableWiki(
  root: HTMLElement,
  range: Range,
  selectedText: string,
  target: { id: string; title: string },
  label: string,
): boolean {
  if (!root.contains(range.commonAncestorContainer)) return false;
  const path = (node: Node) => {
    const result: number[] = [];
    while (node !== root) {
      const parent = node.parentNode;
      if (!parent) return null;
      result.unshift(Array.from(parent.childNodes).indexOf(node as ChildNode));
      node = parent;
    }
    return result;
  };
  const start = path(range.startContainer),
    end = path(range.endContainer);
  if (!start || !end) return false;
  const clone = root.cloneNode(true) as HTMLElement;
  for (const oldMarker of clone.querySelectorAll("[data-inplace-inserted]"))
    oldMarker.removeAttribute("data-inplace-inserted");
  const resolve = (indices: number[]) =>
    indices.reduce<Node>((node, index) => node.childNodes[index], clone);
  const replacement = document.createRange();
  replacement.setStart(resolve(start), range.startOffset);
  replacement.setEnd(resolve(end), range.endOffset);
  const fragment = replacement.cloneContents(),
    selectedStrong = fragment.querySelector("strong,b");
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.className = "mention";
  span.dataset.wiki = createWikiLinkMarkup(target.title, label);
  span.dataset.entityId = target.id;
  span.dataset.inplaceInserted = "true";
  span.textContent = label.trim();
  span.setAttribute("role", "link");
  span.tabIndex = 0;
  const insert = document.createDocumentFragment();
  insert.append(document.createTextNode(selectedText.match(/^\s+/)?.[0] || ""));
  if (
    selectedStrong &&
    selectedStrong.textContent?.trim() === selectedText.trim()
  ) {
    const strong = document.createElement("strong");
    strong.append(span);
    insert.append(strong);
  } else insert.append(span);
  insert.append(document.createTextNode(selectedText.match(/\s+$/)?.[0] || ""));
  replacement.deleteContents();
  replacement.insertNode(insert);
  root.focus({ preventScroll: true });
  const selection = window.getSelection(),
    all = document.createRange();
  all.selectNodeContents(root);
  selection?.removeAllRanges();
  selection?.addRange(all);
  if (!document.execCommand("insertHTML", false, clone.innerHTML)) return false;
  const inserted = root.querySelector<HTMLElement>("[data-inplace-inserted]");
  if (inserted) {
    inserted.removeAttribute("data-inplace-inserted");
    const caret = document.createRange();
    caret.setStartAfter(inserted);
    caret.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(caret);
  }
  return true;
}
