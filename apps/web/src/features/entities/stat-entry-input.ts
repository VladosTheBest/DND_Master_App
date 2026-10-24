import type { StatBlockEntry } from "@shadow-edge/shared-types";

/** Text edits never remove imported Foundry mechanics from an action. */
export function sanitizeStatEntries(
  entries: StatBlockEntry[] = [],
): StatBlockEntry[] {
  const optional = (value?: string) => value?.trim() || undefined;
  return entries
    .map((entry) => ({
      ...entry,
      name: entry.name.trim(),
      subtitle: optional(entry.subtitle),
      toHit: optional(entry.toHit),
      damage: optional(entry.damage),
      saveDc: optional(entry.saveDc),
      description: entry.description.trim(),
    }))
    .filter(
      (entry) =>
        entry.name ||
        entry.description ||
        entry.toHit ||
        entry.damage ||
        entry.saveDc ||
        entry.subtitle ||
        entry.foundry,
    )
    .map((entry) => ({
      ...entry,
      name: entry.name || "Unnamed Entry",
      description: entry.description || "Description pending.",
    }));
}
