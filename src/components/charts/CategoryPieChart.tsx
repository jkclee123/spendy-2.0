import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CategoryAggregation } from "@/types";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import * as aggregatesService from "@/lib/services/aggregates";

interface CategoryPieChartProps {
  userId: string;
  className?: string;
}

// Light mode color palette (Latte theme) for categories
const COLORS_LIGHT = [
  "#8839ef", // Mauve
  "#d20f39", // Red
  "#e64553", // Maroon
  "#fe640b", // Peach
  "#df8e1d", // Yellow
  "#40a02b", // Green
  "#179299", // Teal
  "#209fb5", // Sapphire
  "#04a5e5", // Sky
  "#1e66f5", // Blue
  "#7287fd", // Lavender
  "#ea76cb", // Pink
];

// Dark mode color palette (Mocha theme) for categories
const COLORS_DARK = [
  "#cba6f7", // Mauve
  "#f38ba8", // Red
  "#eba0ac", // Maroon
  "#fab387", // Peach
  "#f9e2af", // Yellow
  "#a6e3a1", // Green
  "#94e2d5", // Teal
  "#89dceb", // Sky
  "#74c7ec", // Sapphire
  "#89b4fa", // Blue
  "#b4befe", // Lavender
  "#f5c2e7", // Pink
];

/**
 * Pie chart component for displaying Expenses ratio with month navigation
 * Uses recharts for responsive, accessible visualization
 * Features month navigation with arrows and dropdown
 */
