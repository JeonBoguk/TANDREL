/* 콘텐츠 팩: 세계에 새 직업·꿈·사건·아이템을 더하는 곳.
 * engine.js 다음, game.js 앞에서 불린다. 엔진 코드를 고치지 않고 이 파일(또는 이런 파일을 하나 더)만으로 세계를 넓힌다.
 *
 *   Asteria.extend({ jobs: [...], dreams: [...], worldEvents: [...], items: {...}, eventKinds: {...} })
 *
 * 직업:  id, name, income[최소,최대], entry_cost, weight(주민이 고를 확률), workplace(일터 건물 종류),
 *        color(옷 색), icon, skill{name, hint, use(api)}, likes(좋아하는 선물), ask[아이템, 개수, 대사], talk(일 이야기)
 * 꿈:    id, name, weight(n,w), init(n,w), progress(n,w,d) 0~1, bias{행동id: 배수}, text(n,w,d), done(n,w,d)
 * 사건:  id, when(w, ctx) → true면 오늘 일어남, run(w, ctx)
 */
(function (root) {
  "use strict";
  const A = root.Asteria;
  const { jo, isAdult, opinion } = A;
  const pick = (w, arr) => arr[Math.floor(w.rng.next() * arr.length)];

  /** 주민이 목수에게 맡길 공사 하나를 정한다: 돈이 넉넉하면 집을 넓히고, 아니면 지붕이나 벽을 바꾼다 */
  A.buildJob = function (w, n) {
    const G = root.Game, { town, hid } = G.houseOfNpc(n), S = A.CONTENT.styles;
    if (!hid) return null;
    if (n.gold > 160 && G) {
      const opts = G.houseExpandOptions(w, town, hid);
      if (opts.length) { const mod = w.rng.choice(opts), fee = Math.round(w.rng.uniform(90, 140)); return { kind: "expand", mod, town, hid, fee, needs: { wood: 12, stone: 6 }, work: 8, desc: `집을 ${mod.name} 넓히기` }; }
    }
    const kind = w.rng.choice(["roof", "wall"]), cur = (G.houseAsset(w, town, hid) || {}).style || {};
    const style = w.rng.choice(Object.keys(S[kind]).filter((k) => k !== cur[kind])); // 지금과 다른 것으로
    if (!style) return null;
    return { kind, style, town, hid, fee: Math.round(w.rng.uniform(30, 60)), needs: kind === "roof" ? { wood: 4 } : { stone: 4 }, work: 4, desc: `${kind === "roof" ? "지붕을" : "벽을"} ${jo(S[kind][style].name, "으로/로")}` };
  };

  A.extend({
    // ------------------------------------------------------------ 새 직업: 요리사
    jobs: [
      { id: "cook", name: "요리사", income: [1.8, 4.5], food: 1.2, entry_cost: 30, weight: 0.8, start_text: "작은 식당을 차렸다",
        color: "#d9534f", icon: "🍳", workplace: "tavern",
        skill: { name: "솜씨 좋은 요리", hint: "먹을거리 2개로 특선 요리를 만든다. 사람에게 쓰면 대접한다",
          use(api) {
            const { w, p, npc, inv, ITEMS, take, give, out } = api;
            if (npc) {
              if (!take("dish", 1)) return "대접할 특선 요리가 없다. 먼저 요리를 만들어야 한다.";
              api.adjust(npc, p.id, 12); npc.hunger = 0;
              w.record("feast", `${jo(p.name, "이/가")} ${npc.name}에게 손수 만든 요리를 대접했다`, { actor: p.id, target: npc.id, town: p.town, imp: 2, sent: 4, wr: 0.3 });
              return out(`${jo(npc.name, "이/가")} 한 입 먹더니 눈을 동그랗게 떴다. "이거 정말 맛있어요!"`, 15, 3);
            }
            const raw = Object.keys(inv).filter((id) => ITEMS[id] && ITEMS[id].food && !ITEMS[id].tool && id !== "dish" && id !== "meal")
              .sort((a, b) => (a === "bread") - (b === "bread") || (ITEMS[a].sell || 0) - (ITEMS[b].sell || 0));
            const total = raw.reduce((s, id) => s + inv[id], 0);
            if (total < 2) return "재료(먹을거리) 2개가 필요하다.";
            let need = 2; const used = [];
            for (const id of raw) { while (need > 0 && inv[id] > 0) { take(id, 1); used.push(ITEMS[id].name); need--; } }
            give("dish", 1);
            return out(`${jo([...new Set(used)].join("·"), "으로/로")} 김이 모락모락 나는 특선 요리를 만들었다.`, 40, 6);
          } },
        likes: "dish", ask: ["mushroom", 4, "오늘 특선 요리에 쓸 버섯이 모자라요."],
        talk: { 봄: "봄나물이 올라오면 국물이 달라져요. 손님들이 금방 알아채요.", 여름: "더울 땐 시원한 걸 찾죠. 딸기를 얹은 디저트가 잘 나가요.", 가을: "가을은 요리사의 계절이에요. 호박 수프 냄새 맡아 봤어요?", 겨울: "추운 날엔 다들 스튜를 찾아요. 고기가 늘 모자라요." } },
      // 옛 직업이 가르칠 수 있는 지식 (같은 id면 기존 정의에 덧붙는다)
      { id: "farmer", teaches: ["farming_tools", "weaving"] }, { id: "blacksmith", teaches: ["farming_tools", "woodwork", "smithing"] },
      { id: "merchant", teaches: ["weaving"] }, { id: "alchemist", teaches: ["herbal"] }, { id: "priest", teaches: ["herbal"] }, { id: "baker", teaches: ["baking"] }, { id: "cook", teaches: ["cooking"] },
      // ---------------------------------------------------------- 수요가 생기면 나타나는 직업 (emerge). 누가 언제 처음 시작하느냐는 세계마다 다르다
      { id: "builder", teaches: ["woodwork"], needKnow: "woodwork", name: "목수", income: [2.0, 5.0], entry_cost: 30, weight: 0.7, color: "#a0703a", icon: "🔨", workplace: "guild", look: { hat: "cap", apron: "#7a5230" },
        emerge: { demand: (w) => ((w.founded || []).length >= 1 ? 1 : 0) + A.recent(w, ["marriage"], 120) / 6 + w.alive().filter((n) => n.gold > 150).length / 12, know: "woodwork",
          text: (n, w, old) => (w.founded || []).length ? `새 나라에 지을 집이 모자라자, ${old} 일을 하던 ${jo(n.name, "이/가")} 망치를 들었다. 사람들은 처음으로 ${jo(n.name, "을/를")} ‘목수’라 불렀다` : `결혼하는 사람이 늘어 집이 모자라자, ${old} 일을 하던 ${jo(n.name, "이/가")} 처음으로 집 짓는 일을 시작했다. 사람들은 ${jo(n.name, "을/를")} ‘목수’라 불렀다` },
        skill: { name: "손보기", hint: "사람에게 쓰면 집을 손봐 주고 금화를 받는다",
          use(api) { const { p, npc, out } = api; if (!npc) return "손봐 줄 집의 주인에게 써야 한다."; api.adjust(npc, p.id, 5); p.gold += 5; return out(`${npc.name}의 삐걱대는 문을 고쳐 주고 금화 5닢을 받았다.`, 40, 8); } },
        likes: "wood", ask: ["wood", 6, "지붕을 고쳐야 하는데 나무가 모자라요."],
        talk: "요즘은 짓겠다는 집이 끝도 없어요. 좋은 나무만 있으면 뭐든 지어 드리죠." },
      { id: "courier", name: "우편배달부", income: [1.5, 3.5], entry_cost: 10, weight: 0.5, color: "#3a7a5a", icon: "✉️", workplace: "inn", look: { hat: "cap" },
        emerge: { demand: (w) => A.recent(w, ["travel"], 60) / 16 + (Object.keys(w.towns).length >= 8 ? 1 : 0),
          text: (n, w, old) => `마을을 떠나 흩어져 사는 사람이 늘자, ${jo(n.name, "이/가")} 편지를 모아 마을 사이를 오가기 시작했다. 이 세계 최초의 우편배달부다` },
        likes: "bread", ask: ["bread", 2, "먼 길을 가는데 먹을 게 없네요."],
        talk: "어느 마을에 누가 이사 갔는지는 제가 제일 잘 알아요." },
      { id: "mercenary", name: "용병", income: [0.5, 8.0], entry_cost: 0, weight: 0.5, fighter: true, risk: 0.01, color: "#5a4a6a", icon: "⚔️", workplace: "tavern", look: { hat: "bandana" },
        emerge: { demand: (w) => A.recent(w, ["bandits", "raid"], 240) / 3, fit: (n) => n.traits.bravery > 0.5,
          text: (n, w, old) => `산적과 마왕군이 잦아지자, ${jo(n.name, "이/가")} 돈을 받고 마을을 지켜 주겠다며 칼을 팔기 시작했다. 사람들은 ${jo(n.name, "을/를")} ‘용병’이라 불렀다` },
        likes: "meat", ask: ["hide", 2, "갑옷을 덧댈 가죽이 필요해."], talk: "돈만 주면 지켜 주지. 산적이든 늑대든." },
      { id: "doctor", name: "의사", income: [3.0, 6.0], entry_cost: 60, weight: 0.4, healer: true, color: "#e8f0f0", icon: "🩺", workplace: "temple", look: { hat: "cap", trim: "#c04040" },
        needKnow: "medicine", emerge: { demand: (w) => A.recent(w, ["plague"], 360) + (w.alive().some((n) => A.knows(n, "medicine")) ? 1 : 0), know: "medicine", fit: (n) => n.traits.kindness > 0.4,
          text: (n, w, old) => `‘의술’을 익힌 ${jo(n.name, "이/가")} 기도만으로는 사람을 살릴 수 없다며, 병을 고치는 ‘의사’의 길을 처음 열었다` }, teaches: ["medicine", "herbal"],
        likes: "herb", ask: ["herb", 5, "약을 지을 약초가 모자라요."], talk: "병은 신의 벌이 아니에요. 원인이 있어요." },
    ],
    items: {
      dish: { name: "특선 요리", icon: "🥘", food: 6, energy: 35, sell: 18 },
      // 맨손으로 모으는 것
      branch: { name: "나뭇가지", icon: "🥢", sell: 1, hint: "나무 밑에서 줍는다" },
      stone: { name: "돌멩이", icon: "🪨", act: "throw", dmg: 2, sell: 1, hint: "던져서 작은 짐승을 잡는다" },
      fiber: { name: "풀섬유", icon: "🧵", sell: 1, hint: "풀밭이나 덤불에서 뜯는다" },
      // 만든 것
      stone_axe: { name: "돌도끼", icon: "🪓", tool: true, act: "chop", yield: 2, sell: 4, hint: "나무를 벤다 (나무 2)" },
      stone_spear: { name: "돌창", icon: "🔱", tool: true, weapon: 2, sell: 4, hint: "휘두른다" },
      roast: { name: "구운 고기", icon: "🍖", food: 4, energy: 18, sell: 9 },
      salve: { name: "약초 연고", icon: "🩹", heal: 3, sell: 7 },
      basket: { name: "풀 바구니", icon: "🧺", sell: 14, furniture: "basket", hint: "집 안에 놓거나 판다" },
      chair: { name: "나무 의자", icon: "🪑", sell: 26, furniture: "chair", hint: "집 안에 놓거나 판다" },
      table: { name: "나무 탁자", icon: "🟫", sell: 34, furniture: "table", hint: "집 안에 놓거나 판다" },
      rug: { name: "풀 깔개", icon: "🟩", sell: 16, furniture: "rug", walk: true, hint: "집 안 바닥에 깐다" },
      flowerpot: { name: "화분", icon: "🪴", sell: 10, furniture: "pot", hint: "집 안에 놓는다" },
      mead: { name: "꿀술", sell: 16, food: 1, energy: 10, art: ["bottle", "#d8a840"], hint: "잔치에 빠지지 않는다" },
      fever_tonic: { name: "해열 탕약", icon: "🍵", heal: 6, sell: 20 },
      rune_spear: { name: "룬 돌창", icon: "🔱", tool: true, weapon: 4, sell: 40, hint: "룬이 빛나는 창" },
      elixir: { name: "비약", icon: "⚗️", heal: 10, energy: 100, sell: 60 },
      old_coin: { name: "옛 금화", icon: "🪙", sell: 15 }, relic: { name: "낡은 유물", icon: "🏺", sell: 40, hint: "누가 만든 걸까" },
      scroll_medicine: { name: "의술 두루마리", icon: "📜", teaches: "medicine", sell: 30 },
      scroll_rune: { name: "룬 두루마리", icon: "📜", teaches: "rune", sell: 30 },
      scroll_elixir: { name: "비약 두루마리", icon: "📜", teaches: "elixir", sell: 30 },
      scroll_dragon: { name: "알 수 없는 문자의 두루마리", icon: "📜", teaches: "dragon_tongue", sell: 50 },
    },
    /* 만들기. station 없음 = 맨손으로 어디서나, "home" = 내 집 앞, "workbench" = 내 집 작업대 */
    /* 직업의 업무 (일터 건물 메뉴에 나온다). steps의 tool은 조작 부품:
     *   gauge   불·온도 지키기: 누르고 있으면 오르고 떼면 내린다. 표시 구간 안에 오래 머물수록 좋다 (p: zone[아래,위], secs)
     *   rhythm  박자 맞추기: 내려오는 표시가 선에 닿을 때 누른다 (p: beats, bpm)
     *   timing  때 맞추기: 움직이는 바늘을 한 번에 멈춘다 (p: zone[아래,위], speed)
     *   measure 계량: 누르고 있으면 차오른다. 목표에 가깝게 떼되 넘치면 안 된다 (p: target, speed)
     *   trace   선 따라가기: 끌어서 선을 따라 자른다 (p: shape: "line"|"arc"|"zigzag")
     *   grind   연마: 좌우를 번갈아 눌러 고르게 간다 (p: n, secs)
     * w는 단계의 무게(품질에 미치는 몫). 단계가 없는 업무는 '반나절 일하기'처럼 바로 끝난다(sim: shift) */
    works: [
      { id: "fields_help", job: "farmer", name: "공동 밭일 거들기", hint: "마을 곳간을 채우고 품삯을 받는다" },
      { id: "forge_hoe", job: "blacksmith", name: "괭이 벼리기", mins: 120, energy: 14, needs: { wood: 2, stone: 3 }, gives: { hoe: 1 }, skill: "smithing", hint: "대장간 불로 괭이를 벼린다",
        steps: [{ name: "가열", tool: "gauge", p: { zone: [0.62, 0.8], secs: 5, label: "쇠의 빛깔" } },
          { name: "망치질", tool: "rhythm", p: { beats: 8, bpm: 92 }, w: 1.5 },
          { name: "담금질", tool: "timing", p: { zone: [0.7, 0.82], speed: 1.1, label: "물에 담글 때" } }] },
      { id: "forge_axe", job: "blacksmith", name: "도끼 벼리기", mins: 150, energy: 16, needs: { wood: 2, stone: 4 }, gives: { axe: 1 }, skill: "smithing", hint: "날이 선 도끼를 만든다",
        steps: [{ name: "가열", tool: "gauge", p: { zone: [0.66, 0.82], secs: 6, label: "쇠의 빛깔" } },
          { name: "망치질", tool: "rhythm", p: { beats: 10, bpm: 100 }, w: 1.5 },
          { name: "날 세우기", tool: "grind", p: { n: 16, secs: 6 } },
          { name: "담금질", tool: "timing", p: { zone: [0.72, 0.82], speed: 1.2, label: "물에 담글 때" } }] },
      { id: "bake", job: "baker", name: "빵 굽기", mins: 120, energy: 8, needs: { wheat: 2 }, gives: { bread: 3 }, skill: "baking", hint: "밀로 빵을 굽는다",
        steps: [{ name: "계량", tool: "measure", p: { target: 0.7, speed: 0.5, label: "밀가루" } },
          { name: "반죽", tool: "rhythm", p: { beats: 8, bpm: 80 } },
          { name: "발효", tool: "gauge", p: { zone: [0.4, 0.6], secs: 5, label: "따뜻함" } },
          { name: "굽기", tool: "timing", p: { zone: [0.6, 0.74], speed: 0.8, label: "꺼낼 때" }, w: 1.5 }] },
      { id: "stew", job: "cook", name: "스튜 끓이기", mins: 90, energy: 6, needs: { meat: 1, turnip: 1 }, gives: { meal: 2 }, skill: "cooking", hint: "고기와 순무로 스튜를 끓인다",
        steps: [{ name: "손질", tool: "rhythm", p: { beats: 8, bpm: 110 } },
          { name: "불 조절", tool: "gauge", p: { zone: [0.45, 0.65], secs: 6, label: "불 세기" }, w: 1.5 },
          { name: "간 맞추기", tool: "measure", p: { target: 0.45, speed: 0.4, label: "소금" } }] },
      // 봉사하는 일: 손님(client)에게 하고, 결과(effects)는 물건이 아니라 체력·마음·금화·소식
      { id: "treat", job: "doctor", name: "진료하기", mins: 90, energy: 8, client: "sick", skill: "medicine", hint: "아픈 사람을 살피고 약을 지어 준다",
        steps: [{ name: "증상 살피기", tool: "observe", p: { rounds: 3 } }, { name: "안심시키기", tool: "talk", p: { rounds: 2 } }, { name: "약 달기", tool: "measure", p: { target: 0.5, speed: 0.45, label: "약재" }, w: 1.5 }],
        effects: { heal: 4, gold: [2, 6], rel: 8, fame: 1, record: { kind: "cure", text: "{me:이/가} 앓아누운 {client:을/를} 정성껏 돌봐 일으켜 세웠다", imp: 3, p: 0.3 } } },
      { id: "brew_tonic", job: "doctor", name: "탕약 짓기", mins: 120, energy: 8, needs: { herb: 3, mushroom: 1 }, gives: { fever_tonic: 1 }, skill: "medicine", hint: "환자가 없는 날엔 약을 지어 둔다",
        steps: [{ name: "약재 고르기", tool: "observe", p: { rounds: 2 } }, { name: "달이기", tool: "gauge", p: { zone: [0.5, 0.68], secs: 6, label: "불 세기" }, w: 1.5 }, { name: "덜어 담기", tool: "measure", p: { target: 0.6, speed: 0.45, label: "탕약" } }] },
      { id: "bless", job: "priest", name: "축복 기도", mins: 60, energy: 5, client: "any", hint: "찾아온 사람을 위해 기도한다",
        steps: [{ name: "이야기 듣기", tool: "talk", p: { rounds: 2 } }, { name: "기도문 외우기", tool: "memory", p: { len: 4 } }, { name: "촛불 지키기", tool: "gauge", p: { zone: [0.35, 0.55], secs: 5, label: "촛불" } }],
        effects: { rel: 6, heal: 1, gold: [0.5, 2] } },
      { id: "deliver", job: "courier", name: "편지 전하기", mins: 120, energy: 12, client: "any", hint: "맡은 편지를 받을 사람에게 전한다",
        steps: [{ name: "받는 곳 외우기", tool: "memory", p: { len: 5 } }, { name: "걸음 맞추기", tool: "rhythm", p: { beats: 8, bpm: 120 } }, { name: "전하며 인사", tool: "talk", p: { rounds: 1 } }],
        effects: { gold: [1.5, 4], rel: 4 } },
      { id: "brew_salve", job: "alchemist", name: "연고 달이기", mins: 90, energy: 6, needs: { herb: 2, fiber: 1 }, gives: { salve: 2 }, skill: "herbal", hint: "약초로 연고를 달인다",
        steps: [{ name: "빻기", tool: "grind", p: { n: 14, secs: 5 } },
          { name: "계량", tool: "measure", p: { target: 0.55, speed: 0.45, label: "기름" } },
          { name: "달이기", tool: "gauge", p: { zone: [0.5, 0.66], secs: 6, label: "불 세기" }, w: 1.5 }] },
    ],
    recipes: [
      { id: "stone_axe", out: "stone_axe", needs: { branch: 3, stone: 2, fiber: 3 }, mins: 30, energy: 4, hint: "나무를 벨 수 있다" },
      { id: "stone_spear", out: "stone_spear", needs: { branch: 3, stone: 1, fiber: 2 }, mins: 25, energy: 3, hint: "짐승을 사냥한다" },
      { id: "roast", out: "roast", needs: { meat: 1, branch: 2 }, mins: 20, energy: 1, hint: "모닥불에 굽는다" },
      { id: "salve", out: "salve", know: "herbal", needs: { herb: 2, fiber: 1 }, mins: 15, energy: 1, hint: "다쳤을 때 바른다" },
      { id: "workbench", name: "작업대", build: "workbench", station: "home", needs: { branch: 10, stone: 6, fiber: 4 }, mins: 60, energy: 10, hint: "집 앞에 세운다. 더 많은 것을 만들 수 있다" },
      { id: "hoe", out: "hoe", station: "workbench", know: "farming_tools", needs: { wood: 3, stone: 3, fiber: 2 }, mins: 40, energy: 5, hint: "밭을 갈 수 있다" },
      { id: "can", out: "can", station: "workbench", know: "farming_tools", needs: { wood: 4, fiber: 3 }, mins: 40, energy: 4, hint: "작물에 물을 준다" },
      { id: "basket", out: "basket", station: "workbench", know: "weaving", needs: { fiber: 8 }, mins: 30, energy: 3, hint: "금화 14닢에 팔린다" },
      { id: "chair", out: "chair", station: "workbench", know: "woodwork", needs: { wood: 5, branch: 2 }, mins: 60, energy: 6, hint: "집에 놓거나 판다" },
      { id: "table", out: "table", station: "workbench", know: "woodwork", needs: { wood: 7 }, mins: 80, energy: 8, hint: "집에 놓거나 판다" },
      { id: "rug", out: "rug", station: "workbench", know: "weaving", needs: { fiber: 10, flower: 1 }, mins: 50, energy: 4, hint: "집 바닥에 깐다" },
      { id: "flowerpot", out: "flowerpot", needs: { stone: 3, flower: 2 }, mins: 20, energy: 2, hint: "집 안에 놓는다" },
      { id: "fever_tonic", out: "fever_tonic", know: "medicine", needs: { herb: 3, mushroom: 1 }, mins: 40, energy: 3, hint: "병과 상처를 다스린다" },
      { id: "rune_spear", out: "rune_spear", station: "workbench", know: "rune", needs: { stone_spear: 1, stone: 3 }, mins: 90, energy: 10, hint: "돌창에 룬을 새긴다" },
      { id: "elixir", out: "elixir", know: "elixir", needs: { herb: 2, berry: 3, mushroom: 2 }, mins: 60, energy: 4, hint: "기력과 체력을 단번에" },
    ],

    // ------------------------------------------------------------ 꿈
    dreams: [
      { id: "wealth", name: "큰 부자 되기",
        weight: (n) => n.traits.greed * 1.2 + n.traits.ambition * 0.4,
        init: (n) => ({ goal: Math.round(Math.max(150, n.gold * 3) / 10) * 10 }),
        progress: (n, w, d) => n.gold / d.goal,
        bias: { work: 1.4, help: 0.5, social: 0.8, steal: 1.2 },
        text: (n, w, d) => `금화 ${d.goal}닢을 모으고 싶어 한다`,
        done: (n, w, d) => `${jo(n.name, "이/가")} 마침내 금화 ${d.goal}닢을 모아 ${w.towns[n.town].name}의 손꼽히는 부자가 되었다` },
      { id: "shop", name: (n, d) => `${A.JOBS[d.job] ? A.JOBS[d.job].name : "내 가게"}의 길`,
        weight: (n) => (A.JOBS[n.job].entry_cost ? 0 : n.traits.ambition + 0.3),
        init: (n, w) => { const opts = A.CONTENT.jobs.filter((j) => j.entry_cost > 0 && j.id !== n.job); return { job: pick(w, opts).id }; },
        progress: (n, w, d) => (n.job === d.job ? 1 : Math.min(0.95, n.gold / A.JOBS[d.job].entry_cost)),
        bias: { work: 1.3, job: 2 },
        text: (n, w, d) => `언젠가 ${jo(A.JOBS[d.job].name, "이/가")} 되고 싶어 한다 (필요한 돈: 금화 ${A.JOBS[d.job].entry_cost})`,
        done: (n, w, d) => `${jo(n.name, "이/가")} 오랫동안 꿈꾸던 ${A.JOBS[d.job].name}의 길에 들어섰다` },
      { id: "family", name: "따뜻한 가정 꾸리기",
        weight: (n) => (n.children.length ? 0 : n.traits.kindness * 0.9 + (n.spouse === null ? 0.3 : 0.6)),
        progress: (n) => (n.children.length ? 1 : n.spouse !== null ? 0.7 : n.lover !== null ? 0.4 : 0.1),
        bias: { social: 1.7, war: 0.4, travel: 0.6 },
        text: (n) => (n.spouse !== null ? "아이를 기다리고 있다" : "사랑하는 사람과 가정을 꾸리고 싶어 한다"),
        done: (n) => `${jo(n.name, "은/는")} 아이를 품에 안고 꿈꾸던 가정을 이뤘다` },
      { id: "fame", name: "이름을 떨치기",
        weight: (n) => n.traits.bravery * 0.8 + n.traits.ambition * 0.8 - 0.4,
        init: (n) => ({ goal: n.fame + 10 }),
        progress: (n, w, d) => n.fame / d.goal,
        bias: { war: 2.2, work: 1.1, travel: 1.2, rest: 0.5 },
        text: (n, w, d) => "누구나 아는 이름이 되고 싶어 한다",
        done: (n) => `${jo(n.name, "은/는")} 이제 탄드렐 어디서나 이름이 알려진 사람이 되었다` },
      { id: "wander", name: "세상 구경하기",
        weight: (n) => n.traits.ambition * 0.6 + n.traits.bravery * 0.3 - (n.spouse !== null ? 0.4 : 0),
        progress: (n) => (n.stat.towns.length - 1) / 3,
        bias: { travel: 4, work: 0.9 },
        text: (n) => `여러 마을을 떠돌며 살고 싶어 한다 (지금까지 ${n.stat.towns.length}곳)`,
        done: (n) => `${jo(n.name, "은/는")} 네 개의 마을을 거치며 세상을 두루 구경했다` },
      { id: "kindness", name: "이웃에게 힘이 되기",
        weight: (n) => n.traits.kindness * 1.3 - n.traits.greed * 0.5,
        init: (n) => ({ start: n.stat.help }),
        progress: (n, w, d) => (n.stat.help - d.start) / 8,
        bias: { help: 2.5, social: 1.2, steal: 0.2 },
        text: (n, w, d) => `어려운 이웃을 돕고 싶어 한다 (${n.stat.help - d.start}/8번)`,
        done: (n, w) => `${jo(n.name, "은/는")} ${w.towns[n.town].name}에서 ‘어려울 때 찾아가는 사람’으로 불리게 되었다` },
      { id: "nation", name: "새 나라 세우기", startImp: 5,
        // 여러 사람이 동시에 꿈꿀 수 있다. 다만 야심과 용기가 있어야 이런 꿈을 품는다
        weight: (n, w) => (n.title || n.controller === "player" || n.traits.ambition < 0.72 || n.traits.bravery < 0.45) ? 0 : n.traits.ambition * 1.5 + n.fame * 0.06,
        init: () => ({}),
        startText: (n, w) => `${jo(n.name, "이/가")} "${w.towns[n.town].name}의 하늘은 너무 좁다. 아무도 살지 않는 땅에 우리만의 나라를 세우겠다"고 선언했다`,
        // 매일: 뜻을 함께할 동료를 모으고, 동료들은 돈을 보탠다
        daily(n, w) {
          const fol = w.alive().filter((x) => x.follows === n.id);
          for (const f of fol) if (f.gold > 12 && f.controller !== "player") { f.gold -= 0.6; n.gold += 0.6; }
          if (w.rng.next() > 0.08) return;
          const cands = w.residents(n.town, true).filter((c) => c.id !== n.id && c.controller !== "player" && !c.follows && !c.title && !c.at_war
            && opinion(c, n.id) >= 20 && (c.traits.ambition + c.traits.bravery > 0.95 || opinion(c, n.id) >= 50));
          if (!cands.length) return;
          const c = cands.sort((a, b) => opinion(b, n.id) - opinion(a, n.id))[0];
          c.follows = n.id; A._.adjust(c, n.id, 10);
          w.record("follow_founder", `${jo(c.name, "이/가")} 새 나라를 세우겠다는 ${n.name}의 뜻에 함께하기로 했다`, { actor: c.id, target: n.id, town: n.town, imp: 4, sent: 2, wr: 0.5 });
        },
        progress: (n, w) => { const f = w.alive().filter((x) => x.follows === n.id).length; return Math.min(f, 3) / 3 * 0.6 + Math.min(1, n.gold / 120) * 0.4; },
        bias: { work: 1.4, social: 1.5, travel: 0.1, war: 0.5 },
        text: (n, w) => { const f = w.alive().filter((x) => x.follows === n.id); return `아무도 살지 않는 땅에 새 나라를 세우려 한다. 함께하는 사람 ${f.length}명${f.length ? ` (${f.map((x) => x.name).join(", ")})` : ""}, 모은 돈 금화 ${Math.floor(n.gold)}/120`; },
        complete: (n, w) => A.foundNation(n, w) },
      { id: "quiet", name: "조용하고 평온한 삶",
        weight: (n) => (1 - n.traits.ambition) * 0.7 + (n.traits.bravery < 0.4 ? 0.3 : 0),
        progress: (n, w, d) => (w.day - d.since) / 120,
        bias: { rest: 1.6, social: 1.2, war: 0.2, travel: 0.4, steal: 0.5 },
        text: () => "큰일 없이 하루하루를 소중히 보내고 싶어 한다",
        done: (n, w) => `${jo(n.name, "은/는")} ${w.towns[n.town].name}에서 큰 탈 없이 평온한 한 해를 보냈다` },
    ],

    // ------------------------------------------------------------ 세계의 사건
    // ------------------------------------------------------------ 집 공사 (목수에게 맡긴다)
    /* kind: expand(집 넓히기: dx·dw·dh 칸) | roof | wall | floor (style: CONTENT.styles의 키)
     * gold: 목수 품삯, needs: 재료 (없으면 목수가 대신 구해 오고 값을 더 받는다), days: 공사 기간, requires: 먼저 끝나야 하는 공사 */
    renovations: [
      // 넓히기: 어느 쪽으로 넓힐지는 집 둘레에 빈 땅이 있는 방향 중에서 고른다. 넓힐수록 비싸진다 (max번까지)
      { id: "expand", kind: "expand", name: "집 넓히기", gold: 90, needs: { wood: 12, stone: 6 }, days: 3, max: 3 },
      ...Object.keys({ red: 1, blue: 1, green: 1, slate: 1, gold: 1, purple: 1 }).map((k) => ({ id: "roof_" + k, kind: "roof", style: k, gold: 25, needs: { wood: 3 }, days: 1 })),
      ...["plaster", "log", "brick", "stone"].map((k) => ({ id: "wall_" + k, kind: "wall", style: k, gold: 35, needs: { stone: 3 }, days: 2 })),
      ...["wood", "stone", "carpet"].map((k) => ({ id: "floor_" + k, kind: "floor", style: k, gold: 20, needs: { wood: 2 }, days: 1 })),
    ],
    styles: {
      roof: { red: { name: "붉은 기와", c: ["#b8463a", "#93362c"] }, blue: { name: "푸른 기와", c: ["#3f6bb0", "#2f5290"] }, green: { name: "초록 기와", c: ["#4f8a41", "#3c6a31"] },
        slate: { name: "짙은 회색 돌판", c: ["#5a5a66", "#44444e"] }, gold: { name: "황금빛 짚", c: ["#d9b04a", "#b08a2f"] }, purple: { name: "보랏빛 기와", c: ["#8a4fa8", "#6a3a88"] } },
      wall: { plaster: { name: "흰 회벽", c: "#ece4d2" }, log: { name: "통나무 벽", c: "#a8743f" }, brick: { name: "붉은 벽돌", c: "#b85a44" }, stone: { name: "돌벽", c: "#a8a8a0" } },
      floor: { wood: { name: "나무 마루", c: ["#b98a58", "#ad7f50"] }, stone: { name: "돌바닥", c: ["#a8a49a", "#9c988e"] }, carpet: { name: "붉은 카펫", c: ["#a84a4a", "#9a4242"] } },
    },

    worldEvents: [
      { id: "npc_renovation", // 돈이 모인 주민은 목수에게 집을 고쳐 달라고 한다. 목수의 일감이 된다
        when: (w, c) => c.rng.next() < 0.08 && w.alive().some((n) => n.job === "builder"),
        run(w, c) {
          const G = root.Game, S = root.Story, p = w.player;
          // 플레이어가 목수라면 플레이어도 일감을 받는 목수 중 하나다
          const builders = w.alive().filter((n) => n.job === "builder" && !n.at_war && n.jail === 0 && (n.controller !== "player" || (G && n.alive && !n.outside)));
          const b = c.rng.choice(builders); if (!b) return;
          // 집을 고치는 건 그 집 주인이다
          const clients = w.residents(b.town, true).filter((n) => n.id !== b.id && n.gold > 60 && n.controller !== "player" && n.house && (w.assets[n.house] || {}).owner === n.id);
          if (!clients.length) return;
          const n = c.rng.choice(clients);
          const job = A.buildJob(w, n); if (!job) return;
          if (b.controller === "player") { if (S && S.offerBuild && c.rng.next() < 0.35 && !(G.ext(w).missions || []).some((m) => !m.done && m.type === "build")) S.offerBuild(w, n, job); return; }
          n.gold -= job.fee; b.gold += job.fee; b.fame += job.kind === "expand" ? 2 : 1; c.adjust(n, b.id, 6);
          if (G) G.applyHouseWork(w, job.town, job.hid, job);
          w.record("renovate", `${jo(n.name, "이/가")} 목수 ${b.name}에게 금화 ${job.fee}닢을 주고 집을 고쳤다 (${job.desc})`, { actor: n.id, target: b.id, town: n.town, imp: job.kind === "expand" ? 4 : 3, sent: 2, wr: 0.5 });
        } },
      { id: "dragon_contact", // 누군가 용의 언어를 알거나, 아주 드물게, 용족이 처음으로 나타난다
        when: (w, c) => !A.seenRace(w, "dragonkin") && (w.alive().some((n) => A.knows(n, "dragon_tongue")) ? c.rng.next() < 0.02 : w.day > 360 && c.rng.next() < 0.0005),
        run(w, c) {
          const speaker = w.alive().find((n) => A.knows(n, "dragon_tongue"));
          const town = speaker && !speaker.at_war ? speaker.town : c.rng.choice(c.openTowns()).id;
          const leader = w.spawn(town, { race: "dragonkin", job: "adventurer", ageYears: 140 });
          Object.assign(leader.traits, { ambition: 0.92, bravery: 0.85 });
          const group = [leader, ...[0, 1, 2].map(() => w.spawn(town, { race: "dragonkin", job: c.rng.choice(["adventurer", "blacksmith", "farmer"]), ageYears: c.rng.randint(40, 200) }))];
          for (const g of group) { g.gold = 60; if (g !== leader) { g.follows = leader.id; c.adjust(g, leader.id, 60); } }
          w.racesSeen.push("dragonkin");
          w.record("contact", speaker
            ? `${jo(speaker.name, "이/가")} 두루마리에서 익힌 용의 언어로 하늘을 향해 외쳤다. 며칠 뒤, 뿔과 비늘을 가진 이방인들, 용족이 ${w.towns[town].name}에 내려왔다`
            : `북쪽 산맥 너머에서 뿔과 비늘을 가진 이방인들이 ${w.towns[town].name}에 나타났다. 사람들은 그들을 ‘용족’이라 불렀다`, { actor: speaker ? speaker.id : leader.id, town, imp: 10, wr: 1, data: { species: "dragonkin" } });
          if (speaker) { speaker.fame += 8; c.adjust(leader, speaker.id, 50); }
          A.foundNation(leader, w); // 그들만의 나라를 세운다 (빈 땅이 없으면 그 마을에 섞여 산다)
        } },
      { id: "festival", // 가을 첫날, 곳간이 넉넉한 마을은 수확 축제를 연다
        when: (w) => w.day % 120 === 60,
        run(w, c) {
          for (const t of c.openTowns()) {
            const people = w.residents(t.id, true);
            if (t.food / Math.max(1, people.length) < 4 || people.length < 3) continue;
            for (let i = 0; i < people.length * 2; i++) { const [a, b] = c.rng.sample2(people); c.adjust(a, b.id, 3); c.adjust(b, a.id, 3); }
            t.food *= 0.92;
            w.record("festival", `${t.name}에서 수확 축제가 열려 밤늦도록 노래가 이어졌다`, { town: t.id, imp: 5, wr: 0.9 });
          }
        } },
      { id: "caravan", // 떠돌이 상단이 가장 굶주린 마을에 곡식을 풀고 간다
        when: (w, c) => w.day - c.last("caravan") > 40 && c.rng.next() < 0.02,
        run(w, c) {
          const t = c.maxBy(c.openTowns(), (x) => -x.food / Math.max(1, w.residents(x.id).length));
          t.food += 40;
          w.record("caravan", `동쪽에서 온 떠돌이 상단이 ${t.name}에 들러 곡식 수레를 풀었다`, { town: t.id, imp: 4, wr: 0.8 });
        } },
      { id: "plague", // 드물게 역병이 돈다. 치유사가 있는 마을은 덜 다친다
        when: (w, c) => w.day - c.last("plague") > 360 && c.rng.next() < 0.004,
        run(w, c) {
          const t = c.rng.choice(c.openTowns());
          const healers = w.residents(t.id, true).filter((h) => c.JOBS[h.job].healer);
          const ev = w.record("plague", `${t.name}에 역병이 돌기 시작했다`, { town: t.id, imp: 7, wr: 1 });
          for (const n of w.residents(t.id)) {
            n.health -= c.rng.uniform(1, healers.length ? 4 : 7);
            if (n.health <= 0) w.die(n, "역병으로", { imp: 5, cause: ev.id });
          }
          for (const h of healers) {
            h.fame += 2;
            if (h.traits.kindness > 0.55 && !A.knows(h, "medicine") && c.rng.next() < 0.35) { // 위기 속에서 지식이 태어난다
              A.learn(h, "medicine");
              w.record("discovery", `${jo(h.name, "이/가")} 역병 환자들을 돌보다 병이 옮는 길을 깨달았다. 이 세계에 ‘의술’이 처음 생겨났다`, { actor: h.id, town: t.id, imp: 7, cause: ev.id, wr: 0.8, data: { skill: "medicine", how: "crisis" } });
            }
            w.record("plague_heal", `${jo(h.name, "이/가")} 밤낮없이 역병에 걸린 ${t.name} 사람들을 돌봤다`, { actor: h.id, town: t.id, imp: 5, cause: ev.id, wr: 0.7 });
          }
        } },
      { id: "bandits", // 산적이 마을 곳간을 노린다. 용감한 싸움꾼이 막아설 수 있다
        when: (w, c) => w.day - c.last("bandits") > 25 && c.rng.next() < 0.012,
        run(w, c) {
          const t = c.rng.choice(c.openTowns().filter((x) => !x.border));
          if (!t) return;
          const ev = w.record("bandits", `산적 떼가 ${t.name} 근처 길목에 나타났다`, { town: t.id, imp: 4, wr: 0.7 });
          const hero = c.maxBy(w.residents(t.id, true).filter((n) => n.controller !== "player" && (c.JOBS[n.job].fighter || n.traits.bravery > 0.75) && n.health > 5), (n) => c.power(w, n) + c.rng.next() * 3);
          if (hero && c.power(w, hero) + c.rng.uniform(0, 6) > 9) {
            hero.fame += 3;
            for (const n of w.residents(t.id)) c.adjust(n, hero.id, 6);
            w.record("bandits_beaten", `${jo(hero.name, "이/가")} 앞장서 산적 떼를 몰아냈다. ${t.name} 사람들이 환호했다`, { actor: hero.id, town: t.id, imp: 6, cause: ev.id, wr: 0.9 });
          } else {
            t.food *= 0.75;
            if (hero) { hero.health = Math.max(1, hero.health - 4); w.record("bandits_won", `${jo(hero.name, "이/가")} 산적에 맞섰지만 크게 다쳤고, 곳간을 털렸다`, { target: hero.id, town: t.id, imp: 5, cause: ev.id, wr: 0.7 }); }
            else w.record("bandits_won", `막아서는 사람이 없어 산적 떼가 ${t.name}의 곳간을 털어 갔다`, { town: t.id, imp: 5, cause: ev.id, wr: 0.7 });
          }
        } },
    ],

    // ------------------------------------------------------------ 처음엔 없는 종족
    /* mix: 두 종족 사이에서 처음 태어나는 순간 이 세계에 생긴다.  hidden: 어떤 계기(접촉 사건)가 있어야 나타난다. */
    races: [
      { id: "halfelf", name: "하프엘프", mix: ["human", "elf"], lifespan: [120, 180], adultAge: 22, magic: 0.55, traits: { kindness: 0.05, ambition: 0.05 },
        look: { skin: ["#f6dcc4", "#eecaa8"], ears: "long", hair: ["#d9b25a", "#7a4a26", "#e8e0c8", "#3b2a1e"] },
        bornText: "엘프의 귀와 인간의 눈빛을 가진 아이였다",
        names: ["엘리안", "카엘", "세린", "아르딘", "미렌", "티엘", "로엔", "아셀"] },
      { id: "dragonkin", name: "용족", hidden: true, knows: ["dragon_tongue"], lifespan: [300, 500], adultAge: 40, magic: 0.7, traits: { bravery: 0.25, ambition: 0.15, kindness: -0.05 },
        look: { skin: ["#8cc0a0", "#d0906a", "#9aa8e0", "#c8b06a"], horns: "#efe4c8", tail: true, hair: ["#2a3a4a", "#5a2a2a", "#e8e0d0", "#2a4a3a"] },
        names: ["바르크", "이그니아", "쇼르", "타라크", "벨루즈", "카이락", "오르샤", "드라엔"] },
    ],
    // ------------------------------------------------------------ 지식과 비술
    /* 지식은 사람이 지닌다. 직업이 가르쳐 주는 지식(teaches)은 그 직업 사람에게 배울 수 있고,
     * lost(비술)는 아무도 모른다: 유적·흙더미의 두루마리, 적의 땅, 또는 위기 속의 깨달음으로만 세상에 나온다. 아는 사람은 친구에게 퍼뜨린다. */
    knowledge: [
      { id: "farming_tools", domain: ["craft"], name: "농기구 만들기", desc: "괭이와 물뿌리개를 만든다" },
      // 직업의 손기술: 그 직업으로 일하며 익히고, 업무의 품질을 정한다
      { id: "smithing", domain: ["craft", "heat"], name: "대장일", desc: "쇠를 달구고 두드려 연장을 벼린다" },
      { id: "baking", domain: ["craft", "heat"], name: "제빵", desc: "반죽을 빚고 알맞게 구워 낸다" },
      { id: "cooking", domain: ["craft", "heat", "care"], name: "요리", desc: "재료를 손질하고 불을 다뤄 음식을 낸다" },
      // practice: 같은 일을 n번 거듭하면 혼자서도 깨우친다
      { id: "woodwork", domain: ["craft", "art"], name: "목공", desc: "나무 가구를 짜고, 목수가 될 수 있다", practice: { stat: "chop", n: 12, text: "나무를 베고 다듬기를 거듭하다 보니 나뭇결을 읽는 법이 보였다." } },
      { id: "weaving", domain: ["craft", "art"], name: "짜기", desc: "풀섬유로 바구니와 깔개를 짠다", practice: { stat: "fiber", n: 30, text: "풀을 꼬고 엮다 보니 손이 저절로 움직인다." } },
      { id: "herbal", domain: ["nature", "knowledge"], name: "약초학", desc: "약초로 연고를 만든다", practice: { stat: "herb", n: 12, text: "약초와 버섯을 수없이 만지다 보니 어떤 게 약이 되는지 알 것 같다." } },
      { id: "medicine", domain: ["care", "knowledge"], name: "의술", desc: "병을 고치는 탕약을 짓는다. 의사가 되려면 필요하다", lost: true },
      { id: "rune", domain: ["magic", "craft"], noun: "룬", demand: { war: true }, name: "룬 새기기", desc: "돌에 룬을 새겨 무기를 강하게 한다", lost: true },
      { id: "elixir", domain: ["care", "magic"], noun: "비약", demand: { sick: 4 }, name: "비약 조합", desc: "기력과 체력을 단번에 되찾는 비약을 만든다", lost: true },
      { id: "dragon_tongue", name: "용의 언어", desc: "먼 곳의 누군가와 말이 통하게 된다", lost: true,
        domain: ["language"], noun: "용언", lang: "dragonkin", vocab: ["불", "하늘", "약속", "길", "물", "산", "벗", "값", "비늘", "알"],
        demand: { race: "dragonkin" } }, // 용족이 이 세계에 나타나면, 이 말을 아는 사람에게 일이 생긴다 (genesis)
      /* 삶에서 태어나는 지식 (born): 오래 한 일, 겪은 일, 사는 곳에서 깨친다. demand가 채워지면 세계 안에서 직업이 된다.
       * jobName·workName: 생길 직업·업무 이름. makes: 물건을 만드는 일. client·effects: 봉사하는 일의 손님과 결과 (없으면 분야대로) */
      { id: "field_surgery", name: "상처 꿰매기", desc: "전장에서 배운, 깊은 상처를 꿰매 살리는 법", domain: ["care", "body"], noun: "상처", jobName: "야전 의원", workName: "상처 꿰매기",
        born: { flag: "veteran", p: 0.0015, text: "전선에서 동료의 상처를 꿰매던 손길을 잊지 않았다. ‘{k}’{k:이/가} 몸에 남았다" },
        demand: { war: true }, client: "sick", effects: { heal: 5, gold: [1, 4], rel: 8, record: { kind: "cure", text: "{me:이/가} 깊은 상처를 입은 {client:을/를} 꿰매 살렸다", imp: 3, p: 0.2 } } },
      { id: "bilingual", name: "두 말 하기", desc: "다른 종족·다른 나라의 말을 함께 쓴다", domain: ["language", "social"], noun: "말", jobName: "통역사", workName: "말 옮겨 주기",
        born: { mixed: 4, p: 0.0008, text: "다른 종족 이웃들과 부대끼며 살다 보니 두 나라 말이 다 입에 붙었다" },
        demand: { nations: 4, events: ["caravan", "contact", "independence", "nation_founded"], within: 240, n: 2 }, client: "foreign", effects: { gold: [2, 5], bond: 3, rel: 5, record: { kind: "interpret", text: "{me:이/가} 다른 나라에서 온 {client}의 말을 옮겨, 오해를 풀었다", imp: 3, p: 0.1 } } },
      { id: "statecraft", name: "나랏일", desc: "나라와 나라 사이의 일을 다루는 법", domain: ["social", "knowledge"], noun: "나랏일", jobName: "외교관", workName: "사신 맞이하기",
        born: { fame: 25, p: 0.0012, text: "이름이 알려지며 여러 나라 사람을 만나다 보니 ‘{k}’{k:을/를} 알게 되었다" },
        demand: { nations: 4, events: ["war_start", "independence", "nation_founded", "liberation"], within: 360, n: 1 }, client: "foreign", effects: { gold: [3, 7], bond: 4, fame: 2, record: { kind: "diplomacy", text: "{me:이/가} 다른 나라에서 온 {client:과/와} 마주 앉아 두 나라 사이의 오해를 풀었다", imp: 4, p: 0.12 } } },
      { id: "law", name: "법", desc: "다툼과 죄를 가리는 규칙", domain: ["social", "knowledge"], noun: "법", jobName: "재판관", workName: "다툼 가리기",
        born: { life: ["report", "arrest", "theft", "revenge"], n: 2, p: 0.0015, text: "죄와 다툼을 여러 번 겪으며 무엇이 옳은지 가리는 ‘{k}’{k:을/를} 세우기 시작했다" },
        demand: { crime: 7, within: 120 }, client: "any", effects: { rel: 5, gold: [2, 5], fame: 1, record: { kind: "judgment", text: "{me:이/가} {town}의 다툼을 법대로 가려 주었다", imp: 3, p: 0.12 } } },
      { id: "reckoning", name: "셈", desc: "곳간과 장부를 맞추는 셈법", domain: ["knowledge", "social"], noun: "셈", jobName: "장부지기", workName: "곳간 장부 맞추기",
        born: { job: "merchant", lv: 3, p: 0.0012, text: "오래 장사하며 셈이 늘어, 마을 곳간까지 셈할 수 있게 되었다" },
        demand: { pop: 80, events: ["food_worry", "granary_open", "food_aid"], within: 240, n: 2 }, client: null, effects: { food: 6, gold: [2, 5], record: { kind: "ledger", text: "{me:이/가} {town} 곳간 장부를 바로잡아 새는 곡식을 막았다", imp: 3, p: 0.1 } } },
      { id: "mead", name: "꿀술 빚기", desc: "꿀을 삭혀 술을 빚는다", domain: ["craft", "heat"], noun: "꿀술", jobName: "꿀술 장인", workName: "꿀술 빚기",
        born: { job: "beekeeper", lv: 2, p: 0.0012, text: "꿀단지가 저절로 삭는 것을 보고 ‘{k}’{k:을/를} 깨쳤다" },
        demand: { events: ["festival", "marriage", "feast"], within: 120, n: 2 }, makes: { needs: { honey: 2 }, gives: { mead: 1 } } },
    ],
    loot: [ // 유적(ruin)·흙더미(mound)·황무지 유적(waste)에서 나오는 것. w: 비중
      { id: null, w: 5, text: "흙과 돌 부스러기뿐이었다" },
      { id: "stone", n: [2, 4], w: 4 }, { id: "old_coin", n: [1, 3], w: 5 }, { id: "relic", n: [1, 1], w: 2 },
      { id: "scroll_medicine", w: 1 }, { id: "scroll_rune", w: 1 }, { id: "scroll_elixir", w: 1 },
      { id: "scroll_dragon", w: 0.7, where: ["ruin", "waste"] }, { id: "relic", n: [1, 2], w: 3, where: ["waste"] },
    ],
    // 새 사건 종류가 신문의 어느 지면에 실리는지
    eventKinds: {
      festival: "마을 소식", caravan: "살림·장사", plague: "사건·사고", plague_heal: "사람들", bandits: "사건·사고", bandits_beaten: "사건·사고", bandits_won: "사건·사고",
      renovate: "살림·장사", renovate_done: "사람들", discovery: "사람들", learn: "사람들", independence: "전황", race_born: "사람들", contact: "전황",
      dream_done: "사람들", dream_lost: "사람들", dream_start: "사람들", feast: "사람들",
      nation_founded: "전황", follow_founder: "사람들", granary_open: "마을 소식", food_aid: "살림·장사", food_worry: "마을 소식", job_born: "살림·장사", founding: "전황",
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
