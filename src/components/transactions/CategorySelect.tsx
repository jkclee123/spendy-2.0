import { SelectHTMLAttributes, useCallback, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UserCategory } from "@/types";
import * as categoryService from "@/lib/services/categories";

interface CategorySelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  error?: string;
  label?: string;
  required?: boolean;
  userId: string;
}

export function CategorySelect({
  className = "",
  error,
  label,
  required,
  id,
  value,
  userId,
  ...props
}: CategorySelectProps) {
  const selectId = id || "category-select";
  const hasValue = value && value !== "";
  const { i18n } = useTranslation();
  const [categories, setCategories] = useState<UserCategory[]>([]);

  useEffect(() => {
    categoryService
      .listActiveByUser(userId)
      .then(setCategories)
      .catch(() => {});
  }, [userId]);

  const getLocalizedName = useCallback(
    (category: UserCategory): string => {
      if (i18n.language === "en") return category.en_name || category.zh_name || "Unnamed";
      return category.zh_name || category.en_name || "未命名";
    },
    [i18n.language]
  );

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          className={`min-h-[44px] w-full appearance-none rounded-xl border px-4 py-3 text-base transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 hover:border-gray-400"} ${hasValue ? "text-gray-900 bg-white" : "text-gray-500 bg-white"} ${className}`}
          {...props}
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.emoji} {getLocalizedName(category)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}
