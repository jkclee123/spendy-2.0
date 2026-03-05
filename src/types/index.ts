/**
 * User entity representing an authenticated user
 */
export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  lang: "system" | "en" | "zh-HK";
  api_token?: string | null;
  earliest_transaction_date?: number | null;
  timezone_offset_minutes?: number | null;
  created_at: number;
}

/**
 * User-defined spending category with emoji and bilingual names
 */
export interface UserCategory {
  id: string;
  user_id: string;
  is_active: boolean;
  emoji: string;
  en_name?: string | null;
  zh_name?: string | null;
  created_at: number;
}

/**
 * Transaction entity representing a financial transaction
 */
export interface Transaction {
  id: string;
  user_id: string;
  name?: string | null;
  category_id?: string | null;
  amount: number;
  type: "expense" | "income";
  created_at: number;
}

/**
 * Transaction with enriched category data
 */
export interface TransactionWithCategory extends Transaction {
  categoryData?: {
    id: string;
    emoji: string;
    en_name?: string | null;
    zh_name?: string | null;
  } | null;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Time period options for charts filtering
 */
export type TimePeriod = "week" | "month" | "year";

/**
 * Aggregated category data for pie chart
 */
export interface CategoryAggregation {
  category_id: string | null;
  total: number;
  count: number;
  emoji?: string | null;
  en_name?: string | null;
  zh_name?: string | null;
}

/**
 * Aggregated monthly data for histogram
 */
export interface MonthlyAggregation {
  month: string; // Format: "YYYY-MM"
  total: number;
  count: number;
}

/**
 * Aggregated income/expense data for a single month
 */
export interface MonthlyIncomeExpenseData {
  month: number; // 1-12
  income: number;
  income_count: number;
  expense: number;
  expense_count: number;
}

/**
 * Aggregated yearly income and expense data for trend chart
 */
export interface YearlyIncomeExpenseAggregation {
  year: number;
  months: MonthlyIncomeExpenseData[];
}

/**
 * Request payload for creating a transaction via external API
 */
export interface CreateTransactionRequest {
  amount: number;
  category?: string;
  name?: string;
}

/**
 * Success response for transaction creation via external API
 */
export interface CreateTransactionResponse {
  success: true;
  transaction: {
    id: string;
    amount: number;
    category: string;
    name: string;
    type: string;
    createdAt: number;
  };
}

/**
 * Pre-computed monthly aggregate for a user, category, and type
 */
export interface Aggregate {
  id: string;
  user_id: string;
  year: number;
  month: number;
  category_id: string | null;
  type: "expense" | "income";
  amount: number;
  count: number;
  created_at: number;
}

/**
 * Aggregate with enriched category data
 */
export interface AggregateWithCategory extends Aggregate {
  categoryData?: {
    id: string;
    emoji: string;
    en_name: string | null;
    zh_name: string | null;
  } | null;
}
