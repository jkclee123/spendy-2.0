import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW_MS = 60_000;

interface RequestBody {
  amount?: unknown;
  category?: unknown;
  name?: unknown;
}

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Invalid or missing API token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const apiToken = authHeader.slice(7).trim();

  // Create service-role Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Look up user by API token
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("api_token", apiToken)
    .single();

  if (userError || !userRow) {
    return new Response(JSON.stringify({ error: "Invalid or missing API token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = userRow.id as string;
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  // Rate limit check: count requests in current window
  const { data: rateData } = await supabase
    .from("rate_limits")
    .select("id, request_count, window_start")
    .eq("api_token", apiToken)
    .single();

  let requestCount = 1;
  let windowStartTs = now;

  if (rateData) {
    if (rateData.window_start >= windowStart) {
      // Within current window
      requestCount = rateData.request_count + 1;
      windowStartTs = rateData.window_start;
    }
    // Update rate limit record
    await supabase
      .from("rate_limits")
      .update({ request_count: requestCount, window_start: windowStartTs })
      .eq("id", rateData.id);
  } else {
    // Create new rate limit record
    await supabase
      .from("rate_limits")
      .insert({ api_token: apiToken, request_count: 1, window_start: now });
  }

  const resetAt = windowStartTs + RATE_WINDOW_MS;
  const remaining = Math.max(0, RATE_LIMIT - requestCount);

  const rateLimitHeaders = {
    "Content-Type": "application/json",
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetAt),
  };

  if (requestCount > RATE_LIMIT) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: rateLimitHeaders,
    });
  }

  // Parse request body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: rateLimitHeaders,
    });
  }

  // Validate amount
  const amount = Number(body.amount);
  if (!body.amount || isNaN(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: "amount must be a positive number" }), {
      status: 400,
      headers: rateLimitHeaders,
    });
  }

  const categoryName = typeof body.category === "string" ? body.category.trim() : null;
  if (!categoryName) {
    return new Response(
      JSON.stringify({ error: "category is required and must be a non-empty string" }),
      {
        status: 400,
        headers: rateLimitHeaders,
      }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;

  // Resolve category
  let categoryId: string | null = null;
  const { data: foundCategoryId } = await supabase.rpc("find_category_by_name", {
    p_user_id: userId,
    p_name: categoryName,
  });

  if (foundCategoryId) {
    categoryId = foundCategoryId as string;
  } else {
    // Auto-create category
    const { data: newCategory } = await supabase
      .from("user_categories")
      .insert({
        user_id: userId,
        emoji: "❓",
        en_name: categoryName,
        zh_name: categoryName,
        created_at: Date.now(),
      })
      .select("id")
      .single();
    categoryId = newCategory?.id ?? null;
  }

  // Create transaction via RPC
  const { error: txError } = await supabase.rpc("create_transaction_from_web", {
    p_user_id: userId,
    p_amount: amount,
    p_name: name,
    p_category_id: categoryId,
    p_type: "expense",
    p_created_at: Date.now(),
    p_timezone_offset: 0,
  });

  if (txError) {
    return new Response(JSON.stringify({ error: "Failed to create transaction" }), {
      status: 500,
      headers: rateLimitHeaders,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: rateLimitHeaders,
  });
});
