import type { Config } from "tailwindcss";

const config: Config = {
  // "class" (not "media") — this is what lets us override the OS
  // preference with a manual light/dark choice via the `dark` class on <html>.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;