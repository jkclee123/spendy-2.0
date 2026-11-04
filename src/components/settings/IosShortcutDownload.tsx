import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function IosShortcutDownload() {
  const { t } = useTranslation("settings");
  const shortcuts = [
    { id: "api", name: "Spendy API" },
    { id: "wallet", name: "Spendy Wallet" },
    { id: "messages", name: "Spendy Messages" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("iosShortcut.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("iosShortcut.description")}</p>

        <div className="space-y-4">
          {shortcuts.map(({ id, name }) => (
            <div key={id} className="space-y-2">
              <a
                href={`/shortcuts/spendy-${id}.shortcut`}
                download={`${name}.shortcut`}
                className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 px-3 py-2 text-sm min-h-[44px] w-full border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-black hover:text-black dark:hover:border-gray-400 dark:hover:text-white"
              >
                {id === "api" ? (
                  <Download className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <img
                    src={`/icons/${id}.png`}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 rounded-md object-contain"
                  />
                )}
                {t(`iosShortcut.${id}.downloadButton`)}
              </a>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(`iosShortcut.${id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
