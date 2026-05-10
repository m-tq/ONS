/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        ui:   ['Tahoma', 'Arial', 'sans-serif'],
        mono: ['"Fira Code"', 'SF Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      colors: {
        oct: {
          bg:          'var(--oct-color-bg)',
          text:        'var(--oct-color-text)',
          surface:     'var(--oct-color-surface)',
          'surface-soft': 'var(--oct-color-surface-soft)',
          header:      'var(--oct-color-header)',
          border:      'var(--oct-color-border)',
          'border-strong': 'var(--oct-color-border-strong)',
          primary:     'var(--oct-color-primary)',
          'primary-soft': 'var(--oct-color-primary-soft)',
          muted:       'var(--oct-color-muted)',
          success:     'var(--oct-color-success)',
          warning:     'var(--oct-color-warning)',
          'warning-bg': 'var(--oct-color-warning-bg)',
          danger:      'var(--oct-color-danger)',
          'danger-bg': 'var(--oct-color-danger-bg)',
          code:        'var(--oct-color-code-bg)',
          'code-text': 'var(--oct-color-code-text)',
          private:     'hsl(170 100% 45%)',
        },
      },
      borderRadius: {
        DEFAULT: '0',
      },
    },
  },
  plugins: [],
}
