import { supabase } from "@/lib/supabase";
import type { UserCategory } from "@/types";

export async function listActiveByUser(userId: string): Promise<UserCategory[]> {
  const { data, error } = await supabase
    .from("user_categories")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as UserCategory[];
}

export async function listByUser(userId: string): Promise<UserCategory[]> {
  const { data, error } = await supabase
    .from("user_categories")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as UserCategory[];
}

export async function getById(categoryId: string): Promise<UserCategory | null> {
  const { data, error } = await supabase
    .from("user_categories")
    .select("*")
    .eq("id", categoryId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as UserCategory;
}

export async function createCategory(params: {
  userId: string;
  emoji: string;
  name: string;
  currentLang: "en" | "zh-HK";
}): Promise<UserCategory> {
  const { data, error } = await supabase
    .from("user_categories")
    .insert({
      user_id: params.userId,
      emoji: params.emoji,
      en_name: params.name,
      zh_name: params.name,
      created_at: Date.now(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserCategory;
}

export async function updateCategory(params: {
  categoryId: string;
  userId: string;
  emoji: string;
  name: string;
  currentLang: "en" | "zh-HK";
}): Promise<void> {
  // First get current category to do smart update
  const current = await getById(params.categoryId);

  const updateData: Record<string, string> = { emoji: params.emoji };

  if (!current?.en_name && !current?.zh_name) {
    // Both empty — save to both
    updateData.en_name = params.name;
    updateData.zh_name = params.name;
  } else if (params.currentLang === "zh-HK") {
    updateData.zh_name = params.name;
  } else {
    updateData.en_name = params.name;
  }

  const { error } = await supabase
    .from("user_categories")
    .update(updateData)
    .eq("id", params.categoryId)
    .eq("user_id", params.userId);

  if (error) throw error;
}

export async function deactivateCategory(categoryId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_categories")
    .update({ is_active: false })
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function activateCategory(categoryId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_categories")
    .update({ is_active: true })
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function findByName(userId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_category_by_name", {
    p_user_id: userId,
    p_name: name,
  });

  if (error) throw error;
  return data as string | null;
}
