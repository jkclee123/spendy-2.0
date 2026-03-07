import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
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

// Color palette (Latte theme) for categories
const COLORS = [
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

/**
 * Pie chart component for displaying Expenses ratio with month navigation
 * Uses recharts for responsive, accessible visualization
 * Features month navigation with arrows and dropdown
 */
export function ExpensesRatio({ userId, className = "" }: CategoryPieChartProps) {
  const { lang } = useLanguage();
  const { t } = useTranslation("charts");

  const [currentYearMonth, setCurrentYearMonth] = useState<
    { year: number; month: number } | undefined
  >(undefined);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | undefined>(
    undefined
  );
  const [isAllTime, setIsAllTime] = useState(false);
  const [earliestYearMonth, setEarliestYearMonth] = useState<
    { year: number; month: number } | null | undefined
  >(undefined);
  const [categoryData, setCategoryData] = useState<CategoryAggregation[] | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    aggregatesService
      .getCurrentUserYearMonth(userId)
      .then((ym) => {
        setCurrentYearMonth(ym);
        setSelectedMonth((prev) => prev ?? ym);
      })
      .catch(() => {
        const now = new Date();
        const fallback = { year: now.getFullYear(), month: now.getMonth() };
        setCurrentYearMonth(fallback);
        setSelectedMonth((prev) => prev ?? fallback);
      });
    aggregatesService
      .getEarliestAggregateYearMonth(userId)
      .then((ym) => setEarliestYearMonth(ym))
      .catch(() => setEarliestYearMonth(null));
  }, [userId]);

  const dateRangeParams = useMemo(() => {
    if (!selectedMonth || !currentYearMonth) return null;
    if (isAllTime) {
      const startYM = earliestYearMonth ?? { year: currentYearMonth.year, month: 0 };
      return {
        startYear: startYM.year,
        startMonth: startYM.month + 1,
        endYear: currentYearMonth.year,
        endMonth: currentYearMonth.month + 1,
      };
    }
    return {
      startYear: selectedMonth.year,
      startMonth: selectedMonth.month + 1,
      endYear: selectedMonth.year,
      endMonth: selectedMonth.month + 1,
    };
  }, [isAllTime, selectedMonth, earliestYearMonth, currentYearMonth]);

  useEffect(() => {
    if (!userId || !dateRangeParams) return;
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
    if (earliestYearMonth == null || !currentYearMonth) return [];
    const months: Array<{ year: number; month: number; label: string }> = [];
    const current = new Date(currentYearMonth.year, currentYearMonth.month, 1);
    const start = new Date(earliestYearMonth.year, earliestYearMonth.month, 1);
    for (let date = new Date(start); date <= current; date.setMonth(date.getMonth() + 1)) {
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        label: `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`,
      });
    }
    return months;
  }, [earliestYearMonth, currentYearMonth]);

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
    if (!earliestAvailableMonth || !selectedMonth) return false;
    return (
      selectedMonth.year === earliestAvailableMonth.year &&
      selectedMonth.month === earliestAvailableMonth.month
    );
  }, [selectedMonth, earliestAvailableMonth]);

  const isAtLatestMonth = useMemo(() => {
    if (!latestAvailableMonth || !selectedMonth) return false;
    return (
      selectedMonth.year === latestAvailableMonth.year &&
      selectedMonth.month === latestAvailableMonth.month
    );
  }, [selectedMonth, latestAvailableMonth]);

  const goToPreviousMonth = useCallback(() => {
    if (isAtEarliestMonth) return;
    setSelectedMonth((prev) => {
      if (!prev) return prev;
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }, [isAtEarliestMonth]);

  const goToNextMonth = useCallback(() => {
    if (isAtLatestMonth) return;
    setSelectedMonth((prev) => {
      if (!prev) return prev;
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
    return [...categoryData]
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        category: getCategoryLabel(item),
        fill: COLORS[index % COLORS.length],
      }));
  }, [categoryData, getCategoryLabel]);

  const totalAmount = chartData.reduce((sum, item) => sum + item.total, 0);
  const isLoading =
    categoryData === undefined || earliestYearMonth === undefined || !currentYearMonth;
  const isEmpty = !isLoading && chartData.length === 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
      if (!categoryId || !selectedMonth) return null;
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

  const selectedMonthLabel = selectedMonth
    ? `${String(selectedMonth.month + 1).padStart(2, "0")}/${selectedMonth.year}`
    : "";
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
          value={
            isAllTime
              ? "all-time"
              : selectedMonth
                ? `${selectedMonth.year}-${selectedMonth.month}`
                : ""
          }
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
        </div>
      )}

      {/* Chart */}
      {!isLoading && !isEmpty && (
        <>
          {/* Total Expenses */}
          <div className="mb-5 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("totalExpenses")}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
              {formatCurrency(totalAmount)}
            </p>
          </div>

          {/* Horizontal Bar List */}
          <div className="flex flex-col gap-2">
            {chartData.map((item, index) => {
              const color = COLORS[index % COLORS.length];
              const widthPct = totalAmount > 0 ? (item.total / chartData[0].total) * 100 : 0;
              const categoryUrl = getCategoryLinkUrl(item.category_id);
              const rowContent = (
                <>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-xl w-8 text-center">{item.emoji || "?"}</span>
                    <span className="hidden lg:block text-sm text-gray-700 dark:text-gray-300 w-28 truncate">
                      {item.category}
                    </span>
                  </span>
                  {/* Bar */}
                  <div className="flex-1 h-1 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded origin-left"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: color,
                        animation: `barGrow 0.5s ease-out ${index * 60}ms both`,
                      }}
                    />
                  </div>
                  {/* Amount */}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 text-right shrink-0 tabular-nums">
                    {formatCurrency(item.total)}
                  </span>
                </>
              );
              return categoryUrl ? (
                <Link
                  key={item.category_id ?? item.category}
                  to={categoryUrl}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  {rowContent}
                </Link>
              ) : (
                <div key={item.category_id ?? item.category} className="flex items-center gap-2">
                  {rowContent}
                </div>
              );
            })}
          </div>

          <style>{`
            @keyframes barGrow {
              from { transform: scaleX(0); opacity: 0; }
              to { transform: scaleX(1); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
