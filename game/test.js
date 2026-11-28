/* 테스트 단계: 내 캐릭터를 NPC처럼 대신 움직여 기능들이 제대로 도는지 점검한다.
 * 각 점검은 지금 세계의 '복사본'에서 새로 태어난 테스트 인물로 진행하므로, 실제 세계와 저장에는 영향이 없다.
 * 새 기능을 만들면 여기에 { id, name, run(t) }를 하나 더하면 된다. t.check(조건, 설명)으로 확인한다. */
(function (root) {
  "use strict";
  const A = root.Asteria, G = root.Game, S = root.Story;
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

  // ---------------------------------------------------------------- 도우미
  function helpers(w) {
    const p = () => w.player, e = () => G.ext(w);
    const town = () => p().home;
    const placeOf = (kind, t = town()) => G.MAP.places.find((q) => q.town === t && q.kind === kind);
    const npcs = (f = () => true) => w.residents(town(), true).filter((n) => n.controller !== "player" && n.jail === 0 && f(n));
    const findTile = (pred, near) => {
      let best = null, bd = 1e9;
      for (let y = 0; y < G.MH; y++) for (let x = 0; x < G.MW; x++) if (pred(x, y)) { const d = near ? dist(x, y, near[0], near[1]) : 0; if (d < bd) { bd = d; best = [x, y]; if (!near) return best; } }
      return best;
    };
    const standAt = (x, y) => { w.ppos = { x: x + 0.5, y: y + 0.5 }; };
    const standBelow = (x, y) => { w.ppos = { x: x + 0.5, y: y + 1.5 }; G.ext(w).facing = "up"; };
    const tickTo = (hour) => { const h = G.hour(w); const mins = Math.round(((hour - h + 24) % 24) * 60); if (mins > 0) G.tick(w, mins); };
    const overlaps = () => {
      const B = G.MAP.buildings; let bad = 0;
      for (const a of B) for (const b of B) if (a !== b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad++;
      for (const a of B) { const [dx, dy] = a.door; if (G.MAP.solid[G.MAP.I(dx, dy)] >= 0) bad++; }
      return bad;
    };
    const talkPick = (n, labels) => {
      const s = S.talk(w, n.id);
      for (const l of labels) { const o = s.options.find((x) => x.label.startsWith(l)); if (!o) return { s, ok: false, missing: l }; o.go(); }
      S.endTalk(w, s);
      return { s, ok: true };
    };
    const ensureBuilder = () => {
      let b = w.alive().find((n) => n.job === "builder" && n.controller !== "player" && n.town === town());
      if (!b) { b = npcs((n) => A.isAdult(n))[0]; b.job = "builder"; A.learn(b, "woodwork"); w.jobsOpen = [...new Set([...(w.jobsOpen || []), "builder"])]; }
      return b;
    };
    return { p, e, town, placeOf, npcs, findTile, standAt, standBelow, tickTo, overlaps, talkPick, ensureBuilder };
  }

  // ---------------------------------------------------------------- 점검 목록
  const SCENARIOS = [
    { id: "start", name: "빈손으로 태어난다", run(t) {
      const inv = Object.keys(t.e().inv);
      t.check(inv.every((k) => ["hand", "skill", "bread"].includes(k)), `처음 가방: ${inv.join(", ")}`);
      t.check(t.p().gold <= 10, `처음 금화 ${Math.floor(t.p().gold)}닢`);
      t.check(t.e().wanted.level === 0 && t.e().missions.length === 0, "수배·미션 없이 시작");
    } },
    { id: "gather", name: "맨손으로 나뭇가지·돌멩이·풀섬유 모으기", run(t) {
      const home = G.TOWN_POS[t.town()];
      const tree = t.findTile((x, y) => [G.O.OAK, G.O.PINE].includes(G.objAt(t.w, x, y)) && !G.townAt(x, y) && G.walkable(t.w, x, y + 1), home);
      t.standBelow(...tree); t.e().sel = 0; G.useAt(t.w, ...tree);
      const rock = t.findTile((x, y) => G.objAt(t.w, x, y) === G.O.ROCK && G.walkable(t.w, x, y + 1), home);
      t.standBelow(...rock); G.useAt(t.w, ...rock);
      const grass = t.findTile((x, y) => G.grassy(t.w, x, y), home);
      t.standBelow(...grass); G.useAt(t.w, ...grass);
      const inv = t.e().inv;
      t.check(inv.branch > 0, `나뭇가지 ${inv.branch || 0}`); t.check(inv.stone > 0, `돌멩이 ${inv.stone || 0}`); t.check(inv.fiber > 0, `풀섬유 ${inv.fiber || 0}`);
    } },
    { id: "craft", name: "돌도끼 만들기와 작업대 세우기", run(t) {
      G.give(t.w, "branch", 13); G.give(t.w, "stone", 8); G.give(t.w, "fiber", 7);
      G.craft(t.w, "stone_axe"); t.check(t.e().inv.stone_axe === 1, "돌도끼를 만들었다");
      const inn = G.MAP.buildings.find((b) => b.town === t.town() && b.kind === "inn"); t.standAt(inn.door[0], inn.door[1] + 1);
      const r = G.craft(t.w, "workbench"); t.check(t.e().stations && t.e().stations.workbench === t.town(), `작업대: ${r}`);
      const st = G.stationPlaces(t.w)[0]; t.check(!!st, "집 옆에 작업대가 보인다");
      if (st) t.check(G.buildingMenu(t.w, st).some((v) => v.id.startsWith("craft:")), "작업대를 누르면 만들 것이 나온다");
    } },
    { id: "codex", name: "도감은 얻은 것만 쌓인다", run(t) {
      const c = () => t.e().codex || {};
      t.check(["bread", "branch", "stone", "fiber"].every((id) => c()[id]) && Object.keys(c()).length === 4, `처음 도감: ${Object.keys(c()).join(", ")}`);
      t.check(!c().apple && !c().elixir, "얻어 보지 않은 것은 없다");
      const home = G.TOWN_POS[t.town()];
      const ap = t.findTile((x, y) => G.objAt(t.w, x, y) === G.O.APPLE && G.forageReady(t.w, x, y) && G.walkable(t.w, x, y + 1), home);
      if (ap) { t.standBelow(...ap); t.e().sel = 0; G.useAt(t.w, ...ap); }
      if (ap && t.e().inv.apple) t.check(c().apple && c().apple.ways[0].how === "사과나무에서 따기" && c().apple.ways[0].at.length === 1, `사과: ${JSON.stringify(c().apple)}`);
      G.give(t.w, "meat", 1, "토끼 사냥", "들판");
      t.check(G.catOf("meat") === "food" && G.catOf("stone_spear") === "weapon" && G.catOf("hoe") === "tool", "분류");
      const vis = G.knownRecipes(t.w).map((r) => r.id);
      t.check(vis.includes("stone_axe") && !vis.includes("elixir") && !vis.includes("rune_spear"), "모르는 비술의 만드는 법은 보이지 않는다");
    } },
    { id: "throw", name: "돌멩이를 던져 토끼 잡기", run(t) {
      G.give(t.w, "stone", 8);
      const x = Math.floor(t.w.ppos.x), y = Math.floor(t.w.ppos.y);
      G.animals.push({ id: 99999, type: "rabbit", x: x + 3.5, y: y + 0.6, hp: 2, vx: 0, vy: 0, t: 99, state: "idle", hurt: 0, cd: 0 });
      let msg = ""; for (let i = 0; i < 8 && !t.e().inv.meat; i++) { const a = G.animals.find((q) => q.id === 99999); if (!a) break; a.vx = a.vy = 0; msg = G.throwAt(t.w, a.x, a.y, "stone"); }
      t.check((t.e().inv.meat || 0) > 0, `고기 ${t.e().inv.meat || 0} (${msg})`);
    } },
    { id: "market", name: "시장에서 팔기", run(t) {
      const m = t.placeOf("market"); t.standAt(m.x, m.y);
      G.give(t.w, "apple", 5); const g0 = t.p().gold;
      const r = G.doBuilding(t.w, m, "sell:apple"); t.check(t.p().gold > g0, `${r.text} (금화 ${Math.floor(g0)} → ${Math.floor(t.p().gold)})`);
    } },
    { id: "dream", name: "주민에게 꿈 물어보기", run(t) {
      const n = t.npcs((x) => A.isAdult(x) && x.dream)[0];
      if (!n) { t.note("꿈을 가진 주민이 없어 건너뜀"); return; }
      n.rel[t.p().id] = 30; const r = t.talkPick(n, ["꿈이 뭐예요?"]);
      t.check(r.ok && S.knowsDream(t.w, n), `${n.name}의 꿈: ${A.dreamName(n)}`);
    } },
    { id: "learn", name: "지식 배우기 (주민·두루마리·혼자 익히기)", run(t) {
      const n = t.npcs((x) => A.isAdult(x) && ((A.JOBS[x.job].teaches || []).some((k) => !A.knows(t.p(), k))))[0];
      if (n) { n.rel[t.p().id] = 50; const k = A.JOBS[n.job].teaches.find((q) => !A.knows(t.p(), q)); const r = t.talkPick(n, ["무언가 가르쳐", "‘" + A.KNOW(k).name]); t.check(r.ok && A.knows(t.p(), k), `${n.name}에게 ‘${A.KNOW(k).name}’ 배움`); }
      G.give(t.w, "scroll_rune", 1); G.readScroll(t.w, "scroll_rune"); t.check(A.knows(t.p(), "rune"), "두루마리로 ‘룬 새기기’ 익힘");
      for (let i = 0; i < 12; i++) G.practice(t.w, "chop"); t.check(A.knows(t.p(), "woodwork"), "나무를 12번 베어 ‘목공’을 혼자 익힘");
    } },
    { id: "visit", name: "초대받아 주민 집에 놀러 가기", run(t) {
      t.tickTo(18);
      const n = t.npcs((x) => A.isAdult(x) && x.jail === 0 && !A.family(t.p()).has(x.id))[0]; n.rel[t.p().id] = 60;
      t.talkPick(n, ["집에 놀러"]);
      const m = t.e().missions.find((x) => x.type === "visit"); t.check(!!m, "초대 미션이 생겼다");
      if (!m) return;
      const bd = G.MAP.buildings.find((b) => b.town === m.town && b.kind === "house" && b.hid === m.hid);
      t.check(G.canEnter(t.w, bd), "초대 시간에는 들어갈 수 있다");
      const [ex, ey] = G.entryOf(bd); t.standAt(ex, ey); G.tick(t.w, 1);
      t.check(m.visited, "집 안에 들어가 환영받았다");
      const pl = G.MAP.places.find((q) => q.b === bd.id);
      t.check(G.buildingMenu(t.w, pl).some((v) => v.id === "visit:tea"), "안에서 차 마시기를 할 수 있다");
      const ts = S.talk(t.w, m.to);
      t.check(ts.options.some((o) => o.label.startsWith("차 한잔")), "집주인에게 말을 걸면 집 안에서만 나오는 대화가 열린다");
      const fo = ts.options.find((o) => o.label.startsWith("가족 이야기")); if (fo) fo.go();
      t.check(ts.options.some((o) => o.label.startsWith("이만 가")), "이야기를 나눈 뒤에도 집 안 대화로 돌아온다");
      S.endTalk(t.w, ts);
      G.tick(t.w, 6 * 60); t.check(!G.insideBuilding(t.w) && m.done, "시간이 지나면 문밖으로 배웅받는다");
    } },
    { id: "reno", name: "목수에게 내 집 공사 맡기기", run(t) {
      const b = t.ensureBuilder(); t.p().gold = 2000;
      const o = G.renoOptions(t.w).find((x) => x.r.kind === "expand");
      t.check(!!o, "넓힐 방향이 있다"); if (!o) return;
      const inn0 = G.MAP.buildings.find((x) => x.town === t.town() && x.kind === "inn"), size0 = inn0.w * inn0.h;
      G.orderReno(t.w, b, "expand", o.r.mod); t.e().reno.until = t.w.day; G.renoDawn(t.w);
      const inn = G.MAP.buildings.find((x) => x.town === t.town() && x.kind === "inn");
      t.check(inn.w * inn.h > size0, `집 크기 ${size0} → ${inn.w * inn.h}칸`);
      t.check(t.overlaps() === 0, "건물끼리 겹치거나 문이 막히지 않는다");
    } },
    { id: "builder", name: "내가 목수가 되어 주민 집 공사하기", run(t) {
      A.learn(t.p(), "woodwork"); t.p().job = "builder"; t.w.jobsOpen = [...new Set([...(t.w.jobsOpen || []), "builder"])];
      const n = t.npcs((x) => A.isAdult(x))[0]; n.gold = 400; n.rel[t.p().id] = 30;
      t.talkPick(n, ["집에 고칠 데", "맡겨 주세요"]);
      const m = t.e().missions.find((x) => x.type === "build"); t.check(!!m, "공사 의뢰를 받았다"); if (!m) return;
      G.give(t.w, "wood", 20); G.give(t.w, "stone", 12); const g0 = t.p().gold;
      for (let i = 0; i < 6 && !m.done; i++) { t.p().energy = 100; G.doBuildWork(t.w, m.id); }
      t.check(m.done && t.p().gold > g0, `공사 완료, 품삯 ${Math.floor(t.p().gold - g0)}닢`);
      t.check(t.overlaps() === 0, "건물끼리 겹치거나 문이 막히지 않는다");
    } },
    { id: "burglary", name: "밤에 남의 집 몰래 들어가기", run(t) {
      t.tickTo(23.5);
      const bd = G.MAP.buildings.find((b) => b.town === t.town() && b.kind === "house" && G.residentsOf(t.w, b).length);
      const pl = G.MAP.places.find((q) => q.b === bd.id); t.standAt(pl.x, pl.y); G.walkers.clear();
      let r = ""; for (let i = 0; i < 6 && !G.breakinAt(t.w, bd) && !t.e().wanted.level; i++) { t.p().energy = 100; r = G.doBuilding(t.w, pl, "steal:breakin").text; }
      if (t.e().wanted.level) { t.check(true, `문을 따다 들켜 수배됨 (${r})`); return; }
      t.check(!!G.breakinAt(t.w, bd), `문을 따고 들어갔다 (${r})`);
      const g0 = t.p().gold; r = G.doBuilding(t.w, pl, "steal:rummage").text;
      t.check(t.p().gold > g0 || t.e().wanted.level > 0 || /가져갈|빵/.test(r), `서랍 뒤지기: ${r}`);
    } },
    { id: "crime", name: "범죄를 저지르면 수배된다", run(t) {
      const n = t.npcs((x) => A.isAdult(x))[0]; t.standAt(G.TOWN_POS[t.town()][0], G.TOWN_POS[t.town()][1]);
      G.crime(t.w, "assault", n, 2, `${t.p().name}이(가) ${n.name}을(를) 때렸다`);
      t.check(t.e().wanted.level >= 1, `수배 ★${t.e().wanted.level}`);
    } },
    { id: "rebirth", name: "죽고 다시 시작하면 새로운 세계에서 처음부터", run(t) {
      t.e().wanted = { town: t.town(), level: 3, lastSeen: 0 }; G.give(t.w, "sword", 1);
      const n0 = t.w.alive().find((x) => x.controller !== "player" && A.isAdult(x)); for (const c of t.w.alive().filter((x) => x !== n0 && x.controller !== "player").slice(0, 3)) c.follows = n0.id; n0.gold = 300; A.foundNation(n0, t.w); // 옛 세계엔 역사가 쌓여 있다
      const oldDay = t.w.day, oldNations = new Set(Object.values(t.w.towns).map((x) => x.nation)).size;
      t.w.die(t.p(), "시험 삼아", {});
      // 기본: 새로운 세계 (태어나기 창의 '새로운 세계에서 처음부터'와 같은 길)
      const w2 = A.freshWorld(4242, "새 탄드렐"); G.setup(w2);
      G.newLife(w2, { name: "두번째", race: "human", job: "farmer", town: A.CONTENT.towns[0].id });
      const e2 = G.ext(w2);
      const oldFounded = new Set((t.w.founded || []).map((f) => f.nationName));
      t.check(w2.day <= A.DPY + 1 && !(w2.founded || []).some((f) => oldFounded.has(f.nationName) && f.day > A.DPY), `새 세계는 ${w2.date()}부터, 옛 세계(${t.w.date(oldDay)}, 나라 ${oldNations}개)의 역사를 물려받지 않는다`);
      t.check(e2.wanted.level === 0 && !e2.inv.sword && e2.missions.length === 0, "수배·가방·미션이 새로 시작한다");
      t.check(w2.player && w2.player.name === "두번째" && !w2.npcs.some((n) => n.name === t.p().name && n.controller === "player"), "새 인물로 태어났다");
      // 고를 수 있는 길: 이 세계에서 이어 살기
      G.setup(t.w); G.newLife(t.w, { name: "세번째", race: "human", job: "farmer", town: Object.keys(t.w.towns)[0] });
      t.check(t.e().wanted.level === 0 && !t.e().inv.sword, "‘이 세계에서 이어 살기’를 골라도 내 수배·가방은 이어지지 않는다");
      t.check(new Set(Object.values(t.w.towns).map((x) => x.nation)).size === oldNations, "그때는 세계의 나라가 그대로 남는다");
    } },
    { id: "nation", name: "주민이 새 나라를 세운다", run(t) {
      const n = t.w.alive().find((x) => x.controller !== "player" && A.isAdult(x) && !x.title);
      for (const c of t.w.alive().filter((x) => x !== n && x.controller !== "player" && A.isAdult(x)).slice(0, 3)) c.follows = n.id;
      n.gold = 300; const towns0 = Object.keys(t.w.towns).length, ev = A.foundNation(n, t.w);
      t.check(ev && (ev.kind === "nation_founded" || ev.kind === "independence"), ev ? ev.text : "건국 실패");
      const nid = ev && ev.data && ev.data.nation, N = nid && t.w.nations[nid];
      t.check(N && N.founder === n.id && N.name === ev.data.name && Object.values(t.w.towns).some((x) => x.nation === nid), `나라 목록: ${N ? `${nid} ${N.name}` : "없음"}`);
      if (ev && ev.kind === "independence") t.check(t.w.nations[ev.data.from] && N.from === ev.data.from, "갈라져 나온 나라가 기록된다");
      const w2 = A.World.deserialize(t.w.serialize());
      t.check(w2.nations[nid] && w2.nations[nid].name === N.name, "저장 뒤에도 나라가 그대로다");
      if (ev && ev.kind === "nation_founded") t.check(Object.keys(t.w.towns).length === towns0 + 1 && G.MAP.sig.includes(ev.town), "지도에 새 마을이 생겼다");
      t.check(t.overlaps() === 0, "건물끼리 겹치지 않는다");
    } },
    { id: "year", name: "세계가 1년 동안 스스로 흘러간다", run(t) {
      const ev0 = t.w.events.length;
      for (let i = 0; i < 120; i++) A.step(t.w);
      G.rebuildMap(t.w);
      const alive = t.w.alive();
      t.check(alive.length > 20, `살아 있는 주민 ${alive.length}명`);
      t.check(t.w.events.length > ev0 + 50, `1년 동안 사건 ${t.w.events.length - ev0}건`);
      t.check(alive.every((n) => t.w.towns[n.town] && Number.isFinite(n.gold) && Number.isFinite(n.health)), "모든 주민의 마을·돈·체력이 정상이다");
      t.check(t.overlaps() === 0, "건물끼리 겹치거나 문이 막히지 않는다");
    } },
    { id: "save", name: "저장했다 불러와도 같다", run(t) {
      const json = t.w.serialize(), w2 = A.World.deserialize(json);
      t.check(w2.alive().length === t.w.alive().length && w2.day === t.w.day, `주민 ${w2.alive().length}명, ${w2.date()}`);
      t.check(JSON.stringify(w2.founded || []) === JSON.stringify(t.w.founded || []) && w2.player.name === t.p().name, "나라와 내 인물이 그대로다");
      t.check(json.length < 4.5e6, `저장 크기 ${(json.length / 1024).toFixed(0)}KB`);
    } },
    { id: "houses", name: "집은 사는 사람과 주인이 있는 자산이다", run(t) {
      const W = t.w, people = W.alive().filter((n) => n.controller !== "player" && !n.at_war);
      t.check(people.every((n) => n.house && W.assets[n.house] && W.assets[n.house].town === n.town), "모든 주민이 자기 마을의 집에 산다");
      const kids = people.filter((n) => !A.isAdult(n) && n.parents.some((p) => W.npcs[p].alive && W.npcs[p].town === n.town && !W.npcs[p].at_war));
      t.check(kids.every((c) => c.parents.some((p) => W.npcs[p].house === c.house)), `아이 ${kids.length}명은 부모와 같은 집에서 자란다`);
      const bd = G.MAP.buildings.find((b) => b.town === t.town() && b.kind === "house" && G.residentsOf(W, b).length);
      t.check(bd && G.residentsOf(W, bd).every((n) => n.house === A.houseId(bd.town, bd.hid)), "집 안 사람들 = 그 집에 사는 사람들");
      // 이사: 배우자와 어린 자녀가 함께 새 마을의 집으로
      const mover = people.find((n) => n.spouse !== null && W.npcs[n.spouse].alive && W.npcs[n.spouse].town === n.town && !W.npcs[n.spouse].at_war);
      if (mover) {
        const dest = Object.values(W.towns).find((x) => x.id !== mover.town && !x.fallen), sp = W.npcs[mover.spouse];
        W.move(mover, dest.id);
        t.check(W.assets[mover.house].town === dest.id && sp.house === mover.house, `${mover.name} 부부가 ${dest.name}의 한 집으로 이사했다`);
      }
      // 주인이 죽으면 같은 집 어른에게
      const a = Object.values(W.assets).find((x) => x.owner !== null && W.npcs[x.owner].alive && W.npcs[x.owner].controller !== "player" && W.alive().some((m) => m.house === x.id && m.id !== x.owner && A.isAdult(m)));
      if (a) {
        const old = W.npcs[a.owner]; W.die(old, "시험 삼아", {});
        const ev = W.lifeOf(a.owner).filter((e) => e.kind === "inherit").pop();
        t.check(a.owner !== old.id && W.npcs[a.owner].house === a.id && ev && ev.data.asset === a.id, `${old.name}의 집을 ${W.npcs[a.owner].name}이 물려받았다`);
      }
      const w2 = A.World.deserialize(W.serialize());
      t.check(JSON.stringify(w2.assets) === JSON.stringify(W.assets) && w2.npcs.every((n, i) => n.house === W.npcs[i].house), "저장 뒤에도 집과 주인이 같다");
    } },
    { id: "persona", name: "소지품·도감·미션은 인물의 것, 밭은 세계의 것", run(t) {
      const W = t.w, p1 = t.p();
      G.give(W, "stone", 3); t.e().farm["1,1"] = { watered: -1, crop: null, owner: p1.id };
      t.check(p1.ext && p1.ext.inv.stone === 3 && W.land.farm["1,1"] && !W.land.inv, "가방은 인물에, 밭은 세계에 있다");
      // 새 삶: 이전 인물의 가방은 그 사람에게 남고, 새 인물은 빈손. 밭은 그대로
      p1.controller = "ai";
      G.newLife(W, { name: "다음 사람", race: "human", job: "farmer", town: t.town() });
      const p2 = t.p();
      t.check(p2 !== p1 && !t.e().inv.stone && p1.ext.inv.stone === 3 && W.land.farm["1,1"], "새 인물은 빈손, 이전 인물의 가방은 남는다");
      const json = W.serialize(), d = JSON.parse(json);
      t.check(!("ext" in d) && d.land && d.npcs[p1.id].ext.inv.stone === 3, "저장 파일에 ext 덩어리가 없고, 인물마다 자기 것을 가진다");
      const w2 = A.World.deserialize(json); G.setup(w2);
      t.check(w2.npcs[p1.id].ext.inv.stone === 3 && G.ext(w2).farm["1,1"] && w2.player.id === p2.id, "불러와도 그대로");
      // 옛 형식(v5): 한 덩어리 ext
      const old = JSON.parse(json); old.ext = { ...old.land, ...old.session, ...old.npcs[p2.id].ext, inv: { apple: 2 } }; delete old.land; delete old.session; delete old.npcs[p2.id].ext; old.version = 5;
      const w3 = A.World.deserialize(old); G.setup(w3);
      t.check(w3.player.ext.inv.apple === 2 && w3.land.farm["1,1"] && w3.session.facing, "옛 저장의 ext가 인물·세계·화면으로 나뉜다");
    } },
    { id: "works", name: "직업의 업무는 단계(조작 부품)로 이뤄지고, 주민도 같은 단계를 거친다", run(t) {
      const W = t.w, p = t.p(), fields = t.placeOf("fields"), market = t.placeOf("market");
      A.setJob(p, "farmer"); t.standAt(fields.x, fields.y);
      const fm = G.buildingMenu(W, fields), ids = fm.map((v) => v.id);
      t.check(ids.length === new Set(ids).size && fm.filter((v) => v.work).length === 2 && fm.some((v) => v.id === "wk:tend_field"), `밭의 일: ${fm.filter((v) => v.work).map((v) => v.label).join(", ")}`);
      p.energy = 100; const g0 = p.gold, r0 = G.doBuilding(W, fields, "work");
      t.check(p.gold > g0, `예전 이름(work)으로도 일한다: ${r0.text}`);
      // 빵 굽기: 계량 → 반죽 → 발효 → 굽기
      A.setJob(p, "baker"); t.standAt(market.x, market.y); p.energy = 100;
      const bake = A.worksOf("baker").find((x) => x.id === "bake");
      t.check(bake.steps.map((s) => s.name).join("·") === "계량·반죽·발효·굽기" && G.workReady(bake), "빵 굽기는 네 단계, 모든 조작 부품이 준비됨");
      t.check(!G.buildingMenu(W, market).find((v) => v.id === "wk:bake").ok, "밀이 없으면 빵을 못 굽는다");
      G.give(W, "wheat", 2);
      t.check(!!G.doBuilding(W, market, "wk:bake").sim, "메뉴에서 고르면 조작 화면이 열린다");
      let b0 = t.e().inv.bread || 0, r = G.finishWork(W, market, "bake", [1, 1, 0.95, 1]);
      t.check((t.e().inv.bread || 0) - b0 === 5 && W.events.some((e) => e && e.kind === "masterwork" && e.actor === p.id), `잘하면 걸작: ${r.text}`);
      G.give(W, "wheat", 2); b0 = t.e().inv.bread || 0; r = G.finishWork(W, market, "bake", [0.5, 0.5, 0.5, 0.5]);
      t.check((t.e().inv.bread || 0) - b0 === 3, `보통이면 보통: ${r.text}`);
      G.give(W, "wheat", 2); b0 = t.e().inv.bread || 0; r = G.finishWork(W, market, "bake", null);
      t.check((t.e().inv.bread || 0) > b0 && /손에 익은 대로/.test(r.text), `맡기기: ${r.text}`);
      t.check(A.skillOf(p, "baking").xp > 0 && t.e().works.bake.n === 3, "굽는 만큼 제빵 솜씨가 쌓이고 기록된다");
      // 주민도 같은 단계를 솜씨대로 거친다
      const nb = W.spawn(t.town(), { race: "human", job: "baker", ageYears: 30 });
      for (let i = 0; i < 5; i++) A._.rWork(nb, W);
      t.check(nb.lastWork && nb.lastWork.id === "bake" && nb.lastWork.q >= 0 && A.skillOf(nb, "baking").xp >= 5, `주민 빵집 주인의 오늘 빵: 품질 ${nb.lastWork && nb.lastWork.q}`);
      // 팩으로 더한 직업(세공사): 데이터만으로 업무가 준비되고, 원석을 보석으로 다듬는다
      const jw = A.JOBS.jeweler;
      t.check(jw && G.jobReady(jw) && A.worksOf("jeweler").every((x) => G.workReady(x)) && !A.worksOf("jeweler").some((x) => x.sim === "shift"), "세공사: 기본 일 없이 업무만으로 열린다");
      A.setJob(p, "jeweler"); t.standAt(market.x, market.y); p.energy = 100; G.give(W, "rough_gem", 1);
      r = G.finishWork(W, market, "cut_gem", [0.8, 0.7, 0.75]);
      t.check((t.e().inv.gem || 0) >= 1 && A.knows(p, "gemcraft"), r.text);
      // 준비되지 않은 업무만 있는 직업은 열리지 않는다
      A.extend({ jobs: [{ id: "test_glass", name: "유리공", income: [1, 2], entry_cost: 0, weight: 0, workplace: "market", shift: false }],
        works: [{ id: "test_blow", job: "test_glass", name: "유리 불기", steps: [{ name: "불기", tool: "test_breath" }], gives: { stone: 1 } }] });
      W.jobsOpen = [...(W.jobsOpen || []), "test_glass"];
      t.check(!G.jobReady(A.JOBS.test_glass) && !G.buildingMenu(W, market).some((v) => v.id === "job:test_glass"), "조작 부품이 없는 직업은 아직 열리지 않는다");
      A.registerTool("test_breath", () => 0.5); G.registerHand("test_breath", { name: "불기", how: "", play: () => () => {} });
      t.check(G.jobReady(A.JOBS.test_glass) && G.buildingMenu(W, market).some((v) => v.id === "job:test_glass"), "부품의 자동 모델과 조작 화면이 생기자 열린다");
      A.CONTENT.jobs = A.CONTENT.jobs.filter((x) => x.id !== "test_glass"); A.CONTENT.works = A.CONTENT.works.filter((x) => x.id !== "test_blow"); A.extend({});
      delete A.TOOL_AUTO.test_breath; delete G.HANDS.test_breath; W.jobsOpen = W.jobsOpen.filter((x) => x !== "test_glass");
    } },
    { id: "genesis", name: "용족이 오고 용언을 아는 사람이 있으면, 이 세계에 용언 통역가가 생긴다", run(t) {
      const W = t.w, town = t.town();
      // 이 세계에 저절로 생겨 있었다면 걷어 내고 시작한다
      W.defs.jobs = W.defs.jobs.filter((j) => j.id !== "w_dragon_tongue"); W.defs.works = W.defs.works.filter((x) => x.job !== "w_dragon_tongue"); A.applyDefs(W);
      for (const n of W.npcs) if (n.job === "w_dragon_tongue") { n.job = "farmer"; n.pioneer = null; }
      t.check(!A.JOBS.w_dragon_tongue, "처음엔 그런 직업이 없다");
      for (const n of W.alive()) if (n.race === "dragonkin") n.health = 0; W.npcs.forEach((n) => { if (n.race === "dragonkin") n.alive = false; }); // 이 시험에선 용족이 처음 온다
      const sage0 = W.spawn(town, { race: "human", job: "merchant", ageYears: 40 }); sage0.traits.ambition = 0.99; A.learn(sage0, "dragon_tongue");
      W.day = W.day - (W.day % 5) + 2; A.genesis(W, true);
      t.check(!A.JOBS.w_dragon_tongue, "용족이 없으면 수요가 없다");
      const dks = [0, 1].map(() => W.spawn(town, { race: "dragonkin", job: "adventurer", ageYears: 120 })); if (!W.racesSeen.includes("dragonkin")) W.racesSeen.push("dragonkin");
      t.check(dks.every((d) => A.knows(d, "dragon_tongue")), "용족은 태어날 때부터 용의 언어를 안다");
      A.genesis(W, true);
      const sage = W.npcs.find((n) => n.pioneer === "w_dragon_tongue") || sage0;
      const J = A.JOBS.w_dragon_tongue, wk = A.worksOf("w_dragon_tongue")[0];
      t.check(J && J.name === "용언 통역가" && sage.job === J.id, `새 직업: ${J && J.name}, 첫 사람 ${sage.name}`);
      t.check(W.events.some((e) => e && e.kind === "job_born" && e.data && e.data.gen), W.events.filter((e) => e && e.kind === "job_born").pop().text);
      t.check(wk && wk.client === "race:dragonkin" && wk.steps.every((s) => (A.TOOL_DOMAINS[s.tool] || []).includes("language")) && G.workReady(wk), `업무 ‘${wk.name}’: ${wk.steps.map((s) => s.name).join(" → ")}`);
      // 처음 연 사람은 꿈이나 더 나은 벌이가 보여도 떠나지 않는다
      sage.gold = 999; sage.dream = { id: "rich", job: "baker", since: W.day }; sage.job_cooldown = 0;
      t.check(A._.betterJob(sage, W) === null || A._.betterJob(sage, W).id === "farmer", "개척자는 자기 일을 떠나지 않는다 (흉년에 밭으로 가는 것만 예외)");
      sage.dream = null;
      // 주민 통역가가 일하면 용족과 마을 사람들 사이가 가까워진다
      const dk = W.npcs.filter((n) => n.alive && n.race === "dragonkin" && n.id !== sage.id), other = W.residents(sage.town).find((n) => n.race !== "dragonkin" && n !== sage);
      const before = other ? (other.rel[dk[0].id] || 0) : 0;
      for (let i = 0; i < 6; i++) A._.rWork(sage, W);
      t.check(other && (other.rel[dk[0].id] || 0) > before, `${other && other.name}의 용족을 향한 마음 ${before} → ${other && other.rel[dk[0].id]}`);
      // 플레이어도 용언을 알면 이 일을 할 수 있다 (여관에서)
      const p = t.p(); A.learn(p, "dragon_tongue"); A.setJob(p, J.id); const inn = t.placeOf("inn"); t.standAt(inn.x, inn.y); p.energy = 100;
      const m = G.buildingMenu(W, inn).find((v) => v.id === "wk:" + wk.id);
      t.check(m && m.ok && m.client && m.client.race === "dragonkin", `여관 메뉴: ${m && m.label} (${m && m.hint})`);
      const r = G.finishWork(W, inn, wk.id, [0.9, 0.9, 0.9]); t.check(/금화/.test(r.text), r.text);
      // 이 세계에 저장되고, 다른 세계엔 없다
      const w2 = A.World.deserialize(JSON.parse(W.serialize()));
      t.check(A.JOBS.w_dragon_tongue && w2.npcs[sage.id].job === "w_dragon_tongue", "불러와도 남아 있다");
      // 다른 지식의 수요: 전쟁이 나면 룬을 아는 사람이 일을 얻는다
      const rk = W.spawn(town, { race: "dwarf", job: "blacksmith", ageYears: 60 }); A.learn(rk, "rune"); W.war = W.war || {}; const wasWar = W.war.active; W.war.active = true;
      A.genesis(W, true); t.check(A.JOBS.w_rune && A.JOBS.w_rune.name === "룬 술사" && G.jobReady(A.JOBS.w_rune), `전쟁 중 룬: ${A.JOBS.w_rune && A.JOBS.w_rune.name}`); W.war.active = wasWar;
      A.newWorld(99, "다른 세계");
      t.check(!A.JOBS.w_dragon_tongue, "새 세계에는 없다");
      A.applyDefs(W);
    } },
    { id: "lifeknow", name: "겪은 삶에서 지식이 태어나고, 수요가 맞으면 직업이 된다", run(t) {
      const W = t.w, K = A.KNOW("field_surgery"), p0 = K.born.p;
      for (const n of W.alive()) if (A.knows(n, "field_surgery")) delete n.skills.field_surgery;
      W.defs.jobs = W.defs.jobs.filter((j) => j.id !== "w_field_surgery"); W.defs.works = W.defs.works.filter((x) => x.job !== "w_field_surgery"); A.applyDefs(W);
      for (const n of W.npcs) if (n.job === "w_field_surgery") { n.job = "farmer"; n.pioneer = null; }
      const vet = W.spawn(t.town(), { race: "human", job: "merchant", ageYears: 35 }); vet.flags.add("veteran");
      for (const n of W.alive()) if (n !== vet) n.flags.delete("veteran");
      K.born.p = 1; A.knowledgeBirth(W); K.born.p = p0;
      t.check(A.knows(vet, "field_surgery"), W.events.filter((e) => e && e.kind === "discovery").pop().text);
      W.war = W.war || {}; const was = W.war.active; W.war.active = true; W.day = W.day - (W.day % 5) + 2;
      const cook = W.spawn(t.town(), { race: "human", job: "cook", ageYears: 35 }); A.learn(cook, "field_surgery"); cook.traits.ambition = 1; vet.traits.ambition = 0;
      const tw = W.towns[cook.town], f0 = tw.food; tw.food = 0; // 곳간이 빠듯하면 먹을 것을 만드는 사람은 새 직업을 열지 않는다
      for (const k of A.CONTENT.knowledge) if (k.id !== "field_surgery" && k.demand) k._d = k.demand, k.demand = null;
      A.genesis(W, true); W.war.active = was; tw.food = f0;
      for (const k of A.CONTENT.knowledge) if (k._d) k.demand = k._d, delete k._d;
      t.check(cook.job === "cook", "곳간이 빠듯할 때 요리사는 자기 일을 지킨다");
      const J = A.JOBS.w_field_surgery, wk = A.worksOf("w_field_surgery")[0];
      t.check(J && J.name === "야전 의원" && vet.job === J.id && wk.client === "sick" && wk.effects.heal, `전쟁 중 → ${J && J.name}: ‘${wk && wk.name}’ ${wk && wk.steps.map((s) => s.name).join("→")}`);
      // 모험가는 유적에서 두루마리를 찾아 잊힌 지식을 세상에 내놓는다
      const adv = W.spawn(t.town(), { race: "human", job: "adventurer", ageYears: 30 }); const r0 = W.rng.next;
      let found = false; for (let i = 0; i < 3000 && !found; i++) { adv.health = 10; A._.rWork(adv, W); found = ["rune", "elixir", "medicine", "dragon_tongue"].some((k) => A.knows(adv, k)); }
      t.check(found, found ? W.events.filter((e) => e && e.kind === "discovery" && e.actor === adv.id).pop().text : "유적에서 아무것도 못 찾았다");
    } },
    { id: "joblife", name: "직업은 전문화되고, 사라졌다가 되살아나며, 한 사람이 부업을 가진다", run(t) {
      const W = t.w, town = t.town();
      // 전문화: 숙련 대장장이가 셋 이상이면 한 가지 업무만 하는 전문 직업이 갈라진다
      const smiths = [0, 1, 2, 3].map(() => { const n = W.spawn(town, { race: "dwarf", job: "blacksmith", ageYears: 60 }); A.addXp(n, "smithing", 900); return n; });
      const r0 = W.rng.next; W.rng.next = () => 0.01; W.day = W.day - (W.day % 30) + 7; A.jobLife(W); W.rng.next = r0;
      const sev = W.events.filter((e) => e && e.data && e.data.spec).pop(), spec = sev && A.JOBS[sev.data.job], who = sev && W.npcs[sev.actor];
      t.check(spec && spec.spec === "blacksmith" && A.worksOf(spec.id).length === 1 && who.job === spec.id && who.side === "blacksmith", sev ? sev.text : "전문화 없음");
      t.check(spec && A.worksOf(spec.id)[0].steps.every((s) => s.p.hard < 0), "전문 직업은 단계가 수월하다");
      // 소멸과 부활: 아무도 없고 수요도 없이 2년이 지나면 사라진다
      const vet = W.spawn(town, { race: "human", job: "merchant", ageYears: 40 }); A.learn(vet, "field_surgery");
      W.war = W.war || {}; const was = W.war.active; W.war.active = true; W.day = W.day - (W.day % 5) + 2; A.genesis(W, true);
      const FS = A.JOBS.w_field_surgery;
      if (FS) {
        for (const n of W.npcs) if (n.job === FS.id) { n.job = "merchant"; n.pioneer = null; }
        W.war.active = false; W.jobSeen[FS.id] = W.day - 300; W.day = W.day - (W.day % 30) + 37; A.jobLife(W);
        t.check(!W.jobOpen(FS.id) && W.events.some((e) => e && e.kind === "job_gone" && e.data.job === FS.id), W.events.filter((e) => e && e.kind === "job_gone").pop().text);
        W.war.active = true; W.day += 30; A.jobLife(W);
        t.check(W.jobOpen(FS.id), W.events.filter((e) => e && e.kind === "job_revived").pop().text);
      }
      W.war.active = was;
      // 부업: 손에 익은 옛 일은 직업을 바꿔도 부업으로 남는다
      const b = W.spawn(town, { race: "human", job: "baker", ageYears: 40 }); A.addXp(b, "baking", 300); b.gold = 500; b.job_cooldown = 0;
      const j = W.openJobs().find((x) => x.entry_cost > 0 && x.id !== "baker" && !x.needKnow && !x.food) || A.JOBS.merchant;
      A.addXp(b, "baking", 600); b.dream = { id: "rich", job: j.id, since: W.day }; const rr = W.rng.next; W.rng.next = () => 0.1; A._.rJob(b, W); W.rng.next = rr;
      if (b.job !== "baker") t.check(b.side === "baker", `${b.name}: ${A.JOBS[b.job].name}${A.jo(A.JOBS[b.job].name, "이/가").slice(A.JOBS[b.job].name.length)} 되었지만 빵 굽기는 부업으로`);
      // 플레이어도 아는 기술로 부업을 삼는다
      const p = t.p(); A.setJob(p, "farmer"); A.learn(p, "baking"); const m = t.placeOf("market"); t.standAt(m.x, m.y);
      const sideOpt = G.buildingMenu(W, m).find((v) => v.id === "side:baker");
      t.check(!!sideOpt, "제빵을 알면 시장에서 빵집 일을 부업으로 삼을 수 있다");
      G.doBuilding(W, m, "side:baker"); G.give(W, "wheat", 2);
      t.check(p.side === "baker" && G.buildingMenu(W, m).some((v) => v.id === "wk:bake" && v.ok), "부업의 업무(빵 굽기)가 메뉴에 나온다");
      // 빠졌던 업무: 농부의 밭 가꾸기, 경비병 순찰, 용병 호위 (피하고 받아치기)
      for (const id of ["tend_field", "patrol", "escort"]) { const wk = A.CONTENT.works.find((x) => x.id === id); t.check(wk && G.workReady({ ...wk, sim: "steps" }), `${wk.name}: ${wk.steps.map((s) => s.name).join(" → ")}`); }
    } },
    { id: "endless", name: "경험에서 지식과 직업이, 혼혈·땅·마력에서 종족이 끝없이 생긴다", run(t) {
      const W = t.w, town = t.town(), r0 = W.rng.next;
      // 자기 일이 원래 쌓는 경험은 숙련일 뿐: 농부의 '곡식 기르기'는 새 지식이 되지 않는다
      const f = W.spawn(town, { race: "human", job: "farmer", ageYears: 40 }); for (const n of W.alive()) if (n !== f) delete n.exp; f.exp = { "nature:grain": 500 };
      W.rng.next = () => 0.001; A.experienceBirth(W); W.rng.next = r0;
      t.check(!A.knows(f, "x_nature_grain"), "농부가 곡식을 기르는 건 새 지식이 아니다");
      // 일 밖의 경험(전장에서 짐승을 몰던 경험)은 새 지식이 된다
      f.exp = { "body:beast": 500 }; W.rng.next = () => 0.001; A.experienceBirth(W); W.rng.next = r0;
      const K = A.KNOW("x_body_beast");
      t.check(A.knows(f, "x_body_beast") && K.name === "짐승 몰기" && K.jobName === "사냥꾼", W.events.filter((e) => e && e.kind === "discovery").pop().text);
      // 그 지식은 수요가 맞으면 직업이 된다 (함수 없는 정의가 w.defs에 저장)
      f.traits.ambition = 1; const tw = W.towns[f.town]; tw.food = 9999; tw.worry = false; W.lastGenesis = -999;
      for (const k of A.CONTENT.knowledge) if (k.id !== "x_body_beast" && k.demand) k._d = k.demand, k.demand = null;
      A.genesis(W, true); for (const k of A.CONTENT.knowledge) if (k._d) k.demand = k._d, delete k._d;
      t.check(A.JOBS.w_x_body_beast && f.job === "w_x_body_beast", `새 직업: ${A.JOBS.w_x_body_beast && A.JOBS.w_x_body_beast.name} (${A.worksOf("w_x_body_beast").map((x) => x.name + ": " + x.steps.map((s) => s.name).join("→")).join("")})`);
      // 혼혈이 굳어 새 종족이 된다
      const mixed = [0, 1, 2, 3].map(() => { const n = W.spawn(town, { race: "human", job: "merchant", ageYears: 20 }); n.heritage = { human: 0.5, dwarf: 0.5 }; n.birthplace.day = 0; return n; });
      for (const r of A.CONTENT.races) if (r.mix && r.mix.includes("human") && r.mix.includes("dwarf") && r.gen) r.mix = null;
      W.day = W.day - (W.day % 30) + 17; W.rng.next = () => 0.5; A.raceLife(W); W.rng.next = r0;
      const R = A.RACES[mixed[0].race];
      t.check(R && R.gen && R.mix && mixed.every((n) => n.race === R.id) && A.knows(mixed[0], "lang_" + R.id), W.events.filter((e) => e && e.kind === "race_born").pop().text + ` [${R && R.name} gen ${R && R.gen} mix ${R && R.mix} races ${mixed.map((n) => n.race)} lang ${R && A.knows(mixed[0], "lang_" + R.id)}]`);
      // 마력의 폭풍
      const before = A.CONTENT.races.length;
      for (let tries = 0; tries < 12 && A.CONTENT.races.length === before; tries++) { let k = 0; W.rng.next = () => (k++ === 0 ? 0.0001 : ((k * 0.37 + tries * 0.13) % 1)); W.day += 1; A.raceLife(W); }
      W.rng.next = r0;
      t.check(A.CONTENT.races.length > before, W.events.filter((e) => e && e.kind === "race_born").pop().text);
      // 저장해도 남고, 다른 세계엔 없다
      const w2 = A.World.deserialize(JSON.parse(W.serialize()));
      t.check(A.RACES[R.id] && w2.npcs[mixed[0].id].race === R.id && A.KNOW("x_body_beast").jobName === "사냥꾼", "불러와도 새 종족·지식·직업이 남는다");
      A.newWorld(55, "다른 세계"); t.check(!A.RACES[R.id] && !A.JOBS.w_x_body_beast, "다른 세계엔 없다"); A.applyDefs(W);
      // 문화: 새 종족은 귀하게 여기는 것과 잔치를 갖고, 늘어나면 자기 나라를 세운다
      t.check(R.culture && R.culture.value && R.culture.festival.name, `${R.name}의 문화: ${R.culture.value} · ${R.culture.festival.season} ‘${R.culture.festival.name}’ · 나라 꼴 ${R.culture.nationKind}`);
      const more = [0, 1, 2, 3].map(() => { const n = W.spawn(town, { race: "human", job: "merchant", ageYears: 30 }); n.race = R.id; return n; }); more[0].traits.ambition = 1;
      W.day = W.day - (W.day % 30) + 17; W.rng.next = () => 0.1; A.raceLife(W); W.rng.next = r0;
      const RN = Object.values(W.nations).find((x) => x.race === R.id);
      t.check(RN && RN.name.includes(R.culture.nationKind), RN ? `${RN.name} (${R.name}의 나라)` : "나라 없음");
      // 사라짐: 마지막 한 사람이 죽으면
      for (const n of W.npcs) if (n.race === R.id) n.alive = false;
      W.day = W.day - (W.day % 30) + 47; A.raceLife(W);
      t.check(W.events.some((e) => e && e.kind === "race_gone" && e.data.species === R.id), W.events.filter((e) => e && e.kind === "race_gone").pop().text);
    } },
    { id: "farming", name: "굶주림을 겪은 마을은 농법을 깨치고, 농법은 수확을 늘리고 퍼진다", run(t) {
      const W = t.w, T = W.towns[t.town()], r0 = W.rng.next;
      for (const x of Object.values(W.towns)) x.agri = { ids: [], breed: 0 };
      const f = W.spawn(T.id, { race: "human", job: "farmer", ageYears: 50 }); A.addXp(f, "farming", 900); f.traits.ambition = 1;
      W.record("food_worry", "시험: 겨울 걱정", { town: T.id, imp: 1 }); W.record("granary_open", "시험: 곳간", { town: T.id, imp: 1 });
      const m0 = A.farmMult(T); W.day = W.day - (W.day % 30) + 23; W.rng.next = () => 0.01; A.agriLife(W); W.rng.next = r0;
      t.check(T.agri.ids.includes("rotation") && A.farmMult(T) > m0, W.events.filter((e) => e && e.kind === "farm_new").pop().text + ` (수확 ×${A.farmMult(T).toFixed(2)})`);
      const f0 = T.food; A._.rWork(f, W); const gain = T.food - f0;
      T.agri.ids = []; const f1 = T.food; A._.rWork(f, W); const base = T.food - f1; T.agri.ids = ["rotation"];
      t.check(W.harvestMult() === 0 || gain > base, `농법이 있으면 더 거둔다 (${gain.toFixed(2)} > ${base.toFixed(2)})`);
      // 가까운 마을로 퍼진다
      const near = Object.values(W.towns).find((u) => u !== T && !u.fallen && Math.hypot(u.x - T.x, u.y - T.y) <= 60);
      if (near) { W.rng.next = () => 0.01; W.day += 30; A.agriLife(W); W.rng.next = r0; t.check(near.agri.ids.includes("rotation"), W.events.filter((e) => e && e.kind === "farm_spread").pop().text); }
      // 정해진 농법을 다 익히면 품종 개량이 끝없이 이어진다
      T.agri.ids = A.CONTENT.innovations.map((x) => x.id); const b0 = T.agri.breed || 0; W.rng.next = () => 0.01; W.day += 30; A.agriLife(W); W.rng.next = r0;
      t.check(T.agri.breed > b0, W.events.filter((e) => e && e.kind === "farm_new").pop().text);
      const w2 = A.World.deserialize(JSON.parse(W.serialize())); t.check(w2.towns[T.id].agri.ids.length === T.agri.ids.length, "농법이 저장된다");
    } },
    { id: "jobmake", name: "플레이어가 직업과 업무를 짜서 이 세계에 등록한다", run(t) {
      const W = t.w, p = t.p(), guild = t.placeOf("guild"); t.standAt(guild.x, guild.y);
      A.setJob(p, "farmer"); p.gold = 60;
      t.check(G.buildingMenu(W, guild).some((v) => v.id === "jobmake" && v.ok), "길드에서 ‘새 직업 만들기’");
      t.check(!!G.doBuilding(W, guild, "jobmake").jobmake, "고르면 직업 만들기 창이 열린다");
      const d = G.jobDraft(W, null);
      t.check(G.checkJobDraft(W, d).length >= 2, `빈 초안은 등록할 수 없다: ${G.checkJobDraft(W, d).join(" / ")}`);
      Object.assign(d, { name: "바구니 장인", skill: "weaving", place: "market", hat: "straw", prop: "basket" });
      Object.assign(d.work, { name: "큰 바구니 짜기", mins: 120, kind: "make", needs: { fiber: 2 }, gives: { gem: 3 } });
      d.work.steps = [{ name: "풀 고르기", tool: "observe", level: 0 }, { name: "엮기", tool: "rhythm", level: 1 }, { name: "마무리", tool: "trace", level: 2 }];
      t.check(G.checkJobDraft(W, d).some((x) => /넘는다/.test(x)), "풀섬유로 보석을 만드는 일은 균형 규칙에 걸린다");
      const dB = G.jobDraft(W, null); Object.assign(dB, { name: "밀빵 장수", skill: "weaving" }); Object.assign(dB.work, { name: "밀빵 굽기", mins: 240, kind: "make", needs: { wheat: 4 }, gives: { bread: 2 } });
      t.check(G.checkJobDraft(W, dB).some((x) => /빵집 주인/.test(x)), `이미 있는 일은 새 직업이 못 된다: ${G.checkJobDraft(W, dB).find((x) => /이미/.test(x))}`);
      const dH = G.jobDraft(W, null); Object.assign(dH, { name: "약손", skill: "weaving" }); Object.assign(dH.work, { name: "아픈 데 만지기", kind: "serve", serve: "heal" });
      const healer = G.sameWork(W, G.draftWork(dH, "draft", "draft"));
      if (healer) t.check(G.checkJobDraft(W, dH).some((x) => x.includes(healer.job.name)), `아픈 사람 돌보기는 ‘${healer.job.name}’${"이/가"} 이미 하는 일`);
      else t.check(!G.checkJobDraft(W, dH).some((x) => /이미/.test(x)), "돌보는 직업이 아직 없는 세계라면 처음 나오는 일");
      d.work.gives = { basket: 1 }; d.work.needs = { fiber: 8 }; d.work.mins = 240;
      t.check(G.checkJobDraft(W, d).length === 0, `규칙을 지키면 통과: ${G.checkJobDraft(W, d).join(" / ") || "문제 없음"}`);
      const wkTry = G.draftWork(d, "draft", "draft");
      t.check(wkTry.steps.length === 3 && wkTry.steps[2].p.hard > 0 && G.workReady({ ...wkTry, sim: "steps" }), "시험용 업무가 만들어진다");
      const r = G.createJob(W, d), J = r.job;
      t.check(r.ok && A.JOBS[J.id] && p.job === J.id && p.gold === 40 && J.creator === p.id, r.text);
      t.check(J.look.hat === "straw" && J.look.prop === "basket", "모자와 손에 든 것이 직업 그림에 남는다");
      const born = W.events.filter((e) => e && e.kind === "job_born" && e.data && e.data.made).pop();
      t.check(!!born, born ? born.text : "소식 없음");
      const market = t.placeOf("market"); t.standAt(market.x, market.y); p.energy = 100; G.give(W, "fiber", 8);
      const m = G.buildingMenu(W, market).find((v) => v.id === "wk:" + J.id + "_w1");
      t.check(m && m.ok, `시장 메뉴에 내 업무: ${m && m.label}`);
      const b0 = t.e().inv.basket || 0, r2 = G.finishWork(W, market, J.id + "_w1", [0.6, 0.6, 0.6]);
      t.check((t.e().inv.basket || 0) > b0, r2.text);
      // 내 직업에 봉사하는 업무를 더한다
      t.standAt(guild.x, guild.y);
      t.check(G.buildingMenu(W, guild).some((v) => v.id === "jobmake" && /업무 더하기/.test(v.label)), "내가 만든 직업이면 ‘업무 더하기’");
      const d2 = G.jobDraft(W, p.job); Object.assign(d2.work, { name: "바구니 고쳐 주기", mins: 60, kind: "serve", serve: "pay" }); d2.work.steps = [{ name: "말 걸기", tool: "talk", level: 1 }];
      const r3 = G.createJob(W, d2);
      t.check(r3.ok && A.worksOf(J.id).length === 2 && A.worksOf(J.id)[1].effects.gold, r3.text);
      t.check(W.openJobs().some((j) => j.id === J.id) && J.needKnow === "weaving", "짜기를 아는 주민도 이 직업으로 옮겨 올 수 있다");
      const dC = G.jobDraft(W, null); dC.addTo = null; Object.assign(dC, { name: "광주리 장인", skill: "weaving" }); Object.assign(dC.work, { name: "광주리 짜기", mins: 240, kind: "make", needs: { fiber: 8 }, gives: { basket: 1 } });
      t.check(G.checkJobDraft(W, dC).some((x) => /바구니 장인/.test(x)), "내가 만든 직업과 같은 일도 다시 새 직업이 될 수 없다");
      const w2 = A.World.deserialize(JSON.parse(W.serialize()));
      t.check(A.JOBS[J.id] && A.worksOf(J.id).length === 2 && w2.npcs[p.id].job === J.id, "불러와도 남아 있다");
      A.newWorld(77, "다른 세계"); t.check(!A.JOBS[J.id], "다른 세계에는 없다"); A.applyDefs(W);
    } },
    { id: "granary", name: "가을에 비축하고, 모자라면 곳간을 열고, 이웃 마을이 돕는다", run(t) {
      const W = t.w, ts = Object.values(W.towns).filter((x) => !x.fallen), a = ts[0], pop = (x) => Math.max(1, W.residents(x.id).length);
      while (W.season !== "가을") G.tick(W, 24 * 60);
      a.food = pop(a) * 40; a.store = 0; G.tick(W, 24 * 60);
      t.check(a.store > 0, `가을에 남는 식량을 곳간에 쌓았다 (${Math.round(a.store)})`);
      a.food = 0; a.store = pop(a) * 10; a.storeOpen = false; G.tick(W, 24 * 60);
      t.check(W.events.some((e) => e && e.kind === "granary_open" && e.town === a.id), "곳간을 열었다는 소식");
      const b = ts.find((x) => x !== a && x.nation === a.nation) || ts[1];
      for (const x of ts) if (x !== a) x.food = pop(x) * 25;
      a.food = 0; a.store = 0; a.aidDay = null; A._.granaries(W, ts, Object.fromEntries(ts.map((x) => [x.id, pop(x)])));
      const aid = W.events.filter((e) => e && e.kind === "food_aid" && e.data.to === a.id).pop();
      t.check(aid && W.towns[aid.data.from].nation === a.nation || (aid && !ts.some((x) => x !== a && x.nation === a.nation)), aid ? aid.text : "지원 없음");
      // 걱정이 든 마을의 농부는 밭을 떠나지 않는다
      const f = W.residents(a.id, true).find((n) => n.job === "farmer" && n.controller !== "player");
      if (f) { a.worry = true; f.gold = 999; f.dream = null; t.check(A._.betterJob(f, W) === null, `${f.name}은 겨울 걱정에 밭에 남는다`); }
      const w2 = A.World.deserialize(JSON.parse(W.serialize()));
      t.check(Math.abs(w2.towns[a.id].store - a.store) < 1e-6, "곳간 비축이 저장된다");
    } },
    { id: "skills", name: "기술은 사람에게 남고, 일할수록 솜씨가 는다", run(t) {
      const W = t.w, smith = W.spawn(t.town(), { race: "human", job: "blacksmith", ageYears: 30 });
      t.check(A.knows(smith, "woodwork") && A.knows(smith, "farming_tools"), "대장장이는 목공·농기구 만들기를 안다");
      t.check(smith.skills.woodwork.from === "job", "직업으로 익힌 기술은 출처가 직업이다 (소문처럼 퍼지지 않음)");
      A.setJob(smith, "merchant");
      t.check(A.knows(smith, "woodwork") && A.knows(smith, "weaving"), "상인이 되어도 목공을 잊지 않고, 짜기를 새로 익힌다");
      const before = A.mastery(smith);
      for (let i = 0; i < 130; i++) A._.rWork(smith, W);
      t.check(A.skillLv(smith, "weaving") === 2 && A.mastery(smith) > before, `130일 일하니 짜기 ${A.SKILL_LV_NAME[A.skillLv(smith, "weaving")]}`);
      // 옛 저장(v7): n.know와 ext.stats → n.skills
      const d = JSON.parse(W.serialize()), pd = d.npcs[t.p().id];
      for (const n of d.npcs) { n.know = Object.keys(n.skills).filter((k) => n.skills[k].lv >= 1 && !((A.JOBS[n.job].teaches || []).includes(k))); delete n.skills; }
      pd.know = ["rune"]; pd.ext = { ...(pd.ext || {}), stats: { fiber: 7 } }; d.version = 7;
      const w2 = A.World.deserialize(d), p2 = w2.npcs[t.p().id], s2 = w2.npcs[smith.id];
      t.check(A.knows(p2, "rune") && A.skillOf(p2, "weaving") && A.skillOf(p2, "weaving").xp >= 7 && !(p2.ext || {}).stats, "옛 지식·혼자 익히던 횟수가 기술로 옮겨졌다");
      t.check(A.knows(s2, "woodwork") && A.knows(s2, "weaving"), "옛 저장의 주민도 아는 것을 그대로 안다");
    } },
    { id: "lineage", name: "혈통·외형은 부모에게서, 성인 나이는 종족마다", run(t) {
      const W = t.w, born = W.npcs.filter((n) => n.parents.length === 2);
      const okH = born.every((c) => { const [a, b] = c.parents.map((i) => W.npcs[i]), want = A.blendHeritage(a, b); return Object.keys(want).every((k) => Math.abs((c.heritage[k] || 0) - want[k]) < 1e-6); });
      t.check(okH, `이 세계에서 태어난 ${born.length}명의 혈통 = 부모 평균`);
      t.check(born.every((c) => c.parents.some((i) => W.npcs[i].look.skin === c.look.skin) && c.parents.some((i) => W.npcs[i].look.eye === c.look.eye)), "피부와 눈빛은 부모 중 한 쪽을 닮는다");
      // 인간과 엘프 사이의 아이
      const hu = W.spawn(t.town(), { race: "human", ageYears: 30 }), el = W.spawn(t.town(), { race: "elf", ageYears: 80 });
      const mix = A.blendHeritage(hu, el);
      t.check(mix.human === 0.5 && mix.elf === 0.5, `혈통 ${JSON.stringify(mix)}`);
      // 엘프는 30살에 어른이 된다
      const kid = W.spawn(t.town(), { race: "elf", ageYears: 20 });
      t.check(!A.isAdult(kid) && A.adultAge("elf") === 30, "스무 살 엘프는 아직 아이다");
      kid.age_days = 30 * A.DPY - 1; G.tick(t.w, 48 * 60); // 오늘 태어난 아이는 내일부터 차례가 온다
      t.check(A.isAdult(kid) && W.lifeOf(kid.id).some((e) => e.kind === "adulthood"), "서른 살이 되자 어른이 되었다");
      // 옛 저장(v6): 외형·혈통 없음 → 예전 계산과 같은 외형, 예전 규칙(16살)대로 어른
      const d = JSON.parse(W.serialize()); for (const n of d.npcs) { delete n.look; delete n.heritage; delete n.grown; delete n.birthplace; delete n.culture; } d.version = 6;
      const w2 = A.World.deserialize(d), x = w2.npcs.find((n) => n.race === "elf" && A.age(n) >= 16 && A.age(n) < 30);
      t.check(w2.npcs.every((n, i) => n.look.skin === A.makeLook(W.npcs[i]).skin || n.parents.length), "옛 주민의 얼굴이 바뀌지 않는다");
      if (x) t.check(A.isAdult(x), `옛 저장의 ${A.age(x)}살 엘프는 그대로 어른`);
    } },
    { id: "records", name: "세계 식별자·사건 기록·옛 저장 이전", run(t) {
      t.check(typeof t.w.worldId === "string" && t.w.worldId.length > 6, `세계 식별자 ${t.w.worldId}`);
      // 직업을 바꾸면 이전·새 직업이 문장이 아니라 값으로 남는다
      const pl = t.placeOf("forge"), from = t.p().job; t.p().gold = 200;
      const r = pl ? G.doBuilding(t.w, pl, "job:blacksmith") : null;
      const ev = t.w.lifeOf(t.p().id).filter((e) => e.kind === "career").pop();
      t.check(ev && ev.data && ev.data.from === from && ev.data.to === "blacksmith", `직업 변경 기록: ${ev ? JSON.stringify(ev.data) : r && r.text}`);
      // 인물별 색인은 전체를 훑은 결과와 같다
      const n = t.npcs()[0], scan = t.w.events.filter((e) => e && (e.actor === n.id || e.target === n.id)).map((e) => e.id).join();
      t.check(t.w.lifeOf(n.id).map((e) => e.id).join() === scan, `생애 색인 ${t.w.lifeOf(n.id).length}건`);
      // 저장했다 불러와도 식별자·값·색인이 그대로
      const w2 = A.World.deserialize(t.w.serialize()), ev2 = ev && w2.events[ev.id];
      t.check(w2.worldId === t.w.worldId && ev2 && ev2.data && ev2.data.to === "blacksmith" && w2.lifeOf(n.id).length === t.w.lifeOf(n.id).length, "저장 뒤에도 식별자·사건 값·색인이 같다");
      // 옛 형식(v2: 식별자·data 없음)도 읽힌다
      // 옛 형식(v2: 식별자·data·나라 목록 없음, 마을의 나라는 이름 문자열)도 읽힌다
      const d = JSON.parse(t.w.serialize()), nm = (id) => A.nationName(t.w, id);
      delete d.worldId; delete d.nations; d.version = 2; d.events = d.events.map((e) => (Array.isArray(e) ? e.slice(0, 10) : e));
      for (const tw of Object.values(d.towns)) { tw.nation = nm(tw.nation); if (tw.indep) tw.indep.from = nm(tw.indep.from); }
      for (const f of d.founded || []) delete f.nation;
      // v4 이전: 집은 id 공식, 집 꾸밈은 houseStyle
      const styled = Object.values(t.w.assets)[0]; styled.style = { roof: "blue" };
      d.houseStyle = { [`${styled.town}:${styled.hid}`]: { roof: "blue" } }; delete d.assets; for (const n of d.npcs) delete n.house;
      const w3 = A.World.deserialize(d);
      t.check(w3.worldId && w3.worldId !== t.w.worldId && w3.npcs.length === t.w.npcs.length, `옛 저장 이전 → 새 식별자 ${w3.worldId}`);
      const names = (w) => Object.values(w.towns).map((x) => `${x.id}:${A.nationName(w, x.nation)}`).sort().join();
      t.check(names(w3) === names(t.w) && Object.values(w3.towns).every((x) => w3.nations[x.nation]), "옛 저장의 나라 이름이 id로 바뀌어도 마을마다 같은 나라다");
      const npc = w3.npcs.find((n) => n.alive && n.controller !== "player" && !n.at_war);
      t.check(npc.house === A.houseId(npc.town, 1 + (npc.id % 5)) && w3.assets[A.houseId(styled.town, styled.hid)].style.roof === "blue", "옛 저장의 집 배정과 집 꾸밈이 그대로 옮겨진다");
    } },
  ];

  /** 모든 점검을 돌린다. base: 지금 세계를 저장한 JSON. 끝나면 결과 목록을 돌려준다 */
  function runAll(base, only) {
    const out = [];
    for (const sc of SCENARIOS) {
      if (only && !only.includes(sc.id)) continue;
      const t0 = performance.now(), checks = [], notes = [];
      let error = null;
      try {
        const w = A.World.deserialize(base);
        G.setup(w);
        if (w.player && w.player.alive) w.player.controller = "ai"; // 원래 인물은 NPC로 돌리고
        G.newLife(w, { name: "테스터", race: "human", job: "farmer", town: Object.values(w.towns).find((x) => !x.fallen && !x.border).id });
        const t = { w, ...helpers(w), check: (ok, msg) => checks.push({ ok: !!ok, msg }), note: (msg) => notes.push(msg) };
        sc.run(t);
      } catch (e) { error = (e && e.stack) || String(e); }
      out.push({ id: sc.id, name: sc.name, ok: !error && checks.every((c) => c.ok), checks, notes, error, ms: Math.round(performance.now() - t0) });
    }
    return out;
  }

  root.AsteriaTest = { SCENARIOS, runAll };
})(typeof window !== "undefined" ? window : globalThis);
