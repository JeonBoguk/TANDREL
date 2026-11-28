/* 화면: HUD, 단축바, 메뉴줄, 대화창, 건물 메뉴, 창들, 입력, 저장. */
(() => {
"use strict";
const A = window.Asteria, G = window.Game, S = window.Story;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(3)) if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kids) { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); for (const k of kids.flat()) if (k !== null && k !== undefined) el.append(k.nodeType ? k : String(k)); return el; }
const jo = A.jo;
// 터치 화면(휴대폰·태블릿)이면 화면 위 조작 패드를 쓴다
const touchMode = (window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches) || (navigator.maxTouchPoints > 0 && Math.min(innerWidth, innerHeight) < 820);
const icon = (id, size) => window.itemIcon(id, size || 24); // 아이템 도트 아이콘 (render.js)
const jobColor = (id) => (A.JOBS[id] && A.JOBS[id].color) || "#8a8f9a";
const following = (id) => (G.ext(W).follow || []).includes(id);
function toggleFollow(id) { const e = G.ext(W); e.follow = e.follow || []; const i = e.follow.indexOf(id); if (i >= 0) e.follow.splice(i, 1); else e.follow.push(id); }

let W = null, view = null;
let speed = 1, obsRun = false, obsSpeed = 2;
let session = null, bmenu = null, win = null, winArg = null, epView = null;
let keys = new Set(), path = [], pathThen = null, carry = 0, lastT = performance.now(), sinceSave = 0, hudT = 0, miniT = 0, hereT = 0, hereOpen = true;
let bioId = null, graphSel = null, storyFilter = "all", godView = false, confirmKey = null, pSearch = "", pMode = "alive";
const AUTO_KEY = "asteria.autosave.v3";

const playing = () => !!(W && W.player && W.player.controller === "player" && W.player.alive);
const blockingEp = () => W.episodes.find((e) => e.block);
const busy = () => !!(session || bmenu || win || epView || blockingEp());
let titleOpen = false;
const paused = () => !playing() || speed === 0 || busy() || document.hidden || titleOpen;

// ------------------------------------------------------------ 저장
let autoNote = "";
/* 저장 칸: 이 브라우저에 여러 세계를 따로 저장한다. 지금 하는 세계(slotId)는 자동 저장된다 */
const SLOT_INDEX = "asteria.slots.v1", SLOT_PREFIX = "asteria.slot.v1.", MAX_SLOTS = 8;
let slotId = null;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { localStorage.setItem(k, v); }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
function slotsList() { try { return JSON.parse(store.get(SLOT_INDEX)) || []; } catch (e) { return []; } }
function writeSlots(l) { try { store.set(SLOT_INDEX, JSON.stringify(l)); } catch (e) {} }
function newSlotId() { return Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function autosave() {
  if (!W) return;
  if (!slotId) slotId = newSlotId();
  try {
    const data = W.serialize(), p = W.player;
    store.set(SLOT_PREFIX + slotId, data);
    const l = slotsList().filter((x) => x.id !== slotId);
    l.unshift({ id: slotId, name: W.name, date: W.date(), clock: G.clockText(W), player: p ? p.name + (p.alive ? "" : " (사망)") : "", job: p && p.alive ? W.jobName(p) : "", nations: new Set(Object.values(W.towns).map((t) => t.nation)).size, savedAt: Date.now(), size: data.length });
    writeSlots(l);
    autoNote = `자동 저장됨 · ${W.date()} ${G.clockText(W)}`;
  } catch (e) { autoNote = "브라우저 저장 공간이 부족해 자동 저장하지 못했다. 저장 칸 몇 개를 지워 줘."; }
}
function loadSlotLocal(id) { try { const t = store.get(SLOT_PREFIX + id); return t ? A.World.deserialize(t) : null; } catch (e) { return null; } }
function loadAuto() { // 옛 자동 저장을 저장 칸 하나로 옮긴다
  const old = store.get(AUTO_KEY);
  if (old && !slotsList().length) { try { const w = A.World.deserialize(old); slotId = newSlotId(); W = w; autosave(); store.del(AUTO_KEY); return w; } catch (e) {} }
  return null;
}
// ---- 설정 (이 브라우저에만 저장)
const SETTINGS_KEY = "asteria.settings.v1";
let settings = { speed: 1, autosave: 90, uiScale: 1, hints: true };
try { Object.assign(settings, JSON.parse(store.get(SETTINGS_KEY)) || {}); } catch (e) {}
function saveSettings() { try { store.set(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} applySettings(); }
function applySettings() { document.documentElement.style.setProperty("--ui-zoom", String(settings.uiScale)); }
applySettings();
function freshWorld(seed, name) { return A.freshWorld(seed, name); }
function setWorld(w, note) {
  W = w; G.setup(W);
  session = null; bmenu = null; epView = null; path = []; win = null; $("#win").hidden = true;
  if (W.ppos) view.cam = { x: W.ppos.x, y: W.ppos.y };
  hotSig = ""; $("#menubar").dataset.sig = "";
  autosave(); if (note) autoNote = note;
  renderAll();
  if (!playing()) openWin("born");
}

// ------------------------------------------------------------ 메인 루프
function frame(now) {
  const dt = Math.min(0.08, (now - lastT) / 1000); lastT = now;
  if (W) {
    let walking = false;
    if (playing()) {
      if (!paused()) {
        carry += dt * 2 * speed + G.pendingMins; G.pendingMins = 0;
        if (W.autoDays > 0 || G.blockedReason(W)) carry += dt * 60 * speed;
        const whole = Math.floor(carry);
        if (whole >= 1) { carry -= whole; const d0 = W.day; G.tick(W, whole); if (W.day !== d0) onNewDay(); }
        walking = moveStep(dt);
        G.updateWalkers(W, dt); G.updateAnimals(W, dt);
      }
    } else {
      if (obsRun) { for (let i = 0; i < ({ 1: 1, 2: 3, 3: 12 })[obsSpeed]; i++) A.step(W); W.clock = 360; }
      G.updateWalkers(W, dt);
    }
    G.updateProjectiles(dt);
    const e = G.ext(W);
    const marks = new Set([...W.episodes.map((x) => x.who), ...e.missions.filter((m) => !m.done).flatMap((m) => [m.to, m.b, m.target])].filter((x) => x !== null && x !== undefined));
    view.draw(W, { dt, follow: playing(), showPlayer: playing(), walking, item: e.hot[e.sel], marks, wanted: e.wanted.level, target: aimTile() });
    hudT -= dt; miniT -= dt; hereT -= dt;
    if (hudT <= 0) { hudT = 0.25; renderHud(); renderHotbar(); }
    if (miniT <= 0) { miniT = 0.5; renderMini(); }
    if (hereT <= 0) { hereT = 1; renderHere(); }
    sinceSave += dt; if (sinceSave > settings.autosave && !titleOpen) { sinceSave = 0; autosave(); }
    if (auto.on && playing() && !titleOpen && !document.hidden) { auto.wait -= dt; if (auto.wait <= 0 && !path.length) { auto.wait = 0.35; try { autoStep(); } catch (e) { autoError(e); } } }
    if (titleOpen && !playing()) { view.cam.x += dt * 0.6; }
  }
  requestAnimationFrame(frame);
}
function moveStep(dt) {
  if (G.blockedReason(W)) { path = []; return false; }
  let dx = 0, dy = 0;
  if (keys.has("left")) dx -= 1; if (keys.has("right")) dx += 1; if (keys.has("up")) dy -= 1; if (keys.has("down")) dy += 1;
  if (dx || dy) { path = []; pathThen = null; return G.move(W, dx, dy, dt, keys.has("run")); }
  if (path.length) {
    const [nx, ny] = path[0], ddx = nx - W.ppos.x, ddy = ny - W.ppos.y, d = Math.hypot(ddx, ddy);
    if (d < 0.12) { path.shift(); if (!path.length && pathThen) { const f = pathThen; pathThen = null; f(); } return true; }
    const ok = G.move(W, ddx / d, ddy / d, Math.min(dt, d / 4.2), keys.has("run"));
    if (!ok) { path = []; pathThen = null; }
    return ok;
  }
  return false;
}
function walkTo(x, y, then, quiet) {
  const p = G.findPath(W, W.ppos.x, W.ppos.y, x, y, 20000);
  if (!p) { if (!quiet) toast("갈 수 없는 곳이다."); return false; }
  path = p; pathThen = then || null;
  if (!p.length && then) { pathThen = null; then(); }
}
function aimTile() {
  if (!playing() || !view.mouse) return null;
  const e = G.ext(W), it = e.hot[e.sel];
  if (!it || it === "hand" || (G.ITEMS[it] && (G.ITEMS[it].weapon || G.ITEMS[it].act === "throw"))) return null;
  const [wx, wy] = view.toWorld(...view.mouse);
  const tx = Math.floor(wx), ty = Math.floor(wy);
  return Math.hypot(tx + 0.5 - W.ppos.x, ty + 0.5 - W.ppos.y) < 2 ? [tx, ty] : null;
}
function onNewDay() {
  const pp = W.papers[W.papers.length - 1];
  if (pp && pp.unread && pp.day === W.day && playing() && !G.blockedReason(W) && !busy()) openWin("paper", pp);
  autosave();
}

// ------------------------------------------------------------ 입력
/* 게임 화면에 키보드 포커스를 되돌린다. 아티팩트처럼 다른 페이지 안에 들어가 있으면 바깥이 포커스를 가져갈 수 있어서
 * 창 자체에도 포커스를 요청하고, 한 박자 뒤에 한 번 더 확인한다. */
function refocus() {
  const go = () => { if (titleOpen || (win && $("#win").contains(document.activeElement))) return; try { window.focus(); } catch (_) {} const c = $("#world"); if (c && document.activeElement !== c) c.focus({ preventScroll: true }); };
  go(); setTimeout(go, 30); setTimeout(go, 150);
}
/* Esc는 바깥(아티팩트 화면 등)이 먼저 가져가지 않도록 가장 먼저 받아서 처리한다 */
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !W || (e.target.closest && e.target.closest("input,select,textarea"))) return;
  if (!(win || bmenu || session || epView)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (win) closeWin(); else if (bmenu) closeMenu(); else if (session) endSession(); else if (epView) { epView = null; renderTalk(); refocus(); }
}, true);
/* 키보드 포커스가 게임 밖으로 나가면(다른 탭·바깥 페이지) 알려 준다. 누르면 돌아온다 */
window.addEventListener("blur", () => { if (W && !titleOpen) $("#game").classList.add("nofocus"); keys.clear(); });
window.addEventListener("focus", () => $("#game").classList.remove("nofocus"));
document.addEventListener("pointerdown", () => $("#game").classList.remove("nofocus"), true);
const KEYMAP = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", arrowdown: "down", s: "down", shift: "run" };
document.addEventListener("keydown", (e) => {
  if (!W || (e.target.closest && e.target.closest("input,select,textarea"))) return;
  const k = e.key.toLowerCase();
  if (k === "escape") { if (win) closeWin(); else if (bmenu) closeMenu(); else if (session) endSession(); else if (epView) { epView = null; renderTalk(); } return; }
  if (session || epView || blockingEp() || bmenu) {
    if (/^[1-9]$/.test(k)) { const opt = $$(".talk .opt")[+k - 1]; if (opt && !opt.disabled) { e.preventDefault(); opt.click(); } return; }
    // 방향키를 누르면 대화·건물 메뉴를 닫고 바로 걷는다 (반드시 골라야 하는 일은 예외)
    if (KEYMAP[k] && KEYMAP[k] !== "run" && !blockingEp() && !win) {
      e.preventDefault();
      if (session) endSession(); if (bmenu) closeMenu(); if (epView) { epView = null; renderTalk(); }
      keys.add(KEYMAP[k]);
      return;
    }
    if (session && session.over && (k === " " || k === "e" || k === "enter")) { e.preventDefault(); endSession(); return; }
    return;
  }
  if (KEYMAP[k] && playing() && !win) { e.preventDefault(); keys.add(KEYMAP[k]); return; }
  const wk = { b: "codex", c: "info", i: "bag", k: "craft", m: "map", r: "rel", j: "story", n: "paperToday", q: "missions", p: "people", t: "towns", h: "help" }[k];
  if (wk) { e.preventDefault(); win === wk ? closeWin() : openWin(wk); return; }
  if (!playing() || win) return;
  if (/^[0-9]$/.test(k)) { const i = k === "0" ? 9 : +k - 1; const ex = G.ext(W); if (i < ex.hot.length) { ex.sel = i; renderHotbar(true); renderHud(); } return; }
  if (k === " ") { e.preventDefault(); const [tx, ty] = G.facingTile(W); useTool(tx, ty); return; }
  if (k === "e" || k === "enter") { e.preventDefault(); interactFront(); }
});
document.addEventListener("keyup", (e) => { const m = KEYMAP[e.key.toLowerCase()]; if (m) keys.delete(m); });
window.addEventListener("blur", () => keys.clear());

function interactFront() {
  const [tx, ty] = G.facingTile(W);
  const inHouse = G.insideBuilding(W) && G.insideBuilding(W).kind === "house"; // 초대받은 집 안: 바로 앞 사람과만 말하고, 아니면 집 안에서 할 일을 연다
  const n = G.npcAtTile(W, tx, ty) || (inHouse ? null : nearestNPC(1.6));
  if (n) { openTalk(n.id); return; }
  const inB = G.insideBuilding(W), myHome = inB && G.MAP.buildings.find((b) => b.town === W.player.home && b.kind === "inn");
  const myFurn = myHome && inB.id === myHome.id && ((G.ext(W).furn || {})[inB.id] || []).some((f) => inB.x + f.rx === tx && inB.y + f.ry === ty);
  const pl = myFurn ? null : nearPlace();
  if (pl) { openMenu(pl); return; }
  const ex = G.ext(W), keep = ex.sel;
  ex.sel = Math.max(0, ex.hot.indexOf("hand"));
  useTool(tx, ty); ex.sel = keep;
}
function nearestNPC(r) { let best = null, bd = r; for (const { n, k } of G.visibleNPCs(W)) { const d = Math.hypot(k.x - W.ppos.x, k.y - W.ppos.y); if (d < bd) { bd = d; best = n; } } return best; }
function nearPlace() {
  const t = G.townAt(W.ppos.x, W.ppos.y);
  const st = G.stationPlaces(W).find((p) => Math.hypot(p.x + 0.5 - W.ppos.x, p.y + 0.5 - W.ppos.y) < 1.6);
  if (st) return st;
  const inB = G.insideBuilding(W);
  if (inB) return G.MAP.places.find((p) => p.b === inB.id) || null;
  return G.MAP.places.filter((p) => (p.town === t || p.kind === "camp") && p.kind !== "square").find((p) => Math.hypot(p.x + 0.5 - W.ppos.x, p.y + 0.5 - W.ppos.y) < (p.kind === "fields" ? 2.2 : 1.4)) || null;
}
function useTool(tx, ty) {
  const e = G.ext(W), it = G.ITEMS[e.hot[e.sel]];
  if (it && it.weapon) view.swing = 0.25;
  const r = G.useAt(W, tx, ty);
  if (r && !(it && it.weapon && !r)) { if (!G.onLog || !W.todayLog.length || W.todayLog[W.todayLog.length - 1].text !== r) toast(r); }
  renderHotbar(true); renderHud();
}
function onWorldClick({ tx, ty, hit, right }) {
  if (!playing()) { if (hit && hit.npc !== undefined) { bioId = hit.npc; openWin("people"); } return; }
  if (busy() || G.blockedReason(W)) return;
  const e = G.ext(W), item = e.hot[e.sel] || "hand", tool = G.ITEMS[item];
  const reach = (x, y) => Math.hypot(x - W.ppos.x, y - W.ppos.y);
  if (right) { walkTo(tx, ty); return; }
  if (tool && tool.act === "throw") { // 던지는 물건은 멀리서도 클릭한 곳으로 던진다
    const tgt = hit && hit.animal ? [hit.animal.x, hit.animal.y] : [tx + 0.5, ty + 0.5];
    const r = G.throwAt(W, tgt[0], tgt[1], item); if (r) toast(r); renderHotbar(true); renderHud(); return;
  }
  if (hit && hit.npc !== undefined) {
    const k = hit.k;
    if ((tool && tool.weapon) || item === "skill") { if (reach(k.x, k.y) < 1.7) useTool(Math.floor(k.x), Math.floor(k.y)); else walkTo(k.x, k.y, item === "skill" ? () => useTool(Math.floor(k.x), Math.floor(k.y)) : null); return; }
    if (reach(k.x, k.y) < 1.7) openTalk(hit.npc); else walkTo(k.x, k.y, () => openTalk(hit.npc));
    return;
  }
  if (hit && hit.animal) { const a = hit.animal; if (reach(a.x, a.y) < 1.7) useTool(Math.floor(a.x), Math.floor(a.y)); else walkTo(a.x, a.y); return; }
  const st = G.stationPlaces(W).find((p) => p.x === tx && (p.y === ty || p.y - 1 === ty));
  if (st) { if (reach(st.x + 0.5, st.y + 0.5) < 1.6) openMenu(st); else walkTo(st.x, st.y + 1, () => openMenu(st)); return; }
  const inB = G.insideBuilding(W);
  if (hit && hit.building && inB && hit.building.id === inB.id && ty > inB.y) { // 건물 안을 누름: 바닥이면 걸어가고, 가구·내 물건이면 쓴다
    const it = G.ITEMS[item];
    if ((it && it.furniture) || item === "hand") { if (reach(tx + 0.5, ty + 0.5) < 1.9) { G.face(W, tx, ty); useTool(tx, ty); } else walkTo(tx, ty); return; }
    walkTo(tx, ty); return;
  }
  if (hit && hit.building) {
    const bd = hit.building;
    if (bd.kind === "house") {
      const hpl = G.MAP.places.find((p) => p.b === bd.id), job = G.ext(W).missions.some((m) => !m.done && m.type === "build" && m.town === bd.town && m.hid === bd.hid);
      if (G.canEnter(W, bd)) { const [ex, ey] = G.entryOf(bd); walkTo(ex, ey, () => walkTo(ex, ey - 1)); return; }
      const later = G.ext(W).missions.find((m) => !m.done && m.type === "visit" && m.town === bd.town && m.hid === bd.hid);
      if (later) { toast(`${W.npcs[later.to].name}의 집이다. ${String(Math.floor(later.start)).padStart(2, "0")}시부터 오라고 했다.`); return; }
      if (!job) { toast(W.player.job === "builder" ? "남의 집이다. 집주인에게 ‘고칠 데 없어요?’라고 물어보자." : "남의 집이다."); return; }
      if (reach(hpl.x + 0.5, hpl.y + 0.5) < 1.4) openMenu(hpl); else walkTo(hpl.x, hpl.y, () => openMenu(hpl)); return;
    }
    const pl = G.MAP.places.find((p) => p.b === bd.id);
    if (pl && G.canEnter(W, bd)) { const [ex, ey] = G.entryOf(bd); walkTo(ex, ey, () => { walkTo(ex, ey - 1); toast(`${bd.kind === "inn" && W.player.home === bd.town ? "내 집" : bd.name}에 들어왔다. 안에서 E를 누르면 볼일을 볼 수 있다.`); }); return; }
    if (pl) { if (reach(pl.x + 0.5, pl.y + 0.5) < 1.4) openMenu(pl); else walkTo(pl.x, pl.y, () => openMenu(pl)); }
    return;
  }
  if (G.objAt(W, tx, ty) === G.O.SIGN) { const pl = G.MAP.places.find((p) => p.kind === "fields" && Math.abs(p.x - tx) <= 2 && Math.abs(p.y - ty) <= 2); if (pl) { reach(tx + 0.5, ty + 0.5) < 1.8 ? openMenu(pl) : walkTo(tx, ty + 1, () => openMenu(pl)); return; } }
  const near = reach(tx + 0.5, ty + 0.5) < 1.9;
  const farm = e.farm[tx + "," + ty];
  if (item !== "hand" && tool && !tool.weapon) { if (near) useTool(tx, ty); else walkTo(tx, ty, () => useTool(tx, ty)); return; }
  if (tool && tool.weapon) { G.face(W, tx, ty); useTool(tx, ty); return; }
  if (G.forageReady(W, tx, ty) || farm) { if (near) useTool(tx, ty); else walkTo(tx, ty, () => useTool(tx, ty)); return; }
  walkTo(tx, ty);
}

