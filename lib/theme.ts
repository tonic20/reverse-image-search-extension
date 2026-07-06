// Design tokens mirrored from the marketing site's Tailwind @theme
// (backend/app/assets/tailwind/application.css) + Tailwind slate defaults.
// This file is the source of truth for extension styling; popup/style.css
// mirrors these same values as CSS custom properties.
export const T = {
  brand:  { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  accent: { 50: '#f0fdfa', 100: '#ccfbf1', 600: '#0d9488', 700: '#0f766e' }, // teal
  slate:  { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
            400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 900: '#0f172a' },
  radius: { sm: '8px', md: '12px', lg: '16px', pill: '9999px' },
  shadow: {
    sm:    '0 1px 2px rgba(15,23,42,.06)',
    md:    '0 4px 14px rgba(15,23,42,.10)',
    card:  '0 20px 60px rgba(15,23,42,.28)',
    brand: '0 1px 2px rgba(79,70,229,.20)',
  },
  font: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
} as const;
