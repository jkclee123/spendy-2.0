import { useCallback, useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";
import {
  TransactionFilters,
  type TransactionFiltersState,
} from "@/components/transactions/TransactionFilters";
import type { Transaction, UserCategory } from "@/types";
import * as categoryService from "@/lib/services/categories";
import { readCatCache, writeCatCache } from "@/lib/catCache";

function dateToTimestamp(dateStr: string, isEndDate: boolean): number | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return undefined;
  const [year, month, day] = parts.map(Number);
  if (isEndDate) return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

export function TransactionsPage() {
  const { t } = useTranslation("transactions");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<UserCategory[]>([]);

  const [filters, setFilters] = useState<TransactionFiltersState>({
    type: "all",
    name: "",
    category: undefined,
    minAmount: "",
    maxAmount: "",
    fromDate: "",
    toDate: "",
  });

  const [appliedFilters, setAppliedFilters] = useState<{
    type?: "expense" | "income";
    nameSearch?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    startDate?: number;
    endDate?: number;
  }>({});

  // Fetch categories with localStorage cache
  useEffect(() => {
    if (!user) return;
    const cached = readCatCache(user.id);
    if (cached) {
      setCategories(cached);
    }
    categoryService
      .listActiveByUser(user.id)
      .then((fresh) => {
        setCategories(fresh);
        writeCatCache(user.id, fresh);
      })
      .catch(() => {});
  }, [user]);

  // Parse URL params into filters
  useEffect(() => {
    const typeParam = searchParams.get("type");
    const nameParam = searchParams.get("name");
    const categoryParam = searchParams.get("category");
    const minAmountParam = searchParams.get("minAmount");
    const maxAmountParam = searchParams.get("maxAmount");
    const fromDateParam = searchParams.get("fromDate");
    const toDateParam = searchParams.get("toDate");

    const typeValue: "all" | "expense" | "income" =
      typeParam === "expense" || typeParam === "income" ? typeParam : "all";

    setFilters({
      type: typeValue,
      name: nameParam || "",
      category: categoryParam || undefined,
      minAmount: minAmountParam || "",
      maxAmount: maxAmountParam || "",
      fromDate: fromDateParam || "",
      toDate: toDateParam || "",
    });
    setAppliedFilters({
      type: typeValue !== "all" ? typeValue : undefined,
      nameSearch: nameParam || undefined,
      category: categoryParam || undefined,
      minAmount: minAmountParam ? parseFloat(minAmountParam) : undefined,
      maxAmount: maxAmountParam ? parseFloat(maxAmountParam) : undefined,
      startDate: fromDateParam ? dateToTimestamp(fromDateParam, false) : undefined,
      endDate: toDateParam ? dateToTimestamp(toDateParam, true) : undefined,
    });
  }, [searchParams]);

  const handleTransactionClick = useCallback(
    (transaction: Transaction) => {
      navigate(`/transactions/update/${transaction.id}`);
    },
    [navigate]
  );

  const applyFilters = useCallback(
    (filterState: TransactionFiltersState) => {
      const params = new URLSearchParams();
      if (filterState.type !== "all") params.set("type", filterState.type);
      if (filterState.name.trim()) params.set("name", filterState.name.trim());
      if (filterState.category) params.set("category", filterState.category);
      const minNum = filterState.minAmount ? parseFloat(filterState.minAmount) : undefined;
      const maxNum = filterState.maxAmount ? parseFloat(filterState.maxAmount) : undefined;
      if (minNum !== undefined && !isNaN(minNum)) params.set("minAmount", String(minNum));
      if (maxNum !== undefined && !isNaN(maxNum)) params.set("maxAmount", String(maxNum));
      if (filterState.fromDate) params.set("fromDate", filterState.fromDate);
      if (filterState.toDate) params.set("toDate", filterState.toDate);

      const newUrl = params.toString() ? `/transactions?${params.toString()}` : "/transactions";
      navigate(newUrl);

      setAppliedFilters({
        type: filterState.type !== "all" ? filterState.type : undefined,
        nameSearch: filterState.name.trim() || undefined,
        category: filterState.category,
        minAmount: minNum && !isNaN(minNum) ? minNum : undefined,
        maxAmount: maxNum && !isNaN(maxNum) ? maxNum : undefined,
        startDate: filterState.fromDate ? dateToTimestamp(filterState.fromDate, false) : undefined,
        endDate: filterState.toDate ? dateToTimestamp(filterState.toDate, true) : undefined,
      });
    },
    [navigate]
  );

  const handleApplyFilters = useCallback(() => {
    applyFilters(filters);
  }, [filters, applyFilters]);
  const handleAutoApplyFilters = useCallback(
    (newFilters: TransactionFiltersState) => {
      applyFilters(newFilters);
    },
    [applyFilters]
  );
  const handleClearFilters = useCallback(() => {
    navigate("/transactions");
    setAppliedFilters({});
  }, [navigate]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(appliedFilters).some((v) => v !== undefined);
  }, [appliedFilters]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      <div>
        <TransactionFilters
          categories={categories}
          filters={filters}
          onFiltersChange={setFilters}
          onApply={handleApplyFilters}
          onAutoApply={handleAutoApplyFilters}
          onClear={handleClearFilters}
          defaultExpanded={hasActiveFilters}
        />
      </div>
      <TransactionList
        userId={user.id}
        onTransactionClick={handleTransactionClick}
        type={appliedFilters.type}
        nameSearch={appliedFilters.nameSearch}
        category={appliedFilters.category}
        minAmount={appliedFilters.minAmount}
        maxAmount={appliedFilters.maxAmount}
        startDate={appliedFilters.startDate}
        endDate={appliedFilters.endDate}
      />
    </div>
  );
}
