import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Inter', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#0f0f17',
          800: '#15151f',
          700: '#1c1c28',
          600: '#252532',
          500: '#32323f',
          400: '#4a4a5a',
          300: '#7a7a8a',
          200: '#a0a0b0',
          100: '#d0d0db',
          50: '#f0f0f5',
        },
        amber: {
          300: '#fcd34d',
          400: '#f5b544',
          500: '#eab308',
          600: '#d39a1a',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(245, 181, 68, 0.35)',
        card: '0 10px 40px -15px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'radial-amber':
          'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(245, 181, 68, 0.12), transparent 60%)',
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out both',
        'rise-in': 'riseIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
