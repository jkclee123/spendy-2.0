import { useTranslation } from "react-i18next";
import { SwipeableCard } from "@/components/ui/SwipeableCard";
import type { TransactionWithCategory } from "@/types";

interface TransactionCardProps {
  transaction: TransactionWithCategory;
  onClick?: (transaction: TransactionWithCategory) => void;
  onDelete?: (transaction: TransactionWithCategory) => void;
}

export function TransactionCard({ transaction, onClick, onDelete }: TransactionCardProps) {
  const { t, i18n } = useTranslation("transactions");
  const { t: tCommon } = useTranslation("common");

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(transaction.amount);

  const date = new Date(transaction.created_at);
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const getCategoryName = (): string => {
    if (transaction.name) return transaction.name;
    if (transaction.type === "income") return t("income");
    if (!transaction.categoryData) return t("uncategorized");

    if (i18n.language === "zh-HK") {
      return (
        transaction.categoryData.zh_name || transaction.categoryData.en_name || t("uncategorized")
      );
    }
    return (
      transaction.categoryData.en_name || transaction.categoryData.zh_name || t("uncategorized")
    );
  };

  return (
    <SwipeableCard
      onSwipeAction={() => onDelete?.(transaction)}
      actionLabel={tCommon("delete")}
      actionColor="red"
      onClick={onClick ? () => onClick(transaction) : undefined}
      disabled={!onDelete}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center">
          <span className="text-2xl">{transaction.categoryData?.emoji || "💰"}</span>
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-gray-200">{getCategoryName()}</span>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <time dateTime={new Date(transaction.created_at).toISOString()}>{formattedTime}</time>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-lg font-semibold text-gray-900 dark:text-gray-200">
          {transaction.type === "expense" ? "-" : "+"}
          {formattedAmount}
        </span>
      </div>
    </SwipeableCard>
  );
}
