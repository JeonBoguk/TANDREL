/* 확장 팩 예시: 세공사
 * 코드 없이 데이터만으로 새 직업을 더하는 예. 직업 + 기술 + 아이템 + 업무(단계와 조작 부품)만 적는다.
 *   - 업무의 단계는 이미 있는 조작 부품(timing·trace·grind·gauge…)을 고르고 값만 정한다
 *   - 새 조작이 필요하면 sims.js의 Sims.register와 engine의 Asteria.registerTool로 부품을 먼저 만든다
 *   - shift: false → '반나절 일하기'를 붙이지 않는다. 업무의 부품이 모두 준비돼야 이 직업이 열린다
 * 원석은 바위 둘레에서 가끔 나온다 (아이템의 foundAt·chance). */
(function (root) {
  "use strict";
  const A = root.Asteria;

  A.extend({
    jobs: [
      { id: "jeweler", name: "세공사", income: [2.0, 5.5], entry_cost: 40, weight: 0.25, start_text: "작은 세공방을 열었다", shift: false,
        color: "#6ec6d8", icon: "💎", workplace: "market", teaches: ["gemcraft"], look: { hat: "bandana", apron: "#5a6a7a", prop: "hammer" } },
    ],
    knowledge: [
      { id: "gemcraft", domain: ["craft", "art"], name: "세공", desc: "원석의 결을 읽어 쪼개고, 깎고, 갈아 보석을 만든다" },
    ],
    items: {
      rough_gem: { name: "원석", sell: 6, foundAt: "rock", chance: 0.1, art: ["rock", "#7fa8b8"], hint: "바위 둘레에서 가끔 나온다. 세공사가 다듬는다" },
      gem: { name: "다듬은 보석", sell: 28, art: ["round", "#6ec6e0"], hint: "비싸게 팔린다" },
      gem_ring: { name: "보석 반지", sell: 60, art: ["coin", "#d8b850"], hint: "아주 비싸게 팔린다" },
    },
    works: [
      { id: "cut_gem", job: "jeweler", name: "원석 다듬기", specName: "보석 연마공", mins: 120, energy: 10, needs: { rough_gem: 1 }, gives: { gem: 1 }, skill: "gemcraft", hint: "원석을 쪼개고 깎아 보석으로",
        steps: [{ name: "결 읽고 쪼개기", tool: "timing", p: { zone: [0.42, 0.5], speed: 1.3, label: "정을 칠 때" } },
          { name: "깎기", tool: "trace", p: { shape: "zigzag" }, w: 1.5 },
          { name: "연마", tool: "grind", p: { n: 18, secs: 7 } }] },
      { id: "set_ring", job: "jeweler", name: "반지 만들기", specName: "반지 장인", mins: 180, energy: 12, needs: { gem: 1, old_coin: 2 }, gives: { gem_ring: 1 }, skill: "gemcraft", hint: "옛 동전을 녹여 테를 만들고 보석을 물린다",
        steps: [{ name: "동전 녹이기", tool: "gauge", p: { zone: [0.7, 0.86], secs: 5, label: "불 세기" } },
          { name: "테 두르기", tool: "trace", p: { shape: "arc" } },
          { name: "보석 물리기", tool: "timing", p: { zone: [0.46, 0.54], speed: 0.9, label: "누를 때" }, w: 1.5 }] },
    ],
  });
})(typeof window !== "undefined" ? window : globalThis);
