/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bronze: {
          50: "#FDF8F5",
          100: "#F8EDE6",
          200: "#EED5C5",
          300: "#E0AC8C",
          400: "#CC9374",
          500: "#B5876E",
          600: "#976C55",
          700: "#725A4C",
          800: "#4A3931",
          900: "#24201E",
        },
      },
      fontFamily: {
        sans: [
          "'Plus Jakarta Sans'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        "bronze-sm": "0 1px 3px rgba(181, 135, 110, 0.12)",
        bronze: "0 4px 14px rgba(181, 135, 110, 0.15)",
        "bronze-lg": "0 10px 30px rgba(181, 135, 110, 0.2)",
      },
      padding: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-right": "env(safe-area-inset-right)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
      },
    },
  },
  plugins: [],
};
