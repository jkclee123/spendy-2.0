import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Component for downloading the iOS Shortcut file
 * - Displays information about the iOS shortcut
 * - Provides a download button that fetches and opens the file URL
 * - Automatically selects the correct language version based on user locale
 */
export function IosShortcutDownload() {
  const { t, i18n } = useTranslation("settings");
  const { showToast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; fileName: string } | null>(null);

  const lang = i18n.language;

  useEffect(() => {
    // Query files table for the language-specific shortcut
    const shortcutName = lang === "zh-HK" ? "ios_shortcut_zh" : "ios_shortcut_en";
    supabase
      .from("files")
      .select("name, storage_path")
      .eq("name", shortcutName)
      .single()
      .then(({ data }) => {
        if (data?.storage_path) {
          const { data: storageData } = supabase.storage
            .from("files")
            .getPublicUrl(data.storage_path);
          const fileName = lang === "zh-HK" ? "Spendy-zh.shortcut" : "Spendy-en.shortcut";
          setDownloadInfo({ url: storageData.publicUrl, fileName });
        }
      });
  }, [lang]);

  const handleDownload = async () => {
    if (!downloadInfo?.url) {
      showToast(t("iosShortcut.downloadError"), "error");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(downloadInfo.url);
      if (!response.ok) throw new Error("Failed to fetch file");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = downloadInfo.fileName;
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
          disabled={!downloadInfo?.url || isDownloading}
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
