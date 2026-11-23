import { afterEach, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([
  { input: "5.50", saved: 5.5, display: "5.50" },
  { input: "20.800000000000001", saved: 20.8, display: "20.80" },
  { input: "7.0999999999999996", saved: 7.1, display: "7.10" },
  { input: 1000.005, saved: 1000.005, display: "1000.01" },
])(
  "returns $input as display text $display without rounding the saved amount",
  async ({ input, saved, display }) => {
    const serve = vi.fn<(handler: (request: Request) => Promise<Response>) => void>();
    vi.stubGlobal("Deno", { serve, env: { get: vi.fn() } });

    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "user-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: "category-1", error: null })
      .mockResolvedValueOnce({ error: null });
    createClient.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ single }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      rpc,
    });

    vi.resetModules();
    await import("../../supabase/functions/create-transaction/index");
    const handler = serve.mock.calls[0][0];
    const response = await handler(
      new Request("http://localhost/functions/v1/create-transaction", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: input, category: "Coffee" }),
      })
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_transaction_from_web",
      expect.objectContaining({ p_amount: saved })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, amount: display });
  }
);
