# Nol-guro Admin API

Worker endpoint: https://nolguro-admin-api.youthdeveloper-github.workers.dev

## Required secrets
Set these in Cloudflare Dashboard → Workers & Pages → nolguro-admin-api → Settings → Variables and Secrets:
- `ADMIN_PASSWORD` (Secret): choose a new, strong admin password.
- `SESSION_SECRET` (Secret): generate a separate random secret with at least 32 random bytes.

Do not commit secrets or put them in browser JavaScript.

The Worker uses D1 binding `DB` to persist admin inventory/events/pages. The admin HTML uses HttpOnly, Secure cookies and credentials-included requests. Allowed browser origin is the GitHub Pages domain.

## Deploy from this directory
```sh
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
``

D1 is already created and bound for the deployed Worker. The `admin_data` table is created automatically on first authenticated request. Do not run the empty-state migration manually; the Worker seeds the initial data through the admin page on first login if using the bundled app data.
