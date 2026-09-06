import { describe, expect, it } from "vitest";
import { EXPENSE_RATIO_COLORS } from "@/lib/expensePalette";

describe("expense ratio palette", () => {
  it("contains 14 unique hue-ordered swatches", () => {
    expect(EXPENSE_RATIO_COLORS).toHaveLength(14);
    expect(new Set(EXPENSE_RATIO_COLORS).size).toBe(14);
  });

  it("keeps the existing order while adding Flamingo and Rosewater", () => {
    expect(EXPENSE_RATIO_COLORS.slice(0, 6)).toEqual([
      "#8839ef",
      "#d20f39",
      "#e64553",
      "#dd7878",
      "#dc8a78",
      "#fe640b",
    ]);
  });
});
