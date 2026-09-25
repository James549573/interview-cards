/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        darkbg: '#0f1115',
        darkcard: '#1a1d23',
        darkborder: '#2a2e37',
        lightbg: '#f9fafb',
        lightcard: '#ffffff'
      }
    }
  },
  plugins: []
};
