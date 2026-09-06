import { describe, expect, it } from "vitest";
import {
  getTransactionCreateUrl,
  getTransactionUpdateUrl,
  getTransactionsUrl,
} from "@/lib/transactionNavigation";

describe("transaction navigation", () => {
  const search = "?type=expense&category=food&fromDate=2026-01-01";

  it("keeps filters when returning to the transaction list", () => {
    expect(getTransactionsUrl(search)).toBe(`/transactions${search}`);
  });

  it("keeps filters when opening an update form", () => {
    expect(getTransactionUpdateUrl("transaction-1", search)).toBe(
      `/transactions/update/transaction-1${search}`
    );
  });

  it("keeps filters when opening create from a transaction route", () => {
    expect(getTransactionCreateUrl("/transactions", search)).toBe(`/transactions/create${search}`);
    expect(getTransactionCreateUrl("/transactions/update/transaction-1", search)).toBe(
      `/transactions/create${search}`
    );
  });

  it("does not carry unrelated page queries into create", () => {
    expect(getTransactionCreateUrl("/charts", "?catMonth=2026-01")).toBe("/transactions/create");
  });
});
