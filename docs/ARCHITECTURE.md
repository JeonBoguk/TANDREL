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
  races: [{ id, name, lifespan, adultAge, magic, traitsGenetic, traits, look: { skin: [...], hair: [...], ears, horns, tail, beard } }],
  jobs: [{ id, name, income, entry_cost, color, look: { hat, apron, trim }, workplace, teaches, skill }],
  dreams: [...], worldEvents: [...], items: {...}, recipes: [...], knowledge: [...],
  towns: [...], npcs: [...], loot: [...], renovations: [...], eventKinds: {...},
});
```

- 저장된 세계에도 새 마을·주민이 들어온다(`syncContent`).
- 직업의 `look.hat`은 인물 그림의 모자 조각으로 이어진다 (`render.js`의 `HAT16`). 새 모자는 `art/person16.js`의 `HATS`에.
- 직업별로 손에 드는 것은 `render.js`의 `PROP16`.

## 플레이어로 사는 동안의 상태

- `Game.ext(w)`는 **창구**다. 값은 `Asteria.extStore(키)` 표에 따라 세 곳에 산다.
  - `w.land`: 세계에 남는 흔적 (밭 `farm`, 채집 `picked`, 벌목 `removed`, 유적 `looted`, 의뢰 게시판 `board` …)
  - `w.session`: 화면·조작 (`facing`, `trail`)
  - 지금 조종하는 인물의 `n.ext`: 그 밖의 모든 것 (가방 `inv`, 단축바 `hot`, 도감 `codex`, 미션 `missions`, 수배 `wanted`, 집 `home`·`furn`·`stations`·`reno`, 데이트 `dates`, 아는 꿈 `dreams` …)
- 새 값을 ext에 넣을 때 세계 쪽이면 engine.js `EXT_STORE`에 등록한다. 등록하지 않으면 인물 쪽이다.
- 다시 태어나거나 다른 주민으로 살면 이전 인물의 것은 그 인물의 `n.ext`에 남는다 (상속의 바탕). 지난 삶의 집 공사는 `w.innMods`로 건물에 남는다.
- 도감: `give(w, id, n, how, at)`가 얻은 방법·곳을 `codex`에 적는다.

## 그리기

- 땅: 8×8 타일 묶음을 처음 보일 때 한 번 그려 캐시한다 (`paintChunk`). 지형 경계는 타일 사이를 부드럽게 이은 뒤 잡음으로 흔든다.
  물이 있는 묶음은 두 장을 번갈아 보여 준다. 지도가 바뀌면(`MAP.ver`) 캐시를 비운다.
- 소품·건물·인물 그림도 키별로 캐시한다.
- 건물은 발밑(바닥 타일) 기준으로 위로 솟는다. 건물 안에 들어가면 지붕 대신 실내를 그린다.

## 저장

- 형식 버전 `Asteria.SAVE_VERSION`(지금 8). 형식을 바꾸면 버전을 올리고 engine.js의 `MIGRATIONS[옛 버전]`에 이전 함수를 더한다. `deserialize`가 차례로 적용한다.
- `w.nations{id}`: 나라 목록 `{name, since, founder, from(갈라져 나온 나라), ended, revolution}`. 마을은 `town.nation`에 **나라 id**를 가진다. 이름은 `Asteria.nationName(w, id)`. 이 세계에서 생긴 나라는 `n1, n2…`
- `w.assets{id}`: 자산. 지금은 주민 집 `house:마을:번호` = `{kind, town, hid, owner, style(roof·wall·floor), mods(dx·dw·dh·grown)}`. 인물은 사는 집 `n.house`를 가진다. 배정·승계는 engine.js의 `settleIn`, `joinHousehold`, `pickHouse`, `passHouses`. 마을마다 집 수는 `CONTENT.housesPerTown`(game.js `BUILD_DEF`와 맞출 것)
- 인물의 혈통·외형: `n.heritage{종족: 비율}`(아이는 부모 평균 `blendHeritage`), `n.look{skin, hair, style, eye}`(태어날 때 정해짐, 아이는 `inheritLook`으로 부모를 닮음. 그림은 `render.js lookOf`가 이 값을 쓴다), `n.birthplace{town, nation, day}`, `n.culture`(나라 id, 어른이 될 때 사는 나라).
- 기술: `n.skills{지식 id: {lv, xp, from}}`. lv 0은 익히는 중, 1 기초·2 능숙·3 숙련·4 명인(`SKILL_LV`의 xp). `knows(n,k)`는 lv ≥ 1. 직업은 `setJob(n, id)`로 바꾼다(teaches를 `from:"job"`으로 익힘, 전직해도 남음). 경험은 `addXp`(일 `rWork`, 혼자 익히기 `practice`). 직업 솜씨는 수입에 `mastery(n)`으로 곱한다. 친한 사람에게 퍼지는 것은 직업 밖에서 익힌 기술뿐(`sharedSkills`).
- 식량: 마을의 `t.food`(오늘 먹을 것)와 `t.store`(가을에 비축한 곳간). 규칙은 engine.js `granaries`와 `FOOD` 기준(한 사람당 일수). `t.worry`는 겨울 양식 걱정(농부가 밭에 남음, `betterJob`).
- 어른: 종족의 `adultAge`(기본 16)에 이르면 `comeOfAge`가 `n.grown = true`로 바꾼다. 판정은 `Asteria.isAdult(n)`.
- `w.worldId`: 세계 식별자(새 세계를 만들 때 정함). 창작물·기록이 어느 세계 것인지 가리킨다.
- 사건의 `data`: 문장과 별개인 구조화 값. `w.record(kind, text, { …, data: { from, to } })`. 저장 배열의 11번째 칸(있을 때만).
- `w.lifeOf(id, minImp)`: 인물별 사건 색인(`w.byChar`, 저장하지 않고 불러올 때 다시 만듦).

- `localStorage`: `asteria.slots.v1`(칸 목록), `asteria.slot.v1.<id>`(세계), `asteria.settings.v1`(설정). 칸은 최대 8개.
