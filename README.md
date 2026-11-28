# Tandrel (탄드렐)

**Tale(이야기) + Thread(실).** 각자의 이야기가 실처럼 엮여 하나의 역사를 만들어 가는 세계.

브라우저에서 도는 판타지 생활 시뮬레이션이다. 플레이어가 없어도 주민(NPC)들은 각자 일하고, 사랑하고, 다투고,
나라를 세우고, 그 일들이 매일 아침 신문에 실린다. 플레이어는 그 세계에 한 사람으로 태어나 원하는 대로 산다.

- 세계의 자율성: 주민마다 성격·꿈·관계·기억이 있고 규칙 기반 판단으로 움직인다 (AI 호출 없음, 비용 0)
- 이야기의 축적: 사건 → 기억 → 소문 → 신문 → 연대기
- 확장성: 나라·종족·직업·주민·아이템·지식을 콘텐츠 팩으로 더한다
- 그림: 16px 도트, 모든 그림을 코드로 찍는다(이미지 파일 없음). 인물·건물은 조각 조합

## 바로 해 보기

빌드 단계가 없다. 정적 파일을 띄우기만 하면 된다.

```bash
cd game && python3 -m http.server 8766
```

브라우저에서 `http://localhost:8766/index.html`을 연다. (휴대폰 화면도 지원: 왼쪽 아래 막대로 걷고 오른쪽 버튼으로 행동)

## 폴더

| 경로 | 내용 |
|---|---|
| `game/` | 게임 본체. `index.html`이 아래 스크립트를 순서대로 부른다 |
| `game/engine.js` | 세계 시뮬레이션: 주민·직업·꿈·관계·사건·경제·전쟁·나라 (`window.Asteria`) |
| `game/content.js`, `game/pack-jeweler.js` (`game/pack-greenhill.js`는 기본으로 불러오지 않는 팩 예시) | 콘텐츠 팩: 직업·종족·꿈·만들기·지식·사건·주민 (`Asteria.extend`) |
| `game/game.js` | 지도·이동·아이템·만들기·농사·사냥·건물·도둑질·공사·도감 (`window.Game`) |
| `game/sims.js` | 업무 조작 화면: 조작 부품과 단계 진행 (`window.Sims`) |
| `game/story.js` | 대화·미션·신문·이야기(에피소드) (`window.Story`) |
| `game/test.js` | 테스트 시나리오: 세계 복사본에서 기능을 점검 (`window.AsteriaTest`) |
| `game/art16.js` | 16px 도트 키트 묶음 (**직접 고치지 말 것**: `art/`에서 고친 뒤 다시 묶는다) |
| `game/sprites16.js` | 작은 그림: 작물·동물·들풀·천막·유적 등 |
| `game/render.js` | 화면 그리기: 땅 묶음 캐시, 소품·건물·인물, 미니맵, 아이콘 |
| `game/ui.js` | HUD·창·대화·제목 화면·저장 칸·터치 조작 |
| `art/` | 도트 키트 원본과 시안 페이지들 |
| `tools/` | 자동 테스트·스크린샷 스크립트 (Node + Playwright) |
| `docs/` | 설계 문서: DESIGN(규칙), ARCHITECTURE(구조), DATA_ARCHITECTURE(데이터 진단), AFTERLIFE(사후 세계) |
| `ROADMAP.md` | 한 일 / 할 일 / 아이디어 |

## 그림 키트 고치기

```bash
python3 art/bundle_art.py game/art16.js
```

`art/art.js`(색 램프·버퍼), `art/ground16.js`, `art/props16.js`(나무·덤불·바위), `art/house16.js`(건물 조립),
`art/person16.js`(인물·모자·소품)를 고친 뒤 위 명령으로 `game/art16.js`를 다시 만든다.
시안은 `art/` 폴더의 HTML 페이지에서 확인한다.

## 테스트

```bash
node tools/runtests.js
```

현재 `game/test.js`에는 **35개 시나리오**가 있다. `tools/runtests.js`는 기본 설정에서 시드 8개(1, 2, 3, 5, 7, 8, 11, 42)로 각 시나리오를 실행하므로 총 **280회 시나리오 실행**을 계획한다. 이 문서의 수치는 테스트 구성이지, 최신 실행 결과나 통과를 보증하는 표기가 아니다.

화면 점검(Playwright, Chromium 필요):

```bash
(cd game && python3 -m http.server 8766 &) ; node game/tools/shots.js desk ; node game/tools/shots.js mobile
```

## 이어서 작업하는 사람(또는 AI)에게

1. `AGENTS.md`의 작업 규칙을 읽는다.
2. `docs/DESIGN.md`의 게임·UI·그림 규칙을 지킨다.
3. `docs/ARCHITECTURE.md`에서 모듈 경계와 콘텐츠 추가 방법을 확인한다.
4. `ROADMAP.md`에서 한 일과 남은 일을 확인한다.
5. 구조 변경이면 `docs/DATA_ARCHITECTURE.md`, 죽음·사후 관련 변경이면 `docs/AFTERLIFE.md`를 함께 확인한다.
6. 변경 뒤에는 `node tools/runtests.js`를 실행하고 결과를 확인한다.

코드의 전역 이름(`Asteria`, `Game`, `Story`)과 저장 키(`asteria.*`)는 예전 저장과의 호환 때문에 유지한다.

AI 에이전트는 `AGENTS.md`(Claude Code는 `CLAUDE.md`)를 자동으로 읽는다.
