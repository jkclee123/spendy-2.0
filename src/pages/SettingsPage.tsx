import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/hooks/useLanguage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LanguageSelect } from "@/components/settings/LanguageSelect";
import { ApiTokenDisplay } from "@/components/settings/ApiTokenDisplay";
import { IosShortcutDownload } from "@/components/settings/IosShortcutDownload";

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const { user, signOut } = useAuth();
  const { userPreference, setUserPreference, isLoading } = useLanguage();

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelect
            value={userPreference}
            onChange={setUserPreference}
            label={t("languageLabel")}
          />
        </CardContent>
      </Card>

      {/* API Token */}
      <ApiTokenDisplay userId={user.id} />

      {/* iOS Shortcut */}
      <IosShortcutDownload />

      {/* Sign Out */}
      <Button
        variant="outline"
        onClick={signOut}
        className="w-full dark:hover:text-red-500 text-red-600 dark:text-red-400 hover:text-red-500"
      >
        {t("signOut")}
      </Button>
    </div>
  );
}
