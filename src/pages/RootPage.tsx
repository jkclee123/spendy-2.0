import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RootPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      navigate(user ? "/transactions" : "/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

  return null;
}
