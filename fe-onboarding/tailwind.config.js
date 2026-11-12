/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors");
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./commonComponents/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: ["text-yellow-500", "text-red-600"],
  theme: {
    extend: {
      colors: {
        "grays-white": "#fff",
        primary: "#514ceb",
        secondarymirage: "#181729",
        secondarywildsand: "#f6f6f6",
        secondarypaleorange: "#ffe9e0",
        secondarylimegreen: "#e6fbf5",
        secondarylightgrayishblue: "#e9e9f9",
        secondarylightgrayish: "#EAEAEA",
        gray: "#767678",
        white: "#ffffff",
        steelblue: "#3089ab",
        darkgray: {
          100: "#b3b3b3",
          200: "#9c9999",
        },
        "grays-black": "#000",
        orange: {
          100: "#ffa503",
          200: "#ffa500",
        },
        darkred: "#DC3545",
        gray1: "#A9A9A9",

        limegreen: "#0cca4a",
        lightgray: "#cfcfcf",
        aliceblue: "#d6f1fe",
        lightblue: "#bdd9e6",
        // gray: "#fafafa",
        "schemes-on-surface": "#1d1b20",
        "border-default-default": "#d9d9d9",
        "text-default-default": "#1e1e1e",
        "text-default-tertiary": "#b3b3b3",
      },
      spacing: {
        "space-400": "16px",
        "space-300": "12px",
        "space-200": "8px",
        "padding-sm": "8px",
      },
      fontFamily: {
        poppins: "Poppins",
        "display-sm-semibold": "Inter",
        "body-base": "Inter",
        jakarta: ["Plus Jakarta Sans", "sans-serif"],
      },
      borderRadius: {
        "3xs": "10px",
        "radius-200": "8px",
      },
    },
    fontSize: {
      xxs: "10px",
      xs: "12px",
      s: "14px",
      base: "16px",
      xl: "20px",
      "6xl": "25px",
      "5xs": "8px",
      "8xs": "5px",
      lg: "18px",
      "11xl": "30px",
      "5xl": "24px",
      inherit: "inherit",
      heading: "22px",
      "20xl": "48px",
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",

      mq1300: { raw: "screen and (max-width: 1300px)" },
      mq1024: { raw: "screen and (max-width:1024px)" },
      mq900: { raw: "screen and (max-width: 900px)" },
      mq761: { raw: "screen and (max-width: 761px)" },
      mq726: { raw: "screen and (max-width: 726px)" },
      mq450: { raw: "screen and (max-width: 450px)" },
      mq363: { raw: "screen and (max-width: 363px)" },
      mq318: { raw: "screen and (max-width: 318px)" },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [
    function ({ addComponents, addUtilities }) {
      addComponents({
        'input[type="number"]::-webkit-outer-spin-button': {
          appearance: "none",
        },
        'input[type="number"]::-webkit-inner-spin-button': {
          appearance: "none",
        },
        'input[type="number"]': {
          MozAppearance: "textfield", // Firefox
        },
      });
      // Add or override cursor and pointer utility classes globally
      addUtilities(
        {
          ".pointer-events-none": {
            "pointer-events": "none !important",
          },
          ".cursor-not-allowed": {
            cursor: "not-allowed !important",
            opacity: "0.6", // Optional global visual cue
          },
        },
        ["responsive", "hover"],
      );
    },
  ],
};
