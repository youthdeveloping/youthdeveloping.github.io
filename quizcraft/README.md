# QuizCraft

실시간 멀티플레이 퀴즈 플랫폼. GitHub Pages 프런트엔드와 Cloudflare Workers + Durable Objects WebSocket 서버로 구성돼.

## 구성
- `quizcraft/`: GitHub Pages에서 제공하는 웹 앱
- `workers/quizcraft/`: 방 상태·참가자·정답·점수를 관리하는 Durable Object 서버
- PIN 6자리 입장, 진행자/참가자 역할, 실시간 문제 전송, 답변 제출, 점수판

## 서버 배포
Cloudflare Workers에서 `workers/quizcraft`를 배포하고 `wrangler.toml`의 Durable Object 마이그레이션을 적용해야 해. 배포 후 workers.dev 주소가 `quizcraft/app.js`의 `API` 값과 일치해야 해.

로컬 배포:
```bash
cd workers/quizcraft
npx wrangler deploy
```

상태 확인: `https://<worker-host>/api/health`

## 참고
GitHub Pages는 정적 호스팅이므로 실시간 방 서버를 직접 실행하지 않아. 실시간 플레이는 별도 Cloudflare Worker가 담당해.
