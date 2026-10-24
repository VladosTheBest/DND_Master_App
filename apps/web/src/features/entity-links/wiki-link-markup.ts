export const createWikiLinkMarkup = (targetTitle: string, label: string) => {
  const safeTarget = targetTitle.replace(/\]\]/g, "").trim();
  const safeLabel = label
    .replace(/\]\]/g, "")
    .replace(/\|/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (!safeTarget) {
    return label;
  }

  return safeLabel && safeLabel !== safeTarget
    ? `[[${safeTarget}|${safeLabel}]]`
    : `[[${safeTarget}]]`;
};
