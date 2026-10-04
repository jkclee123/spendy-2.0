// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import messages from "../../messages/en.json";
import { ChartsPage } from "@/pages/ChartsPage";

const mocks = vi.hoisted(() => ({
  expense: vi.fn(),
  income: vi.fn(),
  current: vi.fn(),
  earliest: vi.fn(),
  lang: "en",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/hooks/useLanguage", () => ({ useLanguage: () => ({ lang: mocks.lang }) }));
vi.mock("@/components/charts/TrendChart", () => ({
  IncomeExpenseTrendChart: () => <div>Trend</div>,
}));
vi.mock("@/lib/services/aggregates", () => ({
  getExpensesByCategory: mocks.expense,
  getIncomeByCategory: mocks.income,
  getCurrentUserYearMonth: mocks.current,
  getEarliestAggregateYearMonth: mocks.earliest,
}));
const i18n = createInstance();
await i18n.init({ lng: "en", resources: { en: messages }, initImmediate: false });
function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function renderChart(search = "") {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/charts${search}`]}>
        <ChartsPage />
        <Location />
      </MemoryRouter>
    </I18nextProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lang = "en";
  mocks.current.mockResolvedValue({ year: 2026, month: 1 });
  mocks.earliest.mockResolvedValue({ year: 2025, month: 11 });
  mocks.expense.mockResolvedValue([
    { category_id: "food", en_name: "Food", emoji: "F", total: 40, count: 1 },
  ]);
  mocks.income.mockResolvedValue([
    { category_id: "salary", en_name: "Salary", zh_name: "Pay", emoji: "$", total: 200, count: 1 },
    { category_id: null, total: 50, count: 1 },
  ]);
});
afterEach(cleanup);
async function expectRange(...range: number[]) {
  await waitFor(() => {
    expect(mocks.expense).toHaveBeenLastCalledWith("user", ...range);
    expect(mocks.income).toHaveBeenLastCalledWith("user", ...range);
  });
  await screen.findByText("Total Income");
}
describe("merged ratio card", () => {
  it("renders one bordered control and expense then income categories in the original card", async () => {
    renderChart();
    await expectRange(2026, 2, 2026, 2);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    const control = screen.getByRole("combobox", { name: "Select period" });
    for (const className of ["border", "border-gray-400", "dark:border-gray-500", "min-h-[44px]"]) {
      expect(control.classList.contains(className)).toBe(true);
    }
    const card = screen.getByRole("heading", { name: "Expenses Ratio" }).parentElement!
      .parentElement!;
    expect(card.classList.contains("rounded-2xl")).toBe(true);
    expect(card.classList.contains("shadow-md")).toBe(true);
    expect(card.contains(screen.getByText("Total Income"))).toBe(true);
    expect(screen.queryByRole("heading", { name: "Income Ratio" })).toBeNull();
    const texts = [...card.querySelectorAll("p, a")].map((node) => node.textContent);
    expect(texts.indexOf("Total Expenses")).toBeLessThan(texts.indexOf("Total Income"));
    const income = screen.getByRole("link", { name: /Salary/ });
    const params = new URL(income.getAttribute("href")!, "http://localhost").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      type: "income",
      category: "salary",
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    });
    expect(params.has("name")).toBe(false);
    expect(income.className).toBe("flex items-center gap-2 hover:opacity-70 transition-opacity");
    expect(screen.getByText("Uncategorized").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: /Total Income/ }).textContent).toContain("$250.00");
    const net = screen.getByText("Net Income").parentElement!;
    expect(net.textContent).toContain("$210.00");
    expect(net.querySelector("p:last-child")!.className).toBe("text-2xl font-bold text-purple-400");
    expect(mocks.current).toHaveBeenCalledTimes(1);
    expect(mocks.earliest).toHaveBeenCalledTimes(1);
    expect(mocks.expense).toHaveBeenCalledTimes(1);
    expect(mocks.income).toHaveBeenCalledTimes(1);
  });
  it("shares month, year and all-time selection and arrows while preserving unrelated URL params", async () => {
    renderChart("?catMonth=2026-01&trendYear=2025");
    await expectRange(2026, 1, 2026, 1);
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    await expectRange(2025, 12, 2025, 12);
    expect(screen.getByTestId("location").textContent).toContain("catMonth=2025-12");
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    await expectRange(2026, 1, 2026, 1);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y-2026" } });
    await expectRange(2026, 1, 2026, 12);
    expect(screen.getByRole("link", { name: /Salary/ }).getAttribute("href")).toContain(
      "toDate=2026-12-31"
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    await expectRange(2025, 1, 2025, 12);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all-time" } });
    await expectRange(2025, 12, 2026, 2);
    expect(screen.getByTestId("location").textContent).toBe("?trendYear=2025&catAllTime=1");
    expect(screen.getByRole("link", { name: /Salary/ }).getAttribute("href")).toBe(
      "/transactions?type=income&category=salary"
    );
    for (const button of screen.getAllByRole("button"))
      expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it("localizes income categories and keeps income visible when expenses are empty", async () => {
    mocks.lang = "zh-HK";
    mocks.expense.mockResolvedValue([]);
    renderChart("?catYear=2025");
    await expectRange(2025, 1, 2025, 12);
    expect(screen.getByRole("link", { name: /Pay/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Total Expenses/ }).textContent).toContain("$0.00");
    expect(screen.getByRole("link", { name: /Total Income/ }).textContent).toContain("$250.00");
  });
  it.each([
    [300, 50, "-$250.00"],
    [0, 0, "$0.00"],
  ])("renders net income for expenses %s and income %s", async (expense, income, expected) => {
    mocks.expense.mockResolvedValue([{ category_id: "food", total: expense }]);
    mocks.income.mockResolvedValue([{ category_id: "salary", total: income }]);
    renderChart();
    await expectRange(2026, 2, 2026, 2);
    expect(screen.getByText("Net Income").parentElement!.textContent).toContain(expected);
  });
});
