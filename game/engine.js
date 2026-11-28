/* 탄드렐 세계 시뮬레이션 엔진 (Python 프로토타입의 JavaScript 이식판)
 * - 모든 일은 Event로 기록되고 cause로 이어진다 (이야기의 축적)
 * - 플레이어도 controller === "player"인 NPC 하나다 (플레이어의 자유)
 * - 세계 상태 전체를 JSON으로 저장/불러오기 할 수 있다
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------ 콘텐츠 (데이터로 확장)
  const CONTENT = {
    races: [
      { id: "human", name: "인간", lifespan: [60, 80], adultAge: 16, magic: 0.3, traits: { ambition: 0.1 }, look: { skin: ["#f6d3b3", "#eec09a", "#d9a47c", "#b97f57"] },
        names: ["아론","베아","카일","델리아","에반","그레타","한스","이리스","요한","카린","레오","마리","노엘","오스카","피아","루카스","세라","토마","유나","벤","클라라","다니엘","엠마","펠릭스","한나","올가","리나","마틴","소피","빌헬름"] },
      { id: "elf", name: "엘프", lifespan: [250, 350], adultAge: 30, magic: 0.8, traits: { kindness: 0.1, bravery: -0.05, ambition: -0.1 }, look: { skin: ["#f8e2cf", "#f1d6c0"], ears: "long", hair: ["#f0e2a8", "#e8e8e0", "#c9b27a", "#9fc7a8", "#d7b9e8"] },
        names: ["엘라린","실바","테리안","아엘","리아나","파엘","나엘","이실","로웬","셀린","엘로스","미리엘","타랄","니무엘","시안","아르웬디"] },
      { id: "dwarf", name: "드워프", lifespan: [130, 170], adultAge: 24, magic: 0.2, traits: { bravery: 0.15, greed: 0.1 }, look: { skin: ["#e8b48e", "#d99f7a"], beard: true, short: true, hair: ["#a8452c", "#6b3a20", "#3a2a20", "#c9c3b8", "#d99a3a"] },
        names: ["브롬","돌가","투린","하르가","김리크","보라","둔","케일다","모르겐","그렘","발린","도르","헬가","트로그","부르딘","아스크"] },
      { id: "beastkin", name: "수인", lifespan: [50, 70], adultAge: 14, magic: 0.3, traits: { bravery: 0.2, kindness: -0.05 }, look: { skin: ["#e9c49a", "#d8ab80"], ears: "animal", tail: true, hair: ["#c8823a", "#6b4a32", "#e8e0d0", "#3a3a3a", "#a86a3a"] },
        names: ["라칸","미르","카야","토가","루루","바쿠","시엔","오르카","제나","파오","코르","냐린","울프란","티카","가로","세바"] },
    ],
    /* 직업 하나는 이 한 줄에 모든 것을 담는다: 경제(income·food·entry_cost), 화면(color·icon), 일터(workplace),
     * 직업 기술(skill), 좋아하는 선물(likes), 부탁(ask), 일 이야기(talk). 새 직업은 content.js처럼 Asteria.extend로 더한다. */
    jobs: [
      { id: "farmer", name: "농부", income: [0.5, 2.0], food: 4.5, seasonal: true, entry_cost: 0, weight: 6, color: "#6f8f33", icon: "🌾", look: { hat: "straw" }, workplace: "fields",
        skill: { name: "풍년의 손길", hint: "작물에 쓰면 하루 더 자란다" }, likes: "pumpkin", ask: ["wood", 5, "울타리를 고쳐야 하는데 나무가 모자라요."],
        talk: { 봄: "올봄엔 씨앗이 잘 올라오네요. 순무가 벌써 고개를 내밀었어요.", 여름: "덥네요. 밀이 누렇게 익어 가요.", 가을: "가을걷이로 허리가 휘어요. 그래도 곳간이 차니 좋네요.", 겨울: "겨울엔 밭이 쉬니까 저도 좀 쉬어요." } },
      { id: "baker", name: "빵집 주인", income: [2.0, 4.0], food: 1.5, entry_cost: 40, weight: 1, start_text: "빵집을 열었다", color: "#efe2c4", icon: "🍞", look: { hat: "chef", apron: "#f4efe4" }, workplace: "market",
        skill: { name: "빵 굽기", hint: "밀 2개로 빵 3개를 굽는다" }, likes: "wheat", ask: ["wheat", 4, "밀이 떨어졌어요. 빵을 못 굽겠어요."],
        talk: "새벽부터 반죽했더니 팔이 떨어질 것 같아요. 밀만 넉넉하면 빵을 더 구울 텐데." },
      { id: "blacksmith", name: "대장장이", income: [2.5, 5.0], entry_cost: 60, weight: 1, war_bonus: 0.3, start_text: "대장간을 열었다", color: "#55555f", icon: "⚒️", look: { apron: "#5a3d28" }, workplace: "forge",
        skill: { name: "연마", hint: "사람에게 쓰면 무기를 손봐 준다" }, likes: "wood", ask: ["wood", 6, "용광로에 넣을 나무가 필요해요."],
        talk: "요즘 칼 주문이 많아요. 전쟁 때문이겠죠. 좋은 나무가 늘 모자라요." },
      { id: "merchant", name: "상인", income: [0.0, 9.0], entry_cost: 80, weight: 1, trader: true, start_text: "상단을 꾸렸다", color: "#3d6aa8", icon: "💰", look: { hat: "cap", trim: "#e2b84a" }, workplace: "market",
        skill: { name: "흥정", hint: "사람에게 쓰면 가방의 물건을 비싸게 판다" }, likes: "hide", ask: ["hide", 2, "가죽을 사 가겠다는 손님이 있는데 물건이 없어요."],
        talk: "요즘 곡식 값이 {price}닢이에요. 싸게 사서 비싸게 파는 게 장사죠." },
      { id: "guard", name: "경비병", income: [1.5, 3.0], entry_cost: 0, weight: 1, guard: true, fighter: true, color: "#8a2f2f", icon: "🛡️", look: { hat: "helmet", trim: "#c9ccd2" }, workplace: "guild",
        skill: { name: "체포", hint: "죄를 지은 사람에게 쓰면 붙잡는다" }, likes: "meal", ask: ["mushroom", 3, "야간 순찰 때 먹을 걸 좀 구해 줄래요?"],
        talk: "요즘 마을에 좀도둑이 늘었어요. 뭘 보면 길드에 알려 줘요." },
      { id: "adventurer", name: "모험가", income: [0.0, 7.0], entry_cost: 0, weight: 1, risk: 0.015, fighter: true, color: "#94652c", icon: "🧭", look: { hat: "bandana", trim: "#5a3d20" }, workplace: "guild",
        skill: { name: "추적", hint: "한동안 지도에 짐승이 보인다" }, likes: "meat", ask: ["meat", 3, "원정 갈 때 먹을 고기가 필요해."],
        talk: "숲 깊은 곳에 멧돼지 떼가 산다더군요. 길드 의뢰가 쏠쏠해요." },
      { id: "alchemist", name: "연금술사", income: [3.0, 7.0], entry_cost: 120, weight: 0.5, healer: true, start_text: "연금술 공방을 차렸다", color: "#7b4fa8", icon: "⚗️", look: { hat: "witch", trim: "#e2c25a" }, workplace: "temple",
        skill: { name: "약초 감별", hint: "약초·버섯을 두 배로 거둔다" }, likes: "herb", ask: ["herb", 4, "약초가 모자라서 약을 못 만들고 있어요."],
        talk: "약초가 늘 모자라요. 숲에서 보이면 좀 따다 줄래요?" },
      { id: "priest", name: "사제", income: [0.5, 2.0], entry_cost: 0, weight: 0.5, healer: true, color: "#e8e8e8", icon: "🕯️", look: { hat: "hood", trim: "#d9c26a" }, workplace: "temple",
        skill: { name: "치유의 기도", hint: "사람에게 쓰면 상처를 낫게 한다" }, likes: "flower", ask: ["flower", 3, "제단에 올릴 들꽃이 필요해요."],
        talk: "기도하러 오는 사람이 늘었어요. 다들 마음이 불안한가 봐요." },
    ],
    nations: { asteria: "탄드렐 왕국", ironhold: "철산 연맹", silvaren: "실바렌 숲의 나라" },
    housesPerTown: 5,
    /* 외형 기본값 (종족 look에 없을 때). 외형은 태어날 때 정해 n.look에 저장하고, 아이는 부모를 닮는다 */
    subjects: [],     // 경험의 대상 (content.js)
    innovations: [],  // 농법 (content.js)
    lookDefaults: { skin: ["#f1c9a5"], hair: ["#3b2a1e", "#7a4a26", "#d9b25a", "#a33a2a", "#2a2a2a", "#cfcfcf", "#5a3d7a"],
      styles: ["short", "long", "pony", "bun", "spiky", "bob"], eyes: ["#2a1e16", "#2b4a7a", "#3d6a3a", "#6a3a1a"] }, // 마을마다 주민 집 수 (game.js BUILD_DEF의 hid 1~5와 맞춘다)
    /* 마을: pos는 지도 타일 좌표(마을 중심), roads는 길로 이어진 마을. 지도는 마을 위치에 맞춰 넓어진다. */
    towns: [
      { id: "lumen", name: "루멘", nation: "asteria", population: 14, races: { human: 0.8, elf: 0.1, beastkin: 0.1 }, pos: [76, 62], roads: ["millbrook", "granok", "greytower", "silvaren"] },
      { id: "millbrook", name: "밀브룩", nation: "asteria", population: 11, races: { human: 0.7, beastkin: 0.3 }, job_bias: { farmer: 2 }, pos: [50, 92], roads: ["silvaren"] },
      { id: "granok", name: "그라녹", nation: "ironhold", population: 10, races: { dwarf: 0.9, human: 0.1 }, job_bias: { blacksmith: 3 }, pos: [118, 86], roads: ["greytower"] },
      { id: "silvaren", name: "실바렌", nation: "silvaren", population: 8, races: { elf: 1.0 }, job_bias: { alchemist: 3, priest: 2 }, pos: [30, 54], roads: ["greytower"] },
      { id: "greytower", name: "회색탑", nation: "asteria", population: 8, border: true, races: { human: 0.5, beastkin: 0.3, dwarf: 0.2 }, job_bias: { guard: 3, adventurer: 2 }, pos: [94, 32] },
    ],
    demonLords: ["마왕 그라즈무스", "마왕 벨리아스", "마왕 노크투르", "마왕 이자벨라", "마왕 모르드레크"],
    items: {},        // game.js의 아이템 표에 더해진다
    recipes: [],      // 만들기 (content.js)
    /* 직업의 일: {id, job, name, place(기본: 직업 일터), mins, energy, needs, gives, skill, sim, hint}.
     * sim은 game.js 등록표(Game.SIMS)의 처리 이름. 따로 적지 않은 직업은 '반나절 일하기'(sim: shift)가 붙는다 */
    works: [],
    renovations: [],  // 목수에게 맡기는 집 공사 (content.js)
    styles: { roof: {}, wall: {}, floor: {} }, // 공사로 고를 수 있는 지붕·벽·바닥
    /* 아직 아무 나라도 없는 땅. 야심 있는 주민이 이 중 한 곳에 새 나라를 세운다 (지도 타일 좌표) */
    frontier: [[186, 72], [100, 128], [192, 30], [154, 126], [56, 130], [202, 116]],
    nationNames: { pre: ["새벽", "은빛", "푸른", "붉은", "별빛", "바람", "들꽃", "황금", "서리", "해오름", "검은숲", "흰돌"], kind: { proud: ["왕국", "공국", "제국"], kind: ["자치령", "연맹", "자유도시"], plain: ["부족 연합", "공화국", "자유령"] },
      town: ["새벽골", "은빛나루", "바람언덕", "별무리", "들꽃마을", "해오름터", "서리목", "푸른여울", "흰돌성", "검은숲터", "황금들", "붉은재"] },
    npcs: [],         // 이름과 사연이 정해진 주민 {id, name, race, job, town, age, traits, dream, bio}
    dreams: [],       // NPC가 품는 삶의 꿈 (content.js)
    knowledge: [],    // 지식과 비술 {id, name, desc, lost}. 직업의 teaches로 배우거나, 두루마리·유적에서 얻거나, 스스로 깨닫는다
    loot: [],         // 유적·흙더미에서 나오는 것
    worldEvents: [],  // 플레이어와 상관없이 세계에 일어나는 일 (content.js)
    eventKinds: {},   // 사건 종류별 신문 지면 {kind: "사람들"|"전황"|...}
  };
  /* 마을 사이를 넓게: 콘텐츠의 마을 위치(pos)와 새 나라 후보지(frontier)에 곱한다. 팩의 마을도 extend에서 같게.
   * 바꾸면 저장 이전이 필요하다 (MIGRATIONS[8] 참고) */
  const SPREAD = 1.7;
  const spreadPos = (t) => { if (t.pos && !t._spread) { t.pos = t.pos.map((v) => Math.round(v * SPREAD)); t._spread = true; } return t; };
  CONTENT.towns.forEach(spreadPos);
  CONTENT.frontier = CONTENT.frontier.map((p) => p.map((v) => Math.round(v * SPREAD)));
  const RACES = {}, JOBS = {}, DREAMS = {};
  function reindex() {
    for (const [map, list] of [[RACES, CONTENT.races], [JOBS, CONTENT.jobs], [DREAMS, CONTENT.dreams]]) {
      for (const k of Object.keys(map)) delete map[k];
      for (const x of list) map[x.id] = x;
    }
  }
  /** 콘텐츠 팩을 더한다. 같은 id가 있으면 덮어쓰고(필드 병합), 없으면 새로 붙인다.
   *  pack: { races, jobs, dreams, worldEvents, items, eventKinds, demonLords } */
  function extend(pack) {
    for (const t of pack.towns || []) spreadPos(t);
    for (const key of ["races", "jobs", "dreams", "worldEvents", "towns", "recipes", "works", "npcs", "knowledge", "loot", "renovations", "subjects", "innovations"]) {
      for (const x of pack[key] || []) {
        const i = CONTENT[key].findIndex((y) => y.id === x.id);
        if (i >= 0) CONTENT[key][i] = { ...CONTENT[key][i], ...x }; else CONTENT[key].push(x);
      }
    }
    Object.assign(CONTENT.items, pack.items || {});
    Object.assign(CONTENT.nations, pack.nations || {});
    for (const k of ["roof", "wall", "floor"]) Object.assign(CONTENT.styles[k], (pack.styles || {})[k] || {});
    Object.assign(CONTENT.eventKinds, pack.eventKinds || {});
    if (pack.demonLords) CONTENT.demonLords.push(...pack.demonLords);
    reindex();
  }
  reindex();

  const DPS = 30, DPY = 120, ADULT = 16;
  const SEASONS = ["봄", "여름", "가을", "겨울"];
  const HARVEST = { 봄: 1.0, 여름: 1.2, 가을: 2.0, 겨울: 0.2 };

  // ------------------------------------------------------------ 한국어 조사
  function batchim(w) {
    const c = w.charCodeAt(w.length - 1);
    return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  }
  function jo(w, pair) {
    const [a, b] = pair.split("/");
    const bt = batchim(w);
    if (pair === "으로/로" && bt === 8) return w + b;
    return w + (bt ? a : b);
  }

  // ------------------------------------------------------------ 저장 가능한 난수
  class RNG {
    constructor(s) { this.s = s >>> 0 || 1; }
    next() {
      let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    uniform(a, b) { return a + (b - a) * this.next(); }
    randint(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    choice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    choices(arr, weights) {
      const total = weights.reduce((s, x) => s + x, 0);
      let r = this.next() * total;
      for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
      return arr[arr.length - 1];
    }
    gauss(mu, sd) {
      const u = 1 - this.next(), v = this.next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    }
    sample2(arr) { const a = this.choice(arr); let b = this.choice(arr); while (b === a && arr.length > 1) b = this.choice(arr); return [a, b]; }
  }

  const maxBy = (arr, f) => arr.reduce((best, x) => (best === null || f(x) > f(best) ? x : best), null);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ------------------------------------------------------------ NPC 도우미
  const age = (n) => Math.floor(n.age_days / DPY);
  /* 종족마다 성인이 되는 나이가 다르다 (race.adultAge, 없으면 16). 성인이 된 사람은 n.grown = true로 남는다
   * (규칙이 바뀌어도 이미 어른인 사람이 아이로 돌아가지 않게) */
  const adultAge = (race) => (RACES[race] && RACES[race].adultAge) || ADULT;
  const isAdult = (n) => (n.grown !== undefined ? n.grown : age(n) >= adultAge(n.race));
  /* 한평생 가운데 어디쯤인가 (0 = 갓난아이, 1 = 타고난 수명). 0.75를 넘으면 늙은이로 본다 */
  const lifeFrac = (n) => n.age_days / DPY / Math.max(1, n.lifespan);
  const isElder = (n) => isAdult(n) && lifeFrac(n) >= 0.75;
  /** 늙으면 몸이 예전 같지 않다: 회복할 수 있는 체력의 끝 */
  const healthCap = (n) => (isAdult(n) ? clamp(10 - Math.max(0, lifeFrac(n) - 0.7) * 16, 4, 10) : 10);
  function family(n) {
    const f = new Set([...n.parents, ...n.children]);
    if (n.spouse !== null) f.add(n.spouse);
    return f;
  }
  const opinion = (n, id) => n.rel[id] || 0;
  /* 기술: n.skills{지식 id: {lv, xp}}. lv 0은 익히는 중(혼자 거듭하는 중), 1부터 안다.
   * 직업을 가지면 그 직업이 가르치는 기술을 익히고, 직업을 바꿔도 남는다. 일할수록 xp가 쌓여 솜씨(lv)가 오른다. */
  const SKILL_LV = [0, 120, 360, 840];                 // lv 1·2·3·4가 되는 xp (일한 날 수쯤)
  const SKILL_LV_NAME = ["", "기초", "능숙", "숙련", "명인"];
  const skillOf = (n, k) => (n.skills && n.skills[k]) || null;
  const skillLv = (n, k) => { const s = skillOf(n, k); return s ? s.lv : 0; };
  function knows(n, k) { return skillLv(n, k) >= 1; }
  function learn(n, k, from) { if (knows(n, k)) return false; n.skills = n.skills || {}; n.skills[k] = { lv: 1, xp: (n.skills[k] || {}).xp || 0 }; if (from) n.skills[k].from = from; return true; }
  /** 기술에 경험을 더한다. 익히는 중(lv 0)이면 need에 이르렀을 때 안다(true를 돌려줌) */
  function addXp(n, k, x, need) {
    n.skills = n.skills || {};
    const s = n.skills[k] || (n.skills[k] = { lv: 0, xp: 0 });
    s.xp += x;
    if (s.lv === 0) { if (need !== undefined && s.xp >= need) { s.lv = 1; return true; } return false; }
    while (s.lv < SKILL_LV.length && s.xp >= SKILL_LV[s.lv]) s.lv++;
    return false;
  }
  const knownSkills = (n) => Object.keys(n.skills || {}).filter((k) => n.skills[k].lv >= 1);
  /** 남에게 퍼뜨리는 기술: 직업으로 익힌 것(from: "job")은 일로 배우는 것이라 소문처럼 퍼지지 않는다 */
  const sharedSkills = (n) => knownSkills(n).filter((k) => n.skills[k].from !== "job");
  /** 직업을 바꾼다. 새 직업이 가르치는 기술을 익힌다(이전 직업에서 익힌 것은 그대로 남는다) */
  function setJob(n, id) { n.job = id; for (const k of (JOBS[id] && JOBS[id].teaches) || []) learn(n, k, "job"); }
  /* ---------------------------------------------------------------- 업무와 조작 부품
   * 업무(work)는 단계(steps)의 나열이고, 단계는 조작 부품(tool) 하나와 그 값(p)이다. 함수가 없어 저장할 수 있다.
   *   { id, job, name, place, mins, energy, needs, gives, skill, steps: [{ name, tool, p, w }] }
   * 조작 부품은 두 얼굴을 가진다.
   *   - 자동(TOOL_AUTO, 여기): 주민이 일할 때, 플레이어가 '맡기기'를 고를 때 점수를 계산한다
   *   - 조작 화면(sims.js의 Sims.register): 플레이어가 직접 한다
   * 둘 다 있는 부품만 쓰는 업무가 '준비된' 업무다. 플레이어에게는 준비된 업무가 있는 직업만 열린다. */
  const TOOL_AUTO = {}, TOOL_DOMAINS = {};
  /** 조작 부품의 자동 점수 모델을 더한다: (p, lv, rng, n) → 0~1. domains: 이 부품이 어울리는 분야 */
  function registerTool(id, auto, domains) { TOOL_AUTO[id] = auto; if (domains) TOOL_DOMAINS[id] = domains; }
  /* 분야(domain): craft 손기술 · heat 불 · art 꾸밈 · body 몸 · language 언어 · social 사람 대하기 · knowledge 앎 · care 돌봄 · nature 자연 · magic 마법
   * 지식(knowledge)도 domain을 가진다. 세계에서 새 직업이 생길 때 지식의 분야에 맞는 부품으로 업무를 조립한다 (genesis) */
  // 단계 점수 = 솜씨 + 성격 - 어려움 + 작은 흔들림. 그날의 컨디션은 autoScores가 모든 단계에 함께 더한다
  const baseAuto = (hard, trait) => (p, lv, rng, n) => clamp(0.4 + 0.11 * lv - (p && p.hard !== undefined ? p.hard : hard) + (rng.next() + rng.next() - 1) * 0.12 + (n ? (n.traits[trait || "ambition"] - 0.5) * 0.1 : 0), 0, 1);
  for (const [id, hard, doms, trait] of [
    ["gauge", 0.05, ["craft", "heat", "care", "nature", "magic"]], ["rhythm", 0.08, ["craft", "body", "art", "nature"]], ["timing", 0.06, ["craft", "heat", "body", "nature"]],
    ["measure", 0.04, ["craft", "knowledge", "care", "heat"]], ["trace", 0.1, ["craft", "art", "magic"]], ["grind", 0.05, ["craft", "body", "art"]],
    ["talk", 0.04, ["social", "language", "care"], "kindness"], ["observe", 0.06, ["knowledge", "care", "nature", "art"]],
    ["memory", 0.08, ["knowledge", "language", "magic", "social"]], ["match", 0.07, ["language", "knowledge", "magic"]],
    ["react", 0.08, ["body", "war"], "bravery"],
  ]) registerTool(id, baseAuto(hard, trait), doms);
  /** 품질 단계: 점수(0~1) → 이름·결과 배수 */
  const GRADES = [{ id: "rough", name: "거친", at: 0, mult: 0.5 }, { id: "plain", name: "보통", at: 0.4, mult: 1 }, { id: "good", name: "좋은", at: 0.7, mult: 1.25 }, { id: "master", name: "걸작", at: 0.9, mult: 1.5 }];
  const gradeOf = (q) => GRADES.filter((g) => q >= g.at).pop();
  const stepsOf = (wk) => wk.steps || [];
  const toolsOf = (wk) => [...new Set(stepsOf(wk).map((s) => s.tool))];
  /** 이 업무에 쓰는 솜씨 단계: 업무의 기술, 없으면 직업 기술 중 가장 높은 것 */
  function workLv(n, wk) {
    if (wk.skill) return Math.max(1, skillLv(n, wk.skill));
    const t = (JOBS[wk.job] && JOBS[wk.job].teaches) || [];
    return t.length ? Math.max(1, ...t.map((k) => skillLv(n, k))) : 1;
  }
  /** 단계별 점수 → 전체 품질 (단계의 무게 w, 기본 1) */
  function workQuality(wk, scores) {
    const st = stepsOf(wk); let sum = 0, tw = 0;
    st.forEach((s, i) => { const wt = s.w || 1; sum += (scores[i] || 0) * wt; tw += wt; });
    return tw ? sum / tw : 0.5;
  }
  /** 자동으로 한 단계씩 점수를 낸다 (주민, 맡기기). 부품이 없으면 null */
  function autoScores(n, wk, rng, penalty = 0) {
    const lv = workLv(n, wk), form = (rng.next() + rng.next() - 1) * 0.16; // 그날의 컨디션
    return stepsOf(wk).map((s) => (TOOL_AUTO[s.tool] ? clamp(TOOL_AUTO[s.tool](s.p || {}, lv, rng, n) + form - penalty, 0, 1) : null));
  }
  const workAutoReady = (wk) => toolsOf(wk).every((t) => TOOL_AUTO[t]);

  /* 업무의 손님과 결과 (봉사하는 일). 함수 없이 데이터로 적는다.
   *  client: "any" | "sick"(다친·아픈 사람) | "race:<종족>" | "foreign"(다른 나라 사람) | "poor"
   *  effects: { gold: [최소, 최대] (손님이 내고, 품질을 곱함), heal: 체력, rel: 손님 마음, bond: 손님 종족 ↔ 이 마을 사람들의 마음,
   *             fame: 걸작일 때 명성, food: 마을 곳간, record: { kind, text, imp, p } }
   *  record.text 자리: {me} {client} {town} {work} {race} — 좋은 솜씨 이상일 때 p의 확률로 소식이 된다 */
  function clientOk(w, n, m, cond) {
    if (!m.alive || m.id === n.id || m.at_war || !isAdult(m)) return false;
    if (!cond || cond === "any") return true;
    if (cond === "sick") return m.health < 9 || age(m) >= m.lifespan * 0.75; // 몸이 좀 안 좋거나 나이가 많은 사람
    if (cond === "poor") return m.gold < 10;
    if (cond === "foreign") return (w.towns[m.home] || {}).nation !== (w.towns[n.town] || {}).nation;
    if (cond.startsWith("race:")) return m.race === cond.slice(5);
    return false;
  }
  /** 이 업무의 손님. 같은 마을에서 가장 필요한 사람 (없으면 null) */
  function workClient(w, n, wk) {
    if (!wk.client) return null;
    // 아픈 사람·가난한 사람은 같은 마을에서, 다른 종족·다른 나라 사람은 세계 어디서든 (말을 옮기고 잇는 일은 멀리서도 맡는다)
    const far = wk.client === "foreign" || wk.client.startsWith("race:");
    const c = w.npcs.filter((m) => (far || m.town === n.town) && !m.outside && clientOk(w, n, m, wk.client));
    if (!c.length) return null;
    return c.sort((a, b) => (a.town === n.town ? 0 : 1) - (b.town === n.town ? 0 : 1) || (wk.client === "sick" ? a.health - b.health : 0) || opinion(b, n.id) - opinion(a, n.id) || a.id - b.id)[0];
  }
  /** 자리 채우기: {me}, 조사가 붙으면 {me:이/가}, 조사만 {me~이/가} */
  const fill = (t, o) => t.replace(/\{(\w+)(?:([:~])([^}]+))?\}/g, (_, k, sep, pair) => { const v = o[k] !== undefined ? String(o[k]) : ""; if (!pair || !v) return v; const j = jo(v, pair); return sep === "~" ? j.slice(v.length) : j; });
  /** 업무의 결과를 세계에 남긴다. 반환: 결과를 적은 짧은 말들 */
  function applyEffects(w, n, wk, q, client) {
    const fx = wk.effects || {}, out = [], g = gradeOf(q);
    if (fx.gold) { const v = Math.round((fx.gold[0] + (fx.gold[1] - fx.gold[0]) * q) * 10) / 10, payer = client && client.gold >= v ? client : null; if (payer) payer.gold -= v; n.gold += v; out.push(`금화 ${v}닢`); }
    if (fx.heal && client) { const h0 = client.health; client.health = Math.min(healthCap(client), client.health + fx.heal * (0.4 + q)); treat(w, client, 2 + Math.round(q * 2)); out.push(`${client.name}의 체력 +${Math.round((client.health - h0) * 10) / 10}`); }
    if (fx.rel && client) { adjust(client, n.id, Math.round(fx.rel * (0.3 + q))); out.push(`${client.name}의 마음이 열렸다`); }
    if (fx.bond && client) {
      const k = Math.round(fx.bond * q);
      for (const a of w.residents(n.town)) if (a.race !== client.race) { adjust(a, client.id, k); adjust(client, a.id, k); }
      out.push(`${(RACES[client.race] || {}).name || "손님"}과 마을 사람들 사이가 가까워졌다`);
    }
    if (fx.food) { const t = w.towns[n.town]; if (t) t.food += fx.food * q; }
    if (fx.fame && g.id === "master") n.fame += fx.fame;
    if (fx.record && q >= 0.7 && w.rng.next() < (fx.record.p ?? 0.25)) {
      const o = { me: n.name, client: client ? client.name : "", town: (w.towns[n.town] || {}).name, work: wk.name, race: client ? (RACES[client.race] || {}).name : "" };
      w.record(fx.record.kind || "service", fill(fx.record.text, o), { actor: n.id, target: client ? client.id : null, town: n.town, imp: fx.record.imp || 3, wr: 0.3, data: { work: wk.id, q: Math.round(q * 100) / 100 } });
    }
    return out;
  }

  /** 이 직업이 하는 일 목록. 일터(place)는 따로 적지 않으면 직업의 일터 */
  function worksOf(jobId) {
    const j = JOBS[jobId];
    if (!j) return [];
    const place = j.workplace || "square";
    const list = CONTENT.works.filter((x) => x.job === jobId).map((x) => ({ place, mins: 240, energy: 20, sim: x.steps ? "steps" : "shift", ...x }));
    if (j.shift !== false && !list.some((x) => x.sim === "shift")) list.unshift( // shift: false면 기본 일을 붙이지 않는다 (업무가 준비돼야만 열리는 직업)
      { id: "shift_" + jobId, job: jobId, name: "반나절 일하기", place, mins: 240, energy: 20, sim: "shift", hint: `${jo(j.name, "으로/로")}서 일한다` });
    return list;
  }
  /** 직업 솜씨: 직업이 가르치는 기술 중 가장 높은 단계. 수입에 곱한다 */
  function mastery(n) { const t = (JOBS[n.job] && JOBS[n.job].teaches) || []; const lv = t.length ? Math.max(...t.map((k) => skillLv(n, k))) : 1; return 1 + 0.06 * Math.max(0, lv - 1); }
  const A_adjust = (n, id, d) => adjust(n, id, d);
  const KNOW = (id) => CONTENT.knowledge.find((k) => k.id === id) || { id, name: id };
  function adjust(n, id, d) { if (id === n.id) return; n.rel[id] = clamp(opinion(n, id) + d, -100, 100); }

  // ================================================================ 저장 형식의 버전과 이전
  /* 저장 형식을 바꿀 때: SAVE_VERSION을 올리고, 옛 버전 → 새 버전으로 바꾸는 함수를 MIGRATIONS에 더한다.
   * deserialize는 저장된 버전부터 차례로 적용한다. 저장 키(asteria.*)와 format 문자열은 바꾸지 않는다. */
  const SAVE_VERSION = 10;
  /* 플레이어로 살며 생기는 상태가 어디에 사는가 (game.js의 ext()가 이 표대로 나눠 담는다)
   *  land: 세계에 남는 흔적 · session: 화면·조작 · 나머지: 그 인물의 것(n.ext). 인물이 바뀌어도 인물의 것은 그 인물에게 남는다 */
  const EXT_STORE = { farm: "land", picked: "land", removed: "land", looted: "land", mw: "land", respread: "land", board: "land", chickenGone: "land", v: "land",
    facing: "session", trail: "session" };
  const extStore = (k) => EXT_STORE[k] || "char";
  const newWorldId = (seed) => `w${(seed >>> 0).toString(36)}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1679616).toString(36).padStart(4, "0")}`;
  const MIGRATIONS = {
    // v2 → v3: 세계 식별자. 사건의 data는 없던 칸이라 그대로 비어 있다
    2: (d) => ({ ...d, worldId: d.worldId || newWorldId(d.seed), version: 3 }),
    // v3 → v4: 마을의 나라가 이름 문자열이던 것을 id로. 이 세계에서 생긴 나라는 n1, n2…
    3: (d) => {
      const byName = { "아스테리아 왕국": "asteria" }, nations = {}; // 옛 이름(이름을 바꾸기 전)
      for (const [id, name] of Object.entries(CONTENT.nations)) byName[name] = id;
      let k = 0;
      const idOf = (name) => { if (!name) return null; if (!byName[name]) { do k++; while (CONTENT.nations["n" + k]); byName[name] = "n" + k; } return byName[name]; };
      const add = (id, o) => { if (id && !nations[id]) nations[id] = { id, since: 0, founder: null, from: null, ...o }; };
      for (const f of d.founded || []) { f.nation = idOf(f.nationName); add(f.nation, { name: f.nationName, since: f.day, founder: f.founder }); }
      const towns = {};
      for (const [tid, t] of Object.entries(d.towns)) {
        const id = idOf(t.nation), indep = t.indep ? { ...t.indep, from: idOf(t.indep.from) } : null;
        add(id, { name: CONTENT.nations[id] || t.nation, since: indep ? indep.day : 0, founder: indep ? indep.founder : null, from: indep ? indep.from : null });
        towns[tid] = { ...t, nation: id, indep };
      }
      // 마을이 하나도 남지 않은 나라는 사라진 나라다 (이어받은 나라가 독립한 날에 끝난 것으로)
      for (const N of Object.values(nations)) if (!Object.values(towns).some((t) => t.nation === N.id) && !CONTENT.nations[N.id]) {
        const heir = Object.values(towns).find((t) => t.indep && t.indep.from === N.id);
        N.ended = heir ? heir.indep.day : d.day;
      }
      return { ...d, towns, nations, version: 4 };
    },
    // v4 → v5: 주민 집. 사는 집이 id 공식(1 + id % 5)이던 것을 인물 필드(house)로, 집 꾸밈(houseStyle)을 자산으로
    4: (d) => {
      const assets = {}, H = CONTENT.housesPerTown;
      for (const town of Object.keys(d.towns)) for (let h = 1; h <= H; h++) { const id = houseId(town, h); assets[id] = { id, kind: "house", town, hid: h, owner: null, style: {}, mods: {} }; }
      for (const [key, st] of Object.entries(d.houseStyle || {})) {
        const [town, hid] = key.split(":"), a = assets[houseId(town, hid)];
        if (!a) continue;
        const { dx, dw, dh, grown, ...style } = st;
        a.style = style; a.mods = Object.fromEntries(Object.entries({ dx, dw, dh, grown }).filter(([, v]) => v !== undefined));
      }
      const npcs = d.npcs.map((n) => ({ ...n, house: n.house !== undefined ? n.house : n.controller === "player" ? null : houseId(n.at_war ? n.home || n.town : n.town, 1 + (n.id % 5)) }));
      for (const a of Object.values(assets)) { // 주인: 그 집에 사는 가장 나이 많은 어른
        const res = npcs.filter((n) => n.alive && n.house === a.id && n.age_days >= ADULT * DPY).sort((x, y) => y.age_days - x.age_days);
        a.owner = res.length ? res[0].id : null;
      }
      const { houseStyle, ...rest } = d;
      return { ...rest, npcs, assets, version: 5 };
    },
    // v5 → v6: 플레이어 전용 덩어리(ext)를 세계(land)·화면(session)·인물(그 인물의 n.ext)로 나눈다
    5: (d) => {
      const land = {}, session = {}, char = {};
      for (const [k, v] of Object.entries(d.ext || {})) ({ land, session, char })[extStore(k)][k] = v;
      const pid = d.playerId ?? null;
      const npcs = d.npcs.map((n) => (n.id === pid && Object.keys(char).length ? { ...n, ext: { ...(n.ext || {}), ...char } } : n));
      const { ext, ...rest } = d;
      return { ...rest, npcs, land, session, version: 6 };
    },
    // v6 → v7: 혈통·외형·성인 표시·태어난 곳. 외형은 예전 그림 계산과 같아서 얼굴이 바뀌지 않는다
    6: (d) => {
      const npcs = d.npcs.map((n) => ({ ...n,
        grown: n.grown ?? n.age_days >= ADULT * DPY,
        heritage: n.heritage || heritageOf(n.race),
        look: n.look || makeLook(n),
        birthplace: n.birthplace || { town: n.home || n.town, nation: (d.towns[n.home || n.town] || {}).nation || null, day: null },
        culture: n.culture ?? ((d.towns[n.home || n.town] || {}).nation || null) }));
      return { ...d, npcs, version: 7 };
    },
    // v7 → v8: 지식(n.know + 지금 직업의 teaches)과 혼자 익히던 횟수(ext.stats)를 n.skills로 합친다
    7: (d) => {
      const npcs = d.npcs.map((n) => {
        const skills = { ...(n.skills || {}) };
        for (const k of n.know || []) skills[k] = skills[k] || { lv: 1, xp: 0 };
        for (const k of (JOBS[n.job] && JOBS[n.job].teaches) || []) skills[k] = skills[k] || { lv: 1, xp: 0, from: "job" };
        const st = (n.ext && n.ext.stats) || {};
        for (const K of CONTENT.knowledge) if (K.practice && st[K.practice.stat]) { const s = skills[K.id] || (skills[K.id] = { lv: 0, xp: 0 }); s.xp = Math.max(s.xp, st[K.practice.stat]); }
        const { know, ...rest } = n;
        let ext = n.ext;
        if (ext && ext.stats) { const { stats, ...e } = ext; ext = e; }
        return ext ? { ...rest, ext, skills } : { ...rest, skills };
      });
      return { ...d, npcs, version: 8 };
    },
    // v8 → v9: 마을 사이가 넓어졌다(SPREAD). 이 세계에서 세운 마을 자리도 같은 배수로 옮기고,
    // 땅에 남긴 기록(밭·벌목·채집·유적)과 플레이어 위치는 game.js가 가까운 마을 기준으로 옮긴다 (land.respread)
    8: (d) => {
      const founded = (d.founded || []).map((f) => ({ ...f, pos: f.pos ? f.pos.map((v) => Math.round(v * SPREAD)) : f.pos }));
      return { ...d, founded, land: { ...(d.land || {}), respread: SPREAD }, version: 9 };
    },
    // v9 → v10: 도토리골 팩(pack-greenhill)을 기본에서 뺐다. 그 팩으로 생긴 마을·종족·직업이 있는 세계는 그 세계만의 정의(defs)로 옮겨 살린다
    9: (d) => {
      const uses = (d.towns && d.towns.acorn) || (d.npcs || []).some((n) => n.race === "halfling" || n.job === "beekeeper");
      if (!uses || CONTENT.towns.some((t) => t.id === "acorn")) return { ...d, version: 10 };
      const defs = { jobs: [], works: [], knowledge: [], items: {}, races: [], ...(d.defs || {}) };
      const add = (key, x) => { if (!defs[key].some((y) => y.id === x.id)) defs[key].push(x); };
      add("races", { id: "halfling", name: "하플링", lifespan: [90, 120], adultAge: 20, magic: 0.25, traits: { kindness: 0.15, ambition: -0.1, bravery: -0.05 },
        look: { skin: ["#f6d1ad", "#eab98f"], short: true, curly: true, hair: ["#7a4a26", "#b8742e", "#d9a85a", "#4a3020"] },
        names: ["포피", "밀로", "로지", "빌보", "데이지", "토비", "페린", "머틀", "올리", "클로버", "호브", "피핀", "메리골드", "탐"], born: 0 });
      add("knowledge", { id: "beekeeping", name: "벌 치기", domain: ["nature", "craft"], desc: "벌통을 돌보고 꿀을 거둔다" });
      add("jobs", { id: "beekeeper", name: "양봉가", teaches: ["beekeeping"], income: [1.5, 3.5], food: 0.8, entry_cost: 20, weight: 0, color: "#e0b02a", workplace: "fields", look: { hat: "veil" }, born: 0 });
      defs.items = { honey: { name: "꿀", food: 1, energy: 14, sell: 12, art: ["jar", "#e0a830"] }, honey_cake: { name: "꿀 케이크", food: 4, energy: 30, sell: 28, art: ["cake", "#e8c070"] }, ...defs.items };
      const founded = [...(d.founded || [])];
      if (d.towns && d.towns.acorn && !founded.some((f) => f.id === "acorn"))
        founded.unshift({ id: "acorn", name: "도토리골", nation: "greenhill", nationName: "초록언덕 자치령", pos: [Math.round(140 * SPREAD), Math.round(62 * SPREAD)], roads: ["granok", "lumen"],
          races: { halfling: 0.8, human: 0.2 }, job_bias: { cook: 3, farmer: 2, beekeeper: 3 }, founder: null, day: 0 });
      return { ...d, defs, founded, version: 10 };
    },
  };
  function migrate(d) {
    let v = d.version || 2;
    while (v < SAVE_VERSION) {
      if (!MIGRATIONS[v]) throw new Error(`저장 형식 ${v}을 읽을 수 없습니다`);
      d = MIGRATIONS[v](d); v = d.version;
    }
    return d;
  }

  // ================================================================ World
  class World {
    constructor(seed) {
      this.seed = seed;
      this.defs = { jobs: [], works: [] }; applyDefs(this); // 세계에서 생긴 정의 (새 세계는 비어 있다)
      this.rng = new RNG(seed);
      this.name = "탄드렐";
      this.day = 0;
      this.towns = {};
      for (const t of CONTENT.towns) {
        this.towns[t.id] = { id: t.id, name: t.name, nation: t.nation, border: !!t.border,
          races: t.races, job_bias: t.job_bias || {}, start_pop: t.population, food: t.population * 15, fallen: false, seeded: false, x: t.pos[0], y: t.pos[1] };
      }
      /* 나라: 마을은 나라의 이름이 아니라 id를 가진다(town.nation). 이름·세운 때·세운 사람·갈라져 나온 나라는 여기에 */
      this.nations = {};
      for (const t of Object.values(this.towns)) ensureNation(this, t.nation);
      this.assets = {};         // 집 같은 자산 { "house:lumen:3": {kind, town, hid, owner, style, mods} }
      this.worldId = null;      // 세계 식별자 (newWorld에서 정한다. 창작물·기록이 어느 세계 것인지 가리킨다)
      this.npcs = [];
      this.events = [];
      this.byChar = new Map();  // 인물 id → 그 사람이 행위자·대상인 사건 id들 (저장하지 않고 다시 만든다)
      this.chronicle = [];
      this.pendingVows = [];
      this.usedNames = new Set();
      this.droughtUntil = -1;
      this.initialPop = 0;
      this.war = {};
      this.playerId = null;
      this.playerAction = null;
      this.autoDays = 0;
      this.onEvent = null;
      // 플레이어의 하루와 앎 (life.js가 사용)
      this.clock = 0;           // 06:00부터 흐른 분 (0~1440)
      this.dayOpen = false;
      this.queue = []; this.qi = 0;
      this.onDawn = null;
      this.ppos = null;         // 지도 위 플레이어 위치 {x, y}
      this.trail = 0;           // 마을 밖에서 걸은 걸음 수
      this.journal = [];        // 플레이어가 알게 된 이야기와 그 출처
      this.episodes = [];       // 플레이어의 선택을 기다리는 일들
      this.epSeq = 0;
      this.papers = [];         // 아침 신문
      this.lastPaper = 0;
      this.todayLog = [];       // 오늘 내가 한 일의 결과
      this.onLearn = null;      // (n, ev, src, via) 플레이어가 무언가를 알게 됐을 때
      this.onApproach = null;   // (npc, player) NPC가 플레이어에게 다가올 때
    }

    // ---- 시간
    get year() { return Math.floor(this.day / DPY) + 1; }
    get season() { return SEASONS[Math.floor((this.day % DPY) / DPS)]; }
    date(d = this.day) { return `${Math.floor(d / DPY) + 1}년 ${SEASONS[Math.floor((d % DPY) / DPS)]} ${(d % DPS) + 1}일`; }
    ago(d) {
      const diff = this.day - d;
      if (diff >= DPY) return `${Math.floor(diff / DPY)}년 전`;
      if (diff >= DPS) return `${Math.floor(diff / DPS)}계절 전`;
      return diff > 0 ? `${diff}일 전` : "같은 날";
    }
    harvestMult() { const m = HARVEST[this.season]; return this.day < this.droughtUntil ? m * 0.5 : m; }

    // ---- 조회
    job(n) { return JOBS[n.job]; }
    alive() { return this.npcs.filter((n) => n.alive); }
    residents(tid, adultsOnly = false) {
      return this.npcs.filter((n) => n.alive && n.town === tid && !n.at_war && !n.outside && !n.trip && !n.away && (!adultsOnly || isAdult(n)));
    }
    foodPrice(t) {
      const r = t.food / Math.max(1, this.residents(t.id).length);
      return r > 8 ? 1 : r > 3 ? 2 : 4;
    }
    jobName(n) { if (n.role === "hero") return "용사"; if (!isAdult(n)) return "아이"; return JOBS[n.job].name; }
    label(n) { return `${n.name}(${RACES[n.race].name} ${this.jobName(n)})`; }
    ev(id) { return id === null || id === undefined ? null : this.events[id] || null; }
    /** 이 사람의 생애 사건 (행위자이거나 대상). 정리된 사건은 빠진다 */
    lifeOf(id, minImp = 0) { return (this.byChar.get(id) || []).map((i) => this.events[i]).filter((e) => e && e.imp >= minImp); }
    indexEvent(ev) {
      for (const id of new Set([ev.actor, ev.target])) if (id !== null && id !== undefined) { let l = this.byChar.get(id); if (!l) this.byChar.set(id, (l = [])); l.push(ev.id); }
    }
    reindexEvents() { this.byChar = new Map(); for (const e of this.events) if (e) this.indexEvent(e); }
    get player() { return this.playerId === null ? null : this.npcs[this.playerId]; }

    // ---- 생성
    newName(race) {
      const pool = RACES[race].names;
      const free = pool.filter((x) => !this.usedNames.has(x));
      let name;
      if (free.length) name = this.rng.choice(free);
      else {
        for (let i = 0; i < 200; i++) {
          const [a, b] = this.rng.sample2(pool);
          name = a.slice(0, Math.max(1, a.length - 1)) + b.slice(-1);
          if (!this.usedNames.has(name)) break;
        }
      }
      this.usedNames.add(name);
      return name;
    }
    randomTraits(race) {
      const bias = RACES[race].traits || {};
      const t = {};
      for (const k of ["greed", "kindness", "bravery", "ambition"]) t[k] = clamp(this.rng.next() + (bias[k] || 0), 0, 1);
      return t;
    }
    /** 이 세계에 있는 직업인가 (emerge가 붙은 직업은 누군가 처음 시작해야 생긴다) */
    jobOpen(id) { const j = JOBS[id]; return !!j && !j.ended && (!j.emerge || (this.jobsOpen || []).includes(id)); }
    openJobs() { return CONTENT.jobs.filter((j) => this.jobOpen(j.id)); }
    pickJob(town) {
      const ids = Object.keys(JOBS).filter((id) => this.jobOpen(id));
      return this.rng.choices(ids, ids.map((j) => JOBS[j].weight * (town.job_bias[j] || 1)));
    }
    spawn(tid, { race = null, job = null, ageYears = null, name = null } = {}) {
      const town = this.towns[tid];
      race = race || this.rng.choices(Object.keys(town.races), Object.values(town.races));
      const r = RACES[race];
      if (ageYears === null) ageYears = this.rng.randint(adultAge(race), Math.max(adultAge(race) + 1, Math.floor(r.lifespan[0] * 0.7)));
      const n = {
        id: this.npcs.length, name: name || this.newName(race), race, job: job || this.pickJob(town),
        town: tid, home: tid, traits: this.randomTraits(race),
        age_days: ageYears * DPY + this.rng.randint(0, DPY - 1), lifespan: this.rng.randint(r.lifespan[0], r.lifespan[1]),
        gold: this.rng.uniform(5, 40), hunger: 0, health: 10, alive: true, death_day: null, death_cause: null,
        rel: {}, mem: [], known: new Set(), spouse: null, parents: [], children: [], goal: null, fame: 0,
        at_war: false, service_left: 0, role: null, jail: 0, job_cooldown: 0, flags: new Set(),
        controller: "ai", vowed: {}, lover: null, outside: false,
        dream: null, stat: { help: 0, towns: [tid] }, house: null,
        grown: ageYears >= adultAge(race),
        heritage: heritageOf(race),                                  // 혈통 {종족: 비율}
        birthplace: { town: tid, nation: town.nation, day: this.day }, // 태어난 곳 (이 세계에 처음 나타난 곳)
        culture: town.nation,                                        // 자란 문화권 (지금은 자란 곳의 나라)
        skills: {},                                                  // 기술 {id: {lv, xp}}
      };
      n.look = makeLook(n);
      for (const k of r.knows || []) learn(n, k, "race"); // 종족이 태어날 때부터 아는 것 (예: 용족의 말)
      if (n.grown) {
        setJob(n, n.job);
        // 처음부터 있던 어른은 일해 온 햇수만큼 솜씨가 있다 (해마다 일한 날의 절반쯤)
        const yrs = Math.max(0, ageYears - adultAge(race)) * this.rng.uniform(0.2, 0.7);
        for (const k of (JOBS[n.job] && JOBS[n.job].teaches) || []) addXp(n, k, Math.round(Math.min(yrs, 12) * DPY * 0.5));
      }
      this.npcs.push(n);
      settleIn(this, n, pickHouse(this, tid));
      return n;
    }
    populate() {
      for (const t of Object.values(this.towns)) for (let i = 0; i < t.start_pop; i++) this.spawn(t.id);
      for (const t of Object.values(this.towns)) {
        const people = this.residents(t.id);
        for (const a of people) for (const b of people) {
          if (a.id < b.id && this.rng.next() < 0.35) {
            const v = this.rng.gauss(10, 30);
            adjust(a, b.id, v + this.rng.gauss(0, 10));
            adjust(b, a.id, v + this.rng.gauss(0, 10));
          }
        }
        const singles = this.rng.shuffle(people.slice());
        for (let i = 0; i + 1 < singles.length; i += 2) {
          const a = singles[i], b = singles[i + 1];
          if (this.rng.next() < 0.3) { a.spouse = b.id; b.spouse = a.id; a.rel[b.id] = 70; b.rel[a.id] = 70; settleIn(this, b, a.house); }
        }
      }
      for (const t of Object.values(this.towns)) t.seeded = true;
      syncContent(this, true);
      for (const n of this.npcs) if (isAdult(n) && !n.dream) pickDream(n, this, true);
      this.initialPop = this.npcs.length;
    }

    // ---- 기억
    remember(n, ev, firsthand, via = null, src = null) {
      if (!n.alive || n.known.has(ev.id)) return false;
      n.known.add(ev.id);
      n.mem.push({ e: ev.id, s: 1, f: firsthand, v: via });
      if (ev.actor !== null && ev.actor !== n.id && ev.sent !== 0) {
        const w = firsthand ? 1 : 0.6;
        let d;
        if (ev.target === n.id) d = ev.sent * 3;
        else if (ev.target !== null && family(n).has(ev.target)) d = ev.sent * 3 * w;
        else if (ev.target !== null && opinion(n, ev.target) >= 40) d = ev.sent * 2 * w;
        else d = ev.sent * w * (0.3 + n.traits.kindness);
        adjust(n, ev.actor, d);
        if (ev.sent < 0 && !n.goal && n.controller !== "player" && opinion(n, ev.actor) <= -65 && this.npcs[ev.actor].alive
            && this.day - (n.vowed[ev.actor] ?? -1e9) > 240
            && n.traits.bravery + (1 - n.traits.kindness) > 1.0) {
          n.goal = { type: "revenge", target: ev.actor, origin: ev.id, vow: null, wait: 0 };
          n.vowed[ev.actor] = this.day;
          this.pendingVows.push([n.id, ev.id]);
        }
      }
      if (n.controller === "player" && n.id === this.playerId && this.onLearn) {
        const kind = src || (ev.actor === n.id || ev.target === n.id ? "self" : firsthand ? "seen" : "told");
        this.onLearn(n, ev, kind, via);
      }
      return true;
    }

    // ---- 사건
    record(kind, text, o = {}) {
      const { actor = null, target = null, town = null, imp = 1, sent = 0, cause = null, wr = 0.25, notify = [], secret = null, data = null } = o;
      // data: 문장(text)과 별개로 남기는 구조화 값. 예: career {from, to}, learn {skill}. 연대기·생애·심판이 문장 대신 이것을 읽는다
      const ev = { id: this.events.length, day: this.day, kind, text, actor, target, town, imp, sent, cause, secret, data };
      this.events.push(ev);
      this.indexEvent(ev);
      if (imp >= 7) this.chronicle.push(ev.id);
      const inv = new Set([actor, target].filter((x) => x !== null));
      for (const i of inv) this.remember(this.npcs[i], ev, true);
      for (const i of notify) if (!inv.has(i)) this.remember(this.npcs[i], ev, true);
      if (town && wr > 0) for (const n of this.residents(town)) if (!inv.has(n.id) && this.rng.next() < wr && !n.asleep) this.remember(n, ev, true);
      if (this.onEvent) this.onEvent(ev);
      this.flushVows();
      return ev;
    }
    flushVows() {
      while (this.pendingVows.length) {
        const [nid, oid] = this.pendingVows.shift();
        const n = this.npcs[nid], origin = this.events[oid];
        if (!n.alive || !n.goal || n.goal.vow !== null) continue;
        const enemy = this.npcs[n.goal.target];
        const vow = this.record("vow", `${jo(n.name, "이/가")} ${enemy.name}에게 복수를 다짐했다 (원인: ${origin.text})`,
          { actor: n.id, town: n.town, imp: 4, cause: origin.id, wr: 0.1 });
        n.goal.vow = vow.id;
      }
    }
    die(n, how, { killer = null, imp = 4, cause = null, kind = "death", demon = false } = {}) {
      if (!n.alive) return null;
      n.alive = false; n.death_day = this.day; n.death_cause = how;
      const fam = family(n);
      const mourners = this.alive().filter((m) => opinion(m, n.id) >= 50 || fam.has(m.id)).map((m) => m.id);
      if (n.controller !== "player") mourn(this, n); // 가족의 슬픔 (배우자 기록이 지워지기 전에)
      const late = n.spouse;
      if (n.spouse !== null && this.npcs[n.spouse].alive) { const s = this.npcs[n.spouse]; s.spouse = null; s.flags.add("widowed"); s.lateSpouse = n.id; }
      if (n.fame >= 10) imp = Math.max(imp, 7);
      const ev = this.record(kind, `${jo(n.name, "이/가")} ${how} 세상을 떠났다`,
        { actor: killer, target: n.id, town: n.town, imp, sent: killer !== null ? -20 : 0, cause, wr: 0.5, notify: mourners });
      passHouses(this, n, ev); // 그 사람이 주인이던 집은 같은 집 식구에게 넘어간다 (배우자 → 자녀 → 다른 식구)
      if (n.controller !== "player") { const s0 = n.spouse; n.spouse = late; estate(this, n, ev); n.spouse = s0; } // 금화·소지품은 배우자 → 자녀
      if (demon) for (const mid of mourners) { const m = this.npcs[mid]; m.flags.add("demon_grudge"); m.traits.bravery = Math.min(1, m.traits.bravery + 0.1); }
      if (killer !== null) {
        const k = this.npcs[killer];
        k.flags.add("killer");
        const guards = this.residents(k.town, true).filter((g) => JOBS[g.job].guard);
        if (k.alive && guards.length && this.rng.next() < 0.6) {
          const dests = Object.values(this.towns).filter((t) => t.id !== k.town && !t.fallen);
          if (dests.length) {
            const dest = this.rng.choice(dests), old = this.towns[k.town].name;
            this.move(k, dest.id, false);
            this.record("exile", `${jo(k.name, "이/가")} 살인죄로 ${old}에서 추방되어 ${jo(dest.name, "으로/로")} 떠났다`,
              { actor: k.id, town: dest.id, imp: 6, cause: ev.id, wr: 0.3 });
          }
        }
      }
      return ev;
    }
    move(n, tid, withFamily = true) {
      if (n.town === tid && n.house) return; // 이미 그 마을에 산다
      const old = n.town, house = n.controller === "player" ? null : pickHouse(this, tid);
      n.town = tid;
      if (house) settleIn(this, n, house);
      if (withFamily) for (const fid of family(n)) {
        const f = this.npcs[fid];
        if (f.alive && f.town === old && !f.at_war && f.controller !== "player" && (fid === n.spouse || !isAdult(f))) { f.town = tid; if (house) settleIn(this, f, house); }
      }
    }

    // ================================================================ 저장 / 불러오기
    /** 저장용 JSON 문자열. 아무도 기억하지 않는 사소한 옛 사건은 정리해 크기를 줄인다. */
    serialize() {
      const keep = new Set(this.chronicle);
      for (const j of this.journal) keep.add(j.e);
      for (const p of this.papers) for (const id of p.items) keep.add(id);
      for (const ep of this.episodes) if (ep.ev !== null && ep.ev !== undefined) keep.add(ep.ev);
      for (const n of this.npcs) {
        for (const m of n.mem) keep.add(m.e);
        if (n.goal) { keep.add(n.goal.origin); if (n.goal.vow !== null) keep.add(n.goal.vow); }
      }
      const recent = this.day - 2 * DPY;
      for (const e of this.events) if (e && (e.imp >= 3 || e.day >= recent)) keep.add(e.id);
      // 남긴 사건이 가리키는 원인 사건도 남긴다 (사슬 보존)
      const stack = [...keep];
      while (stack.length) {
        const e = this.events[stack.pop()];
        if (e && e.cause !== null && !keep.has(e.cause)) { keep.add(e.cause); stack.push(e.cause); }
      }
      const events = this.events.map((e) => (e && keep.has(e.id)
        ? (e.data ? [e.day, e.kind, e.text, e.actor, e.target, e.town, e.imp, e.sent, e.cause, e.secret ?? null, e.data] : [e.day, e.kind, e.text, e.actor, e.target, e.town, e.imp, e.sent, e.cause, e.secret ?? null]) : 0));
      const memIds = new Set();
      for (const n of this.npcs) for (const m of n.mem) memIds.add(m.e);
      // 숫자는 반올림하지 않는다: 불러온 세계가 저장하지 않은 세계와 똑같이 이어지도록
      const npcs = this.npcs.map((n) => ({ ...n,
        mem: n.mem.map((m) => [m.e, m.s, m.f ? 1 : 0, m.v]),
        known: [...n.known].filter((id) => memIds.has(id)), flags: [...n.flags] }));
      const towns = Object.fromEntries(Object.entries(this.towns).map(([k, t]) => [k, { food: t.food, stock: t.stock || {}, agri: t.agri || null, store: t.store || 0, worry: !!t.worry, storeOpen: !!t.storeOpen, aidDay: t.aidDay ?? null, fallen: t.fallen, seeded: true, nation: t.nation, indep: t.indep || null }]));
      return JSON.stringify({
        format: "asteria-world", version: SAVE_VERSION, worldId: this.worldId,
        clock: this.clock, dayOpen: this.dayOpen, queue: this.queue, qi: this.qi, ppos: this.ppos, trail: this.trail, journal: this.journal, episodes: this.episodes, epSeq: this.epSeq,
        papers: this.papers, lastPaper: this.lastPaper, todayLog: this.todayLog, land: this.land || {}, session: this.session || {}, name: this.name, seed: this.seed, rng: this.rng.s, day: this.day,
        towns, nations: this.nations, npcs, events, chronicle: this.chronicle, war: { ...this.war, refused: [...(this.war.refused || [])] },
        droughtUntil: this.droughtUntil, usedNames: [...this.usedNames], initialPop: this.initialPop, worldLog: this.worldLog || {}, founded: this.founded || [], jobsOpen: this.jobsOpen || [], defs: this.defs, appts: this.appts || [], apptSeq: this.apptSeq || 0, trips: this.trips || [], tripSeq: this.tripSeq || 0, waiting: this.waiting || [], weather: this.weather || null, holiday: this.holiday || null, festivalToday: this.festivalToday || {}, lifeDone: this.lifeDone || 0, jobSeen: this.jobSeen || {}, lastGenesis: this.lastGenesis ?? null, raceGone: this.raceGone || [], racesSeen: this.racesSeen || null, assets: this.assets, innMods: this.innMods || {},
        playerId: this.playerId, autoDays: this.autoDays,
      });
    }
    static deserialize(json) {
      let d = typeof json === "string" ? JSON.parse(json) : json;
      if (d.format !== "asteria-world") throw new Error("탄드렐 세계 저장 파일이 아닙니다");
      d = migrate(d);
      const w = new World(d.seed);
      w.defs = d.defs || { jobs: [], works: [] }; applyDefs(w); w.jobSeen = d.jobSeen || {}; w.weather = d.weather || null; w.appts = d.appts || []; w.apptSeq = d.apptSeq || 0; w.trips = d.trips || []; w.tripSeq = d.tripSeq || 0; w.waiting = d.waiting || []; w.holiday = d.holiday || null; w.festivalToday = d.festivalToday || {}; w.lifeDone = d.lifeDone || 0; w.lastGenesis = d.lastGenesis ?? null; w.raceGone = d.raceGone || [];
      w.worldId = d.worldId;
      w.name = d.name || "탄드렐";
      for (const def of d.founded || []) addTown(w, def); // 저장된 마을 상태를 덮어쓰기 전에 세운 나라의 마을을 만든다
      w.rng.s = d.rng >>> 0;
      w.day = d.day;
      for (const [k, t] of Object.entries(d.towns)) if (w.towns[k]) Object.assign(w.towns[k], t, { seeded: true });
      w.nations = { ...w.nations, ...(d.nations || {}) };
      for (const t of Object.values(w.towns)) ensureNation(w, t.nation); // 콘텐츠 팩이 새로 더한 나라
      w.events = d.events.map((e, id) => (e === 0 || e === null ? null : {
        id, day: e[0], kind: e[1], text: e[2], actor: e[3], target: e[4], town: e[5], imp: e[6], sent: e[7], cause: e[8], secret: e[9] ?? null, data: e[10] ?? null }));
      w.reindexEvents();
      w.npcs = d.npcs.map((n) => ({ lover: null, outside: false, dream: null, stat: { help: 0, towns: [n.town] }, ...n, known: new Set(n.known), flags: new Set(n.flags),
        mem: n.mem.map((m) => ({ e: m[0], s: m[1], f: !!m[2], v: m[3] })).filter((m) => w.events[m.e]) }));
      for (const n of w.npcs) if (n.goal && !w.events[n.goal.origin]) n.goal = null;
      w.chronicle = d.chronicle.filter((id) => w.events[id]);
      w.war = { ...d.war, refused: new Set(d.war.refused || []) };
      w.droughtUntil = d.droughtUntil; w.worldLog = d.worldLog || {}; w.jobsOpen = d.jobsOpen || []; w.racesSeen = d.racesSeen || null; w.assets = d.assets || {}; w.innMods = d.innMods || {};

      w.usedNames = new Set(d.usedNames);
      w.initialPop = d.initialPop;
      w.playerId = d.playerId ?? null;
      w.autoDays = d.autoDays || 0;
      w.clock = d.clock || 0; w.dayOpen = !!d.dayOpen; w.queue = d.queue || []; w.qi = d.qi || 0; w.ppos = d.ppos || null; w.trail = d.trail || 0;
      w.journal = (d.journal || []).filter((j) => w.events[j.e]);
      w.episodes = (d.episodes || []).filter((ep) => ep.ev === null || ep.ev === undefined || w.events[ep.ev]);
      w.epSeq = d.epSeq || 0; w.papers = (d.papers || []).map((p) => ({ ...p, items: p.items.filter((id) => w.events[id]) }));
      w.lastPaper = d.lastPaper || w.day; w.todayLog = d.todayLog || []; w.land = d.land || {}; w.session = d.session || {}; w.ext = null;
      return w;
    }
  }

  // ================================================================ 행동 (NPC와 플레이어 공용)
  const power = (w, n) => n.traits.bravery * 8 + n.health * 0.6 + Math.min(n.fame, 15) * 0.3 + (JOBS[n.job].fighter ? 4 : 0);
  const related = (a, b) => family(a).has(b.id) || a.parents.some((p) => b.parents.includes(p));

  // ---- 수요와 공급: 같은 일을 하는 사람이 많을수록 벌이가 줄고, 먹을 것이 모자라면 먹을 것을 만드는 일이 귀해진다
  function jobDemand(w, job, tid, extra = 0) {
    const town = w.towns[tid], adults = w.residents(tid, true);
    const open = w.openJobs(), total = open.reduce((s, j) => s + j.weight, 0);
    // 이 마을에 알맞은 일꾼 수. 농사처럼 많이 먹을 것을 만드는 일은 마을 어른의 4할쯤이 해야 모두가 먹고산다
    // 세계에서 생긴 직업(weight 0)은 드문 일이라 마을에 한 사람도 다 필요하지 않다
    const want = job.weight ? Math.max(1, adults.length * (job.weight / total)) : 0.4;
    const have = adults.filter((x) => x.job === job.id).length + extra;
    let f = clamp((want + 1) / (have + 1), 0.35, 2.2);
    if (job.food) { // 곡식값이 오르거나 곳간이 비어 가면 먹을 것을 만드는 일이 귀해진다
      const days = town.food / Math.max(1, w.residents(tid).length);
      f *= [1, 1, 1.6, 1.6, 2.4][Math.min(4, w.foodPrice(town))] * (days < 10 ? 1.8 : days < 30 ? 1.3 : 1);
    }
    return f;
  }
  /** 이 일을 하면 하루에 얼마쯤 벌까: 품삯 + (먹을 것을 만드는 일이면) 마을 밥값에서 내 몫 */
  function expectedIncome(w, job, tid, extra = 0) {
    let v = (job.income[0] + job.income[1]) / 2 * jobDemand(w, job, tid, extra);
    if (job.food) {
      const res = w.residents(tid), makers = w.residents(tid, true).filter((m) => JOBS[m.job].food);
      const tw = makers.reduce((s, m) => s + JOBS[m.job].food, 0) + job.food * extra;
      v += res.length * w.foodPrice(w.towns[tid]) * 0.8 * job.food / Math.max(job.food, tw) * 0.5; // 일하는 날이 절반쯤
    }
    return v;
  }
  /** 하루치 일의 결과. scale: 그날 실제로 일한 만큼 (삶의 층이 정산할 때 일한 시간 / 7) */
  function rWork(n, w, scale = 1) {
    const job = JOBS[n.job], town = w.towns[n.town];
    let earn = w.rng.uniform(job.income[0], job.income[1]) * jobDemand(w, job, n.town) * mastery(n) * scale;
    for (const [d, s] of job.exp || []) gainExp(n, d, s); // 일에서 쌓이는 경험 (새 지식의 씨앗)
    for (const k of job.teaches || []) addXp(n, k, 1); // 일할수록 솜씨가 는다
    // 단계가 있는 업무를 하는 직업은 플레이어와 같은 단계를 거친다 (점수는 솜씨·성격으로 계산). 품질이 벌이와 이름을 정한다
    // 부업이 있으면 네 번에 한 번쯤은 부업의 일을 한다
    const doing = n.side && JOBS[n.side] && w.rng.next() < 0.25 ? n.side : n.job;
    const crafts = n.controller === "player" ? [] : worksOf(doing).filter((x) => x.steps && workAutoReady(x) && (!x.client || workClient(w, n, x)));
    if (crafts.length) {
      const served = crafts.filter((x) => x.client); // 기다리는 손님이 있으면 손님부터
      const pool = served.length ? served : crafts, sh = (town && town.short) || {};
      const wk = w.rng.choices(pool, pool.map((x) => 1 + (Object.keys(x.gives || {}).some((id) => sh[id] >= 2) ? 3 : 0))), q = workQuality(wk, autoScores(n, wk, w.rng)), g = gradeOf(q);
      earn *= 0.6 + 0.6 * q;
      if (wk.effects) applyEffects(w, n, wk, q, workClient(w, n, wk));
      if (wk.skill) addXp(n, wk.skill, 1);
      n.lastWork = { id: wk.id, q: Math.round(q * 100) / 100, day: w.day };
      if (g.id === "master" && w.rng.next() < 0.15) {
        n.fame += 1;
        w.record("masterwork", `${jo(n.name, "이/가")} ${wk.name}에서 걸작을 내놓았다. 솜씨가 소문났다`, { actor: n.id, town: n.town, imp: 3, wr: 0.2, data: { work: wk.id, q: Math.round(q * 100) / 100 } });
      }
    }
    if (job.war_bonus && w.war.active) earn *= 1 + job.war_bonus;
    if (job.food) town.food += job.food * scale * (job.seasonal ? w.harvestMult() * farmMult(town) * weatherWork(w, job) : 1); // 농사는 그 마을의 농법만큼 더 거둔다
    if (job.trader) {
      const open = Object.values(w.towns).filter((t) => !t.fallen);
      const richest = maxBy(open, (t) => t.food / Math.max(1, w.residents(t.id).length));
      const moved = Math.min(6, richest.food * 0.05);
      richest.food -= moved; town.food += moved;
    }
    n.gold += earn;
    if (job.risk && w.rng.next() < job.risk) {
      if (w.rng.next() < 0.5) {
        n.health -= w.rng.uniform(3, 7);
        if (n.health <= 0) w.die(n, "던전 탐험 중 괴물에게 당해", { imp: 5 });
        else w.record("injury", `${jo(n.name, "이/가")} 모험 중 크게 다쳤다`, { target: n.id, town: n.town, imp: 2 });
      } else {
        // 유적에서 두루마리를 찾기도 한다: 잊힌 지식이 세상에 다시 나온다 (플레이어와 같은 유적 보물표)
        const scrolls = CONTENT.loot.filter((l) => l.id && CONTENT.items[l.id] && CONTENT.items[l.id].teaches && !knows(n, CONTENT.items[l.id].teaches));
        if (scrolls.length && w.rng.next() < 0.3) {
          const it = CONTENT.items[w.rng.choices(scrolls, scrolls.map((l) => l.w)).id], K = KNOW(it.teaches);
          learn(n, K.id); n.fame += 2;
          w.record("discovery", `${jo(n.name, "이/가")} 유적 깊은 곳에서 ${it.name}${jo(it.name, "을/를").slice(it.name.length)} 찾아내 ‘${K.name}’${jo(K.name, "을/를").slice(K.name.length)} 익혔다`, { actor: n.id, town: n.town, imp: 5, wr: 0.5, data: { skill: K.id, how: "ruin" } });
          return;
        }
        const loot = w.rng.randint(40, 120);
        n.gold += loot; n.fame += 2;
        w.record("treasure", `${jo(n.name, "이/가")} 고대 유적에서 금화 ${loot}닢어치 보물을 찾아냈다`, { actor: n.id, town: n.town, imp: 5, wr: 0.5 });
      }
    }
  }

  function rHeal(n, w) {
    const healers = w.residents(n.town, true).filter((h) => h.id !== n.id && JOBS[h.job].healer);
    if (healers.length && n.gold >= 3) {
      const h = maxBy(healers, (h) => opinion(n, h.id));
      n.gold -= 3; h.gold += 3; n.health = Math.min(healthCap(n), n.health + 4); treat(w, n, 3);
      adjust(n, h.id, 4); adjust(h, n.id, 2);
    } else n.health = Math.min(healthCap(n), n.health + 1.5);
  }

  function rSocial(n, w) {
    const others = w.residents(n.town, true).filter((m) => m.id !== n.id);
    if (!others.length) return;
    const m = w.rng.next() < 0.6 ? w.rng.choices(others, others.map((o) => Math.max(1, opinion(n, o.id) + 30))) : w.rng.choice(others);
    if (m.race !== n.race) gainExp(n, "language", "race:" + m.race); // 다른 종족과 어울리면 그 말이 는다
    if (m.controller === "player" && w.onApproach && w.autoDays <= 0) { adjust(n, m.id, 1); w.onApproach(n, m); return; }
    if (w.rng.next() < 0.1 + (opinion(n, m.id) < -20 ? 0.2 : 0)) {
      adjust(n, m.id, -6); adjust(m, n.id, -6);
      // 서로 미워하고 용감하면 결투로 번진다
      if (opinion(n, m.id) < -50 && opinion(m, n.id) < -40 && n.traits.bravery > 0.5 && m.traits.bravery > 0.4 && w.rng.next() < 0.3) {
        const win = power(w, n) + w.rng.uniform(0, 8) >= power(w, m) + w.rng.uniform(0, 8);
        const [a, b] = win ? [n, m] : [m, n];
        b.health = Math.max(1, b.health - w.rng.uniform(2, 6));
        w.record("duel", `${jo(n.name, "과/와")} ${jo(m.name, "이/가")} ${w.towns[n.town].name} 광장에서 결투를 벌였다. ${jo(a.name, "이/가")} 이겼다`,
          { actor: a.id, target: b.id, town: n.town, imp: 5, sent: -10, wr: 0.6 });
        return;
      }
      if (opinion(n, m.id) < -30 || w.rng.next() < 0.15)
        w.record("quarrel", `${jo(n.name, "과/와")} ${jo(m.name, "이/가")} 크게 다퉜다`, { actor: n.id, target: m.id, town: n.town, imp: 2, sent: -4, wr: 0.2 });
      return;
    }
    // 화해: 착한 사람이 먼저 손을 내민다
    if (opinion(n, m.id) < -20 && n.traits.kindness > 0.6 && w.rng.next() < 0.15) {
      n.rel[m.id] = Math.max(opinion(n, m.id), 0) + 10; m.rel[n.id] = Math.max(opinion(m, n.id) + 30, opinion(m, n.id));
      for (const [x, y] of [[n, m], [m, n]]) if (x.goal && x.goal.target === y.id && x.controller !== "player") x.goal = null;
      w.record("reconcile", `${jo(n.name, "이/가")} 먼저 손을 내밀어 ${jo(m.name, "과/와")} 화해했다`, { actor: n.id, target: m.id, town: n.town, imp: 4, sent: 6, wr: 0.3 });
      return;
    }
    const compat = 1 - Math.abs(n.traits.kindness - m.traits.kindness) * 0.7;
    const d = w.rng.uniform(2, 6) * compat, before = opinion(n, m.id);
    adjust(n, m.id, d); adjust(m, n.id, d * 0.8);
    n.gold -= Math.min(n.gold, 0.5);
    const news = n.mem.filter((x) => !m.known.has(x.e) && w.events[x.e] && w.events[x.e].imp >= 3);
    if (news.length) {
      const mem = maxBy(news, (x) => w.events[x.e].imp * x.s * w.rng.next());
      w.remember(m, w.events[mem.e], false, n.id);
    }
    // 배운 지식은 친한 사람에게 조금씩 퍼진다
    const mine = sharedSkills(n).filter((k) => !knows(m, k));
    if (mine.length && opinion(n, m.id) >= 30 && w.rng.next() < 0.04) {
      const k = w.rng.choice(mine);
      if (learn(m, k)) w.record("learn", `${jo(n.name, "이/가")} ${m.name}에게 ‘${KNOW(k).name}’${jo(KNOW(k).name, "을/를").slice((KNOW(k).name).length)} 가르쳐 주었다`, { actor: n.id, target: m.id, town: n.town, imp: KNOW(k).lost ? 5 : 2, sent: 3, wr: 0.2, data: { skill: k } });
    }
    // 험담: 내가 미워하는 사람에 대해 나쁜 말을 퍼뜨린다
    const hated = Object.entries(n.rel).filter(([k, v]) => v < -40 && +k !== m.id && w.npcs[+k].alive).map(([k]) => +k);
    if (hated.length && n.traits.kindness < 0.5 && w.rng.next() < 0.07) {
      const z = w.npcs[w.rng.choice(hated)];
      adjust(m, z.id, -8);
      w.record("gossip", `${jo(n.name, "이/가")} ${m.name}에게 ${z.name}에 대한 험담을 늘어놓았다`, { actor: n.id, target: z.id, town: n.town, imp: 2, sent: -3, wr: 0.15 });
    }
    // 선물
    if (n.gold > 40 && opinion(n, m.id) >= 40 && w.rng.next() < 0.1) {
      const g = Math.round(w.rng.uniform(5, 12));
      n.gold -= g; m.gold += g;
      w.record("gift", `${jo(n.name, "이/가")} ${m.name}에게 금화 ${g}닢어치 선물을 건넸다`, { actor: n.id, target: m.id, town: n.town, imp: 2, sent: 4, wr: 0.2 });
    }
    if (before < 50 && opinion(n, m.id) >= 50 && opinion(m, n.id) >= 40)
      w.record("friendship", `${jo(n.name, "과/와")} ${jo(m.name, "은/는")} 둘도 없는 친구가 되었다`, { actor: n.id, target: m.id, town: n.town, imp: 2, sent: 2, wr: 0.1 });
    // 사랑: 고백 → 연인 → 청혼 → 결혼
    const single = (x) => x.spouse === null;
    if (single(n) && single(m) && !related(n, m) && (n.race === m.race || w.rng.next() < 0.4)) {
      if (n.lover === null && m.lover === null && opinion(n, m.id) >= 55 && w.rng.next() < 0.25) {
        if (opinion(m, n.id) >= 45) {
          n.lover = m.id; m.lover = n.id; adjust(n, m.id, 10); adjust(m, n.id, 10);
          w.record("lovers", `${jo(n.name, "이/가")} ${m.name}에게 마음을 고백했고, 두 사람은 연인이 되었다`, { actor: n.id, target: m.id, town: n.town, imp: 3, sent: 3, wr: 0.3 });
        } else {
          adjust(n, m.id, -10);
          w.record("rejected", `${jo(n.name, "이/가")} ${m.name}에게 고백했지만 거절당했다`, { actor: n.id, target: m.id, town: n.town, imp: 3, wr: 0.3 });
        }
      } else if (n.lover === m.id && opinion(n, m.id) >= 60 && opinion(m, n.id) >= 55 && w.rng.next() < 0.3) {
        n.spouse = m.id; m.spouse = n.id; n.lover = m.lover = null; adjust(n, m.id, 15); adjust(m, n.id, 15);
        joinHousehold(w, m, n.house); // 한 집에 산다 (아이들도 함께)
        w.record("marriage", `${jo(n.name, "과/와")} ${jo(m.name, "이/가")} ${w.towns[n.town].name}에서 결혼했다`, { actor: n.id, target: m.id, town: n.town, imp: 5, sent: 5, wr: 0.6 });
      }
    }
  }

  function uSteal(n, w) {
    const price = w.foodPrice(w.towns[n.town]);
    const need = n.hunger * 0.35 + (n.gold < price * 2 ? 0.5 : 0);
    const temptation = need + (n.traits.greed > 0.7 && n.gold < 50 ? 0.15 : 0);
    if (temptation <= 0) return 0;
    return temptation * (n.traits.greed + 0.3) * Math.max(0, 1.1 - n.traits.kindness) * 1.4;
  }
  function rSteal(n, w) {
    const fam = family(n);
    const victims = w.residents(n.town, true).filter((m) => m.id !== n.id && m.gold > 5 && opinion(n, m.id) < 40 && !fam.has(m.id));
    if (!victims.length) return rWork(n, w);
    const v = maxBy(victims, (m) => m.gold - opinion(n, m.id) * 0.5);
    const guards = w.residents(n.town, true).filter((g) => JOBS[g.job].guard).length;
    if (w.rng.next() < Math.min(0.75, 0.2 + 0.12 * guards)) {
      const fine = Math.min(n.gold, 10);
      n.gold -= fine; v.gold += fine; n.jail = w.rng.randint(3, 8);
      w.record("caught", `${jo(n.name, "이/가")} ${v.name}의 금화를 훔치려다 붙잡혀 감옥에 갇혔다`, { actor: n.id, target: v.id, town: n.town, imp: 4, sent: -12, wr: 0.5 });
    } else {
      const amt = Math.round(Math.min(v.gold * 0.3, 25));
      v.gold -= amt; n.gold += amt;
      if (w.rng.next() < 0.4)
        w.record("theft", `${jo(n.name, "이/가")} ${v.name}의 금화 ${amt}닢을 훔쳤다`, { actor: n.id, target: v.id, town: n.town, imp: amt >= 10 ? 4 : 3, sent: -Math.round(Math.min(12, 3 + amt / 3)), wr: 0.15 });
      else
        w.record("theft_unknown", `누군가 ${v.name}의 금화 ${amt}닢을 훔쳐 갔다`, { target: v.id, town: n.town, imp: 2, wr: 0.1, secret: n.id });
    }
  }

  const needy = (n, w) => w.residents(n.town).filter((m) => m.id !== n.id && (m.hunger >= 2 || m.gold < 3) && opinion(n, m.id) >= -10);
  function rHelp(n, w) {
    const list = needy(n, w);
    if (!list.length) return;
    const m = maxBy(list, (x) => opinion(n, x.id) + x.hunger * 10);
    const amt = Math.round(Math.min(12, n.gold * 0.25));
    n.gold -= amt; m.gold += amt; n.stat.help += 1;
    w.record("help", `${jo(n.name, "이/가")} 형편이 어려운 ${m.name}에게 금화 ${amt}닢을 건넸다`, { actor: n.id, target: m.id, town: n.town, imp: m.hunger >= 3 ? 3 : 2, sent: 6, wr: 0.2 });
  }

  function revengeTarget(n, w) {
    const g = n.goal;
    if (!g || g.type !== "revenge") return null;
    const t = w.npcs[g.target];
    return t.alive && !t.at_war ? t : null;
  }
  function uRevenge(n, w) {
    const t = revengeTarget(n, w);
    if (!t || t.town !== n.town || n.health < 6 || (n.goal.wait || 0) > w.day) return 0;
    return 0.2 + n.traits.bravery * 0.6 - opinion(n, t.id) / 200;
  }
  function rRevenge(n, w) {
    const t = revengeTarget(n, w);
    if (!t) return;
    const origin = w.events[n.goal.origin];
    const cause = n.goal.vow ?? origin.id;
    const when = w.ago(origin.day);
    if (power(w, n) + w.rng.uniform(0, 8) >= power(w, t) + w.rng.uniform(0, 8)) {
      const lethal = opinion(n, t.id) <= -85;
      t.health -= w.rng.uniform(3, 8);
      if (!lethal) t.health = Math.max(t.health, 1);
      const ev = w.record("revenge", `${jo(n.name, "이/가")} ${when}의 원한을 갚으려 ${jo(t.name, "을/를")} 습격했다`, { actor: n.id, target: t.id, town: n.town, imp: 6, sent: -15, cause, wr: 0.4 });
      if (t.health <= 0) w.die(t, `${n.name}의 복수에 쓰러져`, { killer: n.id, imp: 8, cause: ev.id, kind: "murder" });
      adjust(n, t.id, 45);
      if (!t.alive || w.rng.next() < 0.8) {
        n.goal = null;
        w.record("revenge_done", `${jo(n.name, "은/는")} 마침내 ${t.name}에 대한 복수를 이뤘다`, { actor: n.id, imp: 3, cause: ev.id, wr: 0 });
      }
    } else {
      n.health -= w.rng.uniform(3, 7);
      if (opinion(t, n.id) > -85) n.health = Math.max(n.health, 1);
      adjust(n, t.id, -10);
      const ev = w.record("counter", `${jo(n.name, "이/가")} ${when}의 원한으로 ${jo(t.name, "을/를")} 습격했지만 오히려 반격당했다`, { actor: n.id, target: t.id, town: n.town, imp: 5, sent: -8, cause, wr: 0.4 });
      if (n.health <= 0) w.die(n, `${t.name}에게 반격당해`, { killer: t.id, imp: 7, cause: ev.id, kind: "murder" });
      else if (w.rng.next() > n.traits.bravery * 0.8) {
        n.goal = null;
        w.record("give_up", `${jo(n.name, "은/는")} ${t.name}에게 당한 뒤 복수를 단념했다`, { actor: n.id, imp: 3, cause: ev.id, wr: 0 });
      } else n.goal.wait = w.day + 30;
    }
  }

  function uTravel(n, w) {
    let u = n.traits.ambition * 0.08;
    if (w.towns[n.town].fallen) u += 2;
    const t = revengeTarget(n, w);
    if (t && t.town !== n.town && !w.towns[t.town].fallen) u += 0.3 + n.traits.bravery * 0.6;
    if (n.hunger >= 3) u += 0.3;
    return u;
  }
  function rTravel(n, w, destId = null, walk = false) {
    const open = Object.values(w.towns).filter((t) => t.id !== n.town && !t.fallen);
    if (!open.length) return;
    const t = revengeTarget(n, w);
    let dest, reason = "";
    if (destId && w.towns[destId] && !w.towns[destId].fallen && destId !== n.town) dest = w.towns[destId];
    else if (t && t.town !== n.town && !w.towns[t.town].fallen) { dest = w.towns[t.town]; reason = ` 원수 ${jo(t.name, "을/를")} 쫓아`; }
    else if (n.hunger >= 3) { dest = maxBy(open, (x) => x.food / Math.max(1, w.residents(x.id).length)); reason = " 굶주림을 피해"; }
    else dest = w.rng.choice(open);
    const old = w.towns[n.town].name;
    // 주민은 길을 나선다 (마차를 기다리거나 걸어서). 닿으면 land()가 이주시킨다
    if (n.controller !== "player") { n.away = null; n.going = { to: dest.id, kind: "move", reason }; depart(w, n, w.day * 1440 + w.clock, walk); return; }
    w.move(n, dest.id);
    if (!n.stat.towns.includes(dest.id)) n.stat.towns.push(dest.id);
    w.record("travel", `${jo(n.name, "이/가")}${reason} ${jo(old, "을/를")} 떠나 ${jo(dest.name, "으로/로")} 이주했다`, { actor: n.id, town: dest.id, imp: reason ? 3 : 2, wr: 0 });
  }

  function betterJob(n, w) {
    // 이 세계에 처음 그 일을 연 사람은 큰 흉년이 아니면 떠나지 않는다 (그 일이 곧 그 사람의 꿈이다)
    // 흉년에 밭으로 갔던 개척자는 흉년이 끝나면 자기 일로 돌아간다
    if (n.pioneer && n.pioneer !== n.job && JOBS[n.pioneer] && w.jobOpen(n.pioneer) && w.foodPrice(w.towns[n.town]) < 4 && n.gold >= JOBS[n.pioneer].entry_cost) return JOBS[n.pioneer];
    if (n.pioneer && n.pioneer === n.job) return w.foodPrice(w.towns[n.town]) >= 4 && n.traits.ambition < 0.8 && !JOBS[n.job].food ? JOBS.farmer : null; // 흉년엔 살려고 밭으로만
    // 꿈이 가리키는 직업이 있고 돈이 모였다면 그 길로 간다
    const want = n.dream && n.dream.job && JOBS[n.dream.job];
    if (want && want.id !== n.job && want.entry_cost <= n.gold && jobDemand(w, want, n.town, 1) > 0.6) return want;
    const home = w.towns[n.town];
    if (home.worry && JOBS[n.job].food) return null; // 겨울 양식이 걱정이면 밭을 떠나지 않는다
    if (!JOBS[n.job].food && ((w.foodPrice(home) >= 4 && n.traits.ambition < 0.8) || (home.worry && n.traits.ambition < 0.5 && expectedIncome(w, JOBS[n.job], n.town) < 3))) return JOBS.farmer;
    const cur = expectedIncome(w, JOBS[n.job], n.town);
    // 돈을 들여 차리는 일(가게·공방)로 옮겨 간다. 돈이 안 드는 일로는 먹을 것을 만드는 일(농사)만 옮겨 간다
    // 먹을 것을 만드는 사람은 곳간이 넉넉할 때만 세계에서 생긴 드문 직업(weight 0)으로 옮긴다
    const plenty = w.foodPrice(home) === 1 && !home.worry;
    const opts = w.openJobs().filter((j) => j.id !== n.job && (j.entry_cost > 0 || j.food) && j.entry_cost <= n.gold * 0.8 && (!j.needKnow || knows(n, j.needKnow)) && (j.weight || !JOBS[n.job].food || plenty) && expectedIncome(w, j, n.town, 1) > cur * 1.3);
    return opts.length ? maxBy(opts, (j) => expectedIncome(w, j, n.town, 1)) : null;
  }
  function uJob(n, w) {
    if (n.job_cooldown > 0 || n.role || n.retired) return 0;
    const j = betterJob(n, w);
    if (!j) return 0;
    if (n.dream && n.dream.job === j.id) return 1.6;
    if (j.id === "farmer") return 0.9;
    return n.traits.ambition * 0.9 + n.traits.greed * 0.3;
  }
  function rJob(n, w) {
    const j = betterJob(n, w);
    if (!j) return;
    const old = JOBS[n.job].name, from = n.job;
    const oldLv = Math.max(0, ...((JOBS[n.job] || {}).teaches || []).map((k) => skillLv(n, k)));
    if (oldLv >= 3 && worksOf(n.job).some((x) => x.steps) && w.rng.next() < 0.4) n.side = n.job; // 깊이 익힌 옛 일은 부업으로 남기도 한다
    if (j.id === "farmer") {
      setJob(n, "farmer"); n.job_cooldown = 120;
      const famine = w.foodPrice(w.towns[n.town]) >= 4;
      w.record("career", famine ? `흉년이 닥치자 ${jo(old, "이었던/였던")} ${jo(n.name, "이/가")} 생계를 위해 밭을 갈기 시작했다` : `겨울 양식이 걱정된 ${old} ${jo(n.name, "이/가")} 밭을 갈기 시작했다`,
        { actor: n.id, town: n.town, imp: 3, wr: 0.3, data: { from, to: "farmer", why: famine ? "famine" : "worry" } });
      return;
    }
    n.gold -= j.entry_cost; setJob(n, j.id); n.job_cooldown = 240; n.fame += 1;
    if (n.side === n.job) n.side = null;
    const what = j.start_text || `${jo(j.name, "이/가")} 되었다`;
    w.record("career", `${jo(old, "이었던/였던")} ${jo(n.name, "이/가")} 모은 금화 ${j.entry_cost}닢으로 ${what}`, { actor: n.id, town: n.town, imp: 5, wr: 0.4, data: { from, to: j.id, cost: j.entry_cost } });
  }

  function uWar(n, w) {
    if (!w.war.active || n.at_war || n.retired || n.ill) return 0;
    let u = n.traits.bravery ** 2 * 0.25 * (w.war.front < 35 ? 1.6 : 1);
    if (n.flags.has("demon_grudge")) u += 0.4;
    if (n.spouse !== null) u *= 0.4;
    if (n.children.some((c) => !isAdult(w.npcs[c]) && w.npcs[c].alive)) u *= 0.5;
    if (JOBS[n.job].fighter) u *= 1.5;
    if (age(n) > 55) u *= 0.2;
    return u;
  }

  function uForage(n, w) {
    const kids = n.children.map((c) => w.npcs[c]).filter((k) => k.alive && !isAdult(k)).map((k) => k.hunger);
    const h = Math.max(n.hunger, ...kids, 0);
    return h < 2 ? 0 : 0.4 + h * 0.25;
  }
  function rForage(n, w) {
    gainExp(n, "nature", "forest");
    if (w.rng.next() < (w.season === "겨울" ? 0.4 : 0.75)) {
      n.hunger = Math.max(0, n.hunger - 3);
      for (const c of n.children) {
        const k = w.npcs[c];
        if (k.alive && !isAdult(k) && k.town === n.town) k.hunger = Math.max(0, k.hunger - 2);
      }
      if (w.rng.next() < 0.3) w.towns[n.town].food += 2;
    }
  }

  const ACTIONS = [
    { id: "work", label: "일하기", hint: "금화를 벌고, 농부라면 식량을 생산한다",
      u: (n, w) => 1 + n.traits.greed * 0.3 + (JOBS[n.job].food && w.foodPrice(w.towns[n.town]) >= 2 ? 0.5 : 0), run: rWork },
    { id: "heal", label: "치료받기", hint: "치유사에게 금화 3닢을 내고 체력을 회복한다",
      u: (n) => (n.ill && n.ill.id !== "cold" ? 1.2 : 0) + (n.health >= Math.min(7, healthCap(n) - 0.5) ? 0 : (healthCap(n) - n.health) * 0.3), run: rHeal },
    { id: "social", label: "사람들과 어울리기", hint: "우정과 사랑이 깊어지고, 소문을 주고받는다",
      u: (n, w) => (w.residents(n.town, true).length < 2 ? 0 : 0.5 + (1 - n.traits.greed) * 0.2 + (n.spouse === null && age(n) < 45 ? 0.2 : 0)), run: rSocial },
    { id: "help", label: "어려운 이웃 돕기", hint: "가난하거나 굶주린 이웃에게 금화를 건넨다",
      u: (n, w) => (n.gold < 15 || !needy(n, w).length ? 0 : Math.max(0, n.traits.kindness * 1.3 - n.traits.greed * 0.5 + 0.1)), run: rHelp },
    { id: "steal", label: "도둑질", hint: "들키면 감옥에 가고, 원한을 산다", u: uSteal, run: rSteal },
    { id: "revenge", label: "복수하기", hint: "원수를 습격한다. 반격당할 수도 있다", u: uRevenge, run: rRevenge },
    { id: "travel", label: "다른 마을로 이주", hint: "가족과 함께 다른 마을로 떠난다", u: uTravel, run: rTravel },
    { id: "job", label: "더 나은 직업 갖기", hint: "모은 금화로 새 일을 시작한다", u: uJob, run: rJob },
    { id: "war", label: "마왕군과의 전쟁에 참전", hint: "전선으로 떠나 몇 계절 동안 싸운다", u: uWar, run: (n, w) => enlist(n, w) },
    { id: "forage", label: "숲에서 먹을 것 구하기", hint: "굶주림을 달랜다. 겨울엔 어렵다", u: uForage, run: rForage },
    { id: "rest", label: "쉬기", hint: "하루를 쉬며 체력을 조금 회복한다", u: () => 0.1, run: (n) => { n.health = Math.min(10, n.health + 0.5); } },
  ];
  const ACT = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
  function available(n, w) { return ACTIONS.map((a) => ({ a, u: a.u(n, w) })).filter((x) => x.u > 0); }
  /** 꿈은 하루하루의 선택을 기울인다: 부자가 되고 싶은 사람은 더 일하고, 이름을 떨치고 싶은 사람은 전쟁에 끌린다 */
  function dreamBias(n, a) { const d = n.dream && DREAMS[n.dream.id]; return d && d.bias && d.bias[a.id] !== undefined ? d.bias[a.id] : 1; }
  function choose(n, w) { const opts = available(n, w); return w.rng.choices(opts.map((x) => x.a), opts.map((x) => (x.u * dreamBias(n, x.a)) ** 2)); }
  /** 플레이어는 이 이주 행동만 목적지를 고를 수 있다 */
  function playerTravel(n, w, destId) { rTravel(n, w, destId); }

  // ================================================================ 하루의 흐름
  function playerNeedsChoice(w) {
    const p = w.player;
    return !!(p && p.alive && isAdult(p) && !p.at_war && p.jail === 0 && w.autoDays <= 0 && !w.playerAction);
  }

  /* 하루는 06:00에 시작한다 (clock = 06:00부터 흐른 분).
   * beginDay: 날짜를 넘기고, 모든 주민에게 07:00~23:00 사이 행동 시각을 정해 준다.
   * actUntil: 시계가 그 시각을 지난 주민부터 차례로 행동한다 (그래서 플레이어가 그 자리에서 목격할 수 있다).
   * finishDay: 남은 주민이 행동하고, 먹고 늙고 태어나는 하루치 정리를 한다. */
  function beginDay(w) {
    w.day += 1;
    seasonal(w);
    warDay(w);
    worldEvents(w);
    emergeJobs(w);
    knowledgeBirth(w);
    experienceBirth(w);
    genesis(w);
    jobLife(w);
    raceLife(w);
    agriLife(w);
    newWeather(w);
    calendarDay(w);
    w.appts = (w.appts || []).filter((p) => p.day >= w.day - 3); // 지난 약속은 사흘 뒤 지운다
    w.lifeDone = 0;
    const people = w.rng.shuffle(w.alive());
    w.queue = people.map((n) => [n.id, w.rng.randint(60, 1020)]).sort((a, b) => a[1] - b[1]);
    w.qi = 0;
    w.dayOpen = true;
  }
  function actOne(w, n) {
    if (!n.alive) return;
    n.age_days += 1;
    if (!n.grown && n.age_days >= adultAge(n.race) * DPY) comeOfAge(n, w);
    if (!isAdult(n)) return;
    if (n.at_war) { n.lastAct = "soldier"; soldierDay(n, w); return; }
    if (n.jail > 0) { n.lastAct = "jail"; n.jail -= 1; return; }
    if (n.trip || n.away) { n.lastAct = n.trip ? "trip" : "visit"; return; } // 길 위에 있거나 다른 마을에 다니러 간 사람은 그날 다른 일을 하지 않는다
    if (n.controller === "player") {
      // 플레이어는 직접 움직인다. '성격대로 맡기기' 중일 때만 성격에 따라 행동한다.
      if (w.autoDays > 0) { w.autoDays -= 1; choose(n, w).run(n, w); }
      return;
    }
    const act = choose(n, w);
    n.lastAct = act.id; // 신문의 '관심 인물' 일기에 쓰인다
    dayOf(n, w).intent = act.id;
    if (act.id === "work") return; // 일은 삶의 층에서 시간마다 하고, 하루 끝에 일한 만큼 정산한다
    act.run(n, w);
  }
  function actUntil(w, minute) {
    while (w.qi < w.queue.length && w.queue[w.qi][1] <= minute) actOne(w, w.npcs[w.queue[w.qi++][0]]);
  }
  function finishDay(w) {
    actUntil(w, Infinity);
    lifeUntil(w, 1440);
    settleWork(w);
    stockDecay(w);
    shortDay(w);
    upkeep(w);
    lifeCourse(w);
    w.dayOpen = false;
    w.clock = 0;
  }
  /** 하루를 통째로 진행 (관찰자 모드, 자동 진행) */
  function step(w) {
    if (!w.dayOpen) beginDay(w);
    finishDay(w);
  }
  /** 실시간 진행: mins분만큼 시계를 돌린다. 06:00을 지나면 새 날이 시작된다. 넘어간 날 수를 돌려준다. */
  function advance(w, mins) {
    let rolled = 0;
    while (mins > 0) {
      if (!w.dayOpen) beginDay(w);
      const d = Math.min(mins, 1440 - w.clock);
      w.clock += d; mins -= d;
      actUntil(w, w.clock);
      lifeUntil(w, w.clock);
      if (w.clock >= 1440) {
        finishDay(w);
        rolled++;
        beginDay(w);
        if (w.onDawn) w.onDawn();
      }
    }
    return rolled;
  }

  function seasonal(w) {
    if (w.day % DPY === 30 && w.rng.next() < 0.25) {
      w.droughtUntil = w.day + 60;
      w.record("drought", "큰 가뭄이 들어 여름과 가을의 수확이 크게 줄 것이다", { imp: 7 });
    }
    const towns = Object.values(w.towns).filter((t) => !t.fallen);
    const pops = Object.fromEntries(towns.map((t) => [t.id, Math.max(1, w.residents(t.id).length)]));
    const avg = towns.reduce((s, t) => s + t.food, 0) / Object.values(pops).reduce((s, x) => s + x, 0);
    for (const t of towns) t.food += (avg * pops[t.id] - t.food) * 0.02;
    granaries(w, towns, pops);
  }

  /* 흉년 대비. 겨울(수확 0.2)과 봄을 넘기지 못하고 곳간이 비는 일이 잦아서 세 가지 규칙을 둔다.
   *  비축: 가을에 남는 식량을 곳간(t.store)에 쌓는다. 곳간 것은 잘 상하지 않고, 마을 식량이 바닥나면 푼다.
   *  대비: 여름·가을에 겨울을 날 양이 모자라 보이면(t.worry) 농사로 옮기는 사람이 는다 (betterJob).
   *  지원: 굶는 마을이 생기면 여유 있는 마을이 식량을 보낸다. 같은 나라가 먼저 나선다. */
  const FOOD = { keep: 15, winter: 40, low: 4, refill: 8, hungry: 3, spare: 15 }; // 한 사람당 식량(일)
  function granaries(w, towns, pops) {
    const T = (t) => w.towns[t.id].name;
    for (const t of towns) {
      const pop = pops[t.id];
      t.store = (t.store || 0) * 0.9995;
      if (w.season === "가을" && t.food > pop * FOOD.keep) { const k = (t.food - pop * FOOD.keep) * 0.05; t.food -= k; t.store += k; }
      if (t.food < pop * FOOD.low && t.store >= 1) {
        const k = Math.min(t.store, pop * FOOD.refill - t.food);
        t.store -= k; t.food += k;
        if (!t.storeOpen) { t.storeOpen = true; w.record("granary_open", `${T(t)}에서 곳간을 열어 가을에 비축해 둔 식량을 풀었다`, { town: t.id, imp: 4, wr: 0.2, data: { food: Math.round(k) } }); }
      } else if (t.food > pop * FOOD.refill * 1.5) t.storeOpen = false;
      const worry = (w.season === "여름" || w.season === "가을") && t.food + t.store < pop * FOOD.winter;
      if (worry && !t.worry) w.record("food_worry", `${T(t)} 사람들이 겨울 양식을 걱정하기 시작했다. 밭으로 나가는 사람이 늘 것이다`, { town: t.id, imp: 2, wr: 0.1 });
      t.worry = worry;
    }
    for (const t of towns) {
      if (t.food + t.store >= pops[t.id] * FOOD.hungry || w.day - (t.aidDay ?? -99) < 10) continue;
      const donors = towns.filter((d) => d !== t && d.food > pops[d.id] * FOOD.spare)
        .sort((a, b) => (b.nation === t.nation) - (a.nation === t.nation) || (b.food / pops[b.id]) - (a.food / pops[a.id]));
      const d = donors[0];
      if (!d) continue;
      const k = Math.min((d.food - pops[d.id] * FOOD.spare) * 0.25, pops[t.id] * FOOD.refill - t.food);
      if (k < 1) continue;
      d.food -= k; t.food += k; t.aidDay = w.day;
      const same = d.nation === t.nation;
      w.record("food_aid", `굶주리는 ${T(t)}에 ${T(d)}에서 식량 ${Math.round(k)}을 실어 보냈다${same ? "" : `. ${nameOfNation(w, d.nation)}의 호의다`}`, { town: t.id, imp: same ? 4 : 5, wr: same ? 0.2 : 0.4, data: { from: d.id, to: t.id, food: Math.round(k) } });
    }
  }

  function upkeep(w) {
    for (const t of Object.values(w.towns)) t.food *= 0.998;
    const paid = {}; // 오늘 마을 사람들이 밥값으로 낸 돈 → 먹을 것을 만든 사람들에게 돌아간다
    for (const n of w.alive()) {
      if (n.at_war) n.hunger = 0;
      else if (n.outside) n.hunger += 1;
      else {
        const town = w.towns[n.town], price = w.foodPrice(town), adult = isAdult(n);
        if (town.food >= 1 && (!adult || n.gold >= price || supportFor(w, n, price))) {
          town.food -= 1;
          if (adult) { n.gold -= price; paid[n.town] = (paid[n.town] || 0) + price; }
          n.hunger = Math.max(0, n.hunger - 2);
        } else n.hunger += 1;
      }
      if (n.hunger >= 4) n.health -= 1;
      else if (n.health < healthCap(n) && n.hunger < 2 && !n.ill) n.health = Math.min(healthCap(n), n.health + 0.15);
      if (n.health <= 0) { w.die(n, "굶주림 끝에", { imp: n.controller === "player" ? 6 : 4 }); continue; }
      // 천수: 수명 가까이 가면 언제든 떠날 수 있다 (수명을 넘기면 하루하루가 덤)
      const lf = lifeFrac(n);
      if (lf >= 0.88 && w.rng.next() < (lf >= 1 ? 0.02 : 0.0012 * Math.exp((lf - 0.88) * 24) * (n.ill ? 2 : 1))) { w.die(n, "천수를 누리고", { imp: 3 }); continue; }
      n.gold *= 0.997;
      n.job_cooldown = Math.max(0, n.job_cooldown - 1);
      decayMemory(n, w);
      checkGoal(n, w);
      dreamDay(n, w);
    }
    for (const [tid, sum] of Object.entries(paid)) {
      const makers = w.residents(tid, true).filter((m) => JOBS[m.job].food && m.jail === 0);
      const tw = makers.reduce((s, m) => s + JOBS[m.job].food, 0);
      for (const m of makers) m.gold += sum * 0.8 * JOBS[m.job].food / tw; // 2할은 장사꾼·운송비로 사라진다
    }
    births(w);
    immigration(w);
  }

  function decayMemory(n, w) {
    for (const m of n.mem) m.s *= m.f ? 0.995 : 0.985;
    const keep = n.goal ? new Set([n.goal.origin, n.goal.vow]) : new Set();
    n.mem = n.mem.filter((m) => m.s > 0.1 || (w.events[m.e] && w.events[m.e].imp >= 7) || keep.has(m.e));
    if (w.day % 10 === 0) {
      const fam = family(n);
      for (const k of Object.keys(n.rel)) {
        if (fam.has(+k)) continue;
        const v = n.rel[k];
        n.rel[k] = v * (v > 0 ? 0.97 : 1 - 0.06 * n.traits.kindness);
      }
    }
  }

  function checkGoal(n, w) {
    const g = n.goal;
    if (!g || g.type !== "revenge") return;
    const t = w.npcs[g.target];
    if (!t.alive) {
      n.goal = null;
      if (t.death_cause && !t.death_cause.includes(n.name))
        w.record("enemy_dead", `${n.name}의 원수 ${jo(t.name, "이/가")} 죽어, 복수는 영영 이룰 수 없게 되었다`, { actor: n.id, imp: 3, cause: g.vow, wr: 0 });
    } else if (opinion(n, t.id) > -25 || (opinion(n, t.id) > -80 && w.rng.next() < n.traits.kindness ** 2 * 0.01)) {
      n.goal = null;
      w.record("forgive", `${jo(n.name, "은/는")} 오랜 시간 끝에 ${jo(t.name, "을/를")} 용서했다`, { actor: n.id, target: t.id, town: n.town, imp: 5, sent: 3, cause: g.vow, wr: 0.2 });
    }
  }

  // ================================================================ 생애 주기: 병·다침·늙음·부양·유산·슬픔
  /* 사람은 가끔 앓고(겨울·굶주림·아이·늙은이일수록 잦다), 일하다 다치고, 늙으면 기력이 줄고 일을 놓는다.
   *  n.ill = { id, since, until, care }   앓는 동안 날마다 체력이 깎이고 쉬어야 한다. 의원·사제의 치료와 식구의 돌봄이 낫게 한다
   *  n.retired = 일을 놓은 날             늙은이는 일을 줄이다가 놓고, 형편이 어려우면 같은 마을의 식구가 밥값을 댄다
   *  n.grief = { of, until }               가족을 잃으면 한동안 기분이 가라앉고 일이 손에 안 잡힌다
   *  죽은 사람의 금화와 소지품은 배우자, 없으면 자녀에게 간다 (estate) */
  const ILLS = {
    cold: { name: "고뿔", sev: 0.25, days: [3, 6], death: "고뿔이 깊어져" },
    fever: { name: "열병", sev: 0.8, days: [4, 9], death: "열병을 앓다가" },
    hurt: { name: "다친 곳", sev: 0.45, days: [5, 12], death: "다친 곳이 덧나", hurt: true },
    frail: { name: "노환", sev: 0.55, days: [6, 14], death: "노환으로" },
  };
  const illOf = (n) => (n.ill && ILLS[n.ill.id]) || null;
  const kinIn = (w, n) => [...family(n)].map((i) => w.npcs[i]).filter((m) => m && m.alive && m.town === n.town && !m.at_war && !m.trip && !m.away);
  function fallIll(w, n, id, why = "") {
    if (n.ill || !n.alive) return;
    const I = ILLS[id];
    n.ill = { id, since: w.day, until: w.day + w.rng.randint(I.days[0], I.days[1]), care: 0 };
    if (id === "cold" && n.controller !== "player") return; // 고뿔은 소식거리가 아니다
    const text = I.hurt ? `${jo(n.name, "이/가")} ${why || "일하다"} 다쳐 한동안 쉬게 되었다` : `${jo(n.name, "이/가")} ${I.name}${jo(I.name, "으로/로").slice(I.name.length)} 앓아누웠다`;
    w.record("ill", text, { target: n.id, town: n.town, imp: 2, wr: 0.05, notify: kinIn(w, n).map((m) => m.id), data: { ill: id } });
  }
  /** 치료: 앓는 날이 줄어든다 (노환은 조금만) */
  function treat(w, n, days = 3) {
    if (!n.ill) return;
    n.ill.until = Math.max(w.day, n.ill.until - (n.ill.id === "frail" ? 1 : days));
    if (n.ill.until <= w.day && n.ill.id !== "frail") n.ill = null;
  }
  function lifeCourse(w) {
    const winter = w.season === "겨울";
    for (const n of w.alive()) {
      if (n.at_war) continue;
      const f = lifeFrac(n), kid = !isAdult(n), old = isElder(n);
      if (n.ill) {
        const I = illOf(n) || ILLS.cold;
        // 같은 마을의 식구가 곁을 지킨다
        const kin = kinIn(w, n).filter((m) => isAdult(m) && !m.ill);
        if (kin.length && w.rng.next() < 0.7) {
          const c = w.rng.choice(kin); n.ill.care = 1; adjust(n, c.id, 1);
          if (!n.ill.cared && I !== ILLS.cold && c.controller !== "player") { n.ill.cared = c.id; if (w.rng.next() < 0.5) w.record("care", `${jo(c.name, "이/가")} 앓아누운 ${n.name} 곁을 지켰다`, { actor: c.id, target: n.id, town: n.town, imp: 1, sent: 2, wr: 0 }); }
        }
        n.health -= I.sev * (old ? 1 + (f - 0.75) * 4 : kid ? 1.1 : 0.8) * (n.ill.care ? 0.6 : 1) * (n.hunger >= 2 ? 1.5 : 1);
        n.ill.care = 0;
        if (n.health <= 0) { w.die(n, I.death, { imp: 3, kind: "death" }); continue; }
        if (w.day >= n.ill.until) n.ill = null;
      } else {
        const p = 0.0016 * (winter ? 2.5 : 1) * (kid ? 1.4 : 1) * (old ? 1 + (f - 0.75) * 14 : 1) * (n.hunger >= 2 ? 2 : 1);
        if (w.rng.next() < p) fallIll(w, n, old && w.rng.next() < 0.5 ? "frail" : w.rng.next() < 0.16 ? "fever" : "cold");
      }
      n.health = Math.min(n.health, healthCap(n));
      if (n.grief && w.day >= n.grief.until) n.grief = null;
      if (n.grief) n.mood = Math.min(n.mood ?? 0.6, 0.25 + 0.35 * (1 - (n.grief.until - w.day) / n.grief.len));
      // 일을 놓는다: 늙어서 기력이 다하면 (모아 둔 것이 있거나 기댈 식구가 있으면 더 일찍)
      if (old && !n.retired && n.controller !== "player" && !n.role && f >= 0.8) {
        const kids = n.children.map((c) => w.npcs[c]).filter((c) => c.alive && isAdult(c) && c.town === n.town);
        const p = 0.004 + (f - 0.8) * 0.05 + (kids.length ? 0.004 : 0) + (n.gold > 80 ? 0.003 : 0) + (n.health < 6 ? 0.01 : 0);
        if (w.rng.next() < p) {
          n.retired = w.day;
          const heir = kids.find((c) => c.job === n.job), J = JOBS[n.job] || { name: "일" };
          w.record("retire", heir ? `${jo(n.name, "이/가")} 나이가 들어 ${J.name} 일을 ${heir.name}에게 맡기고 물러났다` : `${jo(n.name, "이/가")} 나이가 들어 ${J.name} 일을 놓았다`,
            { actor: n.id, target: heir ? heir.id : null, town: n.town, imp: 2, wr: 0.1, data: { job: n.job, heir: heir ? heir.id : null } });
        }
      }
    }
  }
  /** 밥값을 못 내는 사람의 밥값을 같은 마을 식구가 댄다 (자녀 → 배우자 → 부모). 처음 늙은 부모를 모시게 되면 소식으로 */
  function supportFor(w, n, price) {
    const kin = kinIn(w, n).filter((m) => isAdult(m) && m.controller !== "player" && m.gold >= price * 4);
    if (!kin.length) return false;
    const p = kin.find((m) => n.children.includes(m.id)) || kin.find((m) => m.id === n.spouse) || kin[0];
    p.gold -= price; n.gold += price;
    if (n.retired && n.children.includes(p.id) && !n.flags.has("cared")) {
      n.flags.add("cared"); adjust(n, p.id, 5);
      w.record("support", `${jo(p.name, "이/가")} 일을 놓은 ${n.name}의 밥값을 대며 모시기 시작했다`, { actor: p.id, target: n.id, town: n.town, imp: 2, sent: 3, wr: 0.1 });
    }
    return true;
  }
  /** 남긴 것: 금화와 소지품은 배우자에게, 없으면 자녀들이 나눠 갖는다 */
  function estate(w, n, ev) {
    const sp = n.spouse !== null && w.npcs[n.spouse] && w.npcs[n.spouse].alive ? [w.npcs[n.spouse]] : [];
    const heirs = sp.length ? sp : n.children.map((c) => w.npcs[c]).filter((c) => c && c.alive);
    const gold = Math.floor(n.gold || 0);
    if (!heirs.length) return;
    for (const h of heirs) h.gold += gold / heirs.length;
    if (n.inv) { const h = heirs[0]; h.inv = h.inv || {}; for (const [id, k] of Object.entries(n.inv)) h.inv[id] = (h.inv[id] || 0) + k; n.inv = {}; }
    n.gold = 0;
    if (gold >= 5) w.record("estate", `${heirs.map((h) => h.name).join("·")}${jo(heirs[heirs.length - 1].name, "이/가").slice(heirs[heirs.length - 1].name.length)} ${jo(n.name, "이/가")} 남긴 금화 ${gold}닢을 물려받았다`,
      { actor: heirs[0].id, target: n.id, town: heirs[0].town, imp: 1, wr: 0, cause: ev ? ev.id : null, data: { gold, heirs: heirs.map((h) => h.id) } });
  }
  /** 가족을 잃은 사람들: 배우자·자식을 잃은 슬픔이 가장 오래간다 */
  function mourn(w, n) {
    const mk = (m, len) => { if (!m || !m.alive || m.controller === "player") return; if (!m.grief || m.grief.until - w.day < len) m.grief = { of: n.id, until: w.day + len, len }; m.mood = Math.min(m.mood ?? 0.6, 0.25); };
    if (n.spouse !== null) mk(w.npcs[n.spouse], 45);
    for (const p of n.parents) mk(w.npcs[p], 40);
    for (const c of n.children) mk(w.npcs[c], 25);
  }

  function births(w) {
    const seen = new Set();
    for (const n of w.alive()) {
      if (n.spouse === null || seen.has(n.id) || !isAdult(n)) continue;
      const m = w.npcs[n.spouse];
      seen.add(n.id); seen.add(m.id);
      if (!m.alive || m.town !== n.town || n.at_war || m.at_war || age(n) > n.lifespan * 0.6 || age(m) > m.lifespan * 0.6
          || n.children.length >= 3 || w.rng.next() > 0.003) continue;
      // 서로 다른 종족 사이의 아이: 그 둘을 잇는 혼혈 종족이 정의돼 있으면 반쯤은 그 종족으로 태어난다
      const mix = n.race !== m.race ? CONTENT.races.find((r) => r.mix && r.mix.includes(n.race) && r.mix.includes(m.race)) : null;
      const race = mix && w.rng.next() < 0.5 ? mix.id : w.rng.choice([n.race, m.race]);
      const c = w.spawn(n.town, { race, job: w.rng.choice([n.job, m.job]), ageYears: 0 });
      c.age_days = 0; c.gold = 0; c.parents = [n.id, m.id];
      if (n.house) settleIn(w, c, n.house); // 부모 집에서 자란다
      c.heritage = blendHeritage(n, m);      // 혈통은 부모의 평균
      c.look = inheritLook(c, n, m);         // 외형은 부모를 닮는다
      const g = (RACES[race] && RACES[race].traitsGenetic) ?? 0.6; // 성격: 부모 평균과 타고난 기질이 섞인다
      for (const k of Object.keys(c.traits)) c.traits[k] = clamp(((n.traits[k] + m.traits[k]) / 2) * g + c.traits[k] * (1 - g), 0, 1);
      for (const p of [n, m]) { p.children.push(c.id); p.rel[c.id] = 80; c.rel[p.id] = 80; }
      if (mix && race === mix.id && !seenRace(w, mix.id)) { w.racesSeen.push(mix.id); w.record("race_born", `${jo(n.name, "과/와")} ${m.name} 사이에서 이 세계 최초의 ${jo(mix.name, "이/가")} 태어났다. ${mix.bornText || "사람들은 두 종족의 피를 이은 아이를 신기하게 바라보았다"}`, { actor: n.id, target: c.id, town: n.town, imp: 8, wr: 1, data: { species: mix.id, parents: [n.race, m.race] } }); }
      w.record("birth", `${jo(n.name, "과/와")} ${m.name} 부부 사이에 ${jo(c.name, "이/가")} 태어났다`, { actor: n.id, target: c.id, town: n.town, imp: n.controller === "player" || m.controller === "player" ? 5 : 3, wr: 0.4, notify: [m.id], data: { parents: [n.id, m.id], species: race } });
    }
  }

  function comeOfAge(n, w) {
    n.grown = true; n.culture = w.towns[n.town] ? w.towns[n.town].nation : n.culture; // 자란 곳의 문화권
    const pj = n.parents.map((p) => w.npcs[p].job);
    let how;
    const grew = Object.entries(n.helped || {}).filter(([j]) => JOBS[j] && pj.includes(j)).sort((a, b) => b[1] - a[1])[0]; // 어릴 적 가장 많이 거든 일
    if (grew && w.rng.next() < 0.5 + Math.min(0.3, grew[1] / 400)) { setJob(n, grew[0]); how = "부모의 일을 이어받아"; for (const k of JOBS[grew[0]].teaches || []) addXp(n, k, grew[1] * 0.25); }
    else if (pj.length && w.rng.next() < 0.5) { setJob(n, w.rng.choice(pj)); how = "부모의 일을 이어받아"; }
    else { setJob(n, w.pickJob(w.towns[n.town])); how = "스스로 길을 정해"; }
    n.gold = w.rng.uniform(5, 15);
    let text = `${jo(n.name, "이/가")} 성인이 되어 ${how} ${jo(JOBS[n.job].name, "이/가")} 되었다`, imp = 3;
    if (n.goal && n.goal.type === "revenge" && w.npcs[n.goal.target].alive) {
      text += `. 어린 시절의 원수 ${jo(w.npcs[n.goal.target].name, "을/를")} 결코 잊지 않았다`;
      imp = 6;
    }
    if (n.house) settleIn(w, n, n.house); // 주인 없는 집이면 주인이 된다
    w.record("adulthood", text, { actor: n.id, town: n.town, imp, cause: n.goal ? n.goal.vow : null, wr: 0.2, data: { job: n.job, inherited: how === "부모의 일을 이어받아" } });
  }

  function immigration(w) {
    const adults = w.alive().filter(isAdult).length;
    if (adults < w.initialPop * 0.85 && w.rng.next() < 0.06) {
      const town = w.rng.choice(Object.values(w.towns).filter((t) => !t.fallen));
      const n = w.spawn(town.id);
      w.record("arrival", `${RACES[n.race].name} ${JOBS[n.job].name} ${jo(n.name, "이/가")} ${town.name}에 정착했다`, { actor: n.id, town: town.id, imp: 2, wr: 0 });
    }
    // 비어 가는 마을: 빈집과 곳간을 보고 바깥에서 사람이 들어온다 (마을 하나가 통째로 비지 않게)
    for (const t of Object.values(w.towns)) {
      if (t.fallen || !t.start_pop) continue;
      const here = w.residents(t.id, true).length;
      if (here >= Math.max(3, t.start_pop * 0.4) || (t.food + (t.store || 0)) < 20 || w.rng.next() > 0.05) continue;
      const n = w.spawn(t.id);
      w.record("arrival", `빈집이 늘어 가던 ${t.name}에 ${RACES[n.race].name} ${JOBS[n.job].name} ${jo(n.name, "이/가")} 새로 자리를 잡았다`, { actor: n.id, town: t.id, imp: 2, wr: 0 });
    }
  }

  // ================================================================ 콘텐츠 맞추기
  /** 새로 더해진 마을에 사람을 채우고, 이름이 정해진 주민(CONTENT.npcs)을 세계에 들인다. 저장된 세계를 불러올 때도 불린다. */
  function syncContent(w, silent = false) {
    // 직업에 새 기술이 더해졌으면(콘텐츠 갱신) 그 직업 사람들도 익힌다
    for (const n of w.npcs) if (n.alive && isAdult(n)) for (const k of (JOBS[n.job] && JOBS[n.job].teaches) || []) if (!knows(n, k)) learn(n, k, "job");
    for (const t of Object.values(w.towns)) {
      if (t.seeded) continue;
      t.seeded = true;
      for (let i = 0; i < t.start_pop; i++) { const n = w.spawn(t.id); if (isAdult(n)) pickDream(n, w, true); }
      if (!silent) w.record("founding", `${nameOfNation(w, t.nation)}의 ${jo(t.name, "이/가")} 지도에 새로 나타났다. 먼 곳에서 사람들이 오가기 시작했다`, { town: t.id, imp: 7, wr: 0 });
    }
    const have = new Set(w.npcs.map((n) => n.preset).filter(Boolean));
    for (const d of CONTENT.npcs) {
      if (have.has(d.id) || !w.towns[d.town]) continue;
      const n = w.spawn(d.town, { race: d.race, job: d.job, ageYears: d.age || 30, name: d.name });
      n.preset = d.id; w.usedNames.add(d.name);
      if (d.traits) Object.assign(n.traits, d.traits);
      if (d.bio) n.bio = d.bio;
      if (d.gold !== undefined) n.gold = d.gold;
      if (d.dream && DREAMS[d.dream]) { const dd = DREAMS[d.dream]; n.dream = { id: d.dream, since: w.day, best: 0, ...(dd.init ? dd.init(n, w) : {}), ...(d.dreamData || {}) }; }
      else if (isAdult(n)) pickDream(n, w, true);
      if (!silent) w.record("arrival", `${RACES[n.race].name} ${JOBS[n.job].name} ${jo(n.name, "이/가")} ${w.towns[d.town].name}에 정착했다`, { actor: n.id, town: d.town, imp: 3, wr: 0.3 });
    }
  }

  // ================================================================ 혈통과 외형
  const lhash = (a, b, c = 0) => { let x = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0; x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0; return x / 4294967296; };
  const pickBy = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
  /** 한 종족의 혈통. 혼혈 종족(mix)이면 두 종족 반씩 */
  function heritageOf(race) {
    const r = RACES[race];
    return r && r.mix ? Object.fromEntries(r.mix.map((x) => [x, 1 / r.mix.length])) : { [race]: 1 };
  }
  function blendHeritage(a, b) {
    const out = {};
    for (const p of [a, b]) for (const [k, v] of Object.entries(p.heritage || heritageOf(p.race))) out[k] = (out[k] || 0) + v / 2;
    for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 1024) / 1024;
    return out;
  }
  /** 종족 look에서 고른 외형. 인물 번호로 정하므로 같은 사람은 늘 같은 얼굴이다 (그림 쪽이 예전에 하던 계산과 같다) */
  function makeLook(n) {
    const rl = (RACES[n.race] && RACES[n.race].look) || {}, D = CONTENT.lookDefaults, h = (k) => lhash(n.id + 7, k, 3);
    return { skin: pickBy(rl.skin || D.skin, h(1)), hair: pickBy(rl.hair || D.hair, h(2)), style: rl.curly ? "curly" : pickBy(D.styles, h(3)), eye: pickBy(rl.eyes || D.eyes, h(4)) };
  }
  /** 아이의 외형: 피부·눈은 부모 중 한 쪽, 머리색은 대개 부모 중 한 쪽(가끔 그 종족의 다른 빛깔), 머리 모양은 제각각 */
  function inheritLook(c, a, b) {
    const own = makeLook(c), h = (k) => lhash(c.id + 11, k, 5), la = a.look || makeLook(a), lb = b.look || makeLook(b), P = (k) => (h(k) < 0.5 ? la : lb);
    return { skin: P(1).skin, hair: h(5) < 0.8 ? P(2).hair : own.hair, style: own.style, eye: P(3).eye };
  }

  // ================================================================ 집 (자산)
  /* 마을마다 주민 집이 housesPerTown채 있다. 집은 자산(w.assets)이고 주인(owner)이 있다. 인물은 사는 집(n.house)을 가진다.
   * 태어나면 부모 집, 결혼하면 한 집, 이사하면 새 마을의 가장 한산한 집. 주인이 죽거나 떠나면 같은 집 식구에게 넘어간다. */
  const houseId = (town, hid) => `house:${town}:${hid}`;
  function ensureHouses(w, town) {
    w.assets = w.assets || {};
    for (let h = 1; h <= CONTENT.housesPerTown; h++) { const id = houseId(town, h); if (!w.assets[id]) w.assets[id] = { id, kind: "house", town, hid: h, owner: null, style: {}, mods: {} }; }
  }
  const houseResidents = (w, id) => w.npcs.filter((x) => x.alive && x.house === id);
  /** 이 마을에서 가장 한산한 집 */
  function pickHouse(w, town) {
    ensureHouses(w, town);
    let best = null, bc = Infinity;
    for (let h = 1; h <= CONTENT.housesPerTown; h++) { const id = houseId(town, h), c = houseResidents(w, id).length; if (c < bc) { bc = c; best = id; } }
    return best;
  }
  const liveOwner = (w, a) => a.owner !== null && a.owner !== undefined && w.npcs[a.owner] && w.npcs[a.owner].alive;
  /** 주인이 떠나거나 죽으면: 같은 집에 남은 어른에게 (배우자 → 나이 많은 자녀 → 나이 많은 식구) */
  function heirOf(w, n, a) {
    const mates = houseResidents(w, a.id).filter((x) => x.id !== n.id && isAdult(x) && x.controller !== "player");
    if (!mates.length) return null;
    return mates.find((x) => x.id === n.spouse) || mates.filter((x) => n.children.includes(x.id)).sort((x, y) => y.age_days - x.age_days)[0] || mates.sort((x, y) => y.age_days - x.age_days)[0];
  }
  function leaveHouse(w, n) {
    const a = n.house && w.assets[n.house];
    if (!a || a.owner !== n.id) return;
    const heir = heirOf(w, n, a);
    if (heir) a.owner = heir.id; // 아무도 없으면 빈집이지만 주인은 그대로 (떠나도 집은 그 사람 것)
  }
  /** n이 집 id에 들어가 산다. 주인 없는 집이면 어른인 n이 주인이 된다 */
  function settleIn(w, n, id) {
    if (!id) return;
    if (n.house !== id) leaveHouse(w, n);
    n.house = id;
    const a = w.assets[id];
    if (a && isAdult(n) && n.controller !== "player" && !liveOwner(w, a)) a.owner = n.id;
  }
  /** 결혼: 배우자와 그 어린 자녀가 이 집으로 옮겨 온다 */
  function joinHousehold(w, m, id) {
    if (!id || m.controller === "player") return;
    const old = m.house;
    settleIn(w, m, id);
    for (const c of m.children.map((x) => w.npcs[x])) if (c && c.alive && !isAdult(c) && c.house === old) settleIn(w, c, id);
  }
  /** 죽은 사람이 주인이던 집을 넘긴다 */
  function passHouses(w, n, ev = null) {
    for (const a of Object.values(w.assets || {})) {
      if (a.owner !== n.id) continue;
      const heir = heirOf(w, n, a);
      a.owner = heir ? heir.id : null;
      if (heir) w.record("inherit", `${jo(heir.name, "이/가")} ${n.name}의 집을 물려받았다`, { actor: heir.id, target: n.id, town: a.town, imp: 2, wr: 0, cause: ev ? ev.id : null, data: { asset: a.id } });
    }
  }

  // ================================================================ 나라
  const nameOfNation = (w, id) => (w.nations[id] && w.nations[id].name) || CONTENT.nations[id] || id || "";
  /** 콘텐츠에 정의된 나라를 이 세계의 나라 목록에 올린다 (없을 때만) */
  function ensureNation(w, id) {
    if (id && !w.nations[id]) w.nations[id] = { id, name: CONTENT.nations[id] || id, since: 0, founder: null, from: null };
    return id;
  }
  /** 이 세계에서 새로 생긴 나라. id는 n1, n2… */
  function newNation(w, name, o = {}) {
    let k = Object.keys(w.nations).length;
    while (w.nations["n" + k] || CONTENT.nations["n" + k]) k++;
    const id = "n" + k;
    w.nations[id] = { id, name, since: w.day, founder: null, from: null, ...o };
    return id;
  }

  // ================================================================ 새 나라와 새 직업 (세계가 스스로 넓어진다)
  function addTown(w, def) {
    w.founded = w.founded || [];
    if (!w.founded.some((x) => x.id === def.id)) w.founded.push(def);
    const nation = def.nation || newNation(w, def.nationName, { since: def.day, founder: def.founder });
    def.nation = nation;
    w.towns[def.id] = { id: def.id, name: def.name, nation, border: false, races: def.races, job_bias: def.job_bias || {}, start_pop: 0,
      food: 80, fallen: false, seeded: true, founded: def.day, founder: def.founder, x: def.pos[0], y: def.pos[1] };
    return w.towns[def.id];
  }
  const allTownDefs = (w) => [...CONTENT.towns, ...(w.founded || [])];
  /** 꿈을 이룬 개척자가 무리를 이끌고 빈 땅에 새 나라를 세운다 */
  function foundNation(n, w, opts = {}) {
    const NN = CONTENT.nationNames, used = new Set(Object.values(w.towns).map((t) => t.name)), usedN = new Set(Object.values(w.nations).map((x) => x.name));
    const style = opts.style || (n.traits.ambition > 0.85 && n.traits.bravery > 0.6 ? "proud" : n.traits.kindness > 0.6 ? "kind" : "plain");
    let nationName = opts.name && !usedN.has(opts.name) ? opts.name : null;
    if (!nationName) for (let i = 0; i < 20; i++) { nationName = `${w.rng.choice(NN.pre)} ${w.rng.choice(NN.kind[style])}`; if (!usedN.has(nationName)) break; }
    const followers0 = w.alive().filter((x) => x.follows === n.id && x.controller !== "player" && !x.at_war);
    // 빈 땅을 찾는다 (지도가 있으면 지도에서, 없으면 기본 후보지에서). 빈 땅이 없거나, 고향 사람 다수가 따르면 고향을 독립시킨다
    const home = w.towns[n.town];
    const finder = w.findSite || (root.Game && root.Game.findSite);
    const site = finder ? finder(w, [home.x, home.y]) : (() => { const taken = allTownDefs(w).map((t) => t.pos); const ok = CONTENT.frontier.filter((s) => taken.every((p) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 30 * SPREAD)); return ok.length ? w.rng.choice(ok) : null; })();
    const localShare = followers0.filter((x) => x.town === n.town).length / Math.max(1, w.residents(n.town, true).length);
    if (!site || (!home.border && localShare > 0.3 && w.rng.next() < 0.5)) {
      const oldId = home.nation, oldNation = nameOfNation(w, oldId), newId = newNation(w, nationName, { since: w.day, founder: n.id, from: oldId });
      home.nation = newId; home.indep = { from: oldId, day: w.day, founder: n.id };
      const title = style === "proud" ? "국왕" : style === "kind" ? "촌장" : "족장";
      n.title = `${nationName}의 ${title}`; n.fame += 10;
      for (const x of w.alive()) if (x.follows === n.id && x.controller !== "player") x.follows = null;
      const others = Object.values(w.towns).filter((t) => t.id !== home.id && t.nation === oldId).length;
      if (!others) { // 나라의 마을이 여기 하나뿐이면 독립이 아니라 혁명이다
        const ruler = w.alive().find((x) => x.title && x.title.startsWith(oldNation));
        if (ruler) { ruler.title = null; A_adjust(ruler, n.id, -60); }
        w.nations[oldId].ended = w.day; w.nations[newId].revolution = true; // 옛 나라는 사라진다
        return w.record("independence", `${jo(n.name, "이/가")} ${home.name} 사람들의 뜻을 모아 ${ruler ? jo(ruler.name, "을/를") + " 몰아내고 " : ""}${oldNation}의 이름을 버리고 ‘${nationName}’${jo(nationName, "을/를").slice(nationName.length)} 새로 선포했다`,
          { actor: n.id, target: ruler ? ruler.id : null, town: home.id, imp: 9, sent: ruler ? -10 : 0, wr: 1, data: { nation: newId, name: nationName, from: oldId, revolution: true } });
      }
      return w.record("independence", `${jo(n.name, "이/가")} ${home.name} 사람들과 함께 ${oldNation}에서 떨어져 나와 ‘${nationName}’${jo(nationName, "을/를").slice(nationName.length)} 선포했다`,
        { actor: n.id, town: home.id, imp: 9, wr: 1, data: { nation: newId, name: nationName, from: oldId } });
    }
    const tname = w.rng.choice(NN.town.filter((x) => !used.has(x))) || `${n.name}의 터`;
    const near = maxBy(allTownDefs(w), (t) => -Math.hypot(t.pos[0] - site[0], t.pos[1] - site[1]));
    const followers = followers0;
    const races = { [n.race]: 0.6 }; for (const f of followers) races[f.race] = (races[f.race] || 0) + 0.4 / Math.max(1, followers.length);
    const job_bias = {}; for (const f of [n, ...followers]) job_bias[f.job] = (job_bias[f.job] || 1) + 1;
    const def = { id: "f" + ((w.founded || []).length + 1), name: tname, nationName, pos: site, roads: [near.id], races, job_bias, founder: n.id, day: w.day };
    const t = addTown(w, def);
    const title = style === "proud" ? "국왕" : style === "kind" ? "촌장" : "족장";
    n.title = `${nationName}의 ${title}`; n.fame += 10;
    const old = w.towns[n.town].name;
    for (const x of [n, ...followers]) { w.move(x, t.id); x.home = t.id; if (!x.stat.towns.includes(t.id)) x.stat.towns.push(t.id); }
    t.food += followers.length * 10 + n.gold * 0.3; n.gold *= 0.5;
    const ev = w.record("nation_founded", `${jo(n.name, "이/가")} ${followers.length}명의 동료와 함께 ${jo(old, "을/를")} 떠나, 빈 땅에 ‘${nationName}’${jo(nationName, "을/를").slice(nationName.length)} 세웠다. 첫 마을의 이름은 ${tname}이다`,
      { actor: n.id, town: t.id, imp: 9, wr: 0, notify: w.alive().filter((x) => x.follows === n.id).map((x) => x.id), data: { nation: t.nation, name: nationName, town: t.id, followers: followers.length } });
    for (const x of w.alive()) if (x.follows === n.id && x.controller !== "player") x.follows = null;
    if (w.onMapChange) w.onMapChange();
    return ev;
  }
  /** 수요가 쌓이면 누군가 처음으로 새 일을 시작한다. 그 뒤로 그 직업은 이 세계의 직업이 된다 */
  // ================================================================ 주민의 하루 (시간마다 사는 삶)
  /* 하루의 큰 결정(ACTIONS: 일·어울리기·이주·직업·복수…)은 하루에 한 번이지만, 사람은 한 시간마다 다음에 할 일을 정한다.
   *  할 일: sleep 잠 · work 일 · meal 식사 · rest 쉬기 · play 놀러 가기 · social 친구 만나기 · shop 장보기 · pray 기도 · chores 집안일 · kid 아이 놀이
   *  기준: 배고픔(점심·저녁)·피로(fatigue)·기분(mood)·성격·날씨·그날의 마음(intent)·친구. 친구를 부르면 그 사람도 함께 간다.
   *  일은 시간마다 쌓이고(today.worked) 하루 끝에 일한 만큼 정산한다(settleWork → rWork의 scale).
   *  화면(game.js scheduleSpot)은 n.life를 보고 그 사람이 지금 있는 곳을 그린다. 그래서 보이는 모습과 실제 삶이 같다. */
  const WEATHER = {
    봄:   [["맑음", 0.5], ["흐림", 0.3], ["비", 0.2]],
    여름: [["맑음", 0.45], ["흐림", 0.2], ["비", 0.25], ["폭풍", 0.1]],
    가을: [["맑음", 0.5], ["흐림", 0.3], ["비", 0.2]],
    겨울: [["맑음", 0.3], ["흐림", 0.3], ["눈", 0.4]],
  };
  /* 달력: 철마다 15일은 마을 잔치(모두 일을 쉬고 오후부터 광장에 모인다), 이레마다 하루는 쉬는 날 */
  const FESTIVALS = { 봄: "봄맞이 잔치", 여름: "한여름 밤 잔치", 가을: "거둠 잔치", 겨울: "겨울 등불 잔치" };
  const dayInSeason = (w) => (w.day % DPS) + 1;
  function holidayOf(w) { if (dayInSeason(w) === 15) return { kind: "festival", name: FESTIVALS[w.season] }; if (w.day % 7 === 6) return { kind: "rest", name: "쉬는 날" }; return null; }
  function calendarDay(w) {
    const hd = holidayOf(w); w.holiday = hd; w.festivalToday = {};
    if (hd && hd.kind === "festival") for (const t of Object.values(w.towns)) {
      if (t.fallen || w.residents(t.id, true).length < 3) continue;
      w.festivalToday[t.id] = hd.name;
      w.record("town_festival", `${t.name}에 ${hd.name}${jo(hd.name, "이/가").slice(hd.name.length)} 열려 온 마을 사람들이 광장에 모였다`, { town: t.id, imp: 3, wr: 0.8 });
    }
  }
  function newWeather(w) {
    const prev = w.weather && w.weather.kind, opts = WEATHER[w.season] || WEATHER.봄;
    const keep = prev && opts.some(([k]) => k === prev) && w.rng.next() < 0.4;
    const kind = keep ? prev : w.rng.choices(opts.map(([k]) => k), opts.map(([, p]) => p));
    w.weather = { kind, day: w.day };
  }
  const fine = (w) => !w.weather || w.weather.kind === "맑음";
  const wet = (w) => w.weather && ["비", "폭풍", "눈"].includes(w.weather.kind);
  /** 날씨가 바깥일에 주는 영향: 비·눈은 밭일을 줄이고 폭풍은 크게 줄인다 */
  const weatherWork = (w, job) => (job && (job.workplace === "fields" || job.seasonal) ? ({ 비: 0.75, 눈: 0.7, 폭풍: 0.4 }[(w.weather || {}).kind] || 1) : 1);
  function dayOf(n, w) { if (!n.today || n.today.day !== w.day) n.today = { day: w.day, intent: null, worked: 0, ate: {}, with: [] }; return n.today; }
  const OUTINGS = { 맑음: ["meadow", "river", "square", "hill"], 흐림: ["square", "tavern"], 비: ["tavern"], 눈: ["tavern", "square"], 폭풍: [] };
  function friendFor(w, n) {
    const c = w.residents(n.town, true).filter((m) => m !== n && m.controller !== "player" && opinion(n, m.id) >= 15 && (!m.life || ["rest", "chores", "play", "social"].includes(m.life.act)));
    if (n.spouse !== null && c.some((m) => m.id === n.spouse) && w.rng.next() < 0.4) return w.npcs[n.spouse];
    if (n.lover !== null && n.lover !== undefined && c.some((m) => m.id === n.lover) && w.rng.next() < 0.6) return w.npcs[n.lover];
    return c.length ? w.rng.choices(c, c.map((m) => opinion(n, m.id) + 10)) : null;
  }
  /** 다음에 할 일 고르기 (한 시간 단위) */
  function planHour(w, n, h) {
    const t = dayOf(n, w), L = n.life || {}, J = JOBS[n.job] || {}, tr = n.traits;
    n.fatigue = n.fatigue ?? 0.2; n.mood = n.mood ?? 0.6;
    if (h < 6 || h >= 22.5) return { act: "sleep", hours: 1 };
    if (!isAdult(n)) {
      if (n.ill) return { act: "rest", hours: 2 };
      // 다 커 가는 아이는 낮에 부모의 일을 거든다 (그 일을 조금씩 익힌다)
      const par = h >= 8 && h < 16 && n.age_days >= adultAge(n.race) * DPY * 0.55 ? helpParent(w, n) : null;
      if (par && w.rng.next() < 0.45) return { act: "help", hours: w.rng.randint(2, 3), par };
      return { act: h < 19 ? "kid" : "rest", hours: 2 };
    }
    const sick = n.health < 6 || !!n.ill, rainy = wet(w), outdoorJob = J.workplace === "fields";
    const lunch = h >= 11.5 && h < 13.5 && !t.ate.L, dinner = h >= 18 && h < 20.5 && !t.ate.D;
    const intent = t.intent, holiday = w.festivalToday && w.festivalToday[n.town], restDay = w.holiday && w.holiday.kind === "rest";
    if (n.ill && n.ill.id !== "cold") return lunch || dinner ? { act: "meal", hours: 1 } : { act: "rest", hours: 2 }; // 앓아누운 사람은 집에서 쉰다
    const S = {};
    if (lunch || dinner) S.meal = 3;
    const workHours = h >= 7 && h < 18;
    const lf = lifeFrac(n), aged = n.retired ? 0.12 : 1 - clamp((lf - 0.7) * 2.5, 0, 0.6); // 늙을수록 일이 준다. 일을 놓은 사람은 가끔 손을 보탤 뿐
    if (workHours) S.work = Math.max(0, (intent === "work" ? 1.7 : intent ? 0.7 : 1.0) * (0.75 + tr.ambition * 0.35 + tr.greed * 0.25) * (1 - n.fatigue) * (rainy && outdoorJob ? 0.55 : 1) * (t.worked >= 8 ? 0.15 : 1) * (sick ? 0.3 : 1) * (n.ill && ILLS[n.ill.id].hurt ? 0 : 1) * (n.grief ? 0.75 : 1) * aged * (holiday ? 0.15 : restDay ? 0.5 : 1));
    S.rest = n.fatigue * 1.4 + (rainy && !holiday ? 0.5 : 0) + (sick ? 1.2 : 0) + (n.ill ? 1.2 : 0) + (intent === "rest" ? 1 : 0) + (lf >= 0.8 ? 0.3 : 0) + 0.05;
    if (h >= 9 && h < 20) S.play = (fine(w) ? 0.9 : rainy ? 0.15 : 0.45) * (0.4 + (1 - n.mood) * 1.1 + tr.bravery * 0.3) * (holiday && h >= 13 ? 4 : holiday ? 2 : restDay ? 1.5 : 1) * (intent === "social" ? 1.4 : 1);
    if (holiday && h >= 13) S.play = Math.max(S.play || 0, 3); // 잔치는 날씨와 상관없이 열린다
    if (S.play && (n.ill || n.grief)) S.play *= n.ill ? 0.15 : 0.35;
    S.social = (0.15 + tr.kindness * 0.3 + (1 - n.mood) * 0.35) * (intent === "social" || intent === "help" ? 2 : 1) * (h >= 17 ? 1.6 : workHours ? 0.5 : 1);
    if (h >= 9 && h < 18 && n.gold > 8) { const need = wantList(w, n).some((id) => (w.towns[n.town].stock || {})[id] > 0); S.shop = (need ? 0.8 : 0.1) + tr.greed * 0.2; }
    if (J.healer || tr.kindness > 0.75 || n.grief || lf >= 0.8) S.pray = 0.2 + (rainy ? 0.15 : 0) + (n.grief ? 0.35 : 0);
    if (n.grief) S.social *= 1.3; // 슬픔은 사람들 곁에서 달랜다
    S.chores = 0.25;
    const acts = Object.keys(S).filter((k) => S[k] > 0);
    const act = w.rng.choices(acts, acts.map((k) => S[k] ** 2));
    const hours = { work: w.rng.randint(2, 4), meal: 1, rest: w.rng.randint(1, 2), play: w.rng.randint(2, 3), social: w.rng.randint(1, 2), shop: 1, pray: 1, chores: 1 }[act];
    return { act, hours };
  }
  /** 거들 부모: 같은 마을에서 지금 일하는 중인 부모 (일을 놓았거나 앓는 부모는 빼고) */
  function helpParent(w, n) {
    const ps = n.parents.map((p) => w.npcs[p]).filter((p) => p && p.alive && p.town === n.town && !p.trip && !p.away && !p.at_war && !p.retired && !p.ill && p.life && p.life.act === "work" && JOBS[p.job] && !JOBS[p.job].haul);
    return ps.length ? ps[n.id % ps.length] : null;
  }
  /** 할 일의 자리와 함께할 사람 정하기 */
  function placeFor(w, n, act) {
    if (act === "meal" && n.ill && n.ill.id !== "cold") return { place: "home" };
    if (act === "meal") return { place: n.gold >= 3 && (n.traits.kindness > 0.4 || w.rng.next() < 0.5) && !wet(w) || n.gold >= 6 ? "tavern" : "home" };
    if (act === "play") {
      if (w.festivalToday && w.festivalToday[n.town]) return { place: "square", feast: true }; // 잔치 날은 광장으로
      const o = OUTINGS[(w.weather || {}).kind] || OUTINGS.맑음; return { place: o.length ? w.rng.choice(o) : "home", spot: w.rng.randint(0, 999) };
    }
    if (act === "social") { const f = friendFor(w, n); return f ? { place: w.rng.next() < 0.5 ? "tavern" : "house", with: f.id, host: w.rng.next() < 0.5 ? n.id : f.id } : { place: "square" }; }
    if (act === "shop") return { place: "market" };
    if (act === "pray") return { place: "temple" };
    if (act === "work") return { place: "work" };
    if (act === "kid") return { place: w.rng.next() < 0.5 ? "square" : "home" };
    if (act === "help") return { place: "work" };
    return { place: "home" };
  }
  /** 한 시간을 산다: 할 일이 끝났으면 다음을 고르고, 지금 하는 일의 효과를 받는다 */
  function liveHour(w, n, h, m0) {
    const t = dayOf(n, w);
    if (!(n.fatigue >= 0)) n.fatigue = 0.2; if (!(n.mood >= 0)) n.mood = 0.6; // 처음이거나 친구에게 불려 와 아직 고른 적이 없는 사람
    // 점심·저녁 때가 되면 하던 일을 잠깐 멈추고 밥을 먹으러 간다 (자는 중이거나 이미 먹었으면 그대로)
    const mealTime = (h >= 12 && h < 13.5 && !t.ate.L) || (h >= 18.5 && h < 20 && !t.ate.D);
    const hungryBreak = mealTime && isAdult(n) && n.life && !["meal", "sleep"].includes(n.life.act) && w.rng.next() < 0.8;
    // 잔치 날 오후: 하던 일을 놓고 광장으로
    const festBreak = isAdult(n) && w.festivalToday && w.festivalToday[n.town] && h >= 13 && h < 22 && n.life && !n.life.feast && !["sleep", "meal"].includes(n.life.act) && w.rng.next() < 0.75;
    const ap = isAdult(n) && h >= 7 && h < 22 && (!n.life || !n.life.appt) ? apptNow(w, n, h) : null;
    if (ap) {
      const other = ap.a === n.id ? ap.b : ap.a;
      n.life = { act: ap.act, until: m0 + 120, day: w.day, place: ap.place, with: other, appt: ap.id, spot: ap.id * 37 };
      if (ap.state === "planned" && w.npcs[other].controller !== "player") {
        ap.state = "kept"; adjust(n, other, 4); adjust(w.npcs[other], n.id, 4);
        if (w.rng.next() < 0.35) w.record("chat", `${jo(n.name, "과/와")} ${jo(w.npcs[other].name, "이/가")} 약속대로 ${apptText(ap)}${jo(apptText(ap), "을/를").slice(apptText(ap).length)} 했다`, { actor: n.id, target: other, town: n.town, imp: 1, sent: 2, wr: 0 });
      }
    } else if (!n.life || m0 >= n.life.until || n.life.day !== w.day || hungryBreak || festBreak) {
      const { act, hours, par } = planHour(w, n, h);
      const pl = placeFor(w, n, act);
      n.life = { act, until: m0 + hours * 60, day: w.day, ...pl };
      if (par) { n.life.with = par.id; n.life.job = par.job; }
      // 친구를 불렀다: 그 사람도 같은 자리로 (자거나 일하는 중이 아니면)
      if (pl.with !== undefined) { const f = w.npcs[pl.with]; if (f && f.alive && f.controller !== "player" && !(f.life && f.life.appt && f.life.day === w.day) && !f.ill && w.rng.next() < 0.5) { f.life = { act: "social", until: n.life.until, day: w.day, place: pl.place, with: n.id, host: pl.host }; } }
      // 놀러 가는 친구를 꼬드긴다 (맑은 날 무리 지어)
      if (act === "play" && fine(w)) { const f = friendFor(w, n); if (f && !(f.life && f.life.appt && f.life.day === w.day) && !f.ill && w.rng.next() < 0.6) { f.life = { act: "play", until: n.life.until, day: w.day, place: n.life.place, spot: n.life.spot, with: n.id }; n.life.with = f.id; } }
    }
    const L = n.life;
    switch (L.act) {
      case "sleep": n.fatigue = Math.max(0, n.fatigue - 0.12); n.mood += (0.55 - n.mood) * 0.05; break;
      case "work": t.worked += 1; n.fatigue = Math.min(1, n.fatigue + 0.09 * (1 + Math.max(0, lifeFrac(n) - 0.7) * 3)); n.mood = Math.max(0, n.mood - 0.025); break;
      case "help": { // 부모 곁에서 일을 거든다: 그 직업의 기술이 조금씩 는다
        n.helped = n.helped || {}; n.helped[L.job] = (n.helped[L.job] || 0) + 1;
        for (const k of (JOBS[L.job] && JOBS[L.job].teaches) || []) addXp(n, k, 0.25);
        n.fatigue = Math.min(1, n.fatigue + 0.05); if (L.with !== undefined && w.npcs[L.with]) { adjust(n, L.with, 0.5); adjust(w.npcs[L.with], n.id, 0.5); } break;
      }
      case "meal": {
        if (h < 15) t.ate.L = true; else t.ate.D = true;
        n.mood = Math.min(1, n.mood + 0.08); n.fatigue = Math.max(0, n.fatigue - 0.05);
        if (L.place === "home") useOwn(w, n, "eat"); // 집에서는 사 둔 것을 먹는다
        if (L.place === "tavern" && n.gold >= 2) { // 주점 밥값은 그 마을 요리사의 벌이가 된다
          const cooks = w.residents(n.town, true).filter((m) => m.job === "cook" && m !== n);
          n.gold -= 2; if (cooks.length) w.rng.choice(cooks).gold += 1.6;
        }
        break;
      }
      case "rest": if (n.health < 6) useOwn(w, n, "heal"); n.fatigue = Math.max(0, n.fatigue - 0.15); n.health = Math.min(10, n.health + 0.04); n.mood += (0.6 - n.mood) * 0.05; break;
      case "play":
        if (L.feast) { // 잔치: 광장에 모인 사람들끼리 가까워지고, 곳간에서 음식을 낸다
          const others = w.residents(n.town, true).filter((m) => m !== n && m.life && m.life.feast);
          if (others.length) { const o = w.rng.choice(others); adjust(n, o.id, 2); adjust(o, n.id, 1); }
          const tw = w.towns[n.town]; if (tw) tw.food = Math.max(0, tw.food - 0.15);
          n.mood = Math.min(1, n.mood + 0.2); break;
        }
        n.mood = Math.min(1, n.mood + 0.14); n.fatigue = Math.min(1, n.fatigue + 0.03); if (L.with !== undefined) { adjust(n, L.with, 1); maybePromise(w, n, L); } if (L.with !== undefined && w.rng.next() < 0.015) smallMoment(w, n, L); break;
      case "social": n.mood = Math.min(1, n.mood + 0.1); if (L.with !== undefined) { adjust(n, L.with, 2); if (w.rng.next() < 0.01) smallMoment(w, n, L); maybePromise(w, n, L); maybeGift(w, n, L); } break;
      case "fish": n.mood = Math.min(1, n.mood + 0.12); { const tw = w.towns[n.town]; if (tw) tw.food += 0.25; } if (L.with !== undefined) adjust(n, L.with, 1); break;
      case "shop": { if (shopFor(w, n)) n.mood = Math.min(1, n.mood + 0.06); break; }
      case "pray": n.mood = Math.min(1, n.mood + 0.08); { const pr = w.residents(n.town, true).find((m) => m.job === "priest" && m !== n); if (pr && n.gold > 1) { n.gold -= 0.3; pr.gold += 0.3; } } break;
      case "chores": n.mood += (0.55 - n.mood) * 0.03; break;
      default: break;
    }
  }
  /* 약속: 친구끼리 '며칠 뒤 몇 시에 어디서 무엇을 하자'를 정한다. 두 사람이 같은 약속을 보도록 세계에 하나의 목록(w.appts).
   *  { id, a, b, day, hour, act: fish|play|meal, place: river|meadow|hill|tavern, town, state: planned|kept|moved|broken, by }
   *  그날 그 시간이 되면 둘 다 그 자리로 간다. 바깥 약속은 비·눈·폭풍이면 미룬다. 드물게 한쪽이 바람맞히면 사이가 틀어진다.
   *  플레이어와의 약속은 story.js가 미션으로 보여 주고, 만났는지(그 시간에 곁에 갔는지)를 본다. */
  const APPT_KIND = { fish: { place: "river", word: "낚시하기로" }, play: { place: "meadow", word: "소풍 가기로" }, meal: { place: "tavern", word: "저녁을 먹기로" } };
  function makeAppt(w, a, b, opt = {}) {
    w.appts = w.appts || [];
    const pending = (x) => w.appts.filter((p) => p.state === "planned" && (p.a === x.id || p.b === x.id)).length;
    if (pending(a) >= 2 || pending(b) >= 2) return null;
    const act = opt.act || w.rng.choice(["fish", "play", "meal"]), day = opt.day ?? w.day + w.rng.randint(1, 3), hour = opt.hour ?? (act === "meal" ? 18 : w.rng.randint(10, 15));
    const ap = { id: (w.apptSeq = (w.apptSeq || 0) + 1), a: a.id, b: b.id, day, hour, act, place: opt.place || APPT_KIND[act].place, town: a.town, state: "planned", by: a.id };
    w.appts.push(ap);
    return ap;
  }
  const apptWhen = (w, ap) => `${ap.day === w.day ? "오늘" : ap.day === w.day + 1 ? "내일" : ap.day === w.day + 2 ? "모레" : `${ap.day - w.day}일 뒤`} ${ap.hour}시`;
  const apptText = (ap) => ({ fish: "냇가에서 낚시", play: "들판으로 소풍", meal: "주점에서 저녁" })[ap.act];
  /** 이 사람의 지금 시간 약속 (지킬지 여기서 정해진다) */
  function apptNow(w, n, h) {
    const ap = (w.appts || []).find((p) => (p.state === "planned" || p.state === "kept") && p.day === w.day && h >= p.hour && h < p.hour + 1 && (p.a === n.id || p.b === n.id));
    if (!ap) return null;
    if (ap.state === "kept") return ap; // 먼저 온 사람이 이미 자리에 있다: 함께한다
    const other = w.npcs[ap.a === n.id ? ap.b : ap.a];
    if (!other || !other.alive || other.at_war || other.town !== n.town && other.controller !== "player") { ap.state = "broken"; return null; }
    if ((ap.place !== "tavern" && wet(w)) || (w.festivalToday && w.festivalToday[n.town])) { // 날씨가 궂거나 잔치 날이면 미룬다
      ap.state = "moved"; const nx = { ...ap, id: ++w.apptSeq, day: w.day + w.rng.randint(1, 2), state: "planned" }; w.appts.push(nx);
      if (w.rng.next() < 0.3) w.record("chat", `${jo(n.name, "과/와")} ${jo(other.name, "이/가")} ${w.weather.kind} 때문에 ${apptText(ap)}${jo(apptText(ap), "을/를").slice(apptText(ap).length)} 다음으로 미뤘다`, { actor: n.id, target: other.id, town: n.town, imp: 1, wr: 0 });
      return null;
    }
    if (other.controller === "player") return ap; // 플레이어 쪽 결과는 story.js가 정한다
    if (ap.flake === undefined) { // 바람맞히기: 무심하거나 욕심 많은 사람이 가끔
      const who = [n, other].find((x) => w.rng.next() < 0.04 + (1 - x.traits.kindness) * 0.06 + x.traits.greed * 0.03);
      ap.flake = who ? who.id : null;
    }
    if (ap.flake !== null) {
      ap.state = "broken"; const f = w.npcs[ap.flake], v = f.id === n.id ? other : n;
      adjust(v, f.id, -8);
      w.record("stood_up", `${jo(v.name, "이/가")} ${jo(f.name, "과/와")}의 약속(${apptText(ap)})에 나갔지만 ${jo(f.name, "은/는")} 끝내 오지 않았다`, { actor: f.id, target: v.id, town: n.town, imp: 2, sent: -3, wr: 0.1 });
      return null;
    }
    return ap;
  }

  /** 함께 있는 동안 가끔 가진 것을 선물한다 */
  function maybeGift(w, n, L) {
    const f = w.npcs[L.with]; if (!f || !n.inv || w.rng.next() > 0.01 || opinion(n, f.id) < 30) return;
    const id = Object.keys(n.inv).find((x) => !["hoe", "axe"].includes(x)); if (!id) return;
    invTake(n, id); invAdd(f, id); adjust(f, n.id, 6);
    const nm = (itemOf(id) || {}).name || id;
    w.record("gift", `${jo(n.name, "이/가")} ${f.name}에게 ${nm}${jo(nm, "을/를").slice(nm.length)} 선물했다`, { actor: n.id, target: f.id, town: n.town, imp: 1, sent: 3, wr: 0 });
  }
  /** 함께 있는 동안 가끔 다음 약속을 잡는다 */
  function maybePromise(w, n, L) {
    const f = w.npcs[L.with];
    if (!f || f.controller === "player" || w.rng.next() > 0.05 || opinion(n, f.id) < 20) return;
    const ap = makeAppt(w, n, f);
    if (ap && w.rng.next() < 0.4) w.record("chat", `${jo(n.name, "과/와")} ${jo(f.name, "이/가")} ${apptWhen(w, ap)}에 ${apptText(ap)}${jo(apptText(ap), "을/를").slice(apptText(ap).length)} 하기로 했다`, { actor: n.id, target: f.id, town: n.town, imp: 1, wr: 0 });
  }
  /** 작은 추억: 맑은 날의 소풍, 친구와의 저녁 (신문에 오르지 않는 생애의 작은 사건) */
  function smallMoment(w, n, L) {
    const f = w.npcs[L.with]; if (!f) return;
    const where = { meadow: "들판으로", river: "냇가로", hill: "언덕으로", square: "광장으로", tavern: "주점으로", house: "집으로" }[L.place] || "";
    const text = L.act === "play" ? `${jo(n.name, "과/와")} ${jo(f.name, "이/가")} ${where} 놀러 가 하루를 보냈다` : `${jo(n.name, "과/와")} ${jo(f.name, "이/가")} 저녁 내내 이야기꽃을 피웠다`;
    w.record(L.act === "play" ? "outing" : "chat", text, { actor: n.id, target: f.id, town: n.town, imp: 1, sent: 2, wr: 0 });
  }
  /** 시계가 지난 시간들을 산다 (clock은 06:00부터 흐른 분) */
  function lifeUntil(w, clock) {
    const upto = Math.min(24, Math.floor(clock / 60) + 1); // 그 시간이 시작될 때 할 일을 정한다
    while ((w.lifeDone || 0) < upto) {
      const b = w.lifeDone || 0, h = 6 + b, m0 = b * 60;
      haulHour(w, h, w.day * 1440 + m0);
      for (const n of w.npcs) if (n.alive && !n.at_war && n.jail === 0 && !n.outside && !n.trip && !n.away && n.controller !== "player") liveHour(w, n, h, m0);
      w.lifeDone = b + 1;
    }
  }
  // ---------------------------------------------------------------- 마을 재고 (실제 물건)
  /* 마을마다 t.stock{물건: 개수}. 일한 날 업무가 만드는 물건이 품질만큼 쌓이고(settleWork), 사람들이 장 보러 와서 산다(shop).
   * 값은 재고에 따라 오르내린다(stockPrice). 상하는 것(빵·고기·스튜)은 날마다 조금씩 준다. 주민도 가방 n.inv를 갖고 산 것을 쓴다.
   * 물건의 값·쓰임은 화면 쪽 아이템 표(Game.ITEMS)를 본다(없으면 팩·세계의 CONTENT.items). */
  const itemOf = (id) => (root.Game && root.Game.ITEMS && root.Game.ITEMS[id]) || CONTENT.items[id] || null;
  const itemVal = (id) => { const it = itemOf(id) || {}; return it.sell || (it.price ? it.price / 2 : 4); };
  const PERISH = new Set(["bread", "meat", "meal", "dish", "fish"]);
  function stockAdd(t, id, k) { if (!t || !k || !itemOf(id)) return; t.stock = t.stock || {}; t.stock[id] = (t.stock[id] || 0) + k; }
  /** 만든 물건을 재고로: 어른 수만큼이 한도, 넘치면 버려진다 (짐꾼이 다른 마을로 실어 가야 한다) */
  function stockSupply(w, t, id, k) {
    if (!t || !k) return;
    const cap = Math.max(4, w.residents(t.id, true).length);
    const room = Math.max(0, cap - ((t.stock || {})[id] || 0)), here = Math.min(k, room);
    stockAdd(t, id, here);
    const rest = k - here; if (rest <= 0) return;
    t.glut = t.glut || {}; t.glut[id] = (t.glut[id] || 0) + rest; // 넘친 것은 팔리지 않아 버려진다 (실어 갈 사람이 있으면 다른 마을로 간다)
  }
  function stockTake(t, id, k = 1) { if (!t || !t.stock || (t.stock[id] || 0) < k) return false; t.stock[id] -= k; if (!t.stock[id]) delete t.stock[id]; return true; }
  /** 이 마을에서 이 물건 한 개의 값 (사는 값). 재고가 넉넉하면 싸고, 모자라면 비싸다 */
  function stockPrice(w, t, id) {
    const s = (t && t.stock && t.stock[id]) || 0, want = Math.max(3, (t ? w.residents(t.id, true).length : 8) / 3);
    return Math.max(1, Math.round(itemVal(id) * 1.5 * clamp(1.6 - (s / want) * 0.6, 0.6, 1.8)));
  }
  /** 파는 값: 그 물건이 이미 넘치면 덜 쳐준다 */
  function stockSellPrice(w, t, id) { return Math.max(1, Math.round(stockPrice(w, t, id) * 0.6)); }
  function stockDecay(w) { for (const t of Object.values(w.towns)) for (const id of Object.keys(t.stock || {})) if (PERISH.has(id)) { t.stock[id] = Math.floor(t.stock[id] * 0.85); if (!t.stock[id]) delete t.stock[id]; } }
  const invAdd = (n, id, k = 1) => { n.inv = n.inv || {}; n.inv[id] = (n.inv[id] || 0) + k; };
  const invTake = (n, id, k = 1) => { if (!n.inv || (n.inv[id] || 0) < k) return false; n.inv[id] -= k; if (!n.inv[id]) delete n.inv[id]; return true; };
  /** 주민이 지금 사고 싶은 것: 먹을 것 → 약 → 일 도구 → (넉넉하면) 좋은 것 */
  function wantList(w, n) {
    const J = JOBS[n.job] || {}, inv = n.inv || {}, out = [];
    const foods = Object.keys(inv).filter((id) => (itemOf(id) || {}).food).reduce((s, id) => s + inv[id], 0);
    if (foods < 2) out.push("bread", "meal", "fish");
    if (n.health < 7) out.push("salve", "fever_tonic", "potion");
    if (J.seasonal && !inv.hoe) out.push("hoe");
    if ((J.workplace === "forge" || n.job === "builder") && !inv.axe) out.push("axe");
    const LUX = [...Object.keys(CONTENT.items).filter((id) => CONTENT.items[id].gen), "gem_ring", "gem", "mead"];
    const owned = LUX.filter((id) => inv[id]).length; // 좋은 것은 이미 가진 것은 또 사지 않고, 둘까지만
    if (n.gold > 60 && owned < 2 && (n.traits.greed > 0.5 || n.mood < 0.5)) out.push(...LUX.filter((id) => !inv[id]));
    return out;
  }
  /** 장보기: 마을 재고에서 하나 사 가방에 넣는다. 돈은 그 물건을 만드는 사람(없으면 상인)에게 */
  function shopFor(w, n, t = w.towns[n.town]) {
    if (!t || !t.stock) return null;
    let ask = 0;
    for (const id of wantList(w, n)) {
      if (!(t.stock[id] > 0)) { if (ask++ < 3 && itemOf(id) && !itemOf(id).gen) { t.missed = t.missed || {}; t.missed[id] = (t.missed[id] || 0) + 1; } continue; } // 사러 왔는데 없었다
      const price = stockPrice(w, t, id); if (n.gold < price) continue;
      stockTake(t, id); invAdd(n, id); n.gold -= price;
      const makers = w.residents(t.id, true).filter((m) => m !== n && worksOf(m.job).some((x) => x.gives && x.gives[id]));
      const sellers = makers.length ? makers : w.residents(t.id, true).filter((m) => m !== n && m.job === "merchant");
      if (sellers.length) w.rng.choice(sellers).gold += price * 0.9;
      return id;
    }
    return null;
  }
  /** 가진 것을 쓴다: 집에서 밥 먹을 때 먹을 것, 아플 때 약 */
  function useOwn(w, n, why) {
    const inv = n.inv || {};
    if (why === "eat") { const f = Object.keys(inv).find((id) => (itemOf(id) || {}).food); if (f) { invTake(n, f); n.mood = Math.min(1, n.mood + 0.05); n.hunger = Math.max(0, n.hunger - 1); return f; } }
    if (why === "heal") { const m = ["fever_tonic", "potion", "salve"].find((id) => inv[id]); if (m) { invTake(n, m); n.health = Math.min(10, n.health + ((itemOf(m) || {}).heal || 3)); return m; } }
    return null;
  }

  // ---------------------------------------------------------------- 모자람과 넘침, 그리고 길 위의 사람들
  /* 장 보러 왔다가 못 산 것(t.missed)이 이어지면 모자람(t.short{물건: 날수}). 모자라면
   *  - 그 물건을 만드는 사람은 그 일을 더 자주 하고(rWork),
   *  - 마을에 만드는 사람이 없으면 그 기술을 아는 주민이 부업으로 거든다(shortDay),
   *  - 짐꾼이 넘치는 마을에서 실어 온다(haulHour).
   * 길(w.trips): { id, by, kind: goods|people, from, to, path[마을], len(칸), t0, t1(절대 분), cargo{}, riders[], back }
   *  사람은 길 위에 있는 동안 n.trip을 갖고 마을 주민 수에서 빠진다. 화면은 tripPoint로 길 위 자리를 그린다.
   *  마차가 있는 마을에서 떠나는 사람은 기다렸다(w.waiting) 마차를 탄다. 마차가 없으면 혼자 걷다 길에서 고생하기도 한다. */
  const absMinOf = (w) => w.day * 1440 + w.clock;
  const townPosOf = (w, id) => { const d = allTownDefs(w).find((t) => t.id === id); return d && d.pos; };
  /** 길로 이어진 마을들 사이의 가장 짧은 길 (마을 id 목록과 길이) */
  function routeOf(w, a, b) {
    if (a === b) return { path: [a], len: 0 };
    const defs = allTownDefs(w).filter((t) => w.towns[t.id] && t.pos), adj = {};
    const link = (x, y) => { if (!x || !y || x === y) return; (adj[x] = adj[x] || new Set()).add(y); (adj[y] = adj[y] || new Set()).add(x); };
    for (const t of defs) for (const r of t.roads || []) if (defs.some((d) => d.id === r)) link(t.id, r);
    for (const t of defs) if (!adj[t.id]) { const near = defs.filter((d) => d.id !== t.id).sort((p, q) => Math.hypot(p.pos[0] - t.pos[0], p.pos[1] - t.pos[1]) - Math.hypot(q.pos[0] - t.pos[0], q.pos[1] - t.pos[1]))[0]; if (near) link(t.id, near.id); }
    const pos = {}; for (const t of defs) pos[t.id] = t.pos;
    const D = { [a]: 0 }, prev = {}, done = new Set();
    for (;;) {
      let u = null; for (const k of Object.keys(D)) if (!done.has(k) && (u === null || D[k] < D[u])) u = k;
      if (u === null) return null;
      if (u === b) break;
      done.add(u);
      for (const v of adj[u] || []) { const d = D[u] + Math.hypot(pos[u][0] - pos[v][0], pos[u][1] - pos[v][1]); if (D[v] === undefined || d < D[v]) { D[v] = d; prev[v] = u; } }
    }
    const path = [b]; while (path[0] !== a) path.unshift(prev[path[0]]);
    return { path, len: D[b] };
  }
  const ROAD_SPEED = 0.7; // 한 분에 0.7칸 (수레·마차)
  /** 길 위의 자리 [x, y] (아직 떠나지 않았으면 떠날 마을) */
  function tripPoint(w, tr, now = absMinOf(w)) {
    const P = tr.path.map((id) => townPosOf(w, id)).filter(Boolean);
    if (!P.length) return null;
    const f = clamp((now - tr.t0) / Math.max(1, tr.t1 - tr.t0), 0, 1);
    let d = f * (tr.len || 0);
    for (let i = 0; i + 1 < P.length; i++) {
      const s = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
      if (d <= s || i + 2 === P.length) { const r = s ? Math.min(1, d / s) : 1; return [P[i][0] + (P[i + 1][0] - P[i][0]) * r, P[i][1] + (P[i + 1][1] - P[i][1]) * r, P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]]; }
      d -= s;
    }
    return [P[0][0], P[0][1], 0, 0];
  }
  const stockWant = (w, t) => Math.max(3, w.residents(t.id, true).length / 3);
  const stockCap = (w, t) => Math.max(4, w.residents(t.id, true).length);
  /** 하루 한 번: 못 산 것 → 모자람, 넘친 것 정리, 모자란 물건을 거들 사람 */
  function shortDay(w) {
    for (const t of Object.values(w.towns)) {
      if (t.fallen) continue;
      const missed = t.missed || {}, sh = (t.short = t.short || {});
      for (const id of Object.keys(sh)) if (!missed[id] || (t.stock || {})[id] > 0) { sh[id] -= 2; if (sh[id] <= 0) delete sh[id]; }
      for (const id of Object.keys(missed)) if (!((t.stock || {})[id] > 0)) sh[id] = (sh[id] || 0) + 1;
      t.missed = {}; t.glut = {};
      // 이레 넘게 모자란데 마을에 만드는 사람이 없으면, 그 일을 아는 사람이 부업으로 거든다
      for (const [id, d] of Object.entries(sh)) {
        if (d < 7 || w.rng.next() > 0.2) continue;
        const makes = (jid) => worksOf(jid).some((x) => x.gives && x.gives[id]);
        const people = w.residents(t.id, true).filter((n) => n.controller !== "player");
        if (people.some((n) => makes(n.job) || (n.side && makes(n.side)))) continue;
        const jobs = CONTENT.jobs.filter((j) => w.jobOpen(j.id) && makes(j.id) && (j.teaches || []).length);
        const who = people.filter((n) => !n.side && !n.pioneer && jobs.some((j) => knows(n, j.teaches[0])));
        if (!who.length) continue;
        const n = maxBy(who, (x) => x.traits.kindness + x.traits.ambition * 0.5), j = jobs.find((x) => knows(n, x.teaches[0]));
        n.side = j.id;
        const nm = (itemOf(id) || {}).name || id;
        w.record("side_job", `${t.name}에 ${nm}${jo(nm, "이/가").slice(nm.length)} 동나자 ${jo(n.name, "이/가")} ${j.name} 일을 부업으로 거들기 시작했다`, { actor: n.id, town: t.id, imp: 2, wr: 0.1, data: { job: j.id, item: id } });
      }
    }
  }
  /** 실어 갈 것: from에서 남는 것 → to에 모자란 것 (넘치는 것도) */
  function cargoFor(w, from, to, cap) {
    const out = {}, s = from.stock || {}, d = to.stock || {}, sh = to.short || {};
    const want = stockWant(w, to), keep = stockWant(w, from), room = stockCap(w, to);
    const ids = Object.keys(s).filter((id) => itemOf(id)).sort((a, b) => (sh[b] || 0) - (sh[a] || 0) || (s[b] - s[a]));
    let left = cap;
    for (const id of ids) {
      if (left <= 0) break;
      const spare = Math.floor(s[id] - keep), need = Math.ceil((sh[id] ? want * 1.5 : want) - (d[id] || 0));
      const k = Math.min(spare, need, left, room - (d[id] || 0));
      if (k > 0) { out[id] = k; left -= k; }
    }
    return out;
  }
  const cargoScore = (w, from, to, c) => Object.entries(c).reduce((s, [id, k]) => s + k * ((to.short || {})[id] ? 3 : 1), 0);
  /** 두 마을 사이 모자라고 넘치는 짝의 수 (짐꾼 직업의 수요) */
  function tradeGaps(w) {
    const open = Object.values(w.towns).filter((t) => !t.fallen && w.residents(t.id, true).length >= 3);
    let n = 0;
    for (const to of open) for (const id of Object.keys(to.short || {})) if (to.short[id] >= 3 && open.some((f) => f !== to && ((f.stock || {})[id] || 0) > stockWant(w, f) + 1)) n++;
    return n;
  }
  const hauler = (n) => { const J = JOBS[n.job]; return J && J.haul; };
  const tripOf = (w, n) => (w.trips || []).find((t) => t.id === n.trip);
  function startTrip(w, n, kind, from, to, t0, opt = {}) {
    const r = routeOf(w, from, to); if (!r || r.len <= 0) return null;
    const tr = { id: (w.tripSeq = (w.tripSeq || 0) + 1), by: n.id, kind, from, to, path: r.path, len: Math.round(r.len), t0, t1: t0 + Math.round(r.len / (opt.speed || ROAD_SPEED)), cargo: opt.cargo || {}, riders: opt.riders || [], back: !!opt.back };
    (w.trips = w.trips || []).push(tr);
    n.trip = tr.id; for (const id of tr.riders) if (w.npcs[id]) w.npcs[id].trip = tr.id;
    return tr;
  }
  const cargoText = (c) => Object.entries(c).map(([id, k]) => `${(itemOf(id) || {}).name || id} ${k}개`).join(", ");
  /** 도착: 짐을 풀어 팔고(짐꾼), 손님을 내려 주고(마부), 돌아갈 길을 잡는다 */
  function arrive(w, tr, now) {
    w.trips = w.trips.filter((x) => x !== tr);
    const n = w.npcs[tr.by], to = w.towns[tr.to], from = w.towns[tr.from];
    const riders = tr.riders.map((id) => w.npcs[id]).filter(Boolean);
    if (n) n.trip = null;
    for (const r of riders) r.trip = null;
    if (tr.kind === "walk") { // 혼자 걸어온 길
      if (n && n.alive && tr.trouble) roadTrouble(w, n, to || from, tr.trouble);
      if (n && n.alive) land(w, n, tr.to, null);
      return;
    }
    if (!n || !n.alive || !to || to.fallen) return;
    n.heard = n.heard || {}; if (from) n.heard[from.id] = { day: w.day, stock: { ...(from.stock || {}) } }; // 떠나온 마을 소식을 갖고 온다
    if (tr.kind === "goods" && Object.keys(tr.cargo).length) {
      let got = 0;
      for (const [id, k] of Object.entries(tr.cargo)) { got += stockPrice(w, to, id) * 0.5 * k; stockAdd(to, id, k); if (to.short && to.short[id]) to.short[id] = Math.max(0, to.short[id] - k); }
      n.gold += got; addXp(n, (JOBS[n.job].teaches || [])[0], 2);
      if (w.rng.next() < 0.35) w.record("haul", `${JOBS[n.job].name} ${jo(n.name, "이/가")} ${from ? from.name + "에서 " : ""}${cargoText(tr.cargo)}${jo(cargoText(tr.cargo), "을/를").slice(cargoText(tr.cargo).length)} 싣고 ${to.name}에 왔다`, { actor: n.id, town: to.id, imp: 1, wr: 0, data: { cargo: tr.cargo, from: tr.from } });
    }
    for (const r of riders) if (r.alive && r.controller !== "player") land(w, r, to.id, n);
    if (tr.back) return; // 집에 돌아왔다
    // 돌아갈 길: 늦었으면 하룻밤 묵고 이튿날 아침에
    const h = Math.floor((now % 1440) / 60) + 6, t0 = h < 17 ? now + 30 : (Math.floor(now / 1440) + 1) * 1440 + 60;
    const home = w.towns[tr.from];
    if (!home || home.fallen) { w.move(n, to.id); return; }
    const cap = 6 + 2 * skillLv(n, (JOBS[n.job].teaches || [])[0] || ""), cargo = tr.kind === "goods" ? cargoFor(w, to, home, cap) : {};
    const back = tr.kind === "people" ? (w.waiting || []).filter((x) => x.to === home.id && w.npcs[x.id] && locOf(w.npcs[x.id]) === to.id && !w.npcs[x.id].trip).slice(0, 4).map((x) => x.id) : [];
    buyCargo(w, n, to, cargo);
    for (const id of back) { const r = w.npcs[id]; const fare = Math.min(r.gold, 6 + Math.round(tr.len / 25)); r.gold -= fare; n.gold += fare; }
    startTrip(w, n, tr.kind, to.id, home.id, t0, { cargo, riders: back, back: true });
  }
  function buyCargo(w, n, t, cargo) {
    for (const [id, k] of Object.entries(cargo)) {
      const price = stockSellPrice(w, t, id); let got = 0;
      while (got < k && n.gold >= price && stockTake(t, id)) { n.gold -= price; got++; }
      if (got) cargo[id] = got; else delete cargo[id];
    }
  }
  /** 시간마다: 도착을 보고, 아침 7시엔 짐꾼·마부가 길을 나선다 */
  function arriveDue(w, now = absMinOf(w)) { for (const tr of [...(w.trips || [])]) if (tr.t1 <= now) arrive(w, tr, now); }
  function haulHour(w, h, now) {
    arriveDue(w, now);
    // 혼자 기다리다 지친 사람은 걸어서 떠난다
    w.waiting = (w.waiting || []).filter((x) => { const r = w.npcs[x.id]; return r && r.alive && r.going && (x.from === undefined || locOf(r) === x.from) && locOf(r) !== x.to; }); // 그새 다른 일로 떠난 사람은 뺀다
    if (h !== 7 || (w.weather || {}).kind === "폭풍") return;
    // 마차를 오래 기다린 사람은 걸어서 간다 (나들이는 하루, 이주는 사흘)
    for (const x of [...w.waiting]) { const r = w.npcs[x.id]; if (w.day - x.day > (r.going.kind === "move" ? 3 : 1)) { w.waiting = w.waiting.filter((y) => y !== x); depart(w, r, now, true); } }
    visitDay(w, now);
    for (const n of w.alive()) {
      const kind = hauler(n);
      if (!kind || n.trip || n.controller === "player" || !isAdult(n) || n.at_war || n.jail > 0 || n.health < 5 || n.ill || n.retired) continue;
      if ((w.appts || []).some((p) => p.state === "planned" && (p.a === n.id || p.b === n.id) && p.day <= w.day + 1)) continue; // 약속이 있는 날엔 먼 길을 나서지 않는다
      const home = w.towns[n.town]; if (!home || home.fallen) continue;
      const cap = 6 + 2 * skillLv(n, (JOBS[n.job].teaches || [])[0] || "");
      if (kind === "goods") {
        // 가고 오는 길 모두 실어 나를 것이 많은 마을로 (너무 멀면 가지 않는다)
        let best = null;
        for (const to of Object.values(w.towns)) {
          if (to === home || to.fallen) continue;
          const r = routeOf(w, home.id, to.id); if (!r || r.len > 420) continue;
          const go = cargoFor(w, home, to, cap), back = cargoFor(w, to, home, cap);
          const sc = (cargoScore(w, home, to, go) + cargoScore(w, to, home, back)) / (1 + r.len / 200);
          if (sc >= 3 && (!best || sc > best.sc)) best = { to, go, sc };
        }
        if (!best) continue;
        buyCargo(w, n, home, best.go);
        const tr = startTrip(w, n, "goods", home.id, best.to.id, now, { cargo: best.go });
        if (tr) n.today = { day: w.day, worked: 7, ate: n.today && n.today.ate };
      } else {
        // 마차: 기다리는 손님이 있는 곳으로 (없으면 사흘에 한 번 가장 가까운 큰 마을까지 다녀온다)
        const wait = (w.waiting || []).filter((x) => { const r = w.npcs[x.id]; return r && r.alive && locOf(r) === home.id && !r.trip; });
        let to = wait.length ? w.towns[wait[0].to] : null;
        if (!to && (w.day + n.id) % 3 === 0) to = maxBy(Object.values(w.towns).filter((t) => t !== home && !t.fallen && routeOf(w, home.id, t.id)), (t) => w.residents(t.id).length - (routeOf(w, home.id, t.id).len / 40));
        if (!to || to.fallen) continue;
        const riders = wait.filter((x) => x.to === to.id).slice(0, 4).map((x) => x.id);
        for (const id of riders) { const r = w.npcs[id]; const fare = Math.min(r.gold, 6 + Math.round((routeOf(w, home.id, to.id) || { len: 0 }).len / 25)); r.gold -= fare; n.gold += fare; }
        const tr = startTrip(w, n, "people", home.id, to.id, now, { riders });
        if (tr) n.today = { day: w.day, worked: 7, ate: n.today && n.today.ate };
      }
    }
  }

  // ---------------------------------------------------------------- 다니러 가기: 이주가 아닌 다녀오는 길
  /* 사람들은 이사 말고도 다른 마을에 다녀온다. n.going{to, kind: move|visit|home, why, stay, host, item}은 '떠나려는 길',
   * n.away{at, until, why, host, since}는 '다른 마을에 머무는 중'(그동안 사는 마을 n.town은 그대로, 주민 수에선 빠진다).
   *  왜 가나(visitDay, 아침 7시): 가족·친한 사람 보러(see), 우리 마을에 동난 물건 사러(shop), 의원·사제가 없어 몸 고치러(heal), 구경(tour).
   *  쉬는 날엔 더 많이 다닌다. 머무는 날이 지나면 집으로 돌아온다(kind home).
   *  마부가 있는 마을이면 마차를 기다렸다 타고, 없으면 걷는다(걷는 길도 길 위에 보이고, 멀면 고생한다). */
  const locOf = (n) => (n.away ? n.away.at : n.town);
  const WALK_SPEED = 0.35; // 걸어서는 한 분에 0.35칸
  const coachAt = (w, tid) => w.alive().some((m) => m.town === tid && !m.away && !m.trip && hauler(m) === "people" && m.controller !== "player");
  function depart(w, n, now, walk = false) {
    const g = n.going, from = locOf(n);
    if (!g || g.to === from || !w.towns[g.to]) { n.going = null; return; }
    gainExp(n, "body", "road", g.kind === "move" ? 20 : 6);
    if (!walk && coachAt(w, from)) { w.waiting = (w.waiting || []).filter((x) => x.id !== n.id); w.waiting.push({ id: n.id, to: g.to, from, day: w.day }); return; }
    w.waiting = (w.waiting || []).filter((x) => x.id !== n.id);
    const tr = startTrip(w, n, "walk", from, g.to, now, { speed: WALK_SPEED });
    if (!tr) { land(w, n, g.to, null); return; }
    if (w.rng.next() < Math.min(n.going.kind === "move" ? 0.15 : 0.05, tr.len / (n.going.kind === "move" ? 2000 : 5000))) tr.trouble = w.rng.next() < 0.5 && n.gold > 10 ? "rob" : "lost";
  }
  function roadTrouble(w, n, T, kind) {
    const where = T ? `${T.name} 가는 ` : "";
    if (kind === "rob") { const lost = Math.round(n.gold * 0.2); n.gold -= lost; w.record("road_trouble", `${jo(n.name, "이/가")} ${where}먼 길에서 도적을 만나 금화 ${lost}닢을 빼앗겼다`, { target: n.id, town: n.town, imp: 2, wr: 0.2 }); }
    else { n.health = Math.max(1, n.health - 2); w.record("road_trouble", `${jo(n.name, "이/가")} ${where}먼 길에서 길을 잃고 한참을 헤맸다`, { target: n.id, town: n.town, imp: 2, wr: 0.2 }); }
  }
  const healerIn = (w, tid) => w.residents(tid, true).filter((m) => m.controller !== "player" && worksOf(m.job).some((x) => x.effects && x.effects.heal));
  /** 닿았다: 이주·다니러 옴·집으로 */
  function land(w, n, to, driver) {
    const g = n.going || { kind: "move", to }; n.going = null;
    w.waiting = (w.waiting || []).filter((x) => x.id !== n.id);
    const T = w.towns[to]; if (!T || !n.alive) return;
    const by = driver ? ` ${JOBS[driver.job].name} ${driver.name}의 마차를 타고` : "";
    if (g.kind === "home" || to === n.town) {
      const a = n.away; n.away = null;
      if (a && w.rng.next() < 0.5) w.record("journey", journeyText(w, n, a), { actor: n.id, target: a.host ?? null, town: n.town, imp: 1, sent: 1, wr: 0, data: { to: a.at, why: a.why } });
      return;
    }
    if (g.kind === "visit") {
      n.away = { at: to, until: w.day + (g.stay || 1), why: g.why, host: g.host, item: g.item, since: w.day };
      if (g.why === "shop") { const got = shopFor(w, n, T); if (got) n.away.got = got; }
      if (g.why === "heal") { const hs = healerIn(w, to); if (hs.length) { const d = w.rng.choice(hs), fee = Math.min(n.gold, 6); n.gold -= fee; d.gold += fee; n.health = Math.min(healthCap(n), n.health + 4); treat(w, n, 4); n.away.healer = d.id; adjust(n, d.id, 6); } }
      if (g.host !== undefined && w.npcs[g.host]) { adjust(n, g.host, 6); adjust(w.npcs[g.host], n.id, 6); }
      return;
    }
    const old = w.towns[n.town] ? w.towns[n.town].name : "";
    n.away = null; w.move(n, to); if (!n.stat.towns.includes(to)) n.stat.towns.push(to);
    w.record("travel", `${jo(n.name, "이/가")}${g.reason || ""}${by} ${jo(old, "을/를")} 떠나 ${jo(T.name, "으로/로")} 이주했다`, { actor: n.id, target: driver ? driver.id : null, town: to, imp: g.reason ? 3 : 2, wr: 0 });
  }
  function journeyText(w, n, a) {
    const T = w.towns[a.at], tn = T ? T.name : "먼 마을", h = a.host !== undefined ? w.npcs[a.host] : null;
    const it = a.got || a.item, iname = it ? (itemOf(it) || {}).name || it : "";
    switch (a.why) {
      case "see": return h ? `${jo(n.name, "이/가")} ${jo(h.name, "을/를")} 보러 ${tn}에 다녀왔다` : `${jo(n.name, "이/가")} ${tn}에 다녀왔다`;
      case "shop": return a.got ? `${jo(n.name, "이/가")} 마을에 동난 ${jo(iname, "을/를")} 사러 ${tn}까지 다녀왔다` : `${jo(n.name, "이/가")} ${jo(iname, "을/를")} 사러 ${tn}까지 갔지만 빈손으로 돌아왔다`;
      case "heal": return a.healer !== undefined ? `${jo(n.name, "이/가")} 몸을 고치러 ${tn}의 ${jo(w.npcs[a.healer].name, "을/를")} 찾아갔다 왔다` : `${jo(n.name, "이/가")} 몸을 고치러 ${tn}에 다녀왔다`;
      default: return `${jo(n.name, "이/가")} ${tn} 구경을 다녀왔다`;
    }
  }
  /** 아침마다: 돌아올 날이 된 사람은 집으로, 그리고 오늘 다른 마을에 다니러 갈 사람 */
  function visitDay(w, now) {
    const rest = w.holiday && w.holiday.kind === "rest", busy = w.weather && (w.weather.kind === "눈" || w.weather.kind === "비");
    for (const n of w.alive()) {
      if (n.controller === "player" || !isAdult(n) || n.at_war || n.jail > 0 || n.trip) continue;
      if (n.away) { if (w.day >= n.away.until && !n.going) { n.going = { to: n.town, kind: "home" }; depart(w, n, now); } continue; }
      if (n.going || hauler(n) || n.health < 2) continue;
      if ((w.appts || []).some((p) => p.state === "planned" && (p.a === n.id || p.b === n.id) && p.day <= w.day + 4)) continue; // 잡아 둔 약속이 있으면 길을 나서지 않는다
      const home = w.towns[n.town]; if (!home || home.fallen) continue;
      const near = (tid) => { if (tid === n.town || !w.towns[tid] || w.towns[tid].fallen) return null; const r = routeOf(w, n.town, tid); return r && r.len <= 380 ? r : null; };
      const k = (rest ? 3 : 1) * (busy ? 0.4 : 1);
      let plan = null;
      // 아픈데 우리 마을에 고쳐 줄 사람이 없으면
      const ailing = n.health < 6 || (n.ill && n.ill.id !== "cold");
      if (ailing && !healerIn(w, n.town).length && w.rng.next() < 0.25) {
        const t = Object.values(w.towns).filter((x) => near(x.id) && healerIn(w, x.id).length).sort((a, b) => near(a.id).len - near(b.id).len)[0];
        if (t) plan = { to: t.id, why: "heal", stay: 2 };
      }
      if (!plan && (n.ill || lifeFrac(n) >= 0.9)) continue; // 앓는 사람·아주 늙은 사람은 나들이를 하지 않는다
      // 우리 마을에 동난 것을 사러
      if (!plan && n.gold >= 25 && w.rng.next() < 0.06 * k) {
        const want = wantList(w, n).filter((id) => (home.short || {})[id] >= 3);
        for (const id of want) { const t = Object.values(w.towns).filter((x) => near(x.id) && ((x.stock || {})[id] || 0) >= 2).sort((a, b) => near(a.id).len - near(b.id).len)[0]; if (t) { plan = { to: t.id, why: "shop", stay: 1, item: id }; break; } }
      }
      // 가족·친한 사람 보러
      if (!plan && w.rng.next() < 0.02 * k * (0.5 + n.traits.kindness)) {
        const fam = new Set(family(n));
        const who = Object.keys(n.rel || {}).map(Number).map((id) => w.npcs[id]).filter((f) => f && f.alive && f.controller !== "player" && !f.away && !f.trip && !f.at_war && near(f.town) && (fam.has(f.id) || opinion(n, f.id) >= 40));
        if (who.length) { const f = maxBy(who, (x) => opinion(n, x.id) + (fam.has(x.id) ? 40 : 0) + w.rng.next() * 20); plan = { to: f.town, why: "see", stay: w.rng.randint(1, 3), host: f.id }; }
      }
      // 구경 (잔치 날이면 이웃 마을 잔치 구경)
      if (!plan && w.rng.next() < 0.002 * k * (0.5 + n.traits.ambition)) {
        const opts = Object.values(w.towns).filter((x) => near(x.id));
        if (opts.length) plan = { to: w.rng.choice(opts).id, why: "tour", stay: w.rng.randint(1, 2) };
      }
      if (plan) { n.going = { ...plan, kind: "visit" }; depart(w, n, now); }
    }
  }

  /** 하루 끝: 일한 만큼 정산한다 (7시간이 하루치) */
  function settleWork(w) {
    for (const n of w.alive()) {
      const t = n.today;
      if (!t || t.day !== w.day || !t.worked || n.controller === "player" || !isAdult(n) || n.at_war) continue;
      const tool = (JOBS[n.job] || {}).seasonal && n.inv && n.inv.hoe ? 1.1 : 1; // 괭이가 있는 농부는 더 거둔다
      const scale = Math.min(1.3, t.worked / 7) * (0.85 + 0.3 * (n.mood ?? 0.6)) * tool;
      rWork(n, w, scale);
      // 만든 물건은 마을 재고로 (업무의 결과물 × 품질 × 일한 만큼)
      const tw = w.towns[n.town], lw = n.lastWork, wk = lw && lw.day === w.day && CONTENT.works.find((x) => x.id === lw.id);
      if (wk && wk.gives) for (const [id, k] of Object.entries(wk.gives)) stockSupply(w, tw, id, Math.max(1, Math.round(k * gradeOf(lw.q).mult * Math.min(1, scale))));
      if ((JOBS[n.job] || {}).seasonal && w.harvestMult() > 0.3 && w.rng.next() < 0.5 * scale) stockSupply(w, tw, "wheat", 1);
      if (n.job === "adventurer" && w.rng.next() < 0.3) stockSupply(w, tw, w.rng.choice(["meat", "hide", "old_coin"]), 1);
      if (tool > 1 && w.rng.next() < 0.01) invTake(n, "hoe"); // 연장은 닳는다
      const J = JOBS[n.job] || {}; // 몸 쓰는 일은 가끔 다친다 (늙을수록 잦다)
      if (["fields", "forge"].includes(J.workplace) && w.rng.next() < 0.0025 * Math.min(1, scale) * (isElder(n) ? 2 : 1)) fallIll(w, n, "hurt", J.workplace === "forge" ? "쇠를 다루다" : "밭일하다");
    }
  }
  /** 지금 무얼 하는지 (말 걸 때·사람 목록에 쓰인다) */
  const LIFE_LABEL_FEAST = "잔치 중";
  const LIFE_LABEL = { fish: "낚시하는 중", sleep: "자는 중", work: "일하는 중", meal: "밥 먹는 중", rest: "쉬는 중", play: "놀러 나감", social: "친구와 함께", shop: "장 보는 중", pray: "기도하는 중", chores: "집안일", kid: "노는 중", help: "일 거드는 중" };

  // ================================================================ 농업의 발전
  /* 사람이 늘면 굶주림이 온다. 굶주림을 겪은 마을에서 솜씨 좋은 농부가 새 농법을 깨치고, 농법은 그 마을의 수확을 늘린다.
   * 농법(CONTENT.innovations)은 순서대로: { id, name, yield(수확 +), lv(농부 솜씨), stress(최근 1년 굶주림 신호 수), with(함께 있어야 할 직업), after, text }
   * 정해진 농법을 다 익힌 마을은 품종 개량을 이어 간다(끝이 없다, 한 번에 조금씩). 농법은 가까운 마을로 퍼진다. 마을의 것: t.agri {ids, breed} */
  const farmMult = (t) => { if (!t || !t.agri) return 1; const I = CONTENT.innovations || []; return 1 + t.agri.ids.reduce((s, id) => s + ((I.find((x) => x.id === id) || {}).yield || 0), 0) + (t.agri.breed || 0) * 0.05; };
  function agriLife(w) {
    if (w.day % 30 !== 23) return;
    const I = CONTENT.innovations || [], towns = Object.values(w.towns).filter((t) => !t.fallen);
    for (const t of towns) {
      t.agri = t.agri || { ids: [], breed: 0 };
      const stress = w.events.filter((e) => e && e.town === t.id && w.day - e.day <= DPY && ["food_worry", "granary_open", "food_aid", "drought"].includes(e.kind)).length
        + w.npcs.filter((n) => !n.alive && n.town === t.id && n.death_day !== null && w.day - n.death_day <= DPY && /굶주림/.test(n.death_cause || "")).length * 2;
      const farmers = w.residents(t.id, true).filter((n) => JOBS[n.job] && JOBS[n.job].seasonal && n.controller !== "player");
      if (!farmers.length) continue;
      const best = maxBy(farmers, (n) => skillLv(n, "farming") + n.traits.ambition), lv = skillLv(best, "farming");
      const next = I.find((x) => !t.agri.ids.includes(x.id) && (x.after || []).every((a) => t.agri.ids.includes(a)));
      if (next) {
        if (lv < (next.lv || 2) || stress < (next.stress || 1) || (next.with && !w.residents(t.id, true).some((n) => n.job === next.with)) || w.rng.next() > 0.25) continue;
        t.agri.ids.push(next.id);
        w.record("farm_new", fill(next.text || "{me:이/가} ‘{k}’{k~을/를} 생각해 냈다. {town}의 밭이 더 많이 거둘 것이다", { me: best.name, k: next.name, town: t.name }), { actor: best.id, town: t.id, imp: 5, wr: 0.4, data: { innov: next.id, mult: Math.round(farmMult(t) * 100) / 100 } });
      } else if (lv >= 3 && stress >= 1 && w.rng.next() < 0.12) {
        t.agri.breed = (t.agri.breed || 0) + 1;
        w.record("farm_new", `${jo(best.name, "이/가")} 굶주린 해를 겪으며 씨앗을 골라 심어, 더 잘 여무는 ${t.name}의 곡식을 얻었다 (${t.agri.breed}대 개량)`, { actor: best.id, town: t.id, imp: 4, wr: 0.3, data: { breed: t.agri.breed, mult: Math.round(farmMult(t) * 100) / 100 } });
      }
    }
    // 퍼지기: 가까운 마을(거리 60 안)의 농법을 배워 온다
    for (const t of towns) for (const u of towns) {
      if (t === u || !u.agri || !t.agri || Math.hypot(t.x - u.x, t.y - u.y) > 60 * SPREAD) continue;
      const learnable = u.agri.ids.find((id) => !t.agri.ids.includes(id) && ((I.find((x) => x.id === id) || {}).after || []).every((a) => t.agri.ids.includes(a)));
      if (learnable && w.rng.next() < 0.08) { t.agri.ids.push(learnable); const N = I.find((x) => x.id === learnable); w.record("farm_spread", `${u.name}의 ‘${N.name}’${jo(N.name, "이/가").slice(N.name.length)} ${t.name}에도 전해졌다`, { town: t.id, imp: 3, wr: 0.2, data: { innov: learnable, from: u.id } }); }
      if ((u.agri.breed || 0) > (t.agri.breed || 0) + 1 && w.rng.next() < 0.05) t.agri.breed++;
    }
  }

  // ================================================================ 경험 → 새 지식 (끝없이 생겨나는 앎)
  /* 사람은 하는 일마다 '분야:대상' 경험을 쌓는다 (n.exp). 경험이 깊어지면 그 분야 × 대상의 지식이 이 세계에 처음 생긴다.
   * 대상(SUBJECTS, content)은 물건·자연·현상·원소이고, 이 세계의 종족·환경도 대상이 된다(race:<id>, env:<이름>).
   * 생긴 지식은 이름·직업 이름·업무·결과물·수요를 규칙으로 갖춰 w.defs에 저장되고, 수요가 맞으면 genesis가 직업으로 만든다.
   * 새 종족이 생기면 그 종족도 대상이 되므로 지식과 직업은 끝이 없다. */
  const DOM = {
    craft:     { k: "{s} 공예", job: "{s} 공예가", work: "{s} 공예품 만들기", prod: "공예품", shape: "urn" },
    heat:      { k: "{s} 달구기", job: "{s} 장인", work: "{s} 달구어 빚기", prod: "구이", shape: "bowl" },
    art:       { k: "{s} 꾸미기", job: "{s} 장식가", work: "{s} 장식 만들기", prod: "장식", shape: "flower" },
    nature:    { k: "{s} 기르기", job: "{s} 지기", work: "{s} 돌보며 거두기" },
    care:      { k: "{s} 돌보기", job: "{s} 의원", work: "{s} 돌보기" },
    knowledge: { k: "{s} 읽기", job: "{s} 학자", work: "{s} 풀어 주기" },
    magic:     { k: "{s} 부리기", job: "{s} 술사", work: "{s}의 힘 빌려주기" },
    social:    { k: "{s} 흥정", job: "{s} 중개인", work: "{s} 거래 잇기" },
    language:  { k: "{s}", job: "{s} 통역가", work: "{s} 옮겨 주기" },
    body:      { k: "{s} 솜씨", job: "{s} 꾼", work: "{s} 일 맡기" },
  };
  const subjectOf = (id) => {
    if (id.startsWith("race:")) { const r = RACES[id.slice(5)]; return r ? { id, name: r.name + "말", race: r.id, kind: "race", doms: ["language"], color: (r.look && r.look.skin || ["#c8a080"])[0] } : null; }
    if (id.startsWith("env:")) { const e = ENVS[id.slice(4)]; return e ? { id, name: e.land, kind: "env", doms: ["nature", "knowledge", "body"], names: e.names, color: e.color } : null; }
    return (CONTENT.subjects || []).find((s) => s.id === id) || null;
  };
  function gainExp(n, dom, subj, k = 1) { n.exp = n.exp || {}; const t = dom + ":" + subj; n.exp[t] = (n.exp[t] || 0) + k; }
  /** 경험에서 지식 정의를 만든다 (데이터만) */
  function makeKnowledge(w, dom, S) {
    const D = DOM[dom] || DOM.craft, id = `x_${dom}_${S.id.replace(/[^a-z0-9]/gi, "_")}`;
    const nm = (S.names || {})[dom]; // 대상별로 자연스러운 이름이 있으면 그것: [지식, 직업, 업무]
    const K = { id, name: nm ? nm[0] : fill(D.k, { s: S.name }), desc: `${S.name}${jo(S.name, "을/를").slice(S.name.length)} 오래 다뤄 생긴 앎`, domain: [dom], noun: S.name,
      jobName: nm ? nm[1] : fill(D.job, { s: S.name }), workName: nm && nm[2] ? nm[2] : fill(D.work, { s: S.name }), born: null, subject: S.id, made: w.day };
    // 수요: 대상이 종족이면 그 종족이 있고 나라가 여럿일 때, 현상이면 그 현상이 잦을 때, 그 밖엔 사람이 넉넉할 때
    K.demand = S.race ? { race: S.race, nations: 2 } : S.demand ? { ...S.demand } : { pop: 50 };
    if (S.race) { K.lang = S.race; K.client = "race:" + S.race; }
    if (D.prod && S.item) { // 물건을 만드는 지식: 대상 물건으로 새 물건을 빚는다
      const iid = `gi_${S.id}_${dom}`;
      w.defs.items = w.defs.items || {};
      w.defs.items[iid] = { name: `${S.name} ${D.prod}`, sell: Math.round(((CONTENT.items[S.item] || {}).sell || 4) * 2 + 6), art: [D.shape, S.color || "#a89070"], hint: `${K.jobName}${jo(K.jobName, "이/가").slice(K.jobName.length)} 빚는다` };
      K.makes = { needs: { [S.item]: 2 }, gives: { [iid]: 1 } };
    }
    return K;
  }
  /** 날마다 몇 사람의 경험을 본다. 깊은 경험은 아무도 모르던 지식이 되거나(처음), 남이 먼저 깨친 지식을 혼자 깨치게 한다 */
  function experienceBirth(w) {
    w.defs = w.defs || { jobs: [], works: [] }; w.defs.knowledge = w.defs.knowledge || [];
    const people = w.alive().filter((n) => isAdult(n) && n.exp && n.controller !== "player");
    for (let i = 0; i < 4 && people.length; i++) {
      const n = w.rng.choice(people);
      // 지금 하는 일(주 직업·부업)이 원래 쌓는 경험은 그 일의 숙련일 뿐이다. 새 앎은 일 밖의 경험, 또는 두 경험이 만나서 생긴다
      const own = new Set([...((JOBS[n.job] || {}).exp || []), ...((JOBS[n.side] || {}).exp || [])].map(([d, s]) => d + ":" + s));
      const deep = Object.entries(n.exp).filter(([, v]) => v >= 80);
      if (!deep.length) continue;
      let [tag, v] = w.rng.choice(deep);
      if (own.has(tag)) {
        const other = deep.filter(([t2]) => t2 !== tag);
        if (!other.length) continue;
        const [t2, v2] = w.rng.choice(other); // 분야는 한 경험에서, 대상은 다른 경험에서
        tag = tag.slice(0, tag.indexOf(":")) + ":" + t2.slice(t2.indexOf(":") + 1); v = Math.min(v, v2);
        if (own.has(tag)) continue;
      }
      const cut = tag.indexOf(":"), dom = tag.slice(0, cut), S = subjectOf(tag.slice(cut + 1));
      if (!S || !DOM[dom] || (S.doms && !S.doms.includes(dom))) continue; // 대상에 어울리는 분야만 (길 장식가 같은 것은 없다)
      const id = `x_${dom}_${S.id.replace(/[^a-z0-9]/gi, "_")}`, K0 = KNOW(id), exists = CONTENT.knowledge.some((k) => k.id === id);
      if (exists) { if (!knows(n, id) && w.rng.next() < 0.03 * (v / 80)) learn(n, id); continue; }
      if (w.rng.next() > 0.004 * Math.min(3, v / 80)) continue; // 처음 생기는 앎은 드물다
      const K = makeKnowledge(w, dom, S);
      w.defs.knowledge.push(K); applyDefs(w); learn(n, K.id);
      w.record("discovery", `${S.name}${jo(S.name, "을/를").slice(S.name.length)} 오래 다뤄 온 ${jo(n.name, "이/가")} ‘${K.name}’${jo(K.name, "을/를").slice(K.name.length)} 깨쳤다. 이 세계에서 처음 생겨난 앎이다`, { actor: n.id, town: n.town, imp: 5, wr: 0.4, data: { skill: K.id, how: "experience", subject: S.id } });
    }
  }

  // ================================================================ 종족이 생겨나고 사라진다
  /* 한 달에 한 번 본다. 새 종족은 w.defs.races에 저장되어 그 세계에만 있다. 생김새는 기존 그림 조각(귀·뿔·꼬리·수염·색)의 조합.
   *  혼혈이 굳어짐: 두 종족의 피가 각각 1/4 이상 섞인 사람이 넷 이상이면 그 둘을 잇는 종족이 된다 (이후 그 둘 사이의 아이도 그 종족으로 태어나기도)
   *  환경 적응: 한 종족이 서리·숲·물가·볕의 땅에서 넷 이상 대를 이으면 그 땅의 종족으로 갈라진다
   *  마법 사건: 아주 드물게 마력의 폭풍이 몇 사람을 바꿔 새 종족을 낳는다
   *  사라짐: 살아 있는 사람이 한 명도 없으면 그 종족은 사라진다 (기록에 남는다) */
  const ENVS = {
    frost: { name: "서리", land: "서리 땅", names: { nature: ["눈밭 살이", "설원지기"], knowledge: ["눈길 읽기", "설원 안내인"], body: ["얼음 깨기", "얼음꾼"] }, color: "#c8dcf0", traits: { bravery: 0.08, kindness: -0.03 }, life: 1.1, tint: "#dce8f4" },
    wood:  { name: "숲", land: "숲", names: { nature: ["깊은 숲 살이", "숲지기"], knowledge: ["숲길 읽기", "숲 안내인"], body: ["나무 타기", "나무꾼"] }, color: "#5a8a4a", traits: { kindness: 0.06, ambition: -0.05 }, life: 1.15, tint: "#b8d0a0" },
    shore: { name: "물가", land: "물가", names: { nature: ["물고기 잡기", "어부"], knowledge: ["물길 읽기", "뱃길 안내인"], body: ["헤엄", "잠수꾼"] }, color: "#6aa0c8", traits: { greed: 0.05, kindness: 0.03 }, life: 1.0, tint: "#a8c8e0" },
    sun:   { name: "볕", land: "볕 드는 땅", names: { nature: ["마른 땅 살이", "샘지기"], knowledge: ["볕길 읽기", "사막 안내인"], body: ["뙤약볕 견디기", "물장수"] }, color: "#e0a050", traits: { ambition: 0.07, bravery: 0.03 }, life: 0.9, tint: "#e8b878" },
  };
  const ELEMENTS = [["불", "불꽃", "#e86a3a"], ["물", "물결", "#4a90d8"], ["바람", "바람", "#a8d8c8"], ["땅", "바위", "#a08058"], ["빛", "빛", "#f0e090"], ["어둠", "그늘", "#6a5a8a"]];
  /** 마을의 땅 (지도 위치로 정한다) */
  function envOf(t) { if (!t || t.x === undefined) return null; const S = SPREAD; return t.y < 40 * S ? "frost" : t.x < 40 * S ? "wood" : t.x > 160 * S ? "shore" : t.y > 105 * S ? "sun" : null; }
  const mixHex = (a, b, k = 0.5) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v * (1 - k) + y[i] * k).toString(16).padStart(2, "0")).join(""); };
  /** 두 이름 무리의 음절을 섞어 새 이름들 */
  function blendNames(w, poolA, poolB, n = 14) {
    const syl = (s) => [...s], out = new Set();
    for (let i = 0; i < 60 && out.size < n; i++) { const a = syl(w.rng.choice(poolA)), b = syl(w.rng.choice(poolB)); const nm = a.slice(0, Math.max(1, Math.ceil(a.length / 2))).join("") + b.slice(Math.floor(b.length / 2)).join(""); if (nm.length >= 2 && nm.length <= 4) out.add(nm); }
    return [...out];
  }
  /* 새 종족의 생김새: 그림 조각(귀·뿔·꼬리·무늬·눈빛)을 땅·원소에 어울리게 고르고, 가끔 뜻밖의 변이를 섞는다 */
  const LOOK_HINT = {
    frost: { tail: "fluffy", ears: "animal" }, wood: { ears: "long", marks: "spots" }, shore: { ears: "fin", marks: "scales", tail: "scale" }, sun: { marks: "stripes", ears: "small" },
    불: { horns: "curl", marks: "stripes", hornColor: "#d87a3a" }, 물: { ears: "fin", marks: "scales" }, 바람: { ears: "long", tail: "thin" }, 땅: { horns: "short", marks: "spots", hornColor: "#9a8060" },
    빛: { horns: "crown", hornColor: "#f0e090" }, 어둠: { horns: "long", hornColor: "#4a3a5a", marks: "stripes" },
  };
  const LOOK_POOL = { ears: ["long", "animal", "fin", "small"], horns: ["long", "short", "curl", "crown"], tail: ["thin", "fluffy", "scale"], marks: ["stripes", "spots", "scales"] };
  function shapeLook(w, look, hint, tint) {
    const L = { ...look };
    for (const [k, v] of Object.entries(LOOK_HINT[hint] || {})) if (w.rng.next() < 0.65) L[k] = v;
    if (w.rng.next() < 0.45) { const k = w.rng.choice(Object.keys(LOOK_POOL)); L[k] = w.rng.choice(LOOK_POOL[k]); } // 뜻밖의 변이
    if (L.horns && L.horns.startsWith && L.horns.startsWith("#")) { L.hornColor = L.hornColor || L.horns; L.horns = "long"; }
    if (L.marks && !L.markColor) L.markColor = mixHex((L.skin || ["#c8a080"])[0], tint || "#3a2a20", 0.55);
    if (tint && w.rng.next() < 0.6) L.eyes = [tint, mixHex(tint, "#000000", 0.4), mixHex(tint, "#ffffff", 0.2)]; // 눈빛
    return L;
  }
  /* 문화: 새 종족은 귀하게 여기는 것(value)과 철마다의 잔치(festival), 나라를 세울 때의 이름 꼴을 갖는다.
   * value는 그 종족 사람의 성격을 기울게 하고, 잔치는 그 종족이 셋 이상 사는 마을에서 철마다 열려 서로를 가깝게 한다 */
  const VALUES = {
    honor:   { name: "명예", trait: "bravery", feast: ["겨루기 잔치", "맹세의 날"], nation: ["기사단", "왕국"], style: "proud" },
    wealth:  { name: "재물", trait: "greed", feast: ["장터 잔치", "금화 축제"], nation: ["상회 연맹", "자유도시"], style: "plain" },
    harmony: { name: "조화", trait: "kindness", feast: ["나눔 잔치", "화해의 밤"], nation: ["연맹", "자치령"], style: "kind" },
    lore:    { name: "앎", trait: "ambition", feast: ["이야기 밤", "별 보는 날"], nation: ["학당 공국", "현자회"], style: "plain" },
    wild:    { name: "자연", trait: "kindness", feast: ["숲의 날", "첫 열매 잔치"], nation: ["부족 연합", "숲 자치령"], style: "kind" },
    craft:   { name: "솜씨", trait: "ambition", feast: ["솜씨 겨루기", "불꽃 축제"], nation: ["장인 연맹", "공국"], style: "proud" },
  };
  const VALUE_HINT = { frost: "honor", wood: "wild", shore: "wealth", sun: "craft", 불: "honor", 물: "harmony", 바람: "lore", 땅: "craft", 빛: "lore", 어둠: "wealth" };
  const SEASONS_K = ["봄", "여름", "가을", "겨울"];
  function makeCulture(w, hint, parents = []) {
    const pv = parents.map((r) => r && r.culture && r.culture.value).filter(Boolean);
    const value = VALUE_HINT[hint] && w.rng.next() < 0.7 ? VALUE_HINT[hint] : pv.length && w.rng.next() < 0.6 ? w.rng.choice(pv) : w.rng.choice(Object.keys(VALUES));
    const V = VALUES[value];
    return { value, festival: { name: w.rng.choice(V.feast), season: w.rng.choice(SEASONS_K) }, nationKind: w.rng.choice(V.nation), style: V.style };
  }
  function newRace(w, def, people, text, data) {
    w.defs.races = w.defs.races || [];
    const id = "r" + (w.defs.races.length + 1) + "_" + w.day;
    const R = { id, adultAge: 18, magic: 0.3, traitsGenetic: 0.6, ...def, born: w.day };
    if (!R.culture) R.culture = makeCulture(w, (data && (data.env || data.element)) || null, (data && data.parents ? data.parents.map((p) => RACES[p]) : [RACES[R.base]]));
    const V = VALUES[R.culture.value]; R.traits = { ...(R.traits || {}), [V.trait]: ((R.traits || {})[V.trait] || 0) + 0.12 }; // 귀하게 여기는 것이 성격을 기울인다
    // 이 종족의 말: 새 지식이 되고, 수요가 맞으면 통역하는 직업이 생긴다
    const lang = { id: "lang_" + id, name: `${R.name}의 말`, desc: `${jo(R.name, "이/가")} 쓰는 말`, domain: ["language"], noun: `${R.name}말`, lang: id, jobName: `${R.name}말 통역가`, demand: { race: id, nations: 2 }, client: "race:" + id, made: w.day };
    R.knows = [...new Set([...(R.knows || []), lang.id])];
    w.defs.races.push(R); w.defs.knowledge = w.defs.knowledge || []; w.defs.knowledge.push(lang); applyDefs(w);
    for (const n of people) { n.race = id; learn(n, lang.id, "race"); }
    seenRace(w, id); if (!w.racesSeen.includes(id)) w.racesSeen.push(id);
    w.record("race_born", fill(text, { r: R.name }), { actor: people[0] ? people[0].id : null, town: people[0] ? people[0].town : null, imp: 9, wr: 1, data: { species: id, ...data } });
    return R;
  }
  function raceLife(w) {
    w.defs = w.defs || { jobs: [], works: [] };
    // 마법 사건 (날마다 아주 드물게)
    if (w.rng.next() < 0.0006) {
      const towns = Object.values(w.towns).filter((t) => !t.fallen && w.residents(t.id, true).length >= 4);
      if (towns.length) {
        const t = w.rng.choice(towns), base = RACES[w.rng.choice(w.residents(t.id, true)).race], [el, adj, col] = w.rng.choice(ELEMENTS);
        const people = w.rng.shuffle(w.residents(t.id, true).filter((n) => n.race === base.id && n.controller !== "player")).slice(0, w.rng.randint(2, 4));
        // 이미 마력으로 생긴 종족은 다시 바뀌지 않는다 ('바위 바위 인간' 같은 이름이 생기지 않게)
        if (people.length >= 2 && !base.element && !CONTENT.races.some((r) => r.base === base.id && r.element === el)) {
          const bl = base.look || {};
          newRace(w, { name: `${adj} ${base.name}`, base: base.id, element: el, lifespan: base.lifespan.map((x) => Math.round(x * 1.2)), adultAge: base.adultAge || 16, magic: Math.min(1, (base.magic || 0.3) + 0.5),
            traits: { ...(base.traits || {}), ambition: ((base.traits || {}).ambition || 0) + 0.05 }, look: shapeLook(w, { ...bl, skin: (bl.skin || ["#e0c0a0"]).map((c) => mixHex(c, col, 0.3)), hair: [col, mixHex(col, "#ffffff", 0.3), mixHex(col, "#000000", 0.3)] }, el, col),
            names: blendNames(w, base.names, base.names), domainSubject: el },
            people, `${t.name}에 ${el}의 마력이 휘몰아쳤다. 그 빛을 맞은 사람들의 몸이 바뀌었고, 사람들은 그들을 ‘{r}’{r~이라/라} 불렀다`, { how: "magic", element: el, from: base.id });
        }
      }
    }
    if (w.day % 30 !== 17) return;
    const alive = w.alive();
    // 사는 땅도 경험이 된다 (서리·숲·물가·볕)
    for (const n of alive) { const e = envOf(w.towns[n.town]); if (e && isAdult(n) && !n.at_war) gainExp(n, w.rng.choice(["nature", "knowledge", "body"]), "env:" + e, 4); }
    // 혼혈이 굳어짐
    const base = CONTENT.races.filter((r) => !r.hidden || seenRace(w, r.id)).map((r) => r.id);
    for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) {
      const a = base[i], b = base[j];
      if (CONTENT.races.some((r) => r.mix && r.mix.includes(a) && r.mix.includes(b))) continue;
      const mixed = alive.filter((n) => (n.heritage || {})[a] >= 0.25 && (n.heritage || {})[b] >= 0.25 && n.controller !== "player");
      if (mixed.length < 4) continue;
      const A_ = RACES[a], B_ = RACES[b], la = A_.look || {}, lb = B_.look || {};
      const BAD = ["가", "귀", "민", "친", "수", "유가", "만", "부", "왕", "혈", "종", "씨", "해", "외", "동"]; // '가족·귀족·민족…'처럼 이미 뜻이 있는 낱말은 피한다
      const rname = blendNames(w, A_.names, B_.names, 8).find((x) => !BAD.includes(x) && !BAD.some((b) => x === b)) || blendNames(w, A_.names, B_.names, 1)[0];
      newRace(w, { name: rname + "족", mix: [a, b], lifespan: [0, 1].map((k) => Math.round((A_.lifespan[k] + B_.lifespan[k]) / 2)), adultAge: Math.round(((A_.adultAge || 16) + (B_.adultAge || 16)) / 2),
        magic: ((A_.magic || 0.3) + (B_.magic || 0.3)) / 2 + 0.05, traits: Object.fromEntries(["kindness", "bravery", "ambition", "greed"].map((k) => [k, (((A_.traits || {})[k] || 0) + ((B_.traits || {})[k] || 0)) / 2])),
        look: shapeLook(w, { skin: [...(la.skin || []).slice(0, 1), ...(lb.skin || []).slice(0, 1), mixHex((la.skin || ["#e0c0a0"])[0], (lb.skin || ["#e0c0a0"])[0])], hair: [...(la.hair || ["#5a3a20"]).slice(0, 2), ...(lb.hair || ["#5a3a20"]).slice(0, 2)],
          ears: w.rng.choice([la.ears, lb.ears].filter(Boolean).concat([null])), horns: la.horns || lb.horns, hornColor: la.hornColor || lb.hornColor, tail: la.tail || lb.tail, marks: la.marks || lb.marks, markColor: la.markColor || lb.markColor, beard: la.beard && lb.beard, short: la.short && lb.short, eyes: la.eyes || lb.eyes }, null, null),
        names: blendNames(w, A_.names, B_.names), knows: [...new Set([...(A_.knows || []), ...(B_.knows || [])])] },
        mixed, `${jo(A_.name, "과/와")} ${B_.name}의 피가 대를 이어 섞인 사람들이 하나의 겨레가 되었다. 사람들은 그들을 ‘{r}’{r~이라/라} 불렀다`, { how: "mix", parents: [a, b] });
    }
    // 환경 적응
    for (const t of Object.values(w.towns)) {
      const env = envOf(t); if (!env || t.fallen) continue;
      const here = alive.filter((n) => n.town === t.id && n.birthplace && n.birthplace.town === t.id && n.birthplace.day > 0 && n.controller !== "player");
      const byRace = {}; for (const n of here) (byRace[n.race] = byRace[n.race] || []).push(n);
      for (const [rid, ps] of Object.entries(byRace)) {
        const R = RACES[rid]; if (!R || ps.length < 4 || R.env === env || CONTENT.races.some((r) => r.base === rid && r.env === env)) continue;
        const E = ENVS[env], rl = R.look || {};
        newRace(w, { name: `${E.name} ${R.name}`, base: rid, env, lifespan: R.lifespan.map((x) => Math.round(x * E.life)), adultAge: R.adultAge || 16, magic: R.magic || 0.3,
          traits: Object.fromEntries(Object.keys({ ...(R.traits || {}), ...E.traits }).map((k) => [k, ((R.traits || {})[k] || 0) + (E.traits[k] || 0)])),
          look: shapeLook(w, { ...rl, skin: (rl.skin || ["#e0c0a0"]).map((c) => mixHex(c, E.tint, 0.25)), hair: (rl.hair || ["#5a3a20"]).map((c) => mixHex(c, E.tint, 0.2)) }, env, E.color), names: blendNames(w, R.names, R.names), knows: R.knows || [] },
          ps, `${t.name}에서 대를 이어 온 ${R.name}들이 ${E.land}에 맞게 달라졌다. 사람들은 그들을 ‘{r}’{r~이라/라} 불렀다`, { how: "env", env, from: rid });
      }
    }
    // 문화: 철이 바뀌는 날, 그 종족의 잔치가 열린다
    for (const R of CONTENT.races.filter((r) => r.culture && r.culture.festival && r.culture.festival.season === w.season)) {
      for (const t of Object.values(w.towns)) {
        const ms = w.residents(t.id).filter((n) => n.race === R.id);
        if (ms.length < 3) continue;
        for (const a of ms) for (const b of ms) if (a !== b) adjust(a, b.id, 3);
        for (const o of w.residents(t.id, true).filter((n) => n.race !== R.id).slice(0, 4)) adjust(o, ms[0].id, 1);
        w.record("culture_feast", `${t.name}의 ${R.name}들이 ‘${R.culture.festival.name}’${jo(R.culture.festival.name, "을/를").slice(R.culture.festival.name.length)} 열었다. ${VALUES[R.culture.value].name}${jo(VALUES[R.culture.value].name, "을/를").slice(VALUES[R.culture.value].name.length)} 귀하게 여기는 그들의 풍습이다`, { town: t.id, imp: 3, wr: 0.3, data: { species: R.id } });
      }
    }
    // 나라: 늘어난 겨레에 뜻 있는 사람이 나오면 같은 겨레를 이끌고 나라를 세운다 (문화에 맞는 이름)
    for (const R of CONTENT.races.filter((r) => r.gen && r.culture)) {
      if (Object.values(w.nations).some((x) => x.race === R.id && !x.ended)) continue;
      const ms = alive.filter((n) => n.race === R.id && isAdult(n) && !n.at_war && n.controller !== "player");
      if (ms.length < 4 || w.rng.next() > 0.25) continue;
      const lead = maxBy(ms.filter((n) => !n.title), (n) => n.traits.ambition + n.fame / 30);
      if (!lead || lead.traits.ambition < 0.4) continue;
      for (const m of ms) if (m !== lead && !m.title) m.follows = lead.id;
      const stem = R.name.replace(/족$/, "").split(" ").join("");
      const before = new Set(Object.keys(w.nations));
      foundNation(lead, w, { name: `${stem} ${R.culture.nationKind}`, style: R.culture.style });
      const nid = Object.keys(w.nations).find((k) => !before.has(k));
      if (nid) w.nations[nid].race = R.id;
    }
    // 사라짐
    w.raceGone = w.raceGone || [];
    for (const r of CONTENT.races) {
      if (!seenRace(w, r.id) || w.raceGone.includes(r.id) || alive.some((n) => n.race === r.id)) continue;
      w.raceGone.push(r.id);
      w.record("race_gone", `마지막 ${jo(r.name, "이/가")} 숨을 거두었다. 이 세계에서 ${jo(r.name, "은/는")} 이제 옛이야기 속에만 남았다`, { imp: 8, wr: 0.8, data: { species: r.id } });
    }
  }

  // ================================================================ 세계 안에서 새 직업이 생긴다 (genesis)
  /* 미리 정의된 직업이 없어도, 세계에 수요가 생기고 그 수요를 채울 지식을 아는 사람이 있으면 직업이 새로 생긴다.
   *  수요: 지식의 demand (데이터) — { race: 종족 } 그 종족이 이 세계에 있다 · { events: [종류], within: 일, n } 최근 사건 · { sick: n } 아픈 사람 수 · { war: true } 전쟁 중
   *  이름·일터·업무 단계·결과는 지식의 분야(domain)로 정한다. 업무 단계는 그 분야에 어울리는 조작 부품(TOOL_DOMAINS)으로 조립한다.
   *  만든 정의는 함수가 없는 데이터라 w.defs에 저장되고, 이 세계에만 있다 (다른 세계를 불러오면 사라진다). */
  const GEN = {
    name: { language: "{noun} 통역가", care: "{noun} 치료사", magic: "{noun} 술사", knowledge: "{noun} 학자", craft: "{noun} 장인", art: "{noun} 장인", heat: "{noun} 장인", nature: "{noun} 채집꾼", social: "{noun} 중개인", body: "{noun} 꾼" },
    place: { language: "inn", care: "temple", magic: "temple", knowledge: "guild", craft: "forge", art: "market", heat: "forge", nature: "fields", social: "market", body: "guild" },
    hat: { language: "cap", care: "hood", magic: "witch", knowledge: "hood", craft: "bandana", art: "bandana", heat: "bandana", nature: "straw", social: "cap", body: "helmet" },
    color: { language: "#7a9ad8", care: "#d8e8e0", magic: "#9a7ad8", knowledge: "#b8a878", craft: "#a8784a", art: "#d89ab8", heat: "#c8603a", nature: "#6a9a4a", social: "#d8b84a", body: "#8a6a5a" },
    work: { language: "{noun} 통역하기", care: "{noun}로 돌보기", magic: "{noun} 부리기", knowledge: "{noun} 가르치기", craft: "{noun} 일 맡기", art: "{noun} 꾸미기", heat: "{noun} 일 맡기", nature: "{noun} 거두기", social: "{noun} 거래 잇기", body: "{noun} 일 하기" },
    step: { "language:talk": "뜻 전하기", "language:match": "낱말 옮기기", "language:memory": "긴 말 외우기", "care:observe": "살피기", "care:talk": "안심시키기", "care:measure": "약 달기",
      "magic:memory": "주문 외우기", "magic:match": "문양 읽기", "knowledge:observe": "살피기", "knowledge:memory": "외우기", "knowledge:match": "풀이하기", "social:talk": "흥정하기" },
    client: { language: (K) => (K.lang ? "race:" + K.lang : "foreign"), care: () => "sick" },
    effects: {
      language: { gold: [2, 6], bond: 4, rel: 6, fame: 1, record: { kind: "interpret", text: "{me:이/가} {race}과 {town} 사람들 사이에서 말을 옮겼다. 서로의 뜻이 통하기 시작했다", imp: 4, p: 0.12 } },
      care: { heal: 4, gold: [2, 5], rel: 8, record: { kind: "cure", text: "{me:이/가} {client:을/를} 돌봐 일으켜 세웠다", imp: 3, p: 0.3 } },
      magic: { gold: [3, 7], rel: 3, fame: 2, record: { kind: "service", text: "{me:이/가} {client}에게 {work}의 힘을 빌려주었다", imp: 3, p: 0.25 } },
      _: { gold: [2, 6], rel: 4, fame: 1, record: { kind: "service", text: "{me:이/가} {work}에서 솜씨를 보였다", imp: 3, p: 0.2 } },
    },
  };
  /* 지식이 태어나는 삶 (born, 데이터). 조건을 채운 어른이 날마다 p의 확률로 깨친다. 이미 아는 사람이 있으면 훨씬 드물다.
   *  { job, lv } 그 직업으로 솜씨 lv 이상 · { flag } 겪은 일(veteran 전선, widowed…) · { life: [사건 종류], n } 내 생애 사건
   *  { fame } 이름 · { title: true } 칭호(나라를 세운 사람 등) · { mixed: n } 내 마을에 다른 종족이 n명 이상 · text: 깨친 이야기
   *  p: 세계 하나에 하루 한 번 오는 기회 (기본 0.001, 몇 년에 한 번꼴) */
  function bornOk(w, n, b) {
    if (b.job && n.job !== b.job) return false;
    if (b.lv && Math.max(0, ...((JOBS[n.job] || {}).teaches || []).map((k) => skillLv(n, k))) < b.lv) return false;
    if (b.flag && !n.flags.has(b.flag)) return false;
    if (b.life && w.lifeOf(n.id).filter((e) => b.life.includes(e.kind)).length < (b.n || 1)) return false;
    if (b.fame && n.fame < b.fame) return false;
    if (b.title && !n.title) return false;
    if (b.mixed && w.residents(n.town).filter((m) => m.race !== n.race).length < b.mixed) return false;
    return true;
  }
  function knowledgeBirth(w) {
    const people = w.alive().filter((n) => isAdult(n) && !n.at_war && n.controller !== "player");
    for (const K of CONTENT.knowledge) {
      if (!K.born) continue;
      // p는 세계 하나에 하루 한 번 오는 기회 (조건에 맞는 사람이 많아도 같다 → 어떤 세계엔 끝내 안 생긴다)
      const known = w.alive().some((n) => knows(n, K.id)), p = (K.born.p || 0.001) * (known ? 0.3 : 1);
      if (w.rng.next() > p) continue;
      const ok = people.filter((n) => !knows(n, K.id) && bornOk(w, n, K.born));
      if (!ok.length) continue;
      {
        const n = w.rng.choice(ok);
        learn(n, K.id);
        w.record("discovery", `${jo(n.name, "이/가")} ${fill(K.born.text || "오랜 경험 끝에 ‘{k}’{k:을/를} 깨쳤다", { k: K.name })}${known ? "" : ". 이 세계에서 처음 생겨난 앎이다"}`, { actor: n.id, town: n.town, imp: known ? 3 : 5, wr: 0.3, data: { skill: K.id, how: "life" } });
      }
    }
  }
  /** 수요: 적힌 조건을 모두 채워야 한다 */
  function demandMet(w, d) {
    if (!d || !Object.keys(d).length) return false;
    if (d.nations && Object.values(w.nations || {}).filter((x) => !x.ended).length < d.nations) return false;
    if (d.pop && w.alive().length < d.pop) return false;
    if (d.crime && recent(w, ["theft", "theft_unknown", "raid", "revenge", "duel"], d.within || 120) < d.crime) return false;
    if (d.race && !(seenRace(w, d.race) && w.alive().some((n) => n.race === d.race))) return false;
    if (d.events && recent(w, d.events, d.within || 120) < (d.n || 1)) return false;
    if (d.sick && w.alive().filter((n) => n.health < 6).length < d.sick) return false;
    if (d.war && !(w.war && w.war.active)) return false;
    if (d.gap && tradeGaps(w) < d.gap) return false;
    return true;
  }
  /** 저장된 세계 정의(w.defs)를 콘텐츠에 올린다. 이전 세계의 정의는 지운다 */
  function applyDefs(w) {
    for (const key of ["jobs", "works", "knowledge", "races"]) { const a = CONTENT[key]; for (let i = a.length - 1; i >= 0; i--) if (a[i].gen) a.splice(i, 1); } // 제자리에서 (다른 파일이 배열을 쥐고 있어도 맞게)
    for (const k of Object.keys(CONTENT.items)) if (CONTENT.items[k].gen) delete CONTENT.items[k];
    const d = w.defs || { jobs: [], works: [] };
    for (const j of d.jobs || []) CONTENT.jobs.push({ ...j, gen: true });
    for (const x of d.works || []) CONTENT.works.push({ ...x, gen: true });
    for (const x of d.knowledge || []) CONTENT.knowledge.push({ ...x, gen: true });
    for (const x of d.races || []) CONTENT.races.push({ ...x, gen: true });
    for (const [k, v] of Object.entries(d.items || {})) CONTENT.items[k] = { ...v, gen: true };
    reindex();
    if (root.Game && root.Game.syncGenItems) root.Game.syncGenItems(); // 화면 쪽 아이템 표에도
  }
  /** 지식 K로 새 직업 정의를 만든다 (데이터만) */
  function makeJobDef(w, K) {
    const dom = (K.domain || ["craft"])[0], noun = K.noun || K.name, id = "w_" + K.id;
    const tools = Object.keys(TOOL_AUTO).filter((t) => (TOOL_DOMAINS[t] || []).includes(dom));
    const pool = tools.length >= 2 ? tools : Object.keys(TOOL_AUTO);
    const pick = w.rng.shuffle(pool).slice(0, 3);
    const steps = pick.map((t, i) => ({ name: GEN.step[dom + ":" + t] || ["준비", "본일", "마무리"][i], tool: t, p: {}, ...(i === pick.length - 1 ? { w: 1.5 } : {}) }));
    const job = { id, name: K.jobName || fill(GEN.name[dom] || "{noun} 일꾼", { noun }), income: [2.0, 5.0], entry_cost: 20, weight: 0, shift: false, teaches: [K.id], needKnow: K.id,
      color: GEN.color[dom] || "#9a9a9a", workplace: GEN.place[dom] || "market", look: { hat: GEN.hat[dom] || "cap" }, born: w.day, from: K.id };
    const work = { id: id + "_work", job: id, name: K.workName || fill(GEN.work[dom] || "{noun} 일", { noun }), mins: 120, energy: 10, skill: K.id, steps,
      hint: `${K.name}${jo(K.name, "을/를").slice(K.name.length)} 아는 사람만 할 수 있는 일` };
    if (K.haul) Object.assign(job, { haul: K.haul, workplace: "inn", income: K.haul === "people" ? [2.0, 4.0] : [1.0, 2.5], look: { hat: K.haul === "people" ? "hat" : "cap" } }); // 길 위의 일 (haulHour)
    if (K.makes) Object.assign(work, { needs: { ...K.makes.needs }, gives: { ...K.makes.gives } }); // 물건을 만드는 지식
    else Object.assign(work, { client: K.client || (GEN.client[dom] ? GEN.client[dom](K) : "any"), effects: K.effects || GEN.effects[dom] || GEN.effects._ });
    if (K.client === null) delete work.client;
    return { job, work };
  }
  function genesis(w, force = false) {
    if (w.day % 5 !== 2 && !force) return;
    w.defs = w.defs || { jobs: [], works: [] };
    // 세계가 만든 직업은 사람 수에 맞게 (8명에 하나꼴까지), 새로 생기는 것도 한 달에 하나까지
    const live = CONTENT.jobs.filter((j) => j.gen && !j.spec && !j.ended).length;
    if (!force && (live >= Math.floor(w.alive().length / 8) || w.day - (w.lastGenesis ?? -999) < 30)) return;
    for (const K of CONTENT.knowledge) {
      if (!K.demand || CONTENT.jobs.some((j) => (j.teaches || []).includes(K.id)) || !demandMet(w, K.demand)) continue;
      const who = w.alive().filter((n) => isAdult(n) && knows(n, K.id) && n.controller !== "player" && !n.at_war && n.jail === 0 && !n.role
        && (!JOBS[n.job].food || (w.foodPrice(w.towns[n.town]) === 1 && !w.towns[n.town].worry))); // 먹을 것을 만드는 사람은 곳간이 넉넉할 때만
      if (!who.length) continue;
      const n = maxBy(who, (x) => x.traits.ambition + x.traits.kindness * 0.5 + w.rng.next() * 0.3);
      const { job, work } = makeJobDef(w, K);
      w.defs.jobs.push(job); w.defs.works.push(work); applyDefs(w); w.lastGenesis = w.day;
      const old = JOBS[n.job] ? JOBS[n.job].name : "", from = n.job;
      setJob(n, job.id); n.job_cooldown = 200; n.fame += 4; n.pioneer = job.id;
      w.record("job_born", `${K.name}${jo(K.name, "을/를").slice(K.name.length)} 아는 ${jo(n.name, "이/가")} ${old ? old + " 일을 그만두고 " : ""}이 세계 최초의 ‘${job.name}’${jo(job.name, "이/가").slice(job.name.length)} 되었다. 아무도 하지 않던 일이 생겨났다`, { actor: n.id, town: n.town, imp: 7, wr: 0.8, data: { job: job.id, from, skill: K.id, gen: true } });
      return; // 한 번에 하나
    }
  }

  // ================================================================ 직업의 생애: 전문화와 소멸
  /* 한 달에 한 번 본다.
   *  전문화: 업무가 둘 이상인 직업에 솜씨가 '숙련' 이상인 사람이 셋 이상이면, 그중 한 사람이 한 가지 업무만 파고드는 전문 직업을 연다.
   *          전문 직업은 그 업무 하나만 하고, 단계가 조금 수월하다(더 잘한다). 이름은 업무의 specName (없으면 "업무 이름 + 전문가").
   *  소멸: 세계에서 생긴 직업·드러난 직업에 1년(120일 × 2) 넘게 아무도 없고 수요도 없으면 사라진다. 수요가 다시 생기면 되살아난다. */
  function jobLife(w) {
    if (w.day % 30 !== 7) return;
    w.jobSeen = w.jobSeen || {}; w.defs = w.defs || { jobs: [], works: [] };
    const holders = {};
    for (const n of w.alive()) if (isAdult(n)) (holders[n.job] = holders[n.job] || []).push(n);
    for (const j of CONTENT.jobs) if (holders[j.id]) w.jobSeen[j.id] = w.day;
    // 전문화
    for (const j of CONTENT.jobs.filter((x) => w.jobOpen(x.id) && !x.spec)) {
      const crafts = worksOf(j.id).filter((x) => x.steps);
      if (crafts.length < 2) continue;
      const main = (j.teaches || [])[0], skilled = (holders[j.id] || []).filter((n) => n.controller !== "player" && main && skillLv(n, main) >= 3);
      if (skilled.length < 4 || w.rng.next() > 0.12) continue;
      const wk = crafts.find((x) => !JOBS["s_" + x.id]);
      if (!wk) continue;
      const id = "s_" + wk.id, name = wk.specName || `${wk.name} 전문가`;
      const job = { ...j, id, name, spec: j.id, weight: 0, shift: false, emerge: undefined, born: w.day, look: { ...(j.look || {}) }, gen: undefined };
      delete job.emerge; delete job.gen; delete job.skill;
      const work = { ...wk, id: id + "_work", job: id, sim: undefined, steps: wk.steps.map((s) => ({ ...s, p: { ...(s.p || {}), hard: -0.06 } })) };
      delete work.sim; delete work.gen;
      w.defs.jobs.push(job); w.defs.works.push(work); applyDefs(w);
      const n = maxBy(skilled, (x) => skillLv(x, main) + x.traits.ambition);
      n.side = j.id; setJob(n, id); n.pioneer = id; n.fame += 3;
      w.record("job_born", `${JOBS[j.id].name} 중에서도 ‘${wk.name}’만 파고든 ${jo(n.name, "이/가")} 이 세계 최초의 ‘${name}’${jo(name, "이/가").slice(name.length)} 되었다. 한 가지 일을 깊이 하는 사람이 나타났다`, { actor: n.id, town: n.town, imp: 5, wr: 0.5, data: { job: id, from: j.id, spec: true } });
    }
    // 소멸과 부활
    for (const j of CONTENT.jobs) {
      if (!j.gen && !j.emerge) continue;
      const K = j.from ? KNOW(j.from) : null;
      let need = K && K.demand ? demandMet(w, K.demand) : null;
      if (j.emerge) { try { need = j.emerge.demand(w) >= 1; } catch (e) { need = null; } }
      // 미리 정의된 직업(emerge)은 모든 세계가 함께 쓰는 정의라, 이 세계의 열린 목록에서만 뺀다 (다시 수요가 생기면 emergeJobs가 연다)
      const open = j.emerge ? (w.jobsOpen || []).includes(j.id) : !j.ended;
      if (open && !holders[j.id] && w.day - (w.jobSeen[j.id] ?? j.born ?? 0) > DPY * 2 && need !== true) {
        if (j.emerge) w.jobsOpen = w.jobsOpen.filter((x) => x !== j.id);
        else { j.ended = w.day; const d = (w.defs.jobs || []).find((x) => x.id === j.id); if (d) d.ended = w.day; }
        w.record("job_gone", `이 세계에 ‘${j.name}’ 일을 하는 사람이 더는 남지 않았다. 사람들은 그 일을 옛이야기로 기억한다`, { imp: 4, wr: 0.3, data: { job: j.id } });
      } else if (j.gen && j.ended && need === true && w.alive().some((n) => isAdult(n) && knows(n, j.from))) {
        j.ended = null; const d = (w.defs.jobs || []).find((x) => x.id === j.id); if (d) d.ended = null; w.jobSeen[j.id] = w.day;
        w.record("job_revived", `잊혔던 ‘${j.name}’ 일이 다시 필요해졌다. ${K.name}${jo(K.name, "을/를").slice(K.name.length)} 아는 사람이 그 일을 되살릴 것이다`, { imp: 4, wr: 0.3, data: { job: j.id } });
      }
    }
  }

  function emergeJobs(w) {
    w.jobsOpen = w.jobsOpen || [];
    for (const j of CONTENT.jobs) {
      if (!j.emerge || w.jobsOpen.includes(j.id)) continue;
      let need = 0;
      try { need = j.emerge.demand(w); } catch (e) { need = 0; }
      if (need < 1 || w.rng.next() > 0.025) continue;
      // 지식이 필요한 직업은 그 지식을 아는 사람만 시작할 수 있다
      const cands = w.alive().filter((n) => isAdult(n) && n.controller !== "player" && !n.at_war && n.jail === 0 && !n.role && !n.title && !n.pioneer && (!j.emerge.fit || j.emerge.fit(n, w)) && (!j.emerge.know || knows(n, j.emerge.know)));
      const n = maxBy(cands, (x) => x.traits.ambition + w.rng.next() * 0.5);
      if (!n) continue;
      const old = JOBS[n.job].name, from = n.job;
      setJob(n, j.id); n.job_cooldown = 200; n.fame += 3; n.pioneer = j.id;
      w.jobsOpen.push(j.id);
      w.record("job_born", j.emerge.text(n, w, old), { actor: n.id, town: n.town, imp: 7, wr: 0.8, data: { job: j.id, from } });
    }
  }
  /** 이 세계에 나타난 종족들 (숨은 종족·혼혈 종족은 처음 나타나야 목록에 든다) */
  function seenRace(w, id) {
    if (!w.racesSeen) w.racesSeen = [...new Set(w.npcs.map((n) => n.race))];
    return w.racesSeen.includes(id);
  }
  function racesInWorld(w) { seenRace(w, "_"); for (const n of w.npcs) if (!w.racesSeen.includes(n.race)) w.racesSeen.push(n.race); return CONTENT.races.filter((r) => w.racesSeen.includes(r.id)); }
  const recent = (w, kinds, days) => w.events.filter((e) => e && kinds.includes(e.kind) && w.day - e.day <= days).length;

  // ================================================================ 꿈 (NPC 스스로 정하는 삶의 방향)
  /* n.dream = { id, since, job?, ... }. 꿈의 정의(content.js)는
   *   weight(n,w): 이 사람이 이 꿈을 품을 만한 정도   init(n,w): 꿈에 딸린 값(예: 목표 직업)
   *   progress(n,w): 0~1   bias: {행동id: 배수}   name, text(n,w,d): 설명   done(n,w,d): 이룬 뒤 남길 문장 */
  function pickDream(n, w, silent = false) {
    const opts = CONTENT.dreams.filter((d) => !n.dream || d.id !== n.dream.id).map((d) => [d, Math.max(0, d.weight(n, w))]).filter(([, x]) => x > 0);
    if (!opts.length) { n.dream = null; return null; }
    const d = w.rng.choices(opts.map((o) => o[0]), opts.map((o) => o[1]));
    n.dream = { id: d.id, since: w.day, best: 0, ...(d.init ? d.init(n, w) : {}) };
    if (!silent) w.record("dream_start", d.startText ? d.startText(n, w) : `${jo(n.name, "이/가")} ‘${dreamName(n)}’라는 꿈을 품었다`, { actor: n.id, town: n.town, imp: d.startImp || 2, wr: d.startImp ? 0.6 : 0.15 });
    return n.dream;
  }
  const dreamName = (n) => { const d = n.dream && DREAMS[n.dream.id]; return d ? (typeof d.name === "function" ? d.name(n, n.dream) : d.name) : ""; };
  function dreamProgress(n, w) { const d = n.dream && DREAMS[n.dream.id]; return d ? clamp(d.progress(n, w, n.dream), 0, 1) : 0; }
  function dreamDay(n, w) {
    if (!isAdult(n) || n.controller === "player" || n.at_war) return;
    if (!n.dream || !DREAMS[n.dream.id]) { if (w.rng.next() < 0.04) pickDream(n, w); return; }
    const d = DREAMS[n.dream.id];
    if (d.daily) d.daily(n, w, n.dream);
    if (!n.dream) return;
    const pr = dreamProgress(n, w);
    if (pr > n.dream.best + 0.05) { n.dream.best = pr; n.dream.moved = w.day; }
    if (pr >= 1) {
      const name = dreamName(n);
      n.fame += 1; n.traits.ambition = clamp(n.traits.ambition - 0.05, 0, 1);
      if (d.complete) { const dream = n.dream; n.dream = null; d.complete(n, w, dream); return; }
      w.record("dream_done", d.done ? d.done(n, w, n.dream) : `${jo(n.name, "이/가")} 오랜 꿈이었던 ‘${name}’을 이뤘다`, { actor: n.id, town: n.town, imp: 5, sent: 2, wr: 0.5 });
      n.dream = null;
      return;
    }
    // 2년 동안 한 걸음도 못 나아가면 꿈을 접는다
    if (w.day - (n.dream.moved ?? n.dream.since) > 2 * DPY && w.rng.next() < 0.02) {
      w.record("dream_lost", `${jo(n.name, "은/는")} 끝내 ‘${dreamName(n)}’의 꿈을 접었다`, { actor: n.id, town: n.town, imp: 3, wr: 0.2 });
      n.dream = null;
    }
  }

  // ================================================================ 세계의 사건 (플레이어와 무관하게 흘러간다)
  /* CONTENT.worldEvents의 각 항목: { id, when(w): 오늘 일어나는가, run(w, ctx) }. 새 사건은 content.js에 데이터로 더한다. */
  function worldEvents(w) {
    w.worldLog = w.worldLog || {};
    const ctx = { rng: w.rng, jo, power, adjust, clamp, maxBy, isAdult, JOBS, RACES, openTowns: () => Object.values(w.towns).filter((t) => !t.fallen),
      last: (id) => w.worldLog[id] ?? -1e9 };
    for (const ev of CONTENT.worldEvents) {
      try { if (ev.when(w, ctx)) { w.worldLog[ev.id] = w.day; ev.run(w, ctx); } } catch (e) { if (typeof console !== "undefined") console.warn("world event", ev.id, e); }
    }
  }

  // ================================================================ 용사와 마왕
  const borderTown = (w) => Object.values(w.towns).find((t) => t.border);
  const lordName = (w) => CONTENT.demonLords[w.war.lord_index % CONTENT.demonLords.length];

  function initWar(w) {
    w.war = { active: true, front: 50, lord_index: 0, hero: null, hero_wait: 5, peace_until: null, refused: new Set(), offer: null };
    w.record("war_start", `${jo(lordName(w), "이/가")} 북쪽 황무지에서 군세를 일으켰다. 회색탑이 최전선이 되었다`, { imp: 9 });
  }

  function enlist(n, w, days = null) {
    n.at_war = true;
    n.service_left = days || w.rng.randint(60, 150);
    n.home = n.town;
    n.town = borderTown(w).id;
    w.record("enlist", `${jo(n.name, "이/가")} ${lordName(w)}의 군대와 싸우기 위해 전선으로 떠났다`, { actor: n.id, town: n.home, imp: n.controller === "player" ? 5 : 4, wr: 0.4 });
  }

  function returnHome(n, w, text = null, imp = 4) {
    n.flags.add("veteran"); // 전선을 겪고 돌아온 사람
    n.at_war = false;
    if (n.role === "hero") n.role = null;
    let home = w.towns[n.home];
    if (home.fallen) home = w.rng.choice(Object.values(w.towns).filter((t) => !t.fallen));
    n.town = home.id;
    if (n.controller !== "player" && (!n.house || w.assets[n.house].town !== home.id)) settleIn(w, n, pickHouse(w, home.id));
    n.fame += 2;
    n.gold += w.rng.randint(20, 50);
    w.record("return", text || `${jo(n.name, "이/가")} 참전 용사가 되어 ${jo(home.name, "으로/로")} 돌아왔다`, { actor: n.id, town: home.id, imp, wr: 0.4 });
  }

  function soldierDay(n, w) {
    const hero = n.role === "hero";
    gainExp(n, "body", "battle");
    n.gold += 1;
    const deathP = hero ? 0.0008 : 0.003 + (w.war.front < 30 ? 0.004 : 0);
    if (w.rng.next() < deathP) {
      if (hero) { w.war.hero = null; w.war.hero_wait = 30; w.die(n, `용사로서 ${lordName(w)}의 군대와 싸우다`, { imp: 9, kind: "fallen", demon: true }); }
      else w.die(n, `${lordName(w)}의 군대와 싸우다 전장에서`, { imp: n.controller === "player" ? 7 : 5, kind: "fallen", demon: true });
      return;
    }
    if (w.rng.next() < (hero ? 0.03 : 0.008)) {
      n.fame += hero ? 3 : 1;
      const what = w.rng.choice(["마왕군의 장수를 베었다", "포위된 동료들을 구해냈다", "적의 보급로를 끊었다", "괴물 무리를 막아냈다"]);
      w.record("deed", `${jo(n.name, "이/가")} 전장에서 ${what}`, { actor: n.id, imp: hero ? 6 : 4, wr: 0 });
    }
    if (!hero) { n.service_left -= 1; if (n.service_left <= 0) returnHome(n, w); }
  }

  function makeHero(n, w) {
    n.role = "hero"; n.flags.add("former_hero"); n.fame += 5;
    if (n.at_war) n.town = borderTown(w).id; else enlist(n, w, 1e6);
    w.war.hero = n.id;
    w.record("hero", `${jo(n.name, "이/가")} 용사의 검을 들고 ${lordName(w)} 토벌에 나섰다`, { actor: n.id, imp: 9, wr: 0 });
  }
  function refuseHero(n, w) {
    w.war.refused.add(n.id);
    w.record("refuse", `${jo(n.name, "은/는")} 용사의 운명을 거부하고 평범한 삶을 택했다`, { actor: n.id, town: n.town, imp: 7, wr: 0.6 });
    w.war.hero_wait = 10;
  }
  /** 플레이어가 신탁에 답한다 */
  function answerOracle(w, accept) {
    const n = w.war.offer === null ? null : w.npcs[w.war.offer];
    w.war.offer = null;
    if (!n || !n.alive) return;
    if (accept) makeHero(n, w); else refuseHero(n, w);
  }

  function chooseHero(w) {
    const cands = w.alive().filter((n) => isAdult(n) && age(n) < 40 && n.jail === 0 && n.role === null
      && !w.war.refused.has(n.id) && !n.flags.has("former_hero"));
    if (!cands.length) return;
    const n = maxBy(cands, (c) => c.traits.bravery * 2 + c.fame * 0.1 + (c.flags.has("demon_grudge") ? 0.5 : 0)
      + w.rng.next() * 0.6 + (c.controller === "player" ? 0.15 : 0));
    w.record("oracle", `여신의 신탁이 내려왔다. ${w.towns[n.town].name}의 ${RACES[n.race].name} ${w.jobName(n)} ${jo(n.name, "이/가")} 다음 용사로 지목되었다`, { actor: n.id, town: n.town, imp: 8, wr: 0.8 });
    if (n.controller === "player") { w.war.offer = n.id; return; }
    if (n.traits.bravery >= 0.45 || w.rng.next() < 0.4) makeHero(n, w); else refuseHero(n, w);
  }

  function warDay(w) {
    const war = w.war;
    if (!war.active) {
      if (w.day >= war.peace_until) {
        war.lord_index += 1; war.active = true; war.front = 50; war.refused = new Set(); war.hero_wait = 20;
        w.record("war_start", `평화는 오래가지 않았다. ${jo(lordName(w), "이/가")} 새로 일어나 다시 전쟁이 시작되었다`, { imp: 9 });
      }
      return;
    }
    let hero = war.hero !== null ? w.npcs[war.hero] : null;
    if ((!hero || !hero.alive) && war.offer === null) {
      war.hero_wait -= 1;
      if (war.hero_wait <= 0) { chooseHero(w); hero = war.hero !== null ? w.npcs[war.hero] : null; }
    }
    const soldiers = w.alive().filter((n) => n.at_war).length;
    war.front = clamp(war.front + w.rng.gauss(-0.35, 1.3) + 0.05 * soldiers + (hero && hero.alive ? 0.3 : 0), 0, 100);
    const bt = borderTown(w);
    if (!bt.fallen && war.front < 35 && w.rng.next() < 0.04) raid(w, bt);
    if (!bt.fallen && war.front <= 3) fall(w, bt);
    if (bt.fallen && war.front >= 60) {
      bt.fallen = false; bt.food = 60;
      w.record("liberation", `탄드렐 연합군이 ${jo(bt.name, "을/를")} 되찾았다`, { town: bt.id, imp: 8 });
    }
    if (war.front >= 100) { if (hero && hero.alive) finalBattle(w, hero); else war.front = 95; }
  }

  function raid(w, t) {
    t.food *= 0.6;
    w.record("raid", `${lordName(w)}의 군대가 ${jo(t.name, "을/를")} 습격해 곡식 창고를 불태웠다`, { town: t.id, imp: 6, wr: 0 });
    for (const n of w.residents(t.id)) {
      const r = w.rng.next();
      if (r < 0.05) w.die(n, `${t.name} 습격 때`, { imp: 5, demon: true });
      else if (r < 0.2) { n.health -= 4; n.flags.add("demon_grudge"); }
    }
  }

  function fall(w, t) {
    t.fallen = true;
    w.record("fall", `${jo(t.name, "이/가")} 마왕군에게 함락되었다. 살아남은 사람들은 피난길에 올랐다`, { town: t.id, imp: 10, wr: 0 });
    const others = Object.values(w.towns).filter((x) => !x.fallen);
    for (const n of w.residents(t.id)) { n.flags.add("demon_grudge"); n.town = w.rng.choice(others).id; }
    w.war.front = 25;
  }

  function finalBattle(w, hero) {
    const lord = lordName(w);
    const chance = Math.min(0.85, 0.45 + hero.fame * 0.01 + hero.traits.bravery * 0.2);
    if (w.rng.next() < chance) {
      hero.fame += 20;
      w.record("victory", `용사 ${jo(hero.name, "이/가")} 마왕성에서 ${jo(lord, "을/를")} 쓰러뜨렸다. 세계에 평화가 찾아왔다`, { actor: hero.id, imp: 10, wr: 0 });
      w.war.active = false; w.war.hero = null;
      w.war.peace_until = w.day + w.rng.randint(2, 5) * DPY;
      for (const n of w.alive().filter((x) => x.at_war)) {
        if (n === hero) returnHome(n, w, `용사 ${jo(n.name, "이/가")} 영웅이 되어 고향 ${jo(w.towns[n.home].name, "으로/로")} 돌아왔다`, 8);
        else returnHome(n, w);
      }
    } else {
      w.war.hero = null; w.war.hero_wait = 40; w.war.front = 45;
      w.die(hero, `마왕성에서 ${lord}에게 패하여`, { imp: 10, kind: "fallen", demon: true });
    }
  }

  // ================================================================ 이야기 읽기
  function chain(w, ev) {
    const out = [], seen = new Set();
    let cur = ev;
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.push(cur); cur = w.ev(cur.cause); }
    return out.reverse();
  }
  function feuds(w, top = 6) {
    const chains = [];
    for (const e of w.events) {
      if (e && ["revenge", "counter", "murder", "forgive", "adulthood", "enemy_dead", "exile", "give_up"].includes(e.kind) && e.cause !== null) {
        const ch = chain(w, e);
        if (ch.filter((x) => x.kind !== "vow").length >= 3) chains.push(ch);
      }
    }
    chains.sort((a, b) => b.length - a.length || b[b.length - 1].day - a[a.length - 1].day);
    const picked = [], used = new Set();
    for (const ch of chains) {
      const ids = ch.map((e) => e.id);
      if (ids.filter((i) => used.has(i)).length > ids.length / 2) continue;
      picked.push(ch); ids.forEach((i) => used.add(i));
      if (picked.length >= top) break;
    }
    return picked;
  }
  function storyScore(w) {
    const s = new Map();
    for (const e of w.events) {
      if (!e) continue;
      for (const id of new Set([e.actor, e.target])) if (id !== null) s.set(id, (s.get(id) || 0) + e.imp * e.imp);
    }
    return s;
  }

  function newWorld(seed, name) {
    const w = new World(seed);
    w.worldId = newWorldId(seed);
    if (name) w.name = name;
    w.populate();
    initWar(w);
    return w;
  }
  /** 새 세계: 만든 뒤 한 해를 미리 흘려, 플레이어가 올 때 이미 사람들이 저마다의 삶을 살고 있게 한다 */
  function freshWorld(seed, name, days = DPY) { const w = newWorld(seed, name); for (let i = 0; i < days; i++) step(w); return w; }

  /** 플레이어 캐릭터를 세계에 태어나게 한다 (어른으로) */
  function addPlayer(w, { name, race, job, town }) {
    if (w.usedNames.has(name)) name = name + "²";
    const n = w.spawn(town, { race, job, ageYears: 20, name });
    w.usedNames.add(name);
    n.controller = "player";
    leaveHouse(w, n); n.house = null; // 플레이어는 여관 방(내 집)에 산다
    n.gold = 8; // 빈손으로 시작한다
    w.playerId = n.id;
    w.record("arrival", `${RACES[race].name} ${JOBS[job].name} ${jo(name, "이/가")} ${w.towns[town].name}에서 새 삶을 시작했다`, { actor: n.id, town, imp: 5, wr: 0.5 });
    return n;
  }

  const _ = { RNG, maxBy, clamp, adjust, power, related, rWork, rJob, betterJob, granaries, settleWork, shortDay, haulHour, rTravel, startTrip, visitDay, depart, land, rHeal, rForage, enlist, returnHome, borderTown, DPS, lifeCourse, supportFor, estate, mourn, helpParent };
  root.Asteria = { SAVE_VERSION, SPREAD, ILLS, illOf, lifeFrac, isElder, healthCap, fallIll, treat, locOf, journeyText, arriveDue, startTrip, routeOf, tripPoint, tradeGaps, ROAD_SPEED, cargoText, stockPrice, stockSellPrice, stockAdd, stockTake, shopFor, wantList, useOwn, makeAppt, apptWhen, apptText, APPT_KIND, LIFE_LABEL, LIFE_LABEL_FEAST, holidayOf, calendarDay, liveHour, lifeUntil, planHour, newWeather, weatherWork, dayOf, agriLife, farmMult, experienceBirth, raceLife, makeKnowledge, gainExp, envOf, ENVS, jobLife, genesis, knowledgeBirth, bornOk, applyDefs, makeJobDef, demandMet, worksOf, registerTool, TOOL_AUTO, TOOL_DOMAINS, workClient, clientOk, applyEffects, fill, GRADES, gradeOf, workLv, workQuality, autoScores, workAutoReady, toolsOf, setJob, addXp, skillLv, skillOf, knownSkills, mastery, SKILL_LV, SKILL_LV_NAME, migrate, extStore, adultAge, heritageOf, blendHeritage, makeLook, inheritLook, nationName: nameOfNation, houseId, pickHouse, settleIn, freshWorld, jobDemand, _, CONTENT, RACES, JOBS, DREAMS, extend, syncContent, foundNation, allTownDefs, recent, knows, learn, KNOW, seenRace, racesInWorld, pickDream, dreamName, dreamProgress, DPY, DPS, SEASONS, World, ACTIONS, ACT, available, choose, step, advance, beginDay, finishDay, newWorld, addPlayer,
    answerOracle, playerNeedsChoice, feuds, chain, storyScore, age, isAdult, opinion, family, jo, lordName };
})(typeof window !== "undefined" ? window : globalThis);
