import { useTranslation } from "react-i18next";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-4",
};

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`animate-spin rounded-full border-gray-300 dark:border-gray-600 border-t-accent-500 dark:border-t-accent-400 ${sizeStyles[size]} ${className}`}
      role="status"
      aria-label={t("loading")}
    >
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message }: LoadingPageProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message ?? t("loading")}</p>
    </div>
  );
}
