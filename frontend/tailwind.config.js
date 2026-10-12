/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F1F4F8',
        },
        'text-primary': '#202632',
        'text-secondary': '#667085',
        'text-muted': '#8A94A6',
        border: '#E4E7EC',
        accent: {
          DEFAULT: '#4263EB',
          hover: '#364FC7',
          light: '#EEF2FF',
        },
        success: {
          DEFAULT: '#16A34A',
          bg: '#DCFCE7',
          text: '#15803D',
        },
        warning: {
          DEFAULT: '#D97706',
          bg: '#FEF3C7',
          text: '#B45309',
        },
        critical: {
          DEFAULT: '#DC2626',
          bg: '#FEE2E2',
          text: '#B91C1C',
        },
        info: {
          DEFAULT: '#0284C7',
          bg: '#E0F2FE',
          text: '#0369A1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(16, 24, 40, 0.1), 0 1px 2px -1px rgba(16, 24, 40, 0.1)',
        md: '0 4px 6px -1px rgba(16, 24, 40, 0.1), 0 2px 4px -2px rgba(16, 24, 40, 0.1)',
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      }
    },
  },
  plugins: [],
}