// ------------------------------------------------------------ HUD
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function renderHud() {
  $("#clock").textContent = playing() || W.dayOpen ? G.clockText(W) : "—";
  $("#date").textContent = `${W.date()}${W.day < W.droughtUntil ? " · 가뭄" : ""}${W.war.active ? ` · 전선 ${Math.round(W.war.front)}` : " · 평화"}`;
  renderQuests(); renderMenubar();
  const p = W.player, e = G.ext(W);
  if (!playing()) { $("#bl").replaceChildren(); $("#handname").textContent = ""; return; }
  const bar = (lab, v, max, col) => h("div", { class: "bar" }, h("span", null, lab), h("span", { class: "track", role: "meter", "aria-label": lab, "aria-valuenow": Math.round(v), "aria-valuemin": 0, "aria-valuemax": max }, h("span", { style: `display:block;height:100%;width:${clamp01(v / max) * 100}%;background:${col}` })), h("span", { class: "v" }, `${Math.max(0, Math.round(v))}/${max}`));
  const br = G.blockedReason(W);
  const st = h("div", { class: "frame stats" },
    h("div", { class: "who" }, p.name, h("span", { class: "job" }, `${A.RACES[p.race].name} ${W.jobName(p)}`), e.wanted.level ? h("span", { class: "wanted", title: "수배" }, "★".repeat(e.wanted.level)) : null),
    bar("체력", p.health, 10, "#e5574a"), bar("기력", p.energy, 100, p.energy > 30 ? "#6cc26a" : "#e0b03a"),
    h("div", { class: "row", style: "justify-content:space-between;font-size:12px;margin-top:2px" }, h("span", { class: "gold" }, `₲ ${Math.floor(p.gold)}`), p.hunger >= 2 ? h("span", { style: "color:var(--red)" }, p.hunger >= 4 ? "몹시 배고픔" : "배고픔") : h("span", { class: "muted" }, `명성 ${p.fame}`)),
    br ? h("div", { class: "small", style: "color:var(--gold)" }, br) : null);
  const bl = $("#bl");
  if (!bl.firstChild || bl.dataset.pid !== String(p.id)) { bl.dataset.pid = String(p.id); bl.replaceChildren(h("div", { class: "portrait", title: "정보 (C)", onclick: () => openWin("info") }, portraitCanvas(p, 64)), st); }
  else bl.replaceChild(st, bl.children[1]);
  const id = e.hot[e.sel], it = G.ITEMS[id];
  $("#handname").textContent = it ? (id === "skill" ? G.SKILL[p.job].name : `${it.name}${!it.tool ? ` ×${e.inv[id] || 0}` : ""}`) : "";
}
function renderQuests() {
  const e = G.ext(W), act = e.missions.filter((m) => !m.done);
  const sig = act.map((m) => S.missionTitle(W, m) + S.missionWhere(W, m)).join("|") + playing();
  if ($("#questBody").dataset.sig === sig) return;
  $("#questBody").dataset.sig = sig;
  $("#questBody").replaceChildren(...(act.length ? act.slice(0, 3).map((m) => h("button", { class: "q", type: "button", onclick: () => openWin("missions") },
      h("span", { class: "qt" }, S.missionTitle(W, m)), h("span", { class: "where" }, S.missionWhere(W, m))))
    : [h("div", { class: "muted small" }, playing() ? "없음" : "—")]));
}
let hotSig = "";
function renderHotbar(force) {
  if (!playing()) { $("#hotbar").hidden = true; return; }
  $("#hotbar").hidden = false;
  const e = G.ext(W);
  const sig = e.hot.join() + "|" + e.sel + "|" + e.hot.map((id) => e.inv[id] || 0).join();
  if (sig === hotSig && !force) return; hotSig = sig;
  $("#hotbar").replaceChildren(...e.hot.map((id, i) => {
    const it = G.ITEMS[id], n = e.inv[id] || 0;
    return h("button", { class: "slot" + (!it.tool && !n ? " empty" : ""), type: "button", "aria-pressed": String(i === e.sel), title: `${it.name}${it.tool ? "" : ` ×${n}`}`, "aria-label": `${i + 1}번 ${it.name}`, onclick: () => { e.sel = i; renderHotbar(true); renderHud(); $("#world").focus(); } },
      h("span", { class: "k" }, i === 9 ? "0" : String(i + 1)), icon(id), !it.tool ? h("span", { class: "n" }, String(n)) : null);
  }));
}
function renderMini() {
  const e = G.ext(W), marks = [];
  for (const m of e.missions) if (!m.done) for (const id of [m.to, m.b, m.target]) if (id !== null && id !== undefined && W.npcs[id] && W.npcs[id].alive) { const k = G.walkers.get(id); if (k) marks.push({ x: k.x, y: k.y, color: "#ffd75a" }); }
  if (playing()) for (const f of S.familyList(W, W.player)) { const k = G.walkers.get(f.x.id); if (k && f.x.alive) marks.push({ x: k.x, y: k.y, color: "#ff9ac8" }); }
  if (e.trackUntil > G.absMin(W)) for (const a of G.animals) marks.push({ x: a.x, y: a.y, color: "#ff6a5a", r: 1.6 });
  window.drawMap($("#minimap"), W, { marks, scale: 2 });
  const p = W.player;
  let where = "탄드렐 전도";
  if (playing()) {
    const t = G.townAt(W.ppos.x, W.ppos.y), pl = nearPlace();
    const tile = G.MAP.tile[G.MAP.I(Math.floor(W.ppos.x), Math.floor(W.ppos.y))];
    where = p.at_war ? "전선 진지" : t ? `${W.towns[t].name}${pl ? " · " + (pl.kind === "inn" && p.home === pl.town ? "내 집" : pl.name) : ""}` : tile === G.T.FLOOR ? "깊은 숲" : tile === G.T.WASTE ? "북쪽 황무지" : tile === G.T.SAND ? "모래사장" : "들판";
  }
  $("#where").textContent = where;
}
function renderHere() {
  if (!hereOpen) return;
  const list = playing() ? G.peopleHere(W) : [];
  const p = W.player;
  const t = playing() && W.ppos ? G.townAt(W.ppos.x, W.ppos.y) : null;
  $("#hereTitle").textContent = t ? `${W.towns[t].name}의 사람들 (${list.length})` : "주변 사람들";
  const col = (x) => { const v = A.opinion(p, x.id); return v >= 40 ? "#8fdc8a" : v >= 10 ? "#c9e88a" : v <= -40 ? "#ff6a5a" : v <= -10 ? "#ffb27a" : "#9aa6bd"; };
  $("#hereBody").replaceChildren(...(list.length ? list.slice(0, 30).map(({ n, k, act }) => h("button", { type: "button", title: `${n.name}에게 가기`, onclick: () => { if (k.inside) { toast(`${jo(n.name, "은/는")} 지금 ${act}이다.`); return; } walkTo(k.x, k.y, () => openTalk(n.id)); } },
    h("span", { class: "dot", style: `background:${col(n)}` }), h("span", null, following(n.id) ? h("span", { class: "star", "aria-label": "관심 인물" }, "★") : null, h("span", { class: "nm" }, n.name), " ", h("span", { class: "act" }, `${W.jobName(n)}${S.relTag(p, n) ? " · " + S.relTag(p, n) : ""}`)), h("span", { class: "act" }, act)))
    : [h("div", { class: "muted small", style: "padding:6px" }, playing() ? "주변에 아무도 없다." : "캐릭터가 있어야 보인다.")]));
}
function renderSpeed() {
  const el = $("#speed");
  if (playing()) el.replaceChildren(...[[0, "❚❚"], [1, "×1"], [2, "×2"], [4, "×4"]].map(([v, l]) => h("button", { type: "button", "aria-pressed": String(speed === v), "aria-label": v ? `속도 ${l}` : "멈춤", onclick: () => { speed = v; renderSpeed(); $("#world").focus(); } }, l)));
  else el.replaceChildren(h("button", { type: "button", "aria-pressed": String(obsRun), onclick: () => { obsRun = !obsRun; renderSpeed(); } }, obsRun ? "❚❚" : "▶ 흐르게"), ...[[1, "느림"], [2, "보통"], [3, "빠름"]].map(([v, l]) => h("button", { type: "button", "aria-pressed": String(obsSpeed === v), onclick: () => { obsSpeed = v; renderSpeed(); } }, l)));
}
function renderMenubar() {
  const eps = W.episodes.filter((e) => !e.block).length, unread = W.papers.some((p) => p.unread);
  const sig = `${eps}|${unread}|${playing()}|${groupOf(win)}`;
  if ($("#menubar").dataset.sig === sig) return;
  $("#menubar").dataset.sig = sig;
  const g = groupOf(win);
  const btn = (id, label, key, extra = {}) => h("button", { class: "mbtn" + (extra.primary ? " primary" : ""), type: "button", "aria-pressed": String(g === (GROUP_OF[id] || id)), onclick: () => (g === (GROUP_OF[id] || id) ? closeWin() : openWin(id)) }, label, key ? h("kbd", null, key) : null, extra.badge ? h("span", { class: "badge" }, extra.badge) : null);
  $("#menubar").replaceChildren(
    btn("info", "나", "C"),
    btn(eps ? "news" : "paperToday", "소식", "N", { badge: eps ? String(eps) : unread ? "새" : null }),
    btn("people", "세계", "P"),
    btn("map", "지도", "M"),
    btn("codex", "도감", "B"),
    h("span", { class: "msep", "aria-hidden": "true" }),
    playing() ? h("button", { class: "mbtn", type: "button", onclick: () => { if (G.blockedReason(W) || busy()) return; G.sleep(W, "rough"); onNewDay(); renderAll(); } }, "여기서 자기") : h("button", { class: "mbtn primary", type: "button", onclick: () => openWin("born") }, W.player ? "다시 시작" : "태어나기"),
    btn("help", "도움말", "H"), btn("test", "테스트"),
    h("button", { class: "mbtn", type: "button", onclick: () => openTitle() }, "메뉴"));
}
function portraitCanvas(n, size) { return window.drawPortrait(n, size, n.controller === "player"); }

// ------------------------------------------------------------ 대화
function openTalk(id, opener) {
  if (!playing() || busy() || G.blockedReason(W)) return;
  const x = W.npcs[id], k = G.walkers.get(id);
  if (!x || !x.alive) return;
  if (k && k.inside) { toast(`${jo(x.name, "은/는")} 지금 ${G.activity(W, x)}이다.`); return; }
  if (G.isNight(W) && !opener) { toast(`${jo(x.name, "이/가")} 졸린 눈으로 고개를 저었다. 밤이 늦었다.`); return; }
  if (k && (k.fight || k.chase)) return;
  path = []; keys.clear();
  if (k && W.ppos) { k.dir = Math.abs(W.ppos.x - k.x) > Math.abs(W.ppos.y - k.y) ? (W.ppos.x > k.x ? "right" : "left") : W.ppos.y > k.y ? "down" : "up"; G.face(W, Math.floor(k.x), Math.floor(k.y)); }
  session = S.talk(W, id, opener || "talk");
  renderTalk();
}
function renderTalk() {
  const box = $("#talk");
  const ep = blockingEp();
  if (!session && !epView && !ep && !bmenu) { box.hidden = true; return; }
  box.hidden = false;
  if (ep || epView) return renderEp(ep || epView);
  if (bmenu) return renderMenu();
  const x = W.npcs[session.nid], tag = S.relTag(W.player, x);
  box.replaceChildren(
    h("div", { class: "face" }, portraitCanvas(x, 72), h("div", null, h("div", { class: "nm" }, x.name), h("div", { class: "sub" }, `${A.RACES[x.race].name} ${W.jobName(x)} · ${A.age(x)}세${tag ? " · " + tag : ""}`))),
    h("div", { class: "main" },
      h("div", { class: "lines", id: "lines" }, session.lines.slice(-14).map((l) => h("div", { class: "line " + l.who }, l.who === "npc" ? h("b", null, x.name) : null, l.text))),
      h("div", { class: "opts" }, session.over
        ? [h("button", { class: "opt", type: "button", onclick: endSession }, h("b", null, h("span", { class: "k" }, "1"), "대화를 마친다"))]
        : session.options.map((o, i) => h("button", { class: "opt" + (o.cls ? " " + o.cls : ""), type: "button", onclick: () => { o.go(); if (session && session.slept) { session = null; renderTalk(); onNewDay(); renderAll(); return; } renderTalk(); renderHud(); } },
          h("b", null, i < 9 ? h("span", { class: "k" }, String(i + 1)) : null, o.label), o.hint ? h("span", null, o.hint) : null)))));
  const ln = $("#lines"); if (ln) ln.scrollTop = ln.scrollHeight;
}
function endSession() { if (session) { S.endTalk(W, session); session = null; } renderTalk(); renderAll(); refocus(); }
// 대화 선택지·단축바·메뉴 버튼을 누른 뒤에도 키보드가 바로 게임에 먹도록 초점을 돌려 둔다
document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest(".talk .opt, .slot, .mbtn, .tab")) return;
  setTimeout(() => { if (!win || !$("#win").contains(document.activeElement)) $("#world").focus({ preventScroll: true }); }, 0);
});
function renderEp(ep) {
  const x = ep.who !== null && ep.who !== undefined ? W.npcs[ep.who] : null;
  $("#talk").replaceChildren(
    h("div", { class: "face" }, x ? portraitCanvas(x, 72) : icon("scroll_rune", 44), h("div", null, h("div", { class: "nm" }, ep.title), h("div", { class: "sub" }, `${W.date(ep.day)} ${ep.t}`))),
    h("div", { class: "main" }, h("div", { class: "lines" }, h("div", { class: "line" }, ep.text)),
      h("div", { class: "opts" }, ep.choices.map((c, i) => h("button", { class: "opt", type: "button", onclick: () => { const r = S.resolve(W, ep.id, c.id); epView = null; if (r) toast(r); renderTalk(); renderAll(); } },
        h("b", null, h("span", { class: "k" }, String(i + 1)), c.label), c.hint ? h("span", null, c.hint) : null)),
        !ep.block ? h("button", { class: "opt", type: "button", onclick: () => { epView = null; renderTalk(); } }, h("b", null, "나중에 정하기")) : null)));
}

