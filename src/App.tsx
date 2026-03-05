import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import { LanguageProvider } from "@/lib/LanguageProvider";
import { AuthenticatedClientWrapper } from "@/components/layout/AuthenticatedClientWrapper";
import { RootPage } from "@/pages/RootPage";
import { LoginPage } from "@/pages/LoginPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { TransactionCreatePage } from "@/pages/TransactionCreatePage";
import { TransactionUpdatePage } from "@/pages/TransactionUpdatePage";
import { ChartsPage } from "@/pages/ChartsPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { SettingsPage } from "@/pages/SettingsPage";

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
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
