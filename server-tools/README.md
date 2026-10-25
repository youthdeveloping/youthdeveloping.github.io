# YouthDeveloper Server Tools

## Files
- `index.html`: dashboard and authenticated UI.
- `worker.js`: deployed Cloudflare Worker source mirrored in this repository.

## Deployment
- Frontend: GitHub Pages at `/server-tools/`.
- API: existing Cloudflare Worker named `web`.
- Persistent shared data: existing `URL_SHORTER_KV` namespace using `tool:* ` keys.
- Authentication: existing Worker secret `ADMIN_SECRET`; successful login issues an HMAC-signed bearer token using `URL_SHORT_KEY`.
- GitHub administration continues to use the existing `GIT_TOKEN` secret.

## API
- `POST /api/admin/login`: verify the server admin password and issue an expiring token.
- `GET /api/tools/chat`, `POST /api/tools/chat`, `DELETE /api/tools/chat/:id`
- `GET /api/tools/ledger`, `POST /api/tools/ledger`, `DELETE /api/tools/ledger/:id`
- `GET /api/tools/suggestions`, `POST /api/tools/suggestions`, `PUT /api/tools/suggestions/:id`, `DELETE /api/tools/suggestions/:id`
- `GET /api/tools/notices`, `POST /api/tools/notices`, `PUT /api/tools/notices/:id`, `DELETE /api/tools/notices/:id`
- `GET /api/tools/status`, `PUT /api/tools/status`
- `GET /api/tools/stats`

All `/api/tools/*` endpoints require a valid bearer token. Data is shared through KV between authenticated clients. The device information panel intentionally reads browser information locally and does not upload it.

## Important
The current login is a **single shared administrator credential**, not separate individual user accounts. The dashboard uses session storage for the bearer token and clears it on logout. Chat updates are persisted server-side, but this implementation does not use WebSockets; refresh/reopen the tool to see new messages from another client.
