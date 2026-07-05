// Backend API base URL.
// Override with VITE_API_BASE to point the dev build at any backend, e.g.
// verify the dev extension against production:
//   VITE_API_BASE=https://reverseimage.app npm run dev
// Otherwise: dev → local Rails on :3060, prod build → https://reverseimage.app (live).
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (import.meta.env.DEV ? 'http://localhost:3060' : 'https://reverseimage.app');
