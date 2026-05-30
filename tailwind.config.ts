import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0b0d10", elevated: "#13161b", chrome: "#0f1115" },
        fg: { DEFAULT: "#e6e8eb", muted: "#9aa3ad", subtle: "#6b7480" },
        accent: { DEFAULT: "#3b82f6", hover: "#2563eb" },
        success: { DEFAULT: "#10b981", muted: "#10b98120" },
        warning: { DEFAULT: "#f59e0b", muted: "#f59e0b20" },
        danger: { DEFAULT: "#ef4444", muted: "#ef444420" },
        info: { DEFAULT: "#3b82f6", muted: "#3b82f620" },
        border: { DEFAULT: "#23272d", strong: "#2c3138" },
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "12px" },
    },
  },
  plugins: [],
};
export default config;
