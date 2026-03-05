import { forwardRef, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LanguageSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "value" | "onChange"
> {
  value: "system" | "en" | "zh-HK";
  onChange: (lang: "system" | "en" | "zh-HK") => void;
  error?: string;
  label?: string;
  required?: boolean;
}

/**
 * Language preference dropdown component
 * Options: System (Auto), English, 繁體中文 (Traditional Chinese)
 */
export const LanguageSelect = forwardRef<HTMLSelectElement, LanguageSelectProps>(
  ({ className = "", error, label, required, id, value, onChange, ...props }, ref) => {
    const { t } = useTranslation("settings");
    const selectId = id || "language-select";

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as "system" | "en" | "zh-HK");
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            value={value}
            onChange={handleChange}
            className={`
              min-h-[44px] w-full appearance-none rounded-xl border px-4 py-3 text-base
              transition-colors duration-200
              focus:outline-none
              disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500
              dark:disabled:bg-gray-700 dark:disabled:text-gray-500
              ${
                error
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-400 hover:border-black dark:border-gray-500 dark:hover:border-gray-400"
              }
              text-gray-900 bg-white dark:text-gray-200 dark:bg-gray-800
              ${className}
            `}
            {...props}
          >
            <option value="system">{t("languageOptions.system")}</option>
            <option value="en">{t("languageOptions.en")}</option>
            <option value="zh-HK">{t("languageOptions.zhTW")}</option>
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

LanguageSelect.displayName = "LanguageSelect";
