/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — Datadog purple
        brand: {
          DEFAULT: '#632CA6',
          light: '#7c3aed',
          dark: '#4a1d80',
          50: '#f3e8ff',
          100: '#ddd6fe',
          glow: 'rgba(99, 44, 166, 0.15)',
        },
        // Backgrounds
        background: '#1a1a2e',
        surface: {
          DEFAULT: '#1e1e32',
          light: '#252540',
          dark: '#141428',
        },
        // Semantic (keep backward compatibility)
        primary: '#632CA6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        // Sidebar
        sidebar: {
          bg: '#141428',
          hover: '#1e1e32',
          active: '#632CA620',
          border: '#2a2a45',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(99, 44, 166, 0.15)',
        'glow-md': '0 0 20px rgba(99, 44, 166, 0.2)',
        'glow-lg': '0 0 40px rgba(99, 44, 166, 0.25)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 44, 166, 0.1)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
