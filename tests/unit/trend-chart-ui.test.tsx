// @vitest-environment jsdom
import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { IncomeExpenseTrendChart } from "@/components/charts/TrendChart";

const mocks = vi.hoisted(() => ({
  chart: vi.fn(),
  axis: vi.fn(),
  bar: vi.fn(),
  line: vi.fn(),
  grid: vi.fn(),
  baseline: vi.fn(),
  legend: vi.fn(),
  earliest: vi.fn(async () => new Date(2025, 2, 1).getTime()),
  trend: vi.fn<
    (
      _user: string,
      _year: number,
      _category: string | null
    ) => Promise<Array<{ month: number; income: number; expense: number }>>
  >(async () => [
    { month: 1, income: 100, expense: 150 },
    { month: 10, income: 200, expense: 50 },
  ]),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  ComposedChart: (props: { children: ReactNode }) => {
    mocks.chart(props);
    return <div data-testid="trend-plot">{props.children}</div>;
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
  Tooltip: ({ content }: { content: ReactElement }) => {
    const [active, setActive] = useState(false);
    return (
      <>
        <button onClick={() => setActive(!active)}>Inspect month</button>
        {cloneElement(content, {
          active,
          label: "Jan",
          payload: mocks.chart.mock.lastCall?.[0].children
            .filter((child: ReactElement | null) => Array.isArray(child))
            .flat()
            .map((child: ReactElement<{ dataKey: string; name: string }>) => ({
              name: child.props.name,
              dataKey: child.props.dataKey,
              value: 100,
            })),
        } as Record<string, unknown>)}
      </>
    );
  },
  Legend: (props: unknown) => {
    mocks.legend(props);
    return null;
  },
}));
vi.mock("@/hooks/useLanguage", () => ({ useLanguage: () => ({ lang: "en" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/catCache", () => ({ readCatCache: () => null, writeCatCache: vi.fn() }));
vi.mock("@/lib/services/categories", () => ({
  listActiveByUser: async () => [
    { id: "food", type: "expense", en_name: "Food" },
    { id: "salary", type: "income", en_name: "Salary" },
  ],
}));
vi.mock("@/lib/services/aggregates", () => ({
  getCurrentUserYearMonth: async () => ({ year: 2026, month: 9 }),
  getEarliestTransactionDate: mocks.earliest,
  listAvailableTransactionYears: async () => [2025, 2026],
  getMonthlyIncomeExpenseTrend: mocks.trend,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.earliest.mockResolvedValue(new Date(2025, 2, 1).getTime());
  mocks.trend.mockImplementation(async () => [
    { month: 1, income: 100, expense: 150 },
    { month: 10, income: 200, expense: 50 },
  ]);
});
afterEach(cleanup);

it("pins clicked month details after hover ends and unpins on a second click", async () => {
  await renderChart();
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 0 }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Jan 2026");
  expect(screen.getByTestId("trend-details").textContent).toContain("expense: $150.00");
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 0 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
});

it("clears a clicked month when hovering another month and does not restore it after hover", async () => {
  await renderChart();
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 6 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Jul 2026");
  act(() => mocks.chart.mock.lastCall![0].onMouseMove({ activeTooltipIndex: 6 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Jul 2026");
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  act(() => mocks.chart.mock.lastCall![0].onMouseMove({ activeTooltipIndex: 0 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Jan 2026");
  expect(screen.getByTestId("trend-details").textContent).not.toContain("Jul 2026");
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
});

it("updates month details while dragging on touch devices without another click", async () => {
  await renderChart("?trendYear=2026&trendMetric=income");
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 6 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Jul 2026");
  act(() => mocks.chart.mock.lastCall![0].onTouchMove({ activeTooltipIndex: 7 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Aug 2026");
  act(() => mocks.chart.mock.lastCall![0].onTouchMove({ activeTooltipIndex: 9 }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
  expect(screen.getByTestId("trend-details").textContent).toContain("income: $200.00");
  act(() => mocks.chart.mock.lastCall![0].onTouchMove({ activeTooltipIndex: null }));
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
});

async function renderChart(search = "?trendYear=2026") {
  function Location() {
    return <output data-testid="location">{useLocation().search}</output>;
  }
  render(
    <MemoryRouter initialEntries={[`/charts${search}`]}>
      <IncomeExpenseTrendChart userId="user" />
      <Location />
    </MemoryRouter>
  );
  await waitFor(() => expect(mocks.chart).toHaveBeenCalled());
  return mocks.chart.mock.lastCall![0];
}

it("shows the selected metric average over elapsed months, including zero months", async () => {
  await renderChart("?trendYear=2026&trendMetric=expense");
  expect(screen.getByTestId("trend-average").textContent).toContain("average: $20.00");
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
  expect(screen.getByTestId("trend-details").textContent).toContain("expense: $50.00");
  expect(
    screen
      .getByTestId("trend-average")
      .compareDocumentPosition(screen.getByTestId("trend-details")) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

it("shows separate averages for compared years", async () => {
  mocks.trend.mockImplementation(async (_user, year) => [
    { month: 3, income: 0, expense: year === 2026 ? 120 : 240 },
  ]);
  await renderChart("?trendYear=2026&trendYear2=2025&trendMetric=expense");
  expect(screen.getByTestId("trend-average").textContent).toContain("average (2026): $12.00");
  expect(screen.getByTestId("trend-average").textContent).toContain("average (2025): $24.00");
});

it("starts the average at the earliest transaction month in the current year", async () => {
  mocks.earliest.mockResolvedValue(new Date(2026, 2, 1).getTime());
  await renderChart("?trendYear=2026&trendMetric=expense&trendCat=food");
  expect(screen.getByTestId("trend-average").textContent).toContain("average: $6.25");
});

it("uses income and expense lines, a left-hand dynamic scale and a zero baseline", async () => {
  const chart = await renderChart();
  expect(chart.margin.left).toBe(0);
  expect(mocks.bar).not.toHaveBeenCalled();
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ dataKey: "income", stroke: "#22c55e" })
  );
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ dataKey: "expense", stroke: "#ef4444" })
  );
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ dataKey: "netIncome", stroke: "#a855f7" })
  );
  expect(mocks.grid).toHaveBeenLastCalledWith(expect.objectContaining({ vertical: false }));
  expect(mocks.baseline).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0 }));
  const axis = mocks.axis.mock.lastCall![0];
  expect(axis.orientation).toBe("left");
  expect(axis.width).toBe("auto");
  expect(axis.domain[0]).toBeLessThan(0);
  expect(axis.domain[0]).toBeLessThanOrEqual(-50);
  expect(axis.domain[1]).toBeGreaterThanOrEqual(200);
  expect(axis.domain[1]).toBeLessThan(1000);
  expect(axis.interval).toBe(0);
  expect(axis.tickFormatter(-10000)).toBe("-$10k");
  expect(screen.getByRole("option", { name: /Salary/ })).toBeTruthy();
  expect(screen.getByTestId("trend-details")).toBeTruthy();
  expect(screen.queryByTestId("trend-average")).toBeNull();
});

it("uses 5k intervals from -5k to 25k for a roughly 25k data range", async () => {
  mocks.trend.mockResolvedValueOnce([
    { month: 1, income: 18000, expense: 9000 },
    { month: 2, income: 14000, expense: 18300 },
    { month: 3, income: 16300, expense: 300 },
  ]);
  await renderChart();
  const axis = mocks.axis.mock.lastCall![0];
  expect(axis.ticks).toEqual([-5000, 0, 5000, 10000, 15000, 20000, 25000]);
  expect(axis.domain).toEqual([-5000, 25000]);
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
      stroke: "#eab308",
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
  expect(mocks.bar).not.toHaveBeenCalled();
  expect([...new Set(mocks.line.mock.calls.map(([props]) => props.dataKey))]).toEqual(["expense"]);
  expect(mocks.axis.mock.lastCall![0].domain[0]).toBe(0);
  expect(screen.getByTestId("trend-average").textContent).toContain("average: $20.00");
});

it("shows only the green income line for an income category", async () => {
  await renderChart("?trendYear=2026&trendCat=salary");
  expect([...new Set(mocks.line.mock.calls.map(([props]) => props.dataKey))]).toEqual(["income"]);
  expect(mocks.line).toHaveBeenCalledWith(expect.objectContaining({ stroke: "#22c55e" }));
  expect(mocks.axis.mock.lastCall![0].domain[0]).toBe(0);
  expect(screen.getByTestId("trend-average").textContent).toContain("average: $30.00");
});

it("renders current month details initially and restores them when hover ends", async () => {
  await renderChart();
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  const details = screen.getByTestId("trend-details");
  expect(details.textContent).toContain("Jan 2026");
  expect(details.textContent).toContain("income: $100.00");
  expect(details.firstElementChild!.className).toContain("grid-cols-2");
  expect(details.querySelectorAll("p")[0].className).toContain("col-span-2");
  expect(
    [...details.querySelectorAll("p")].slice(1).map((p) => p.textContent?.split(":")[0])
  ).toEqual(["income", "expense", "netIncome", "cumulativeNetIncome"]);
  expect(screen.getByTestId("trend-plot").contains(details)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
  expect(details.textContent).toContain("Oct 2026");
});

it("requires year 1, defaults to the user's year, and offers an optional year 2 with identical years", async () => {
  await renderChart("");
  const first = screen.getByRole<HTMLSelectElement>("combobox", { name: "year1" });
  const second = screen.getByRole<HTMLSelectElement>("combobox", { name: "year2" });
  expect(first.required).toBe(true);
  expect(first.value).toBe("2026");
  expect(second.required).toBe(false);
  expect(second.value).toBe("");
  expect([...second.options].slice(1).map((o) => o.value)).toEqual(
    [...first.options].map((o) => o.value)
  );
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "metric" }).value).toBe("All");
  expect(screen.queryByRole("button", { name: /yearNavigation/ })).toBeNull();
  fireEvent.change(second, { target: { value: "2025" } });
  await waitFor(() =>
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "metric" }).value).toBe(
      "expense"
    )
  );
  expect(screen.getByRole<HTMLOptionElement>("option", { name: "allMetrics" }).disabled).toBe(true);
});

it.each(["All", "invalid"])(
  "normalizes comparison metric %s on initial URL load",
  async (metric) => {
    await renderChart(`?trendYear=2026&trendYear2=2025&trendMetric=${metric}`);
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "metric" }).value).toBe(
      "expense"
    );
    expect(screen.getByTestId("location").textContent).toContain("trendMetric=expense");
    expect(mocks.line.mock.lastCall![0].dataKey).toBe("expense2");
    expect(mocks.trend).toHaveBeenCalledWith("user", 2025, null);
  }
);

