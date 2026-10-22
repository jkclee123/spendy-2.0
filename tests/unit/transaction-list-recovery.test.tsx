// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransactionList } from "@/components/transactions/TransactionList";
import type { TransactionWithCategory } from "@/types";

type SubscriptionStatus = "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  showToast: vi.fn(),
  statuses: [] as Array<(status: SubscriptionStatus) => void>,
  observers: [] as IntersectionObserverCallback[],
}));

vi.mock("@/lib/services/transactions", () => ({
  listTransactionsPaginated: mocks.list,
  getTransactionById: mocks.getById,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { channel: mocks.channel, removeChannel: mocks.removeChannel },
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/transactions/TransactionCard", () => ({
  TransactionCard: ({ transaction }: { transaction: TransactionWithCategory }) => (
    <div data-testid="transaction-row">{transaction.name}</div>
  ),
}));

function transactions(count: number, start = 0): TransactionWithCategory[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `transaction-${start + index}`,
    user_id: "user",
    name: `Transaction ${start + index}`,
    amount: 10,
    type: "expense",
    created_at: Date.UTC(2026, 9, 22) - (start + index) * 1000,
    categoryData: null,
  }));
}

function page(data: TransactionWithCategory[], hasMore = false, offset = 0) {
  return { data, hasMore, nextOffset: offset + data.length };
}

async function renderList(props: Partial<Parameters<typeof TransactionList>[0]> = {}) {
  const view = render(<TransactionList userId="user" {...props} />);
  await act(async () => {});
  return view;
}

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

function emitStatus(status: SubscriptionStatus) {
  mocks.statuses[mocks.statuses.length - 1](status);
}

async function loadMore() {
  await act(async () => {
    mocks.observers[mocks.observers.length - 1](
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.statuses.length = 0;
  mocks.observers.length = 0;
  mocks.list.mockReset().mockResolvedValue(page(transactions(1)));
  mocks.channel.mockImplementation(() => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: SubscriptionStatus) => void) => {
        mocks.statuses.push(callback);
        return channel;
      }),
    };
    return channel;
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        mocks.observers.push(callback);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TransactionList lifecycle recovery", () => {
  it("fetches new transactions on visibility without a prior disconnect callback", async () => {
    await renderList();
    act(() => emitStatus("SUBSCRIBED"));
    mocks.list.mockResolvedValue(page([{ ...transactions(1)[0], name: "API transaction" }]));
    mocks.list.mockClear();

    fireEvent(document, new Event("visibilitychange"));
    expect(mocks.list).not.toHaveBeenCalled();
    await advanceDebounce();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 20 }));
    expect(screen.getByText("API transaction")).toBeTruthy();
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });

  it.each(["CLOSED", "TIMED_OUT", "CHANNEL_ERROR"] as const)(
    "fetches once after SDK recovery from %s while already visible",
    async (status) => {
      await renderList();
      act(() => emitStatus("SUBSCRIBED"));
      mocks.list.mockClear();

      act(() => emitStatus(status));
      expect(mocks.list).not.toHaveBeenCalled();
      await act(async () => emitStatus("SUBSCRIBED"));

      expect(mocks.list).toHaveBeenCalledTimes(1);
      act(() => emitStatus("SUBSCRIBED"));
      expect(mocks.list).toHaveBeenCalledTimes(1);
      expect(mocks.channel).toHaveBeenCalledTimes(1);
    }
  );

  it("refetches all 45 loaded rows on resume rather than resetting to one page", async () => {
    const rows = transactions(45);
    mocks.list
      .mockResolvedValueOnce(page(rows.slice(0, 20), true))
      .mockResolvedValueOnce(page(rows.slice(20, 40), true, 20))
      .mockResolvedValueOnce(page(rows.slice(40), false, 40));
    await renderList();
    await loadMore();
    await loadMore();
    expect(screen.getAllByTestId("transaction-row")).toHaveLength(45);
    mocks.list.mockClear().mockResolvedValue(page(rows));

    fireEvent(document, new Event("visibilitychange"));
    await advanceDebounce();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 45 }));
    expect(screen.getAllByTestId("transaction-row")).toHaveLength(45);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps filtered rows visible without a loading spinner during a one-page refresh", async () => {
    const rows = transactions(3);
    mocks.list.mockResolvedValue(page(rows));
    await renderList({ type: "expense" });
    let finishRefresh!: (result: ReturnType<typeof page>) => void;
    mocks.list.mockImplementation(
      () =>
        new Promise<ReturnType<typeof page>>((resolve) => {
          finishRefresh = resolve;
        })
    );

    fireEvent(document, new Event("visibilitychange"));
    await advanceDebounce();

    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "expense", offset: 0, limit: 20 })
    );
    expect(screen.getAllByTestId("transaction-row")).toHaveLength(3);
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => finishRefresh(page(rows)));
  });

  it("debounces visibility, bfcache restoration and online into one refresh and resubscription", async () => {
    await renderList();
    mocks.list.mockClear();

    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent(window, new Event("online"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledTimes(2);
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });

  it.each(["pageshow", "online"] as const)("recovers from %s on its own", async (event) => {
    await renderList();
    mocks.list.mockClear();

    fireEvent(
      window,
      event === "pageshow"
        ? new PageTransitionEvent("pageshow", { persisted: true })
        : new Event("online")
    );
    await advanceDebounce();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });

  it("does not reconnect for hidden visibility changes or ordinary pageshow events", async () => {
    await renderList();
    mocks.list.mockClear();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: false }));
    await advanceDebounce();

    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });

  it("ignores status callbacks from a removed subscription", async () => {
    await renderList();
    const oldStatus = mocks.statuses[0];
    fireEvent(document, new Event("visibilitychange"));
    await advanceDebounce();
    mocks.list.mockClear();

    await act(async () => {
      oldStatus("CLOSED");
      oldStatus("SUBSCRIBED");
      emitStatus("SUBSCRIBED");
    });

    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("removes lifecycle listeners and cancels a pending reconnect on unmount", async () => {
    const view = await renderList();
    mocks.list.mockClear();
    const setTimer = vi.spyOn(globalThis, "setTimeout");
    const clearTimer = vi.spyOn(globalThis, "clearTimeout");
    fireEvent(document, new Event("visibilitychange"));
    const pendingTimer = setTimer.mock.results[setTimer.mock.results.length - 1].value;

    view.unmount();
    expect(clearTimer).toHaveBeenCalledWith(pendingTimer);
    const timerCalls = setTimer.mock.calls.length;
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    fireEvent(window, new Event("online"));
    expect(setTimer).toHaveBeenCalledTimes(timerCalls);
    await advanceDebounce();

    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });
});
