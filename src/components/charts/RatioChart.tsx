import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import * as aggregatesService from "@/lib/services/aggregates";
import { RATIO_CHART_COLORS } from "@/lib/ratioPalette";

/** Inclusive month range; months are 1-indexed to match the RPC contract. */
export interface PeriodRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

/** `YYYY-MM-DD` bounds for /transactions links. `null` means "no date filter". */
export interface DateFilter {
  fromDate: string;
  toDate: string;
}

/** A single row of the ratio list. */
export interface RatioItem {
  key: string;
  label: string;
  emoji?: string | null;
  total: number;
  /** Category id or transaction name used to build the row link. */
  filterValue: string | null;
}

/**
 * The period the user picked: all time, a whole year, or a single month.
 * Month is 0-indexed, matching the JS Date convention used across this file.
 */
type Selection =
  { kind: "all" } | { kind: "year"; year: number } | { kind: "month"; year: number; month: number };

interface PeriodOption {
  value: string;
  label: string;
  selection: Selection;
}

interface RatioChartProps {
  userId: string;
  /** URL search-param prefix, so several charts on one page stay independent. */
  paramPrefix: string;
  totalLabel: string;
  /** Must be referentially stable — it drives the data-loading effect. */
  fetchItems: (userId: string, range: PeriodRange) => Promise<RatioItem[]>;
  itemHref: (item: RatioItem, dateFilter: DateFilter | null) => string | null;
  totalHref: (dateFilter: DateFilter | null) => string | null;
  showEmoji?: boolean;
  /** Walk the hue palette backwards, so two charts side by side never match. */
  reverseColors?: boolean;
  className?: string;
}

