import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          300: "#6fd3f1",
          400: "#2EB5E2",
          500: "#1191BF",
          600: "#1279A8",
          700: "#156289",
        },
      },
      fontFamily: {
        "dancing-script": ["var(--font-dancing-script)"],
      },
    },
  },
  plugins: [],
};
export default config;
