import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIncomeByCategory } from "@/lib/services/aggregates";
import type { CategoryAggregation } from "@/types";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));

beforeEach(() => vi.resetAllMocks());

describe("getIncomeByCategory", () => {
  it("passes the inclusive year/month range and returns category and null groups", async () => {
    const rows: CategoryAggregation[] = [
      { category_id: "salary", emoji: "$", en_name: "Salary", zh_name: null, total: 500, count: 2 },
      { category_id: null, emoji: null, en_name: null, zh_name: null, total: 100, count: 1 },
    ];
    rpc.mockResolvedValue({ data: rows, error: null });
    expect(await getIncomeByCategory("user", 2025, 11, 2026, 2)).toEqual(rows);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_income_by_category", {
      p_user_id: "user",
      p_start_year: 2025,
      p_start_month: 11,
      p_end_year: 2026,
      p_end_month: 2,
    });
  });

  it.each([null, []])("returns an empty array for %s", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await getIncomeByCategory("user", 2026, 1, 2026, 1)).toEqual([]);
  });

  it("propagates RPC errors", async () => {
    const error = { code: "42501", message: "Forbidden" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(getIncomeByCategory("user", 2026, 1, 2026, 1)).rejects.toBe(error);
  });
});