export function ExpensesRatio({ userId, className = "" }: CategoryPieChartProps) {
  const { lang } = useLanguage();
  const { t } = useTranslation("charts");
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: currentYear,
    month: currentMonth,
  });
  const [isAllTime, setIsAllTime] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [earliestTransactionDate, setEarliestTransactionDate] = useState<number | null | undefined>(
    undefined
  );
  const [categoryData, setCategoryData] = useState<CategoryAggregation[] | undefined>(undefined);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!userId) return;
    aggregatesService
      .getEarliestTransactionDate(userId)
      .then((date) => setEarliestTransactionDate(date))
      .catch(() => setEarliestTransactionDate(null));
  }, [userId]);

  const dateRangeParams = useMemo(() => {
    if (isAllTime) {
      const earliest = earliestTransactionDate
        ? new Date(earliestTransactionDate)
        : new Date(currentYear, 0, 1);
      const startYear = earliest.getFullYear();
      const startMonth = earliest.getMonth() + 1;
      const now = new Date();
      return {
        startYear,
        startMonth,
        endYear: now.getFullYear(),
        endMonth: now.getMonth() + 1,
      };
    }
    return {
      startYear: selectedMonth.year,
      startMonth: selectedMonth.month + 1,
      endYear: selectedMonth.year,
      endMonth: selectedMonth.month + 1,
    };
  }, [isAllTime, selectedMonth, earliestTransactionDate, currentYear]);

  useEffect(() => {
    if (!userId) return;
    setCategoryData(undefined);
    aggregatesService
      .getExpensesByCategory(
        userId,
        dateRangeParams.startYear,
        dateRangeParams.startMonth,
        dateRangeParams.endYear,
        dateRangeParams.endMonth
      )
      .then(setCategoryData)
      .catch(() => setCategoryData([]));
  }, [userId, dateRangeParams]);

  const availableMonths = useMemo(() => {
    if (earliestTransactionDate == null) return [];
    const earliest = new Date(earliestTransactionDate);
    const earliestYear = earliest.getFullYear();
    const earliestMonth = earliest.getMonth();
    const months: Array<{ year: number; month: number; label: string }> = [];
    const current = new Date(currentYear, currentMonth, 1);
    const start = new Date(earliestYear, earliestMonth, 1);
    for (let date = new Date(start); date <= current; date.setMonth(date.getMonth() + 1)) {
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        label: `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`,
      });
    }
    return months;
  }, [earliestTransactionDate, currentYear, currentMonth]);

  const earliestAvailableMonth = useMemo(() => {
    if (availableMonths.length === 0) return null;
    const earliest = availableMonths[0];
    return { year: earliest.year, month: earliest.month };
  }, [availableMonths]);

  const latestAvailableMonth = useMemo(() => {
    if (availableMonths.length === 0) return null;
    const latest = availableMonths[availableMonths.length - 1];
    return { year: latest.year, month: latest.month };
  }, [availableMonths]);

  const isAtEarliestMonth = useMemo(() => {
    if (!earliestAvailableMonth) return false;
    return (
      selectedMonth.year === earliestAvailableMonth.year &&
      selectedMonth.month === earliestAvailableMonth.month
    );
  }, [selectedMonth, earliestAvailableMonth]);

  const isAtLatestMonth = useMemo(() => {
    if (!latestAvailableMonth) return false;
    return (
      selectedMonth.year === latestAvailableMonth.year &&
      selectedMonth.month === latestAvailableMonth.month
    );
  }, [selectedMonth, latestAvailableMonth]);

  const goToPreviousMonth = useCallback(() => {
    if (isAtEarliestMonth) return;
    setSelectedMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }, [isAtEarliestMonth]);

  const goToNextMonth = useCallback(() => {
    if (isAtLatestMonth) return;
    setSelectedMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }, [isAtLatestMonth]);

  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "all-time") {
      setIsAllTime(true);
    } else if (value) {
      setIsAllTime(false);
      const [year, month] = value.split("-").map(Number);
      setSelectedMonth({ year, month });
    }
  }, []);

  const getCategoryLabel = useCallback(
    (item: CategoryAggregation): string => {
      if (item.en_name || item.zh_name) {
        const name = lang === "zh-HK" ? item.zh_name || item.en_name : item.en_name || item.zh_name;
        return name || t("uncategorized");
      }
      return t("uncategorized");
    },
    [lang, t]
  );

  const chartData = useMemo(() => {
    if (!categoryData) return [];
    const colors = isDarkMode ? COLORS_DARK : COLORS_LIGHT;
    return [...categoryData]
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        category: getCategoryLabel(item),
        fill: colors[index % colors.length],
      }));
  }, [categoryData, getCategoryLabel, isDarkMode]);

  const totalAmount = chartData.reduce((sum, item) => sum + item.total, 0);
  const isLoading = categoryData === undefined || earliestTransactionDate === undefined;
  const isEmpty = !isLoading && chartData.length === 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = useCallback((year: number, month: number, day: number): string => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }, []);

  const getLastDayOfMonth = useCallback((year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  }, []);

  const getCategoryLinkUrl = useCallback(
    (categoryId: string | null | undefined): string | null => {
      if (!categoryId) return null;
      const params = new URLSearchParams();
      params.set("category", categoryId);
      if (!isAllTime) {
        params.set("fromDate", formatDate(selectedMonth.year, selectedMonth.month, 1));
        params.set(
          "toDate",
          formatDate(
            selectedMonth.year,
            selectedMonth.month,
            getLastDayOfMonth(selectedMonth.year, selectedMonth.month)
          )
        );
      }
      return `/transactions?${params.toString()}`;
    },
    [isAllTime, selectedMonth, formatDate, getLastDayOfMonth]
  );

  const selectedMonthLabel = `${String(selectedMonth.month + 1).padStart(2, "0")}/${selectedMonth.year}`;
  const emptyStateMessage = isAllTime
    ? t("noData", { period: t("allTime") })
    : t("noDataForMonth", { month: selectedMonthLabel });

  return (
    <div className={`w-full ${className}`}>
      {/* Month Navigation Controls */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={goToPreviousMonth}
          disabled={isAllTime || isAtEarliestMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
          aria-label={t("monthNavigation.previousMonth")}
          aria-disabled={isAllTime || isAtEarliestMonth}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <select
          value={isAllTime ? "all-time" : `${selectedMonth.year}-${selectedMonth.month}`}
          onChange={handleMonthChange}
          className="min-h-[44px] appearance-none rounded-lg border border-gray-400 dark:border-gray-500 bg-white px-4 py-2 text-center text-sm font-medium text-gray-900 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-200"
          aria-label={t("monthNavigation.selectMonth")}
        >
          <option value="all-time">{t("allTime")}</option>
          {availableMonths.map((month) => (
            <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>
              {month.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={goToNextMonth}
          disabled={isAllTime || isAtLatestMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
          aria-label={t("monthNavigation.nextMonth")}
          aria-disabled={isAllTime || isAtLatestMonth}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
            {emptyStateMessage}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("totalExpenses")}: {formatCurrency(0)}
          </p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && !isEmpty && (
        <>
          <div className="h-64 sm:h-80 relative [&_.recharts-pie-sector]:pointer-events-none [&_svg]:outline-none [&_svg]:focus:outline-none [&_*]:outline-none [&_*]:focus:outline-none">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
              aspect={undefined}
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  innerRadius="50%"
                  paddingAngle={1}
                  animationDuration={1000}
                  strokeWidth={0}
                  label={({ percent = 0, x, y, textAnchor, payload }) => {
                    const percentage = (percent * 100).toFixed(0);
                    if (parseInt(percentage) < 3) return null;
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        fill={isDarkMode ? "white" : "#1f2937"}
                        fontSize={13}
                        fontWeight={600}
                      >
                        {payload.emoji} {percentage}%
                      </text>
                    );
                  }}
                  labelLine={false}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Expenses Label in Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("totalExpenses")}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* Detailed Category List */}
          <table className="mt-6 w-full border-collapse">
            <tbody>
              {chartData.map((item, index) => {
                const percentage = totalAmount > 0 ? (item.total / totalAmount) * 100 : 0;
                const categoryUrl = getCategoryLinkUrl(item.category_id);
                return (
                  <tr
                    key={item.category}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                  >
                    <td className="py-3 pl-0 pr-2">
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                          {index + 1}
                        </span>
                        {categoryUrl ? (
                          <Link
                            to={categoryUrl}
                            className="flex items-center gap-3 hover:opacity-70 transition-opacity"
                          >
                            <span className="text-xl">{item.emoji}</span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {item.category}
                            </span>
                          </Link>
                        ) : (
                          <>
                            <span className="text-xl">{item.emoji}</span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {item.category}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pl-2 pr-0 text-right w-[60px]">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.total)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right w-[80px]">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                        {percentage.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
