import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface ApiTokenDisplayProps {
  userId: string;
}

function generateApiToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Component for displaying and managing API token
 * - Copy token to clipboard
 * - Regenerate token with confirmation
 */
export function ApiTokenDisplay({ userId }: ApiTokenDisplayProps) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { showToast } = useToast();

  const [apiToken, setApiToken] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("users")
      .select("api_token")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setApiToken(data?.api_token ?? null);
      });
  }, [userId]);

  const handleCopyToken = async () => {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const newToken = generateApiToken();
      const { error } = await supabase
        .from("users")
        .update({ api_token: newToken })
        .eq("id", userId);
      if (error) throw error;
      setApiToken(newToken);
      setShowRegenerateModal(false);
      showToast(t("apiToken.regenerateSuccess"), "success");
    } catch {
      showToast(t("apiToken.regenerateError"), "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  const VISIBLE_CHARS = 5;
  const getDisplayToken = () => {
    if (!apiToken) return "Generating...";
    return apiToken.slice(0, VISIBLE_CHARS) + "*".repeat(apiToken.length - VISIBLE_CHARS);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("apiToken.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("apiToken.description")}</p>

          {/* Token Display */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm font-mono truncate whitespace-nowrap text-gray-900 dark:text-gray-200">
                {getDisplayToken()}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToken}
                disabled={!apiToken}
                aria-label={t("apiToken.copyToken")}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Regenerate Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateModal(true)}
              disabled={!apiToken}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("apiToken.regenerateToken")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Modal */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title={t("apiToken.regenerateConfirmTitle")}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {t("apiToken.regenerateConfirmMessage")}
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowRegenerateModal(false)}
              disabled={isRegenerating}
            >
              {tCommon("cancel")}
            </Button>
            <Button variant="danger" onClick={handleRegenerate} isLoading={isRegenerating}>
              {t("apiToken.regenerateToken")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
