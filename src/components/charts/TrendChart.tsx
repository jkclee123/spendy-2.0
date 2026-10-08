import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  ComposedChart,
  ReferenceLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

const metricColors = {
  income: "#22c55e",
  expense: "#ef4444",
  netIncome: "#a855f7",
  cumulativeNetIncome: "#eab308",
};
type Metric = keyof typeof metricColors;
const metrics: Metric[] = ["income", "expense", "netIncome", "cumulativeNetIncome"];

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
  const [currentPeriodReady, setCurrentPeriodReady] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[] | null>(null);
  const [earliestTransactionDate, setEarliestTransactionDate] = useState<number | null>(null);
  const [categories, setCategories] = useState<UserCategory[] | undefined>(undefined);
  const [monthlyData, setMonthlyData] = useState<MonthlyIncomeExpenseData[] | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [comparisonData, setComparisonData] = useState<MonthlyIncomeExpenseData[]>([]);

  const selectedYear = useMemo<number>(() => {
    const param = searchParams.get("trendYear");
    if (param) {
      const parsed = Number(param);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return currentYear;
  }, [searchParams, currentYear]);

  const year2Param = searchParams.get("trendYear2");
  const selectedYear2 =
    year2Param && Number.isInteger(Number(year2Param)) && Number(year2Param) > 0
      ? Number(year2Param)
      : null;

  const selectedCategoryId = searchParams.get("trendCat") || null;
  const selectedCategory = categories?.find((category) => category.id === selectedCategoryId);
  const selectedCategoryName = selectedCategory
    ? (lang === "zh-HK"
        ? selectedCategory.zh_name || selectedCategory.en_name
        : selectedCategory.en_name || selectedCategory.zh_name) || "Unnamed"
    : null;
  const metricParam = searchParams.get("trendMetric") || "All";
  const selectedMetric: Metric | "All" = metrics.includes(metricParam as Metric)
    ? (metricParam as Metric)
    : selectedYear2
      ? "expense"
      : "All";
  const tooltipContainer = useRef<HTMLDivElement>(null);
  const [pinnedMonth, setPinnedMonth] = useState<{ index: number } | null>(null);

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
    const updates: Record<string, string | null> = {};
    if (
      currentPeriodReady &&
      searchParams.has("trendYear") &&
      searchParams.get("trendYear") !== String(selectedYear)
    ) {
      updates.trendYear = String(selectedYear);
    }
    if (year2Param && !selectedYear2) updates.trendYear2 = null;
    if (metricParam !== selectedMetric) updates.trendMetric = selectedMetric;
    if (Object.keys(updates).length) updateParams(updates);
  }, [
    searchParams,
    selectedYear,
    year2Param,
    selectedYear2,
    metricParam,
    selectedMetric,
    currentPeriodReady,
    updateParams,
  ]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setCurrentPeriodReady(false);
    setEarliestTransactionDate(null);
    aggregatesService
      .getEarliestTransactionDate(userId)
      .then((date) => {
        if (active) setEarliestTransactionDate(date);
      })
      .catch(() => {
        if (active) setEarliestTransactionDate(null);
      });
    aggregatesService
      .getCurrentUserYearMonth(userId)
      .then(({ year, month }) => {
        if (!active) return;
        setCurrentYear(year);
        setCurrentMonth(month + 1);
        setCurrentPeriodReady(true);
      })
      .catch(() => {
        if (!active) return;
        setCurrentYear(new Date().getFullYear());
        setCurrentMonth(new Date().getMonth() + 1);
        setCurrentPeriodReady(true);
      });
    aggregatesService
      .listAvailableTransactionYears(userId)
      .then((years) => {
        if (active) setAvailableYears(years);
      })
      .catch(() => {
        if (active) setAvailableYears([]);
      });
    const cached = readCatCache(userId);
    if (cached) {
      setCategories(cached);
    }
    categoryService
      .listActiveByUser(userId)
      .then((fresh) => {
        if (!active) return;
        setCategories(fresh);
        writeCatCache(userId, fresh);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !currentPeriodReady) return;
    let active = true;
    setIsRefreshing(true);
    Promise.all([
      aggregatesService.getMonthlyIncomeExpenseTrend(userId, selectedYear, selectedCategoryId),
      selectedYear2
        ? aggregatesService.getMonthlyIncomeExpenseTrend(userId, selectedYear2, selectedCategoryId)
        : Promise.resolve([]),
    ])
      .then(([data, comparison]) => {
        if (!active) return;
        setMonthlyData(data);
        setComparisonData(comparison);
        setIsRefreshing(false);
      })
      .catch(() => {
        if (!active) return;
        setMonthlyData([]);
        setComparisonData([]);
        setIsRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [userId, selectedYear, selectedYear2, selectedCategoryId, currentPeriodReady]);

  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateParams({ trendYear: String(parseInt(e.target.value, 10)) });
    },
    [updateParams]
  );

  const yearOptions = [
    ...new Set([
      currentYear,
      ...(availableYears ?? []),
      selectedYear,
      ...(selectedYear2 ? [selectedYear2] : []),
    ]),
  ].sort((a, b) => b - a);
  const chartMetric = selectedCategory?.type ?? selectedMetric;
  const series = useMemo(
    () =>
      (selectedYear2 ? [selectedYear, selectedYear2] : [selectedYear]).flatMap((year, index) =>
        (chartMetric === "All" ? metrics : [chartMetric]).map((metric) => ({
          key: index === 0 ? metric : `${metric}2`,
          metric,
          year,
          color: index === 0 ? metricColors[metric] : "#0ea5e9",
          label: selectedYear2
            ? `${selectedCategoryName ?? t(metric)} (${year})`
            : (selectedCategoryName ?? t(metric)),
        }))
      ),
    [selectedYear, selectedYear2, chartMetric, selectedCategoryName, t]
  );

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
    const comparisonMap = new Map(comparisonData.map((item) => [item.month, item]));
    let cumulativeNetIncome = 0;
    let cumulative2 = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const item = dataMap.get(monthNum);
      const isFuture =
        selectedYear > currentYear || (selectedYear === currentYear && monthNum > currentMonth);
      const netIncome = (item?.income ?? 0) - (item?.expense ?? 0);
      if (!isFuture) cumulativeNetIncome += netIncome;
      const item2 = comparisonMap.get(monthNum);
      const future2 =
        selectedYear2 !== null &&
        (selectedYear2 > currentYear || (selectedYear2 === currentYear && monthNum > currentMonth));
      const net2 = (item2?.income ?? 0) - (item2?.expense ?? 0);
      if (!future2) cumulative2 += net2;
      return {
        month: monthNum,
        monthLabel: getMonthLabel(monthNum),
        income: isFuture ? null : (item?.income ?? 0),
        expense: isFuture ? null : (item?.expense ?? 0),
        netIncome: isFuture ? null : netIncome,
        cumulativeNetIncome: isFuture ? null : cumulativeNetIncome,
        income2: future2 ? null : (item2?.income ?? 0),
        expense2: future2 ? null : (item2?.expense ?? 0),
        netIncome2: future2 ? null : net2,
        cumulativeNetIncome2: future2 ? null : cumulative2,
      };
    });
  }, [
    monthlyData,
    comparisonData,
    getMonthLabel,
    selectedYear,
    selectedYear2,
    currentYear,
    currentMonth,
  ]);

  const yAxisTicks = useMemo(() => {
    const values = chartData
      .flatMap((d) => series.map((s) => (d[s.key as keyof typeof d] as number) ?? 0))
      .filter(Number.isFinite);
    const maxValue = Math.max(0, ...values);
    const minValue = Math.min(0, ...values);
    const range = maxValue - minValue || 1;
    const roughStep = (range * 1.1) / 6;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= roughStep)! * magnitude;
    const tickMax = Math.ceil((maxValue + range * 0.05) / step) * step;
    const tickMin = minValue < 0 ? Math.floor(minValue / step) * step : 0;
    return Array.from(
      { length: Math.round((tickMax - tickMin) / step) + 1 },
      (_, i) => tickMin + i * step
    );
  }, [chartData, series]);

  const CustomTooltip = useCallback(
    ({
      active,
      payload,
      label,
    }: {
      active?: boolean;
      payload?: Array<{ name: string; dataKey?: string; value: number }>;
      label?: string;
    }) => {
      if (pinnedMonth || !active || !payload?.length) {
        const month = chartData[pinnedMonth?.index ?? currentMonth - 1];
        active = true;
        label = month.monthLabel;
        payload = series.flatMap((s) => {
          const value = month[s.key as keyof typeof month];
          return typeof value === "number" ? [{ name: s.label, dataKey: s.key, value }] : [];
        });
      }
      if (active && payload && payload.length && tooltipContainer.current) {
        return createPortal(
          <div
            className={`grid grid-cols-2 items-center gap-x-4 gap-y-2 p-3 ${
              selectedYear2
                ? "sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]"
                : chartMetric !== "All"
                  ? "sm:grid-cols-[9rem_minmax(0,1fr)]"
                  : "sm:flex sm:flex-wrap"
            }`}
          >
            <p
              className={`col-span-2 font-medium text-gray-900 dark:text-gray-200 ${selectedYear2 || chartMetric !== "All" ? "sm:col-span-1" : ""}`}
            >
              {label} {!selectedYear2 && selectedYear}
            </p>
            {[...payload]
              .sort(
                (a, b) =>
                  series.findIndex((s) => s.key === (a.dataKey ?? a.name)) -
                  series.findIndex((s) => s.key === (b.dataKey ?? b.name))
              )
              .map((entry, index) => (
                <p
                  key={index}
                  className="min-w-0 break-words text-sm"
                  style={{
                    color: series.find((s) => s.key === (entry.dataKey ?? entry.name))?.color,
                  }}
                >
                  {series.find((s) => s.key === (entry.dataKey ?? entry.name))?.label ??
                    t(entry.name)}
                  : {formatCurrency(entry.value)}
                </p>
              ))}
          </div>,
          tooltipContainer.current
        );
      }
      return null;
    },
    [
      selectedYear,
      selectedYear2,
      chartMetric,
      series,
      formatCurrency,
      t,
      pinnedMonth,
      chartData,
      currentMonth,
    ]
  );

  const isEmpty = useMemo(() => {
    if (!monthlyData) return false;
    return chartData.every((d) => series.every((s) => (d[s.key as keyof typeof d] ?? 0) === 0));
  }, [chartData, monthlyData, series]);

  const isLoading =
    !currentPeriodReady ||
    monthlyData === undefined ||
    categories === undefined ||
    availableYears === null;

  return (
    <div className={`flex w-full flex-col ${className}`}>
      <div className="mb-4 grid grid-cols-2 items-center gap-3 sm:grid-cols-4 [&>select]:min-w-0 [&>select]:appearance-none">
        <select
          value={selectedYear}
          onChange={handleYearChange}
          required
          className="min-h-[38px] appearance-none rounded-lg border border-gray-400 dark:border-gray-500 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:border-black dark:hover:border-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-200"
          aria-label={t("year1")}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={selectedYear2 ?? ""}
          onChange={(e) => updateParams({ trendYear2: e.target.value || null })}
          aria-label={t("year2")}
          className="min-h-[38px] rounded-lg border border-gray-400 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="" />
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={selectedMetric}
          onChange={(e) => updateParams({ trendMetric: e.target.value })}
          disabled={!!selectedCategoryId}
          aria-label={t("metric")}
          className="min-h-[38px] rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="All" disabled={selectedYear2 !== null}>
            {t("allMetrics")}
          </option>
          {(["expense", "income", "cumulativeNetIncome", "netIncome"] as Metric[]).map((metric) => (
            <option key={metric} value={metric}>
              {t(metric)}
            </option>
          ))}
        </select>
        <select
          id="trend-category-filter"
          value={selectedCategoryId || ""}
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

      <div
        data-testid="trend-summary"
        className={`order-last mt-1 ${isRefreshing ? "opacity-50" : ""}`}
      >
        <div className="px-3 pt-2 text-sm">
          {!isLoading && chartMetric !== "All" && (
            <div
              data-testid="trend-average"
              className={
                selectedYear2
                  ? "grid grid-cols-2 gap-x-4 gap-y-2 sm:ml-40"
                  : "flex flex-wrap gap-x-4 gap-y-2 sm:ml-40"
              }
            >
              {series.map((s) => {
                const earliest =
                  earliestTransactionDate === null ? null : new Date(earliestTransactionDate);
                const startMonth = earliest
                  ? s.year < earliest.getFullYear()
                    ? 13
                    : s.year === earliest.getFullYear()
                      ? earliest.getMonth() + 1
                      : 1
                  : 13;
                const endMonth =
                  s.year > currentYear ? 0 : s.year === currentYear ? currentMonth : 12;
                const monthCount = Math.max(0, endMonth - startMonth + 1);
                const values = chartData
                  .filter((month) => month.month >= startMonth && month.month <= endMonth)
                  .map((month) => month[s.key as keyof typeof month])
                  .filter((value): value is number => typeof value === "number");
                const average = monthCount
                  ? values.reduce((sum, value) => sum + value, 0) / monthCount
                  : 0;
                return (
                  <p key={s.key} style={{ color: s.color }}>
                    {t("average")}
                    {selectedYear2 ? ` (${s.year})` : ""}: {formatCurrency(average)}
                  </p>
                );
              })}
            </div>
          )}
        </div>
        <div ref={tooltipContainer} data-testid="trend-details" className="text-sm" />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-80 sm:h-[420px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Chart and empty state use the same reserved height as loading. */}
      {!isLoading && (
        <div className="relative" aria-busy={isRefreshing} data-testid="trend-content">
          {isRefreshing && (
            <div
              data-testid="trend-refresh"
              className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/50 dark:bg-gray-800/50"
            >
              <LoadingSpinner size="lg" />
            </div>
          )}
          {isEmpty ? (
            <div className="flex h-80 sm:h-[420px] flex-col items-center justify-center">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
                {t("noData", {
                  period: selectedYear2 ? `${selectedYear} / ${selectedYear2}` : selectedYear,
                })}
              </p>
            </div>
          ) : (
            <div>
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
                    margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                    onTouchMove={(state) => {
                      if (state.activeTooltipIndex == null) return;
                      const index = Number(state.activeTooltipIndex);
                      if (!Number.isInteger(index) || !chartData[index]) return;
                      setPinnedMonth({ index });
                    }}
                    onMouseMove={(state) => {
                      if (state.activeTooltipIndex == null) return;
                      const index = Number(state.activeTooltipIndex);
                      if (!Number.isInteger(index) || !chartData[index]) return;
                      setPinnedMonth((previous) =>
                        previous && previous.index !== index ? null : previous
                      );
                    }}
                    onClick={(state) => {
                      if (state.activeTooltipIndex == null) return;
                      const index = Number(state.activeTooltipIndex);
                      if (!Number.isInteger(index) || !chartData[index]) return;
                      setPinnedMonth((previous) =>
                        previous && previous.index === index ? null : { index }
                      );
                    }}
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
                      orientation="left"
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
                      width="auto"
                    />
                    <ReferenceLine
                      y={0}
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      strokeWidth={1.5}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: isDarkMode ? "#9ca3af" : "#6b7280" }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "10px" }}
                      formatter={(value: string, entry) => (
                        <span style={{ color: entry.color }}>{value}</span>
                      )}
                    />
                    {series.map((s, index) => (
                      <Line
                        key={s.key}
                        type="linear"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        zIndex={selectedYear2 && index === 0 ? 401 : 400}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: s.color }}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
