# 죽음과 사후 세계 설계

> 상태: **설계**. 아직 구현되지 않았다. **확정**은 정해진 요구사항, **미정**은 결정 전이며 대안을 함께 적는다.
> 심판자의 정체, 사후 세계의 종교적·세계관적 구조는 **별도 논의 예정**이다. 이 문서는 그것을 정하지 않은 채로도 구현할 수 있게 짰다.

## 1. 성격 (확정)

- 죽음은 게임 오버가 아니라 한 생애가 끝나고 그 영향이 역사에 이어지는 사건이다.
- 사후 세계는 또 하나의 생활 시뮬레이션이 아니라, 영혼이 다음 운명을 정하기 전까지 머무는 **중간 공간**이다. 경제·직업·일상·사회는 없다.
- 역할: 회고, 심판, (필요하면) 속죄, 다음 운명(환생 또는 안식) 결정.
- 플레이어와 NPC에 **같은 규칙**. 플레이어는 장면을 직접 경험하고 고르며, NPC는 성격·행적·판정으로 자동 처리한다.
- 세 가지를 구분한다.
  - **기존 세계에서 환생**: 사후 세계에서 정하는 영혼의 운명
  - **기존 세계 관전**: 죽은 플레이어의 플레이 방식
  - **새로운 세계 시작**: 사후 시스템과 무관한 게임 진행 기능

## 2. 현재 코드에 있는 것

| 항목 | 근거 |
|---|---|
| 단일 사망 입구 | `World.die(n, how, {killer, imp, cause, kind, demon})` (engine.js). 사망 경로 11곳이 모두 이 함수를 쓴다 |
| 사망 상태 | `n.alive`, `n.death_day`, `n.death_cause`(문장). 사망자는 `w.npcs`에서 지우지 않는다 |
| 사망의 여파 | 사망 사건, 애도자 통지, 배우자 `spouse = null` + `widowed`, 살인자 `killer`·추방, `demon_grudge` |
| 플레이어 사망 후 | `winBorn`: "새로운 세계에서 처음부터 / 이 세계에서 이어 살기", 창을 닫으면 관전(`obsRun`, 하루 단위) |
| 장례 | `Story` 에피소드(`funeral`, 복수 다짐) |
| 행적 사건 | 해악 `murder assault theft theft_unknown(secret) caught arrest insult gossip quarrel duel revenge exile` + `crime()`. 선행 `help gift thanks lend funeral plague_heal bandits_beaten deed bless treat`. 속죄·화해 `forgive reconcile`, 자수, 감옥 |
| 맥락 | `cause` 사슬(복수 → 다짐 → 원래 피해), `chain()`, `feuds()` |
| 가족 | `parents`, `children`은 사후에도 유지 |
| 지식 계승 수단 | 두루마리 아이템(`teaches`, `readScroll`) |

**부족한 것**: 원인 종류(문장뿐), 맥락·피해 규모, 인물별 행적 집계, 사건 정리 시 유실(중요도 3 미만이고 2년 지나 아무도 기억하지 않으면 버림), 배우자 기록 소실, 유산(금화가 사라짐), 가문, 영혼 연결, 실시간 관전, 이전 세계의 보관 상태.

## 3. 데이터 (제안)

