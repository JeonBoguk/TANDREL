# 데이터 아키텍처: 현재 진단과 목표

> 이 문서는 코드에서 확인한 사실과 설계 제안을 구분한다. **현재**는 실제 코드(파일·함수·필드)에 있는 것, **제안**은 아직 없는 것이다.
> 사후 세계 설계는 [`AFTERLIFE.md`](AFTERLIFE.md).

## 1. 설계 원칙

- 종족, 직업, 기술, 인물, 관계, 경제, 창작, 정치, 역사는 따로 노는 기능이 아니라 하나의 세계 시뮬레이션 안에서 서로 영향을 준다.
- 플레이어는 특별한 규칙이 아니라 `controller === "player"`인 같은 인물이다. (현재 이미 그렇다: `Asteria.addPlayer` → `World.spawn`)
- 새 콘텐츠는 엔진 수정 없이 데이터(`Asteria.extend`)로 더한다. 다만 무리한 범용화는 하지 않는다.
- 플레이어 창작물과 세계에서 생긴 정의는 그 세계에 귀속된다.
- 저장 키 `asteria.*`, 저장 형식 `"asteria-world"`, 전역 이름 `Asteria/Game/Story`는 호환 때문에 유지한다.

## 2. 현재 구조 요약

```
CONTENT (engine.js, 전역) ← Asteria.extend(pack) ← content.js, pack-greenhill.js
  races[] jobs[] dreams[] knowledge[] recipes[] items{} towns[] npcs[] worldEvents[] loot[] renovations[] styles{} nations{id→이름}
  RACES/JOBS/DREAMS = reindex() 색인          ITEMS(game.js) = 기본 + CONTENT.items

World (engine.js, 저장됨)
  worldId(제안→S0 구현) seed name day rng.s  towns{id:{nation:"이름", food, races, job_bias, indep}}  founded[] jobsOpen[] racesSeen[] war{}
  npcs[]   번호 = 인물 id. 죽어도 지우지 않는다
     { race, job, town, home, traits, age_days, lifespan, gold, hunger, health, rel{id:값}, mem[{e,s,f,v}], known, spouse, lover,
       parents[], children[], goal, vowed, dream, know[], follows, title, pioneer, flags, stat, controller, alive, death_day, death_cause }
  events[] 번호 = 사건 id. 정리된 사건은 자리만 남긴다 { day, kind, text, actor, target, town, imp, sent, cause, secret, data(S0) }
  chronicle[] (imp ≥ 7)
  플레이어 쪽: playerId ppos clock journal papers episodes todayLog
  ext { inv hot codex stats missions wanted farm picked removed looted furn stations home reno dates dreams follow board … }  ← 플레이어 한 명 전용
  houseStyle{"town:hid"} innMods{town}
game.js MAP (저장 안 함): allTownDefs(w) + homeMods(w)로 매번 다시 만듦. buildings[] 번호 = bd.id
```

호출 의존: `engine → game`(`root.Game.findSite`), `content → game`(`Game.houseExpandOptions`), `game ↔ story`(서로 호출). 엔진의 `onEvent/onLearn/onApproach` 훅은 느슨한 연결이라 괜찮다.

## 3. 시스템별 진단 (✅ 구현 · ◐ 일부 · △ 데이터만 · ✗ 없음)