it.each(["expense", "income", "cumulativeNetIncome", "netIncome"])(
  "renders only %s for one year and two distinct year-labelled lines for comparison",
  async (metric) => {
    await renderChart(`?trendYear=2026&trendMetric=${metric}`);
    expect(mocks.line.mock.calls.map(([p]) => p.dataKey)).toEqual([metric]);
    cleanup();
    vi.clearAllMocks();
    await renderChart(`?trendYear=2026&trendYear2=2025&trendMetric=${metric}`);
    const lines = mocks.line.mock.calls.slice(-2).map(([p]) => p);
    expect(lines.map((p) => p.dataKey)).toEqual([metric, `${metric}2`]);
    expect(lines.map((p) => p.name)).toEqual([`${metric} (2026)`, `${metric} (2025)`]);
    expect(lines[0].stroke).not.toBe(lines[1].stroke);
    expect(lines[1].stroke).toBe("#0ea5e9");
    expect(lines[0].zIndex).toBeGreaterThan(lines[1].zIndex);
    fireEvent.click(screen.getByRole("button", { name: "Inspect month" }));
    const details = screen.getByTestId("trend-details");
    expect(details.textContent).toContain(`${metric} (2026)`);
    expect(details.textContent).toContain(`${metric} (2025)`);
    expect(details.querySelectorAll("p")[1].style.color).toBeTruthy();
    expect(screen.getByTestId("trend-plot").contains(details)).toBe(false);
  }
);