```js
n.death = { day, cause: "starve"|"age"|"war"|"murder"|"plague"|"accident"|"raid"|"unknown", killer, event }
n.lateSpouse = id                       // die()에서 산 배우자에게 남김
n.soul = id                             // 처음 태어날 때 자기 id. 환생하면 이어받음. 세계 안에서만 유효
n.pastLives = [id, ...]                 // 환생한 인물에게
n.ledger = { harm:{종류:{맥락:횟수}}, help:{…}, victims:[id], atoned:[…], notable:[eventId] }  // 사건이 정리돼도 남는 집계
ev.data.moral = { harm, help, ctx: "war"|"defense"|"revenge"|"crime"|"duty"|"tyranny", victims, community }

n.after = {                             // 사망자에게만
  stage: "arrival"|"review"|"judgment"|"atonement"|"gate"|"rest"|"reborn",
  since: day, fate: "pending"|"rebirth"|"rest", next: null|charId,
  verdict: null | { aspects:{harm, help, repeat, atoned, impact}, themes:["murder:crime"], allowRebirth, atonementNeeded:[…] },
  atone: null | { themes:[…], steps:[{kind, ref, done}], refused:false },
}
w.souls = [soulId, ...]                 // 환생을 기다리는 영혼 대기열
w.worldId, w.archived = null | {day, reason}     // 세계 보관 상태
// 세계 밖(저장 칸 메타): 플레이 방식 "alive"|"afterlife"|"watching"|"archived", 살았던 삶 목록(포인터만)

CONTENT.judgment = { aspects:[{id, from, weightByCtx?, rule?}], combine:"default" }   // 무엇을 보는가. 누가 보는가는 정하지 않는다
CONTENT.atonements = { "murder:crime": {...}, ... }                                    // 형식만. 방식·난이도는 미정
CONTENT.afterlife = { stages:[…], texts:{…} }                                           // 중립 서술. 세계관이 정해지면 교체
```

장소와 단계는 1:1이다. 맵이든 화면이든 데이터는 같다.

| 장소 | stage | NPC | 플레이어 |
|---|---|---|---|
| 도착의 장소 | arrival | 즉시 통과 | 첫 화면 |
| 기억의 회랑 | review | 생략 | 회고 |
| 심판의 전당 | judgment | 즉시 계산 | 판정 장면 |
| 속죄의 영역 | atonement | 세계 날짜만큼 대기 | 속죄 장면 |
| 윤회의 문 | gate | 대기열로 | 환생 선택 |
| 안식의 영역 | rest | 최종 | 최종 → 플레이 방식 선택 |

## 4. 흐름

```
World.die(n) ─▶ settleEstate(유산) ─▶ n.after = {stage:"arrival", fate:"pending"}
NPC     : arrival → judgment(judge) → [atonement: 규칙표만큼 대기] → gate: 성격·판정으로 rebirth|rest
          rebirth → w.souls → births()에서 태어나는 아기에 soul 연결 (인구 규칙은 그대로)
플레이어: arrival → review(lifeReview) → judgment(같은 judge, 연출) → atonement 장면|거부 → gate(afterlifeOptions)
          rebirth → 출생 화면(허용 범위의 가문·장소) → 플레이 계속
영혼의 운명이 정해진 뒤 (세계 밖 선택): 환생했으면 계속 / 관전 / 새로운 세계 시작(이전 세계는 archived)
```

공통 함수(engine.js): `judge`, `afterlifeStep`, `afterlifeOptions`, `reincarnate`, `settleEstate`. 플레이어용은 같은 결과를 화면으로 보여 주는 것뿐이다(story.js `lifeReview`, ui.js 화면).

사후에도 이어지는 것: 사건·연대기·신문, 남은 사람들의 기억과 관계(기존), 원수 목표 정리(`checkGoal`, 기존), 유산·유고·가게 승계(제안), 후손 소식(제안).

## 5. 최소 화면 (맵 없음, 기존 창과 대화 UI 재사용)

1. **도착·회고**: 사망 문장 + 탭(생애 연대표 `bioCard` 생애 목록 / 관계 `relGraph` / 남긴 것: 가족·후손·유산·제자·업적)
2. **심판·속죄**: 관점별 판정을 **문장**으로(점수·막대 금지), 이어서 대화창 형식의 속죄 장면과 선택지
3. **문**: 환생(조건·출생 범위) / 안식 → 이어서 플레이 방식(관전, 새 세계)

단계마다 정적 도트 배경 한 장은 선택. 나중에 걸어 다니는 작은 방으로 키워도 `stage`가 그대로 쓰인다.

## 6. 미정 사항과 대안

