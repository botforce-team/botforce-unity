import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background layers - professional dark slate
        background: {
          DEFAULT: '#0f1419',      // Main app background
          secondary: '#151b23',    // Sidebar, secondary areas
          elevated: '#1c242e',     // Cards, modals
          hover: '#242d3a',        // Hover states
        },
        // Surface colors for interactive elements
        surface: {
          DEFAULT: '#1c242e',
          hover: '#252f3c',
          active: '#2d3848',
          border: '#2d3848',
        },
        // Border colors - subtle but visible
        border: {
          DEFAULT: '#2d3848',
          subtle: '#232b36',
          focus: '#4a7dfc',
        },
        // Text hierarchy
        text: {
          primary: '#f0f4f8',      // Main text - off-white for less eye strain
          secondary: '#94a3b8',    // Secondary text - muted
          muted: '#64748b',        // Tertiary text - very muted
          inverse: '#0f1419',      // Text on light backgrounds
        },
        // Primary brand color - professional blue
        primary: {
          DEFAULT: '#4a7dfc',
          hover: '#5d8cfd',
          active: '#3a6ae8',
          muted: 'rgba(74, 125, 252, 0.15)',
          foreground: '#ffffff',
        },
        // Status colors - muted but clear
        success: {
          DEFAULT: '#22c55e',
          muted: 'rgba(34, 197, 94, 0.15)',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: 'rgba(245, 158, 11, 0.15)',
          foreground: '#0f1419',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: 'rgba(239, 68, 68, 0.15)',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#06b6d4',
          muted: 'rgba(6, 182, 212, 0.15)',
          foreground: '#ffffff',
        },
        // Accent for highlights and special elements
        accent: {
          DEFAULT: '#8b5cf6',
          muted: 'rgba(139, 92, 246, 0.15)',
        },
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'base': ['0.875rem', { lineHeight: '1.5rem' }],
        'lg': ['1rem', { lineHeight: '1.75rem' }],
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem', { lineHeight: '2rem' }],
        '3xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(74, 125, 252, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
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
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
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

export default config