it("matches legend text to each line even when both years have the same label", async () => {
  await renderChart("?trendYear=2026&trendYear2=2026&trendMetric=expense");
  const { formatter } = mocks.legend.mock.lastCall![0];
  expect(formatter("expense (2026)", { color: "#ef4444" }).props.style.color).toBe("#ef4444");
  expect(formatter("expense (2026)", { color: "#0ea5e9" }).props.style.color).toBe("#0ea5e9");
});

it.each([
  ["food", "expense"],
  ["salary", "income"],
])("preserves the disabled metric for the %s category in comparison", async (category, metric) => {
  await renderChart(`?trendYear=2026&trendYear2=2025&trendMetric=netIncome&trendCat=${category}`);
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "metric" });
  expect(select.disabled).toBe(true);
  expect(select.value).toBe("netIncome");
  expect(screen.getByTestId("location").textContent).toContain("trendMetric=netIncome");
  expect(mocks.line.mock.calls.slice(-2).map(([p]) => p.dataKey)).toEqual([metric, `${metric}2`]);
  const name = category === "food" ? "Food" : "Salary";
  expect(mocks.line.mock.calls.slice(-2).map(([p]) => p.name)).toEqual([
    `${name} (2026)`,
    `${name} (2025)`,
  ]);
  expect(mocks.trend).toHaveBeenCalledWith("user", 2026, category);
  expect(mocks.trend).toHaveBeenCalledWith("user", 2025, category);
  fireEvent.change(screen.getByRole("combobox", { name: "categoryFilter.all" }), {
    target: { value: "" },
  });
  await waitFor(() => expect(select.disabled).toBe(false));
  expect(select.value).toBe("netIncome");
});

