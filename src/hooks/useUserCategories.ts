import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserCategory } from "@/types";
import * as categoryService from "@/lib/services/categories";
import { readCatCache, writeCatCache } from "@/lib/catCache";

interface UseUserCategoriesResult {
  categories: UserCategory[];
  activeCategories: UserCategory[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useUserCategories(userId: string | undefined): UseUserCategoriesResult {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const fresh = await categoryService.listByUser(userId);
      setCategories(fresh);
      writeCatCache(userId, fresh);
    } catch {
      // keep whatever we already have (cached or empty)
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setIsLoading(false);
      return;
    }
    const cached = readCatCache(userId);
    if (cached) {
      setCategories(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    refresh();
  }, [userId, refresh]);

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);

  return { categories, activeCategories, isLoading, refresh };
}
