const exactSensitiveKeys = new Set([
  "ownerid",
  "authorization",
  "authheader",
  "cookie",
  "credentials",
  "credential",
]);

const privatePathKeyParts = [
  "absolute",
  "canonical",
  "disk",
  "filesystem",
  "internal",
  "local",
  "private",
  "source",
  "staged",
  "staging",
  "temp",
  "temporary",
  "upload",
];

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("en-US");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key);
  if (exactSensitiveKeys.has(normalized)) return true;
  if (
    normalized.includes("password") ||
    normalized.includes("passwd") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("privatekey") ||
    normalized.includes("credential") ||
    normalized.endsWith("cookie")
  ) {
    return true;
  }
  return (
    normalized.endsWith("path") &&
    (normalized === "filepath" ||
      privatePathKeyParts.some((part) => normalized.includes(part)))
  );
}

/**
 * Remove account credentials and private filesystem metadata before API data is
 * exposed to an MCP model. Proposal IDs/statuses, semantic diff `path` fields,
 * and authenticated media preview/final URLs remain intact.
 */
export function sanitizeModelOutput<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeModelOutput(item)) as T;
  }
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      isSensitiveKey(key) ? [] : [[key, sanitizeModelOutput(child)]],
    ),
  ) as T;
}
