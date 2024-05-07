/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // Our color palette
      // --blue: #3b89c7;
      // --gray: #5a5a4e;
      // --midGray: #a3a295;
      // --lightGray: #d8d8d4;
      // --darkBlue: #023142;
      // --yellow: #c98d09;

      colors: {
        'steel-blue': {
          50: '#f3f7fc',
          100: '#e6eff8',
          200: '#c7ddf0',
          300: '#95c1e4',
          400: '#5c9fd4',
          500: '#3b89c7',
          600: '#2768a2',
          700: '#205384',
          800: '#1f486d',
          900: '#1e3d5c',
          950: '#14283d',
        },
        // TODO use https://uicolors.app/create to generate below as is done above
        'pibox-gray': {
          300: '#d8d8d4',
          500: '#a3a295',
          700: '#5a5a4e',
        },
        'pibox-dark-blue': {
          500: '#023142',
        },
        'pibox-yellow': {
          500: '#c98d09',
        },
      },
      container: {
        // default breakpoints but with 40px removed
        screens: {
          sm: '600px',
          md: '728px',
          lg: '800px',
          xl: '800px',
          '2xl': '800px',
        },
      },
    },
  },
  plugins: [],
}
