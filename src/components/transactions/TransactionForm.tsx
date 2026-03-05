import { useState, FormEvent, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction, UserCategory } from "@/types";
import { Button } from "@/components/ui/Button";
import { CategoryDropdown } from "@/components/ui/CategoryDropdown";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/lib/auth";
import * as transactionService from "@/lib/services/transactions";
import * as categoryService from "@/lib/services/categories";

function evaluateFormula(formula: string): number | null {
  const sanitized = formula.replace(/\s/g, "");
  const normalized = sanitized.replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[\d+\-*/.]+$/.test(normalized)) return null;
  if (/[+*/]{2,}/.test(normalized) || /[+\-*/]$/.test(normalized) || /^[*/]/.test(normalized))
    return null;
  const parts = normalized.split(/[+\-*/]/);
  for (const part of parts) {
    if (part.split(".").length > 2) return null;
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function("return " + normalized)();
    if (typeof result !== "number" || !isFinite(result) || isNaN(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

function parseDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  ).getTime();
}

function formatDatetimeLocal(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day, hours, minutes] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
  return new Intl.DateTimeFormat(locale === "zh-HK" ? "zh-Hant-HK" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

interface FormErrors {
  amount?: string;
  name?: string;
  category?: string;
  general?: string;
}

interface TransactionFormProps {
  userId: string;
  initialData?: Transaction;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TransactionForm({
  userId,
  initialData,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const { t } = useTranslation("transactions");
  const { t: tCommon } = useTranslation("common");

  const isEditMode = !!initialData;

  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [type, setType] = useState<"expense" | "income">(initialData?.type ?? "expense");
  const [amount, setAmount] = useState(initialData ? initialData.amount.toString() : "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<string | undefined>(
    initialData?.category_id ?? undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [createdAt, setCreatedAt] = useState<string>("");
  const [dateModified, setDateModified] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(true);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories
  useEffect(() => {
    if (userId) {
      categoryService
        .listActiveByUser(userId)
        .then(setCategories)
        .catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouchDevice(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const formatToDatetimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      setName(initialData.name || "");
      setCategory(initialData.category_id ?? undefined);
      setCreatedAt(formatToDatetimeLocal(initialData.created_at));
      setDateModified(false);
    } else {
      setAmount("");
      setName("");
      setCategory(undefined);
      setCreatedAt(formatToDatetimeLocal(Date.now()));
      setDateModified(false);
    }
    setErrors({});
  }, [initialData]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!amount.trim()) {
      newErrors.amount = t("errors.amountRequired");
    } else {
      const evaluatedAmount = evaluateFormula(amount);
      if (evaluatedAmount === null) newErrors.amount = t("errors.amountInvalid");
      else if (evaluatedAmount <= 0) newErrors.amount = t("errors.amountTooSmall");
      else if (evaluatedAmount > 1000000000) newErrors.amount = t("errors.amountTooLarge");
    }
    if (type === "expense" && !category) newErrors.category = t("errors.categoryRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, category, t, type]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userId) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const evaluatedAmount = evaluateFormula(amount);
      if (evaluatedAmount === null) {
        setErrors({ amount: t("errors.amountInvalid") });
        setIsSubmitting(false);
        return;
      }

      const timezoneOffset = -new Date().getTimezoneOffset();

      if (isEditMode && initialData) {
        const parsedTimestamp = createdAt ? parseDatetimeLocal(createdAt) : initialData.created_at;
        await transactionService.updateTransaction({
          id: initialData.id,
          userId,
          amount: evaluatedAmount,
          name,
          categoryId: type === "income" ? undefined : category,
          type,
          createdAt: parsedTimestamp ?? initialData.created_at,
          timezoneOffset,
        });
        showToast(t("successMessages.updated"), "success");
      } else {
        const createdAtTimestamp = dateModified ? (parseDatetimeLocal(createdAt) ?? Date.now()) : Date.now();
        await transactionService.createTransaction({
          userId,
          amount: evaluatedAmount,
          name,
          categoryId: type === "income" ? undefined : category,
          type,
          createdAt: createdAtTimestamp,
          timezoneOffset,
        });

        setAmount("");
        setName("");
        setCategory(undefined);
        setCreatedAt(formatToDatetimeLocal(Date.now()));
        setDateModified(false);
        showToast(t("successMessages.created"), "success");
      }

      onSuccess?.();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(isEditMode ? "Failed to update:" : "Failed to create:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : isEditMode
            ? t("errors.updateFailed")
            : t("errors.createFailed");
      setErrors({ general: errorMessage });
      showToast(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.general && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
          {errors.general}
        </div>
      )}

      {/* Type Selector */}
      <div className="flex rounded-lg overflow-hidden border border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400">
        <button
          type="button"
          onClick={() => {
            setType("expense");
            if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
          }}
          disabled={isSubmitting}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors duration-200 ${type === "expense" ? "bg-black text-gray-50 dark:bg-white dark:text-gray-950" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"} disabled:cursor-not-allowed disabled:opacity-20`}
        >
          {t("expense")}
        </button>
        <button
          type="button"
          onClick={() => {
            setType("income");
            if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
          }}
          disabled={isSubmitting}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors duration-200 ${type === "income" ? "bg-black text-gray-50 dark:bg-white dark:text-gray-950" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"} disabled:cursor-not-allowed disabled:opacity-20`}
        >
          {t("income")}
        </button>
      </div>

      {/* Amount Field */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t("amount")} <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            $
          </span>
          <input
            ref={amountInputRef}
            type="text"
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            placeholder={t("amountPlaceholder")}
            disabled={isSubmitting}
            className={`w-full min-w-0 rounded-xl border bg-white py-3 pl-8 pr-10 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-950 disabled:text-gray-500 focus:outline-none ${errors.amount ? "border-red-500" : "border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400"}`}
          />
          {amount && (
            <button
              type="button"
              onClick={() => {
                setAmount("");
                document.getElementById("amount")?.focus();
              }}
              disabled={isSubmitting}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-20"
              aria-label={t("clearAmount")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Calculator Buttons */}
        <div className="mt-2 flex items-center justify-center gap-3">
          {[
            { label: "+", char: "+", ariaKey: "addPlus" },
            { label: "-", char: "-", ariaKey: "addMinus" },
            { label: "\u00d7", char: "\u00d7", ariaKey: "addMultiply" },
            { label: "\u00f7", char: "\u00f7", ariaKey: "addDivide" },
          ].map(({ label, char, ariaKey }) => (
            <button
              key={char}
              type="button"
              onClick={() => {
                const input = amountInputRef.current;
                if (input) {
                  const start = input.selectionStart || amount.length;
                  const newValue = amount.slice(0, start) + char + amount.slice(start);
                  setAmount(newValue);
                  input.focus();
                  setTimeout(() => {
                    input.setSelectionRange(start + 1, start + 1);
                  }, 0);
                }
              }}
              disabled={isSubmitting}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-lg font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-300 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-20"
              aria-label={t(ariaKey)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const result = evaluateFormula(amount);
              if (result !== null) {
                setAmount(result.toString());
                setErrors((prev) => ({ ...prev, amount: undefined }));
                amountInputRef.current?.focus();
              } else {
                setErrors((prev) => ({ ...prev, amount: t("errors.amountInvalid") }));
                amountInputRef.current?.focus();
              }
            }}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500 text-lg font-semibold text-white transition-colors hover:bg-accent-600 dark:hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-20"
            aria-label={t("evaluateFormula")}
          >
            =
          </button>
        </div>

        {errors.amount && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{errors.amount}</p>
        )}
      </div>

      {/* Category Field */}
      {type === "expense" && (
        <CategoryDropdown
          label={t("category")}
          placeholder={t("selectCategory")}
          required
          categories={categories}
          value={category}
          onChange={(newCategory) => {
            setCategory(newCategory);
            if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
          }}
          currentLang={lang}
          disabled={isSubmitting}
          error={errors.category}
        />
      )}

      {/* Name Field */}
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t("name")}
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder={type === "income" ? t("namePlaceholderIncome") : t("namePlaceholder")}
          disabled={isSubmitting}
          className={`w-full min-w-0 rounded-xl border bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-950 disabled:text-gray-500 focus:outline-none ${errors.name ? "border-red-500" : "border-gray-400 dark:border-gray-500 hover:border-black dark:hover:border-gray-400"}`}
        />
        {errors.name && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{errors.name}</p>
        )}
      </div>

      {/* Created At Field */}
      <div className="w-full">
        <label
          htmlFor="createdAt"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t("dateTime")}
        </label>
        {isTouchDevice ? (
          <div className="relative w-full">
            <div className="w-full min-w-0 min-h-[44px] truncate rounded-xl border bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 border-gray-400 flex items-center">
              {formatDatetimeLocal(createdAt, lang)}
            </div>
            <input
              type="datetime-local"
              id="createdAt"
              value={createdAt}
              onChange={(e) => { setCreatedAt(e.target.value); setDateModified(true); }}
              disabled={isSubmitting}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              style={{ fontSize: "16px" }}
            />
          </div>
        ) : (
          <input
            type="datetime-local"
            id="createdAt"
            value={createdAt}
            onChange={(e) => setCreatedAt(e.target.value)}
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-xl border bg-white py-3 px-4 text-base text-gray-900 dark:bg-gray-800 dark:text-gray-200 border-gray-400 dark:border-gray-600 hover:border-black dark:hover:border-gray-400 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            style={{ fontSize: "16px" }}
          />
        )}
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 text-sm sm:text-base"
          >
            {tCommon("cancel")}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting || !user}
          className="flex-1 text-sm sm:text-base"
        >
          {isSubmitting
            ? isEditMode
              ? t("saving")
              : t("creating")
            : isEditMode
              ? t("saveChanges")
              : tCommon("create")}
        </Button>
      </div>
    </form>
  );
}
