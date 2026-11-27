/* 아스테리아 세계 시뮬레이션 엔진 (Python 프로토타입의 JavaScript 이식판)
 * - 모든 일은 Event로 기록되고 cause로 이어진다 (이야기의 축적)
 * - 플레이어도 controller === "player"인 NPC 하나다 (플레이어의 자유)
 * - 세계 상태 전체를 JSON으로 저장/불러오기 할 수 있다
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------ 콘텐츠 (데이터로 확장)
  const CONTENT = {
    races: [
      { id: "human", name: "인간", lifespan: [60, 80], traits: { ambition: 0.1 }, look: { skin: ["#f6d3b3", "#eec09a", "#d9a47c", "#b97f57"] },
        names: ["아론","베아","카일","델리아","에반","그레타","한스","이리스","요한","카린","레오","마리","노엘","오스카","피아","루카스","세라","토마","유나","벤","클라라","다니엘","엠마","펠릭스","한나","올가","리나","마틴","소피","빌헬름"] },
      { id: "elf", name: "엘프", lifespan: [250, 350], traits: { kindness: 0.1, bravery: -0.05, ambition: -0.1 }, look: { skin: ["#f8e2cf", "#f1d6c0"], ears: "long", hair: ["#f0e2a8", "#e8e8e0", "#c9b27a", "#9fc7a8", "#d7b9e8"] },
        names: ["엘라린","실바","테리안","아엘","리아나","파엘","나엘","이실","로웬","셀린","엘로스","미리엘","타랄","니무엘","시안","아르웬디"] },
      { id: "dwarf", name: "드워프", lifespan: [130, 170], traits: { bravery: 0.15, greed: 0.1 }, look: { skin: ["#e8b48e", "#d99f7a"], beard: true, short: true, hair: ["#a8452c", "#6b3a20", "#3a2a20", "#c9c3b8", "#d99a3a"] },
        names: ["브롬","돌가","투린","하르가","김리크","보라","둔","케일다","모르겐","그렘","발린","도르","헬가","트로그","부르딘","아스크"] },
      { id: "beastkin", name: "수인", lifespan: [50, 70], traits: { bravery: 0.2, kindness: -0.05 }, look: { skin: ["#e9c49a", "#d8ab80"], ears: "animal", tail: true, hair: ["#c8823a", "#6b4a32", "#e8e0d0", "#3a3a3a", "#a86a3a"] },
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
    nations: { asteria: "아스테리아 왕국", ironhold: "철산 연맹", silvaren: "실바렌 숲의 나라" },
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
    for (const key of ["races", "jobs", "dreams", "worldEvents", "towns", "recipes", "npcs", "knowledge", "loot", "renovations"]) {
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
  const isAdult = (n) => age(n) >= ADULT;
  function family(n) {
    const f = new Set([...n.parents, ...n.children]);
    if (n.spouse !== null) f.add(n.spouse);
    return f;
  }
  const opinion = (n, id) => n.rel[id] || 0;
  /** 이 사람이 아는가: 직업이 가르쳐 주는 지식이거나, 따로 배운 지식 */
  function knows(n, k) { const j = JOBS[n.job]; return !!((j && j.teaches && j.teaches.includes(k)) || (n.know && n.know.includes(k))); }
  function learn(n, k) { if (knows(n, k)) return false; (n.know = n.know || []).push(k); return true; }
  const A_adjust = (n, id, d) => adjust(n, id, d);
  const KNOW = (id) => CONTENT.knowledge.find((k) => k.id === id) || { id, name: id };
  function adjust(n, id, d) { if (id === n.id) return; n.rel[id] = clamp(opinion(n, id) + d, -100, 100); }

  // ================================================================ World
  class World {
    constructor(seed) {
      this.seed = seed;
      this.rng = new RNG(seed);
      this.name = "아스테리아";
      this.day = 0;
      this.towns = {};
      for (const t of CONTENT.towns) {
        this.towns[t.id] = { id: t.id, name: t.name, nation: CONTENT.nations[t.nation], border: !!t.border,
          races: t.races, job_bias: t.job_bias || {}, start_pop: t.population, food: t.population * 15, fallen: false, seeded: false, x: t.pos[0], y: t.pos[1] };
      }
      this.npcs = [];
      this.events = [];
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
      return this.npcs.filter((n) => n.alive && n.town === tid && !n.at_war && !n.outside && (!adultsOnly || isAdult(n)));
    }
    foodPrice(t) {
      const r = t.food / Math.max(1, this.residents(t.id).length);
      return r > 8 ? 1 : r > 3 ? 2 : 4;
    }
    jobName(n) { if (n.role === "hero") return "용사"; if (!isAdult(n)) return "아이"; return JOBS[n.job].name; }
    label(n) { return `${n.name}(${RACES[n.race].name} ${this.jobName(n)})`; }
    ev(id) { return id === null || id === undefined ? null : this.events[id] || null; }
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
    jobOpen(id) { const j = JOBS[id]; return !!j && (!j.emerge || (this.jobsOpen || []).includes(id)); }
    openJobs() { return CONTENT.jobs.filter((j) => this.jobOpen(j.id)); }
    pickJob(town) {
      const ids = Object.keys(JOBS).filter((id) => this.jobOpen(id));
      return this.rng.choices(ids, ids.map((j) => JOBS[j].weight * (town.job_bias[j] || 1)));
    }
    spawn(tid, { race = null, job = null, ageYears = null, name = null } = {}) {
      const town = this.towns[tid];
      race = race || this.rng.choices(Object.keys(town.races), Object.values(town.races));
      const r = RACES[race];
      if (ageYears === null) ageYears = this.rng.randint(ADULT, Math.floor(r.lifespan[0] * 0.7));
      const n = {
        id: this.npcs.length, name: name || this.newName(race), race, job: job || this.pickJob(town),
        town: tid, home: tid, traits: this.randomTraits(race),
        age_days: ageYears * DPY + this.rng.randint(0, DPY - 1), lifespan: this.rng.randint(r.lifespan[0], r.lifespan[1]),
        gold: this.rng.uniform(5, 40), hunger: 0, health: 10, alive: true, death_day: null, death_cause: null,
        rel: {}, mem: [], known: new Set(), spouse: null, parents: [], children: [], goal: null, fame: 0,
        at_war: false, service_left: 0, role: null, jail: 0, job_cooldown: 0, flags: new Set(),
        controller: "ai", vowed: {}, lover: null, outside: false,
        dream: null, stat: { help: 0, towns: [tid] },
      };
      this.npcs.push(n);
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
          if (this.rng.next() < 0.3) { a.spouse = b.id; b.spouse = a.id; a.rel[b.id] = 70; b.rel[a.id] = 70; }
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
      const { actor = null, target = null, town = null, imp = 1, sent = 0, cause = null, wr = 0.25, notify = [], secret = null } = o;
      const ev = { id: this.events.length, day: this.day, kind, text, actor, target, town, imp, sent, cause, secret };
      this.events.push(ev);
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
      if (n.spouse !== null && this.npcs[n.spouse].alive) { const s = this.npcs[n.spouse]; s.spouse = null; s.flags.add("widowed"); }
      if (n.fame >= 10) imp = Math.max(imp, 7);
      const ev = this.record(kind, `${jo(n.name, "이/가")} ${how} 세상을 떠났다`,
        { actor: killer, target: n.id, town: n.town, imp, sent: killer !== null ? -20 : 0, cause, wr: 0.5, notify: mourners });
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
      const old = n.town;
      n.town = tid;
      if (withFamily) for (const fid of family(n)) {
        const f = this.npcs[fid];
        if (f.alive && f.town === old && !f.at_war && f.controller !== "player" && (fid === n.spouse || !isAdult(f))) f.town = tid;
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
        ? [e.day, e.kind, e.text, e.actor, e.target, e.town, e.imp, e.sent, e.cause, e.secret ?? null] : 0));
      const memIds = new Set();
      for (const n of this.npcs) for (const m of n.mem) memIds.add(m.e);
      // 숫자는 반올림하지 않는다: 불러온 세계가 저장하지 않은 세계와 똑같이 이어지도록
      const npcs = this.npcs.map((n) => ({ ...n,
        mem: n.mem.map((m) => [m.e, m.s, m.f ? 1 : 0, m.v]),
        known: [...n.known].filter((id) => memIds.has(id)), flags: [...n.flags] }));
      const towns = Object.fromEntries(Object.entries(this.towns).map(([k, t]) => [k, { food: t.food, fallen: t.fallen, seeded: true, nation: t.nation, indep: t.indep || null }]));
      return JSON.stringify({
        format: "asteria-world", version: 2,
        clock: this.clock, dayOpen: this.dayOpen, queue: this.queue, qi: this.qi, ppos: this.ppos, trail: this.trail, journal: this.journal, episodes: this.episodes, epSeq: this.epSeq,
        papers: this.papers, lastPaper: this.lastPaper, todayLog: this.todayLog, ext: this.ext || null, name: this.name, seed: this.seed, rng: this.rng.s, day: this.day,
        towns, npcs, events, chronicle: this.chronicle, war: { ...this.war, refused: [...(this.war.refused || [])] },
        droughtUntil: this.droughtUntil, usedNames: [...this.usedNames], initialPop: this.initialPop, worldLog: this.worldLog || {}, founded: this.founded || [], jobsOpen: this.jobsOpen || [], racesSeen: this.racesSeen || null, houseStyle: this.houseStyle || {}, innMods: this.innMods || {},
        playerId: this.playerId, autoDays: this.autoDays,
      });
    }
    static deserialize(json) {
      const d = typeof json === "string" ? JSON.parse(json) : json;
      if (d.format !== "asteria-world") throw new Error("아스테리아 세계 저장 파일이 아닙니다");
      const w = new World(d.seed);
      w.name = d.name || "아스테리아";
      for (const def of d.founded || []) addTown(w, def); // 저장된 마을 상태를 덮어쓰기 전에 세운 나라의 마을을 만든다
      w.rng.s = d.rng >>> 0;
      w.day = d.day;
      for (const [k, t] of Object.entries(d.towns)) if (w.towns[k]) Object.assign(w.towns[k], t, { seeded: true });
      w.events = d.events.map((e, id) => (e === 0 || e === null ? null : {
        id, day: e[0], kind: e[1], text: e[2], actor: e[3], target: e[4], town: e[5], imp: e[6], sent: e[7], cause: e[8], secret: e[9] ?? null }));
      w.npcs = d.npcs.map((n) => ({ lover: null, outside: false, dream: null, stat: { help: 0, towns: [n.town] }, ...n, known: new Set(n.known), flags: new Set(n.flags),
        mem: n.mem.map((m) => ({ e: m[0], s: m[1], f: !!m[2], v: m[3] })).filter((m) => w.events[m.e]) }));
      for (const n of w.npcs) if (n.goal && !w.events[n.goal.origin]) n.goal = null;
      w.chronicle = d.chronicle.filter((id) => w.events[id]);
      w.war = { ...d.war, refused: new Set(d.war.refused || []) };
      w.droughtUntil = d.droughtUntil; w.worldLog = d.worldLog || {}; w.jobsOpen = d.jobsOpen || []; w.racesSeen = d.racesSeen || null; w.houseStyle = d.houseStyle || {}; w.innMods = d.innMods || {};

      w.usedNames = new Set(d.usedNames);
      w.initialPop = d.initialPop;
      w.playerId = d.playerId ?? null;
      w.autoDays = d.autoDays || 0;
      w.clock = d.clock || 0; w.dayOpen = !!d.dayOpen; w.queue = d.queue || []; w.qi = d.qi || 0; w.ppos = d.ppos || null; w.trail = d.trail || 0;
      w.journal = (d.journal || []).filter((j) => w.events[j.e]);
      w.episodes = (d.episodes || []).filter((ep) => ep.ev === null || ep.ev === undefined || w.events[ep.ev]);
      w.epSeq = d.epSeq || 0; w.papers = (d.papers || []).map((p) => ({ ...p, items: p.items.filter((id) => w.events[id]) }));
      w.lastPaper = d.lastPaper || w.day; w.todayLog = d.todayLog || []; w.ext = d.ext || null;
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
    const want = Math.max(1, adults.length * (job.weight / total));
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
  function rWork(n, w) {
    const job = JOBS[n.job], town = w.towns[n.town];
    let earn = w.rng.uniform(job.income[0], job.income[1]) * jobDemand(w, job, n.town);
    if (job.war_bonus && w.war.active) earn *= 1 + job.war_bonus;
    if (job.food) town.food += job.food * (job.seasonal ? w.harvestMult() : 1);
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
      n.gold -= 3; h.gold += 3; n.health = Math.min(10, n.health + 4);
      adjust(n, h.id, 4); adjust(h, n.id, 2);
    } else n.health = Math.min(10, n.health + 1.5);
  }

  function rSocial(n, w) {
    const others = w.residents(n.town, true).filter((m) => m.id !== n.id);
    if (!others.length) return;
    const m = w.rng.next() < 0.6 ? w.rng.choices(others, others.map((o) => Math.max(1, opinion(n, o.id) + 30))) : w.rng.choice(others);
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
    if (n.know && n.know.length && opinion(n, m.id) >= 30 && w.rng.next() < 0.04) {
      const k = w.rng.choice(n.know);
      if (learn(m, k)) w.record("learn", `${jo(n.name, "이/가")} ${m.name}에게 ‘${KNOW(k).name}’${jo(KNOW(k).name, "을/를").slice((KNOW(k).name).length)} 가르쳐 주었다`, { actor: n.id, target: m.id, town: n.town, imp: KNOW(k).lost ? 5 : 2, sent: 3, wr: 0.2 });
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
  function rTravel(n, w, destId = null) {
    const open = Object.values(w.towns).filter((t) => t.id !== n.town && !t.fallen);
    if (!open.length) return;
    const t = revengeTarget(n, w);
    let dest, reason = "";
    if (destId && w.towns[destId] && !w.towns[destId].fallen && destId !== n.town) dest = w.towns[destId];
    else if (t && t.town !== n.town && !w.towns[t.town].fallen) { dest = w.towns[t.town]; reason = ` 원수 ${jo(t.name, "을/를")} 쫓아`; }
    else if (n.hunger >= 3) { dest = maxBy(open, (x) => x.food / Math.max(1, w.residents(x.id).length)); reason = " 굶주림을 피해"; }
    else dest = w.rng.choice(open);
    const old = w.towns[n.town].name;
    w.move(n, dest.id);
    if (!n.stat.towns.includes(dest.id)) n.stat.towns.push(dest.id);
    w.record("travel", `${jo(n.name, "이/가")}${reason} ${jo(old, "을/를")} 떠나 ${jo(dest.name, "으로/로")} 이주했다`, { actor: n.id, town: dest.id, imp: reason ? 3 : 2, wr: 0 });
  }

  function betterJob(n, w) {
    // 꿈이 가리키는 직업이 있고 돈이 모였다면 그 길로 간다
    const want = n.dream && n.dream.job && JOBS[n.dream.job];
    if (want && want.id !== n.job && want.entry_cost <= n.gold && jobDemand(w, want, n.town, 1) > 0.6) return want;
    if (w.foodPrice(w.towns[n.town]) >= 4 && !JOBS[n.job].food && n.traits.ambition < 0.8) return JOBS.farmer;
    const cur = expectedIncome(w, JOBS[n.job], n.town);
    // 돈을 들여 차리는 일(가게·공방)로 옮겨 간다. 돈이 안 드는 일로는 먹을 것을 만드는 일(농사)만 옮겨 간다
    const opts = w.openJobs().filter((j) => j.id !== n.job && (j.entry_cost > 0 || j.food) && j.entry_cost <= n.gold * 0.8 && (!j.needKnow || knows(n, j.needKnow)) && expectedIncome(w, j, n.town, 1) > cur * 1.3);
    return opts.length ? maxBy(opts, (j) => expectedIncome(w, j, n.town, 1)) : null;
  }
  function uJob(n, w) {
    if (n.job_cooldown > 0 || n.role) return 0;
    const j = betterJob(n, w);
    if (!j) return 0;
    if (n.dream && n.dream.job === j.id) return 1.6;
    if (j.id === "farmer") return 0.9;
    return n.traits.ambition * 0.9 + n.traits.greed * 0.3;
  }
  function rJob(n, w) {
    const j = betterJob(n, w);
    if (!j) return;
    const old = JOBS[n.job].name;
    if (j.id === "farmer") {
      n.job = "farmer"; n.job_cooldown = 120;
      w.record("career", `흉년이 닥치자 ${jo(old, "이었던/였던")} ${jo(n.name, "이/가")} 생계를 위해 밭을 갈기 시작했다`, { actor: n.id, town: n.town, imp: 3, wr: 0.3 });
      return;
    }
    n.gold -= j.entry_cost; n.job = j.id; n.job_cooldown = 240; n.fame += 1;
    const what = j.start_text || `${jo(j.name, "이/가")} 되었다`;
    w.record("career", `${jo(old, "이었던/였던")} ${jo(n.name, "이/가")} 모은 금화 ${j.entry_cost}닢으로 ${what}`, { actor: n.id, town: n.town, imp: 5, wr: 0.4 });
  }

  function uWar(n, w) {
    if (!w.war.active || n.at_war) return 0;
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
      u: (n) => (n.health >= 7 ? 0 : (10 - n.health) * 0.3), run: rHeal },
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
    const people = w.rng.shuffle(w.alive());
    w.queue = people.map((n) => [n.id, w.rng.randint(60, 1020)]).sort((a, b) => a[1] - b[1]);
    w.qi = 0;
    w.dayOpen = true;
  }
  function actOne(w, n) {
    if (!n.alive) return;
    n.age_days += 1;
    if (n.age_days === ADULT * DPY) comeOfAge(n, w);
    if (!isAdult(n)) return;
    if (n.at_war) { n.lastAct = "soldier"; soldierDay(n, w); return; }
    if (n.jail > 0) { n.lastAct = "jail"; n.jail -= 1; return; }
    if (n.controller === "player") {
      // 플레이어는 직접 움직인다. '성격대로 맡기기' 중일 때만 성격에 따라 행동한다.
      if (w.autoDays > 0) { w.autoDays -= 1; choose(n, w).run(n, w); }
      return;
    }
    const act = choose(n, w);
    n.lastAct = act.id; // 신문의 '관심 인물' 일기에 쓰인다
    act.run(n, w);
  }
  function actUntil(w, minute) {
    while (w.qi < w.queue.length && w.queue[w.qi][1] <= minute) actOne(w, w.npcs[w.queue[w.qi++][0]]);
  }
  function finishDay(w) {
    actUntil(w, Infinity);
    upkeep(w);
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
  }

  function upkeep(w) {
    for (const t of Object.values(w.towns)) t.food *= 0.998;
    const paid = {}; // 오늘 마을 사람들이 밥값으로 낸 돈 → 먹을 것을 만든 사람들에게 돌아간다
    for (const n of w.alive()) {
      if (n.at_war) n.hunger = 0;
      else if (n.outside) n.hunger += 1;
      else {
        const town = w.towns[n.town], price = w.foodPrice(town), adult = isAdult(n);
        if (town.food >= 1 && (!adult || n.gold >= price)) {
          town.food -= 1;
          if (adult) { n.gold -= price; paid[n.town] = (paid[n.town] || 0) + price; }
          n.hunger = Math.max(0, n.hunger - 2);
        } else n.hunger += 1;
      }
      if (n.hunger >= 4) n.health -= 1;
      else if (n.health < 10 && n.hunger < 2) n.health = Math.min(10, n.health + 0.15);
      if (n.health <= 0) { w.die(n, "굶주림 끝에", { imp: n.controller === "player" ? 6 : 4 }); continue; }
      if (age(n) >= n.lifespan && w.rng.next() < 0.02) { w.die(n, "천수를 누리고", { imp: 3 }); continue; }
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
      for (const p of [n, m]) {
        p.children.push(c.id); p.rel[c.id] = 80; c.rel[p.id] = 80;
        for (const k of Object.keys(c.traits)) c.traits[k] = clamp((c.traits[k] + p.traits[k]) / 2, 0, 1);
      }
      if (mix && race === mix.id && !seenRace(w, mix.id)) { w.racesSeen.push(mix.id); w.record("race_born", `${jo(n.name, "과/와")} ${m.name} 사이에서 이 세계 최초의 ${jo(mix.name, "이/가")} 태어났다. ${mix.bornText || "사람들은 두 종족의 피를 이은 아이를 신기하게 바라보았다"}`, { actor: n.id, target: c.id, town: n.town, imp: 8, wr: 1 }); }
      w.record("birth", `${jo(n.name, "과/와")} ${m.name} 부부 사이에 ${jo(c.name, "이/가")} 태어났다`, { actor: n.id, target: c.id, town: n.town, imp: n.controller === "player" || m.controller === "player" ? 5 : 3, wr: 0.4, notify: [m.id] });
    }
  }

  function comeOfAge(n, w) {
    const pj = n.parents.map((p) => w.npcs[p].job);
    let how;
    if (pj.length && w.rng.next() < 0.5) { n.job = w.rng.choice(pj); how = "부모의 일을 이어받아"; }
    else { n.job = w.pickJob(w.towns[n.town]); how = "스스로 길을 정해"; }
    n.gold = w.rng.uniform(5, 15);
    let text = `${jo(n.name, "이/가")} 성인이 되어 ${how} ${jo(JOBS[n.job].name, "이/가")} 되었다`, imp = 3;
    if (n.goal && n.goal.type === "revenge" && w.npcs[n.goal.target].alive) {
      text += `. 어린 시절의 원수 ${jo(w.npcs[n.goal.target].name, "을/를")} 결코 잊지 않았다`;
      imp = 6;
    }
    w.record("adulthood", text, { actor: n.id, town: n.town, imp, cause: n.goal ? n.goal.vow : null, wr: 0.2 });
  }

  function immigration(w) {
    const adults = w.alive().filter(isAdult).length;
    if (adults < w.initialPop * 0.85 && w.rng.next() < 0.06) {
      const town = w.rng.choice(Object.values(w.towns).filter((t) => !t.fallen));
      const n = w.spawn(town.id);
      w.record("arrival", `${RACES[n.race].name} ${JOBS[n.job].name} ${jo(n.name, "이/가")} ${town.name}에 정착했다`, { actor: n.id, town: town.id, imp: 2, wr: 0 });
    }
  }

  // ================================================================ 콘텐츠 맞추기
  /** 새로 더해진 마을에 사람을 채우고, 이름이 정해진 주민(CONTENT.npcs)을 세계에 들인다. 저장된 세계를 불러올 때도 불린다. */
  function syncContent(w, silent = false) {
    for (const t of Object.values(w.towns)) {
      if (t.seeded) continue;
      t.seeded = true;
      for (let i = 0; i < t.start_pop; i++) { const n = w.spawn(t.id); if (isAdult(n)) pickDream(n, w, true); }
      if (!silent) w.record("founding", `${t.nation}의 ${jo(t.name, "이/가")} 지도에 새로 나타났다. 먼 곳에서 사람들이 오가기 시작했다`, { town: t.id, imp: 7, wr: 0 });
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

  // ================================================================ 새 나라와 새 직업 (세계가 스스로 넓어진다)
  function addTown(w, def) {
    w.founded = w.founded || [];
    if (!w.founded.some((x) => x.id === def.id)) w.founded.push(def);
    w.towns[def.id] = { id: def.id, name: def.name, nation: def.nationName, border: false, races: def.races, job_bias: def.job_bias || {}, start_pop: 0,
      food: 80, fallen: false, seeded: true, founded: def.day, founder: def.founder, x: def.pos[0], y: def.pos[1] };
    return w.towns[def.id];
  }
  const allTownDefs = (w) => [...CONTENT.towns, ...(w.founded || [])];
  /** 꿈을 이룬 개척자가 무리를 이끌고 빈 땅에 새 나라를 세운다 */
  function foundNation(n, w) {
    const NN = CONTENT.nationNames, used = new Set(Object.values(w.towns).map((t) => t.name)), usedN = new Set(Object.values(w.towns).map((t) => t.nation));
    const style = n.traits.ambition > 0.85 && n.traits.bravery > 0.6 ? "proud" : n.traits.kindness > 0.6 ? "kind" : "plain";
    let nationName; for (let i = 0; i < 20; i++) { nationName = `${w.rng.choice(NN.pre)} ${w.rng.choice(NN.kind[style])}`; if (!usedN.has(nationName)) break; }
    const followers0 = w.alive().filter((x) => x.follows === n.id && x.controller !== "player" && !x.at_war);
    // 빈 땅을 찾는다 (지도가 있으면 지도에서, 없으면 기본 후보지에서). 빈 땅이 없거나, 고향 사람 다수가 따르면 고향을 독립시킨다
    const home = w.towns[n.town];
    const finder = w.findSite || (root.Game && root.Game.findSite);
    const site = finder ? finder(w, [home.x, home.y]) : (() => { const taken = allTownDefs(w).map((t) => t.pos); const ok = CONTENT.frontier.filter((s) => taken.every((p) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 30)); return ok.length ? w.rng.choice(ok) : null; })();
    const localShare = followers0.filter((x) => x.town === n.town).length / Math.max(1, w.residents(n.town, true).length);
    if (!site || (!home.border && localShare > 0.3 && w.rng.next() < 0.5)) {
      const oldNation = home.nation;
      home.nation = nationName; home.indep = { from: oldNation, day: w.day, founder: n.id };
      const title = style === "proud" ? "국왕" : style === "kind" ? "촌장" : "족장";
      n.title = `${nationName}의 ${title}`; n.fame += 10;
      for (const x of w.alive()) if (x.follows === n.id && x.controller !== "player") x.follows = null;
      const others = Object.values(w.towns).filter((t) => t.id !== home.id && t.nation === oldNation).length;
      if (!others) { // 나라의 마을이 여기 하나뿐이면 독립이 아니라 혁명이다
        const ruler = w.alive().find((x) => x.title && x.title.startsWith(oldNation));
        if (ruler) { ruler.title = null; A_adjust(ruler, n.id, -60); }
        return w.record("independence", `${jo(n.name, "이/가")} ${home.name} 사람들의 뜻을 모아 ${ruler ? jo(ruler.name, "을/를") + " 몰아내고 " : ""}${oldNation}의 이름을 버리고 ‘${nationName}’${jo(nationName, "을/를").slice(nationName.length)} 새로 선포했다`,
          { actor: n.id, target: ruler ? ruler.id : null, town: home.id, imp: 9, sent: ruler ? -10 : 0, wr: 1 });
      }
      return w.record("independence", `${jo(n.name, "이/가")} ${home.name} 사람들과 함께 ${oldNation}에서 떨어져 나와 ‘${nationName}’${jo(nationName, "을/를").slice(nationName.length)} 선포했다`,
        { actor: n.id, town: home.id, imp: 9, wr: 1 });
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
      { actor: n.id, town: t.id, imp: 9, wr: 0, notify: w.alive().filter((x) => x.follows === n.id).map((x) => x.id) });
    for (const x of w.alive()) if (x.follows === n.id && x.controller !== "player") x.follows = null;
    if (w.onMapChange) w.onMapChange();
    return ev;
  }
  /** 수요가 쌓이면 누군가 처음으로 새 일을 시작한다. 그 뒤로 그 직업은 이 세계의 직업이 된다 */
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
      const old = JOBS[n.job].name;
      n.job = j.id; n.job_cooldown = 200; n.fame += 3; n.pioneer = j.id;
      w.jobsOpen.push(j.id);
      w.record("job_born", j.emerge.text(n, w, old), { actor: n.id, town: n.town, imp: 7, wr: 0.8 });
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
    n.at_war = false;
    if (n.role === "hero") n.role = null;
    let home = w.towns[n.home];
    if (home.fallen) home = w.rng.choice(Object.values(w.towns).filter((t) => !t.fallen));
    n.town = home.id;
    n.fame += 2;
    n.gold += w.rng.randint(20, 50);
    w.record("return", text || `${jo(n.name, "이/가")} 참전 용사가 되어 ${jo(home.name, "으로/로")} 돌아왔다`, { actor: n.id, town: home.id, imp, wr: 0.4 });
  }

  function soldierDay(n, w) {
    const hero = n.role === "hero";
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
      w.record("liberation", `아스테리아 연합군이 ${jo(bt.name, "을/를")} 되찾았다`, { town: bt.id, imp: 8 });
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
    n.gold = 8; // 빈손으로 시작한다
    w.playerId = n.id;
    w.record("arrival", `${RACES[race].name} ${JOBS[job].name} ${jo(name, "이/가")} ${w.towns[town].name}에서 새 삶을 시작했다`, { actor: n.id, town, imp: 5, wr: 0.5 });
    return n;
  }

  const _ = { RNG, maxBy, clamp, adjust, power, related, rWork, rHeal, rForage, enlist, returnHome, borderTown, DPS };
  root.Asteria = { freshWorld, jobDemand, _, CONTENT, RACES, JOBS, DREAMS, extend, syncContent, foundNation, allTownDefs, recent, knows, learn, KNOW, seenRace, racesInWorld, pickDream, dreamName, dreamProgress, DPY, DPS, SEASONS, World, ACTIONS, ACT, available, choose, step, advance, beginDay, finishDay, newWorld, addPlayer,
    answerOracle, playerNeedsChoice, feuds, chain, storyScore, age, isAdult, opinion, family, jo, lordName };
})(typeof window !== "undefined" ? window : globalThis);