| 시스템 | 상태 | 핵심 근거와 한계 |
|---|---|---|
| 종족 정의·추가 | ✅ | `CONTENT.races` + `extend`. 숨은 종족(`hidden`, 용족은 `dragon_contact` 사건으로 등장) |
| 세계별 종족 | ◐ | 정의는 전역, 세계마다 다른 건 `w.racesSeen`(나타난 종족 id)뿐 |
| 혼혈 | ◐ | `births()`: `mix` 정의가 있는 조합만 50%로 혼혈 종족. 유전은 성격 평균뿐 |
| 외형 | △ | 인물 필드 없음. `render.js lookOf()`가 `hash(n.id)`로 매번 계산 → 유전 불가 |
| 성장 속도·마법 친화 | ✗ | `ADULT = 16` 모든 종족 공통 |
| Species/Heritage/Culture/Nationality/Identity | ✗ | `n.race` 하나. 국적은 `town.nation`(**이름 문자열**)으로 간접 |
| 직업 | ✅ | `CONTENT.jobs` 한 줄에 경제·화면·일터·기술·대화·지식·출현 조건 |
| 복수 직업 | ✗ | `n.job` 하나 |
| 지식 | ◐ | `n.know[]` + 현재 직업의 `teaches`를 `knows()`가 합침 → **전직하면 직업 지식이 사라짐** |
| 숙련 | △ | 플레이어만 `ext.stats`(`practice()`) |
| NPC 전업 | ✅ | `uJob/betterJob/rJob`, `jobDemand`, `expectedIncome`, `job_cooldown` |
| 직업 출현 | ✅ | `emergeJobs(w)`: `job.emerge{demand, fit, know, text}`, `w.jobsOpen`, 플레이어 개척 `pioneer:` |
| 직업 정의의 세계 저장 | ✗ | `emerge.demand` 등이 함수라 세계 안에서 만든 직업을 저장할 수 없음 |
| 업무·시뮬레이터 | ✗ | NPC는 `rWork()` 수치 하나. 플레이어 업무는 `buildingMenu` 분기와 `skill.use`에 코드로 박혀 있음 |
| 공통 인물 데이터 | ◐ | 인물 필드는 공통. 소지품·숙련·도감·기력은 `w.ext`(플레이어 전용), 꿈은 NPC 전용 |
| 관계 | ✅ | `n.rel` 단일 값, 가족 필드, 연인→결혼, 복수(`goal`), 추종(`follows`) |
| 관계도 | ✅ | `Story.relGraph` + `ui.js winRel`. 새로 만들 필요 없음 |
| 관계 종류(친구·경쟁·스승) | ✗/△ | `friendship`·`learn` 사건만 |
| 관계 변화의 원인 | ◐ | 저장하지 않음. 플레이어용 `reasons()`가 `journal`에서 추정 |
| 기억·소문 | ✅ | `remember()`, `n.mem`, `n.known`, 감쇠, `rSocial`의 소문 전파 |
| 식량 경제·노동시장 | ✅ | `town.food`, `foodPrice`, `upkeep`(밥값→생산자), `seasonal`, 상인, 상단 |
| 물건 경제 | ◐ | 물건은 플레이어만. 가게 가격 고정, 재고 없음, 판매 시 금화가 새로 생김 |
| 집 | ✅ (2단계) | `w.assets` + `n.house`. 주인·승계 있음. 플레이어 집은 아직 여관 방(`ext.home`) |
| 가구 | ◐ | `ext.furn[bd.id]`, `bd.id` = 맵 생성 순서(불안정) |
| 창작물 | ✗ | 디자인·제작자·버전 없음 |
| 세계 식별자 | ✗ → S0 | `worldId` 없음(저장 칸 id는 UI에만) |
| 사건·원인 사슬 | ✅ | `record`, `cause`, `chain()`, `feuds()` |
| 연대기·신문 | ✅ | `chronicle`(imp ≥ 7), `Story.onDawn`, `PUBLIC`, `followNews`, `localNews` |
| 사건의 구조화 값 | ✗ → S0 | 이전/새 직업 같은 값이 `text`에만 있음 |
| 인물별 사건 색인 | ✗ → S0 | `bioCard()`가 매번 `W.events` 전체를 훑음 |

## 4. 발견한 문제

| 종류 | 내용 |
|---|---|
| 중복 공식 | 주민 집 번호 `1 + (n.id % 5)` (game.js 5곳, story.js, content.js) |
| 중복 출처 | 지식 = `n.know` + 현재 직업 `teaches` |
| 이름으로 저장 | `town.nation`이 국가 이름 문자열 |
| 중복 위치 | 거주지 `n.town`, `n.home`, `p.home`, `stat.towns` |
| 불안정 id | `bd.id`(맵 생성 순서)로 가구 저장 |
| 직렬화 불가 | 직업 `emerge`, 꿈, 세계 사건, 기술 `use`가 함수 |
| 텍스트에만 있는 사실 | 사건 핵심 값이 `text`에만 |
| 경제 분리 | 플레이어 물건 경제 ↔ NPC 식량·금화 경제 |
| 외형이 데이터 아님 | `lookOf(hash(id))` |
| 플레이어 전용 덩어리 | `w.ext` |
| 역방향 의존 | 엔진·콘텐츠가 `root.Game`을 부름 |

## 5. 목표 영역 (합칠 것과 나눌 것)

