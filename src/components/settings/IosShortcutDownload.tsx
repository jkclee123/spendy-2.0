import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function IosShortcutDownload() {
  const { t, i18n } = useTranslation("settings");

  const isZhHK = i18n.language === "zh-HK";
  const href = isZhHK
    ? "/shortcuts/spendy-shortcut-zh.shortcut"
    : "/shortcuts/spendy-shortcut-en.shortcut";
  const downloadName = isZhHK ? "spendy-shortcut-zh3.shortcut" : "spendy-shortcut-en3.shortcut";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("iosShortcut.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("iosShortcut.description")}</p>

        <a
          href={href}
          download={downloadName}
          className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none px-3 py-1.5 text-sm min-h-[36px] w-full border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-black hover:text-black dark:hover:border-gray-400 dark:hover:text-white"
        >
          <Download className="h-4 w-4" />
          {t("iosShortcut.downloadButton")}
        </a>
      </CardContent>
    </Card>
  );
}
