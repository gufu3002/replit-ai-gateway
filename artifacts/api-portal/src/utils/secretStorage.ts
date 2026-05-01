const ADMIN_KEY_STORAGE_KEY = "admin_key";
const PROXY_KEY_STORAGE_KEY = "proxy_key";
const LEGACY_PROXY_KEY_STORAGE_KEY = "proxy_api_key";

export function readAdminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeAdminKey(key: string): void {
  try {
    if (key) {
      sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
    } else {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    }
  } catch {}
}

export function readProxyKey(): string {
  try {
    return sessionStorage.getItem(PROXY_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeProxyKey(key: string): void {
  try {
    if (key) {
      sessionStorage.setItem(PROXY_KEY_STORAGE_KEY, key);
    } else {
      sessionStorage.removeItem(PROXY_KEY_STORAGE_KEY);
    }
  } catch {}
}

export function clearLegacyAdminKeyStorage(): void {
  try {
    localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PROXY_KEY_STORAGE_KEY);
  } catch {}
}