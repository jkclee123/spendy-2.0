import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/Card";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import * as transactionService from "@/lib/services/transactions";
import type { Transaction } from "@/types";

export function TransactionUpdatePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("transactions");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    transactionService
      .getTransactionById(id)
      .then(setTransaction)
      .catch(() => setTransaction(null));
  }, [id]);

  if (!user) return null;

  if (transaction === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (transaction === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">
          Transaction not found
        </h3>
        <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          The transaction you are looking for does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("update")} />
      <Card>
        <CardContent>
          <TransactionForm
            userId={user.id}
            initialData={transaction}
            onSuccess={() => navigate("/transactions")}
            onCancel={() => navigate("/transactions")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
