import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { UserCategory } from "@/types";

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: UserCategory;
  currentLang: "en" | "zh-HK";
  onSave: (data: { emoji: string; name: string }) => Promise<void>;
}

/**
 * Modal for creating/editing categories
 * - Emoji picker or text input for emoji
 * - Single name input with smart-save logic
 * - Create or Update button
 */
export function CategoryEditModal({
  isOpen,
  onClose,
  category,
  currentLang,
  onSave,
}: CategoryEditModalProps) {
  const { t } = useTranslation("categories");
  const { t: tCommon } = useTranslation("common");
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!category;

  // Initialize form with category data
  useEffect(() => {
    if (category) {
      setEmoji(category.emoji);
      const localizedName =
        currentLang === "en"
          ? category.en_name || category.zh_name || ""
          : category.zh_name || category.en_name || "";
      setName(localizedName);
    } else {
      setEmoji("");
      setName("");
    }
    setError(null);
  }, [category, currentLang, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!emoji.trim()) {
      setError(t("selectEmoji"));
      return;
    }

    if (!name.trim()) {
      setError(t("enterName"));
      return;
    }

    setIsLoading(true);

    try {
      await onSave({
        emoji: emoji.trim(),
        name: name.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? t("editCategory") : t("createCategory")}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Emoji picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("emoji")} <span className="text-red-500">*</span>
          </label>

          {/* Selected emoji display */}
          <div className="mb-3 flex items-center gap-3">
            <div className="text-4xl">{emoji || "❓"}</div>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={t("typeEmoji")}
              className="flex-1 min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white dark:bg-gray-900 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none"
              maxLength={2}
              aria-label={t("emoji")}
            />
          </div>
        </div>

        {/* Name input */}
        <div>
          <label
            htmlFor="category-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t("name")} <span className="text-red-500">*</span>
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("categoryName")}
            className="w-full min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white dark:bg-gray-900 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none"
            maxLength={50}
            disabled={isLoading}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-900 px-4 py-2 font-medium text-gray-700 dark:text-gray-300 hover:border-black dark:hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-20"
          >
            {tCommon("cancel")}
          </button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading}
            className="flex-1"
          >
            {isEditMode ? tCommon("save") : tCommon("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
