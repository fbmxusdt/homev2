/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#F5A623',
          amber: '#E8941A',
          dark: '#0A0C10',
          surface: '#10141C',
          card: '#161B27',
          border: '#1E2535',
          muted: '#8892A4',
          green: '#00D4AA',
          red: '#FF4D6D',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #F5A623 0%, #E8941A 50%, #C8770E 100%)',
        'dark-gradient': 'linear-gradient(180deg, #10141C 0%, #0A0C10 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(245,166,35,0.05) 0%, rgba(0,0,0,0) 100%)',
        'glow': 'radial-gradient(ellipse at center, rgba(245,166,35,0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(245, 166, 35, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'gold': '0 0 20px rgba(245, 166, 35, 0.3)',
        'gold-lg': '0 0 40px rgba(245, 166, 35, 0.2)',
        'inner-gold': 'inset 0 1px 0 rgba(245, 166, 35, 0.1)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
