/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './index.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        noir: '#09090b',
        neon: {
          DEFAULT: '#22d3ee',
          glow: '#06b6d4',
        },
      },
      boxShadow: {
        neon: '0 0 24px rgba(34, 211, 238, 0.14)',
      },
    },
  },
  plugins: [],
};
