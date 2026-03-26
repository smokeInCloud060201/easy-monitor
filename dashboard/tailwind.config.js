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
          hover: '#7B3FCF',
          active: '#4B1F7A',
          light: '#F3ECFB',
          glow: 'rgba(99, 44, 166, 0.15)',
        },
        // Backgrounds (Datadog Theme)
        background: 'var(--color-bg-base)',
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          light: 'var(--color-bg-surface-light)',
          dark: 'var(--color-bg-base)', // Reused for deep spots
        },
        // Typography (Datadog Hierarchy)
        text: {
          primary: 'var(--color-text-primary)',
          inverse: 'var(--color-text-inverse)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        // Borders (Datadog Subtlety)
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-text-muted)',
          dark: 'var(--color-border)',
        },
        // Semantic (Status Colors)
        primary: '#632CA6',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        // Sidebar Overrides
        sidebar: {
          bg: 'var(--color-bg-surface)',
          hover: 'var(--color-bg-surface-light)',
          active: 'rgba(99, 44, 166, 0.2)',
          border: 'var(--color-border)',
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
