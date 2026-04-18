import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0F",
        paper: "#FAFAF7",
        cream: "#F4EFE6",
        spoon: "#FF6A3D",
        mint: "#9FE5C6",
        lilac: "#B6A4F0",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px -16px rgba(11, 11, 15, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
