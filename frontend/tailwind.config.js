/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        cbd:       '#FF4444',
        waterfront:'#4488FF',
        industrial:'#FFCC00',
        slums:     '#AA2222',
        suburbs:   '#996633',
      },
    },
  },
  plugins: [],
}
