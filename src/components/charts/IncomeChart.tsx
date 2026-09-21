import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as aggregatesService from "@/lib/services/aggregates";
import { RatioChart } from "@/components/charts/RatioChart";
import type { DateFilter, PeriodRange, RatioItem } from "@/components/charts/RatioChart";

interface IncomeRatioProps {
  userId: string;
  className?: string;
}

/**
 * Income ratio: total income for the selected period broken down by
 * transaction name (income is never categorised), largest first.
 */
export function IncomeRatio({ userId, className = "" }: IncomeRatioProps) {
  const { t } = useTranslation("charts");

  const fetchItems = useCallback(
    async (id: string, range: PeriodRange): Promise<RatioItem[]> => {
      const data = await aggregatesService.getIncomeByName(
        id,
        range.startYear,
        range.startMonth,
        range.endYear,
        range.endMonth
      );
      return data.map((item) => ({
        key: item.name ?? "unnamed",
        label: item.name ?? t("unnamed"),
        total: item.total,
        filterValue: item.name,
      }));
    },
    [t]
  );

  const itemHref = useCallback((item: RatioItem, dateFilter: DateFilter | null) => {
    if (!item.filterValue) return null;
    const params = new URLSearchParams();
    params.set("type", "income");
    params.set("name", item.filterValue);
    if (dateFilter) {
      params.set("fromDate", dateFilter.fromDate);
      params.set("toDate", dateFilter.toDate);
    }
    return `/transactions?${params.toString()}`;
  }, []);

  const totalHref = useCallback((dateFilter: DateFilter | null) => {
    const params = new URLSearchParams();
    params.set("type", "income");
    if (dateFilter) {
      params.set("fromDate", dateFilter.fromDate);
      params.set("toDate", dateFilter.toDate);
    }
    return `/transactions?${params.toString()}`;
  }, []);

  return (
    <RatioChart
      userId={userId}
      paramPrefix="inc"
      totalLabel={t("totalIncome")}
      fetchItems={fetchItems}
      itemHref={itemHref}
      totalHref={totalHref}
      reverseColors
      className={className}
    />
  );
}
