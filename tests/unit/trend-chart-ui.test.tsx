// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { IncomeExpenseTrendChart } from "@/components/charts/TrendChart";

const mocks = vi.hoisted(() => ({
  chart: vi.fn(),
  axis: vi.fn(),
  bar: vi.fn(),
  line: vi.fn(),
  grid: vi.fn(),
  baseline: vi.fn(),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  ComposedChart: (props: { children: ReactNode }) => {
    mocks.chart(props);
    return props.children;
  },
  XAxis: () => null,
  YAxis: (props: unknown) => {
    mocks.axis(props);
    return null;
  },
  Bar: (props: unknown) => {
    mocks.bar(props);
    return null;
  },
  Line: (props: unknown) => {
    mocks.line(props);
    return null;
  },
  CartesianGrid: (props: unknown) => {
    mocks.grid(props);
    return null;
  },
  ReferenceLine: (props: unknown) => {
    mocks.baseline(props);
    return null;
  },
  Tooltip: () => null,
  Legend: () => null,
}));
vi.mock("@/hooks/useLanguage", () => ({ useLanguage: () => ({ lang: "en" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/catCache", () => ({ readCatCache: () => null, writeCatCache: vi.fn() }));
vi.mock("@/lib/services/categories", () => ({ listActiveByUser: async () => [] }));
vi.mock("@/lib/services/aggregates", () => ({
  getCurrentUserYearMonth: async () => ({ year: 2026, month: 9 }),
  listAvailableTransactionYears: async () => [2025, 2026],
  getMonthlyIncomeExpenseTrend: async () => [
    { month: 1, income: 100, expense: 150 },
    { month: 10, income: 200, expense: 50 },
  ],
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

async function renderChart(search = "?trendYear=2026") {
  render(
    <MemoryRouter initialEntries={[`/charts${search}`]}>
      <IncomeExpenseTrendChart userId="user" />
    </MemoryRouter>
  );
  await waitFor(() => expect(mocks.chart).toHaveBeenCalled());
  return mocks.chart.mock.lastCall![0];
}

it("uses paired bars, a net line, a right-hand scale and a zero baseline", async () => {
  const chart = await renderChart();
  expect(chart.margin.left).toBeGreaterThan(0);
  expect(mocks.bar.mock.calls.map(([props]) => props.dataKey)).toEqual(["income", "expense"]);
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ dataKey: "netIncome", stroke: "#3b82f6" })
  );
  expect(mocks.grid).toHaveBeenLastCalledWith(expect.objectContaining({ vertical: false }));
  expect(mocks.baseline).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0 }));
  const axis = mocks.axis.mock.lastCall![0];
  expect(axis.orientation).toBe("right");
  expect(axis.domain[0]).toBeLessThan(0);
  expect(axis.ticks).toEqual([-10000, -5000, 0, 5000, 10000, 15000, 20000]);
  expect(axis.interval).toBe(0);
  expect(axis.tickFormatter(-10000)).toBe("-$10k");
});

it("leaves future months blank but keeps past missing months at zero", async () => {
  const { data } = await renderChart();
  expect(data[0].netIncome).toBe(-50);
  expect(data[1].netIncome).toBe(0);
  expect(data[9].netIncome).toBe(150);
  expect(data[0].cumulativeNetIncome).toBe(-50);
  expect(data[1].cumulativeNetIncome).toBe(-50);
  expect(data[9].cumulativeNetIncome).toBe(100);
  expect(data[10].cumulativeNetIncome).toBeNull();
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({
      dataKey: "cumulativeNetIncome",
      stroke: "#f97316",
    })
  );
  expect(data[10]).toMatchObject({ income: null, expense: null, netIncome: null });
  expect(data[11].netIncome).toBeNull();
  cleanup();
  vi.clearAllMocks();
  const historical = await renderChart("?trendYear=2025");
  expect(historical.data[11].netIncome).toBe(0);
});

it("keeps expense category filtering expense-only", async () => {
  await renderChart("?trendYear=2026&trendCat=food");
  expect(mocks.bar.mock.calls.map(([props]) => props.dataKey)).toEqual(["expense"]);
  expect(mocks.line).not.toHaveBeenCalled();
  expect(mocks.axis.mock.lastCall![0].domain[0]).toBe(0);
});
