/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        leodega_p: 'rgba(117, 81, 233, 1)',
        primary: "#6C63FF",
        secondary: "#FEC107",
      }
    },
  },
  plugins: [],
}
