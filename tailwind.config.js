/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#007BFF', 50: '#e6f2ff', 100: '#cce5ff', 500: '#007BFF', 600: '#0066d6', 700: '#0052ad' },
        surface: '#F5F6F7',
        card: '#FFFFFF',
      },
    },
  },
  plugins: [],
}
