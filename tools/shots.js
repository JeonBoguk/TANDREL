// 사용법: game/ 폴더를 8766 포트로 띄운 뒤 (cd game && python3 -m http.server 8766) 저장소 루트에서 node tools/shots.js
// UI 점검용 스크린샷: 데스크톱과 휴대폰
const { chromium, devices } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desk';
  const b = await chromium.launch();
  const ctx = mode === 'mobile' ? await b.newContext({ ...devices['iPhone 13'] }) : await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = (n) => p.screenshot({ path: `shots/u_${mode}_${n}.png` });
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(2500); await shot('title');
  await p.click('.tbtn:has-text("새 게임")'); await p.click('.tpanel .wbtn.gold'); await p.waitForTimeout(2500);
  await p.fill('#bName', '하늘'); await p.click('#win button[type=submit]'); await p.waitForTimeout(800);
  // 미션 두 개 받아 두기
  await p.evaluate(() => { const W = asteriaWorld(), S = Story, A = Asteria; const ns = W.residents(W.player.home, true).filter((n) => n.controller !== 'player');
    S.addMission(W, { type: 'fetch', item: 'branch', n: 6, from: ns[0].id, reward: 12 }); S.addMission(W, { type: 'hunt', animal: 'rabbit', n: 3, reward: 12, board: W.player.home }); Game.give(W, 'stone', 3, '바위 둘레에서 줍기', '들판'); Game.give(W, 'apple', 2, '사과나무에서 따기', '루멘'); Game.give(W, 'meat', 1, '토끼 사냥', '들판'); Game.give(W, 'stone_spear', 1, '만들기', ''); });
  await p.waitForTimeout(600); await shot('play');
  // 대화창
  await p.evaluate(() => { const W = asteriaWorld(), G = Game; const v = G.visibleNPCs(W)[0]; W.ppos = { x: v.k.x + 0.9, y: v.k.y }; G.ext(W).facing = 'left'; });
  await p.waitForTimeout(300);
  if (mode === 'mobile') await p.click('.padbtn:has-text("말 걸기")'); else { await p.locator('#world').focus(); await p.keyboard.press('e'); }
  await p.waitForTimeout(400); await shot('talk');
  const sc = await p.evaluate(() => { const o = document.querySelector('.talk .opts'); if (!o) return null; o.scrollTop = 999; return [o.scrollHeight, o.clientHeight, o.scrollTop]; });
  console.log('opts scroll (scrollHeight, clientHeight, scrollTop)', sc);
  if (mode === 'mobile') await p.click('.talk .opt:has-text("잘 있어요")'); else await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  for (const [btn, name] of [['나', 'me'], ['소식', 'news']]) { await p.click(`.mbtn:has-text("${btn}")`); await p.waitForTimeout(300); await shot(name); await p.click('#win .x'); await p.waitForTimeout(200); }
  await p.click('.mbtn:has-text("나")'); await p.click('.tab:has-text("미션")'); await p.waitForTimeout(300); await shot('missions');
  await p.click('.tab:has-text("만들기")'); await p.waitForTimeout(300); await shot('craft');
  const wsc = await p.evaluate(() => { const bd = document.querySelector('#win .body'); bd.scrollTop = 9999; return [bd.scrollHeight, bd.clientHeight, bd.scrollTop]; });
  console.log('win body scroll', wsc);
  await p.click('#win .x'); await p.click('.mbtn:has-text("도감")'); await p.waitForTimeout(300); await shot('codex');
  await p.click('.cats button:has-text("음식")'); await p.click('.cxitem:has-text("사과")'); await p.waitForTimeout(200); await shot('codex2');
  await p.click('#win .x'); await p.click('.mbtn:has-text("도움말")'); await p.waitForTimeout(300); await shot('help');
  console.log('errors:', errs.join('\n')); await b.close();
})();
