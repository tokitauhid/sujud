/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    borderRadius: {
      none: "0px",
      sm: "0px",
      DEFAULT: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      "2xl": "0px",
      "3xl": "0px",
      full: "0px",
    },
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
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Text'",
          "'SF Pro Display'",
          "'Segoe UI'",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        none: "none",
        "bronze-sm": "none",
        bronze: "none",
        "bronze-lg": "none",
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