// ------------------------------------------------------------ 건물
function openMenu(pl) { if (busy()) return; path = []; keys.clear(); bmenu = { pl, result: null, pick: null }; renderTalk(); }
function closeMenu() { if (window.Sims) Sims.stop(); bmenu = null; renderTalk(); renderAll(); refocus(); }
function renderMenu() {
  const pl = bmenu.pl, p = W.player;
  if (bmenu.pick === "sim") { // 업무 조작 화면: 진행 중에는 다시 그리지 않는다
    if (window.Sims && Sims.running() && $("#talk .simwrap")) return;
    const wk = bmenu.sim, host = h("div", { class: "simwrap" });
    $("#talk").hidden = false;
    $("#talk").replaceChildren(h("div", { class: "main full" }, host));
    Sims.run(host, wk, A.workLv(p, wk), (res) => {
      if (!bmenu) return;
      bmenu.pick = null; bmenu.sim = null;
      if (res) { const r = G.finishWork(W, pl, wk.id, res.auto ? null : res.scores); bmenu.result = r.text; }
      renderMenu(); renderHotbar(true); renderHud(); refocus();
    }, { client: wk.client ? A.workClient(W, p, wk) : null, vocab: wk.skill ? A.KNOW(wk.skill).vocab : null });
    return;
  }
  const inv = pl.kind === "house" ? G.inviteAt(W, G.MAP.buildings[pl.b]) : null;
  const name = pl.kind === "inn" && p.home === pl.town ? "내 집" : inv ? `${W.npcs[inv.to].name}의 집` : pl.kind === "house" ? "주민의 집" : pl.name;
  const placeIcon = window.itemIcon({ tavern: "meal", forge: "axe", temple: "potion", guild: "sword", market: "old_coin", inn: "bread", fields: "wheat", camp: "spear", station: "table", house: "chair" }[pl.kind] || "chair", 44);
  let opts;
  if (bmenu.pick === "board") {
    const list = (G.ext(W).board || {})[pl.town] || [];
    opts = [...list.map((m, i) => h("button", { class: "opt quest", type: "button", onclick: () => { toast(S.takeBoard(W, pl.town, i)); renderMenu(); renderQuests(); } }, h("b", null, S.missionTitle(W, m)), h("span", null, `보상 금화 ${m.reward}`))),
      h("button", { class: "opt", type: "button", onclick: () => { const n = S.deliverToBoard(W); toast(n ? `납품 ${n}건을 마쳤다.` : "납품할 물건이 없다."); renderMenu(); } }, h("b", null, "의뢰 물품 납품하기"), h("span", null, "가방에 있는 의뢰 물품을 낸다")),
      h("button", { class: "opt", type: "button", onclick: () => { bmenu.pick = null; renderMenu(); } }, h("b", null, "← 돌아가기"))];
    if (!list.length) opts.unshift(h("div", { class: "muted small" }, "오늘 게시판엔 남은 의뢰가 없다. 내일 아침 새로 붙는다."));
  } else if (bmenu.pick === "report") {
    const crimes = G.knownCrimes(W);
    opts = [...crimes.map((c) => h("button", { class: "opt", type: "button", onclick: () => { bmenu.result = G.reportCrime(W, c.e.id); bmenu.pick = null; renderMenu(); } }, h("b", null, c.e.text), h("span", null, `${W.date(c.e.day)} · ${S.sourceText(W, c.j)}${c.j.s === "told" || c.j.s === "paper" ? " (증거가 약하다)" : ""}`))),
      h("button", { class: "opt", type: "button", onclick: () => { bmenu.pick = null; renderMenu(); } }, h("b", null, "← 돌아가기"))];
    if (!crimes.length) opts.unshift(h("div", { class: "muted small" }, "신고할 만한 범죄를 알지 못한다."));
  } else {
    const verbs = G.buildingMenu(W, pl);
    opts = verbs.map((v, i) => h("button", { class: "opt", type: "button", disabled: !v.ok, onclick: () => {
      const r = G.doBuilding(W, pl, v.id);
      if (r.slept) { bmenu = null; renderTalk(); onNewDay(); renderAll(); return; }
      if (r.board) { bmenu.pick = "board"; renderMenu(); return; }
      if (r.craft) { bmenu = null; renderTalk(); openWin("craft"); return; }
      if (r.report) { bmenu.pick = "report"; renderMenu(); return; }
      if (r.jobmake) { const J = A.JOBS[p.job]; jmDraft = G.jobDraft(W, J && J.creator === p.id ? p.job : null); closeMenu(); openWin("jobmake"); return; }
      if (r.sim) { bmenu.pick = "sim"; bmenu.sim = r.sim; bmenu.result = null; renderMenu(); return; }
      bmenu.result = r.text; renderMenu(); renderHotbar(true); renderHud();
    } }, h("b", null, i < 9 ? h("span", { class: "k" }, String(i + 1)) : null, v.label), h("span", null, v.ok ? `${v.hint || ""}${v.min ? ` · ${v.min >= 60 ? Math.floor(v.min / 60) + "시간" + (v.min % 60 ? ` ${v.min % 60}분` : "") : v.min + "분"}` : ""}` : v.why || "지금은 할 수 없다")));
    opts.push(h("button", { class: "opt", type: "button", onclick: closeMenu }, h("b", null, "나가기")));
  }
  $("#talk").replaceChildren(
    h("div", { class: "face" }, placeIcon, h("div", null, h("div", { class: "nm" }, name), h("div", { class: "sub" }, pl.kind === "station" ? "재료를 모아 오면 만들 수 있다" : pl.town ? W.towns[pl.town].name : ""))),
    h("div", { class: "main" }, bmenu.result ? h("div", { class: "lines" }, h("div", { class: "line" }, bmenu.result)) : null, h("div", { class: "opts" }, opts)));
}

// ------------------------------------------------------------ 알림
function toast(text, tone) {
  if (!text) return;
  const box = $("#toasts");
  if (box.lastChild && box.lastChild.textContent === text) return;
  const t = h("div", { class: "toast" + (tone ? " " + tone : "") }, text);
  box.append(t);
  setTimeout(() => t.remove(), 4600);
  while (box.children.length > 4) box.firstChild.remove();
}

