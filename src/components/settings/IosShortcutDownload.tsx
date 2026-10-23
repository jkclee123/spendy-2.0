import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function IosShortcutDownload() {
  const { t } = useTranslation("settings");
  const shortcuts = ["api", "messages", "octopus"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("iosShortcut.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("iosShortcut.description")}</p>

        <div className="space-y-4">
          {shortcuts.map((shortcut) => (
            <div key={shortcut} className="space-y-2">
              <a
                href={`/shortcuts/spendy-${shortcut}.shortcut`}
                download={`spendy-${shortcut}.shortcut`}
                className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 px-3 py-2 text-sm min-h-[44px] w-full border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-black hover:text-black dark:hover:border-gray-400 dark:hover:text-white"
              >
                {shortcut === "api" ? (
                  <Download className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <img
                    src={`/icons/${shortcut}.png`}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                )}
                {t(`iosShortcut.${shortcut}.downloadButton`)}
              </a>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(`iosShortcut.${shortcut}.description`)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
