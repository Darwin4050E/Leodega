# Leodeguita

Companion mobile app for Leodega, built as an installable **PWA** on the same
stack as `frontend/` (React 19 + TypeScript + Vite + Tailwind). It is a separate
Vite app and a **client of the shared Leodega REST API** — it holds no business
logic of its own.

Scope: the `HUL-01`–`HUL-06` companion flows (login, company selector, publish a
warehouse, list my warehouses, browse, detail).

## Setup

```bash
cd leodeguita
npm install
```

Create `leodeguita/.env` with the API base URL (mirror `frontend/.env`):

```
VITE_API_URL=http://localhost:8000/api
```

Run the backend (`cd backend && php artisan serve`), then:

```bash
npm run dev      # http://localhost:5174  (already whitelisted in backend CORS)
npm run build
npm test
```

## Structure

| Path | Responsibility |
|---|---|
| `src/api/client.ts` | axios instance for the shared API; attaches the bearer token |
| `src/auth/session.ts` | the only place that reads/writes the persisted session |
| `src/auth/AuthContext.tsx` | in-app session state (`token`, `user`, `setSession`, `clear`) |
| `src/routes/Protected.tsx` | redirects to `/login` when there is no session |
| `src/services/*.ts` | one function per API call |
| `src/screens/*.tsx` | one screen per user story |

## Notes

- **Token storage**: a PWA has no native keystore, so the token lives in
  `localStorage` (same as the web). The compensating control for risk R-02 is
  short-lived tokens + centralized revocation on the backend.
- **`device_name: 'leodeguita_mobile'`** is sent on login for forward
  compatibility; the backend currently issues every token as `auth_token`
  (`AuthService::issueTokenFor`) — labelling mobile sessions is a later backend
  change.
- PWA icons (`public/pwa-192x192.png`, `public/pwa-512x512.png`) are not yet
  added; the manifest references them but the app runs without them in dev.
