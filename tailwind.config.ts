import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f1f1f",
        paper: "#f5f7fa",
        accent: "#1677ff",
        line: "#e5e7eb"
      },
      boxShadow: {
        card: "0 20px 45px rgba(18, 32, 47, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
