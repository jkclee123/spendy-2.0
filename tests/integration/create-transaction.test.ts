import { afterEach, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("returns the amount saved by the create-transaction endpoint as a JSON number", async () => {
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

  await import("../../supabase/functions/create-transaction/index");
  const handler = serve.mock.calls[0][0];
  const response = await handler(
    new Request("http://localhost/functions/v1/create-transaction", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: "5.50", category: "Coffee" }),
    })
  );

  expect(rpc).toHaveBeenCalledWith(
    "create_transaction_from_web",
    expect.objectContaining({ p_amount: 5.5 })
  );
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ success: true, amount: 5.5 });
});
