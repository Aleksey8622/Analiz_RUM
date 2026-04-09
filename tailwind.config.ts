import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        delekto: {
          50: '#f6f4fb',
          100: '#efeaff',
          200: '#d9d1ee',
          300: '#bba8f3',
          400: '#9b7df0',
          500: '#6f4bd8',
          600: '#5635b8',
          700: '#402580',
          800: '#2b1b59',
          900: '#221a35'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
