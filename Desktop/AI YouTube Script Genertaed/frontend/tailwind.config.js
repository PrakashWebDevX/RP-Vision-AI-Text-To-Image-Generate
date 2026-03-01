/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#030712',
        'brand-accent': '#38bdf8',
        'brand-muted': '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 20px 45px -20px rgba(56,189,248,.45)',
      },
    },
  },
  plugins: [],
}
