import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/Card";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTransactionsUrl } from "@/lib/transactionNavigation";

export function TransactionCreatePage() {
  const { t } = useTranslation("transactions");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const transactionsUrl = getTransactionsUrl(search);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t("newTransaction")} />
      <Card>
        <CardContent>
          <TransactionForm
            userId={user.id}
            onSuccess={() => navigate(transactionsUrl)}
            onCancel={() => navigate(transactionsUrl)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
