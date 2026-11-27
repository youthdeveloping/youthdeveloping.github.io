# QuizCraft

실시간 멀티플레이 퀴즈 플랫폼. GitHub Pages 프런트엔드와 Cloudflare Workers + Durable Objects WebSocket 서버로 구성돼.

## 구성
- `quizcraft/`: GitHub Pages에서 제공하는 웹 앱
- `workers/quizcraft/`: 방 상태·참가자·정답·점수를 관리하는 Durable Object 서버
- PIN 6자리 입장, 진행자/참가자 역할, 실시간 문제 전송, 답변 제출, 점수판
- 출제자 실시간 제출 현황판: 답변 완료 인원, 제출률, 참가자별 제출/대기 상태
- 문제별 제한시간(5~120초), 서버 기준 카운트다운 및 시간 종료 시 자동 정답 공개
- 모든 참가자가 답변하면 제한시간이 남아도 자동으로 정답 공개
- 정답·오답 효과음, 최종 우승자 강조 화면

## 서버 배포
프런트엔드는 GitHub Pages에서 자동 배포돼. 실시간 기능은 Cloudflare Worker 배포가 별도로 필요해.

```bash
cd workers/quizcraft
npx wrangler deploy
```

wrangler.toml에는 Durable Object 바인딩과 SQLite 클래스 최초 마이그레이션(v1)이 선언돼 있어. 기존 배포 환경에서 마이그레이션이 이미 적용됐다면 같은 v1을 다시 적용할 필요는 없어.

배포 후 quizcraft/app.js의 API 값이 Worker 주소와 일치하는지 확인해.

상태 확인: https://<worker-host>/api/health

## 테스트
1. 진행자 브라우저에서 퀴즈를 만들고 제한시간을 선택해.
2. 참가자 브라우저에서 6자리 PIN으로 입장해.
3. 진행자가 시작하면 양쪽 화면에 같은 카운트다운이 표시되는지 확인해.
4. 모든 참가자가 답변하거나 시간이 끝나면 자동으로 정답이 공개되는지 확인해.
5. 마지막 문제 뒤 최종 우승자와 점수 순위가 표시되는지 확인해.

## 참고
GitHub Pages는 정적 호스팅이므로 실시간 방 서버를 직접 실행하지 않아. 실시간 플레이는 별도 Cloudflare Worker가 담당해.
