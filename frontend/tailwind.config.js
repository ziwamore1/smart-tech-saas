/** @type {import("tailwindcss").Config} */
export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      colors: {
        primary: "#4F46E5",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};