import { NavigationBar } from "@/components/navigation/NavigationBar";
import { Header } from "@/components/ui/Header";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useLanguageReady } from "@/lib/LanguageProvider";

interface AuthenticatedClientWrapperProps {
  children: React.ReactNode;
}

export function AuthenticatedClientWrapper({ children }: AuthenticatedClientWrapperProps) {
  const { isLanguageReady } = useLanguageReady();

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950">
      <Header />
      <main className="flex-1 pb-nav-safe lg:pb-0 lg:pl-20 bg-gray-100 dark:bg-gray-950">
        <div className="mt-5 mx-auto max-w-4xl px-4">
          <ErrorBoundary>
            {isLanguageReady ? (
              children
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-accent-500 dark:border-gray-600 dark:border-t-accent-400" />
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
      <NavigationBar isLanguageReady={isLanguageReady} />
    </div>
  );
}
