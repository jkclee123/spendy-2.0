import { describe, expect, it } from "vitest";
import { RATIO_CHART_COLORS } from "@/lib/ratioPalette";

describe("ratio chart palette", () => {
  it("contains 16 unique swatches", () => {
    expect(RATIO_CHART_COLORS).toHaveLength(16);
    expect(new Set(RATIO_CHART_COLORS).size).toBe(16);
  });

  it("uses 6-digit hex notation throughout", () => {
    for (const color of RATIO_CHART_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
