import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jungle: {
          50: '#f2f8f4',
          100: '#dcefe2',
          200: '#bbdec8',
          300: '#8dc5a4',
          400: '#5ba57c',
          500: '#3a875f',
          600: '#2a6c4b',
          700: '#22563d',
          800: '#1d4532',
          900: '#19392b',
        },
        sand: {
          50: '#faf8f3',
          100: '#f2ede1',
          200: '#e5dac2',
          300: '#d3c19b',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Hiragino Sans', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
