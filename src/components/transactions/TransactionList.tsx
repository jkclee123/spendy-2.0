import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TransactionWithCategory } from "@/types";
import { TransactionCard } from "./TransactionCard";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import * as transactionService from "@/lib/services/transactions";
import { supabase } from "@/lib/supabase";

interface TransactionListProps {
  userId: string;
  onTransactionClick?: (transaction: TransactionWithCategory) => void;
  type?: "expense" | "income";
  nameSearch?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: number;
  endDate?: number;
}

const PAGE_SIZE = 20;

interface Filters {
  type?: "expense" | "income";
  nameSearch?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: number;
  endDate?: number;
}

function matchesFilters(t: TransactionWithCategory, filters: Filters): boolean {
  if (filters.type && t.type !== filters.type) return false;
  if (filters.nameSearch && !t.name?.toLowerCase().includes(filters.nameSearch.toLowerCase()))
    return false;
  if (filters.category && t.category_id !== filters.category) return false;
  if (filters.minAmount !== undefined && t.amount < filters.minAmount) return false;
  if (filters.maxAmount !== undefined && t.amount > filters.maxAmount) return false;
  if (filters.startDate !== undefined && t.created_at < filters.startDate) return false;
  if (filters.endDate !== undefined && t.created_at > filters.endDate) return false;
  return true;
}

function formatDateHeader(timestamp: number, t: (key: string) => string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const dayOfWeek = t(`daysOfWeek.${date.getDay()}`);

  return `${year}/${month}/${day} ${dayOfWeek}`;
}

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDailyTotal(transactions: TransactionWithCategory[]): number {
  return transactions.reduce((total, t) => {
    return t.type === "expense" ? total - t.amount : total + t.amount;
  }, 0);
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function groupTransactionsByDate(
  transactions: TransactionWithCategory[]
): Map<string, TransactionWithCategory[]> {
  const grouped = new Map<string, TransactionWithCategory[]>();
  transactions.forEach((transaction) => {
    const dateKey = getDateKey(transaction.created_at);
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(transaction);
  });
  return grouped;
}

export function TransactionList({
  userId,
  onTransactionClick,
  type,
  nameSearch,
  category,
  minAmount,
  maxAmount,
  startDate,
  endDate,
}: TransactionListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { t } = useTranslation("transactions");
  const { t: tcommon } = useTranslation("common");

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<TransactionWithCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);

  // Reconnect on tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setReconnectKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (currentOffset: number, append: boolean) => {
      try {
        const result = await transactionService.listTransactionsPaginated({
          userId,
          type,
          nameSearch,
          categoryId: category,
          startDate,
          endDate,
          minAmount,
          maxAmount,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });

        if (append) {
          setTransactions((prev) => [...prev, ...result.data]);
        } else {
          setTransactions(result.data);
        }
        setHasMore(result.hasMore);
        setOffset(result.nextOffset);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch transactions:", error);
      }
    },
    [userId, type, nameSearch, category, startDate, endDate, minAmount, maxAmount]
  );

  // Initial load and refetch when filters change
  useEffect(() => {
    setIsLoading(true);
    setOffset(0);
    fetchTransactions(0, false).finally(() => setIsLoading(false));
  }, [fetchTransactions, reconnectKey]);

  // Realtime subscription
  useEffect(() => {
    const filters: Filters = {
      type,
      nameSearch,
      category,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    };

    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newTx = await transactionService.getTransactionById(payload.new.id as string);
            if (newTx && matchesFilters(newTx, filters)) {
              setTransactions((prev) => {
                if (prev.some((t) => t.id === newTx.id)) return prev;
                return [newTx, ...prev];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedTx = await transactionService.getTransactionById(payload.new.id as string);
            setTransactions((prev) => {
              const exists = prev.some((t) => t.id === payload.new.id);
              if (!updatedTx || !matchesFilters(updatedTx, filters)) {
                return prev.filter((t) => t.id !== payload.new.id);
              }
              if (exists) {
                return prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
              }
              return prev;
            });
          } else if (payload.eventType === "DELETE") {
            setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, type, nameSearch, category, minAmount, maxAmount, startDate, endDate, reconnectKey]);

  // Load more
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchTransactions(offset, true);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, offset, fetchTransactions]);

  const handleDeleteRequest = useCallback((transaction: TransactionWithCategory) => {
    setDeleteTarget(transaction);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await transactionService.deleteTransaction({ id: deleteTarget.id, userId });
      setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast(t("successMessages.deleted"), "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("list.deleteFailed");
      showToast(errorMessage, "error");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, showToast, t, userId]);

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // Intersection observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoadingMore) {
        loadMore();
      }
    },
    [hasMore, isLoadingMore, loadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    });
    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [handleObserver]);

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(transactions);
  }, [transactions]);

  const sortedDateKeys = useMemo(() => {
    return Array.from(groupedTransactions.keys()).sort((a, b) => b.localeCompare(a));
  }, [groupedTransactions]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return <EmptyState t={t} />;
  }

  return (
    <>
      <div className="space-y-6">
        {sortedDateKeys.map((dateKey) => {
          const dayTransactions = groupedTransactions.get(dateKey)!;
          const dailyTotal = calculateDailyTotal(dayTransactions);
          const isNegative = dailyTotal < 0;
          const headerTimestamp = dayTransactions[0]?.created_at ?? Date.now();

          return (
            <Card key={dateKey} padding="sm" className="overflow-hidden">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-300 pb-2 dark:border-gray-500">
                  <span className="font-medium text-gray-900 dark:text-gray-200 ml-2">
                    {formatDateHeader(headerTimestamp, tcommon)}
                  </span>
                  <span
                    className={`font-semibold mr-4 ${
                      isNegative
                        ? "text-red-500 dark:text-red-400"
                        : "text-green-500 dark:text-green-400"
                    }`}
                  >
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      signDisplay: "always",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(dailyTotal)}
                  </span>
                </div>

                <div className="space-y-3">
                  {[...dayTransactions]
                    .sort((a, b) => b.created_at - a.created_at)
                    .map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        onClick={onTransactionClick}
                        onDelete={handleDeleteRequest}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <div ref={loadMoreRef} className="py-4">
          {isLoadingMore && (
            <div className="flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={handleCloseDeleteModal}
        title={t("deleteConfirmTitle")}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {t("deleteConfirmMessage", { amount: formatAmount(deleteTarget?.amount ?? 0) })}
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleCloseDeleteModal} disabled={isDeleting}>
              {tcommon("cancel")}
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} isLoading={isDeleting}>
              {tcommon("delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">
        {t("list.noTransactionsTitle")}
      </h3>
    </div>
  );
}
