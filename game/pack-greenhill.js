/* 확장 팩 예시: 초록언덕 자치령
 * 이 파일 하나로 새 국가·마을·종족·직업·아이템·이름 있는 주민을 더한다. 엔진은 건드리지 않는다.
 * 기본으로는 불러오지 않는다(예시). 쓰려면 index.html에서 content.js 다음, game.js 앞에 <script src="pack-greenhill.js">를 넣는다.
 * 이미 진행 중인 세계를 불러와도, 새 마을과 주민이 그 세계에 자연스럽게 들어온다. */
(function (root) {
  "use strict";
  const A = root.Asteria;
  const { jo } = A;

  A.extend({
    nations: { greenhill: "초록언덕 자치령" },

    races: [
      { id: "halfling", name: "하플링", lifespan: [90, 120], adultAge: 20, magic: 0.25, traits: { kindness: 0.15, ambition: -0.1, bravery: -0.05 },
        look: { skin: ["#f6d1ad", "#eab98f"], short: true, curly: true, hair: ["#7a4a26", "#b8742e", "#d9a85a", "#4a3020"] },
        names: ["포피", "밀로", "로지", "빌보", "데이지", "토비", "페린", "머틀", "올리", "클로버", "호브", "피핀", "메리골드", "탐"] },
    ],

    towns: [
      { id: "acorn", name: "도토리골", nation: "greenhill", population: 9, pos: [140, 62], roads: ["granok", "lumen"],
        races: { halfling: 0.8, human: 0.2 }, job_bias: { cook: 3, farmer: 2, beekeeper: 3 } },
    ],

    knowledge: [
      { id: "beekeeping", name: "벌 치기", domain: ["nature", "craft"], desc: "벌통을 돌보고 꿀을 거둔다" },
      { id: "mead", name: "꿀술 빚기", desc: "꿀을 삭혀 술을 빚는다", domain: ["craft", "heat"], noun: "꿀술", jobName: "꿀술 장인", workName: "꿀술 빚기",
        born: { job: "beekeeper", lv: 2, p: 0.0012, text: "꿀단지가 저절로 삭는 것을 보고 ‘{k}’{k:을/를} 깨쳤다" },
        demand: { events: ["festival", "marriage", "feast"], within: 120, n: 2 }, makes: { needs: { honey: 2 }, gives: { mead: 1 } } },
    ],
    // 경험의 대상: 꿀 (양봉가의 경험이 깊어지면 밀랍 공예 같은 앎이 생긴다)
    subjects: [
      { id: "honey", name: "꿀", doms: ["art","care","craft","nature","heat"], item: "honey", color: "#e0b02a", names: { art: ["밀랍 공예", "밀랍 장인"], care: ["꿀 처방", "꿀 의원"] } },
    ],
    jobs: [
      { id: "beekeeper", teaches: ["beekeeping"], exp: [["nature", "honey"], ["craft", "honey"]], name: "양봉가", income: [1.5, 3.5], food: 0.8, entry_cost: 20, weight: 0.5, start_text: "벌통을 놓았다",
        color: "#e0b02a", icon: "🐝", workplace: "fields", look: { hat: "veil" },
        skill: { name: "벌통 돌보기", hint: "하루에 한 번, 꿀을 거둔다. 사람에게 쓰면 꿀을 나눠 준다",
          use(api) {
            const { w, p, npc, give, take, out } = api;
            if (npc) {
              if (!take("honey", 1)) return "나눠 줄 꿀이 없다.";
              api.adjust(npc, p.id, 8);
              return out(`${jo(npc.name, "이/가")} 꿀단지를 받아 들고 활짝 웃었다.`, 5, 1);
            }
            const e = root.Game.ext(w);
            if (e.honeyDay === w.day) return "벌들도 쉬어야 한다. 내일 다시 오자.";
            if (w.season === "겨울") return "겨울엔 벌들이 벌통 안에서 겨울을 난다.";
            e.honeyDay = w.day; give("honey", w.season === "봄" ? 3 : 2);
            return out("벌통을 살피고 황금빛 꿀을 거뒀다.", 30, 5);
          } },
        likes: "honey", ask: ["flower", 5, "벌들에게 새 꽃밭을 보여 주고 싶어요."],
        talk: { 봄: "꽃이 피면 벌들이 신이 나요. 저도요!", 여름: "여름 꿀은 진하고 달아요.", 가을: "벌들이 겨울 채비를 해요. 꿀을 너무 많이 가져오면 안 돼요.", 겨울: "벌들이 서로 몸을 붙이고 겨울을 나요. 기특하죠." } },
    ],

    items: {
      honey: { name: "꿀", icon: "🍯", food: 1, energy: 14, sell: 12 },
      honey_cake: { name: "꿀 케이크", icon: "🍰", food: 4, energy: 30, sell: 28 },
      mead: { name: "꿀술", sell: 16, food: 1, energy: 10, art: ["bottle", "#d8a840"], hint: "잔치에 빠지지 않는다" },
    },
    recipes: [
      { id: "honey_cake", out: "honey_cake", station: "workbench", needs: { honey: 2, wheat: 2 }, mins: 40, energy: 3, hint: "금화 28닢에 팔린다" },
    ],

    // 이름과 사연이 있는 주민. 세계에 한 번만 들어온다 (id로 구분)
    npcs: [
      { id: "poppy", name: "포피", race: "halfling", job: "cook", town: "acorn", age: 34, traits: { kindness: 0.85, ambition: 0.7, greed: 0.2, bravery: 0.4 },
        dream: "fame", bio: "도토리골에서 가장 맛있는 파이를 굽는다. 언젠가 왕도에서도 자기 이름을 걸고 요리하고 싶어 한다." },
      { id: "milo", name: "밀로", race: "halfling", job: "beekeeper", town: "acorn", age: 61, traits: { kindness: 0.7, ambition: 0.2, greed: 0.3, bravery: 0.3 },
        dream: "quiet", bio: "벌들과 이야기하는 노인. 마을 아이들에게 꿀을 몰래 나눠 준다." },
      { id: "margo", name: "마고", race: "human", job: "baker", town: "lumen", age: 72, traits: { kindness: 0.9, ambition: 0.1, greed: 0.1, bravery: 0.5 },
        gold: 60, dream: "kindness", bio: "루멘에서 50년째 빵을 구운 할머니. 배고픈 사람은 그냥 보내지 않는다." },
    ],

    eventKinds: { founding: "전황" },
  });
})(typeof window !== "undefined" ? window : globalThis);
