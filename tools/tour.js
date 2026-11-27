// 사용법: game/ 폴더를 8766 포트로 띄운 뒤 (cd game && python3 -m http.server 8766) 저장소 루트에서 node tools/tour.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.stack));
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(2000);
  await p.click('.tbtn:has-text("새 게임")'); await p.click('.tpanel .wbtn.gold'); await p.waitForTimeout(2500);
  await p.fill('#bName', '하늘'); await p.click('#win button[type=submit]'); await p.waitForTimeout(800);
  const spots = await p.evaluate(() => { const G = Game, T = G.T, M = G.MAP, out = {};
    const find = (pred) => { for (let y = 5; y < G.MH - 5; y += 2) for (let x = 5; x < G.MW - 5; x += 2) if (pred(x, y)) return [x, y]; return null; };
    out.forest = find((x, y) => M.getT(x, y) === T.FLOOR && M.getT(x + 3, y + 3) === T.FLOOR && M.getT(x - 3, y - 3) === T.FLOOR);
    out.shore = find((x, y) => M.getT(x, y) === T.GRASS && M.getT(x + 3, y) === T.WATER && M.getT(x + 6, y) === T.WATER);
    out.bridge = find((x, y) => M.getT(x, y) === T.BRIDGE);
    out.waste = find((x, y) => M.getT(x, y) === T.WASTE && M.getT(x + 4, y) === T.WASTE);
    out.square = (() => { const t = Object.keys(G.TOWN_POS)[1]; return G.TOWN_POS[t]; })();
    return out; });
  console.log(JSON.stringify(spots));
  for (const [name, s] of Object.entries(spots)) { if (!s) continue;
    await p.evaluate(([x, y]) => { const v = asteriaView(); v.peek = true; v.cam = { x: x + 0.5, y: y + 0.5 }; }, s);
    await p.waitForTimeout(900); await p.screenshot({ path: `shots/g_${name}.png` }); }
  for (const season of ['가을', '겨울']) { await p.evaluate((se) => { const W = asteriaWorld(), A = Asteria; while (W.season !== se) W.day += A.DPS; }, season); await p.evaluate(() => { const v = asteriaView(), t = Object.keys(Game.TOWN_POS)[0]; v.peek = true; v.cam = { x: Game.TOWN_POS[t][0] + 0.5, y: Game.TOWN_POS[t][1] + 2.5 }; }); await p.waitForTimeout(1200); await p.screenshot({ path: `shots/g_${season === '가을' ? 'autumn' : 'winter'}.png` }); }
  const perf = await p.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n / 2; });
  console.log('fps', perf, 'errors:', errs.join('\n')); await b.close();
})();
