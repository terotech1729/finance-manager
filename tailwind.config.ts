import type { Config } from "tailwindcss";

/**
 * JARVIS HUD palette.
 *
 * The semantic names (bg / fg / accent / success …) are deliberately unchanged so every
 * existing page picks up the new theme without edits — only the values moved. `hud.*`
 * adds the few raw tokens the HUD primitives need directly.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy, not black — black kills the holographic depth.
        bg: { DEFAULT: "#060C18", elevated: "#0A1322", chrome: "#081021" },
        fg: { DEFAULT: "#D6E9FB", muted: "#7B93AD", subtle: "#4E6076" },
        accent: { DEFAULT: "#00CFFF", hover: "#4DDFFF" },
        success: { DEFAULT: "#00E6A8", muted: "#00E6A81f" },
        warning: { DEFAULT: "#FFB454", muted: "#FFB4541f" }, // Stark gold
        danger: { DEFAULT: "#FF3C3C", muted: "#FF3C3C1f" },
        info: { DEFAULT: "#00CFFF", muted: "#00CFFF1f" },
        border: { DEFAULT: "#14283E", strong: "#1E3C5A" },
        hud: {
          cyan: "#00CFFF",
          teal: "#00FFF7",
          gold: "#FFB454",
          red: "#FF3C3C",
          deep: "#060C18",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        // One mono face, committed to — all readouts and labels use it.
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "JetBrains Mono", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { sm: "2px", md: "3px", lg: "4px", xl: "6px" },
      boxShadow: {
        hud: "0 0 0 1px rgba(0,207,255,0.10), 0 0 24px -8px rgba(0,207,255,0.30)",
        "hud-strong": "0 0 0 1px rgba(0,207,255,0.25), 0 0 36px -6px rgba(0,207,255,0.45)",
      },
      keyframes: {
        sweep: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        flicker: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.82" } },
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        sweep: "sweep 7s linear infinite",
        "sweep-slow": "sweep 18s linear infinite",
        flicker: "flicker 3.5s ease-in-out infinite",
        rise: "rise 0.35s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
