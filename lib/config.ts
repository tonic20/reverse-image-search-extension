// Backend API base URL.
// Dev points at the local Rails app on :3060; prod at the public site.
// Update the prod host once the domain / product name is settled.
export const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3060'
  : 'https://reverseimage.penzasoft.com';
