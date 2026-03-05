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

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {user.user_metadata.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || "User"}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-2xl font-semibold text-white">
                {(user.user_metadata.full_name || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
                {user.user_metadata.full_name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelect
            value={userPreference}
            onChange={setUserPreference}
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
