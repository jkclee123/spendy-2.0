import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { UserCategory } from "@/types";
import { Button } from "@/components/ui/Button";
import { CategoryDropdown } from "@/components/ui/CategoryDropdown";
import { useLanguage } from "@/hooks/useLanguage";

export interface TransactionFiltersState {
  type: "all" | "expense" | "income";
  name: string;
  category: string | undefined;
  minAmount: string;
  maxAmount: string;
  fromDate: string;
  toDate: string;
}

interface TransactionFiltersProps {
  categories: UserCategory[];
  filters: TransactionFiltersState;
  onFiltersChange: (filters: TransactionFiltersState) => void;
  onApply: () => void;
  onAutoApply: (newFilters: TransactionFiltersState) => void;
  onClear: () => void;
  defaultExpanded?: boolean;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function TransactionFilters({
  categories,
  filters,
  onFiltersChange,
  onAutoApply,
  onClear,
  defaultExpanded = false,
}: TransactionFiltersProps) {
  const { t } = useTranslation("transactions");
  const { lang } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isTouchDevice, setIsTouchDevice] = useState(true);
  const minAmountRef = useRef<HTMLInputElement>(null);
  const maxAmountRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouchDevice(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const scheduleAutoApply = useCallback(
    (newFilters: TransactionFiltersState) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onAutoApply(newFilters);
      }, 300);
    },
    [onAutoApply]
  );

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFilters = { ...filters, type: e.target.value as "all" | "expense" | "income" };
      onFiltersChange(newFilters);
      onAutoApply(newFilters);
    },
    [filters, onFiltersChange, onAutoApply]
  );

  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      const newFilters = { ...filters, category: categoryId };
      onFiltersChange(newFilters);
      onAutoApply(newFilters);
    },
    [filters, onFiltersChange, onAutoApply]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = { ...filters, name: e.target.value };
      onFiltersChange(newFilters);
      scheduleAutoApply(newFilters);
    },
    [filters, onFiltersChange, scheduleAutoApply]
  );

  const handleMinAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = { ...filters, minAmount: e.target.value };
      onFiltersChange(newFilters);
      scheduleAutoApply(newFilters);
    },
    [filters, onFiltersChange, scheduleAutoApply]
  );

  const handleMaxAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = { ...filters, maxAmount: e.target.value };
      onFiltersChange(newFilters);
      scheduleAutoApply(newFilters);
    },
    [filters, onFiltersChange, scheduleAutoApply]
  );

  const handleFromDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = { ...filters, fromDate: e.target.value };
      onFiltersChange(newFilters);
      if (e.target.value === "" || isValidDateString(e.target.value)) onAutoApply(newFilters);
    },
    [filters, onFiltersChange, onAutoApply]
  );

  const handleToDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = { ...filters, toDate: e.target.value };
      onFiltersChange(newFilters);
      if (e.target.value === "" || isValidDateString(e.target.value)) onAutoApply(newFilters);
    },
    [filters, onFiltersChange, onAutoApply]
  );

  const handleClear = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onFiltersChange({
      type: "all",
      name: "",
      category: undefined,
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
    });
    if (minAmountRef.current) minAmountRef.current.value = "";
    if (maxAmountRef.current) maxAmountRef.current.value = "";
    onClear();
  }, [onFiltersChange, onClear]);

  const renderDateInput = (
    id: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    placeholder: string
  ) => {
    if (isTouchDevice) {
      return (
        <div className="relative w-full">
          <div
            className={`w-full min-w-0 min-h-[44px] truncate rounded-xl border bg-white py-3 px-4 text-base dark:bg-gray-800 flex items-center border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 ${value ? "text-gray-900 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"}`}
          >
            {value || placeholder}
          </div>
          <input
            type="date"
            id={id}
            value={value}
            onChange={onChange}
            className="placeholder:text-gray-400 dark:placeholder:text-gray-500 absolute inset-0 h-full w-full cursor-pointer opacity-0 focus:border-gray-400 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            style={{ fontSize: "16px" }}
          />
        </div>
      );
    }
    return (
      <input
        type="date"
        id={id}
        value={value}
        onChange={onChange}
        className="w-full min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
        style={{ fontSize: "16px" }}
      />
    );
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-md">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-base font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200 rounded-t-xl"
        aria-expanded={isExpanded}
      >
        <span>{t("filters")}</span>
        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <div className="w-1/3 min-w-0 relative">
              <select
                id="filter-type"
                value={filters.type}
                onChange={handleTypeChange}
                className="min-h-[44px] w-full appearance-none rounded-xl border px-3 py-3 text-base transition-colors duration-200 focus:outline-none border-gray-400 hover:border-black dark:border-gray-500 dark:hover:border-gray-400 bg-white text-gray-900 dark:text-gray-200 dark:bg-gray-800"
              >
                <option value="all">{t("filtersTypeAll")}</option>
                <option value="expense">{t("filtersTypeExpense")}</option>
                <option value="income">{t("filtersTypeIncome")}</option>
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                <ChevronDown className="h-5 w-5" />
              </div>
            </div>
            <div className="w-2/3 min-w-0">
              <CategoryDropdown
                placeholder={t("filtersAllCategories")}
                className="bg-white dark:bg-gray-800"
                categories={categories}
                value={filters.category}
                onChange={handleCategoryChange}
                currentLang={lang}
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type="text"
                id="filter-name"
                value={filters.name}
                onChange={handleNameChange}
                placeholder={t("filtersNamePlaceholder")}
                className="w-full min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white py-3 px-4 pr-10 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
              />
              {filters.name && (
                <button
                  type="button"
                  onClick={() => {
                    const newFilters = { ...filters, name: "" };
                    onFiltersChange(newFilters);
                    onAutoApply(newFilters);
                    document.getElementById("filter-name")?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={t("clearName")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              id="filter-minAmount"
              ref={minAmountRef}
              defaultValue={filters.minAmount}
              onChange={handleMinAmountChange}
              placeholder={t("filtersMinAmount")}
              className="no-spinners w-full min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              id="filter-maxAmount"
              ref={maxAmountRef}
              defaultValue={filters.maxAmount}
              onChange={handleMaxAmountChange}
              placeholder={t("filtersMaxAmount")}
              className="no-spinners w-full min-h-[44px] rounded-xl border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400 bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              {renderDateInput(
                "filter-fromDate",
                filters.fromDate,
                handleFromDateChange,
                t("filtersStartDate")
              )}
            </div>
            <div>
              {renderDateInput(
                "filter-toDate",
                filters.toDate,
                handleToDateChange,
                t("filtersEndDate")
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="flex-1 text-sm sm:text-base"
            >
              {t("filtersClear")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
