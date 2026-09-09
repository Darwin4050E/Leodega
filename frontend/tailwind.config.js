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
        // Brand scale for the admin moderation dossier (SDD
        // admin-moderation-visual-fidelity). Purely additive — leodega_p,
        // primary and secondary above are untouched, other screens rely
        // on them.
        leodega: {
          50: '#F5F3FF',
          200: '#E2DBFF',
          300: '#CFC4FF',
          600: '#7551E9',
          700: '#4C2FA8',
          900: '#3B2A6B',
        },
      },
      // Tailwind v3 ships only `aspect-square` and `aspect-video` (16/9).
      // The moderation map wants something between the two, so the ratio
      // lives here as a token rather than as a one-off arbitrary value.
      aspectRatio: {
        '4/3': '4 / 3',
      },
    },
  },
  plugins: [],
}
