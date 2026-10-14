import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        decodeai: {
          primary: '#6366f1',
          accent: '#22d3ee',
        },
      },
    },
  },
  plugins: [],
};

export default config;
