import { describe, it, expect } from "vitest";

interface Aggregate {
  _id: string;
  userId: string;
  year: number;
  month: number;
  category: string | null;
  type: "expense" | "income";
  amount: number;
  count: number;
  createdAt: number;
}

interface Transaction {
  _id: string;
  userId: string;
  category: string | null;
  amount: number;
  type: "expense" | "income";
  createdAt: number;
}

function aggregateTransactionsByMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Aggregate[] {
  const startDate = new Date(year, month - 1, 1).getTime();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const monthTransactions = transactions.filter(
    (t) => t.createdAt >= startDate && t.createdAt <= endDate
  );

  const groupMap = new Map<
    string,
    { category: string | null; type: "expense" | "income"; amount: number; count: number }
  >();

  for (const t of monthTransactions) {
    const key = `${t.type}-${t.category || "null"}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.amount += t.amount;
      existing.count += 1;
    } else {
      groupMap.set(key, {
        category: t.category,
        type: t.type,
        amount: t.amount,
        count: 1,
      });
    }
  }

  const entries = Array.from(groupMap.entries());
  return entries.map((entry, index) => ({
    _id: `agg-${index}`,
    userId: "user1",
    year,
    month,
    category: entry[1].category,
    type: entry[1].type,
    amount: entry[1].amount,
    count: entry[1].count,
    createdAt: Date.now(),
  }));
}

describe("Aggregation Logic", () => {
  describe("aggregateTransactionsByMonth", () => {
    const year = 2026;
    const month = 1;

    it("should return empty array when no transactions for the month", () => {
      const transactions: Transaction[] = [];
      const result = aggregateTransactionsByMonth(transactions, year, month);
      expect(result).toEqual([]);
    });

    it("should aggregate expenses by category", () => {
      const transactions: Transaction[] = [
        {
          _id: "t1",
          userId: "user1",
          category: "cat-food",
          amount: 100,
          type: "expense",
          createdAt: new Date(year, month - 1, 15).getTime(),
        },
        {
          _id: "t2",
          userId: "user1",
          category: "cat-food",
          amount: 50,
          type: "expense",
          createdAt: new Date(year, month - 1, 20).getTime(),
        },
        {
          _id: "t3",
          userId: "user1",
          category: "cat-transport",
          amount: 30,
          type: "expense",
          createdAt: new Date(year, month - 1, 10).getTime(),
        },
      ];

      const result = aggregateTransactionsByMonth(transactions, year, month);

      expect(result.length).toBe(2);
      const foodAggregate = result.find((a) => a.category === "cat-food");
      expect(foodAggregate).toBeDefined();
      expect(foodAggregate!.amount).toBe(150);
      expect(foodAggregate!.count).toBe(2);

      const transportAggregate = result.find((a) => a.category === "cat-transport");
      expect(transportAggregate).toBeDefined();
      expect(transportAggregate!.amount).toBe(30);
      expect(transportAggregate!.count).toBe(1);
    });

    it("should aggregate income separately (category null)", () => {
      const transactions: Transaction[] = [
        {
          _id: "t1",
          userId: "user1",
          category: null,
          amount: 5000,
          type: "income",
          createdAt: new Date(year, month - 1, 1).getTime(),
        },
        {
          _id: "t2",
          userId: "user1",
          category: null,
          amount: 3000,
          type: "income",
          createdAt: new Date(year, month - 1, 15).getTime(),
        },
      ];

      const result = aggregateTransactionsByMonth(transactions, year, month);

      expect(result.length).toBe(1);
      const incomeAggregate = result[0];
      expect(incomeAggregate.type).toBe("income");
      expect(incomeAggregate.category).toBe(null);
      expect(incomeAggregate.amount).toBe(8000);
      expect(incomeAggregate.count).toBe(2);
    });

    it("should separate expenses and income with same category reference", () => {
      const transactions: Transaction[] = [
        {
          _id: "t1",
          userId: "user1",
          category: "cat-misc",
          amount: 100,
          type: "expense",
          createdAt: new Date(year, month - 1, 10).getTime(),
        },
        {
          _id: "t2",
          userId: "user1",
          category: null,
          amount: 1000,
          type: "income",
          createdAt: new Date(year, month - 1, 15).getTime(),
        },
      ];

      const result = aggregateTransactionsByMonth(transactions, year, month);

      expect(result.length).toBe(2);
      const expenseAggregate = result.find((a) => a.type === "expense");
      expect(expenseAggregate!.amount).toBe(100);
      expect(expenseAggregate!.category).toBe("cat-misc");

      const incomeAggregate = result.find((a) => a.type === "income");
      expect(incomeAggregate!.amount).toBe(1000);
      expect(incomeAggregate!.category).toBe(null);
    });

    it("should only include transactions from the specified month", () => {
      const transactions: Transaction[] = [
        {
          _id: "t1",
          userId: "user1",
          category: "cat-food",
          amount: 100,
          type: "expense",
          createdAt: new Date(year, month - 1, 15).getTime(),
        },
        {
          _id: "t2",
          userId: "user1",
          category: "cat-food",
          amount: 200,
          type: "expense",
          createdAt: new Date(year, month, 15).getTime(),
        },
      ];

      const result = aggregateTransactionsByMonth(transactions, year, month);

      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(100);
    });

    it("should handle uncategorized expenses", () => {
      const transactions: Transaction[] = [
        {
          _id: "t1",
          userId: "user1",
          category: null,
          amount: 50,
          type: "expense",
          createdAt: new Date(year, month - 1, 10).getTime(),
        },
      ];

      const result = aggregateTransactionsByMonth(transactions, year, month);

      expect(result.length).toBe(1);
      expect(result[0].category).toBe(null);
      expect(result[0].type).toBe("expense");
      expect(result[0].amount).toBe(50);
    });
  });

  describe("previous month calculation", () => {
    it("should correctly calculate previous month in January", () => {
      const now = new Date(2026, 0, 15);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      expect(previousMonth.getFullYear()).toBe(2025);
      expect(previousMonth.getMonth()).toBe(11);
    });

    it("should correctly calculate previous month in December", () => {
      const now = new Date(2026, 11, 15);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      expect(previousMonth.getFullYear()).toBe(2026);
      expect(previousMonth.getMonth()).toBe(10);
    });
  });
});
