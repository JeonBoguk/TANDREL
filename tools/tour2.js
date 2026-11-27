// 사용법: game/ 폴더를 8766 포트로 띄운 뒤 (cd game && python3 -m http.server 8766) 저장소 루트에서 node tools/tour2.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.stack));
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(2000);
  await p.click('.tbtn:has-text("새 게임")'); await p.click('.tpanel .wbtn.gold'); await p.waitForTimeout(2500);
  await p.fill('#bName', '하늘'); await p.click('#win button[type=submit]'); await p.waitForTimeout(800);
  const peek = (x, y) => p.evaluate(([x, y]) => { const v = asteriaView(); v.peek = true; v.cam = { x, y }; }, [x, y]);
  // 1) 밭: 작물 다섯 종 × 단계
  const farm = await p.evaluate(() => { const W = asteriaWorld(), G = Game, e = G.ext(W), t = W.player.home, [cx, cy] = G.TOWN_POS[t];
    const types = ["turnip", "potato", "wheat", "strawberry", "pumpkin"], out = [cx - 3, cy + 12];
    types.forEach((ty, i) => { for (let s = 0; s < 5; s++) { const x = cx - 4 + s, y = cy + 11 + i; const days = G.CROPS[ty].days; e.farm[x + "," + y] = { watered: s % 2 ? W.day : -1, owner: W.player.id, crop: s === 4 ? { type: ty, g: 0, dead: true } : { type: ty, g: [0, Math.ceil(days * 0.4), Math.ceil(days * 0.7), days][s] } }; } });
    return out; });
  await peek(farm[0] + 1, farm[1] + 1); await p.waitForTimeout(700); await p.screenshot({ path: 'shots/h_farm.png' });
  // 2) 물건들
  const objs = await p.evaluate(() => { const G = Game, O = G.O, M = G.MAP, W = asteriaWorld(), out = {};
    for (const [name, o] of Object.entries({ ruin: O.RUIN, tent: O.TENT, mound: O.MOUND, shroom: O.SHROOM, herb: O.HERB })) {
      for (let i = 0; i < M.obj.length && !out[name]; i++) if (M.obj[i] === o) { const x = i % G.MW, y = Math.floor(i / G.MW); if (o !== O.SHROOM || G.forageReady(W, x, y)) out[name] = [x, y]; } }
    return out; });
  console.log(JSON.stringify(objs));
  for (const [n, s] of Object.entries(objs)) { if (!s) continue; await peek(s[0] + 0.5, s[1] + 0.5); await p.waitForTimeout(500); await p.screenshot({ path: `shots/h_${n}.png` }); }
  // 3) 동물
  await p.evaluate(() => { Game.tick(asteriaWorld(), 30); });
  const an = await p.evaluate(() => Game.animals.slice(0, 40).map((a) => [a.type, a.x, a.y]));
  const seen = {}; for (const [t, x, y] of an) if (!seen[t]) seen[t] = [x, y];
  console.log(JSON.stringify(seen));
  for (const [t, s] of Object.entries(seen)) { await peek(s[0], s[1]); await p.waitForTimeout(400); await p.screenshot({ path: `shots/h_a_${t}.png`, clip: { x: 440, y: 250, width: 400, height: 300 } }); }
  // 4) 실내: 내 집 안으로
  await p.evaluate(() => { const v = asteriaView(); v.peek = false; const W = asteriaWorld(), G = Game, bd = G.homeBuilding(W); W.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] - 0.6 }; });
  await p.waitForTimeout(900); await p.screenshot({ path: 'shots/h_inside.png' });
  // 5) 겨울
  await p.evaluate(() => { const W = asteriaWorld(), A = Asteria; while (W.season !== "겨울") W.day += A.DPS; const G = Game, bd = G.homeBuilding(W); W.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] + 2.5 }; });
  await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/h_winter.png' });
  console.log('errors:', errs.join('\n')); await b.close();
})();
