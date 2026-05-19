/**
 * Returns the base URL for all API calls.
 * - In development: empty string (Vite proxies /api/* to localhost:3001)
 * - In production: VITE_API_URL set as Azure Static Web App environment variable
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
