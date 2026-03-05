import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

type MockClient = {
  query: Mock;
  mutation: Mock;
};

const mockClient: MockClient = {
  query: vi.fn(),
  mutation: vi.fn(),
};

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => mockClient),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getByApiToken: "users.getByApiToken",
    },
    userCategories: {
      findByName: "userCategories.findByName",
      create: "userCategories.create",
      getById: "userCategories.getById",
    },
    transactions: {
      createFromApi: "transactions.createFromApi",
    },
  },
}));

describe("POST /api/transactions/create", () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const route = await import("@/app/api/transactions/create/route");
    POST = route.POST;
  });

  const createRequest = (body: Record<string, unknown>, authToken?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return new NextRequest("http://localhost:3000/api/transactions/create", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  };

  describe("Valid request", () => {
    it("should return 201 when request is valid", async () => {
      const validToken = "test-api-token-123";
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
      };
      const mockCategory = {
        _id: "category123",
        userId: "user123",
        emoji: "🍔",
        en_name: "Food",
      };
      const mockTransactionId = "transaction123";

      mockClient.query.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockCategory);

      mockClient.mutation.mockResolvedValueOnce(mockTransactionId);

      const request = createRequest(
        {
          amount: 45.5,
          category: "Food",
          name: "Lunch",
        },
        validToken
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.transactionId).toBe(mockTransactionId);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.mutation).toHaveBeenCalledTimes(1);
    });
  });

  describe("Authentication errors", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const request = createRequest({
        amount: 45.5,
        category: "Food",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication failed");
      expect(data.message).toContain("Authorization header is required");
    });

    it("should return 401 when Authorization header format is invalid", async () => {
      const request = new NextRequest("http://localhost:3000/api/transactions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "invalid-format",
        },
        body: JSON.stringify({
          amount: 45.5,
          category: "Food",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication failed");
      expect(data.message).toContain("Authorization header is required");
    });

    it("should return 401 when apiToken is invalid", async () => {
      mockClient.query.mockResolvedValueOnce(null);

      const request = createRequest(
        {
          amount: 45.5,
          category: "Food",
        },
        "invalid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication failed");
      expect(data.message).toBe("Invalid or expired API token");
    });
  });

  describe("Validation errors", () => {
    it("should return 400 when amount is missing", async () => {
      const request = createRequest(
        {
          category: "Food",
        },
        "test-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.message).toContain("amount is required");
    });

    it("should return 400 when amount is negative", async () => {
      const request = createRequest(
        {
          amount: -10,
          category: "Food",
        },
        "test-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.message).toContain("amount must be a positive number");
    });

    it("should return 400 when category is missing", async () => {
      const request = createRequest(
        {
          amount: 45.5,
        },
        "test-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.message).toContain("category is required");
    });

    it("should return 400 when category is empty string", async () => {
      const request = createRequest(
        {
          amount: 45.5,
          category: "",
        },
        "test-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.message).toContain("category is required");
    });
  });

  describe("Rate limiting", () => {
    it("should return 429 when rate limit is exceeded", async () => {
      const validToken = "rate-limit-token";
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
      };

      mockClient.query.mockResolvedValue(mockUser);

      let lastResponse;
      for (let i = 0; i < 61; i++) {
        const request = createRequest(
          {
            amount: 45.5,
            category: "Food",
          },
          validToken
        );
        lastResponse = await POST(request);
      }

      expect(lastResponse!.status).toBe(429);
      const data = await lastResponse!.json();
      expect(data.error).toBe("Rate limit exceeded");
      expect(lastResponse!.headers.get("X-RateLimit-Limit")).toBe("60");
      expect(lastResponse!.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("Category auto-creation", () => {
    it("should auto-create category when category doesn't exist", async () => {
      const validToken = "test-token";
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
      };
      const newCategoryId = "new-category-123";
      const mockNewCategory = {
        _id: newCategoryId,
        userId: "user123",
        emoji: "❓",
        en_name: "New Category",
      };
      const mockTransactionId = "transaction123";

      mockClient.query
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockNewCategory);

      mockClient.mutation
        .mockResolvedValueOnce(newCategoryId)
        .mockResolvedValueOnce(mockTransactionId);

      const request = createRequest(
        {
          amount: 45.5,
          category: "New Category",
        },
        validToken
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: mockUser._id,
          emoji: "❓",
          name: "New Category",
          currentLang: "en",
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should return 500 when database error occurs", async () => {
      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      const request = createRequest(
        {
          amount: 45.5,
          category: "Food",
        },
        "test-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(data.message).toContain("unexpected error");
    });
  });
});
