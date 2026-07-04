// Backend API base URL.
// Dev points at the local Rails app on :3060; prod at the public site
// reverseimage.app (registered; Rails app not yet deployed there).
export const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3060'
  : 'https://reverseimage.app';