function encodeSelection(selection: Selection): string {
  if (selection.kind === "all") return "all-time";
  if (selection.kind === "year") return `y-${selection.year}`;
  return `m-${selection.year}-${selection.month}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Horizontal bar breakdown of a total over a selectable period.
 *
 * The period dropdown offers "All Time", every month since the user's first
 * transaction, and a whole-year option after the last month of each year.
 * Arrows step within the selected granularity (month -> month, year -> year)
 * and are disabled on "All Time".
 */
export function RatioChart({
  userId,
  paramPrefix,
  totalLabel,
  fetchItems,
  itemHref,
  totalHref,
  showEmoji = false,
  reverseColors = false,
  className = "",
}: RatioChartProps) {
  const { t } = useTranslation("charts");
  const [searchParams, setSearchParams] = useSearchParams();

  const monthParam = `${paramPrefix}Month`;
  const yearParam = `${paramPrefix}Year`;
  const allTimeParam = `${paramPrefix}AllTime`;

  const [currentYearMonth, setCurrentYearMonth] = useState<
    { year: number; month: number } | undefined
  >(undefined);
  const [earliestYearMonth, setEarliestYearMonth] = useState<
    { year: number; month: number } | null | undefined
  >(undefined);
  const [items, setItems] = useState<RatioItem[] | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    aggregatesService
      .getCurrentUserYearMonth(userId)
      .then(setCurrentYearMonth)
      .catch(() => {
        const now = new Date();
        setCurrentYearMonth({ year: now.getFullYear(), month: now.getMonth() });
      });
    aggregatesService
      .getEarliestAggregateYearMonth(userId)
      .then((ym) => setEarliestYearMonth(ym))
      .catch(() => setEarliestYearMonth(null));
  }, [userId]);

  // Read the values, not the URLSearchParams object: react-router hands every
  // consumer a fresh instance on any param change, so depending on the object
  // would make this chart re-derive (and refetch) when a sibling chart moves.
  const allTimeValue = searchParams.get(allTimeParam);
  const yearValue = searchParams.get(yearParam);
  const monthValue = searchParams.get(monthParam);

  const selection = useMemo<Selection | undefined>(() => {
    if (allTimeValue === "1") return { kind: "all" };

    if (yearValue) {
      const year = Number(yearValue);
      if (Number.isInteger(year) && year > 0) return { kind: "year", year };
    }

    if (monthValue) {
      const [y, m] = monthValue.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return { kind: "month", year: y, month: m - 1 };
      }
    }

    if (currentYearMonth) {
      return { kind: "month", year: currentYearMonth.year, month: currentYearMonth.month };
    }
    return undefined;
  }, [allTimeValue, yearValue, monthValue, currentYearMonth]);

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

  const selectPeriod = useCallback(
    (next: Selection) => {
      if (next.kind === "all") {
        updateParams({ [allTimeParam]: "1", [yearParam]: null, [monthParam]: null });
      } else if (next.kind === "year") {
        updateParams({ [yearParam]: String(next.year), [allTimeParam]: null, [monthParam]: null });
      } else {
        updateParams({
          [monthParam]: `${next.year}-${String(next.month + 1).padStart(2, "0")}`,
          [allTimeParam]: null,
          [yearParam]: null,
        });
      }
    },
    [updateParams, allTimeParam, yearParam, monthParam]
  );

  /** Months from the user's first aggregate up to the current month, oldest first. */
  const availableMonths = useMemo(() => {
    if (earliestYearMonth == null || !currentYearMonth) return [];
    const months: Array<{ year: number; month: number }> = [];
    const current = new Date(currentYearMonth.year, currentYearMonth.month, 1);
    for (
      const date = new Date(earliestYearMonth.year, earliestYearMonth.month, 1);
      date <= current;
      date.setMonth(date.getMonth() + 1)
    ) {
      months.push({ year: date.getFullYear(), month: date.getMonth() });
    }
    return months;
  }, [earliestYearMonth, currentYearMonth]);

  const availableYears = useMemo(
    () => [...new Set(availableMonths.map((m) => m.year))],
    [availableMonths]
  );

  /** "All Time", then each year's months followed by that whole year. */
  const periodOptions = useMemo<PeriodOption[]>(() => {
    if (availableMonths.length === 0) return [];
    const options: PeriodOption[] = [
      { value: "all-time", label: t("allTime"), selection: { kind: "all" } },
    ];
    for (const year of availableYears) {
      for (const m of availableMonths.filter((month) => month.year === year)) {
        const monthSelection: Selection = { kind: "month", year, month: m.month };
        options.push({
          value: encodeSelection(monthSelection),
          label: `${String(m.month + 1).padStart(2, "0")}/${year}`,
          selection: monthSelection,
        });
      }
      const yearSelection: Selection = { kind: "year", year };
      options.push({
        value: encodeSelection(yearSelection),
        label: String(year),
        selection: yearSelection,
      });
    }
    return options;
  }, [availableMonths, availableYears, t]);

  const canGoPrevious = useMemo(() => {
    if (!selection || availableMonths.length === 0) return false;
    if (selection.kind === "all") return false;
    if (selection.kind === "year") return selection.year > availableYears[0];
    const first = availableMonths[0];
    return (
      selection.year > first.year ||
      (selection.year === first.year && selection.month > first.month)
    );
  }, [selection, availableMonths, availableYears]);

  const canGoNext = useMemo(() => {
    if (!selection || availableMonths.length === 0) return false;
    if (selection.kind === "all") return false;
    if (selection.kind === "year") {
      return selection.year < availableYears[availableYears.length - 1];
    }
    const last = availableMonths[availableMonths.length - 1];
    return (
      selection.year < last.year || (selection.year === last.year && selection.month < last.month)
    );
  }, [selection, availableMonths, availableYears]);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (!selection || selection.kind === "all") return;
      if (selection.kind === "year") {
        selectPeriod({ kind: "year", year: selection.year + direction });
        return;
      }
      const absolute = selection.year * 12 + selection.month + direction;
      selectPeriod({ kind: "month", year: Math.floor(absolute / 12), month: absolute % 12 });
    },
    [selection, selectPeriod]
  );

  const goToPrevious = useCallback(() => {
    if (canGoPrevious) step(-1);
  }, [canGoPrevious, step]);

  const goToNext = useCallback(() => {
    if (canGoNext) step(1);
  }, [canGoNext, step]);

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const option = periodOptions.find((o) => o.value === e.target.value);
      if (option) selectPeriod(option.selection);
    },
    [periodOptions, selectPeriod]
  );

  const range = useMemo<PeriodRange | null>(() => {
    if (!selection || !currentYearMonth) return null;
    if (selection.kind === "all") {
      const start = earliestYearMonth ?? { year: currentYearMonth.year, month: 0 };
      return {
        startYear: start.year,
        startMonth: start.month + 1,
        endYear: currentYearMonth.year,
        endMonth: currentYearMonth.month + 1,
      };
    }
    if (selection.kind === "year") {
      return { startYear: selection.year, startMonth: 1, endYear: selection.year, endMonth: 12 };
    }
    return {
      startYear: selection.year,
      startMonth: selection.month + 1,
      endYear: selection.year,
      endMonth: selection.month + 1,
    };
  }, [selection, earliestYearMonth, currentYearMonth]);

  useEffect(() => {
    if (!userId || !range) return;
    let cancelled = false;
    setItems(undefined);
    fetchItems(userId, range)
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, range, fetchItems]);

  const dateFilter = useMemo<DateFilter | null>(() => {
    if (!selection || selection.kind === "all") return null;
    if (selection.kind === "year") {
      return {
        fromDate: formatDate(selection.year, 0, 1),
        toDate: formatDate(selection.year, 11, 31),
      };
    }
    const { year, month } = selection;
    return {
      fromDate: formatDate(year, month, 1),
      toDate: formatDate(year, month, lastDayOfMonth(year, month)),
    };
  }, [selection]);

  const rows = useMemo(() => {
    if (!items) return [];
    const palette = reverseColors ? [...RATIO_CHART_COLORS].reverse() : RATIO_CHART_COLORS;
    return [...items]
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        fill: palette[index % palette.length],
      }));
  }, [items, reverseColors]);

  const totalAmount = rows.reduce((sum, item) => sum + item.total, 0);
  const isLoading = items === undefined || earliestYearMonth === undefined || !currentYearMonth;
  const isEmpty = !isLoading && rows.length === 0;

  const periodLabel = useMemo(() => {
    if (!selection) return "";
    if (selection.kind === "all") return t("allTime");
    if (selection.kind === "year") return String(selection.year);
    return `${String(selection.month + 1).padStart(2, "0")}/${selection.year}`;
  }, [selection, t]);

  const totalUrl = totalHref(dateFilter);
  const totalBlock = (
    <div className="text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{totalLabel}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
        {formatCurrency(totalAmount)}
      </p>
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      {/* Period Navigation Controls */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={!canGoPrevious}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
          aria-label={t("monthNavigation.previousMonth")}
          aria-disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <select
          value={selection ? encodeSelection(selection) : ""}
          onChange={handleSelectChange}
          className="min-h-[44px] appearance-none rounded-lg border border-gray-400 dark:border-gray-500 bg-white px-4 py-2 text-center text-sm font-medium text-gray-900 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-200"
          aria-label={t("monthNavigation.selectMonth")}
        >
          {periodOptions.length === 0 && <option value="all-time">{t("allTime")}</option>}
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={goToNext}
          disabled={!canGoNext}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-400 dark:border-gray-500 bg-white text-gray-700 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:disabled:hover:bg-gray-900"
          aria-label={t("monthNavigation.nextMonth")}
          aria-disabled={!canGoNext}
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
            {t("noDataForPeriod", { period: periodLabel })}
          </p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && !isEmpty && (
        <>
          {/* Total */}
          <div className="mb-5 flex items-start justify-center gap-8">
            {totalUrl ? (
              <Link to={totalUrl} className="hover:opacity-70 transition-opacity">
                {totalBlock}
              </Link>
            ) : (
              totalBlock
            )}
          </div>

          {/* Horizontal Bar List */}
          <div className="flex flex-col gap-2">
            {rows.map((item, index) => {
              const widthPct = rows[0].total > 0 ? (item.total / rows[0].total) * 100 : 0;
              const sharePct = totalAmount > 0 ? (item.total / totalAmount) * 100 : 0;
              const href = itemHref(item, dateFilter);
              const rowContent = (
                <>
                  <span className="flex items-center gap-1 shrink-0">
                    {showEmoji && (
                      <span className="text-xl w-8 text-center">{item.emoji || "?"}</span>
                    )}
                    <span
                      className={`text-sm text-gray-700 dark:text-gray-300 truncate ${
                        showEmoji ? "hidden lg:block w-12" : "w-20 lg:w-32"
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                  {/* Bar */}
                  <div className="flex-1 h-1 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded origin-left"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: item.fill,
                        animation: `barGrow 0.5s ease-out ${index * 60}ms both`,
                      }}
                    />
                  </div>
                  {/* Amount */}
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-20 text-right shrink-0 tabular-nums">
                    {formatCurrency(item.total)}
                  </span>
                  {/* Share of the period total */}
                  <span className="text-sm text-gray-700 dark:text-gray-300 w-12 text-right shrink-0 tabular-nums">
                    {sharePct.toFixed(1)}%
                  </span>
                </>
              );
              return href ? (
                <Link
                  key={item.key}
                  to={href}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  {rowContent}
                </Link>
              ) : (
                <div key={item.key} className="flex items-center gap-2">
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
