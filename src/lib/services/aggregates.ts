import { supabase } from "@/lib/supabase";
import type { CategoryAggregation, MonthlyIncomeExpenseData } from "@/types";

export async function getMonthlyIncomeExpenseTrend(
  userId: string,
  year: number,
  categoryId?: string | null
): Promise<MonthlyIncomeExpenseData[]> {
  const { data, error } = await supabase.rpc("get_monthly_income_expense_trend", {
    p_user_id: userId,
    p_year: year,
    p_category_id: categoryId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as MonthlyIncomeExpenseData[];
}

export async function getExpensesByCategory(
  userId: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): Promise<CategoryAggregation[]> {
  const { data, error } = await supabase.rpc("get_expenses_by_category", {
    p_user_id: userId,
    p_start_year: startYear,
    p_start_month: startMonth,
    p_end_year: endYear,
    p_end_month: endMonth,
  });

  if (error) throw error;
  return (data ?? []) as CategoryAggregation[];
}

export async function getEarliestTransactionDate(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // No rows
    throw error;
  }
  return data?.created_at ?? null;
}

export async function getCurrentUserYearMonth(
  userId: string
): Promise<{ year: number; month: number }> {
  const { data, error } = await supabase.rpc("get_current_user_yearmonth", {
    p_user_id: userId,
  });
  if (error || !data?.[0]) return { year: new Date().getFullYear(), month: new Date().getMonth() };
  return { year: data[0].year, month: data[0].month - 1 }; // month back to 0-indexed for JS
}

export async function getEarliestAggregateYearMonth(
  userId: string
): Promise<{ year: number; month: number } | null> {
  const { data, error } = await supabase.rpc("get_earliest_aggregate_yearmonth", {
    p_user_id: userId,
  });
  if (error || !data?.[0]) return null;
  return { year: data[0].year, month: data[0].month - 1 }; // month back to 0-indexed for JS
}

export async function listAvailableTransactionYears(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("aggregates")
    .select("year")
    .eq("user_id", userId)
    .order("year", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  // Deduplicate years
  const years = [...new Set(data.map((row: { year: number }) => row.year))];
  return years;
}
