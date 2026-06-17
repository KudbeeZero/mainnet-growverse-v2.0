import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Set by next/font in layout.tsx; falls back to system stacks.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        grow: {
          50: "#f1fae9",
          100: "#dcf3c4",
          200: "#bde88c",
          300: "#97d84f",
          400: "#76c024",
          500: "#5aa015",
          600: "#447d0f",
          700: "#356010",
          800: "#2c4c13",
          900: "#274014",
        },
        ink: {
          950: "#070a0e",
          900: "#0d1117",
          800: "#161b22",
          700: "#21262d",
          600: "#30363d",
          500: "#484f58",
        },
        // Secondary data/analysis accent (instrument readouts, links, charts).
        accent: {
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        // Tertiary genetics accent (DNA hubs, breeding).
        violet: {
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
        },
      },
      boxShadow: {
        "glow-grow": "0 0 12px rgba(118,192,36,0.45), 0 0 32px rgba(118,192,36,0.18)",
        "glow-accent": "0 0 12px rgba(56,189,248,0.45), 0 0 32px rgba(56,189,248,0.18)",
        "glow-soft": "0 0 0 1px rgba(118,192,36,0.15), 0 8px 30px rgba(0,0,0,0.5)",
      },
      keyframes: {
        twinkle: {
          "0%,100%": { opacity: "0.15" },
          "50%": { opacity: "0.55" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(118,192,36,0.45)" },
          "70%": { boxShadow: "0 0 0 8px rgba(118,192,36,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(118,192,36,0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        twinkle: "twinkle 4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
