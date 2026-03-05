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
      <main className="flex-1 lg:pl-20 bg-gray-100 dark:bg-gray-950">
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
          {/* Spacer to clear fixed bottom navbar on mobile */}
          <div
            className="lg:hidden"
            style={{ height: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
            aria-hidden="true"
          />
          {/* Smaller bottom spacer on large screens */}
          <div
            className="hidden lg:block h-8"
            aria-hidden="true"
          />
        </div>
      </main>
      <NavigationBar isLanguageReady={isLanguageReady} />
    </div>
  );
}
