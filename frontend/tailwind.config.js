/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'var(--bg)',
        surface:  'var(--surface)',
        elevated: 'var(--elevated)',
        t1: 'var(--txt-1)',
        t2: 'var(--txt-2)',
        t3: 'var(--txt-3)',
        t4: 'var(--txt-4)',
        t5: 'var(--txt-5)',
        accent: {
          DEFAULT: '#0A84FF',
          hover:   '#0976E3',
          muted:   'rgba(10,132,255,0.12)',
        },
        success: {
          DEFAULT: '#32D74B',
          muted:   'rgba(50,215,75,0.12)',
        },
        warning: {
          DEFAULT: '#FFD60A',
          muted:   'rgba(255,214,10,0.12)',
        },
        danger: {
          DEFAULT: '#FF453A',
          muted:   'rgba(255,69,58,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['12px', { lineHeight: '18px' }],
        'xs':  ['13px', { lineHeight: '20px' }],
        'sm':  ['15px', { lineHeight: '22px' }],
        'base':['16px', { lineHeight: '24px' }],
        'md':  ['17px', { lineHeight: '24px' }],
        'lg':  ['19px', { lineHeight: '28px' }],
        'xl':  ['23px', { lineHeight: '32px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.22s ease-out',
        'spin-slow':'spin 1.2s linear infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
