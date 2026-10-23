/**
 * API base URL.
 *
 * On Render the FastAPI service also serves the built SPA, so the default
 * same-origin `/api` is correct. On GitHub Pages the static build can point at
 * a separately deployed backend with VITE_API_URL, e.g.
 *   VITE_API_URL=https://q-matrix.onrender.com
 */
const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

export const API_BASE = configured
  ? `${configured.replace(/\/+$/, '')}/api`
  : '/api'

/** True when the static build has no backend configured. */
export const HAS_REMOTE_API = Boolean(configured)
