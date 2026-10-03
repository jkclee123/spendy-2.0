// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import messages from "../../messages/en.json";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CategoryEditModal } from "@/components/settings/CategoryEditModal";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { SwipeableCard } from "@/components/ui/SwipeableCard";
import type { Transaction, UserCategory } from "@/types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  activateCategory: vi.fn(),
  clearCatCache: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  showToast: vi.fn(),
  categories: [] as UserCategory[],
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/hooks/useLanguage", () => ({ useLanguage: () => ({ lang: "en" }) }));
vi.mock("@/hooks/useUserCategories", () => ({
  useUserCategories: () => ({
    categories: mocks.categories,
    activeCategories: mocks.categories.filter((category) => category.is_active),
    isLoading: false,
    refresh: mocks.refresh,
  }),
}));
vi.mock("@/lib/services/categories", () => ({
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  activateCategory: mocks.activateCategory,
}));
vi.mock("@/lib/catCache", () => ({ clearCatCache: mocks.clearCatCache }));
vi.mock("@/lib/services/transactions", () => ({
  createTransaction: mocks.createTransaction,
  updateTransaction: mocks.updateTransaction,
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("@/components/ui/SwipeableCard", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/SwipeableCard")>();
  return { SwipeableCard: vi.fn(original.SwipeableCard) };
});

const i18n = createInstance();
await i18n.init({ lng: "en", resources: { en: messages }, initImmediate: false });

const food: UserCategory = {
  id: "food",
  user_id: "user",
  type: "expense",
  is_active: true,
  emoji: "F",
  en_name: "Food",
  created_at: 1,
};
const salary: UserCategory = {
  ...food,
  id: "salary",
  type: "income",
  emoji: "$",
  en_name: "Salary",
};
const inactive: UserCategory = {
  ...salary,
  id: "old-salary",
  en_name: "Old Salary",
  is_active: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.categories = [food, salary, inactive];
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderUI(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("CategoriesPage income category regressions", () => {
  it("preserves bordered card styling for expense and income rows", () => {
    renderUI(<CategoriesPage />);
    for (const name of [/Food/, /^\$\s*Salary$/]) {
      const row = screen.getByRole("button", { name });
      expect(row.classList.contains("border")).toBe(true);
      expect(row.classList.contains("border-gray-400")).toBe(true);
      expect(row.classList.contains("dark:border-gray-500")).toBe(true);
      expect(row.classList.contains("min-h-[72px]")).toBe(true);
    }
  });

  it("groups active categories under Expenses and Income Categories, keeping inactive rows separate", () => {
    renderUI(<CategoriesPage />);
    const expenses = within(screen.getByRole("heading", { name: "Expenses" }).parentElement!);
    const income = within(
      screen.getByRole("heading", { name: "Income Categories" }).parentElement!
    );
    expect(expenses.getByRole("button", { name: /Food/ })).toBeTruthy();
    expect(expenses.queryByText("Salary")).toBeNull();
    expect(income.getByRole("button", { name: /Salary/ })).toBeTruthy();
    expect(income.queryByText("Food")).toBeNull();
    expect(income.queryByText("Old Salary")).toBeNull();
    expect(
      within(screen.getByRole("heading", { name: "Inactive" }).parentElement!).getByText(
        "Old Salary"
      )
    ).toBeTruthy();
  });

  it("does not wrap active categories in swipe-to-disable cards, but retains inactive activation", async () => {
    renderUI(<CategoriesPage />);
    expect(SwipeableCard).toHaveBeenCalledTimes(1);
    const props = vi.mocked(SwipeableCard).mock.calls[0][0];
    expect(props.actionLabel).toBe("Active");
    expect(props.actionColor).toBe("green");
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    expect(screen.getByRole("dialog", { name: "Edit Category" })).toBeTruthy();
    expect(mocks.activateCategory).not.toHaveBeenCalled();
    await props.onSwipeAction();
    expect(mocks.activateCategory).toHaveBeenCalledWith("old-salary", "user");
  });

  it.each(["create", "edit"] as const)(
    "saves the income toggle through the %s service",
    async (mode) => {
      renderUI(<CategoriesPage />);
      fireEvent.click(screen.getByRole("button", { name: mode === "create" ? "Create" : /Food/ }));
      const dialog = within(screen.getByRole("dialog"));
      fireEvent.click(dialog.getByRole("button", { name: "Income" }));
      fireEvent.change(dialog.getByLabelText(/Name/), { target: { value: "Salary" } });
      fireEvent.change(dialog.getByLabelText("Emoji"), { target: { value: "$" } });
      fireEvent.click(dialog.getByRole("button", { name: mode === "create" ? "Create" : "Save" }));
      const service = mode === "create" ? mocks.createCategory : mocks.updateCategory;
      await waitFor(() =>
        expect(service).toHaveBeenCalledWith({
          ...(mode === "edit" ? { categoryId: "food" } : {}),
          userId: "user",
          emoji: "$",
          name: "Salary",
          type: "income",
          currentLang: "en",
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mocks.clearCatCache).toHaveBeenCalledWith("user");
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    }
  );
});

describe("CategoryEditModal income toggle regressions", () => {
  it("initializes an income edit and saves its type without toggling", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderUI(
      <CategoryEditModal
        isOpen
        onClose={onClose}
        category={salary}
        currentLang="en"
        onSave={onSave}
      />
    );
    expect(screen.getByRole("button", { name: "Income" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ emoji: "$", name: "Salary", type: "income" })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets an income edit to the expense default when opening a new category", () => {
    const props = { isOpen: true, onClose: vi.fn(), currentLang: "en" as const, onSave: vi.fn() };
    const { rerender } = renderUI(<CategoryEditModal {...props} category={salary} />);
    rerender(
      <I18nextProvider i18n={i18n}>
        <CategoryEditModal {...props} />
      </I18nextProvider>
    );
    expect(screen.getByRole("button", { name: "Expense" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe("");
  });
});

describe("TransactionForm income category regressions", () => {
  it("shows a category dropdown for income with only active categories of the selected type", () => {
    renderUI(<TransactionForm userId="user" />);
    expect(screen.getByRole("option", { name: "F Food" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "$ Salary" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.getByRole("combobox", { name: /Category/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: "$ Salary" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "F Food" })).toBeNull();
    expect(screen.queryByRole("option", { name: "$ Old Salary" })).toBeNull();
  });

  it.each(["create", "update"] as const)(
    "sends the selected income category on %s",
    async (mode) => {
      const initialData: Transaction = {
        id: "tx",
        user_id: "user",
        type: "income",
        amount: 100,
        name: "Pay",
        category_id: "salary",
        created_at: 1_700_000_000_000,
      };
      renderUI(
        <TransactionForm userId="user" initialData={mode === "update" ? initialData : undefined} />
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      if (mode === "create") {
        fireEvent.click(screen.getByRole("button", { name: "Income" }));
        fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "100" } });
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pay" } });
        fireEvent.change(select, { target: { value: "salary" } });
      } else {
        expect(select.value).toBe("salary");
      }
      fireEvent.click(
        screen.getByRole("button", { name: mode === "create" ? "Create" : "Save Changes" })
      );
      const service = mode === "create" ? mocks.createTransaction : mocks.updateTransaction;
      await waitFor(() =>
        expect(service).toHaveBeenCalledWith(
          expect.objectContaining({
            ...(mode === "update" ? { id: "tx" } : {}),
            userId: "user",
            type: "income",
            categoryId: "salary",
            amount: 100,
            name: "Pay",
          })
        )
      );
      expect(service).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["create", "update"] as const)("requires an income category on %s", (mode) => {
    const initialData: Transaction = {
      id: "tx",
      user_id: "user",
      type: "income",
      amount: 100,
      name: "Pay",
      category_id: null,
      created_at: 1_700_000_000_000,
    };
    const { container } = renderUI(
      <TransactionForm userId="user" initialData={mode === "update" ? initialData : undefined} />
    );
    if (mode === "create") {
      fireEvent.click(screen.getByRole("button", { name: "Income" }));
      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "100" } });
    }
    expect(screen.getByLabelText("Category*")).toBeTruthy();
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText(messages.transactions.errors.categoryRequired)).toBeTruthy();
    expect(mocks.createTransaction).not.toHaveBeenCalled();
    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });

  it("clears selection in both type-switch directions, but not when clicking the current type", () => {
    renderUI(<TransactionForm userId="user" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "food" } });
    fireEvent.click(screen.getByRole("button", { name: "Expense" }));
    expect(select.value).toBe("food");
    fireEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "salary" } });
    fireEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(select.value).toBe("salary");
    fireEvent.click(screen.getByRole("button", { name: "Expense" }));
    expect(select.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Income" }));
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(mocks.createTransaction).not.toHaveBeenCalled();
  });
});
