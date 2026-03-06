import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import { LanguageProvider } from "@/lib/LanguageProvider";
import { AuthenticatedClientWrapper } from "@/components/layout/AuthenticatedClientWrapper";
import { RootPage } from "@/pages/RootPage";
import { LoginPage } from "@/pages/LoginPage";

const TransactionsPage = lazy(() =>
  import("@/pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage }))
);
const TransactionCreatePage = lazy(() =>
  import("@/pages/TransactionCreatePage").then((m) => ({ default: m.TransactionCreatePage }))
);
const TransactionUpdatePage = lazy(() =>
  import("@/pages/TransactionUpdatePage").then((m) => ({ default: m.TransactionUpdatePage }))
);
const ChartsPage = lazy(() =>
  import("@/pages/ChartsPage").then((m) => ({ default: m.ChartsPage }))
);
const CategoriesPage = lazy(() =>
  import("@/pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <AuthenticatedClientWrapper>
        <Outlet />
      </AuthenticatedClientWrapper>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<RootPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AuthenticatedLayout />}>
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/transactions/create" element={<TransactionCreatePage />} />
                <Route path="/transactions/update/:id" element={<TransactionUpdatePage />} />
                <Route path="/charts" element={<ChartsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
