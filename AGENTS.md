# 작업 안내 (AI 에이전트용)

Tandrel(탄드렐): 브라우저에서 도는 판타지 생활 시뮬레이션. 번들러 없는 순수 JavaScript, 빌드 단계 없음.

## 먼저 읽을 것

1. `README.md`: 폴더 구조와 실행법
2. `docs/DESIGN.md`: 게임 방향, UI 규칙, 16px 그림 규칙, 문체 (**반드시 지킨다**)
3. `docs/ARCHITECTURE.md`: 모듈 경계, 콘텐츠 더하는 법, 저장 형식
4. `ROADMAP.md`: 한 일과 할 일

## 작업 규칙

- 시작 전에 원격의 최신 내용을 받아온다. 여러 환경(다른 계정, 다른 AI)에서 같이 작업한다.
- `game/art16.js`는 직접 고치지 않는다. `art/`의 원본을 고친 뒤 `python3 art/bundle_art.py game/art16.js`로 다시 묶는다.
- 바꾼 뒤에는 `node tools/runtests.js`가 모두 통과해야 한다. 새 기능에는 `game/test.js`에 시나리오를 하나 더한다.
- 화면을 바꿨으면 데스크톱(1280×800)과 휴대폰(375 폭) 둘 다 확인한다: `node tools/shots.js desk`, `node tools/shots.js mobile`
  (먼저 `cd game && python3 -m http.server 8766`).
- UI에 장식용 이모티콘, 그라데이션, 긴 설명 문장을 넣지 않는다. 세부 정보는 도감·창 안으로.
- 그림은 B 톤 색 램프, 재질당 세 톤, 굵은 외곽선, 빛은 왼쪽 위. 특정 게임의 그림을 베끼지 않는다.
- 주민 판단에 AI 호출을 쓰지 않는다(비용 0, 규칙 기반).
- 저장 키(`asteria.*`)와 코드 전역 이름(`Asteria`, `Game`, `Story`)은 예전 저장과의 호환 때문에 그대로 둔다.
- 한 일은 `ROADMAP.md`에 체크하고, 새 아이디어도 거기에 적는다.
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 한두 줄.
