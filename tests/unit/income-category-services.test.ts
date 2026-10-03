import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, updateCategory } from "@/lib/services/categories";
import { createTransaction, updateTransaction } from "@/lib/services/transactions";
import { clearCatCache, readCatCache, writeCatCache } from "@/lib/catCache";
import type { UserCategory } from "@/types";

const { client, query } = vi.hoisted(() => {
  const query = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  return { query, client: { from: vi.fn(), rpc: vi.fn() } };
});
vi.mock("@/lib/supabase", () => ({ supabase: client }));

beforeEach(() => {
  vi.resetAllMocks();
  client.from.mockReturnValue(query);
  for (const method of [query.insert, query.update, query.select, query.eq]) {
    method.mockReturnValue(query);
  }
  query.single.mockResolvedValue({ data: { en_name: "Food", type: "income" }, error: null });
  client.rpc.mockResolvedValue({ data: "transaction-id", error: null });
});

describe("income category services", () => {
  it.each([undefined, "expense", "income"] as const)("creates category type %s", async (type) => {
    await createCategory({ userId: "user", emoji: "$", name: "Salary", currentLang: "en", type });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ type: type ?? "expense" }));
  });

  it("updates an explicit type but leaves it unchanged when omitted", async () => {
    const params = {
      categoryId: "cat",
      userId: "user",
      emoji: "$",
      name: "Salary",
      currentLang: "en" as const,
    };
    await updateCategory({ ...params, type: "income" });
    expect(query.update).toHaveBeenLastCalledWith({
      emoji: "$",
      en_name: "Salary",
      type: "income",
    });
    await updateCategory(params);
    expect(query.update).toHaveBeenLastCalledWith({ emoji: "$", en_name: "Salary" });
  });

  it.each(["expense", "income"] as const)(
    "preserves %s category IDs in both RPCs",
    async (type) => {
      const params = {
        userId: "user",
        amount: 100,
        name: "Pay",
        categoryId: "cat",
        type,
        createdAt: 1,
        timezoneOffset: 480,
      };
      await createTransaction(params);
      await updateTransaction({ ...params, id: "tx" });
      for (const [, payload] of client.rpc.mock.calls) {
        expect(payload).toMatchObject({ p_category_id: "cat", p_type: type });
      }
    }
  );

  it("sends null when an income transaction has no category", async () => {
    await createTransaction({
      userId: "user",
      amount: 1,
      name: "",
      type: "income",
      createdAt: 1,
      timezoneOffset: 0,
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "create_transaction_from_web",
      expect.objectContaining({ p_category_id: null })
    );
  });

  it("ignores the old untyped cache and round-trips the versioned cache", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    try {
      storage.set("spendy:cat-cache:user", JSON.stringify({ data: [{ id: "old" }] }));
      expect(readCatCache("user")).toBeNull();
      const categories: UserCategory[] = [
        { id: "cat", user_id: "user", type: "income", emoji: "$", is_active: true, created_at: 1 },
      ];
      writeCatCache("user", categories);
      expect(readCatCache("user")).toEqual(categories);
      clearCatCache("user");
      expect(readCatCache("user")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
