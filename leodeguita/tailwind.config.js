/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        leodega_p: 'rgba(117, 81, 233, 1)',
        primary: '#6C63FF',
        secondary: '#FEC107',
        // Leodeguita design tokens (from the Leodega prototype `L` palette).
        lg: {
          primary: '#7551E9',
          'primary-strong': '#6342D6',
          soft: '#F5F3FF',
          p100: '#EDE9FE',
          ink: '#111827',
          t2: '#374151',
          t3: '#6B7280',
          t4: '#9CA3AF',
          line: '#E5E7EB',
          line2: '#D1D5DB',
          hair: '#F3F4F6',
          bg: '#F5F6FA',
          ok: '#16A34A',
          'ok-bg': '#DCFCE7',
          warn: '#CA8A04',
          'warn-bg': '#FEF9C3',
          err: '#DC2626',
          'err-bg': '#FEE2E2',
          info: '#3B82F6',
          'info-bg': '#DBEAFE',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