| 항목 | 대안 |
|---|---|
| 플레이어가 사후 화면에 있는 동안 기존 세계 시간 | **A 정지(추천)** / B 흐름 / C 회고·심판은 정지, 속죄는 세계 날짜 소모 |
| 속죄 형식 | A 사후 장면형(피해자 기억·이후의 삶을 마주하고 선택) / B 다음 생으로 이어지는 책임(피해자 후손 돕기 미션) / C 혼합. 데이터(`n.after.atone`)는 공통 |
| 환생이 막히거나 안식을 택한 플레이어가 이 세계에서 계속 플레이 | 1 관전·새 세계만 / 2 새 영혼으로 이 세계에 오기(지금의 "이어 살기") / 3 살아 있는 인물에게 깃들기(`takeOver`, 세계관 논의 필요) |
| 심판자의 정체·수·법칙 | **세계관 논의 대기**. 판정 데이터(관점별)와 연출을 분리해 어느 쪽이든 수용 |
| 속죄 거부의 운명 | `afterlifeOptions`의 조건 하나로 연결(예: 환생 금지 / 제한된 환생 / 안식만) |
| 전생 기억 | 없음 / 단편 / 조건부. `n.pastLives`와 플래그 자리만 둔다 |
| 상속 비율·순서, 상속자 없을 때 | 배우자·자녀 우선, 없으면 마을. 비율은 미정 |
| 보관된 세계의 재진행 | 영구 읽기 전용 / "돌아가기" 허용 |
| 가문 범위 | 성씨만 / 가문 평판·재산까지 |
| NPC 속죄가 살아 있는 세계에 주는 영향 | 기본 없음(중간 공간 원칙). 필요하면 "징조" 정도 |

## 7. 로드맵

데이터 아키텍처의 S0(저장 버전, `worldId`, `ev.data`, 인물별 사건 색인)이 선행 조건이다.

| 단계 | 내용 | 주요 파일 |
|---|---|---|
| S1 | 죽음 데이터: `n.death`, 호출 11곳에 원인 종류, `lateSpouse`, `n.after`(기본 rest), `n.soul`, 저장 v4 이전 | engine.js, content.js, game.js, test.js |
| S2 | 행적 장부: `deed()` 헬퍼, `ev.data.moral`, `ledger`, 정리 대상에서 보호 | engine.js, game.js, story.js |
| S3 | 유산 1차: 금화, 플레이어 소지품, 유고 두루마리 (주민의 금화·소지품 → 배우자·자녀는 생애 주기 작업에서 했다: engine `estate`. `n.lateSpouse`도 남긴다) | engine.js, game.js, content.js |
| S4a | 사후 화면 골격: 도착·회고 (기존 데이터만으로) | story.js, ui.js |
| S5 | 심판: `CONTENT.judgment` + `judge()` + 중립 연출 | engine.js, content.js, story.js |
| S5.5 | NPC 사후 자동 처리: `afterlifeStep`을 `upkeep`에, 속죄 기간, 영혼 대기열 | engine.js |
| S6 | 환생: `reincarnate`, `births()` 연결, 플레이어 출생 선택, `pastLives` | engine.js, game.js, ui.js |
| S7 | 속죄: 대안 A부터 | story.js, content.js |
| S8 | 자산 승계 2차(집·가게): 데이터 아키텍처 2단계 이후 | game.js, engine.js |
| 별도 트랙 | S4b 실시간 관전, S9 새 세계 + 보관 세계 열람 | ui.js |
| S10 | 가문·혈통 연결 | engine.js, ui.js |

권장 순서: S0 → S1 → S2 → S3 → S4a → S5 → S5.5 → S6 → S7 → (S4b·S9 별도) → S8 → S10.

## 8. 저장 호환 (v4)

| 옛 데이터 | 처리 |
|---|---|
| 사망자에 `after` 없음 | `{stage:"rest", fate:"rest", since: death_day}`. 단, 사망한 플레이어 인물은 `arrival`(다음에 사후 화면) |
| `soul` 없음 | `soul = id` |
| `death` 없음 | `death_cause` 문장과 사망 사건 `kind`로 추정, 실패하면 `unknown` |
| 배우자 기록 소실 | 남아 있는 `marriage` 사건으로 `lateSpouse` 복원 |
| `ledger` 없음 | 남은 사건으로 한 번 집계 (정리된 사건은 복원 불가) |
| 시체에 남은 금화 | 그대로 (과거를 바꾸지 않음) |
