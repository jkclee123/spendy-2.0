/**
 * 16 ratio-chart slice colors, ordered by hue: an open arc running from purple
 * (300°) forward around the wheel to blue (260°). Generated in OKLCH at a
 * constant lightness (0.62) with chroma pushed to the sRGB gamut edge, so
 * neighbouring slices stay equally readable.
 */
export const RATIO_CHART_COLORS = [
  "#9769dc", // 300° purple
  "#b35ec3", // 321° magenta
  "#c855a1", // 343°
  "#d5517a", // 4° pink
  "#da534e", // 25° red
  "#d55d08", // 47° orange
  "#bb7400", // 68°
  "#a48103", // 89° yellow
  "#8b8d00", // 111°
  "#5d9a07", // 132° olive
  "#02a056", // 153° green
  "#089c82", // 175°
  "#0b999b", // 196° teal
  "#0696b1", // 217° cyan
  "#0590cf", // 239°
  "#4483eb", // 260° blue
] as const;
