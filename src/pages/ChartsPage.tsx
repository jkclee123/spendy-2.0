import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { RatioChart } from "@/components/charts/RatioChart";
import { IncomeExpenseTrendChart } from "@/components/charts/TrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function ChartsPage() {
  const { t } = useTranslation("charts");
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("expensesByCategory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RatioChart userId={user.id} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("incomeExpenseTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeExpenseTrendChart userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
