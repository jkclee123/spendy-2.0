import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ComposedChart,
  Bar,
  ReferenceLine,
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
import { readCatCache, writeCatCache } from "@/lib/catCache";
import type { UserCategory, MonthlyIncomeExpenseData } from "@/types";

interface IncomeExpenseTrendChartProps {
  userId: string;
  className?: string;
}

export function IncomeExpenseTrendChart({ userId, className = "" }: IncomeExpenseTrendChartProps) {
  const { lang } = useLanguage();
  const { t } = useTranslation("charts");
  const [searchParams, setSearchParams] = useSearchParams();

  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDarkMode(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [availableYears, setAvailableYears] = useState<number[] | null>(null);
  const [categories, setCategories] = useState<UserCategory[] | undefined>(undefined);
  const [monthlyData, setMonthlyData] = useState<MonthlyIncomeExpenseData[] | undefined>(undefined);
  const [isRefetchingMonthly, setIsRefetchingMonthly] = useState(false);

  const selectedYear = useMemo<number>(() => {
    const param = searchParams.get("trendYear");
    if (param) {
      const parsed = parseInt(param, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return currentYear;
  }, [searchParams, currentYear]);

  const selectedExpenseCategoryId = searchParams.get("trendCat") || null;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v == null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!userId) return;
    aggregatesService
      .getCurrentUserYearMonth(userId)
      .then(({ year, month }) => {
        setCurrentYear(year);
        setCurrentMonth(month + 1);
      })
      .catch(() => {
        setCurrentYear(new Date().getFullYear());
      });
    aggregatesService
      .listAvailableTransactionYears(userId)
      .then(setAvailableYears)
      .catch(() => setAvailableYears([]));
    const cached = readCatCache(userId);
    if (cached) {
      setCategories(cached);
    }
    categoryService
      .listActiveByUser(userId)
      .then((fresh) => {
        setCategories(fresh);
        writeCatCache(userId, fresh);
      })
      .catch(() => setCategories([]));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
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

  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateParams({ trendYear: String(parseInt(e.target.value, 10)) });
    },
    [updateParams]
  );

  const earliestAvailableYear = useMemo(() => {
    if (!availableYears || availableYears.length === 0) return currentYear;
    return Math.min(...availableYears);
  }, [availableYears, currentYear]);

  const latestAvailableYear = useMemo(() => {
    if (!availableYears || availableYears.length === 0) return currentYear;
    return Math.max(...availableYears);
  }, [availableYears, currentYear]);

  const isAtEarliestYear = useMemo(
    () => selectedYear <= earliestAvailableYear,
    [selectedYear, earliestAvailableYear]
  );
  const isAtLatestYear = useMemo(
    () => selectedYear >= latestAvailableYear,
    [selectedYear, latestAvailableYear]
  );

  const goToPreviousYear = useCallback(() => {
    if (isAtEarliestYear) return;
    updateParams({ trendYear: String(selectedYear - 1) });
  }, [isAtEarliestYear, selectedYear, updateParams]);

  const goToNextYear = useCallback(() => {
    if (isAtLatestYear) return;
    updateParams({ trendYear: String(selectedYear + 1) });
  }, [isAtLatestYear, selectedYear, updateParams]);

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      updateParams({ trendCat: value || null });
    },
    [updateParams]
  );

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
    const dataMap = new Map((monthlyData ?? []).map((item) => [item.month, item]));
    let cumulativeNetIncome = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const item = dataMap.get(monthNum);
      const isFuture =
        selectedYear > currentYear || (selectedYear === currentYear && monthNum > currentMonth);
      const netIncome = (item?.income ?? 0) - (item?.expense ?? 0);
      if (!isFuture) cumulativeNetIncome += netIncome;
      return {
        month: monthNum,
        monthLabel: getMonthLabel(monthNum),
        income: isFuture ? null : (item?.income ?? 0),
        expense: isFuture ? null : (item?.expense ?? 0),
        netIncome: isFuture ? null : netIncome,
        cumulativeNetIncome: isFuture ? null : cumulativeNetIncome,
      };
    });
  }, [monthlyData, getMonthLabel, selectedYear, currentYear, currentMonth]);

  const yAxisTicks = useMemo(() => {
    const maxValue = selectedExpenseCategoryId
      ? Math.max(...chartData.map((d) => d.expense ?? 0))
      : Math.max(
          ...chartData.map((d) =>
            Math.max(d.income ?? 0, d.expense ?? 0, d.cumulativeNetIncome ?? 0)
          )
        );
    const minValue = selectedExpenseCategoryId
      ? 0
      : Math.min(
          0,
          ...chartData.map((d) => Math.min(d.netIncome ?? 0, d.cumulativeNetIncome ?? 0))
        );
    const step = 5000;
    const tickMax = Math.max(20000, Math.ceil(maxValue / step) * step);
    const tickMin = selectedExpenseCategoryId
      ? 0
      : Math.min(-10000, Math.floor(minValue / step) * step);
    return Array.from(
      { length: Math.round((tickMax - tickMin) / step) + 1 },
      (_, i) => tickMin + i * step
    );
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
              {label} {selectedYear}
            </p>
            {payload.map((entry, index) => (
              <p
                key={index}
                className="text-sm"
                style={{
                  color:
                    entry.name === "income"
                      ? "#22c55e"
                      : entry.name === "netIncome"
                        ? "#3b82f6"
                        : entry.name === "cumulativeNetIncome"
                          ? "#f97316"
                          : "#ef4444",
                }}
              >
                {t(entry.name)}: {formatCurrency(entry.value)}
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
    return chartData.every((d) => (d.income ?? 0) === 0 && (d.expense ?? 0) === 0);
  }, [chartData, monthlyData]);

  const isLoading =
    monthlyData === undefined || categories === undefined || availableYears === null;

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
            value={selectedYear}
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
            {categories
              ?.filter((category) => category.type === "expense")
              .map((category) => {
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
        <div className="flex h-80 sm:h-[420px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Chart + empty state — keep mounted during refetch to avoid layout collapse */}
      {!isLoading && (
        <div className={isRefetchingMonthly ? "opacity-50 pointer-events-none" : ""}>
          {isEmpty ? (
            <div className="flex h-80 sm:h-[420px] flex-col items-center justify-center">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
                {t("noData", { period: selectedYear })}
              </p>
            </div>
          ) : (
            <div className="h-80 sm:h-[420px] [&>div]:outline-none [&_svg]:outline-none">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                aspect={undefined}
              >
                <ComposedChart
                  data={chartData}
                  margin={{ top: 16, right: 8, left: 12, bottom: 0 }}
                  barGap={3}
                  barCategoryGap="25%"
                >
                  <CartesianGrid stroke={isDarkMode ? "#374151" : "#E8E8E8"} vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 12, fill: "#808080" }}
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 12, right: 12 }}
                    minTickGap={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    ticks={yAxisTicks}
                    interval={0}
                    domain={[yAxisTicks[0], yAxisTicks[yAxisTicks.length - 1]]}
                    tickFormatter={(value) => {
                      const sign = value < 0 ? "-" : "";
                      const amount = Math.abs(value);
                      if (amount >= 1000) {
                        const k = amount / 1000;
                        return `${sign}$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
                      }
                      return `${sign}$${amount}`;
                    }}
                    tick={{ fontSize: 12, fill: "#808080" }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: isDarkMode ? "#ffffff" : "#000000", fillOpacity: 0.04 }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value: string) => (
                      <span
                        style={{
                          color:
                            value === "income"
                              ? "#22c55e"
                              : value === "netIncome"
                                ? "#3b82f6"
                                : value === "cumulativeNetIncome"
                                  ? "#f97316"
                                  : "#ef4444",
                        }}
                      >
                        {t(value)}
                      </span>
                    )}
                  />
                  {!selectedExpenseCategoryId && (
                    <Bar
                      dataKey="income"
                      fill="#22c55e"
                      fillOpacity={0.8}
                      maxBarSize={24}
                      radius={[3, 3, 0, 0]}
                    />
                  )}
                  <Bar
                    dataKey="expense"
                    fill="#ef4444"
                    fillOpacity={0.8}
                    maxBarSize={24}
                    radius={[3, 3, 0, 0]}
                  />
                  {!selectedExpenseCategoryId && (
                    <Line
                      type="linear"
                      dataKey="netIncome"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#3b82f6" }}
                    />
                  )}
                  {!selectedExpenseCategoryId && (
                    <Line
                      type="linear"
                      dataKey="cumulativeNetIncome"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#f97316" }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
