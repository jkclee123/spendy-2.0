import { supabase } from "@/lib/supabase";
import type { TransactionWithCategory } from "@/types";

interface ListPaginatedParams {
  userId: string;
  type?: "expense" | "income";
  nameSearch?: string;
  categoryId?: string;
  startDate?: number;
  endDate?: number;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

interface PaginatedResult {
  data: TransactionWithCategory[];
  hasMore: boolean;
  nextOffset: number;
}

export async function createTransaction(params: {
  userId: string;
  amount: number;
  name: string;
  categoryId?: string;
  type: "expense" | "income";
  createdAt: number;
  timezoneOffset: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_transaction_from_web", {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_name: params.name || null,
    p_category_id: params.type === "income" ? null : params.categoryId || null,
    p_type: params.type,
    p_created_at: params.createdAt,
    p_timezone_offset: params.timezoneOffset,
  });

  if (error) throw error;
  return data as string;
}

export async function updateTransaction(params: {
  id: string;
  userId: string;
  amount: number;
  name: string;
  categoryId?: string;
  type: "expense" | "income";
  createdAt: number;
  timezoneOffset: number;
}): Promise<void> {
  const { error } = await supabase.rpc("update_transaction", {
    p_id: params.id,
    p_user_id: params.userId,
    p_amount: params.amount,
    p_name: params.name || null,
    p_category_id: params.type === "income" ? null : params.categoryId || null,
    p_type: params.type,
    p_created_at: params.createdAt,
    p_timezone_offset: params.timezoneOffset,
  });

  if (error) throw error;
}

export async function deleteTransaction(params: {
  id: string;
  userId: string;
  timezoneOffset?: number;
}): Promise<void> {
  const { error } = await supabase.rpc("delete_transaction", {
    p_id: params.id,
    p_user_id: params.userId,
    p_timezone_offset: params.timezoneOffset ?? -new Date().getTimezoneOffset(),
  });

  if (error) throw error;
}

export async function getTransactionById(id: string): Promise<TransactionWithCategory | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      *,
      category:user_categories (
        id,
        emoji,
        en_name,
        zh_name
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return {
    ...data,
    categoryData: data.category
      ? {
          id: data.category.id,
          emoji: data.category.emoji,
          en_name: data.category.en_name,
          zh_name: data.category.zh_name,
        }
      : null,
  } as TransactionWithCategory;
}

export async function listTransactionsPaginated(
  params: ListPaginatedParams
): Promise<PaginatedResult> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  let query = supabase
    .from("transactions")
    .select(
      `
      *,
      category:user_categories (
        id,
        emoji,
        en_name,
        zh_name
      )
    `
    )
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit); // Fetch one extra to check hasMore

  if (params.type) {
    query = query.eq("type", params.type);
  }
  if (params.nameSearch) {
    query = query.ilike("name", `%${params.nameSearch}%`);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.startDate !== undefined) {
    query = query.gte("created_at", params.startDate);
  }
  if (params.endDate !== undefined) {
    query = query.lte("created_at", params.endDate);
  }
  if (params.minAmount !== undefined) {
    query = query.gte("amount", params.minAmount);
  }
  if (params.maxAmount !== undefined) {
    query = query.lte("amount", params.maxAmount);
  }

  const { data, error } = await query;

  if (error) throw error;

  const hasMore = (data?.length ?? 0) > limit;
  const results = (data ?? []).slice(0, limit).map((row) => ({
    ...row,
    categoryData: row.category
      ? {
          id: row.category.id,
          emoji: row.category.emoji,
          en_name: row.category.en_name,
          zh_name: row.category.zh_name,
        }
      : null,
  })) as TransactionWithCategory[];

  return {
    data: results,
    hasMore,
    nextOffset: offset + limit,
  };
}
