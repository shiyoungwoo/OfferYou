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
        ink: "#12202f",
        paper: "#f7f5ef",
        accent: "#155eef",
        line: "#d5ddea"
      },
      boxShadow: {
        card: "0 20px 45px rgba(18, 32, 47, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
