import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/hooks/useLanguage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { SwipeableCard } from "@/components/ui/SwipeableCard";
import { CategoryEditModal } from "@/components/settings/CategoryEditModal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { UserCategory } from "@/types";
import * as categoryService from "@/lib/services/categories";

export function CategoriesPage() {
  const { t } = useTranslation("categories");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | undefined>(undefined);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    try {
      const data = await categoryService.listByUser(user.id);
      setCategories(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreate = useCallback(() => {
    setEditingCategory(undefined);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((category: UserCategory) => {
    setEditingCategory(category);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(
    async ({ emoji, name }: { emoji: string; name: string }) => {
      if (!user) return;
      if (editingCategory) {
        await categoryService.updateCategory({
          categoryId: editingCategory.id,
          userId: user.id,
          emoji,
          name,
          currentLang: lang,
        });
      } else {
        await categoryService.createCategory({
          userId: user.id,
          emoji,
          name,
          currentLang: lang,
        });
      }
      await loadCategories();
    },
    [user, editingCategory, lang, loadCategories]
  );

  const handleDeactivate = useCallback(
    async (category: UserCategory) => {
      if (!user) return;
      await categoryService.deactivateCategory(category.id, user.id);
      await loadCategories();
    },
    [user, loadCategories]
  );

  const handleActivate = useCallback(
    async (category: UserCategory) => {
      if (!user) return;
      await categoryService.activateCategory(category.id, user.id);
      await loadCategories();
    },
    [user, loadCategories]
  );

  const getLocalizedName = (category: UserCategory) => {
    if (lang === "zh-HK") return category.zh_name || category.en_name || "";
    return category.en_name || category.zh_name || "";
  };

  const activeCategories = categories.filter((c) => c.is_active);
  const inactiveCategories = categories.filter((c) => !c.is_active);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        action={
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus className="h-3 w-3" />
            {tCommon("create")}
          </Button>
        }
      />

      {/* Active Categories */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
        <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-200 ml-2">{t("active")}</h3>
        {activeCategories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("noActiveCategories")}</p>
        ) : (
          <ul className="space-y-2">
            {activeCategories.map((category) => (
              <li key={category.id}>
                <SwipeableCard
                  onClick={() => handleEdit(category)}
                  onSwipeAction={() => handleDeactivate(category)}
                  actionLabel={t("deactivate")}
                  actionColor="yellow"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                      {getLocalizedName(category)}
                    </span>
                  </div>
                </SwipeableCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inactive Categories */}
      {inactiveCategories.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
          <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-200 ml-2">
            {t("inactive")}
          </h3>
          <ul className="space-y-2">
            {inactiveCategories.map((category) => (
              <li key={category.id} className="opacity-60">
                <SwipeableCard
                  onClick={() => handleEdit(category)}
                  onSwipeAction={() => handleActivate(category)}
                  actionLabel={t("active")}
                  actionColor="green"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                      {getLocalizedName(category)}
                    </span>
                  </div>
                </SwipeableCard>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CategoryEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editingCategory}
        currentLang={lang}
        onSave={handleSave}
      />
    </div>
  );
}
