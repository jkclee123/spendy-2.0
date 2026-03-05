import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function IosShortcutDownload() {
  const { t, i18n } = useTranslation("settings");
  const { showToast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const lang = i18n.language;

  useEffect(() => {
    const shortcutName = lang === "zh-HK" ? "ios_shortcut_zh" : "ios_shortcut_en";
    supabase
      .from("files")
      .select("url")
      .eq("name", shortcutName)
      .single()
      .then(({ data }) => {
        if (data?.url) setUrl(data.url);
      });
  }, [lang]);

  const handleDownload = async () => {
    if (!url) {
      showToast(t("iosShortcut.downloadError"), "error");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();

      const fileName =
        lang === "zh-HK" ? "spendy-shortcut-zh.shortcut" : "spendy-shortcut-en.shortcut";

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showToast(t("iosShortcut.downloadSuccess"), "success");
    } catch {
      showToast(t("iosShortcut.downloadError"), "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("iosShortcut.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("iosShortcut.description")}</p>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!url || isDownloading}
          isLoading={isDownloading}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {t("iosShortcut.downloadButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