| 영역 | 판단 |
|---|---|
| World | 유지 + `worldId`, `version`, `defs`(세계에서 생긴 **함수 없는** 정의) |
| Character | 유지(`npcs[]`). `ext`의 인물 몫을 인물로 옮김 |
| Species | 유지 + 규칙 필드(`adultAge`, `magic`, `traitsGenetic`) |
| Heritage / Culture / Identity | 독립 영역이 아니라 **인물 필드**(`heritage{sp:비율}`, `culture`, `identity`) |
| Nation | **독립(구현됨)**: `w.nations{id}`, `town.nation` = id |
| Job | 유지 + 세계 정의(`w.defs.jobs`) |
| Skill | 지식(`know`)과 숙련(`stats`)을 `n.skills{id:{lv,xp}}`로 합침 |
| Work + Simulator | 하나로: `CONTENT.works{steps, npc 계산식, sim:id}`, 시뮬레이터는 UI 코드 등록표, 둘은 id로만 연결. `jobReady(j)`가 참일 때만 플레이어에게 노출 |
| Relationship | `n.rel` 유지 + `n.relKind{id}`(친구·경쟁·스승·제자·지도자). 두 번째 축은 쓰는 규칙이 생길 때 |
| Event/Memory/History | 하나로 유지 + `ev.data`, 인물별 색인 |
| Economy | 유지 + 마을 재고(`town.stock`)와 가격 |
| Asset | **주민 집은 구현됨**: `w.assets{id:{kind, owner, town, hid, style, mods}}`, 거주지 `n.house`(`n.home`은 고향 마을 id로 그대로). 플레이어 집·가게는 다음 단계 |
| Creation | **새로**: `w.designs{id:{kind, creatorId, originWorldId, version, data}}`. 물건은 `"outfit:d_7"`처럼 디자인을 가리킴 |

## 6. 단계별 로드맵

| 단계 | 내용 | 주요 파일 | 위험 |
|---|---|---|---|
| **S0** | 저장 버전 체계(v3 + 이전 함수), `worldId`, `record(…, {data})`, 인물별 사건 색인 | engine.js, ui.js(bioCard), test.js | 낮음 |
| 1 | 국가 독립 (`w.nations`, `town.nation` = id) | engine.js, ui.js, story.js | 중간 |
| 2 | 집·자산 (`w.assets`, `n.home`, `hid` 공식 제거, 가구·집 꾸밈 이전) | game.js, story.js, content.js, render.js | **높음** |
| 3 | 공통 인물 구조 (`ext` 분리: 인물 몫 / 세계 몫 / 플레이어 몫) | game.js, story.js, ui.js | **높음** |
| 4 | 종족·혈통 (`heritage`, `look` 저장·유전, 종족 규칙 필드) | engine.js, content.js, render.js | 중간 |
| 5 | 직업·기술·업무 (`knows()` 정리, `n.skills`, `CONTENT.works`, 시뮬레이터 등록표) | engine.js, content.js, game.js, ui.js | 중간~높음 |
| 6 | 관계 종류·창작·경제 (`relKind`, `w.designs`, 재고·가격) | engine.js, story.js, game.js | 중간 |
| 7 | 연대기·UI (인물 생애 탭, 연대기 필터, 관계도의 관계 종류) | ui.js, story.js | 낮음 |

사후 세계 단계(S1~S10)와의 순서는 [`AFTERLIFE.md`](AFTERLIFE.md) 7장.

## 7. 설계 세부

- 저장 이전: `MIGRATIONS[v](d)`를 `deserialize`에서 버전이 맞을 때까지 차례로 적용한다.
- 사건 구조화 값: `record(kind, text, { …, data })`. 우선 대상 `career{from,to}`, `learn/discovery{skill}`, `job_born{job}`, `nation_founded/independence{nation,from}`, `race_born/contact{species}`, `marriage`, `birth`.
  사소한 행동은 사건으로 남기지 않는다(`G.log`/`todayLog`만). 선별 기준은 기존 `imp`(생애 3~5, 세계 7 이상 → 연대기).
- 국가: `w.nations = { id: {name, since, founder, from} }`, `nationName(w, id)`.
- 혈통: `n.heritage`(부모 평균), `n.culture`(성인이 될 때 자란 곳), `n.identity`(사건으로만), `n.look`(태어날 때 결정, 부모 값에서 유전).
- 업무: `works: [{ id, skill, steps:[…], npc:{income, uses}, sim:"forge" }]`, `job.works:[…]`, `jobReady(j)`.
- 창작물: `w.designs`에만 존재 → 자동으로 세계 귀속. 다른 세계로는 명시적 가져오기로만, 이때 `originWorldId`를 남긴다.
