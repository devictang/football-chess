/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'pitch': '#2d8a4e',
        'pitch-light': '#3ba15c',
        'pitch-dark': '#1e6b38',
      },
    },
  },
  plugins: [],
};
