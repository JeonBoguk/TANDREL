# 구조

모든 파일은 번들러 없이 `<script>`로 순서대로 불린다. 각 파일은 `window`에 이름 하나를 내놓는다.

```
engine.js ─ Asteria      세계 상태(World)·주민·하루 흐름·사건 기록·저장 형식
content.js ─ (extend)     기본 콘텐츠 팩
pack-*.js  ─ (extend)     추가 콘텐츠 팩 (예: pack-greenhill.js = 도토리골 마을과 양봉가)
game.js    ─ Game        타일 지도·이동·충돌·아이템·만들기·농사·사냥·건물 메뉴·범죄·공사·도감
story.js   ─ Story       대화 선택지·미션·신문·에피소드
test.js    ─ AsteriaTest 시나리오 테스트 (세계 복사본에서 실행)
art16.js   ─ Art16       도트 키트 (art/ 폴더를 bundle_art.py로 묶은 것)
sprites16.js ─ Spr16     작은 그림 (작물·동물·들풀·소품)
render.js  ─ WorldView, drawPortrait, drawMap, itemIcon
ui.js      ─ (화면 전체) HUD·창·대화·제목 화면·저장 칸·터치
```

## 세계와 시간

- `Asteria.newWorld(seed, name)` / `freshWorld` 로 세계를 만들고, `Asteria.advance(w, 분)`으로 흐른다.
- 하루는 06:00에 바뀐다(`beginDay` / `finishDay`). 계절은 `w.season`(날짜에서 계산).
- 주민 행동은 `ACTIONS`(행동 후보)의 효용 점수 + 꿈(`dreams[].bias`) + 성격 가중치로 고른다.
- 일어난 일은 `w.record(kind, text, {actor, target, town, imp, ...})`로 사건이 되고,
  본 사람·들은 사람의 기억(`n.mem`)으로 퍼진다. 중요한 사건은 신문과 연대기에 오른다.

## 콘텐츠 더하기

```js
Asteria.extend({
  races: [{ id, name, lifespan, traits, look: { skin: [...], hair: [...], ears, horns, tail, beard } }],
  jobs: [{ id, name, income, entry_cost, color, look: { hat, apron, trim }, workplace, teaches, skill }],
  dreams: [...], worldEvents: [...], items: {...}, recipes: [...], knowledge: [...],
  towns: [...], npcs: [...], loot: [...], renovations: [...], eventKinds: {...},
});
```

- 저장된 세계에도 새 마을·주민이 들어온다(`syncContent`).
- 직업의 `look.hat`은 인물 그림의 모자 조각으로 이어진다 (`render.js`의 `HAT16`). 새 모자는 `art/person16.js`의 `HATS`에.
- 직업별로 손에 드는 것은 `render.js`의 `PROP16`.

## 플레이어 쪽 상태

- `Game.ext(w)`: 가방·단축바·밭·미션·수배·도감(`codex`)·집 공사 등. 새 삶을 시작하면 '이번 삶의 것'만 비운다(`WORLD_KEYS`).
- 도감: `give(w, id, n, how, at)`가 얻은 방법·곳을 `codex`에 적는다.

## 그리기

- 땅: 8×8 타일 묶음을 처음 보일 때 한 번 그려 캐시한다 (`paintChunk`). 지형 경계는 타일 사이를 부드럽게 이은 뒤 잡음으로 흔든다.
  물이 있는 묶음은 두 장을 번갈아 보여 준다. 지도가 바뀌면(`MAP.ver`) 캐시를 비운다.
- 소품·건물·인물 그림도 키별로 캐시한다.
- 건물은 발밑(바닥 타일) 기준으로 위로 솟는다. 건물 안에 들어가면 지붕 대신 실내를 그린다.

## 저장

- 형식 버전 `Asteria.SAVE_VERSION`(지금 4). 형식을 바꾸면 버전을 올리고 engine.js의 `MIGRATIONS[옛 버전]`에 이전 함수를 더한다. `deserialize`가 차례로 적용한다.
- `w.nations{id}`: 나라 목록 `{name, since, founder, from(갈라져 나온 나라), ended, revolution}`. 마을은 `town.nation`에 **나라 id**를 가진다. 이름은 `Asteria.nationName(w, id)`. 이 세계에서 생긴 나라는 `n1, n2…`
- `w.worldId`: 세계 식별자(새 세계를 만들 때 정함). 창작물·기록이 어느 세계 것인지 가리킨다.
- 사건의 `data`: 문장과 별개인 구조화 값. `w.record(kind, text, { …, data: { from, to } })`. 저장 배열의 11번째 칸(있을 때만).
- `w.lifeOf(id, minImp)`: 인물별 사건 색인(`w.byChar`, 저장하지 않고 불러올 때 다시 만듦).

- `localStorage`: `asteria.slots.v1`(칸 목록), `asteria.slot.v1.<id>`(세계), `asteria.settings.v1`(설정). 칸은 최대 8개.
