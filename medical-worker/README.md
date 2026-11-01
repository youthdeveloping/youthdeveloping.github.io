# medical-api Worker

의학 용어 검색 API(`medical-api`)의 소스입니다. 비밀 키는 이 폴더에 넣지 않고 `wrangler secret put`으로 등록합니다.

## Cloudflare 연결 (Workers Builds)
- Workers & Pages > medical-api > Settings > Builds > Connect
- Production branch: `main`
- Root directory: `medical-worker`
- Build command: (비움)
- Deploy command: `npx wrangler deploy`

## 명령어 (이 폴더에서 실행)
- 배포: `npx wrangler deploy`
- 스키마 적용(최초 1회): `npx wrangler d1 execute youthdeveloper-medical --remote --file=schema.sql`
- 로그: `npx wrangler tail medical-api`
- 비밀 키 등록: `npx wrangler secret put 이름`

## 확인
- `GET /api/medical/health` 응답에 `ok: true`가 나오면 정상입니다.
- 동기화는 매일 12:00 KST(UTC 03:00)에 실행됩니다.
