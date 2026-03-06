import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import * as aggregatesService from "@/lib/services/aggregates";
import * as categoryService from "@/lib/services/categories";
import type { UserCategory, MonthlyIncomeExpenseData } from "@/types";

interface IncomeExpenseTrendChartProps {
  userId: string;
  className?: string;
}

export function IncomeExpenseTrendChart({ userId, className = "" }: IncomeExpenseTrendChartProps) {
  const { lang } = useLanguage();
  const { t } = useTranslation("charts");

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[] | null>(null);
  const [categories, setCategories] = useState<UserCategory[] | undefined>(undefined);
  const [monthlyData, setMonthlyData] = useState<MonthlyIncomeExpenseData[] | undefined>(undefined);
  const [isRefetchingMonthly, setIsRefetchingMonthly] = useState(false);

  useEffect(() => {
    if (!userId) return;
    aggregatesService
      .getCurrentUserYearMonth(userId)
      .then(({ year }) => {
        setCurrentYear(year);
        setSelectedYear((prev) => prev ?? year);
      })
      .catch(() => {
        const year = new Date().getFullYear();
        setCurrentYear(year);
        setSelectedYear((prev) => prev ?? year);
      });
    aggregatesService
      .listAvailableTransactionYears(userId)
      .then(setAvailableYears)
      .catch(() => setAvailableYears([]));
    categoryService
      .listActiveByUser(userId)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [userId]);

  useEffect(() => {
    if (!userId || selectedYear === null) return;
    setIsRefetchingMonthly(true);
    aggregatesService
      .getMonthlyIncomeExpenseTrend(userId, selectedYear, selectedExpenseCategoryId)
      .then((data) => {
        setMonthlyData(data);
        setIsRefetchingMonthly(false);
      })
      .catch(() => {
        setMonthlyData([]);
        setIsRefetchingMonthly(false);
      });
  }, [userId, selectedYear, selectedExpenseCategoryId]);

  const handleYearChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value, 10));
  }, []);

  const earliestAvailableYear = useMemo(() => {
    if (!availableYears || availableYears.length === 0) return currentYear;
    return Math.min(...availableYears);
  }, [availableYears, currentYear]);

  const latestAvailableYear = useMemo(() => {
    if (!availableYears || availableYears.length === 0) return currentYear;
    return Math.max(...availableYears);
  }, [availableYears, currentYear]);

  const isAtEarliestYear = useMemo(
    () => selectedYear === null || selectedYear <= earliestAvailableYear,
    [selectedYear, earliestAvailableYear]
  );
  const isAtLatestYear = useMemo(
    () => selectedYear === null || selectedYear >= latestAvailableYear,
    [selectedYear, latestAvailableYear]
  );

  const goToPreviousYear = useCallback(() => {
    if (isAtEarliestYear) return;
    setSelectedYear((prev) => (prev !== null ? prev - 1 : prev));
  }, [isAtEarliestYear]);

  const goToNextYear = useCallback(() => {
    if (isAtLatestYear) return;
    setSelectedYear((prev) => (prev !== null ? prev + 1 : prev));
  }, [isAtLatestYear]);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedExpenseCategoryId(value || null);
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const getMonthLabel = useCallback(
    (monthNum: number) => {
      const date = new Date(2024, monthNum - 1);
      return date.toLocaleDateString(lang === "zh-HK" ? "zh-HK" : "en-US", { month: "short" });
    },
    [lang]
  );

  const chartData = useMemo(() => {
    if (!monthlyData) {
      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthLabel: getMonthLabel(i + 1),
        income: 0,
        expense: 0,
      }));
    }
    const dataMap = new Map(monthlyData.map((item) => [item.month, item]));
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const item = dataMap.get(monthNum);
      return {
        month: monthNum,
        monthLabel: getMonthLabel(monthNum),
        income: item?.income ?? 0,
        expense: item?.expense ?? 0,
      };
    });
  }, [monthlyData, getMonthLabel]);

  const yAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [0, 500, 1000, 1500, 2000];
    const maxValue = selectedExpenseCategoryId
      ? Math.max(...chartData.map((d) => d.expense))
      : Math.max(...chartData.map((d) => Math.max(d.income, d.expense)));
    if (maxValue === 0) return [0, 500, 1000, 1500, 2000];
    const tickMax = Math.ceil(maxValue / 500) * 500;
    return Array.from({ length: tickMax / 500 + 1 }, (_, i) => i * 500);
  }, [chartData, selectedExpenseCategoryId]);

  const CustomTooltip = useCallback(
    ({
      active,
      payload,
      label,
    }: {
      active?: boolean;
      payload?: Array<{ name: string; value: number }>;
      label?: string;
    }) => {
      if (active && payload && payload.length) {
        return (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 shadow-lg border border-gray-300 dark:border-gray-500">
            <p className="font-medium text-gray-900 dark:text-gray-200 mb-2">
              {label} {selectedYear!}
            </p>
            {payload.map((entry, index) => (
              <p
                key={index}
                className="text-sm"
                style={{ color: entry.name === "income" ? "#22c55e" : "#ef4444" }}
              >
                {entry.name === "income" ? t("income") || "Income" : t("expense") || "Expense"}:{" "}
                {formatCurrency(entry.value)}
              </p>
            ))}
          </div>
        );
      }
      return null;
    },
    [selectedYear, formatCurrency, t]
  );

  const isEmpty = useMemo(() => {
    if (!monthlyData) return false;
    return chartData.every((d) => d.income === 0 && d.expense === 0);
  }, [chartData, monthlyData]);

  const isLoading =
    monthlyData === undefined ||
    categories === undefined ||
    availableYears === null ||
    selectedYear === null;

  // Suppress unused isDarkMode warning — used for grid color
  void isDarkMode;

  return (
    <div className={`w-full ${className}`}>
      {/* Year Navigation and Category Filter */}
      <div className="mb-4 flex flex-row flex-wrap items-center justify-between gap-3">
        {/* Year Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousYear}
            disabled={isAtEarliestYear}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
            aria-label={t("yearNavigation.previousYear")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <select
            value={selectedYear!}
            onChange={handleYearChange}
            className="min-h-[38px] appearance-none rounded-lg border border-gray-400 dark:border-gray-500 bg-white px-4 py-2 text-center text-sm font-medium text-gray-900 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-200"
            aria-label={t("yearNavigation.selectYear")}
          >
            {(availableYears?.includes(currentYear) ? [] : [currentYear])
              .concat(availableYears || [])
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={goToNextYear}
            disabled={isAtLatestYear}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
            aria-label={t("yearNavigation.nextYear")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Expense Category Filter */}
        <div className="flex items-center gap-2">
          <select
            id="expense-category-filter"
            value={selectedExpenseCategoryId || ""}
            onChange={handleCategoryChange}
            disabled={isLoading}
            className="min-h-[38px] appearance-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:border-black focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-400"
            aria-label={t("categoryFilter.all")}
          >
            <option value="">{t("categoryFilter.all")}</option>
            {categories?.map((category) => {
              const name =
                lang === "zh-HK"
                  ? category.zh_name || category.en_name
                  : category.en_name || category.zh_name;
              return (
                <option key={category.id} value={category.id}>
                  {category.emoji} {name || "Unnamed"}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Chart + empty state — keep mounted during refetch to avoid layout collapse */}
      {!isLoading && (
        <div className={isRefetchingMonthly ? "opacity-50 pointer-events-none" : ""}>
          {isEmpty ? (
            <div className="flex h-64 flex-col items-center justify-center">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
                {t("noData", { period: selectedYear! })}
              </p>
            </div>
          ) : (
            <div className="h-64 sm:h-80">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                aspect={undefined}
              >
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={isDarkMode ? "#363636" : "#E8E8E8"} vertical={true} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 12, fill: "#808080" }}
                    tickLine={false}
                    axisLine={{ stroke: "#808080" }}
                    interval={0}
                  />
                  <YAxis
                    ticks={yAxisTicks}
                    domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`
                    }
                    tick={{ fontSize: 12, fill: "#808080" }}
                    tickLine={false}
                    axisLine={{ stroke: "#808080" }}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value: string) => (
                      <span style={{ color: value === "income" ? "#22c55e" : "#ef4444" }}>
                        {value === "income" ? t("income") || "Income" : t("expense") || "Expense"}
                      </span>
                    )}
                  />
                  {!selectedExpenseCategoryId && (
                    <Line
                      type="linear"
                      dataKey="income"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: "#22c55e" }}
                    />
                  )}
                  <Line
                    type="linear"
                    dataKey="expense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: "#ef4444" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
