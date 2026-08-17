/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e0ff',
          300: '#89ccff',
          400: '#52adff',
          500: '#2b8aff',
          600: '#1367f6',
          700: '#0d50e2',
          800: '#1141b7',
          900: '#143b8f',
          950: '#102457',
        },
        telecom: {
          gold: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#d97706',
          slate: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