it("computes future months and cumulative totals independently for each year", async () => {
  const { data } = await renderChart(
    "?trendYear=2026&trendYear2=2025&trendMetric=cumulativeNetIncome"
  );
  expect(data[10].cumulativeNetIncome).toBeNull();
  expect(data[10].cumulativeNetIncome2).toBe(100);
  expect(data[0].cumulativeNetIncome2).toBe(-50);
  expect(data[9].cumulativeNetIncome).toBe(100);
});

it("scales only visible series and excludes hidden negative net values", async () => {
  mocks.trend.mockResolvedValue([{ month: 1, income: 1000000, expense: 10 }]);
  await renderChart("?trendYear=2026&trendMetric=expense");
  expect(mocks.axis.mock.lastCall![0].domain[0]).toBe(0);
  expect(mocks.axis.mock.lastCall![0].domain[1]).toBeLessThan(200);
});

it("keeps the plot and summary mounted during refresh and preserves the inspected month", async () => {
  await renderChart("?trendYear=2026&trendMetric=expense");
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 9 }));
  const plot = screen.getByTestId("trend-plot");
  const summary = screen.getByTestId("trend-summary");
  expect(summary.className).toContain("order-last");
  let resolveRefresh!: (data: Array<{ month: number; income: number; expense: number }>) => void;
  mocks.trend.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
  );
  fireEvent.change(screen.getByRole("combobox", { name: "categoryFilter.all" }), {
    target: { value: "food" },
  });
  await waitFor(() => expect(screen.getByTestId("trend-refresh")).toBeTruthy());
  expect(screen.getByTestId("trend-plot")).toBe(plot);
  expect(screen.getByTestId("trend-summary")).toBe(summary);
  await act(async () => resolveRefresh([{ month: 10, income: 0, expense: 75 }]));
  expect(screen.queryByTestId("trend-refresh")).toBeNull();
  expect(screen.getByTestId("trend-plot")).toBe(plot);
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
  expect(screen.getByTestId("trend-details").textContent).toContain("Food: $75.00");
});

it("preserves the inspected month across metric changes", async () => {
  await renderChart("?trendYear=2026&trendMetric=expense");
  act(() => mocks.chart.mock.lastCall![0].onClick({ activeTooltipIndex: 9 }));
  fireEvent.change(screen.getByRole("combobox", { name: "metric" }), {
    target: { value: "income" },
  });
  expect(screen.getByTestId("trend-details").textContent).toContain("Oct 2026");
  expect(screen.getByTestId("trend-details").textContent).toContain("income: $200.00");
});

it("ignores old requests after the selected year changes", async () => {
  let resolveOld!: (data: Array<{ month: number; income: number; expense: number }>) => void;
  mocks.trend.mockImplementation((_user, year) =>
    year === 2025
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve([{ month: 1, income: 300, expense: 10 }])
  );
  await renderChart();
  const year = screen.getByRole("combobox", { name: "year1" });
  fireEvent.change(year, { target: { value: "2025" } });
  await waitFor(() => expect(mocks.trend).toHaveBeenCalledWith("user", 2025, null));
  fireEvent.change(year, { target: { value: "2026" } });
  await waitFor(() => expect(screen.getByTestId("trend-plot")).toBeTruthy());
  await act(async () => {
    resolveOld([{ month: 1, income: 99999, expense: 0 }]);
  });
  await waitFor(() => expect(mocks.chart.mock.lastCall![0].data[0].income).toBe(300));
});

it.each(["empty", "error"])("settles loading to an empty state on %s results", async (result) => {
  if (result === "error") mocks.trend.mockRejectedValue(new Error("Unavailable"));
  else mocks.trend.mockResolvedValue([]);
  render(
    <MemoryRouter>
      <IncomeExpenseTrendChart userId="user" />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("noData")).toBeTruthy());
  expect(screen.queryByTestId("trend-plot")).toBeNull();
});

it("normalizes invalid metric and year parameters without dropping other URL state", async () => {
  await renderChart("?trendYear=bad&trendYear2=bad&trendMetric=bad&keep=yes");
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "year1" }).value).toBe("2026");
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "year2" }).value).toBe("");
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "metric" }).value).toBe("All");
  expect(screen.getByTestId("location").textContent).toContain("keep=yes");
  await waitFor(() => expect(screen.getByTestId("location").textContent).not.toContain("bad"));
});
