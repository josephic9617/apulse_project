/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        devops: {
          bg: '#0f172a', // Slate 900
          panel: '#1e293b', // Slate 800
          border: '#334155', // Slate 700
          accent: '#10b981', // Emerald 500
          accentGlow: 'rgba(16, 185, 129, 0.4)',
          text: '#f8fafc',
          muted: '#94a3b8'
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', '"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
