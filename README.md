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
| `game/content.js`, `game/pack-greenhill.js` | 콘텐츠 팩: 직업·종족·꿈·만들기·지식·사건·주민 (`Asteria.extend`) |
| `game/game.js` | 지도·이동·아이템·만들기·농사·사냥·건물·도둑질·공사·도감 (`window.Game`) |
| `game/story.js` | 대화·미션·신문·이야기(에피소드) (`window.Story`) |
| `game/test.js` | 테스트 단계: 내 캐릭터를 NPC처럼 대신 움직여 기능을 점검 (`window.AsteriaTest`) |
| `game/art16.js` | 16px 도트 키트 묶음 (**직접 고치지 말 것**: `art/`에서 고친 뒤 다시 묶는다) |
| `game/sprites16.js` | 작은 그림: 작물·동물·들풀·천막·유적 등 |
| `game/render.js` | 화면 그리기: 땅 묶음 캐시, 소품·건물·인물, 미니맵, 아이콘 |
| `game/ui.js` | HUD·창·대화·제목 화면·저장 칸·터치 조작 |
| `art/` | 도트 키트 원본(ES 모듈)과 시안 페이지들 |
| `tools/` | 자동 테스트·스크린샷 스크립트 (Node + Playwright) |
| `docs/` | 설계 문서 |
| `ROADMAP.md` | 한 일 / 할 일 / 아이디어 |

## 그림 키트 고치기

```bash
python3 art/bundle_art.py game/art16.js
```

`art/art.js`(색 램프·버퍼), `art/ground16.js`, `art/props16.js`(나무·덤불·바위), `art/house16.js`(건물 조립),
`art/person16.js`(인물·모자·소품)를 고친 뒤 위 명령으로 `game/art16.js`를 다시 만든다.
시안은 `art/` 폴더를 띄워 `proto16.html`(땅·나무), `proto_house.html`(마을), `sheet16.html`(인물), `hats.html`(모자·소품)로 본다.

## 테스트

```bash
node tools/runtests.js
```

시드 8개 세계에서 17가지 시나리오(빈손 시작, 모으기, 만들기, 도감, 사냥, 장사, 배우기, 초대, 공사, 도둑질, 범죄, 다시 태어나기, 건국, 1년 흐름, 저장/불러오기 등)를 돌린다. 지금 136/136 통과.

화면 점검(Playwright, Chromium 필요):

```bash
(cd game && python3 -m http.server 8766 &) ; node tools/shots.js desk ; node tools/shots.js mobile
```

## 이어서 작업하는 사람(또는 AI)에게

1. `docs/DESIGN.md`의 규칙을 먼저 읽는다. UI 문구·색, 그림 규칙이 정해져 있다.
2. `docs/ARCHITECTURE.md`에서 모듈 경계와 콘텐츠를 더하는 법을 본다.
3. `ROADMAP.md`에서 다음 할 일을 고른다.
4. 바꾼 뒤에는 `node tools/runtests.js`가 모두 통과해야 한다.

게임 안 세계 이름은 아직 '아스테리아'다(코드의 전역 이름 `Asteria`도 그대로).
