import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stage colors — tuned for the Idea → Design → Build → Ship flow.
        // Soft pastels so cards stay readable; columns get the saturation.
        stage: {
          idea: "#fef9c3",   // soft amber — early thinking
          design: "#e0e7ff", // indigo wash — shaping
          build: "#ede9fe",  // violet wash — hands on keys
          test: "#fce7f3",   // soft pink — verifying
          ship: "#d1fae5",   // mint — done
        },
        brand: {
          DEFAULT: "#0b1020", // deep ink
          ink: "#0b1020",
          accent: "#6366f1",  // indigo — feels like a modern dev product
          accentMuted: "#eef2ff",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
        cardHover: "0 4px 8px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.06)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
