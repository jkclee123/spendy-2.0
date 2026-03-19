import type { UserCategory } from "@/types";

const PREFIX = "spendy:cat-cache:";

function getCatCacheKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function readCatCache(userId: string): UserCategory[] | null {
  try {
    const raw = localStorage.getItem(getCatCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCatCache(userId: string, data: UserCategory[]): void {
  try {
    localStorage.setItem(getCatCacheKey(userId), JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full — degrade silently
  }
}

export function clearCatCache(userId: string): void {
  try {
    localStorage.removeItem(getCatCacheKey(userId));
  } catch {
    // ignore
  }
}
