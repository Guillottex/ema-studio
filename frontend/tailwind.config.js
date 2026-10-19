/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  safelist: ['btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger', 'btn-success', 'btn-xs', 'btn-sm', 'btn-lg'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'system-ui', 'Segoe UI', 'sans-serif'], display: ['Outfit', 'Poppins', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef0fa', 100: '#dde0f3', 200: '#bcc1e6', 300: '#8f96d2', 400: '#5f66b6', 500: '#3d4499', 600: '#282964', 700: '#212255', 800: '#1a1b45', 900: '#131433' },
        sky: { 50: '#eef8fc', 100: '#d6eff8', 200: '#b3e1f1', 300: '#8ed2e9', 400: '#76c6e2', 500: '#4fb3d6', 600: '#2f97bd', 700: '#267897', 800: '#1f5f77', 900: '#173f50' },
      },
      boxShadow: { panel: '0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.08)' },
    },
  },
  plugins: [],
};
