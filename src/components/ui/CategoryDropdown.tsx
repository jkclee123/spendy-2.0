import { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import type { UserCategory } from "@/types";

interface CategoryDropdownProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "value" | "onChange"
> {
  categories: UserCategory[];
  value?: string;
  onChange: (categoryId: string | undefined) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  currentLang: "en" | "zh-HK";
}

export function CategoryDropdown({
  categories,
  value,
  onChange,
  placeholder,
  className = "",
  error,
  label,
  required,
  id,
  currentLang,
  disabled,
  ...props
}: CategoryDropdownProps) {
  const selectId = id || "category-dropdown";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue || undefined);
  };

  const getLocalizedName = (category: UserCategory): string => {
    if (currentLang === "en") return category.en_name || category.zh_name || "Unnamed";
    return category.zh_name || category.en_name || "未命名";
  };

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value || ""}
          onChange={handleChange}
          disabled={disabled}
          className={`min-h-[44px] w-full appearance-none rounded-xl border px-4 py-3 text-base transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 text-gray-900 bg-white dark:text-gray-200 dark:bg-gray-800 ${error ? "border-red-500 focus:ring-red-500" : "border-gray-400 hover:border-black dark:border-gray-500 dark:hover:border-gray-400"} ${className}`}
          {...props}
        >
          <option value="">{placeholder}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.emoji} {getLocalizedName(category)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
