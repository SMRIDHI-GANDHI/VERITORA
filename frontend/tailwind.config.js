/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        espresso: 'rgb(var(--color-espresso) / <alpha-value>)',
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        caramel: 'rgb(var(--color-caramel) / <alpha-value>)',
        latte: 'rgb(var(--color-latte) / <alpha-value>)',
        mocha: 'rgb(var(--color-mocha) / <alpha-value>)',
        sage: 'rgb(var(--color-sage) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface-2) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        heading: 'rgb(var(--color-heading) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        accent2: 'rgb(var(--color-accent-2) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        buttonBg: 'rgb(var(--color-button-bg) / <alpha-value>)',
        buttonText: 'rgb(var(--color-button-text) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