// ------------------------------------------------------------ 창
/* 창은 세 묶음으로 나뉜다: 나(내 상태) · 소식(내가 알게 된 것) · 세계(세계 자체). 묶음 안에서는 탭으로 옮겨 다닌다. */
const GROUPS = {
  me: { title: "나", tabs: [["info", "정보", "C"], ["bag", "가방", "I"], ["craft", "만들기", "K"], ["rel", "관계", "R"], ["missions", "미션", "Q"]] },
  news: { title: "소식", tabs: [["paperToday", "오늘 신문", "N"], ["paperList", "지난 신문"], ["story", "내가 아는 이야기", "J"], ["news", "답을 기다리는 일"]] },
  world: { title: "세계", tabs: [["people", "인물", "P"], ["towns", "마을", "T"], ["nations", "나라·직업"], ["chron", "연대기"]] },
};
const GROUP_OF = {};
for (const [g, d] of Object.entries(GROUPS)) for (const [id] of d.tabs) GROUP_OF[id] = g;
GROUP_OF.paper = "news";
const groupOf = (id) => (id ? GROUP_OF[id] || id : null);
function openWin(id, arg) {
  if (id === "paperToday") { const pp = W.papers[W.papers.length - 1]; if (pp) arg = pp; else id = "paperList"; }
  if (session) { S.endTalk(W, session); session = null; } bmenu = null; if (!blockingEp()) { epView = null; $("#talk").hidden = true; }
  if (id === "codex" && arg) { codexSel = arg; codexCat = arg.startsWith("k:") ? (A.KNOW(arg.slice(2)).lost ? "magic" : "tech") : G.catOf(arg); }
  win = id; winArg = arg; path = []; keys.clear(); if ((id === "paper" || id === "paperToday") && arg) arg.unread = false; renderWin(); renderMenubar();
}
function closeWin() { win = null; $("#win").hidden = true; $("#game").classList.remove("winopen"); renderAll(); refocus(); }
function tabStrip() {
  const g = GROUPS[groupOf(win)];
  if (!g) return null;
  const eps = W.episodes.filter((e) => !e.block).length;
  const cur = win === "paper" ? (winArg === W.papers[W.papers.length - 1] ? "paperToday" : "paperList") : win;
  return h("div", { class: "tabs", role: "tablist" }, g.tabs.map(([id, label, key]) => h("button", { type: "button", role: "tab", class: "tab", "aria-selected": String(cur === id), onclick: () => openWin(id) },
    label, id === "news" && eps ? h("span", { class: "badge" }, String(eps)) : null, key ? h("kbd", null, key) : null)));
}
function renderWin() {
  const box = $("#win");
  if (!win) { box.hidden = true; return; }
  if (win === "jobmake" && window.Sims && Sims.running() && $("#win .simwrap")) return; // 시험 중에는 다시 그리지 않는다
  const titles = { jobmake: "직업 만들기", codex: "도감", map: "탄드렐 전도", save: "저장·불러오기", help: "도움말", born: "탄드렐에 어서 와", test: "테스트 단계" };
  const fn = { codex: winCodex, test: winTest, info: winInfo, bag: winBag, craft: winCraft, map: winMap, rel: winRel, news: winNews, story: winStory, paperList: winPapers, paper: winPaper, paperToday: winPaper, missions: winMissions, people: winPeople, towns: winTowns, nations: winNations, chron: winChron, save: winSave, help: winHelp, born: winBorn, jobmake: winJobMake }[win];
  const g = GROUPS[groupOf(win)];
  box.hidden = false;
  const scroll = box.querySelector(".body") && box.dataset.win === win ? box.querySelector(".body").scrollTop : 0;
  box.dataset.win = win;
  $("#game").classList.add("winopen");
  box.replaceChildren(h("div", { class: "title" }, h("span", null, g ? g.title : titles[win]), h("button", { class: "x", type: "button", onclick: closeWin, "aria-label": "닫기" }, "✕ 닫기")), ...[tabStrip()].filter(Boolean), h("div", { class: "body" + (win === "map" ? " mapwin" : "") + (win === "born" ? " born" : "") }, fn()));
  box.querySelector(".body").scrollTop = scroll;
  if (win === "map") requestAnimationFrame(drawFullMap);
}
function winInfo() {
  if (!playing()) return [h("p", null, "캐릭터가 없다.")];
  const p = W.player, e = G.ext(W), fam = S.familyList(W, p);
  return [h("div", { class: "grid2" },
    h("div", null, h("div", { class: "row" }, portraitCanvas(p, 72), h("div", null, h("div", { style: "font-family:var(--ui);font-size:20px" }, p.name), h("div", { class: "muted" }, `${A.RACES[p.race].name} · ${W.jobName(p)}${p.side && A.JOBS[p.side] ? ` · 부업 ${A.JOBS[p.side].name}` : ""} · ${A.age(p)}세`), h("div", { class: "gold" }, `₲ ${Math.floor(p.gold)} · 명성 ${p.fame}`))),
      h("h3", null, "성격"), h("div", { class: "traits" }, [["탐욕", "greed"], ["선량", "kindness"], ["용기", "bravery"], ["야망", "ambition"]].map(([l, k]) => [h("span", null, l), h("span", { class: "tb" }, h("span", { style: `width:${p.traits[k] * 100}%` }))])),
      h("h3", null, "직업 기술"), h("div", null, G.SKILL[p.job].name),
      h("h3", null, "아는 것"), (() => { const ks = A.CONTENT.knowledge.filter((k) => A.knows(p, k.id)); return ks.length ? h("div", { class: "chips" }, ks.map((k) => { const lv = A.skillLv(p, k.id); return h("button", { type: "button", class: "chip" + (k.lost ? " accent" : ""), onclick: () => openWin("codex", "k:" + k.id) }, k.name, lv >= 2 ? h("span", { class: "muted" }, ` ${A.SKILL_LV_NAME[lv]}`) : null); })) : h("p", { class: "small muted", style: "margin:0" }, "없음"); })()),
    h("div", null,
      h("h3", null, "가족"),
      fam.length ? h("div", { class: "fam" }, fam.map((f) => h("button", { type: "button", onclick: () => { bioId = f.x.id; openWin("people"); } }, h("b", null, f.rel), f.x.name, f.x.alive ? ` · ${f.x.at_war ? "전선" : W.towns[f.x.town].name}` : " (고인)")))
        : h("p", { class: "muted small" }, "없음"),
      h("h3", null, "살아가는 곳"), h("div", null, p.home ? `${W.towns[p.home].name}의 집` : "없음"),
      p.goal ? [h("h3", null, "품은 마음"), h("div", { style: "color:var(--red)" }, `${W.npcs[p.goal.target].name}에게 복수를 다짐했다.`)] : null,
      e.wanted.level ? [h("h3", null, "수배"), h("div", { class: "wanted" }, `${"★".repeat(e.wanted.level)} ${W.towns[e.wanted.town].name}에서 쫓기는 중`)] : null))];
}
function winBag() {
  const e = G.ext(W), ids = Object.keys(e.inv).filter((id) => e.inv[id] > 0);
  if (!ids.length) return [h("p", { class: "muted" }, "가방이 비었다.")];
  return [h("div", { class: "bag" }, ids.map((id) => {
    const it = G.ITEMS[id], inHot = e.hot.includes(id);
    const look = id === "skill" ? () => openWin("codex", "k:job") : () => openWin("codex", id);
    return h("div", { class: "item" }, h("button", { class: "ic", type: "button", "aria-label": `${it.name} 도감`, onclick: look }, icon(id)), h("div", null, h("button", { class: "nm link", type: "button", onclick: look }, id === "skill" ? G.SKILL[W.player.job].name : it.name), h("div", { class: "small muted" }, it.tool ? "" : `×${e.inv[id]}`)),
      h("div", { class: "acts" },
        (it.food || it.heal) ? h("button", { class: "wbtn", type: "button", onclick: () => { toast(G.eat(W, id)); renderWin(); renderHotbar(true); } }, "먹기") : null,
        it.teaches ? h("button", { class: "wbtn gold", type: "button", onclick: () => { toast(G.readScroll(W, id), "good"); renderWin(); renderHotbar(true); } }, "읽기") : null,
        h("button", { class: "wbtn", type: "button", onclick: () => { if (inHot) { e.hot = e.hot.filter((x) => x !== id); e.sel = Math.min(e.sel, e.hot.length - 1); } else if (e.hot.length < 10) e.hot.push(id); renderHotbar(true); renderWin(); } }, inHot ? "단축바에서 빼기" : "단축바에 넣기"),
        !it.tool ? h("button", { class: "wbtn danger", type: "button", onclick: () => { G.take(W, id, 1); renderHotbar(true); renderWin(); } }, "1개 버리기") : null));
  }))];
}
/** 재료 칩: 가진 수/필요한 수. 도감에 있으면 눌러서 본다 */
function needChip(id, n) {
  const have = G.ext(W).inv[id] || 0, known = G.codexHas(W, id);
  return h(known ? "button" : "span", { class: "need" + (have >= n ? " have" : ""), type: known ? "button" : undefined, onclick: known ? () => openWin("codex", id) : undefined }, icon(id, 14), ` ${G.ITEMS[id].name} ${Math.min(have, n)}/${n}`);
}
/** 만들기(K): 아는 만드는 법만 보인다. 작업대 물건은 작업대 앞에서 만든다 */
function winCraft() {
  if (!playing()) return [h("p", null, "캐릭터가 없다.")];
  const list = G.recipes(W).filter((c) => (!c.r.station || c.r.station === "home") && !c.unknown);
  const card = (c) => {
    const r = c.r, name = r.build ? r.name : G.ITEMS[r.out].name, ic = icon(r.build ? "table" : r.out, 32);
    return h("section", { class: "recipe" + (c.ok ? " ok" : "") },
      h("div", { class: "rhead" }, ic, h("div", null, r.build || !G.codexHas(W, r.out) ? h("div", { class: "nm" }, name) : h("button", { class: "nm link", type: "button", onclick: () => openWin("codex", r.out) }, name), (r.n || 1) > 1 ? ` ×${r.n}` : "")),
      h("div", { class: "needs" }, Object.entries(r.needs).map(([id, n]) => needChip(id, n))),
      h("div", { class: "rfoot" }, h("button", { class: "wbtn" + (c.ok ? " gold" : ""), type: "button", disabled: !c.ok, onclick: () => { toast(G.craft(W, r.id), "good"); renderWin(); renderHotbar(true); renderHud(); } }, r.build ? "세우기" : "만들기"),
        h("span", { class: "small muted" }, c.where || `${r.mins >= 60 ? r.mins / 60 + "시간" : r.mins + "분"} · 기력 ${r.energy || 0}`)));
  };
  return [h("div", { class: "bag" }, list.map(card))];
}
function drawFullMap() {
  const cv = $("#fullmap"); if (!cv) return;
  const e = G.ext(W), marks = [];
  for (const m of e.missions) if (!m.done) { const id = m.to ?? m.b ?? m.target ?? m.from; const x = id !== undefined && id !== null ? W.npcs[id] : null; if (x && x.alive && !x.at_war) { const k = G.walkers.get(id); const [tx, ty] = k ? [k.x, k.y] : G.TOWN_POS[x.town]; marks.push({ x: tx, y: ty, color: "#ffd75a", label: x.name }); } }
  if (playing()) for (const f of S.familyList(W, W.player)) if (f.x.alive && !f.x.at_war) { const k = G.walkers.get(f.x.id); const [tx, ty] = k ? [k.x, k.y] : G.TOWN_POS[f.x.town]; marks.push({ x: tx, y: ty, color: "#ff9ac8", label: `${f.rel} ${f.x.name}` }); }
  if (W.war.active) { const c = G.placeOf(G.FRONT, "camp"); marks.push({ x: c.x, y: c.y, color: "#ff6a5a", label: "전선 진지" }); }
  window.drawMap(cv, W, { full: true, marks });
}
function winMap() {
  return [h("canvas", { id: "fullmap", "aria-label": "전체 지도" }),
    h("div", { class: "row small", style: "margin-top:8px;gap:14px" }, h("span", { style: "color:#ffd75a" }, "▲ 나"), h("span", { style: "color:#ffd75a" }, "● 미션 대상"), h("span", { style: "color:#ff9ac8" }, "● 가족·연인"), h("span", { style: "color:#ff6a5a" }, "● 전선"),
      h("span", { class: "muted" }, "짙은 초록은 숲(멧돼지·사슴·약초·버섯), 연두는 들판(토끼·사과나무), 북쪽 갈색은 황무지(늑대), 서쪽은 바다다. 동쪽과 남쪽은 아직 아무도 살지 않는 땅이다. 곳곳에 옛 유적과 수상한 흙더미가 있다."))];
}
function winRel() {
  if (!playing()) return [h("p", null, "캐릭터가 있어야 관계도가 생긴다.")];
  const p = W.player, { nodes, edges } = S.relGraph(W, 14), fam = S.familyList(W, p), out = [];
  out.push(h("h3", null, "가족"), fam.length ? h("div", { class: "fam", style: "margin-bottom:6px" }, fam.map((f) => h("button", { type: "button", onclick: () => { graphSel = f.x.id; renderWin(); } }, h("b", null, f.rel), f.x.name))) : h("p", { class: "muted small" }, "아직 가족이 없다."));
  if (!nodes.length) return [...out, h("p", { class: "muted" }, "아직 깊은 인연이 없다. 사람들과 이야기를 나눠 봐.")];
  const Wd = 540, Hd = 400, cx = Wd / 2, cy = Hd / 2, pos = {};
  const sorted = nodes.slice().sort((a, b) => b.mine - a.mine);
  sorted.forEach((n, i) => { const ang = -Math.PI / 2 + (i / sorted.length) * Math.PI * 2, r = 70 + (100 - Math.min(100, Math.abs(n.mine))) * 0.95; pos[n.id] = [cx + Math.cos(ang) * r * 1.25, cy + Math.sin(ang) * r * 0.85]; });
  const col = (v) => (v >= 20 ? "#8fdc8a" : v <= -20 ? "#ff7a68" : "#8a93a6");
  const g = [];
  for (const e of edges) { const [x1, y1] = pos[e.a], [x2, y2] = pos[e.b]; g.push(s("line", { x1, y1, x2, y2, stroke: col(e.v), "stroke-width": 1.2, "stroke-opacity": 0.5, "stroke-dasharray": e.tag ? "" : "3 3" })); }
  for (const n of nodes) { const [x, y] = pos[n.id]; const mis = Math.sign(Math.round(n.mine / 20)) !== Math.sign(Math.round(n.theirs / 20)); g.push(s("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: col(n.mine), "stroke-width": 1 + Math.abs(n.mine) / 25, "stroke-dasharray": mis ? "6 4" : "", "stroke-linecap": "round" })); }
  g.push(s("circle", { cx, cy, r: 24, fill: "#7CB7E8", stroke: "#0E1C28", "stroke-width": 1.5 }), s("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-family": "Noto Sans KR, sans-serif", "font-size": 14, fill: "#0E1C28" }, p.name));
  for (const n of nodes) {
    const [x, y] = pos[n.id], sel = graphSel === n.id;
    const grp = s("g", { class: "node", tabindex: 0, role: "button", "aria-label": `${n.name} 관계 보기` }, s("circle", { cx: x, cy: y, r: sel ? 19 : 16, fill: "#1E2124", stroke: col(n.mine), "stroke-width": sel ? 4 : 2.5 }),
      s("text", { x, y: y + 4.5, "text-anchor": "middle", "font-family": "Noto Sans KR, sans-serif", "font-size": 12.5, fill: "#E4E6E8" }, n.name.length > 3 ? n.name.slice(0, 3) : n.name),
      n.tag ? s("text", { x, y: y + 31, "text-anchor": "middle", "font-size": 11, "font-family": "Noto Sans KR, sans-serif", fill: col(n.mine) }, n.tag) : null);
    const pk = () => { graphSel = n.id; renderWin(); };
    grp.addEventListener("click", pk); grp.addEventListener("keydown", (e) => { if (e.key === "Enter") pk(); });
    g.push(grp);
  }
  out.push(h("div", { class: "graph" }, s("svg", { viewBox: `0 0 ${Wd} ${Hd}`, role: "img", "aria-label": "나를 중심으로 한 관계도" }, ...g)),
    h("p", { class: "small muted" }, "가까울수록 마음이 깊다. 초록은 호감, 빨강은 미움, 점선은 내 마음과 상대의 태도가 엇갈리는 사이다."));
  const selId = graphSel !== null && W.npcs[graphSel] ? graphSel : sorted[0].id;
  const x = W.npcs[selId], mine = A.opinion(p, x.id), theirs = A.opinion(x, p.id);
  const att = theirs >= 50 ? "나를 무척 반기는 것 같다" : theirs >= 20 ? "호의적인 것 같다" : theirs > -20 ? "그저 그렇게 대한다" : theirs > -50 ? "탐탁지 않아 한다" : "노골적으로 미워한다";
  const rs = S.reasons(W, x.id);
  out.push(h("div", { class: "card" }, h("div", { class: "ttl" }, h("span", null, `${x.name} · ${A.RACES[x.race].name} ${W.jobName(x)}${S.relTag(p, x) ? " · " + S.relTag(p, x) : ""}`), h("span", { class: "small muted" }, x.alive ? (x.at_war ? "전선" : W.towns[x.town].name) : "고인")),
    h("div", null, `내 마음: ${S.attitudeWord(mine)} (${mine > 0 ? "+" : ""}${Math.round(mine)})`), h("div", null, `상대의 태도: ${att}`, h("span", { class: "small muted" }, " · 짐작일 뿐")),
    h("h3", null, "이 관계를 만든 일들"),
    rs.length ? h("ul", { class: "list" }, rs.map(({ e, j }) => h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text, h("span", { class: "src " + j.s }, S.sourceText(W, j)))))) : h("p", { class: "small muted" }, "큰 사건은 없다. 이야기를 나누며 쌓인 사이다.")));
  return out;
}
function winNews() {
  const eps = W.episodes.filter((e) => !e.block);
  if (!eps.length) return [h("p", { class: "muted" }, "답을 기다리는 일이 없다.")];
  return [h("p", { class: "small muted", style: "margin-top:0" }, "사흘 안에 답하지 않으면 그냥 지나간다."), ...eps.map((ep) => h("div", { class: "card" }, h("div", { class: "ttl" }, h("span", null, ep.title), h("span", { class: "small muted" }, `${W.date(ep.day)} ${ep.t}`)), h("p", { style: "margin:6px 0" }, ep.text),
    h("div", { class: "row" }, ep.choices.map((c) => h("button", { class: "wbtn", type: "button", title: c.hint || "", onclick: () => { const r = S.resolve(W, ep.id, c.id); if (r) toast(r); renderWin(); } }, c.label)))))];
}
function winStory() {
  const p = W.player, out = [];
  if (!playing() || godView) {
    out.push(h("div", { class: "filters" }, playing() ? h("label", { class: "row small" }, h("input", { type: "checkbox", checked: true, onchange: () => { godView = false; renderWin(); } }), "신의 시점 (모든 사건)") : h("span", { class: "small muted" }, "캐릭터가 없어서 세계의 모든 일을 보여 준다.")));
    const list = [];
    for (let i = W.events.length - 1; i >= 0 && list.length < 150; i--) { const e = W.events[i]; if (!e || e.imp < 3) continue; const known = p && p.known.has(e.id); list.push(h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text, playing() ? h("span", { class: "src " + (known ? "self" : "unknown") }, known ? "알고 있음" : "모르는 일") : null))); }
    out.push(h("ul", { class: "list" }, list));
    return out;
  }
  out.push(h("div", { class: "filters" },
    h("select", { "aria-label": "출처", onchange: (e) => { storyFilter = e.target.value; renderWin(); } }, [["all", "모든 출처"], ["seen", "직접 본 일"], ["told", "들은 이야기"], ["paper", "신문에서 읽은 일"], ["self", "내가 겪은 일"]].map(([v, l]) => h("option", { value: v, selected: storyFilter === v }, l))),
    h("label", { class: "row small" }, h("input", { type: "checkbox", onchange: () => { godView = true; renderWin(); } }), "신의 시점")),
    h("p", { class: "small muted", style: "margin:0 0 6px" }, "어떻게 알게 됐는지와 함께 기록된다. 직접 보지 않은 일은 누군가에게 듣거나 신문에서 읽어야만 알 수 있다."));
  const seen = new Set(), list = [];
  for (let i = W.journal.length - 1; i >= 0 && list.length < 200; i--) {
    const j = W.journal[i], e = W.events[j.e];
    if (!e || seen.has(e.id) || (storyFilter !== "all" && j.s !== storyFilter)) continue;
    seen.add(e.id);
    list.push(h("li", null, h("span", { class: "d" }, W.date(j.d)), h("span", { class: "t" }, e.text, h("span", { class: "src " + j.s }, S.sourceText(W, j)), e.day !== j.d ? h("span", { class: "small muted" }, ` · 일어난 날 ${W.date(e.day)}`) : null)));
  }
  out.push(list.length ? h("ul", { class: "list" }, list) : h("p", { class: "muted" }, "아직 아는 이야기가 없다."));
  return out;
}
function winPapers() {
  if (!W.papers.length) return [h("p", { class: "muted" }, "아침 6시가 되면 신문이 온다.")];
  const pick = (pp) => { win = "paper"; winArg = pp; pp.unread = false; renderWin(); };
  return [h("ul", { class: "list" }, W.papers.slice().reverse().map((pp) => { const top = W.events[pp.items[0]]; return h("li", { class: "click", onclick: () => pick(pp) }, h("span", { class: "d" }, W.date(pp.day)), h("span", { class: "t" }, `${pp.unread ? "🆕 " : ""}${top ? top.text : (pp.local || []).length ? W.events[pp.local[0]].text : "조용한 하루"}`, h("span", { class: "small muted" }, ` · 기사 ${pp.items.length + (pp.follow || []).length + (pp.local || []).length}건`))); }))];
}
function winPaper() {
  const pp = winArg, items = pp.items.map((id) => W.events[id]).filter(Boolean), top = items[0], bySec = {};
  for (const e of items.slice(1)) (bySec[S.paperSection(e.kind)] = bySec[S.paperSection(e.kind)] || []).push(e);
  return [h("article", { class: "paper" },
    h("div", { class: "mast" }, h("h2", null, "탄드렐 조간"), pp.special ? h("div", { class: "special" }, pp.special) : null, h("div", null, h("span", null, W.date(pp.day)), h("span", null, `${pp.season}호`), h("span", null, pp.active ? `전황 · ${pp.lord}의 군대와 대치, 전선 ${pp.front}` : "전황 · 평화"))),
    top ? [h("div", { class: "sec" }, S.paperSection(top.kind)), h("h4", null, `${top.town ? "[" + W.towns[top.town].name + "] " : ""}${top.text}`)] : h("p", null, "간밤에 아스테리아는 조용했다."),
    Object.entries(bySec).map(([sec, es]) => [h("div", { class: "sec" }, sec), h("ul", null, es.map((e) => h("li", null, `${e.town ? "[" + W.towns[e.town].name + "] " : ""}${e.text}`)))]),
    (pp.local || []).length ? [h("div", { class: "sec" }, "우리 동네 단신"), h("ul", null, pp.local.map((id) => W.events[id]).filter(Boolean).map((e) => h("li", null, `[${W.towns[e.town].name}] ${e.text}`)))] : null,
    (pp.follow || []).length || (pp.diary || []).length ? [h("div", { class: "sec" }, "관심 인물 소식"), h("ul", null, (pp.follow || []).map((id) => W.events[id]).filter(Boolean).map((e) => h("li", null, h("b", null, e.text))), (pp.diary || []).map((d) => h("li", null, d.text)))]
      : null,
    h("p", { class: "small", style: "opacity:.7;margin:12px 0 0" }, "여기 실린 소식은 ‘이야기’에 ‘조간 신문’ 출처로 남는다."))];
}
/** 미션에 필요한 물건 */
function missionNeeds(m) {
  if (m.type === "fetch") return [[m.item, m.n]];
  if (m.type === "build" && !m.started) return Object.entries(m.needs);
  return [];
}
function winMissions() {
  const e = G.ext(W), act = e.missions.filter((m) => !m.done), done = e.missions.filter((m) => m.done).slice(-10).reverse();
  return [h("h3", null, `진행 중 ${act.length}/6`), act.length ? h("div", { class: "mlist" }, act.map((m) => {
      const needs = missionNeeds(m);
      return h("section", { class: "mcard" },
        h("div", { class: "mhead" }, h("b", null, S.missionTitle(W, m)), h("span", { class: "muted small" }, [S.missionWhere(W, m), m.reward ? `금화 ${m.reward}` : ""].filter(Boolean).join(" · "))),
        needs.length ? h("div", { class: "needs" }, needs.map(([id, n]) => needChip(id, n))) : null,
        h("button", { class: "link small", type: "button", onclick: () => { m.done = true; m.gaveUp = true; renderWin(); renderQuests(); } }, "포기"));
    }))
    : h("p", { class: "muted small" }, "없음"),
    done.length ? [h("h3", null, "마친 미션"), h("ul", { class: "list" }, done.map((m) => h("li", null, h("span", { class: "d" }, W.date(m.day)), h("span", { class: "t muted" }, `${m.gaveUp ? "(포기) " : ""}${S.missionTitle(W, m)}`))))] : null];
}
/* 도감: 내가 얻어 본 것, 내가 아는 것만 있다. 전체가 몇 개인지는 알려 주지 않는다 */
let codexCat = "mat", codexSel = null;
function codexEntries(cat) {
  const p = W.player, e = G.ext(W), c = e.codex || {};
  if (cat === "magic" || cat === "tech") {
    const ks = A.CONTENT.knowledge.filter((k) => !!k.lost === (cat === "magic") && p && A.knows(p, k.id)).map((k) => ({ key: "k:" + k.id, name: k.name }));
    if (cat === "tech" && p) ks.unshift({ key: "k:job", name: G.SKILL[p.job].name });
    return ks;
  }
  return Object.keys(c).filter((id) => G.ITEMS[id] && G.catOf(id) === cat).sort((a, b) => c[a].d - c[b].d).map((id) => ({ key: id, name: G.ITEMS[id].name, id }));
}
function codexDetail(key) {
  const p = W.player, e = G.ext(W);
  const rlist = (rs) => h("div", { class: "chips" }, rs.map((r) => r.build ? h("span", { class: "chip" }, r.name) : h(G.codexHas(W, r.out) ? "button" : "span", { class: "chip", type: "button", onclick: G.codexHas(W, r.out) ? () => openWin("codex", r.out) : undefined }, G.ITEMS[r.out].name)));
  if (key.startsWith("k:")) {
    const kid = key.slice(2);
    if (kid === "job") { const sk = G.SKILL[p.job]; return [h("div", { class: "cxhead" }, icon("skill", 40), h("div", null, h("div", { class: "nm" }, sk.name), h("div", { class: "muted small" }, `직업 기술 · ${W.jobName(p)}`))), sk.hint ? h("p", null, sk.hint) : null]; }
    const K = A.KNOW(kid), rs = A.CONTENT.recipes.filter((r) => r.know === kid);
    return [h("div", { class: "cxhead" }, h("div", null, h("div", { class: "nm" }, K.name), h("div", { class: "muted small" }, `${K.lost ? "마법" : "기술"} · ${A.SKILL_LV_NAME[Math.max(1, A.skillLv(p, kid))]}`))), K.desc ? h("p", null, K.desc) : null,
      rs.length ? [h("h4", null, "만들 수 있는 것"), rlist(rs)] : null];
  }
  const id = key, it = G.ITEMS[id], ent = (e.codex || {})[id] || { ways: [] };
  const facts = [it.energy ? `기력 +${it.energy}` : null, it.heal ? `체력 +${it.heal}` : null, it.weapon ? `공격 ${it.weapon}` : null, it.yield ? `나무 ${it.yield}` : null, it.price ? `값 ${it.price}닢` : null, it.sell ? `팔면 ${it.sell}닢` : null].filter(Boolean);
  const known = G.knownRecipes(W), makes = known.filter((r) => r.out === id), uses = known.filter((r) => r.needs[id]);
  const crop = Object.values(G.CROPS).find((c) => c.item === id || "seed_" + c.item === id || (id === "seed_berry" && c.item === "strawberry"));
  return [h("div", { class: "cxhead" }, icon(id, 40), h("div", null, h("div", { class: "nm" }, it.name), h("div", { class: "muted small" }, `${(G.CODEX_CATS.find(([k]) => k === G.catOf(id)) || [, ""])[1]} · ${W.date(ent.d)}`))),
    facts.length ? h("div", { class: "chips" }, facts.map((f) => h("span", { class: "chip" }, f))) : null,
    crop && it.seed ? h("div", { class: "chips" }, h("span", { class: "chip" }, crop.seasons.join("·")), h("span", { class: "chip" }, `${crop.days}일`)) : null,
    ent.ways.length ? [h("h4", null, "얻은 방법"), h("table", { class: "facts" }, h("tbody", null, ent.ways.map((wy) => h("tr", null, h("th", null, wy.how), h("td", null, wy.at.join(", "))))))] : null,
    makes.length ? [h("h4", null, "재료"), makes.map((r) => h("div", { class: "needs" }, Object.entries(r.needs).map(([nid, n]) => needChip(nid, n)), r.station === "workbench" ? h("span", { class: "chip" }, "작업대") : null))] : null,
    uses.length ? [h("h4", null, "쓰이는 곳"), rlist(uses)] : null];
}
function winCodex() {
  if (!playing()) return [h("p", null, "캐릭터가 없다.")];
  const list = codexEntries(codexCat);
  if (!list.some((x) => x.key === codexSel)) codexSel = list[0] ? list[0].key : null;
  return [h("div", { class: "cats", role: "tablist" }, G.CODEX_CATS.map(([k, label]) => { const n = codexEntries(k).length; return h("button", { type: "button", role: "tab", "aria-selected": String(codexCat === k), onclick: () => { codexCat = k; codexSel = null; renderWin(); } }, label, h("span", { class: "cnt" }, String(n))); })),
    h("div", { class: "codex" },
      h("div", { class: "cxlist" }, list.length ? list.map((x) => h("button", { type: "button", class: "cxitem", "aria-pressed": String(codexSel === x.key), onclick: () => { codexSel = x.key; renderWin(); } }, x.id ? icon(x.id, 28) : null, h("span", null, x.name))) : h("p", { class: "muted small" }, "비어 있다")),
      codexSel ? h("div", { class: "cxdetail" }, codexDetail(codexSel)) : null)];
}
let pTown = "", pJob = "";
function winPeople() {
  const out = [];
  if (bioId !== null && W.npcs[bioId]) out.push(bioCard(W.npcs[bioId]));
  const sc = A.storyScore(W), p = playing() ? W.player : null;
  const list = W.npcs.filter((n) => (pMode === "all" || (pMode === "follow" ? following(n.id) : (pMode === "alive") === n.alive)) && (!pSearch || n.name.includes(pSearch))
      && (!pTown || (n.alive && !n.at_war && n.town === pTown)) && (!pJob || n.job === pJob))
    .sort((a, b) => (following(b.id) - following(a.id)) || (sc.get(b.id) || 0) - (sc.get(a.id) || 0)).slice(0, 120);
  const sel = (label, val, opts, set) => h("select", { "aria-label": label, onchange: (e) => { set(e.target.value); renderWin(); } }, opts.map(([v, l]) => h("option", { value: v, selected: val === v }, l)));
  out.push(h("div", { class: "filters" }, h("input", { type: "search", placeholder: "이름 검색 (엔터)", "aria-label": "이름 검색", value: pSearch, onchange: (e) => { pSearch = e.target.value; renderWin(); } }),
    sel("보기", pMode, [["alive", "살아 있는 사람"], ["follow", "관심 인물"], ["dead", "세상을 떠난 사람"], ["all", "모두"]], (v) => { pMode = v; }),
    sel("마을", pTown, [["", "모든 마을"], ...Object.values(W.towns).map((t) => [t.id, t.name])], (v) => { pTown = v; }),
    sel("직업", pJob, [["", "모든 직업"], ...A.CONTENT.jobs.map((j) => [j.id, j.name])], (v) => { pJob = v; }),
    h("span", { class: "small muted" }, `${list.length}명`)));
  out.push(h("div", { class: "tablewrap" }, h("table", { class: "people" }, h("thead", null, h("tr", null, ["", "이름", "종족·직업", "나이", "마을", p ? "나와의 사이" : "꿈", "명성"].map((t) => h("th", null, t)))),
    h("tbody", null, list.map((n) => h("tr", { class: (n.alive ? "" : "dead") + (bioId === n.id ? " sel" : ""), onclick: () => { bioId = n.id; renderWin(); $("#win .body").scrollTop = 0; } },
      h("td", null, h("button", { class: "starbtn", type: "button", "aria-pressed": String(following(n.id)), "aria-label": `${n.name} 관심 인물`, onclick: (e) => { e.stopPropagation(); toggleFollow(n.id); renderWin(); } }, following(n.id) ? "★" : "☆")),
      h("td", null, h("span", { class: "jdot", style: `background:${jobColor(n.job)}` }), n.name, n.controller === "player" ? " · 나" : ""), h("td", null, `${A.RACES[n.race].name} ${W.jobName(n)}`), h("td", { class: "num" }, A.age(n)),
      h("td", null, n.alive ? (n.at_war ? "전선" : W.towns[n.town].name) : "고인"),
      h("td", { class: "muted" }, p ? (n.id === p.id ? "" : S.relTag(p, n) || (Math.abs(A.opinion(p, n.id)) >= 8 ? S.attitudeWord(A.opinion(p, n.id)) : "모르는 사이")) : n.dream ? A.dreamName(n) : "—"),
      h("td", { class: "num" }, n.fame)))))));
  return out;
}
const TRAIT_WORDS = [["kindness", 0.68, "다정함"], ["kindness", -0.25, "냉정함"], ["greed", 0.68, "돈에 밝음"], ["bravery", 0.72, "용감함"], ["bravery", -0.3, "겁이 많음"], ["ambition", 0.72, "야심만만"], ["ambition", -0.2, "욕심 없음"]];
function traitWords(n) { return TRAIT_WORDS.filter(([k, v]) => (v > 0 ? n.traits[k] >= v : n.traits[k] <= -v)).map(([, , l]) => l); }
function meter(v, col) { return h("span", { class: "meter" }, h("span", { style: `width:${Math.round(v * 100)}%;background:${col || "var(--gold)"}` })); }
/** 인물 수첩: 이 사람에 대해 '내가 아는 것'만 보여 준다. 캐릭터가 없으면 신의 시점으로 전부 보인다. */
function bioCard(n) {
  const hs = Object.entries(n.heritage || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); // 혈통: 섞인 경우에만, 가족 칸 안에
  const mixed = hs.length > 1 ? hs.map(([k, v]) => `${A.RACES[k] ? A.RACES[k].name : k} ${Math.round(v * 100)}%`).join(" · ") : "";
  const p = W.player, pov = playing() && n.id !== p.id;
  const life = W.lifeOf(n.id, 2).filter((e) => !pov || p.known.has(e.id));
  const fam = S.familyList(W, n);
  const canTake = n.alive && A.isAdult(n) && n.controller !== "player";
  const mine = pov ? A.opinion(p, n.id) : 0, theirs = pov ? A.opinion(n, p.id) : 0;
  const acquainted = !pov || Math.abs(mine) >= 8 || Math.abs(theirs) >= 15 || life.some((e) => e.actor === p.id || e.target === p.id) || S.knowsDream(W, n);
  const dreamKnown = n.dream && (!pov || S.knowsDream(W, n));
  const k = G.walkers.get(n.id), here = playing() && k && !k.inside && n.alive && !n.at_war && n.town === G.townAt(W.ppos.x, W.ppos.y);
  const status = !n.alive ? `${W.date(n.death_day)}에 ${n.death_cause} 세상을 떠났다` : n.at_war ? (n.role === "hero" ? "용사로서 전선에 있다" : "전선에서 싸우는 중") : n.jail > 0 ? `${W.towns[n.town].name} 감옥에 갇혀 있다` : `${W.towns[n.town].name}에 산다${here ? ` · 지금 ${G.activity(W, n)}` : ""}`;
  const tag = pov ? S.relTag(p, n) : "";
  const tw = acquainted ? traitWords(n) : [];
  const dreamBox = h("div", { class: "card soft" }, h("div", { class: "ttl" }, h("span", null, "꿈"), dreamKnown ? h("span", { class: "small muted" }, `${W.ago(n.dream.since)}부터`) : null),
    !n.alive ? h("p", { class: "small muted" }, "이제는 이룰 수 없는 꿈이 되었다.")
      : !A.isAdult(n) ? h("p", { class: "small muted" }, "아직 어린아이다.")
      : !n.dream ? h("p", { class: "small muted" }, pov && !acquainted ? "아직 모른다. 말을 걸어 ‘꿈이 뭐예요?’라고 물어보자." : "지금은 딱히 바라는 것이 없어 보인다.")
      : dreamKnown ? [h("div", { class: "dream" }, A.dreamName(n)), h("div", { class: "small muted" }, A.DREAMS[n.dream.id].text(n, W, n.dream)), h("div", { class: "row", style: "margin-top:6px" }, meter(A.dreamProgress(n, W), "#8fdc8a"), h("span", { class: "small num" }, `${Math.round(A.dreamProgress(n, W) * 100)}%`))]
      : h("p", { class: "small muted" }, "무언가를 바라며 사는 것 같지만, 아직 들은 적이 없다. ‘꿈이 뭐예요?’라고 물어보자."));
  const relBox = pov ? h("div", { class: "card soft" }, h("div", { class: "ttl" }, h("span", null, "나와의 사이"), tag ? h("span", { class: "chip gold" }, tag) : null),
    h("div", { class: "relrow" }, h("span", null, "내 마음"), meter((mine + 100) / 200, mine >= 0 ? "#8fdc8a" : "#ff7a68"), h("span", { class: "small" }, S.attitudeWord(mine))),
    h("div", { class: "relrow" }, h("span", { title: "말과 행동으로 짐작한 것" }, "상대 태도"), acquainted ? meter((theirs + 100) / 200, theirs >= 0 ? "#8fdc8a" : "#ff7a68") : meter(0, "#666"), h("span", { class: "small" }, acquainted ? S.attitudeWord(theirs) : "모름"))) : null;
  return h("div", { class: "bio" },
    h("div", { class: "biohead" }, portraitCanvas(n, 76),
      h("div", { style: "min-width:0;flex:1" },
        h("div", { class: "bioname" }, n.name, h("span", { class: "muted small" }, ` ${A.RACES[n.race].name} ${W.jobName(n)}${n.side && A.JOBS[n.side] && A.isAdult(n) ? `(부업 ${A.JOBS[n.side].name})` : ""} · ${A.age(n)}세 · 명성 ${n.fame}`)),
        h("div", { class: "small" }, status),
        n.title ? h("div", { class: "small", style: "color:var(--gold)" }, n.title) : null,
        n.pioneer ? h("div", { class: "small", style: "color:var(--gold)" }, `이 세계 최초의 ${A.JOBS[n.pioneer].name}`) : null,
        n.follows !== undefined && n.follows !== null && W.npcs[n.follows] ? h("div", { class: "small" }, `${W.npcs[n.follows].name}의 새 나라에 함께하기로 했다`) : null,
        n.bio ? h("div", { class: "small", style: "color:#e8dcb8;font-style:italic;margin-top:2px" }, `“${n.bio}”`) : null,
        h("div", { class: "chips" }, tw.length ? tw.map((t) => h("span", { class: "chip" }, t)) : h("span", { class: "small muted" }, pov ? "아직 잘 모르는 사람이다." : ""), n.dream && dreamKnown ? h("span", { class: "chip green" }, "꿈: " + A.dreamName(n)) : null)),
      h("div", { class: "bioacts" },
        n.id !== (p && p.id) ? h("button", { class: "wbtn" + (following(n.id) ? " gold" : ""), type: "button", "aria-pressed": String(following(n.id)), title: "관심 인물의 소식은 작은 일까지 매일 아침 신문에 실린다", onclick: () => { toggleFollow(n.id); renderWin(); } }, following(n.id) ? "관심 인물 해제" : "관심 인물로 두기") : null,
        here ? h("button", { class: "wbtn", type: "button", onclick: () => { const id = n.id; closeWin(); walkTo(k.x, k.y, () => openTalk(id)); } }, "찾아가 말 걸기") : null,
        canTake ? h("button", { class: "link small", type: "button", onclick: () => takeOver(n) }, "이 인물로 살아보기") : null,
        h("button", { class: "link small", type: "button", onclick: () => { bioId = null; renderWin(); } }, "수첩 닫기"))),
    h("div", { class: "grid2" },
      h("div", null, dreamBox, relBox,
        (fam.length || mixed) ? h("div", { class: "card soft" }, h("div", { class: "ttl" }, "가족"),
          fam.length ? h("div", { class: "fam" }, fam.map((f) => h("button", { type: "button", onclick: () => { bioId = f.x.id; renderWin(); } }, h("b", null, f.rel), f.x.name, f.x.alive ? "" : " (고인)"))) : null,
          mixed ? h("div", { class: "small muted" }, `혈통 ${mixed}`) : null) : null),
      h("div", null, h("h3", { style: "margin-top:0" }, pov ? `내가 아는 ${n.name}의 일` : "일대기"),
        life.length ? h("ul", { class: "list compact" }, life.slice(-30).reverse().map((e) => { const j = pov ? [...W.journal].reverse().find((x) => x.e === e.id) : null; return h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text, j ? h("span", { class: "src " + j.s }, S.sourceText(W, j)) : null)); }))
          : h("p", { class: "small muted" }, pov ? "아는 일이 아직 없다." : "기록된 일이 없다."))));
}
/** 나라·직업: 이 세계에서 스스로 생겨난 것들. 세계마다 다르다 */
function winNations() {
  const nations = {};
  for (const t of Object.values(W.towns)) (nations[t.nation] = nations[t.nation] || []).push(t);
  const nm = (id) => A.nationName(W, id);
  const founded = W.founded || [], born = W.events.filter((e) => e && e.kind === "job_born");
  const dreamer = W.alive().find((n) => n.dream && n.dream.id === "nation");
  const who = (id) => W.npcs[id] ? h("button", { class: "link", type: "button", onclick: () => { bioId = id; openWin("people"); } }, W.npcs[id].name) : "누군가";
  return [
    h("h3", { style: "margin-top:0" }, "이 세계의 나라"),
    h("div", { class: "towns" }, Object.entries(nations).map(([nid, ts]) => {
      const N = W.nations[nid] || {}, name = nm(nid);
      const f = N.founder !== null && N.founder !== undefined ? { founder: N.founder, day: N.since, indep: N.from ? nm(N.from) : null } : null;
      const pop = ts.reduce((s, t) => s + W.residents(t.id).length, 0);
      return h("div", { class: "card town" + (f ? " here" : "") }, h("div", { class: "ttl" }, h("span", null, name), f ? h("span", { class: "chip gold" }, f.indep ? `${f.indep}에서 독립` : "이 세계에서 세워짐") : h("span", { class: "chip" }, "옛 나라")),
        h("div", { class: "small" }, `마을 ${ts.map((t) => t.name).join(", ")} · 주민 ${pop}명${N.race && A.RACES[N.race] ? ` · ${A.RACES[N.race].name}의 나라` : ""}`),
        f ? h("div", { class: "small", style: "margin-top:4px" }, `${W.date(f.day)}, `, who(f.founder), W.npcs[f.founder] ? jo(W.npcs[f.founder].name, "이/가").slice(W.npcs[f.founder].name.length) + " 세웠다" : " 세웠다", W.npcs[f.founder] && W.npcs[f.founder].title ? ` · ${W.npcs[f.founder].title}` : "") : null);
    })),
    (() => { const gone = Object.values(W.nations).filter((N) => N.ended !== undefined && N.ended !== null); return gone.length ? h("p", { class: "small muted", style: "margin:8px 0 0" }, "사라진 나라: ", gone.map((N) => `${N.name} (${W.date(N.since)} ~ ${W.date(N.ended)})`).join(", ")) : null; })(),
    dreamer ? h("div", { class: "card soft", style: "margin-top:10px" }, h("div", { class: "ttl" }, "새 나라를 꿈꾸는 사람"), h("div", { class: "small" }, who(dreamer.id), ` (${W.towns[dreamer.town].name}) — ${A.DREAMS.nation.text(dreamer, W, dreamer.dream)}`), h("div", { class: "small muted" }, "그를 찾아가 ‘꿈이 뭐예요?’라고 물으면 함께할 수 있다.")) : null,
    h("h3", null, "이 세계의 종족"),
    h("div", { class: "chips" }, A.racesInWorld(W).map((r) => h("span", { class: "chip" + (r.hidden || r.mix ? " gold" : ""), title: r.culture ? `${({ honor: "명예", wealth: "재물", harmony: "조화", lore: "앎", wild: "자연", craft: "솜씨" })[r.culture.value]}를 귀하게 여긴다 · ${r.culture.festival.season} ‘${r.culture.festival.name}’` : r.mix ? "두 종족 사이에서 태어났다" : r.hidden ? "어느 날 나타났다" : "" }, `${r.name} ${W.alive().filter((n) => n.race === r.id).length}명`))),
    (() => { const ev = W.events.filter((e) => e && ["race_born", "contact", "independence", "discovery"].includes(e.kind)); return ev.length ? h("ul", { class: "list", style: "margin-top:6px" }, ev.slice(-8).reverse().map((e) => h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text)))) : null; })(),
    h("h3", null, "이 세계에서 처음 생긴 일"),
    born.length ? h("ul", { class: "list" }, born.map((e) => h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text)))) : h("p", { class: "small muted" }, "아직 없다. 사람들의 삶에 필요가 쌓이면 누군가 새 일을 시작한다."),
    h("p", { class: "small muted" }, `아직 이 세계에 없는 일: ${A.CONTENT.jobs.filter((j) => !W.jobOpen(j.id)).map((j) => j.name).join(", ") || "없음"}`)];
}
/** 마을: 세계를 마을 단위로 훑어본다 */
function winTowns() {
  const p = playing() ? W.player : null, sc = A.storyScore(W);
  return [
    h("div", { class: "towns" }, Object.values(W.towns).map((t) => {
      const res = W.residents(t.id), adults = res.filter(A.isAdult), price = W.foodPrice(t);
      const recent = W.events.filter((e) => e && e.town === t.id && e.imp >= 3 && W.day - e.day <= 30 && (!p || p.known.has(e.id))).slice(-3).reverse();
      const notable = adults.slice().sort((a, b) => (sc.get(b.id) || 0) - (sc.get(a.id) || 0)).slice(0, 4);
      const jobs = {}; for (const n of adults) jobs[n.job] = (jobs[n.job] || 0) + 1;
      const mood = t.fallen ? ["함락됨", "bad"] : price >= 4 ? ["굶주림", "bad"] : t.worry ? ["겨울 걱정", "mid"] : price >= 2 ? ["빠듯함", "mid"] : ["넉넉함", "good"];
      return h("div", { class: "town card" + (p && p.town === t.id ? " here" : "") },
        h("div", { class: "ttl" }, h("span", null, t.name, h("span", { class: "small muted" }, ` · ${A.nationName(W, t.nation)}${t.border ? " · 국경" : ""}`)), h("span", { class: "chip " + mood[1] }, mood[0])),
        h("div", { class: "small" }, `주민 ${res.length}명 · 곡식 한 끼 ${price}닢${t.store >= 1 ? ` · 곳간 비축 ${Math.round(t.store)}` : ""}${p && p.home === t.id ? " · 내 집" : ""}`),
        t.agri && (t.agri.ids.length || t.agri.breed) ? h("div", { class: "small muted" }, `농법 ${t.agri.ids.map((id) => (A.CONTENT.innovations.find((x) => x.id === id) || {}).name).join("·")}${t.agri.breed ? ` · ${t.agri.breed}대 개량` : ""} · 수확 ×${A.farmMult(t).toFixed(2)}`) : null,
        h("div", { class: "jobs" }, Object.entries(jobs).sort((a, b) => b[1] - a[1]).map(([j, c]) => h("span", { class: "chip" }, `${A.JOBS[j].name} ${c}`))),
        h("div", { class: "sub" }, "이름난 사람"), h("div", { class: "fam" }, notable.map((n) => h("button", { type: "button", onclick: () => { bioId = n.id; openWin("people"); } }, following(n.id) ? "★ " : "", n.name, h("span", { class: "muted" }, ` ${W.jobName(n)}`)))),
        h("div", { class: "sub" }, "요즘 이 마을"), recent.length ? h("ul", { class: "mini" }, recent.map((e) => h("li", null, h("span", { class: "muted" }, W.ago(e.day) + " "), e.text))) : h("div", { class: "small muted" }, p ? "들려온 소식이 없다." : "조용하다."));
    }))];
}
function takeOver(n) {
  const old = W.player;
  if (old && old.alive) old.controller = "ai";
  n.controller = "player"; n.energy = 100; if (!n.home) n.home = n.town;
  G.resetLife(W);
  W.playerId = n.id; W.autoDays = 0; W.ppos = null; W.journal = [];
  const e = G.ext(W);
  const oc = G.onCodex; G.onCodex = null;
  for (const id of ["hand", "hoe", "can", "seed_turnip", "axe", A.JOBS[n.job].fighter ? "sword" : "dagger", "skill", "bread"]) G.give(W, id, id === "seed_turnip" ? 6 : id === "bread" ? 2 : 1);
  G.onCodex = oc;
  for (const m of n.mem) if (W.events[m.e]) W.journal.push({ e: m.e, d: W.events[m.e].day, t: 0, s: m.f ? (W.events[m.e].actor === n.id || W.events[m.e].target === n.id ? "self" : "seen") : "told", v: m.v });
  G.setup(W);
  W.record("takeover", `${jo(n.name, "이/가")} 새로운 마음가짐으로 하루를 시작했다`, { actor: n.id, town: n.town, imp: 3, wr: 0 });
  view.cam = { x: W.ppos.x, y: W.ppos.y }; speed = 1; hotSig = "";
  S.welcomePaper(W);
  autosave(); closeWin();
}
function winChron() {
  const ids = W.chronicle.slice().reverse().slice(0, 80), chains = A.feuds(W, 5);
  return [h("h3", null, "세계 연대기"), ids.length ? h("ul", { class: "list" }, ids.map((id) => { const e = W.events[id]; return e ? h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" }, e.text)) : null; })) : h("p", { class: "muted" }, "아직 역사에 남을 일은 없다."),
    h("h3", null, "원한의 사슬"), chains.length ? chains.map((ch) => h("div", { class: "chain" }, h("ul", { class: "list" }, ch.map((e) => h("li", null, h("span", { class: "d" }, W.date(e.day)), h("span", { class: "t" + (e.kind === "vow" ? " muted" : "") }, e.text)))))) : h("p", { class: "muted" }, "꼬리를 무는 원한은 아직 없다.")];
}
function winHelp() {
  const k = (a, b) => [h("span", null, a.split(" ").map((x) => h("kbd", null, x))), h("span", null, b)];
  return [h("div", { class: "grid2" },
    h("div", null, h("h3", null, "조작"), h("div", { class: "keys" }, k("W A S D", "걷기 (방향키도 된다)"), k("Shift", "달리기 (기력을 쓴다)"), k("Space", "손에 든 도구를 앞에 쓰기"), k("E", "말 걸기 · 건물 들어가기 · 줍기"), k("1 … 0", "단축바 고르기"),
      k("좌클릭", "도구 쓰기 · 걸어가기 · 말 걸기"), k("우클릭", "그냥 걸어가기"), k("휠", "확대 · 축소"), k("C I K R Q", "나: 정보·가방·만들기·관계·미션"), k("N J", "소식: 신문·이야기"), k("P T", "세계: 인물·마을"), k("M B H", "지도 · 도감 · 도움말"), k("Esc", "창 닫기"))),
    h("div", null, h("h3", null, "기본"), h("table", { class: "facts" }, h("tbody", null, [
      ["도감", "B. 얻어 본 것과 얻은 방법이 쌓인다"],
      ["돈", "열매·재료를 시장에 판다. 주민 심부름, 길드 의뢰"],
      ["만들기", "K. 작업대는 집 옆에 세우고, 작업대 물건은 작업대 앞에서 E"],
      ["농사", "괭이로 갈고 씨앗을 심고 매일 물을 준다. 계절이 맞아야 자란다"],
      ["사냥", "돌멩이를 들고 짐승을 누르면 던진다. 무기는 휘두른다"],
      ["지식", "그 일을 하는 주민에게 배운다. 비술 두루마리는 유적·흙더미(괭이)"],
      ["건물", "문으로 들어간다. 안에서 E로 볼일을 본다"],
      ["범죄", "목격되면 수배된다. 마을 밖에서 시간이 지나면 풀린다. 길드에서 자수"],
      ["하루", "06:00에 바뀐다. 자정이 지나면 기력이 준다"],
    ].map(([a, b]) => h("tr", null, h("th", null, a), h("td", null, b)))))))];
}
/* 태어나기. 이 세계에 이미 내 인물이 있었다면(죽었거나 바꾸려는 경우) 기본은 '새로운 세계에서 처음부터'.
 * 새 세계는 새 저장 칸에 만든다(칸이 가득 차면 지금 칸을 덮는다). 원하면 '이 세계에서 이어 살기'도 고를 수 있다. */
let bornMode = null;
// ------------------------------------------------------------ 직업 만들기
let jmDraft = null;
function winJobMake() {
  const p = W.player, d = jmDraft || (jmDraft = G.jobDraft(W, null)), wd = d.work, J = G.JOBMAKE;
  const re = () => renderWin(), touch = () => { d.tried = false; const box = $("#jmErr"); if (box) box.replaceChildren(...errView()); };
  const errView = () => { const er = G.checkJobDraft(W, d); return er.length ? er.map((x) => h("li", null, x)) : [h("li", { class: "ok" }, d.tried ? "등록할 수 있다" : "한 번 시험해 보면 등록할 수 있다")]; };
  const sel = (val, opts, set, label) => h("select", { class: "field", "aria-label": label, onchange: (e) => { set(e.target.value); d.tried = false; re(); } }, opts.map(([v, l]) => h("option", { value: v, selected: String(val) === String(v) }, l)));
  const txt = (val, max, set, ph) => h("input", { class: "field", value: val, maxlength: max, placeholder: ph, oninput: (e) => { set(e.target.value); touch(); } });
  const known = A.knownSkills(p).map((k) => [k, A.KNOW(k).name]);
  const tools = Object.keys(G.HANDS).filter(G.toolReady).map((t) => [t, G.HANDS[t].name]);
  const items = Object.keys(G.ITEMS).filter((id) => G.codexHas(W, id)).map((id) => [id, G.ITEMS[id].name]);
  const bagRow = (bag, label) => {
    let pick = items[0] ? items[0][0] : "", n = 1;
    return h("div", { class: "jmrow" }, h("span", { class: "small muted" }, label),
      h("div", { class: "chips" }, Object.entries(bag).map(([id, k]) => h("button", { type: "button", class: "chip", onclick: () => { delete bag[id]; d.tried = false; re(); }, "aria-label": `${G.ITEMS[id].name} 빼기` }, `${G.ITEMS[id].name} ×${k} ✕`))),
      items.length ? h("div", { class: "jmadd" }, h("select", { class: "field", "aria-label": label + " 고르기", onchange: (e) => { pick = e.target.value; } }, items.map(([v, l]) => h("option", { value: v }, l))),
        h("input", { class: "field num", type: "number", min: 1, max: 9, value: 1, "aria-label": "개수", oninput: (e) => { n = Math.max(1, Math.min(9, +e.target.value || 1)); } }),
        h("button", { type: "button", class: "wbtn", onclick: () => { if (pick) { bag[pick] = n; d.tried = false; re(); } } }, "더하기")) : h("span", { class: "small muted" }, "도감에 있는 물건만 고를 수 있다"));
  };
  const trialHost = h("div", { class: "jmtrial" });
  const startTrial = () => {
    const er = G.checkJobDraft(W, d).filter((x) => !/금화/.test(x));
    if (er.length) { toast(er[0], "warn"); return; }
    const wk = G.draftWork(d, "draft", "draft");
    trialHost.hidden = false;
    setTimeout(() => trialHost.scrollIntoView({ block: "nearest" }), 50);
    Sims.run(trialHost, wk, A.workLv(p, wk), (res) => { if (res) { d.tried = true; d.trialQ = res.scores ? A.workQuality(wk, res.scores) : null; } trialHost.hidden = true; re(); }, { client: null, vocab: A.KNOW(d.skill).vocab || null });
  };
  return [
    !d.addTo ? h("section", { class: "jm" }, h("h3", null, "직업"),
      h("div", { class: "jmgrid" },
        h("label", null, "이름", txt(d.name, 10, (v) => { d.name = v; }, "예: 향 조향사")),
        h("label", null, "바탕 기술", sel(d.skill, known, (v) => { d.skill = v; }, "바탕 기술")),
        h("label", null, "일터", sel(d.place, J.places, (v) => { d.place = v; }, "일터")),
        h("label", null, "모자", sel(d.hat, J.hats, (v) => { d.hat = v; }, "모자")),
        h("label", null, "손에 드는 것", sel(d.prop || "", J.props, (v) => { d.prop = v; }, "손에 드는 것"))),
      h("div", { class: "jmrow" }, h("span", { class: "small muted" }, "색"), h("div", { class: "swatches" }, J.colors.map((c) => h("button", { type: "button", class: "swatch", style: `background:${c}`, "aria-pressed": String(d.color === c), "aria-label": c, onclick: () => { d.color = c; re(); } }))))) 
      : h("p", { class: "muted small" }, `${A.JOBS[d.addTo].name}에 업무를 하나 더 짠다.`),
    h("section", { class: "jm" }, h("h3", null, "업무"),
      h("div", { class: "jmgrid" },
        h("label", null, "업무 이름", txt(wd.name, 12, (v) => { wd.name = v; }, "예: 향 섞기")),
        h("label", null, "걸리는 시간", sel(wd.mins, J.mins.map((m) => [m, m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? " 30분" : ""}` : `${m}분`]), (v) => { wd.mins = +v; }, "시간")),
        h("label", null, "일의 종류", sel(wd.kind, [["make", "만드는 일 (재료 → 물건)"], ["serve", "봉사하는 일 (손님에게)"]], (v) => { wd.kind = v; }, "종류")),
        wd.kind === "serve" ? h("label", null, "무엇을 하나", sel(wd.serve, Object.entries(J.serve).map(([k, s]) => [k, s.name]), (v) => { wd.serve = v; wd.client = ""; }, "봉사")) : h("span")),
      wd.kind === "make" ? [bagRow(wd.needs, "재료"), bagRow(wd.gives, "만들어 내는 것"),
        h("div", { class: "small muted" }, `값: 결과 ${Math.round(G.itemValue(wd.gives))} ≤ 재료 ${Math.round(G.itemValue(wd.needs))} + 품삯 ${Math.round(wd.mins / 30)}`)]
        : wd.serve === "bond" ? h("label", { class: "jmone" }, "손님", sel(wd.client || "foreign", [["foreign", "다른 나라 사람"], ...A.racesInWorld(W).map((r) => ["race:" + r.id, r.name])], (v) => { wd.client = v; }, "손님")) : null),
    h("section", { class: "jm" }, h("h3", null, `단계 ${wd.steps.length} / ${J.maxSteps}`),
      wd.steps.map((s, i) => h("div", { class: "jmstep" }, h("b", null, String(i + 1)),
        txt(s.name, 10, (v) => { s.name = v; }, G.HANDS[s.tool] ? G.HANDS[s.tool].name : "단계 이름"),
        sel(s.tool, tools, (v) => { s.tool = v; }, "조작"), sel(s.level, J.levels.map(([l], k) => [k, l]), (v) => { s.level = +v; }, "난이도"),
        h("button", { type: "button", class: "wbtn", disabled: wd.steps.length <= 1, "aria-label": `${i + 1}단계 빼기`, onclick: () => { wd.steps.splice(i, 1); d.tried = false; re(); } }, "빼기"),
        h("div", { class: "small muted howline" }, G.HANDS[s.tool] ? G.HANDS[s.tool].how : ""))),
      wd.steps.length < J.maxSteps ? h("button", { type: "button", class: "wbtn", onclick: () => { wd.steps.push({ name: "", tool: tools[0][0], level: 1 }); d.tried = false; re(); } }, "단계 더하기") : null),
    h("section", { class: "jm" }, h("ul", { class: "jmerr", id: "jmErr" }, errView()), trialHost,
      h("div", { class: "jmbtns" },
        h("button", { type: "button", class: "wbtn", onclick: startTrial }, "시험해 보기"),
        h("button", { type: "button", class: "wbtn gold", disabled: !d.tried || G.checkJobDraft(W, d).length > 0, onclick: () => {
          const r = G.createJob(W, d); toast(r.text, r.ok ? "good" : "warn"); if (r.ok) { jmDraft = null; autosave(); closeWin(); renderAll(); } } }, d.addTo ? "업무 등록하기" : `등록하기 (금화 ${J.cost})`))),
  ];
}
function winBorn() {
  const p = W.player, pastLife = !!p;
  const mode = pastLife ? bornMode || "new" : "here";
  // 새 세계는 아직 만들기 전이므로, 처음부터 있는 종족·직업·마을 중에서 고른다
  const races = mode === "new" ? A.CONTENT.races.filter((r) => !r.hidden && !r.mix) : A.racesInWorld(W);
  const jobs = mode === "new" ? A.CONTENT.jobs.filter((j) => !j.emerge) : W.openJobs();
  const towns = mode === "new" ? A.CONTENT.towns.map((t) => ({ id: t.id, name: t.name, nation: A.CONTENT.nations[t.nation] })) : Object.values(W.towns).filter((t) => !t.fallen).map((t) => ({ id: t.id, name: t.name, nation: A.nationName(W, t.nation) }));
  const submit = h("button", { class: "wbtn gold full", type: "submit" }, mode === "new" ? "새로운 세계에 태어나기" : "이 세계에서 다시 태어나기");
  const form = h("form", null,
    h("label", { class: "full" }, "이름", h("input", { class: "field", id: "bName", maxlength: 10, required: true, placeholder: "예: 하늘" })),
    h("label", null, "종족", h("select", { class: "field", id: "bRace" }, races.map((r) => h("option", { value: r.id }, r.name)))),
    h("label", null, "처음 직업", h("select", { class: "field", id: "bJob" }, jobs.map((j) => h("option", { value: j.id }, `${j.name} — ${G.SKILL[j.id].name}`)))),
    h("label", { class: "full" }, "살 마을", h("select", { class: "field", id: "bTown" }, towns.map((t) => h("option", { value: t.id }, `${t.name} · ${t.nation}`)))),
    submit);
  const birth = (opts) => {
    G.newLife(W, opts);
    view.cam = { x: W.ppos.x, y: W.ppos.y }; speed = settings.speed; obsRun = false; hotSig = ""; $("#bl").dataset.pid = ""; bornMode = null;
    S.welcomePaper(W);
    autosave(); closeWin(); toast(touchMode ? "왼쪽 아래 막대로 걷고, 오른쪽 버튼으로 말 걸기·도구 쓰기" : "이동 WASD · 말 걸기 E · 도구 Space · 도움말 H");
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.querySelector("#bName").value.trim().slice(0, 10);
    if (!name) return;
    const opts = { name, race: form.querySelector("#bRace").value, job: form.querySelector("#bJob").value, town: form.querySelector("#bTown").value };
    if (mode !== "new") { birth(opts); return; }
    submit.disabled = true; submit.textContent = "새로운 세계를 빚는 중…";
    setTimeout(() => {
      if (W.player && W.player.alive) autosave(); // 떠나는 세계는 제 칸에 남는다
      const seed = 1 + Math.floor(Math.random() * 999998);
      if (slotsList().length < MAX_SLOTS || !slotId) slotId = newSlotId();
      setWorld(freshWorld(seed, "탄드렐"), `새 세계 · 시드 ${seed}`);
      birth(opts);
    }, 20);
  });
  const nations = new Set(Object.values(W.towns).map((t) => t.nation)).size, born = (W.founded || []).length;
  const choose = pastLife ? h("div", { class: "tabs", style: "padding:0;background:none;border:0;margin:6px 0 10px" },
    h("button", { type: "button", class: "tab", "aria-selected": String(mode === "new"), onclick: () => { bornMode = "new"; renderWin(); } }, "새로운 세계에서 처음부터"),
    h("button", { type: "button", class: "tab", "aria-selected": String(mode === "here"), onclick: () => { bornMode = "here"; renderWin(); } }, "이 세계에서 이어 살기")) : null;
  const explain = !pastLife ? null : mode === "new"
    ? h("p", { class: "small muted", style: "margin:0 0 8px" }, "새 시드로 세계를 만들고 새 인물로 시작한다. 지금 세계는 불러오기 목록에 남는다.")
    : h("p", { class: "small muted", style: "margin:0 0 8px" }, `‘${W.name}’ ${W.year}년째 · 나라 ${nations}개${born ? ` (그중 ${born}개는 이 세계에서 세워짐)` : ""} · 주민 ${W.alive().length}명. 세계의 역사는 그대로 이어지고, 나는 이 세계의 새로운 사람으로 다시 시작한다.`);
  return [p && !p.alive ? h("p", { style: "margin-top:0" }, `${p.name}의 삶이 끝났다. ${W.date(p.death_day)}, ${p.death_cause} 세상을 떠났다.`)
    : h("p", { style: "margin-top:0" }, "빈손으로 시작한다. 가진 것은 맨손과 빵 한 조각, 금화 8닢이다."),
    choose, explain, form, h("p", { class: "small muted" }, "창을 닫으면 태어나지 않고 세계를 지켜본다.")];
}

// ---- 저장
let db = null, user = null, me = null, canEdit = false, slots = [], profiles = {}, dlCap = null, shareReady = false, shareMsg = ["보관함에 연결하는 중…", ""], fileMsg = ["", ""], canWrite = true;
const CHUNK = 45000;
function winSave() {
  const msg = (m) => h("div", { class: "stat " + (m[1] || "") }, m[0]);
  const note = h("input", { class: "field", maxlength: 80, placeholder: "메모 (예: 고백 받기 직전)", style: "flex:1 1 200px", "aria-label": "메모" });
  const nm = h("input", { class: "field", maxlength: 20, value: W.name, "aria-label": "세계 이름", style: "flex:1 1 120px" });
  const sd = h("input", { class: "field num", type: "number", min: 1, max: 999999, value: W.seed, "aria-label": "시드", style: "width:7em" });
  return [h("h3", null, "공유 보관함"), h("p", { class: "small muted", style: "margin:0 0 6px" }, "여기 저장한 세계는 이 페이지를 연 친구도 불러올 수 있다. 친구가 불러가서 자기 캐릭터로 살다가 다시 저장하면 같은 세계의 다른 갈래가 생긴다."),
    h("div", { class: "row" }, note, h("button", { class: "wbtn gold", type: "button", disabled: !db || !canWrite, onclick: () => saveShared(note.value) }, "현재 세계 저장")), msg(shareMsg), h("ul", { class: "slots", style: "margin-top:6px" }, slotItems()),
    h("h3", null, "파일로 주고받기"), h("div", { class: "row" }, h("button", { class: "wbtn", type: "button", disabled: !dlCap, onclick: exportFile }, "파일로 내보내기"), h("label", { class: "wbtn", for: "importIn" }, "파일에서 가져오기")), msg(fileMsg),
    h("h3", null, "이 브라우저"), h("div", { class: "stat" }, autoNote),
    h("div", { class: "row", style: "margin-top:6px" }, nm, sd, confirmKey === "new"
      ? h("button", { class: "wbtn danger", type: "button", onclick: () => { confirmKey = null; const seed = Math.max(1, Math.min(999999, parseInt(sd.value, 10) || 1)); slotId = newSlotId(); setWorld(freshWorld(seed, nm.value.trim().slice(0, 20) || "탄드렐"), `새 세계 · 시드 ${seed}`); } }, "정말 새로 만들기")
      : h("button", { class: "wbtn", type: "button", onclick: () => { confirmKey = "new"; renderWin(); } }, "새 세계 만들기")),
    confirmKey === "new" ? h("p", { class: "small", style: "color:var(--red)" }, "지금 세계는 이 브라우저의 자동 저장에서 사라진다. 보관함이나 파일에 먼저 저장해 둬.") : null];
}
function slotItems() {
  if (!shareReady) return [];
  if (!slots.length) return [h("li", { class: "muted small" }, "보관된 세계가 여기에 나타난다.")];
  return slots.map((sl) => {
    const who = (sl.savedBy && profiles[sl.savedBy] && profiles[sl.savedBy].name) || (sl.savedBy === me ? "나" : "누군가");
    const when = sl.savedAt ? new Date(sl.savedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const lk = "load:" + sl.id, dk = "del:" + sl.id, btns = h("div", { class: "row" });
    if (confirmKey === lk) btns.append(h("button", { class: "wbtn gold", type: "button", onclick: () => loadSlot(sl) }, "불러오기"), h("button", { class: "link small", type: "button", onclick: () => { confirmKey = null; renderWin(); } }, "취소"));
    else if (confirmKey === dk) btns.append(h("span", { class: "small" }, "되돌릴 수 없다."), h("button", { class: "wbtn danger", type: "button", onclick: () => deleteSlot(sl) }, "삭제"), h("button", { class: "link small", type: "button", onclick: () => { confirmKey = null; renderWin(); } }, "취소"));
    else { btns.append(h("button", { class: "wbtn", type: "button", onclick: () => { confirmKey = lk; renderWin(); } }, "불러오기")); if (sl.savedBy === me || canEdit) btns.append(h("button", { class: "link small", type: "button", onclick: () => { confirmKey = dk; renderWin(); } }, "삭제")); }
    return h("li", { class: "sslot" }, h("div", { style: "min-width:0" }, h("div", { style: "font-family:var(--ui)" }, `${sl.name || "이름 없는 세계"} · ${sl.date || ""}`), h("div", { class: "small muted" }, `주민 ${sl.pop ?? "?"}명 · ${sl.player ? "캐릭터 " + sl.player : "캐릭터 없음"} · 시드 ${sl.seed ?? "?"} · ${who} · ${when}`), sl.note ? h("div", { class: "small" }, sl.note) : null), btns);
  });
}
async function initShared() {
  if (!window.claude || !window.claude.use) { shareMsg = ["공유 보관함은 claude.ai에서 이 페이지를 열었을 때만 쓸 수 있다. 파일로 주고받기는 어디서나 된다.", ""]; return; }
  [db, user, dlCap] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("downloads")]);
  if (!db) { shareMsg = ["공유 보관함을 쓸 수 없다. 로그인한 상태로 열었는지 확인해 줘.", ""]; return; }
  if (user) { me = await user.id(); canEdit = !!(await user.canEdit()); const cw = await user.can("data.write"); if (cw === false) { canWrite = false; shareMsg = ["보기 권한만 있어서 불러오기만 할 수 있다.", ""]; } }
  let loaded = false;
  const t = setTimeout(() => { if (!loaded) { shareMsg = ["보관함에 아직 닿지 않았다. 잠시 뒤에 다시 확인해 줘.", "err"]; if (win === "save") renderWin(); } }, 10000);
  db.collection("worlds").orderBy("savedAt", "desc").limit(60).onSnapshot(async (snap) => {
    slots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!snap.metadata.fromCache) { loaded = true; clearTimeout(t); }
    shareReady = true;
    if (canWrite) shareMsg = [slots.length ? `${slots.length}개의 세계가 보관되어 있다.` : "아직 보관된 세계가 없다.", ""];
    if (user) { const ids = [...new Set(slots.map((x) => x.savedBy).filter(Boolean))]; if (ids.length) try { profiles = (await user.profiles(ids)) || {}; } catch (e) {} }
    if (win === "save") renderWin();
  }, (err) => { clearTimeout(t); shareMsg = [err.code === "revoked" ? "보관함 접근이 끊겼다." : "보관함 목록을 읽지 못했다.", "err"]; if (win === "save") renderWin(); });
}
async function saveShared(noteText) {
  if (!db) return;
  try {
    const data = W.serialize(), parts = Math.ceil(data.length / CHUNK), ref = db.collection("worlds").doc();
    for (let i = 0; i < parts; i++) { shareMsg = [`저장하는 중… ${i + 1}/${parts}`, ""]; renderWin(); await ref.collection("parts").doc(String(i)).set({ i, d: data.slice(i * CHUNK, (i + 1) * CHUNK) }); }
    const p = W.player;
    await ref.set({ name: W.name, date: `${W.date()} ${G.clockText(W)}`, day: W.day, seed: W.seed, pop: W.alive().length, player: p ? p.name + (p.alive ? "" : " (사망)") : "", note: (noteText || "").trim().slice(0, 80), parts, size: data.length, savedBy: me, savedAt: Date.now(), version: 3 });
    shareMsg = [`${W.date()}의 세계를 보관함에 저장했다.`, "ok"];
  } catch (e) { shareMsg = [e && e.code === "quota_exceeded" ? "보관함이 가득 찼다. 오래된 세계를 지우고 다시 저장해 줘." : e && e.code === "invalid_argument" ? "저장 권한이 없다. 페이지 주인에게 ‘참여자’ 이상 권한을 받아야 한다." : "저장하지 못했다. 잠시 뒤 다시 시도해 줘.", "err"]; }
  renderWin();
}
async function loadSlot(sl) {
  confirmKey = null;
  try {
    shareMsg = ["불러오는 중…", ""]; renderWin();
    const ref = db.collection("worlds").doc(sl.id); let data = "";
    for (let i = 0; i < sl.parts; i++) { const snap = await ref.collection("parts").doc(String(i)).get(); if (!snap.exists) throw new Error("missing"); data += snap.data().d; }
    setWorld(A.World.deserialize(data), `보관함에서 불러옴 · ${sl.name} ${sl.date}`);
    toast(`‘${sl.name}’ ${sl.date}의 세계를 불러왔다.`, "good");
  } catch (e) { shareMsg = ["이 세계를 불러오지 못했다.", "err"]; renderWin(); }
}
async function deleteSlot(sl) {
  confirmKey = null;
  try { const ref = db.collection("worlds").doc(sl.id); await ref.delete(); for (let i = 0; i < sl.parts; i++) await ref.collection("parts").doc(String(i)).delete(); shareMsg = ["보관함에서 지웠다.", ""]; } catch (e) { shareMsg = ["지우지 못했다.", "err"]; }
  renderWin();
}
async function exportFile() {
  if (!dlCap) return;
  try { await dlCap.save({ filename: `${W.name}-${W.year}년.json`, data: W.serialize() }); fileMsg = ["파일을 저장했다.", "ok"]; }
  catch (e) { fileMsg = [e && e.code === "declined" ? "저장을 취소했다." : "파일을 저장하지 못했다.", e && e.code === "declined" ? "" : "err"]; }
  renderWin();
}
const importIn = h("input", { type: "file", id: "importIn", accept: ".json,application/json", hidden: true });
document.body.append(importIn);
importIn.addEventListener("change", (ev) => {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { setWorld(A.World.deserialize(String(rd.result)), `파일에서 불러옴 · ${f.name}`); toast(`${f.name}을 불러왔다.`, "good"); } catch (e) { fileMsg = ["탄드렐 세계 파일이 아니거나 손상된 파일이다.", "err"]; renderWin(); } ev.target.value = ""; };
  rd.readAsText(f);
});

// ------------------------------------------------------------ 연결과 시작
function renderAll() { renderHud(); renderHotbar(true); renderSpeed(); renderMenubar(); renderMini(); renderHere(); renderTalk(); }
$$("[data-open]").forEach((b) => b.addEventListener("click", () => openWin(b.dataset.open)));
$("#minimap").addEventListener("click", () => openWin("map"));
$("#hereToggle").addEventListener("click", (e) => { hereOpen = !hereOpen; $("#hereBody").hidden = !hereOpen; e.target.textContent = hereOpen ? "접기" : "펼치기"; e.target.setAttribute("aria-expanded", String(hereOpen)); if (hereOpen) renderHere(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && W) autosave(); });
G.onLog = (text, tone) => { if (tone !== "quiet") toast(text, tone); };
G.onCodex = (id) => toast(`도감에 추가: ${G.ITEMS[id].name}`);
G.onHurt = () => { view.hurt = 0.35; };
G.onTalk = (id) => openTalk(id);
G.onMapChange = (home) => { if (!home) toast("지도에 새 나라가 생겼다", "good"); renderMini(); };
S.onOpenTalk = (id, opener) => openTalk(id, opener);
S.onEpisode = () => { const ep = W.episodes[W.episodes.length - 1]; if (ep && !ep.block) toast(`${ep.title} — 소식에서 답할 수 있다`); else renderTalk(); };
S.onMission = () => renderQuests();

window.asteriaWorld = () => W; // 디버그·모드용: 지금 세계
window.asteriaView = () => view; // 디버그: 화면 (peek = {x,y}로 카메라만 옮겨 보기)

// ------------------------------------------------------------ 터치 조작 (휴대폰·태블릿)
/* 왼쪽 아래 막대로 걷고, 오른쪽 아래 버튼으로 말 걸기(E)와 도구 쓰기(Space). 화면을 누르면 그곳으로 걸어간다. */
function setupTouch() {
  // 좁은 화면에서는 내 상태 판을 시계 아래에 붙인다
  const placeStats = () => { const narrow = matchMedia("(max-width: 760px)").matches; const bl = $("#bl"); if (narrow && bl.parentNode !== $(".tl")) $(".tl").insertBefore(bl, $(".quests")); else if (!narrow && bl.parentNode === $(".tl")) $("#game").insertBefore(bl, $("#handname")); };
  placeStats(); addEventListener("resize", placeStats);
  if (!touchMode) return;
  $("#game").classList.add("touch");
  const knob = h("span", { class: "knob" });
  const stick = h("div", { class: "stick", role: "group", "aria-label": "이동" }, knob);
  const act = h("button", { class: "padbtn", type: "button", "aria-label": "말 걸기·들어가기·줍기" }, "말 걸기");
  const use = h("button", { class: "padbtn", type: "button", "aria-label": "손에 든 도구 쓰기" }, "도구");
  $("#game").append(h("div", { class: "pad", id: "pad" }, stick, h("div", { class: "padacts" }, use, act)));
  let id = null;
  const dirs = ["left", "right", "up", "down"];
  const set = (ev) => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (ev.clientX - cx) / R, dy = (ev.clientY - cy) / R; const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    knob.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
    for (const k of dirs) keys.delete(k);
    if (d < 0.25) return;
    if (dx < -0.38) keys.add("left"); if (dx > 0.38) keys.add("right"); if (dy < -0.38) keys.add("up"); if (dy > 0.38) keys.add("down");
  };
  stick.addEventListener("pointerdown", (ev) => {
    ev.preventDefault(); id = ev.pointerId; stick.setPointerCapture(id);
    if (session) endSession(); if (bmenu) closeMenu(); if (epView) { epView = null; renderTalk(); }
    path = []; set(ev);
  });
  stick.addEventListener("pointermove", (ev) => { if (ev.pointerId === id) set(ev); });
  const end = (ev) => { if (ev.pointerId !== id) return; id = null; knob.style.transform = ""; for (const k of dirs) keys.delete(k); };
  stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  act.addEventListener("click", () => { if (!playing() || busy() || win) return; interactFront(); });
  use.addEventListener("click", () => { if (!playing() || busy() || win) return; const [tx, ty] = G.facingTile(W); useTool(tx, ty); });
}

// ------------------------------------------------------------ 테스트 단계
let testResults = null, testRunning = false;
function runTests() {
  testRunning = true; renderWin();
  setTimeout(() => {
    const hooks = [S.onEpisode, S.onMission, G.onLog, G.onMapChange, S.onOpenTalk, G.onTalk];
    S.onEpisode = S.onMission = G.onCodex = G.onLog = G.onMapChange = S.onOpenTalk = G.onTalk = null; // 복사본에서 돌 때는 화면을 건드리지 않는다
    const base = W.serialize();
    try { testResults = window.AsteriaTest.runAll(base); } catch (e) { testResults = [{ name: "테스트 실행", ok: false, checks: [], notes: [], error: String(e && e.stack || e) }]; }
    [S.onEpisode, S.onMission, G.onLog, G.onMapChange, S.onOpenTalk, G.onTalk] = hooks;
    W = A.World.deserialize(base); G.setup(W); view.cam = W.ppos ? { x: W.ppos.x, y: W.ppos.y } : view.cam; // 실제 세계로 돌아온다
    testRunning = false; renderAll(); renderWin();
  }, 30);
}
function winTest() {
  const ok = testResults ? testResults.filter((r) => r.ok).length : 0;
  return [
    h("div", { class: "card" }, h("div", { class: "ttl" }, h("span", null, "자동 점검"), testResults ? h("span", { class: "chip " + (ok === testResults.length ? "good" : "bad") }, `${ok}/${testResults.length} 통과`) : null),
      h("p", { class: "small muted", style: "margin:4px 0" }, "지금 세계의 복사본에서 테스터가 기능을 하나씩 실행하고 결과를 확인한다. 실제 세계와 저장은 바뀌지 않는다."),
      h("button", { class: "wbtn gold", type: "button", disabled: testRunning, onclick: runTests }, testRunning ? "점검하는 중…" : testResults ? "다시 점검하기" : "자동 점검 시작"),
      testResults ? h("ul", { class: "list compact", style: "margin-top:8px" }, testResults.map((r) => h("li", null, h("span", { class: "d" }, h("span", { class: "chip " + (r.ok ? "good" : "bad") }, r.ok ? "통과" : "실패"), ` ${r.ms ?? ""}ms`), h("span", { class: "t" }, h("b", null, r.name),
        h("div", { class: "small" }, r.checks.map((c) => h("div", { style: c.ok ? "" : "color:var(--red)" }, `${c.ok ? "통과" : "실패"} · ${c.msg}`)), r.notes.map((n) => h("div", { class: "muted" }, "· " + n)), r.error ? h("pre", { class: "small", style: "color:var(--red);white-space:pre-wrap;margin:4px 0" }, r.error.split("\n").slice(0, 4).join("\n")) : null))))) : null),
    h("div", { class: "card" }, h("div", { class: "ttl" }, h("span", null, "자동 인생"), h("span", { class: "chip " + (auto.on ? "good" : "") }, auto.on ? "켜짐" : "꺼짐")),
      h("p", { class: "small muted", style: "margin:4px 0" }, "내 캐릭터가 NPC처럼 스스로 행동한다. 실제 세계에서 4배속으로 진행한다. 오류는 아래에 기록된다."),
      h("div", { class: "row" }, h("button", { class: "wbtn " + (auto.on ? "danger" : "gold"), type: "button", disabled: !playing(), onclick: () => { toggleAuto(); closeWin(); } }, auto.on ? "자동 인생 멈추기" : "자동 인생 시작"), !playing() ? h("span", { class: "small muted" }, "먼저 태어나야 한다") : null),
      auto.errors.length ? h("div", { style: "margin-top:8px" }, h("div", { class: "small", style: "color:var(--red)" }, `오류 ${auto.errors.length}건`), auto.errors.slice(-5).map((e) => h("pre", { class: "small", style: "white-space:pre-wrap;color:var(--red)" }, e))) : null,
      auto.log.length ? h("ul", { class: "list compact", style: "margin-top:8px" }, auto.log.slice(-25).reverse().map((l) => h("li", null, h("span", { class: "d" }, l.t), h("span", { class: "t small" }, l.text)))) : null)];
}

// ---- 자동 인생: 내 캐릭터를 NPC처럼 움직인다
const auto = { on: false, wait: 0, log: [], errors: [], idle: 0 };
function toggleAuto() {
  auto.on = !auto.on; auto.wait = 0;
  if (auto.on) { speed = 4; renderSpeed(); autoSay("자동 인생 시작"); } else { autoSay("자동 인생 멈춤"); speed = settings.speed; renderSpeed(); }
  renderAutoPanel();
}
function autoSay(text) { auto.log.push({ t: `${W.date()} ${G.clockText(W)}`, text }); if (auto.log.length > 120) auto.log.shift(); renderAutoPanel(); }
function autoError(e) { auto.errors.push(`${W.date()} ${G.clockText(W)} · ${(e && e.stack || String(e)).split("\n").slice(0, 3).join(" | ")}`); autoSay("오류 발생 (테스트 창에 기록)"); }
function renderAutoPanel() {
  let el = $("#autoPanel");
  if (!auto.on) { if (el) el.remove(); return; }
  if (!el) { el = h("div", { class: "frame autopanel", id: "autoPanel" }); $(".tl").append(el); }
  el.replaceChildren(h("div", { class: "title" }, h("span", null, "자동 인생"), h("button", { class: "toggle", type: "button", onclick: toggleAuto }, "멈추기")),
    h("div", { class: "body" }, auto.log.slice(-5).reverse().map((l) => h("div", { class: "small" }, l.text)), auto.errors.length ? h("div", { class: "small", style: "color:var(--red)" }, `오류 ${auto.errors.length}건`) : null));
}
function goThen(x, y, fn, what) {
  if (Math.hypot(x + 0.5 - W.ppos.x, y + 0.5 - W.ppos.y) < 1.6) { fn(); return true; }
  if (walkTo(x, y, fn, true) === false) return false;
  if (what) autoSay(what);
  return true;
}
function autoTalk(n, labels) {
  const s = S.talk(W, n.id), said = [];
  for (const l of labels) { const o = s.options.find((x) => x.label.startsWith(l)); if (!o) break; o.go(); said.push(o.label); }
  S.endTalk(W, s);
  const last = [...s.lines].reverse().find((x) => x.who === "npc" || x.who === "sys");
  autoSay(`${n.name}: ${said.join(" → ") || "인사"}${last ? ` — “${last.text.slice(0, 50)}”` : ""}`);
}
function autoStep() {
  const p = W.player, e = G.ext(W), h = G.hour(W), I = G.ITEMS;
  if (session) endSession(); if (bmenu) closeMenu(); if (epView) epView = null;
  // 1) 답을 기다리는 일
  const ep = W.episodes[0];
  if (ep) { const c = ep.choices[Math.floor(Math.random() * ep.choices.length)]; S.resolve(W, ep.id, c.id); autoSay(`${ep.title} → ${c.label}`); renderTalk(); return; }
  if (G.blockedReason(W)) return;
  const homePl = G.MAP.places.find((q) => q.town === p.home && q.kind === "inn");
  // 2) 밤엔 집에 가서 잔다
  if (h >= 22 || h < 6) { const [ex, ey] = G.entryOf(G.MAP.buildings[homePl.b]); goThen(ex, ey, () => { G.doBuilding(W, homePl, "sleep:home"); onNewDay(); autoSay("집에서 잠들었다"); }, "집으로 돌아간다"); return; }
  // 3) 배고프거나 지치면 먹는다
  if (p.energy < 30 || p.hunger >= 2) { const f = Object.keys(e.inv).find((id) => I[id] && I[id].food && e.inv[id] > 0); if (f) { autoSay("" + G.eat(W, f)); return; } }
  // 4) 미션
  for (const m of e.missions.filter((x) => !x.done)) {
    if (m.type === "visit" && h >= m.start && h < m.until) { const bd = G.MAP.buildings.find((b) => b.town === m.town && b.kind === "house" && b.hid === m.hid); const [ex, ey] = G.entryOf(bd);
      if (G.insideBuilding(W) === bd) { const pl = G.MAP.places.find((q) => q.b === bd.id); const r = G.doBuilding(W, pl, Math.random() < 0.5 ? "visit:tea" : "visit:look"); autoSay("" + (r.text || "")); return; }
      if (goThen(ex, ey - 1, () => {}, `${W.npcs[m.to].name}의 집에 놀러 간다`)) return; }
    if (m.type === "build" && (m.started || Object.entries(m.needs).every(([id, n]) => G.has(W, id, n)))) { const bd = G.MAP.buildings.find((b) => b.town === m.town && b.kind === "house" && b.hid === m.hid); const pl = G.MAP.places.find((q) => q.b === bd.id);
      if (goThen(pl.x, pl.y, () => { autoSay("" + G.doBuildWork(W, m.id)); }, `${W.npcs[m.from].name}의 집 공사하러 간다`)) return; }
    const talkTo = (id, label) => { const x = W.npcs[id], k = x && G.walkers.get(id); if (!k || k.inside || !x.alive) return false; return goThen(Math.floor(k.x), Math.floor(k.y), () => autoTalk(x, [label]), `${x.name}를 찾아간다`); };
    if (m.type === "parcel" && talkTo(m.to, m.what || "꾸러미")) return;
    if (m.type === "message" && talkTo(m.to, `${W.npcs[m.from].name}의 안부`)) return;
    if (m.type === "fetch" && G.has(W, m.item, m.n)) { if (m.from !== null && m.from !== undefined) { if (talkTo(m.from, `${I[m.item].name} ${m.n}개를`)) return; } else { const g = G.MAP.places.find((q) => q.town === p.town && q.kind === "guild"); if (goThen(g.x, g.y, () => autoSay(`납품 ${S.deliverToBoard(W)}건`), "길드에 납품하러 간다")) return; } }
  }
  // 5) 만들 수 있으면 만든다 (아직 없는 도구 먼저)
  const can = G.recipes(W).filter((c) => c.ok && (!c.r.out || !(I[c.r.out].tool && G.has(W, c.r.out))));
  if (can.length && Math.random() < 0.6) { autoSay("" + G.craft(W, can[0].r.id)); return; }
  // 6) 팔 것이 쌓이면 시장에 간다
  const keep = new Set(["stone", "branch", "fiber", "wood", "herb", "bread", "meat"]);
  const sell = Object.keys(e.inv).filter((id) => I[id] && I[id].sell && !I[id].tool && !keep.has(id) && e.inv[id] > 0);
  if (sell.reduce((s, id) => s + e.inv[id], 0) >= 6) { const mk = G.MAP.places.find((q) => q.town === p.town && q.kind === "market");
    if (mk && goThen(mk.x, mk.y, () => { for (const id of sell) { const r = G.doBuilding(W, mk, "sell:" + id); if (r.text) autoSay("" + r.text); } }, "시장에 팔러 간다")) return; }
  // 7) 낮에는 가끔 사람을 만난다
  if (Math.random() < 0.3 && h < 20) {
    const near = G.visibleNPCs(W).filter(({ n }) => A.isAdult(n) && n.alive).sort((a, b) => Math.hypot(a.k.x - W.ppos.x, a.k.y - W.ppos.y) - Math.hypot(b.k.x - W.ppos.x, b.k.y - W.ppos.y))[0];
    if (near) { const plans = [["요즘 어때요?", "도울 일 있어요?", "맡겨 주세요"], ["꿈이 뭐예요?", "응원할게요"], ["무슨 소식 없어요?"], ["집에 놀러 가도 돼요?"], ["부탁이 있어요", "일거리"], ["무언가 가르쳐", "‘"]];
      const plan = plans[Math.floor(Math.random() * plans.length)];
      if (goThen(Math.floor(near.k.x), Math.floor(near.k.y), () => autoTalk(near.n, plan), `${near.n.name}에게 말을 걸러 간다`)) return; }
  }
  // 8) 낮 동안 일터에서 일한다
  const wp = A.JOBS[p.job] && A.JOBS[p.job].workplace, wpl = wp && G.MAP.places.find((q) => q.town === p.town && q.kind === wp);
  if (wpl && h >= 9 && h < 16 && p.energy > 40 && Math.random() < 0.25) { if (goThen(wpl.x, wpl.y, () => { const r = G.doBuilding(W, wpl, "work"); if (r.text) autoSay("" + r.text); }, `${wpl.name || "일터"}로 일하러 간다`)) return; }
  // 9) 채집: 가까운 열매·나무·바위·풀
  const px = Math.floor(W.ppos.x), py = Math.floor(W.ppos.y); let best = null, bd = 1e9;
  for (let y = py - 22; y <= py + 22; y++) for (let x = px - 22; x <= px + 22; x++) {
    if (!G.MAP.inb(x, y)) continue; const o = G.objAt(W, x, y);
    if (!o || !G.forageReady(W, x, y) || G.MAP.solid[G.MAP.I(x, y)] >= 0) continue;
    const d = Math.hypot(x - px, y - py) + Math.random() * 4; if (d < bd) { bd = d; best = [x, y]; }
  }
  if (best) { const [x, y] = best; e.sel = Math.max(0, e.hot.indexOf("hand")); if (goThen(x, y + 1, () => { G.face(W, x, y); const r = G.useAt(W, x, y); if (r) autoSay("" + r); }, "무언가 주우러 간다")) return; }
  // 10) 할 일이 없으면 마을을 거닌다
  const t = G.TOWN_POS[p.town]; if (t) goThen(t[0] + Math.floor(Math.random() * 20) - 10, t[1] + Math.floor(Math.random() * 16) - 8, () => {}, null);
}

// ------------------------------------------------------------ 메인 화면
let titlePanel = "main";
function openTitle() {
  if (W && playing()) autosave();
  if (auto.on) toggleAuto();
  titleOpen = true; titlePanel = "main"; confirmKey = null; win = null; $("#win").hidden = true; renderTitle();
}
function closeTitle() { titleOpen = false; const t = $("#title"); if (t) t.remove(); renderAll(); refocus(); }
function startWorld(w, note, newSlot) {
  if (newSlot) slotId = newSlotId();
  setWorld(w, note); closeTitle(); speed = settings.speed; renderSpeed();
  if (!playing()) openWin("born");
}
function renderTitle() {
  let el = $("#title");
  if (!el) { el = h("div", { id: "title", class: "titlescreen" }); $("#game").append(el); }
  const slots = slotsList(), when = (t) => new Date(t).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const back = h("button", { class: "link", type: "button", onclick: () => { titlePanel = "main"; renderTitle(); } }, "← 처음으로");
  let body;
  if (titlePanel === "main") body = h("div", { class: "tmenu" },
    slots.length ? h("button", { class: "tbtn gold", type: "button", onclick: () => { const w = loadSlotLocal(slots[0].id); if (w) { slotId = slots[0].id; startWorld(w, `이어하기 · ${slots[0].name}`); } } }, "이어하기", h("small", null, `${slots[0].name} · ${slots[0].date}${slots[0].player ? " · " + slots[0].player : ""}`)) : null,
    h("button", { class: "tbtn", type: "button", onclick: () => { titlePanel = "new"; renderTitle(); } }, "새 게임 시작하기"),
    h("button", { class: "tbtn", type: "button", onclick: () => { titlePanel = "load"; renderTitle(); } }, "불러오기", h("small", null, `저장 칸 ${slots.length}/${MAX_SLOTS}`)),
    h("button", { class: "tbtn", type: "button", onclick: () => { titlePanel = "settings"; renderTitle(); } }, "설정"),
    W && playing() ? h("button", { class: "tbtn", type: "button", onclick: closeTitle }, "게임으로 돌아가기") : null,
    h("button", { class: "tbtn", type: "button", onclick: () => { titlePanel = "quit"; if (W && playing()) autosave(); renderTitle(); } }, "종료"));
  else if (titlePanel === "new") {
    const nm = h("input", { class: "field", maxlength: 20, value: "탄드렐", "aria-label": "세계 이름" }), sd = h("input", { class: "field num", type: "number", min: 1, max: 999999, value: 1 + Math.floor(Math.random() * 999998), "aria-label": "시드" });
    body = h("div", { class: "tpanel" }, h("h3", null, "새 게임"), h("label", { class: "small" }, "세계 이름", nm), h("label", { class: "small" }, "시드 (같은 시드면 같은 세계로 시작한다)", sd),
      slots.length >= MAX_SLOTS ? h("p", { class: "small", style: "color:var(--red)" }, `저장 칸이 가득 찼다 (${MAX_SLOTS}개). 불러오기에서 하나를 지워 줘.`) : null,
      h("div", { class: "row" }, h("button", { class: "wbtn gold", type: "button", disabled: slots.length >= MAX_SLOTS, onclick: (ev) => { ev.target.textContent = "세계를 빚는 중…"; setTimeout(() => { const seed = Math.max(1, Math.min(999999, parseInt(sd.value, 10) || 1)); startWorld(freshWorld(seed, nm.value.trim().slice(0, 20) || "탄드렐"), `새 세계 · 시드 ${seed}`, true); }, 20); } }, "이 세계로 시작"), back),
      h("p", { class: "small muted" }, "새 세계는 새 저장 칸에 저장된다. 지금까지의 세계는 그대로 남는다."));
  } else if (titlePanel === "load") body = h("div", { class: "tpanel" }, h("h3", null, "불러오기"),
    slots.length ? h("ul", { class: "slots" }, slots.map((sl) => h("li", { class: "sslot" + (sl.id === slotId ? " cur" : "") },
      h("div", { style: "min-width:0" }, h("div", { style: "font-family:var(--ui)" }, `${sl.name} · ${sl.date} ${sl.clock || ""}`), h("div", { class: "small muted" }, `${sl.player ? sl.player + (sl.job ? " (" + sl.job + ")" : "") : "캐릭터 없음"} · 나라 ${sl.nations || "?"}개 · ${when(sl.savedAt)} · ${Math.round((sl.size || 0) / 1024)}KB`)),
      h("div", { class: "row" }, h("button", { class: "wbtn gold", type: "button", onclick: () => { const w = loadSlotLocal(sl.id); if (!w) { toast("이 저장을 읽지 못했다.", "warn"); return; } slotId = sl.id; startWorld(w, `불러옴 · ${sl.name}`); } }, "불러오기"),
        confirmKey === "del:" + sl.id ? h("button", { class: "wbtn danger", type: "button", onclick: () => { confirmKey = null; store.del(SLOT_PREFIX + sl.id); writeSlots(slotsList().filter((x) => x.id !== sl.id)); if (slotId === sl.id) slotId = null; renderTitle(); } }, "정말 지우기")
          : h("button", { class: "link small", type: "button", onclick: () => { confirmKey = "del:" + sl.id; renderTitle(); } }, "지우기"))))) : h("p", { class: "muted" }, "저장된 세계가 없다."),
    h("p", { class: "small muted" }, "게임 중에는 지금 칸에 자동 저장된다. 파일 내보내기와 공유 보관함은 게임 안 메뉴 > 저장에 있다."), back);
  else if (titlePanel === "settings") {
    const row = (label, ctl) => h("label", { class: "srow" }, h("span", null, label), ctl);
    const sel = (key, opts) => h("select", { class: "field", onchange: (e) => { settings[key] = +e.target.value; saveSettings(); renderTitle(); } }, opts.map(([v, l]) => h("option", { value: v, selected: settings[key] === v }, l)));
    body = h("div", { class: "tpanel" }, h("h3", null, "설정"),
      row("처음 게임 속도", sel("speed", [[1, "×1 (보통)"], [2, "×2"], [4, "×4"]])),
      row("자동 저장 간격", sel("autosave", [[30, "30초"], [90, "1분 30초"], [300, "5분"]])),
      row("화면 글자·창 크기", sel("uiScale", [[0.85, "작게"], [1, "보통"], [1.15, "크게"], [1.3, "아주 크게"]])),
      h("p", { class: "small muted" }, "설정은 이 브라우저에만 저장된다."), back);
  } else body = h("div", { class: "tpanel" }, h("h3", null, "종료"), h("p", null, W && W.player ? "지금 세계를 저장했다. 이 탭을 닫으면 된다. 다시 열면 ‘이어하기’로 계속할 수 있다." : "이 탭을 닫으면 된다."), back);
  el.replaceChildren(h("div", { class: "tbox" }, h("div", { class: "tlogo" }, h("div", { class: "tl1" }, "TANDREL"), h("div", { class: "tl2" }, "각자의 이야기가 엮여 역사가 되는 곳")), body));
}
function boot(data) {
  let w = null;
  if (data && data.save) try { w = A.World.deserialize(data.save); } catch (e) {}
  if (!w) w = loadAuto();
  if (!w) { const sl = slotsList()[0]; if (sl) { w = loadSlotLocal(sl.id); if (w) slotId = sl.id; } } // 배경으로 보여 줄 최근 세계
  const fresh = !w;
  if (!w) w = freshWorld(1, "탄드렐");
  W = w; G.setup(W);
  view = new WorldView($("#world"), { onClick: onWorldClick, hasPlayer: playing });
  if (W.ppos) view.cam = { x: W.ppos.x, y: W.ppos.y };
  autoNote = fresh ? "새 세계를 만들었다. 이 브라우저에 자동으로 저장된다." : `이어서 불러옴 · ${W.date()}`;
  speed = settings.speed;
  renderAll();
  if (data && data.save) { if (!playing()) openWin("born"); } else openTitle(); // 처음엔 메인 화면
  setupTouch();
  requestAnimationFrame(frame);
  initShared();
  $("#world").focus();
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ save: W ? W.serialize() : null }));
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
})();
