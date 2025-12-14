/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Language colors
        'lang-js': '#f7df1e',
        'lang-ts': '#3178c6',
        'lang-python': '#3776ab',
        // Role colors
        'role-component': '#61dafb',
        'role-utility': '#10b981',
        'role-service': '#8b5cf6',
        'role-model': '#f59e0b',
        'role-config': '#6b7280',
        'role-test': '#ef4444',
      },
    },
  },
  plugins: [],
}
