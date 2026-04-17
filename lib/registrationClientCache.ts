const REGISTRATION_CACHE_PREFIX = "registeruser:has-registration:";

function getCacheKey(userId: string) {
  return `${REGISTRATION_CACHE_PREFIX}${userId}`;
}

export function readRegistrationStatusCache(userId?: string | null): boolean | null {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(userId));
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeRegistrationStatusCache(
  userId: string | null | undefined,
  hasRegistration: boolean,
) {
  if (typeof window === "undefined" || !userId) return;

  try {
    window.localStorage.setItem(getCacheKey(userId), hasRegistration ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

export function clearRegistrationStatusCache(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return;

  try {
    window.localStorage.removeItem(getCacheKey(userId));
  } catch {
    // ignore storage failures
  }
}
