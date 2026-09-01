const exactSensitiveKeys = new Set([
  "auth",
  "ownerid",
  "ownerids",
  "authorization",
  "authorizationheader",
  "authheader",
  "bearer",
  "cookie",
  "cookies",
  "cookiejar",
  "csrf",
  "credentials",
  "credential",
  "jwt",
  "nonce",
  "session",
  "sessions",
  "sessionid",
  "sessionids",
  "sessionkey",
  "sessionkeys",
  "xsrf",
]);

const exactPrivateLocationKeys = new Set([
  "appdata",
  "cwd",
  "dir",
  "dirs",
  "directory",
  "directories",
  "folder",
  "folders",
  "homedir",
  "homedirectory",
  "mediaroot",
  "mediaroots",
  "pathname",
  "pathnames",
  "pwd",
  "rootdir",
  "rootdirectory",
  "tempdir",
  "tempdirectory",
  "tmpdir",
  "userprofile",
  "workdir",
  "workdirs",
  "workingdir",
  "workingdirectory",
  "workspace",
  "workspacedir",
  "workspacedirectory",
  "workspaceroot",
]);

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("en-US");
}

function isSafeSemanticPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 500 &&
    (value === "$" || /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(value))
  );
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key);
  if (exactSensitiveKeys.has(normalized)) return true;
  if (
    normalized.endsWith("ownerid") ||
    normalized.endsWith("ownerids") ||
    normalized.includes("authorization") ||
    normalized.includes("bearer") ||
    normalized.includes("cookie") ||
    normalized.includes("csrf") ||
    normalized.includes("xsrf") ||
    normalized.includes("nonce") ||
    normalized.includes("jwt") ||
    normalized.includes("password") ||
    normalized.includes("passwd") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("privatekey") ||
    normalized.includes("credential")
  ) {
    return true;
  }
  return (
    normalized.endsWith("session") ||
    /session(?:id|ids|key|keys|token|tokens|cookie|cookies|secret|secrets|credential|credentials|authorization|auth|bearer|jwt|nonce|csrf|xsrf|header|headers|value|values|data|state)$/.test(
      normalized,
    )
  );
}

function isPrivateLocationKey(key: string): boolean {
  const normalized = normalizedKey(key);
  if (exactPrivateLocationKeys.has(normalized)) return true;
  if (normalized === "path") return false;
  return (
    normalized.endsWith("path") ||
    normalized.endsWith("paths") ||
    normalized.endsWith("pathname") ||
    normalized.endsWith("pathnames") ||
    normalized.endsWith("dir") ||
    normalized.endsWith("dirs") ||
    normalized.endsWith("directory") ||
    normalized.endsWith("directories") ||
    normalized.endsWith("folder") ||
    normalized.endsWith("folders")
  );
}

function isSafeDiffEntry(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isSafeSemanticPath((value as Record<string, unknown>).path)
  );
}

/**
 * Remove account credentials and private filesystem metadata before API data is
 * exposed to an MCP model. Proposal IDs/statuses, semantic diff `path` fields,
 * and authenticated media preview/final URLs remain intact.
 */
export function sanitizeModelOutput<T>(value: T): T {
  return sanitizeValue(value, false);
}

function sanitizeValue<T>(value: T, isDiffEntry: boolean): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, false)) as T;
  }
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      if (isSensitiveKey(key) || isPrivateLocationKey(key)) return [];
      const normalized = normalizedKey(key);
      if (normalized === "path") {
        return isDiffEntry && isSafeSemanticPath(child) ? [[key, child]] : [];
      }
      if (normalized === "diff" && Array.isArray(child)) {
        return [[key, child.filter(isSafeDiffEntry).map((item) => sanitizeValue(item, true))]];
      }
      return [[key, sanitizeValue(child, false)]];
    }),
  ) as T;
}
