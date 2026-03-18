const PREFIX = "spendy:lang-pref:";

export function readLangCache(userId: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function writeLangCache(userId: string, lang: string): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}`, lang);
  } catch {
    // Storage full or unavailable — ignore
  }
}
