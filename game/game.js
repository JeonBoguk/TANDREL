/* 게임 층: 탑다운 지도, 시계와 기력, 이동, 도구, 농사, 채집, 동물, 주민의 움직임, 범죄와 수배, 가게.
 * 세계의 역사(engine.js) 위에 얹혀서, 플레이어가 그 세계를 몸으로 살게 한다.
 */
(function (root) {
  "use strict";
  const A = root.Asteria;
  const { maxBy, clamp, adjust, power, rWork, enlist } = A._;
  const { JOBS, RACES, jo, opinion, family, isAdult, age } = A;

  // ================================================================ 지도
  /* 지도는 마을 정의(CONTENT.towns의 pos·roads)로 만든다. 새 마을이 지도 밖에 있으면 지도가 그만큼 넓어진다. */
  /* 지도는 마을 정의(CONTENT.towns + 이 세계에서 세워진 마을 w.founded)로 만든다.
   * 동쪽과 남쪽은 아직 아무도 살지 않는 빈 땅이고, 주민이 새 나라를 세우면 그 자리에 마을이 생긴다. */
  const TOWN_POS = {};
  const FRONT = (A.CONTENT.towns.find((t) => t.border) || A.CONTENT.towns[0]).id; // 마왕군과 맞닿은 국경 마을
  const MW = Math.max(300, ...A.CONTENT.towns.map((t) => t.pos[0] + 22)), MH = Math.max(200, ...A.CONTENT.towns.map((t) => t.pos[1] + 22));
  const T = { GRASS: 0, DIRT: 1, SAND: 2, WATER: 3, DEEP: 4, CLIFF: 5, FLOOR: 6, PAVE: 7, FIELD: 8, WASTE: 9, BRIDGE: 10 };
  const O = { NONE: 0, OAK: 1, PINE: 2, APPLE: 3, BUSH: 4, ROCK: 5, HERB: 6, SHROOM: 7, FENCE: 8, FLOWER: 9, STUMP: 10, TENT: 11, SIGN: 12, RUIN: 13, MOUND: 14 };
  const BLOCK_OBJ = new Set([O.OAK, O.PINE, O.APPLE, O.BUSH, O.ROCK, O.FENCE, O.TENT, O.SIGN, O.RUIN]);
  const TOWN_BOX = { x0: -17, x1: 16, y0: -11, y1: 16 };
  const BUILD_DEF = [
    { kind: "tavern", name: "주점", x: 4, y: -8, w: 7, h: 5 },
    { kind: "forge", name: "대장간", x: -2, y: -10, w: 5, h: 4 },
    { kind: "temple", name: "신전", x: -12, y: -10, w: 6, h: 6 },
    { kind: "guild", name: "경비대·길드", x: -12, y: 1, w: 6, h: 5 },
    { kind: "market", name: "시장", x: 5, y: 1, w: 7, h: 4 },
    { kind: "inn", name: "여관", x: -8, y: 6, w: 4, h: 3 },
    { kind: "house", name: "", x: 6, y: 7, w: 4, h: 3, hid: 1 },
    { kind: "house", name: "", x: 12, y: -5, w: 4, h: 3, hid: 2 },
    { kind: "house", name: "", x: -17, y: -4, w: 4, h: 3, hid: 3 },
    { kind: "house", name: "", x: 13, y: 2, w: 4, h: 3, hid: 4 },
    { kind: "house", name: "", x: -17, y: 4, w: 4, h: 3, hid: 5 },
  ];
  const FIELD_BOX = { x0: -4, x1: 4, y0: 11, y1: 15 };

  function h2(x, y, s) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function vnoise(x, y, sc, seed) {
    const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = h2(x0, y0, seed), b = h2(x0 + 1, y0, seed), c = h2(x0, y0 + 1, seed), d = h2(x0 + 1, y0 + 1, seed);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function buildMap(defs, mods = {}) {
    for (const k of Object.keys(TOWN_POS)) delete TOWN_POS[k];
    for (const t of defs) TOWN_POS[t.id] = t.pos;
    const tile = new Uint8Array(MW * MH), obj = new Uint8Array(MW * MH), solid = new Int16Array(MW * MH).fill(-1);
    const I = (x, y) => y * MW + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
    const setT = (x, y, t) => { if (inb(x, y)) tile[I(x, y)] = t; };
    const getT = (x, y) => (inb(x, y) ? tile[I(x, y)] : T.DEEP);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const n = vnoise(x, y, 9, 1), n3 = vnoise(x, y, 4, 3);
      const coast = 6 + n * 7 + Math.sin(y / 7) * 2;
      let t = T.GRASS;
      if (x < coast - 3) t = T.DEEP;
      else if (x < coast - 1) t = T.WATER;
      else if (x < coast + 1.5) t = T.SAND;
      else if (y < 7 + n * 5) t = T.WASTE;
      else if (dist(x, y, 30, 40) < 17 + n * 9 || dist(x, y, 20, 80) < 13 + n * 7 || dist(x, y, 172, 100) < 14 + n * 8 || dist(x, y, 128, 138) < 12 + n * 7 || dist(x, y, 208, 50) < 11 + n * 6) t = T.FLOOR;
      else if (dist(x, y, 138, 104) < 18 + n * 8 || dist(x, y, 140, 20) < 12 + n * 6 || (n3 > 0.86 && y > 12)) t = T.CLIFF;
      else if (x >= 150 || y >= 112) { // 아직 아무도 살지 않는 동쪽·남쪽 땅: 숲·호수·산
        const f = vnoise(x, y, 15, 21), l = vnoise(x, y, 18, 33), m = vnoise(x, y, 14, 44);
        if (l > 0.84) t = T.WATER; else if (l > 0.81) t = T.SAND; else if (m > 0.86) t = T.CLIFF; else if (f > 0.62) t = T.FLOOR;
      }
      tile[I(x, y)] = t;
    }
    // 강과 호수
    const river = [[149, 40], [130, 52], [110, 66], [98, 84], [92, 111]];
    for (let i = 0; i + 1 < river.length; i++) {
      const [ax, ay] = river[i], [bx, by] = river[i + 1];
      for (let t = 0; t <= 1; t += 0.004) {
        const x = Math.round(ax + (bx - ax) * t + Math.sin(t * 9 + i) * 1.5), y = Math.round(ay + (by - ay) * t);
        for (let dx = -1; dx <= 1; dx++) setT(x + dx, y, T.WATER);
        if (getT(x - 2, y) === T.GRASS) setT(x - 2, y, T.SAND);
        if (getT(x + 2, y) === T.GRASS) setT(x + 2, y, T.SAND);
      }
    }
    for (let y = 26; y < 40; y++) for (let x = 8; x < 30; x++) {
      const d = ((x - 18) / 8) ** 2 + ((y - 32) / 5) ** 2;
      if (d < 1) setT(x, y, T.WATER); else if (d < 1.35 && getT(x, y) !== T.WATER) setT(x, y, T.SAND);
    }
    // 마을 터
    for (const [cx, cy] of Object.values(TOWN_POS)) {
      for (let y = cy + TOWN_BOX.y0 - 1; y <= cy + TOWN_BOX.y1 + 1; y++) for (let x = cx + TOWN_BOX.x0 - 1; x <= cx + TOWN_BOX.x1 + 1; x++) setT(x, y, T.GRASS);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) setT(x, y, T.PAVE);
      for (let x = cx + TOWN_BOX.x0; x <= cx + TOWN_BOX.x1; x++) setT(x, cy, T.PAVE);
      for (let y = cy + TOWN_BOX.y0; y <= cy + 10; y++) setT(cx, y, T.PAVE);
      for (let y = cy + FIELD_BOX.y0; y <= cy + FIELD_BOX.y1; y++) for (let x = cx + FIELD_BOX.x0; x <= cx + FIELD_BOX.x1; x++) setT(x, y, T.FIELD);
    }
    // 마을 사이 길
    const ROADS = [];
    for (const t of defs) for (const r of t.roads || []) if (TOWN_POS[r]) ROADS.push([t.id, r]);
    for (const t of defs) { // 길이 하나도 없는 마을은 가장 가까운 마을과 잇는다
      if (ROADS.some(([a, b]) => a === t.id || b === t.id)) continue;
      const near = defs.filter((x) => x.id !== t.id).sort((a, b) => dist(...a.pos, ...t.pos) - dist(...b.pos, ...t.pos))[0];
      if (near) ROADS.push([t.id, near.id]);
    }
    const road = (x0, y0, x1, y1) => {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
          const c = getT(x0 + ox, y0 + oy);
          if (c === T.WATER || c === T.DEEP || c === T.BRIDGE) setT(x0 + ox, y0 + oy, T.BRIDGE);
          else if (c !== T.PAVE && c !== T.FIELD) setT(x0 + ox, y0 + oy, T.DIRT);
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    for (const [a, b] of ROADS) { const [x0, y0] = TOWN_POS[a], [x1, y1] = TOWN_POS[b]; road(x0, y0, x1, y1); }
    // 건물
    const buildings = [], places = [];
    const inTown = (x, y) => Object.values(TOWN_POS).some(([cx, cy]) => x >= cx + TOWN_BOX.x0 - 1 && x <= cx + TOWN_BOX.x1 + 1 && y >= cy + TOWN_BOX.y0 - 1 && y <= cy + TOWN_BOX.y1 + 1);
    for (const [town, [cx, cy]] of Object.entries(TOWN_POS)) {
      for (const b0 of BUILD_DEF) {
        const m = b0.kind === "inn" ? mods[town] : b0.kind === "house" ? mods[town + ":" + b0.hid] : null; // 목수가 넓힌 집 (내 집·주민 집)
        const b = m ? { ...b0, x: b0.x + (m.dx || 0), w: b0.w + (m.dw || 0), h: b0.h + (m.dh || 0) } : b0;
        const bx = cx + b.x, by = cy + b.y;
        const bd = { town, kind: b.kind, name: b.name, x: bx, y: by, w: b.w, h: b.h, hid: b.hid || 0, door: [bx + Math.floor(b.w / 2), by + b.h] };
        bd.id = buildings.length;
        buildings.push(bd);
        for (let y = by; y < by + b.h; y++) for (let x = bx; x < bx + b.w; x++) solid[I(x, y)] = bd.id;
        const [dx, dy] = bd.door;
        setT(dx, dy, T.PAVE);
        for (let y = dy; y !== cy; y += dy < cy ? 1 : -1) if (getT(dx, y) === T.GRASS) setT(dx, y, T.DIRT);
        for (let x = dx; x !== cx; x += dx < cx ? 1 : -1) if (getT(x, cy) === T.GRASS) setT(x, cy, T.DIRT);
        places.push({ town, kind: b.kind, name: b.name, x: dx, y: dy, b: bd.id });
      }
      places.push({ town, kind: "square", name: "광장", x: cx, y: cy });
      // 공동 밭: 울타리 + 표지판
      const fx0 = cx + FIELD_BOX.x0 - 1, fx1 = cx + FIELD_BOX.x1 + 1, fy0 = cy + FIELD_BOX.y0 - 1, fy1 = cy + FIELD_BOX.y1 + 1;
      for (let x = fx0; x <= fx1; x++) { if (x !== cx) obj[I(x, fy0)] = O.FENCE; obj[I(x, fy1)] = O.FENCE; }
      for (let y = fy0; y <= fy1; y++) { obj[I(fx0, y)] = O.FENCE; obj[I(fx1, y)] = O.FENCE; }
      obj[I(cx + 1, fy0 - 1)] = O.SIGN;
      places.push({ town, kind: "fields", name: "공동 밭", x: cx, y: fy0 });
      // 마을 안 과일나무와 꽃
      for (const [ox, oy] of [[14, 10], [-15, 11], [11, -10], [-6, -2]]) obj[I(cx + ox, cy + oy)] = O.APPLE;
      for (let k = 0; k < 18; k++) { const x = cx + Math.floor(h2(k, cx, 7) * 32) - 16, y = cy + Math.floor(h2(k, cy, 8) * 26) - 10; if (getT(x, y) === T.GRASS && solid[I(x, y)] < 0 && !obj[I(x, y)]) obj[I(x, y)] = O.FLOWER; }
    }
    // 전선 진지
    const [gx, gy] = TOWN_POS[FRONT];
    for (let y = gy - 22; y <= gy - 16; y++) for (let x = gx - 6; x <= gx + 6; x++) { setT(x, y, T.WASTE); }
    for (let y = gy - 16; y <= gy - 11; y++) setT(gx, y, T.DIRT);
    for (const [ox, oy] of [[-4, -21], [3, -21], [-4, -18], [4, -18]]) obj[I(gx + ox, gy + oy)] = O.TENT;
    places.push({ town: FRONT, kind: "camp", name: "전선 진지", x: gx, y: gy - 17 });
    // 자연물
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = I(x, y), t = tile[i];
      if (obj[i] || solid[i] >= 0 || inTown(x, y)) continue;
      const r = h2(x, y, 11), r2 = h2(x, y, 12);
      const r3 = h2(x, y, 31);
      if ((t === T.FLOOR && r3 < 0.004) || (t === T.WASTE && r3 < 0.01) || (t === T.GRASS && x >= 150 && r3 < 0.0015)) { obj[i] = O.RUIN; continue; } // 옛 유적
      if ((t === T.GRASS || t === T.FLOOR) && r3 > 0.9975) { obj[i] = O.MOUND; continue; } // 수상한 흙더미
      if (t === T.FLOOR) obj[i] = r < 0.42 ? (r2 < 0.5 ? O.OAK : O.PINE) : r < 0.45 ? O.SHROOM : r < 0.48 ? O.HERB : r < 0.5 ? O.BUSH : 0;
      else if (t === T.GRASS) obj[i] = r < 0.03 ? O.OAK : r < 0.036 ? O.APPLE : r < 0.046 ? O.BUSH : r < 0.054 ? O.ROCK : r < 0.06 ? O.HERB : r < 0.1 ? O.FLOWER : 0;
      else if (t === T.WASTE) obj[i] = r < 0.03 ? O.ROCK : 0;
      else if (t === T.SAND) obj[i] = r < 0.01 ? O.ROCK : 0;
    }
    return { tile, obj, solid, buildings, places, I, getT, inb, sig: defs.map((t) => t.id).join(",") };
  }
  const MAP = buildMap(A.CONTENT.towns);
  // ================================================================ 집 공사
  /* ext.home[town] = { done: [공사 id…], dx, dw, dh, roof, wall, floor }, ext.reno = 진행 중인 공사 { id, town, builder, until, paid } */
  function homeMods(w) {
    const e = w && w.ext && w.ext.home ? w.ext.home : {}, out = {};
    for (const [town, h] of Object.entries(e)) if (h.dx || h.dw || h.dh) out[town] = { dx: h.dx || 0, dw: h.dw || 0, dh: h.dh || 0 };
    for (const a of Object.values((w && w.assets) || {})) { const h = a.mods || {}; if (a.kind === "house" && (h.dx || h.dw || h.dh)) out[`${a.town}:${a.hid}`] = { dx: h.dx || 0, dw: h.dw || 0, dh: h.dh || 0 }; }
    for (const [town, h] of Object.entries((w && w.innMods) || {})) { const o = out[town] = out[town] || { dx: 0, dw: 0, dh: 0 }; o.dx += h.dx || 0; o.dw += h.dw || 0; o.dh += h.dh || 0; }
    return out;
  }
  /** 건물을 (dx, dw, dh)만큼 넓힐 수 있는가: 다른 건물·울타리·물·절벽과 겹치지 않고, 새 문 앞이 막히지 않아야 한다 */
  function canExpand(w, bd, m) {
    const x0 = bd.x + (m.dx || 0), ww = bd.w + (m.dw || 0), hh = bd.h + (m.dh || 0), y0 = bd.y;
    const door = [x0 + Math.floor(ww / 2), y0 + hh];
    for (let y = y0; y <= y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) {
      if (!MAP.inb(x, y)) return false;
      const t = MAP.getT(x, y), o = MAP.obj[MAP.I(x, y)], sid = MAP.solid[MAP.I(x, y)];
      if (y === y0 + hh && x !== door[0]) continue; // 문 줄은 문 자리만 본다
      if (t === T.WATER || t === T.DEEP || t === T.CLIFF || t === T.FIELD || o === O.FENCE || o === O.SIGN || o === O.TENT) return false;
      if (sid >= 0 && sid !== bd.id) return false;
    }
    for (const ob of MAP.buildings) { // 이웃 건물과 겹치지 않고, 남의 문 앞을 막지 않는다
      if (ob.id === bd.id) continue;
      if (x0 < ob.x + ob.w && ob.x < x0 + ww && y0 < ob.y + ob.h && ob.y < y0 + hh) return false;
      if (door[0] >= ob.x && door[0] < ob.x + ob.w && door[1] >= ob.y && door[1] < ob.y + ob.h) return false;
      if (ob.door[0] >= x0 && ob.door[0] < x0 + ww && ob.door[1] >= y0 && ob.door[1] <= y0 + hh) return false;
    }
    return true;
  }
  const EXPAND_STEPS = [{ dx: -2, dw: 2, name: "왼쪽으로 한 칸" }, { dw: 2, name: "오른쪽으로 한 칸" }, { dh: 1, name: "앞쪽으로 한 줄" }];
  /** 주민 집을 넓힐 수 있는 방법들 (최대 두 번) */
  function houseExpandOptions(w, town, hid) {
    rebuildMap(w); // 지도가 이 세계 것인지 확인 (새 세계를 만들자마자 흘려보낼 때 이전 세계 지도가 남아 있을 수 있다)
    const bd = MAP.buildings.find((b) => b.town === town && b.kind === "house" && b.hid === hid);
    const cur = (houseAsset(w, town, hid) || {}).mods || {};
    if (!bd || (cur.grown || 0) >= 2) return [];
    return EXPAND_STEPS.filter((m) => canExpand(w, bd, m));
  }
  /** 주민 집 공사를 실제로 반영한다 (지붕·벽·넓히기) */
  function applyHouseWork(w, town, hid, job) {
    const a = houseAsset(w, town, hid);
    if (!a) return;
    const h = a.mods = a.mods || {};
    if (job.kind === "expand") { h.dx = (h.dx || 0) + (job.mod.dx || 0); h.dw = (h.dw || 0) + (job.mod.dw || 0); h.dh = (h.dh || 0) + (job.mod.dh || 0); h.grown = (h.grown || 0) + 1; if (w.onMapChange) w.onMapChange(true); else rebuildMap(w); }
    else (a.style = a.style || {})[job.kind] = job.style;
  }
  /** 주민 집 자산 (마을·번호로) */
  const houseAsset = (w, town, hid) => { A.pickHouse(w, town); return w.assets[A.houseId(town, hid)] || null; };
  /** 이 사람이 사는 집 {town, hid}. 집이 없으면(플레이어 등) hid 0 */
  const houseOfNpc = (n) => { const m = /^house:(.+):(\d+)$/.exec(n.house || ""); return m ? { town: m[1], hid: +m[2] } : { town: n.town, hid: 0 }; };
  /** 가구를 놓는 자리 (건물 번호는 지도를 다시 만들면 바뀔 수 있어서 쓰지 않는다) */
  const furnKey = (bd) => `${bd.kind}:${bd.town}:${bd.hid || 0}`;
  /** 내가 목수로서 받은 주민 집 공사를 한다 */
  function doBuildWork(w, mid) {
    const e = ext(w), p = w.player, m = e.missions.find((x) => x.id === mid);
    if (!m || m.done) return "그 공사는 없다.";
    if (!m.started) { for (const [id, n] of Object.entries(m.needs)) take(w, id, n); m.started = true; }
    m.got += 2; spend(w, 120, 15); practice(w, "chop");
    const client = w.npcs[m.from];
    if (m.got < m.work) { if (client) adjust(client, p.id, 1); return `땀 흘려 공사를 이어 갔다 (${m.got}/${m.work}시간).`; }
    applyHouseWork(w, m.town, m.hid, m);
    const pay = client ? Math.min(m.fee, Math.floor(client.gold)) : 0;
    if (client) client.gold -= pay;
    m.reward = pay; p.fame += m.kind === "expand" ? 2 : 1;
    w.record("renovate", `목수 ${jo(p.name, "이/가")} ${client ? client.name + "의 " : ""}집 공사를 마쳤다 (${m.desc})`, { actor: p.id, target: m.from, town: m.town, imp: m.kind === "expand" ? 4 : 3, sent: 4, wr: 0.6 });
    if (root.Story) root.Story.completeMission(w, m, `${m.desc} 공사를 끝냈다!${pay < m.fee ? ` (집주인이 금화 ${pay}닢밖에 없었다)` : ""}`);
    return `공사를 마쳤다! ${client ? jo(client.name, "이/가") + " 새 집을 둘러보며 활짝 웃었다." : ""}`;
  }
  // ================================================================ 혼자 익히기 (같은 일을 거듭하면 깨닫는다)
  function practice(w, stat, k = 1) {
    const p = w.player;
    for (const K of A.CONTENT.knowledge) {
      if (!K.practice || K.practice.stat !== stat) continue;
      if (!A.addXp(p, K.id, k, K.practice.n)) continue; // 익히는 중이거나 이미 안다(아는 기술은 솜씨가 는다)
      w.record("discovery", `${jo(p.name, "이/가")} 누구에게도 배우지 않고 스스로 ‘${K.name}’${jo(K.name, "을/를").slice(K.name.length)} 깨우쳤다`, { actor: p.id, town: p.town, imp: 4, wr: 0.3, data: { skill: K.id, how: "practice" } });
      log(w, `${K.practice.text || "거듭하다 보니 요령이 생겼다"} ‘${K.name}’${jo(K.name, "을/를").slice(K.name.length)} 익혔다!`, "good");
    }
  }
  /** 건물의 겉모습: 내 집이면 내가 고른 것, 주민 집이면 그 주민이 고친 것 */
  function styleOf(w, bd) {
    const S = A.CONTENT.styles, out = {};
    let st = null;
    if (bd.kind === "inn" && w.innMods && w.innMods[bd.town]) st = w.innMods[bd.town];
    if (bd.kind === "inn" && w.player && w.player.home === bd.town && w.ext && w.ext.home && w.ext.home[bd.town]) st = { ...(st || {}), ...w.ext.home[bd.town] };
    if (bd.kind === "house") { const a = (w.assets || {})[A.houseId(bd.town, bd.hid)]; if (a) st = { ...(a.style || {}) }; }
    if (st) { out.roofKey = st.roof; out.wallKey = st.wall; if (st.roof && S.roof[st.roof]) out.roof = S.roof[st.roof].c; if (st.wall && S.wall[st.wall]) out.wall = S.wall[st.wall].c; if (st.floor && S.floor[st.floor]) out.floor = S.floor[st.floor].c; }
    const r = w.ext && w.ext.reno; if (bd.kind === "inn" && r && r.town === bd.town) out.scaffold = true;
    return out;
  }
  /** 이 목수에게 맡길 수 있는 공사 목록 */
  function renoOptions(w) {
    const p = w.player, e = ext(w), h = (e.home || {})[p.home] || {}, done = h.done || [];
    const hb = homeBuilding(w), level = h.grown || done.filter((d) => d.startsWith("expand")).length, out = [];
    for (const r of A.CONTENT.renovations) {
      if (r.kind !== "expand" && (done.includes(r.id) || (r.requires && !done.includes(r.requires)) || (r.style && h[r.kind] === r.style))) continue;
      const k = r.kind === "expand" ? 1 + level * 0.5 : 1, needs = Object.fromEntries(Object.entries(r.needs || {}).map(([id, n]) => [id, Math.ceil(n * k)]));
      const short = Object.entries(needs).map(([id, n]) => [id, Math.max(0, n - (e.inv[id] || 0))]).filter(([, n]) => n > 0);
      const extra = short.reduce((sum, [id, n]) => sum + n * (ITEMS[id].sell || 2) * 2, 0);
      const base = { needs, days: r.days + (r.kind === "expand" ? level : 0) };
      if (r.kind === "expand") {
        if (!hb || level >= (r.max || 3)) continue;
        for (const m of EXPAND_STEPS) if (canExpand(w, hb, m)) out.push({ r: { ...r, ...base, mod: m }, name: `집을 ${m.name} 넓히기`, cost: Math.round(r.gold * k) + extra, extra, short });
      } else out.push({ r: { ...r, ...base }, name: renoName(r), cost: r.gold + extra, extra, short });
    }
    return out;
  }
  const renoName = (r) => r.name || `${{ roof: "지붕", wall: "벽", floor: "바닥" }[r.kind]}을 ${jo(A.CONTENT.styles[r.kind][r.style].name, "으로/로")}`;
  function orderReno(w, builder, id, mod) {
    const p = w.player, e = ext(w);
    if (e.reno) return "이미 공사가 진행 중이다.";
    if (!p.home) return "집이 있어야 한다.";
    const o = renoOptions(w).find((x) => x.r.id === id && (!mod || (x.r.mod && x.r.mod.name === mod.name))) || renoOptions(w).find((x) => x.r.id === id);
    if (!o) return "그 공사는 할 수 없다.";
    if (p.gold < o.cost) return `금화가 모자라다 (금화 ${o.cost}닢 필요).`;
    for (const [it, n] of Object.entries(o.r.needs || {})) take(w, it, Math.min(n, e.inv[it] || 0));
    p.gold -= o.cost; builder.gold += o.cost;
    e.reno = { id, town: p.home, builder: builder.id, until: w.day + o.r.days, paid: o.cost, mod: o.r.mod || null, name: o.name };
    w.record("renovate", `${jo(p.name, "이/가")} 목수 ${builder.name}에게 금화 ${o.cost}닢을 주고 집 공사를 맡겼다 (${o.name})`, { actor: p.id, target: builder.id, town: p.town, imp: 3, sent: 3, wr: 0.4 });
    return `${jo(builder.name, "이/가")} 내일부터 공사를 시작한다. ${o.r.days}일 뒤에 끝난다.`;
  }
  /** 아침마다: 공사가 끝났는지 본다 */
  function renoDawn(w) {
    const e = ext(w), r = e.reno, p = w.player;
    if (!r || !p) return;
    const b = w.npcs[r.builder];
    if (!b || !b.alive || b.at_war) { p.gold += Math.round(r.paid / 2); e.reno = null; log(w, `목수가 공사를 마치지 못하게 되어 금화 ${Math.round(r.paid / 2)}닢을 돌려받았다.`, "warn"); return; }
    if (w.day < r.until) return;
    const def0 = A.CONTENT.renovations.find((x) => x.id === r.id) || { kind: "expand" };
    const def = { ...def0, ...(r.mod || {}) }; // 넓히기는 맡길 때 고른 방향(dx·dw·dh)을 쓴다
    e.home = e.home || {}; const h = e.home[r.town] = e.home[r.town] || { done: [] };
    h.done = h.done || [];
    if (def.kind === "expand") {
      h.dx = (h.dx || 0) + (def.dx || 0); h.dw = (h.dw || 0) + (def.dw || 0); h.dh = (h.dh || 0) + (def.dh || 0); h.done.push(def.id); h.grown = (h.grown || 0) + 1;
      const bd = MAP.buildings.find((x) => x.town === r.town && x.kind === "inn");
      if (bd && def.dx && e.furn && e.furn[furnKey(bd)]) for (const f of e.furn[furnKey(bd)]) f.rx -= def.dx; // 벽이 밀려난 만큼 가구 자리를 옮긴다
    } else h[def.kind] = def.style;
    e.reno = null;
    b.fame += 1; adjust(b, p.id, 6); adjust(p, b.id, 6);
    w.record("renovate_done", `목수 ${jo(b.name, "이/가")} ${p.name}의 집 공사를 마쳤다 (${r.name || renoName(def)})`, { actor: b.id, target: p.id, town: r.town, imp: 3, sent: 2, wr: 0.5 });
    if (def.kind === "expand") w.onMapChange(true);
    log(w, `집 공사가 끝났다: ${r.name || renoName(def)}`, "good");
  }
  /** 새 나라를 세울 빈 땅을 지도에서 찾는다. 다른 마을과 겹치지 않고, 물·절벽·황무지가 적은 곳 */
  function findSite(w, origin) {
    const towns = A.allTownDefs(w).map((t) => t.pos);
    let best = null, bs = -1e9;
    for (let y = 24; y <= MH - 20; y += 6) for (let x = 22; x <= MW - 20; x += 6) {
      if (towns.some(([tx, ty]) => Math.abs(tx - x) < 37 && Math.abs(ty - y) < 31)) continue;
      // 넓힌 집처럼 마을 틀 밖으로 나온 건물과도 겹치지 않게 (새 마을 건물은 가운데에서 ±17·±10, 넓힐 자리까지 넉넉히)
      if (MAP.buildings.some((b) => b.x < x + 24 && b.x + b.w > x - 24 && b.y < y + 14 && b.y + b.h > y - 14)) continue;
      let bad = 0, n = 0;
      for (let yy = y - 11; yy <= y + 16; yy += 3) for (let xx = x - 17; xx <= x + 16; xx += 3) { const t = MAP.getT(xx, yy); n++; if (t === T.WATER || t === T.DEEP || t === T.CLIFF || t === T.WASTE) bad++; }
      if (bad / n > 0.18) continue;
      const sc = -dist(x, y, origin[0], origin[1]) + w.rng.next() * 40;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }
  /** 세계에 세워진 마을까지 넣어 지도를 다시 만든다 (같은 MAP 객체를 고쳐 쓴다) */
  function rebuildMap(w) {
    const defs = A.allTownDefs(w), mods = homeMods(w), sig = defs.map((t) => t.id).join(",") + JSON.stringify(mods);
    if (MAP.sig === sig) return false;
    Object.assign(MAP, buildMap(defs, mods));
    MAP.sig = sig;
    MAP.ver = (MAP.ver || 0) + 1;
    walkers.clear();
    return true;
  }
  function objAt(w, x, y) {
    if (!MAP.inb(x, y)) return O.NONE;
    const o = MAP.obj[MAP.I(x, y)];
    if ((o === O.OAK || o === O.PINE) && w && w.ext && w.ext.removed[MAP.I(x, y)] !== undefined) return O.STUMP;
    if (o === O.MOUND && w && w.ext && w.ext.looted && w.ext.looted[MAP.I(x, y)] !== undefined) return O.NONE;
    return o;
  }
  function walkable(w, x, y) {
    if (!MAP.inb(x, y)) return false;
    const i = MAP.I(x, y), t = MAP.tile[i];
    if (t === T.WATER || t === T.DEEP || t === T.CLIFF) return false;
    if (MAP.solid[i] >= 0) return interiorWalkable(w, MAP.buildings[MAP.solid[i]], x, y);
    return !BLOCK_OBJ.has(objAt(w, x, y));
  }
  // ================================================================ 건물 안
  /* 문으로 걸어 들어가면 지붕이 사라지고 안이 보인다. 맨 윗줄은 뒷벽, 가구 자리는 막혀 있다. */
  const ENTER = new Set(["tavern", "forge", "temple", "guild", "market", "inn"]);
  const FURN = {
    inn: [[0, 1, "bed"], [3, 1, "chest"]],
    tavern: [[0, 1, "barrel"], [1, 1, "counter"], [2, 1, "counter"], [6, 1, "barrel"], [1, 3, "table"], [5, 3, "table"]],
    forge: [[0, 1, "furnace"], [3, 2, "anvil"], [4, 1, "rack"]],
    temple: [[2, 1, "altar"], [3, 1, "altar"], [1, 3, "bench"], [4, 3, "bench"], [1, 4, "bench"], [4, 4, "bench"]],
    guild: [[1, 2, "desk"], [2, 2, "desk"], [5, 1, "rack"]],
    market: [[1, 1, "counter"], [2, 1, "counter"], [4, 1, "crate"], [5, 1, "crate"], [0, 2, "barrel"]],
    house: [[0, 1, "bed"], [3, 1, "chest"], [3, 2, "table"]],
  };
  // ================================================================ 초대
  /* 주민 집은 잠겨 있다. 초대(미션 type "visit": to, town, hid, day, from~until 시)가 있는 동안만 들어갈 수 있다. */
  function inviteAt(w, bd) {
    if (!bd || bd.kind !== "house" || !w || !w.ext) return null;
    const h = hour(w);
    return (w.ext.missions || []).find((m) => !m.done && m.type === "visit" && m.town === bd.town && m.hid === bd.hid && m.day === w.day && h >= m.start && h < m.until) || null;
  }
  const hostSpot = (bd) => [bd.x + 1, bd.y + 1];
  /** 초대가 끝났는데 남의 집 안에 있으면 문밖으로 배웅받는다. 지나간 초대는 정리한다 */
  function seeOut(w) {
    const e = ext(w), h = hour(w);
    for (const m of e.missions || []) if (!m.done && m.type === "visit" && (m.day < w.day || h >= m.until)) {
      m.done = true; if (!m.visited && w.npcs[m.to]) adjust(w.npcs[m.to], w.player.id, -4); // 기다렸는데 오지 않았다
    }
    const bd = insideBuilding(w);
    if (bd && bd.kind === "house" && breakinAt(w, bd)) return;
    if (e.breakin && absMin(w) >= e.breakin.until) e.breakin = null;
    if (bd && bd.kind === "house" && !inviteAt(w, bd)) {
      w.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] + 0.6 };
      log(w, "\"벌써 시간이 이렇게 됐네요.\" 집주인이 문 앞까지 배웅해 주었다.");
    } else if (bd && bd.kind === "house" && inviteAt(w, bd)) {
      const m = inviteAt(w, bd);
      if (!m.visited) { m.visited = true; const host = w.npcs[m.to]; adjust(host, w.player.id, 4);
        w.record("visit", `${jo(w.player.name, "이/가")} ${host.name}의 집에 초대받아 놀러 갔다`, { actor: w.player.id, target: host.id, town: bd.town, imp: 2, sent: 2, wr: 0.2 });
        log(w, `${jo(host.name, "이/가")} 반갑게 맞아 주었다. "어서 와요, 들어와요!"`, "good"); }
    }
  }
  const entryOf = (bd) => [bd.door[0], bd.y + bd.h - 1];
  /** 벽: 건물 안과 밖은 문(문간 ↔ 문 앞)으로만 오갈 수 있다 */
  function crossOK(ax, ay, bx, by) {
    if (!MAP.inb(ax, ay) || !MAP.inb(bx, by)) return true;
    const sa = MAP.solid[MAP.I(ax, ay)], sb = MAP.solid[MAP.I(bx, by)];
    if (sa === sb) return true;
    const pair = (s, ix, iy, ox, oy) => { if (s < 0) return false; const bd = MAP.buildings[s], [ex, ey] = entryOf(bd); return ix === ex && iy === ey && ox === bd.door[0] && oy === bd.door[1]; };
    if (sa >= 0 && sb >= 0) return false; // 건물에서 건물로 바로 넘어갈 수 없다
    return pair(sa, ax, ay, bx, by) || pair(sb, bx, by, ax, ay);
  }
  /** 이 건물 안에 놓인 것들: 원래 가구 + (내 집이면) 내가 놓은 가구 */
  function furnitureIn(w, bd) {
    const [ex, ey] = entryOf(bd); // 집을 넓혀 문이 옮겨져도 원래 가구가 문간을 막지 않게
    const base = (FURN[bd.kind] || []).filter(([rx, ry]) => !(bd.x + rx === ex && bd.y + ry === ey)).map(([rx, ry, type]) => ({ rx, ry, type, block: true }));
    const mine = w && w.ext && w.ext.furn && w.ext.furn[furnKey(bd)] ? w.ext.furn[furnKey(bd)].map((f) => ({ rx: f.rx, ry: f.ry, type: ITEMS[f.id] ? ITEMS[f.id].furniture : "crate", item: f.id, block: !(ITEMS[f.id] && ITEMS[f.id].walk) })) : [];
    return [...base, ...mine];
  }
  const canEnter = (w, bd) => ENTER.has(bd.kind) || !!inviteAt(w, bd) || !!breakinAt(w, bd);
  // ================================================================ 침입과 도둑질
  function breakinAt(w, bd) { const b = w && w.ext && w.ext.breakin; return b && bd && b.bd === bd.id && absMin(w) < b.until ? b : null; }
  const residentsOf = (w, bd) => { const id = A.houseId(bd.town, bd.hid); return w.alive().filter((n) => n.house === id && n.controller !== "player" && !n.at_war && n.jail === 0); };
  /** 지금 집 안에서 자고 있는 식구들 */
  const sleepersIn = (w, bd) => residentsOf(w, bd).filter((n) => { const k = walkers.get(n.id); return k ? k.inside : isNight(w); });
  /** 거리에서 나를 보는 사람들 */
  const streetEyes = (w) => [...walkers.entries()].filter(([, k]) => !k.inside && w.ppos && dist(k.x, k.y, w.ppos.x, w.ppos.y) < 8).map(([id]) => w.npcs[id]).filter((n) => n && n.alive);
  function breakIn(w, bd) {
    const p = w.player, e = ext(w);
    const eyes = streetEyes(w).filter(() => w.rng.next() < 0.6);
    spend(w, 10, 3);
    if (eyes.length) { crime(w, "trespass", residentsOf(w, bd)[0] || null, 1, `${jo(p.name, "이/가")} 남의 집 자물쇠를 따려다 ${eyes[0].name}에게 들켰다`); return "누군가 보고 있었다! 소리를 지른다."; }
    if (w.rng.next() > 0.65 + (isNight(w) ? 0.1 : 0)) return "자물쇠가 꿈쩍도 하지 않는다. 다시 해 볼까.";
    e.breakin = { bd: bd.id, until: absMin(w) + 90, looted: false };
    const [ex, ey] = entryOf(bd); w.ppos = { x: ex + 0.5, y: ey - 0.4 };
    return sleepersIn(w, bd).length ? "딸깍. 문이 열렸다… 안에서 누군가 자는 숨소리가 들린다." : "딸깍. 문이 열렸다. 집 안은 비어 있다.";
  }
  /** 침입한 집에서 무언가 하면, 자던 식구가 깰 수 있다 */
  function wakeCheck(w, bd, chance) {
    const p = w.player, s = sleepersIn(w, bd).find(() => w.rng.next() < chance);
    if (!s) return null;
    ext(w).breakin = null;
    adjust(s, p.id, -40);
    const k = walkers.get(s.id); if (k) { k.say = "도둑이야!"; k.sayT = 3; }
    crime(w, "burglary", s, 2, `${jo(p.name, "이/가")} ${s.name}의 집에 몰래 들어왔다가 들켰다`);
    w.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] + 0.6 };
    return `${jo(s.name, "이/가")} 눈을 떴다! "도둑이야!" 허겁지겁 도망쳐 나왔다.`;
  }
  function rummage(w, bd) {
    const p = w.player, e = ext(w), b = e.breakin;
    spend(w, 20, 3);
    const woke = wakeCheck(w, bd, 0.3); if (woke) return woke;
    if (b.looted) return "더 뒤질 곳이 없다.";
    b.looted = true;
    const res = residentsOf(w, bd), v = maxBy(res, (n) => n.gold);
    if (!v || v.gold < 2) { if (w.rng.next() < 0.5) { give(w, "bread", 1, "남의 집 서랍"); return "서랍에는 먹다 남은 빵 한 조각뿐이었다."; } return "가난한 집이다. 가져갈 게 없었다."; }
    const amt = Math.max(1, Math.round(Math.min(v.gold * 0.3, 40)));
    v.gold -= amt; p.gold += amt;
    if (w.rng.next() < 0.25) give(w, w.rng.choice(["old_coin", "bread", "potion"]), 1, "남의 집 서랍");
    w.record("theft_unknown", `누군가 ${v.name}의 집에 몰래 들어와 금화 ${amt}닢을 훔쳐 갔다`, { target: v.id, town: bd.town, imp: 3, wr: 0.5, secret: p.id });
    return `서랍 깊숙한 곳에서 금화 ${amt}닢을 찾아 챙겼다.`;
  }
  function insideBuilding(w) {
    if (!w || !w.ppos) return null;
    const x = Math.floor(w.ppos.x), y = Math.floor(w.ppos.y);
    if (!MAP.inb(x, y)) return null;
    const id = MAP.solid[MAP.I(x, y)];
    return id >= 0 ? MAP.buildings[id] : null;
  }
  function interiorWalkable(w, bd, x, y) {
    if (!canEnter(w, bd) || y <= bd.y) return false;
    const rx = x - bd.x, ry = y - bd.y;
    if (furnitureIn(w, bd).some((f) => f.block && f.rx === rx && f.ry === ry)) return false;
    const [ex, ey] = entryOf(bd);
    if (x === ex && y === ey) return true; // 문간은 누구나 디딜 수 있다
    if (bd.kind === "house") return true;   // 초대받은 집: 집주인도 손님도 안을 걸어 다닌다
    const cur = insideBuilding(w);
    return !!cur && cur.id === bd.id;
  }
  function townAt(x, y) {
    for (const [id, [cx, cy]] of Object.entries(TOWN_POS))
      if (x >= cx + TOWN_BOX.x0 - 1 && x <= cx + TOWN_BOX.x1 + 2 && y >= cy + TOWN_BOX.y0 - 1 && y <= cy + TOWN_BOX.y1 + 2) return id;
    return null;
  }
  const placeOf = (town, kind) => MAP.places.find((p) => p.town === town && p.kind === kind);
  function findPath(w, sx, sy, tx, ty, limit = 9000) {
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    if (!walkable(w, tx, ty)) {
      let best = null, bd = 1e9;
      for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
        if (walkable(w, tx + dx, ty + dy)) { const d = dist(sx, sy, tx + dx, ty + dy) + Math.hypot(dx, dy) * 3; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
      if (!best) return null;
      [tx, ty] = best;
    }
    const start = MAP.I(sx, sy), goal = MAP.I(tx, ty);
    if (start === goal) return [];
    const prev = new Map([[start, start]]), q = [start];
    for (let i = 0; i < q.length && q.length < limit; i++) {
      const c = q[i];
      if (c === goal) break;
      const cx = c % MW, cy = (c / MW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * MW + nx;
        if (prev.has(ni) || !walkable(w, nx, ny) || !crossOK(cx, cy, nx, ny)) continue;
        prev.set(ni, c); q.push(ni);
      }
    }
    if (!prev.has(goal)) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev.get(c)) path.push([c % MW + 0.5, ((c / MW) | 0) + 0.5]);
    return path.reverse();
  }

  // ================================================================ 아이템
  const ITEMS = {
    hand: { name: "맨손", tool: true, hint: "줍기·수확·말 걸기" },
    hoe: { name: "괭이", tool: true, act: "till", price: 20, sell: 6, hint: "밭을 간다" },
    can: { name: "물뿌리개", tool: true, act: "water", price: 15, sell: 5, hint: "작물에 물을 준다" },
    axe: { name: "쇠도끼", tool: true, act: "chop", yield: 3, price: 25, sell: 8, hint: "나무를 벤다 (나무 3)" },
    dagger: { name: "단검", tool: true, weapon: 2, price: 20, sell: 6, hint: "휘두른다" },
    sword: { name: "강철 검", tool: true, weapon: 4, price: 90, sell: 30, hint: "휘두른다" },
    skill: { name: "직업 기술", tool: true },
    seed_turnip: { name: "순무 씨앗", seed: "turnip", price: 2 }, seed_potato: { name: "감자 씨앗", seed: "potato", price: 3 },
    seed_wheat: { name: "밀 씨앗", seed: "wheat", price: 2 }, seed_berry: { name: "딸기 씨앗", seed: "strawberry", price: 5 },
    seed_pumpkin: { name: "호박 씨앗", seed: "pumpkin", price: 6 },
    turnip: { name: "순무", food: 2, energy: 6, sell: 6 }, potato: { name: "감자", food: 3, energy: 8, sell: 9 }, wheat: { name: "밀", sell: 5 },
    strawberry: { name: "딸기", food: 1, energy: 12, sell: 14 }, pumpkin: { name: "호박", food: 4, energy: 12, sell: 24 },
    apple: { name: "사과", food: 2, energy: 8, sell: 4 }, berry: { name: "산딸기", food: 1, energy: 6, sell: 3 },
    mushroom: { name: "버섯", food: 2, energy: 5, sell: 5 }, herb: { name: "약초", sell: 6 }, flower: { name: "들꽃", sell: 2 },
    meat: { name: "고기", food: 3, energy: 6, sell: 8 }, hide: { name: "가죽", sell: 12 }, wood: { name: "나무", sell: 3 },
    bread: { name: "빵", food: 4, energy: 15, price: 5, sell: 3 }, meal: { name: "고기 스튜", food: 5, energy: 30, sell: 10 },
    potion: { name: "치유 물약", heal: 5, price: 15, sell: 8 },
  };
  Object.assign(ITEMS, A.CONTENT.items); // 콘텐츠 팩의 아이템
  /** 세계에서 생긴 물건(gen)을 아이템 표에 맞춘다: 이전 세계의 것은 빼고 지금 세계의 것을 넣는다 (engine applyDefs가 부른다) */
  function syncGenItems() { for (const k of Object.keys(ITEMS)) if (ITEMS[k].gen) delete ITEMS[k]; for (const [k, v] of Object.entries(A.CONTENT.items)) if (v.gen) ITEMS[k] = v; }
  const CROPS = {
    turnip: { name: "순무", days: 4, seasons: ["봄", "가을"], item: "turnip", y: [1, 2] },
    potato: { name: "감자", days: 6, seasons: ["봄", "여름"], item: "potato", y: [1, 3] },
    wheat: { name: "밀", days: 7, seasons: ["여름", "가을"], item: "wheat", y: [2, 3] },
    strawberry: { name: "딸기", days: 8, seasons: ["봄", "여름"], item: "strawberry", y: [2, 3], regrow: 3 },
    pumpkin: { name: "호박", days: 10, seasons: ["가을"], item: "pumpkin", y: [1, 1] },
  };
  const SEED_OF = { turnip: "seed_turnip", potato: "seed_potato", wheat: "seed_wheat", strawberry: "seed_berry", pumpkin: "seed_pumpkin" };
  /** 직업 기술은 직업 정의(engine.js·content.js)의 skill에서 온다. 정의가 없으면 기본 기술. */
  const SKILL = new Proxy({}, { get: (_, id) => (JOBS[id] && JOBS[id].skill) || { name: "성실함", hint: "스스로를 다잡는다. 기력을 조금 되찾는다" } });
  // ================================================================ 플레이어 상태
  /* ext(w): 플레이어로 사는 동안의 상태를 읽고 쓰는 창구. 값은 실제로 세 곳에 나뉘어 산다 (Asteria.extStore 표):
   *   w.land(세계에 남는 흔적) · w.session(화면) · 지금 조종하는 인물의 n.ext(소지품·도감·미션·수배·집…)
   * 그래서 다시 태어나거나 다른 사람으로 살면, 이전 인물의 것은 그 인물에게 남는다. */
  const charDefaults = () => ({ inv: {}, hot: [], sel: 0, missions: [], msSeq: 0, wanted: { town: null, level: 0, lastSeen: 0 }, trackUntil: 0, dates: [], log: [] });
  function extOf(n) { if (!n.ext) n.ext = charDefaults(); return n.ext; }
  function ext(w) {
    if (w.ext && w.ext.__view) return w.ext;
    w.land = { v: 1, farm: {}, picked: {}, removed: {}, ...(w.land || {}) };
    w.session = { facing: "down", ...(w.session || {}) };
    const store = (k) => { const s = A.extStore(k); if (s === "land") return w.land; if (s === "session") return w.session; return w.player ? extOf(w.player) : (w._nobody = w._nobody || charDefaults()); };
    const keys = () => [...new Set([...Object.keys(w.land), ...Object.keys(w.session), ...Object.keys(w.player ? extOf(w.player) : {})])];
    w.ext = new Proxy({}, {
      get: (_, k) => (k === "__view" ? true : typeof k === "string" ? store(k)[k] : undefined),
      set: (_, k, v) => { store(k)[k] = v; return true; },
      has: (_, k) => k in store(k),
      deleteProperty: (_, k) => { delete store(k)[k]; return true; },
      ownKeys: () => keys(),
      getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, writable: true, value: store(k)[k] }),
    });
    return w.ext;
  }
  const absMin = (w) => w.day * 1440 + w.clock;
  const has = (w, id, n = 1) => (ext(w).inv[id] || 0) >= n;
  // ================================================================ 도감
  /* 내가 실제로 얻어 본 것만 적힌다. 얻은 방법과 곳도 내가 겪은 만큼만 쌓인다. */
  const CODEX_CATS = [["mat", "재료"], ["food", "음식"], ["weapon", "무기"], ["tool", "도구"], ["thing", "물건"], ["magic", "마법"], ["tech", "기술"]];
  function catOf(id) {
    const it = ITEMS[id];
    if (!it) return null;
    if (it.weapon) return "weapon";
    if (it.tool) return "tool";
    if (it.food || it.heal || it.energy) return "food";
    if (it.furniture || it.teaches || it.sell >= 15 && !it.seed) return "thing";
    return "mat";
  }
  function zoneName(w) {
    if (!w.ppos) return "";
    const t = townAt(w.ppos.x, w.ppos.y);
    if (t) return w.towns[t].name;
    const tile = MAP.tile[MAP.I(Math.floor(w.ppos.x), Math.floor(w.ppos.y))];
    return tile === T.FLOOR ? "깊은 숲" : tile === T.WASTE ? "북쪽 황무지" : tile === T.SAND ? "모래사장" : "들판";
  }
  /** 도감에 적는다. how: 얻은 방법(짧은 명사구), at: 곳(없으면 지금 있는 곳) */
  function note(w, id, how, at, quiet) {
    if (!ITEMS[id] || id === "hand" || id === "skill") return false;
    const e = ext(w), c = (e.codex = e.codex || {});
    const fresh = !c[id];
    const ent = c[id] = c[id] || { d: w.day, ways: [] };
    if (how) {
      let wy = ent.ways.find((x) => x.how === how);
      if (!wy) { wy = { how, at: [] }; ent.ways.push(wy); }
      const place = at === undefined ? zoneName(w) : at;
      if (place && !wy.at.includes(place) && wy.at.length < 4) wy.at.push(place);
    }
    if (fresh && !quiet && G.onCodex) G.onCodex(id);
    return fresh;
  }
  const codexHas = (w, id) => !!(ext(w).codex || {})[id];
  /** 내가 아는 만드는 법: 필요한 지식을 알거나 지식이 필요 없는 것 */
  const knownRecipes = (w) => A.CONTENT.recipes.filter((r) => !r.know || (w.player && A.knows(w.player, r.know)));
  function give(w, id, n = 1, how, at) {
    const e = ext(w);
    if (n > 0) note(w, id, how, at);
    e.inv[id] = (e.inv[id] || 0) + n;
    if (e.inv[id] <= 0) delete e.inv[id];
    if (n > 0 && !e.hot.includes(id) && e.hot.length < 10 && (ITEMS[id].tool || ITEMS[id].act || ITEMS[id].seed || ITEMS[id].food || ITEMS[id].heal)) e.hot.push(id);
    if (typeof root.Story !== "undefined") root.Story.onItem(w, id, n);
  }
  function take(w, id, n = 1) { if (!has(w, id, n)) return false; give(w, id, -n); return true; }
  function weaponDmg(w) { const e = ext(w); const best = Math.max(0, ...Object.keys(e.inv).filter((id) => ITEMS[id] && ITEMS[id].weapon && e.inv[id] > 0).map((id) => ITEMS[id].weapon)); return best ? best + (e.sharp ? 1 : 0) : 1; }

  // ================================================================ 시계·기력
  const clockText = (w) => { const t = 360 + w.clock, hh = Math.floor(t / 60) % 24, mm = t % 60; return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; };
  const hour = (w) => 6 + w.clock / 60;
  const isNight = (w) => w.clock >= 1020;
  const afterMidnight = (w) => w.clock >= 1080;
  function log(w, text, tone) { w.todayLog.push({ t: clockText(w), d: w.day, text, tone }); if (w.todayLog.length > 80) w.todayLog.shift(); G.onLog && G.onLog(text, tone); }

  function setup(w) {
    ext(w);
    A.syncContent(w); // 저장된 세계에 새로 더해진 마을·인물을 들인다
    rebuildMap(w);
    w.onMapChange = (quiet) => { rebuildMap(w); if (G.onMapChange) G.onMapChange(quiet); };
    const e0 = ext(w);
    if (e0.respread) { // 마을 사이가 넓어진 저장: 땅의 기록을 가장 가까운 마을과의 거리를 지켜 새 마을 자리로 옮긴다
      const k = e0.respread, oldW = e0.mw || MW, towns = A.allTownDefs(w).map((t) => ({ nx: t.pos[0], ny: t.pos[1], ox: Math.round(t.pos[0] / k), oy: Math.round(t.pos[1] / k) }));
      const move = (x, y) => { const t = towns.reduce((b, c) => (Math.hypot(c.ox - x, c.oy - y) < Math.hypot(b.ox - x, b.oy - y) ? c : b)); return [Math.max(1, Math.min(MW - 2, t.nx + (x - t.ox))), Math.max(1, Math.min(MH - 2, t.ny + (y - t.oy)))]; };
      const mvIdx = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([key, v]) => { const pre = /^[a-z]/.test(key) ? key[0] : "", i = +key.slice(pre.length); const [x, y] = move(i % oldW, Math.floor(i / oldW)); return [pre + (y * MW + x), v]; }));
      e0.removed = mvIdx(e0.removed); e0.picked = mvIdx(e0.picked); e0.looted = mvIdx(e0.looted);
      e0.farm = Object.fromEntries(Object.entries(e0.farm || {}).map(([key, v]) => { const [x, y] = key.split(",").map(Number); const [nx, ny] = move(x, y); return [nx + "," + ny, v]; }));
      if (w.ppos) { const [x, y] = move(Math.floor(w.ppos.x), Math.floor(w.ppos.y)); w.ppos = { ...w.ppos, x: x + 0.5, y: y + 0.5 }; }
      e0.mw = MW; delete e0.respread;
    }
    if (e0.mw !== MW) { // 지도 크기가 바뀐 저장: 타일 번호로 적어 둔 기록을 옮긴다
      if (e0.mw === undefined) { e0.removed = {}; e0.picked = {}; }
      else { const mv = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => { const pre = /^[a-z]/.test(k) ? k[0] : "", i = +k.slice(pre.length); return [pre + ((Math.floor(i / e0.mw)) * MW + i % e0.mw), v]; })); e0.removed = mv(e0.removed); e0.picked = mv(e0.picked); e0.looted = mv(e0.looted); }
      e0.mw = MW;
    }
    if (root.Story) root.Story.setup(w);
    if (e0.furn) for (const k of Object.keys(e0.furn)) if (/^\d+$/.test(k)) { const bd = MAP.buildings[+k]; if (bd) e0.furn[furnKey(bd)] = e0.furn[k]; delete e0.furn[k]; } // 옛 저장: 건물 번호 → 고정 키
    if (!e0.codex && w.player) { e0.codex = {}; for (const id of Object.keys(e0.inv)) note(w, id, null, "", true); } // 도감이 생기기 전의 저장
    const p = w.player;
    if (p && p.energy === undefined) p.energy = 100;
    if (p && (!w.ppos || !Number.isFinite(w.ppos.x) || !walkable(w, Math.floor(w.ppos.x), Math.floor(w.ppos.y)))) placeIn(w, p.town, "square");
    if (!w.dayOpen) A.beginDay(w);
    walkers.clear(); animals.length = 0;
  }
  function placeIn(w, town, kind) {
    const pl = placeOf(town, kind) || placeOf(town, "square");
    w.ppos = { x: pl.x + 0.5, y: pl.y + 0.5 };
    const p = w.player;
    if (p) { p.outside = false; p.town = town; }
  }
  /* 새 삶: 이번 삶의 것(가방·수배·미션…)은 이전 인물에게 그대로 남고(n.ext), 새 인물은 빈손으로 시작한다.
   * 세계의 흔적(w.land)은 그대로, 화면 상태(w.session)는 새로. 지난 삶에서 고친 집은 건물로 남는다(w.innMods). */
  function resetLife(w) {
    const e = ext(w);
    w.innMods = w.innMods || {};
    for (const [town, h] of Object.entries(e.home || {})) { // 지난 삶의 집 공사는 건물로 남는다
      const m = w.innMods[town] = w.innMods[town] || {};
      for (const k of ["dx", "dw", "dh"]) m[k] = (m[k] || 0) + (h[k] || 0);
      for (const k of ["roof", "wall", "floor"]) if (h[k]) m[k] = h[k];
    }
    if (e.home) e.home = {}; // 건물로 옮겼으니 같은 공사가 두 번 더해지지 않게
    w.session = { facing: "down" };
    w.journal = []; w.papers = []; w.episodes = []; w.autoDays = 0; w.todayLog = []; w.lastPaper = w.day;
    for (const k of walkers.values()) { k.chase = false; k.fight = false; k.seek = null; }
  }
  function newLife(w, opts) {
    resetLife(w);
    const p = A.addPlayer(w, opts);
    p.energy = 100; p.home = opts.town;
    const e = ext(w);
    e.inv = {}; e.hot = []; e.codex = {};
    // 누구나 아는 것: 빵, 그리고 맨손으로 모으는 세 가지
    for (const [id, how] of [["bread", "빵집에서 사기"], ["branch", "나무 밑에서 줍기"], ["stone", "바위 둘레에서 줍기"], ["fiber", "풀 뜯기"]]) note(w, id, how, "", true);
    // 빈손으로 시작한다: 맨손과 직업 기술, 빵 한 조각. 도구는 주워 모아 만들거나 가게에서 산다.
    for (const id of ["hand", "skill", "bread"]) give(w, id, 1);
    placeIn(w, opts.town, "inn");
    w.ppos.y += 0.6;
    setup(w);
    return p;
  }
  function blockedReason(w) {
    const p = w.player;
    if (!p) return "캐릭터가 없다";
    if (!p.alive) return "세상을 떠났다";
    if (p.at_war) return p.role === "hero" ? "용사로서 전선에 있다" : `전선에서 복무 중 (${p.service_left}일 남음)`;
    if (p.jail > 0) return `감옥에 갇혀 있다 (${p.jail}일 남음)`;
    if (w.autoDays > 0) return `성격대로 지내는 중 (${w.autoDays}일 남음)`;
    if (p.trip) return "마차를 타고 가는 중";
    return null;
  }
  function tick(w, mins) {
    const p = w.player;
    A.advance(w, mins);
    if (p && p.alive && !p.at_war && p.jail === 0 && afterMidnight(w)) {
      p.energy = Math.max(0, p.energy - mins * 0.12);
      if (p.energy <= 0) faint(w, "기력이 다해 그 자리에 쓰러졌다.");
    }
    decayWanted(w);
    A.arriveDue(w);
    rideTick(w);
    syncPos(w);
    seeOut(w);
    if (w.ppos && w.player && w.player.alive) unstick(w);
    if (root.Story) root.Story.afterTick(w);
  }
  function spend(w, mins, energy) {
    const p = w.player;
    if (mins) A.advance(w, mins);
    p.energy = clamp(p.energy - (energy || 0), 0, 100);
    if (afterMidnight(w)) p.energy = Math.max(0, p.energy - mins * 0.12);
    syncPos(w);
    if (p.alive && p.energy <= 0 && !p.at_war && p.jail === 0) faint(w, "기력이 다해 쓰러졌다.");
    if (root.Story) root.Story.afterTick(w);
  }
  function sleep(w, how) {
    const p = w.player, mins = 1440 - w.clock, hours = mins / 60;
    let q = 1, text = how === "inn" ? "여관에서 하룻밤을 묵었다." : how === "home" ? "집에서 푹 잠들었다." : how === "guest" ? `${arguments[2] || "친구"}의 집에서 하룻밤 신세를 졌다.` : "바닥에 몸을 누이고 잠들었다.";
    if (how === "inn") p.gold -= 3;
    if (how === "rough") q = 0.7;
    p.asleep = true; A.advance(w, mins); p.asleep = false;
    p.energy = Math.round(Math.min(100, (40 + hours * 8) * q));
    p.health = Math.min(10, p.health + (how === "rough" ? 1 : 3));
    if (how === "rough" && !townAt(w.ppos.x, w.ppos.y) && w.rng.next() < 0.15) { const lost = Math.round(p.gold * 0.2); p.gold -= lost; text += ` 깨어 보니 금화 ${lost}닢이 사라졌다.`; }
    syncPos(w);
    log(w, `${text} 기력이 ${p.energy}까지 회복되었다.`);
    if (root.Story) root.Story.afterTick(w);
  }
  function faint(w, why) {
    const p = w.player;
    if (!p.alive) return;
    const mins = 1440 - w.clock;
    p.asleep = true; A.advance(w, mins); p.asleep = false;
    p.energy = 45; p.health = Math.max(p.health, 4);
    let text = why;
    const town = townAt(w.ppos.x, w.ppos.y) || p.town;
    if (!p.at_war && p.jail === 0 && p.alive) { placeIn(w, town, "temple"); w.ppos.y += 0.6; text += ` ${w.towns[town].name} 신전에서 눈을 떴다.`; }
    if (w.rng.next() < 0.3) { const lost = Math.round(p.gold * 0.15); p.gold -= lost; if (lost) text += ` 금화 ${lost}닢이 없어졌다.`; }
    log(w, text, "warn");
  }
  /** 마차: 타고 가는 동안은 수레를 따라가고, 닿으면 그 마을 광장에 내린다 */
  function rideTick(w, dt) {
    const p = w.player, e = ext(w); if (!p || !w.ppos) return;
    if (p.trip) {
      const tr = (w.trips || []).find((x) => x.id === p.trip);
      if (!tr) { p.trip = null; return; }
      e.ride = { to: tr.to };
      const pt = A.tripPoint(w, tr), d = Math.hypot(pt[2], pt[3]) || 1, i = tr.riders.indexOf(p.id) + 1;
      const tx = pt[0] - pt[2] / d * i * 0.9 + 0.5, ty = pt[1] - pt[3] / d * i * 0.9 + 1;
      const f = dt === undefined ? 1 : Math.min(1, dt * 3);
      w.ppos = { x: w.ppos.x + (tx - w.ppos.x) * f, y: w.ppos.y + (ty - w.ppos.y) * f }; p.outside = true;
      return;
    }
    if (e.ride) {
      const to = e.ride.to; e.ride = null;
      p.outside = false; p.town = to; placeIn(w, to, "square");
      log(w, `마차가 ${w.towns[to].name}에 닿았다.`, "good");
      if (root.Story) root.Story.onEnterTown(w, to);
    }
  }
  /** 마부의 마차를 탄다 (요금은 길이에 따라) */
  function rideFare(w, from, to) { const r = A.routeOf(w, from, to); return r ? Math.max(4, Math.round(3 + r.len / 25)) : null; }
  function boardCoach(w, driver, to) {
    const p = w.player, fare = rideFare(w, driver.town, to);
    if (fare === null || p.gold < fare || driver.trip) return false;
    p.gold -= fare; driver.gold += fare;
    const now = w.day * 1440 + w.clock;
    const waiting = (w.waiting || []).filter((x) => x.to === to && w.npcs[x.id] && w.npcs[x.id].town === driver.town && !w.npcs[x.id].trip).slice(0, 3).map((x) => x.id);
    const tr = A.startTrip(w, driver, "people", driver.town, to, now + 2, { riders: [p.id, ...waiting] });
    if (!tr) { p.gold += fare; driver.gold -= fare; return false; }
    ext(w).ride = { to };
    log(w, `${driver.name}의 마차에 올랐다. ${w.towns[to].name}까지 ${Math.round((tr.t1 - tr.t0) / 60 * 10) / 10}시간.`);
    return true;
  }
  function syncPos(w) {
    const p = w.player;
    if (!p || !w.ppos || p.trip) return;
    if (p.at_war) { const c = placeOf(FRONT, "camp"); w.ppos = { x: c.x + 0.5, y: c.y + 1.5 }; p.outside = false; return; }
    if (p.jail > 0) { const g = placeOf(p.town, "guild"); w.ppos = { x: g.x + 0.5, y: g.y + 0.6 }; p.outside = false; return; }
    const t = townAt(w.ppos.x, w.ppos.y);
    if (!p.outside && t !== p.town) placeIn(w, p.town, "square");
  }

  /** 벽이나 물체에 끼었으면 가장 가까운 설 수 있는 곳으로 꺼내 준다 */
  function unstick(w) {
    const x = Math.floor(w.ppos.x), y = Math.floor(w.ppos.y);
    const fits = (fx, fy) => walkable(w, Math.floor(fx - 0.28), Math.floor(fy - 0.1)) && walkable(w, Math.floor(fx + 0.28), Math.floor(fy - 0.1)) && walkable(w, Math.floor(fx - 0.28), Math.floor(fy + 0.25)) && walkable(w, Math.floor(fx + 0.28), Math.floor(fy + 0.25));
    if (walkable(w, x, y) && fits(w.ppos.x, w.ppos.y)) return false;
    if (walkable(w, x, y)) { w.ppos = { x: x + 0.5, y: y + 0.5 }; return true; } // 타일 가운데로
    const sid = MAP.inb(x, y) ? MAP.solid[MAP.I(x, y)] : -1;
    if (sid >= 0) { const bd = MAP.buildings[sid]; w.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] + 0.5 }; return true; } // 건물 벽 속이면 문 앞으로
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (walkable(w, x + dx, y + dy)) { w.ppos = { x: x + dx + 0.5, y: y + dy + 0.5 }; return true; }
    return false;
  }
  // ================================================================ 움직임
  const SPEED = 4.2, RUN = 6.2;
  /** 연속 이동. dx, dy는 -1~1. dt는 실제 초. 마을 밖에서는 시간이 더 흐른다. */
  function move(w, dx, dy, dt, running) {
    const p = w.player;
    if (!p || blockedReason(w)) return false;
    const e = ext(w);
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      e.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    } else return false;
    const sp = (running && p.energy > 5 ? RUN : SPEED) * dt;
    const nx = w.ppos.x + dx * sp, ny = w.ppos.y + dy * sp;
    unstick(w);
    const cx0 = Math.floor(w.ppos.x), cy0 = Math.floor(w.ppos.y);
    const ok = (x, y) => crossOK(cx0, cy0, Math.floor(x), Math.floor(y)) && walkable(w, Math.floor(x - 0.28), Math.floor(y - 0.1)) && walkable(w, Math.floor(x + 0.28), Math.floor(y - 0.1)) && walkable(w, Math.floor(x - 0.28), Math.floor(y + 0.25)) && walkable(w, Math.floor(x + 0.28), Math.floor(y + 0.25));
    let moved = false;
    if (ok(nx, w.ppos.y)) { w.ppos.x = nx; moved = true; }
    if (ok(w.ppos.x, ny)) { w.ppos.y = ny; moved = true; }
    if (!moved) return false;
    if (running) p.energy = Math.max(0, p.energy - dt * 1.2);
    const t = townAt(w.ppos.x, w.ppos.y);
    if (t) {
      if (p.outside || p.town !== t) { p.outside = false; p.town = t; log(w, `${w.towns[t].name}에 들어섰다.`); if (root.Story) root.Story.onEnterTown(w, t); }
    } else {
      p.outside = true;
      // 마을 밖에서도 시간은 평소처럼 흐른다 (예전엔 한 칸에 4분씩 더 흘렀다)
    }
    return true;
  }
  function facingTile(w) {
    const e = ext(w), d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[e.facing];
    return [Math.floor(w.ppos.x + d[0] * 0.8), Math.floor(w.ppos.y + d[1] * 0.8)];
  }
  function face(w, tx, ty) {
    const dx = tx + 0.5 - w.ppos.x, dy = ty + 0.5 - w.ppos.y;
    ext(w).facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  // ================================================================ 농사
  const fkey = (x, y) => x + "," + y;
  function canTill(w, x, y) {
    const p = w.player, t = MAP.getT(x, y);
    if (objAt(w, x, y) && objAt(w, x, y) !== O.FLOWER) return false;
    if (MAP.solid[MAP.I(x, y)] >= 0) return false;
    if (t === T.FIELD) return true;
    if (t === T.GRASS && p.home) {
      const h = homeBuilding(w);
      if (h && Math.hypot(x - h.door[0], y - h.door[1]) <= 6 && y > h.y + h.h - 1) return true;
    }
    return false;
  }
  function homeBuilding(w) { const p = w.player; return p && p.home ? MAP.buildings.find((b) => b.town === p.home && b.kind === "inn") : null; }
  function farmDawn(w) {
    const e = ext(w), season = w.season;
    if (w.weather && ["비", "폭풍"].includes(w.weather.kind)) for (const f of Object.values(e.farm)) f.watered = w.day - 1; // 비 오는 날 아침엔 밭이 젖어 있다 (물 준 것과 같다)
    for (const [k, f] of Object.entries(e.farm)) {
      if (f.crop) {
        const c = CROPS[f.crop.type];
        if (!c.seasons.includes(season)) { if (!f.crop.dead) { f.crop.dead = true; } }
        else if (f.watered === w.day - 1 && f.crop.g < c.days) f.crop.g += 1 + (f.crop.boost === w.day - 1 ? 1 : 0);
      } else if (f.watered < w.day - 6 && w.rng.next() < 0.2) delete e.farm[k];
    }
  }

  // ================================================================ 동물
  const ANIMAL = {
    rabbit: { name: "토끼", hp: 2, speed: 2.2, flee: 6, fleeSpeed: 5.6, drop: [["meat", 1]], zone: [T.GRASS], cap: 16 },
    deer: { name: "사슴", hp: 4, speed: 1.8, flee: 7, fleeSpeed: 5.2, drop: [["meat", 2], ["hide", 1]], zone: [T.GRASS, T.FLOOR], cap: 10 },
    boar: { name: "멧돼지", hp: 7, speed: 1.6, chase: 4.3, dmg: 1.5, aggro: 3, drop: [["meat", 3], ["hide", 1]], zone: [T.FLOOR], cap: 8 },
    wolf: { name: "늑대", hp: 5, speed: 2.4, chase: 4.8, dmg: 1.2, aggro: 6, drop: [["hide", 2]], zone: [T.WASTE, T.FLOOR], cap: 6, night: true },
    chicken: { name: "닭", hp: 1, speed: 1.2, flee: 2.5, fleeSpeed: 3, drop: [["meat", 1]], town: true, cap: 0 },
  };
  const animals = [];
  let animalSeq = 0;
  function updateAnimals(w, dt) {
    const p = w.player, px = w.ppos ? w.ppos.x : 75, py = w.ppos ? w.ppos.y : 60;
    // 주변에 짐승을 채운다
    const counts = {};
    for (const a of animals) counts[a.type] = (counts[a.type] || 0) + 1;
    for (let i = animals.length - 1; i >= 0; i--) if (dist(animals[i].x, animals[i].y, px, py) > 55) animals.splice(i, 1);
    for (const [type, def] of Object.entries(ANIMAL)) {
      if (def.town) continue;
      const cap = def.night && !isNight(w) && hour(w) < 20 ? Math.floor(def.cap / 2) : def.cap;
      if ((counts[type] || 0) >= cap) continue;
      for (let tries = 0; tries < 6; tries++) {
        const ang = Math.random() * Math.PI * 2, r = 16 + Math.random() * 30;
        const x = Math.floor(px + Math.cos(ang) * r), y = Math.floor(py + Math.sin(ang) * r);
        if (!walkable(w, x, y) || townAt(x, y) || !def.zone.includes(MAP.getT(x, y))) continue;
        animals.push({ id: ++animalSeq, type, x: x + 0.5, y: y + 0.5, hp: def.hp, vx: 0, vy: 0, t: 0, state: "idle", hurt: 0, cd: 0 });
        break;
      }
    }
    // 마을 닭
    for (const [town, [cx, cy]] of Object.entries(TOWN_POS)) {
      if (dist(cx, cy, px, py) > 45) continue;
      const n = animals.filter((a) => a.type === "chicken" && a.town === town).length;
      const killed = (ext(w).chickenGone || {})[town] || 0;
      if (n + killed < 4) { const x = cx + 6 + (n % 3), y = cy + 10 + Math.floor(n / 3); if (walkable(w, x, y)) animals.push({ id: ++animalSeq, type: "chicken", town, x: x + 0.5, y: y + 0.5, hp: 1, vx: 0, vy: 0, t: 0, state: "idle", hurt: 0, cd: 0 }); }
    }
    for (const a of animals) {
      const def = ANIMAL[a.type], d = dist(a.x, a.y, px, py);
      a.t -= dt; a.cd -= dt; a.hurt = Math.max(0, a.hurt - dt);
      const alive = p && p.alive && !p.at_war && p.jail === 0 && w.ppos;
      if (def.chase && alive && (a.state === "chase" || (d < def.aggro && (a.type === "wolf" || a.hp < def.hp)))) {
        a.state = "chase";
        if (d > 14) a.state = "idle";
        const sp = def.chase;
        a.vx = (px - a.x) / d * sp; a.vy = (py - a.y) / d * sp;
        if (d < 0.9 && a.cd <= 0) { a.cd = 0.9; p.health -= def.dmg; G.onHurt && G.onHurt(def.name); if (p.health <= 0) { faint(w, `${def.name}에게 당해 쓰러졌다.`); } }
      } else if (def.flee && alive && d < def.flee) {
        a.state = "flee";
        a.vx = (a.x - px) / d * def.fleeSpeed; a.vy = (a.y - py) / d * def.fleeSpeed;
      } else if (a.t <= 0) {
        a.state = "idle"; a.t = 1 + Math.random() * 3;
        if (Math.random() < 0.6) { const ang = Math.random() * Math.PI * 2; a.vx = Math.cos(ang) * def.speed; a.vy = Math.sin(ang) * def.speed; } else { a.vx = a.vy = 0; }
      }
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
      const okA = (x, y) => walkable(w, Math.floor(x), Math.floor(y)) && (def.town || !townAt(x, y) || a.state === "chase") && (!def.town || townAt(x, y) === a.town);
      if (okA(nx, a.y)) a.x = nx; else a.vx = -a.vx;
      if (okA(a.x, ny)) a.y = ny; else a.vy = -a.vy;
    }
  }
  function hitAnimal(w, a, dmg, verb = "베었다") {
    const def = ANIMAL[a.type];
    a.hp -= dmg; a.hurt = 0.3;
    if (def.chase) a.state = "chase";
    if (a.hp > 0) return `${jo(def.name, "을/를")} ${verb}.`;
    animals.splice(animals.indexOf(a), 1);
    const got = [];
    for (const [id, n] of def.drop) { const k = n + (w.player.job === "adventurer" && Math.random() < 0.5 ? 1 : 0); give(w, id, k, `${def.name} 사냥`); got.push(`${ITEMS[id].name} ${k}`); }
    if (root.Story) root.Story.onKill(w, a.type);
    if (a.type === "chicken") {
      const e = ext(w); e.chickenGone = e.chickenGone || {}; e.chickenGone[a.town] = (e.chickenGone[a.town] || 0) + 1;
      crime(w, "livestock", null, 1, `${jo(w.player.name, "이/가")} ${w.towns[a.town].name}의 닭을 잡아 버렸다`);
    }
    return `${jo(def.name, "을/를")} 잡았다! (${got.join(", ")})`;
  }

  // ================================================================ 주민의 움직임
  const walkers = new Map();
  function scheduleSpot(w, n) {
    if (!n.alive || n.outside || n.controller === "player") return null;
    if (n.at_war) { const c = placeOf(FRONT, "camp"); return [c.x + ((n.id % 7) - 3), c.y + 2 + (n.id % 3)]; }
    if (n.trip) { // 길 위: 짐꾼·마부와 탄 사람들은 길을 따라 움직인다
      const tr = (w.trips || []).find((x) => x.id === n.trip), pt = tr && A.tripPoint(w, tr);
      if (pt) { const i = n.id === tr.by ? 0 : tr.riders.indexOf(n.id) + 1, d = Math.hypot(pt[2], pt[3]) || 1; return [pt[0] - pt[2] / d * i * 0.9, pt[1] - pt[3] / d * i * 0.9 + 0.5, false, undefined, undefined, undefined, "road"]; }
    }
    if (n.away && TOWN_POS[n.away.at]) return awaySpot(w, n);
    const h = hour(w), hs = h2(n.id, w.day, 7), t = n.town;
    const [cx, cy] = TOWN_POS[t];
    const hh = houseOfNpc(n);
    const houseOf = () => { const b = MAP.buildings.find((q) => q.town === hh.town && q.kind === "house" && q.hid === hh.hid); if (b) return [b.door[0], b.door[1], true]; const pl = placeOf(t, "inn"); return [pl.x, pl.y, true]; };
    if (n.jail > 0) { const g = placeOf(t, "guild"); return [g.x, g.y, true]; }
    // 손님을 초대한 날: 약속 시간에는 집 안에서 기다린다
    // 집주인은 가운데, 같은 집 식구들은 저마다 빈자리에서 손님을 맞는다
    const vm = w.ext && (w.ext.missions || []).find((m) => !m.done && m.type === "visit" && m.town === hh.town && m.hid === hh.hid && m.day === w.day && h >= m.start - 0.5 && h < m.until);
    if (vm) {
      const hb = MAP.buildings.find((b) => b.town === vm.town && b.kind === "house" && b.hid === vm.hid);
      if (hb) {
        if (vm.to === n.id) return hostSpot(hb);
        const mates = w.residents(n.town, true).filter((x) => x.id !== vm.to && x.house === n.house && x.controller !== "player").map((x) => x.id);
        const free = []; const fur = furnitureIn(w, hb), [ex, ey] = entryOf(hb), [hx, hy] = hostSpot(hb);
        for (let ry = 1; ry < hb.h; ry++) for (let rx = 0; rx < hb.w; rx++) { const x = hb.x + rx, y = hb.y + ry; if ((x === ex && y === ey) || (x === hx && y === hy) || fur.some((f) => f.block && f.rx === rx && f.ry === ry)) continue; free.push([x, y]); }
        const i = mates.indexOf(n.id);
        if (i >= 0 && i < free.length) return free[i];
      }
    }
    // 삶의 층(engine)이 정한 지금 할 일을 따라간다
    const L = n.life && n.life.day === w.day ? n.life : null;
    if (L) {
      const bdOf = (kind) => MAP.buildings.find((q) => q.town === t && q.kind === kind);
      const slotL = Math.floor(h);
      switch (L.act) {
        case "sleep": case "rest": case "chores": return houseOf();
        case "meal": { if (L.place === "tavern") { const sp = workSpot(w, bdOf("tavern"), n, slotL + 77); if (sp) return sp; } return houseOf(); }
        case "shop": { const sp = workSpot(w, bdOf("market"), n, slotL + 31); if (sp) return sp; break; }
        case "pray": { const sp = workSpot(w, bdOf("temple"), n, slotL + 41); if (sp) return sp; break; }
        case "social": {
          if (L.place === "tavern") { const sp = workSpot(w, bdOf("tavern"), n, slotL + 77); if (sp) return sp; }
          if (L.place === "house" && L.host !== undefined && w.npcs[L.host]) {
            const hn = houseOfNpc(w.npcs[L.host]), hb = hn && MAP.buildings.find((b) => b.town === hn.town && b.kind === "house" && b.hid === hn.hid);
            const sp = hb && workSpot(w, hb, n, slotL + 91); if (sp) return sp;
          }
          return spotNear(w, placeOf(t, "square"), n.id, 3);
        }
        case "fish": case "play": {
          if (L.place === "river") { // 냇가: 마을에서 가장 가까운 물가 근처에 앉는다
            const R0 = 30; let best = null, bd = 1e9;
            for (let y = cy - R0; y <= cy + R0; y += 2) for (let x = cx - R0; x <= cx + R0; x += 2) { const tt = MAP.getT(x, y); if (tt === T.WATER) { const d = dist(x, y, cx, cy) + ((L.spot || 0) % 7); if (d < bd && d > 8) { bd = d; best = [x, y]; } } }
            if (best) for (let k = 0; k < 24; k++) { const x = best[0] + ((k * 5 + n.id) % 5) - 2, y = best[1] + ((k * 3 + n.id) % 5) - 2; if (walkable(w, x, y)) return [x, y]; }
          }
          if (L.place === "square") return spotNear(w, placeOf(t, "square"), n.id + (L.with || 0), 3);
          if (L.place === "tavern") { const sp = workSpot(w, bdOf("tavern"), n, slotL + 77); if (sp) return sp; }
          // 들판·냇가·언덕: 마을 밖 한 곳에 같이 간 사람들이 모여 논다
          const seed = (L.spot || 0) + (L.with !== undefined ? Math.min(n.id, L.with) * 7 : n.id), ang = (seed % 360) * Math.PI / 180, R = 22 + (seed % 9);
          const ox = Math.round(cx + Math.cos(ang) * R), oy = Math.round(cy + Math.sin(ang) * R * 0.7);
          for (let k = 0; k < 20; k++) { const x = ox + ((k * 7 + n.id) % 5) - 2, y = oy + ((k * 3 + n.id) % 4) - 1; if (walkable(w, x, y)) return [x, y]; }
          return spotNear(w, placeOf(t, "square"), n.id, 3);
        }
        case "kid": return L.place === "home" ? houseOf() : [cx - 2 + (n.id % 5), cy - 2 + (n.id % 4)];
        case "help": { // 부모의 일터에서 곁을 지킨다
          const kind = (JOBS[L.job] && JOBS[L.job].workplace) || "square";
          if (kind === "fields") return [cx + FIELD_BOX.x0 + (n.id * 3 + slotL + 1) % 9, cy + FIELD_BOX.y0 + ((n.id + slotL) % 5)];
          if (ENTER.has(kind)) { const sp = workSpot(w, bdOf(kind), n, slotL + 13); if (sp) return sp; }
          return spotNear(w, placeOf(t, kind), n.id, 2);
        }
        default: break; // work: 아래의 일터 자리
      }
    }
    if (h >= 22.5 || h < 6.5) return houseOf();
    if (!isAdult(n)) return h < 18 ? [cx - 2 + (n.id % 5), cy - 2 + (n.id % 4)] : houseOf();
    if (h >= 18) return hs < 0.25 + (1 - n.traits.greed) * 0.4 ? spotNear(w, placeOf(t, "tavern"), n.id, 3) : houseOf();
    if (h >= 12 && h < 13.5 && hs < 0.6) return spotNear(w, placeOf(t, "square"), n.id, 3);
    if (h >= 15 && hs > 0.7) return spotNear(w, placeOf(t, "square"), n.id, 3);
    const rn = w.ext && w.ext.reno;
    if (rn && rn.builder === n.id && h >= 8 && h < 17) { const hb = MAP.buildings.find((b) => b.town === rn.town && b.kind === "inn"); if (hb && n.town === rn.town) return [hb.x + hb.w, hb.y + hb.h + 1]; }
    const kind = n.job === "guard" && n.id % 2 ? "square" : (JOBS[n.job] && JOBS[n.job].workplace) || "square";
    const slot = Math.floor(h); // 한 시간마다 자리를 바꾼다
    if (kind === "fields") return [cx + FIELD_BOX.x0 + (n.id * 3 + slot) % 9, cy + FIELD_BOX.y0 + ((n.id + slot) % 5)];
    // 일터 건물이 있으면 대개 안에서 일한다 (가끔 문 앞에 나와 있다)
    if (ENTER.has(kind) && h2(n.id, slot + w.day * 24, 19) > 0.22) {
      const b = MAP.buildings.find((q) => q.town === t && q.kind === kind);
      const sp = b && workSpot(w, b, n, slot);
      if (sp) return sp;
    }
    return spotNear(w, placeOf(t, kind), n.id, 2);
  }
  /** 다른 마을에 다니러 온 사람의 자리: 밤엔 여관(보러 온 사람이 있으면 그 집), 낮엔 온 까닭에 따라 */
  function awaySpot(w, n) {
    const a = n.away, t = a.at, h = hour(w), slot = Math.floor(h);
    const bd = (kind) => MAP.buildings.find((q) => q.town === t && q.kind === kind);
    const host = a.host !== undefined ? w.npcs[a.host] : null, hh = host && host.town === t ? houseOfNpc(host) : null;
    const hostHouse = hh && MAP.buildings.find((b) => b.town === hh.town && b.kind === "house" && b.hid === hh.hid);
    if (h >= 21 || h < 7) return (hostHouse && workSpot(w, hostHouse, n, 5)) || workSpot(w, bd("inn"), n, 3) || spotNear(w, placeOf(t, "square"), n.id, 3);
    if (h >= 12 && h < 13.5) return workSpot(w, bd("tavern"), n, slot + 77) || spotNear(w, placeOf(t, "square"), n.id, 3);
    if (a.why === "see" && host) { const k = walkers.get(host.id); if (h >= 17 && hostHouse) return workSpot(w, hostHouse, n, slot + 91) || spotNear(w, placeOf(t, "square"), n.id, 3); if (k && !k.inside && !k.road) return [Math.floor(k.x) + 1, Math.floor(k.y)]; return spotNear(w, placeOf(t, "square"), n.id + host.id, 3); }
    if (a.why === "shop") return workSpot(w, bd("market"), n, slot + 31) || spotNear(w, placeOf(t, "market"), n.id, 2);
    if (a.why === "heal") return workSpot(w, bd("temple"), n, slot + 41) || spotNear(w, placeOf(t, "temple"), n.id, 2);
    return slot % 3 === 0 ? (workSpot(w, bd("tavern"), n, slot + 77) || spotNear(w, placeOf(t, "square"), n.id, 3)) : spotNear(w, placeOf(t, slot % 3 === 1 ? "square" : "market"), n.id + slot, 3);
  }
  /** 건물 안 자리: [문 x, 문 y, 안, 안쪽 x, 안쪽 y, 건물 id]. 가구에 막히지 않고 문간이 아닌 칸 가운데 사람마다·시간마다 다른 곳 */
  function workSpot(w, b, n, slot) {
    if (!b || !b.door) return null;
    const fur = furnitureIn(w, b), [ex, ey] = entryOf(b), free = [];
    for (let ry = 1; ry < b.h; ry++) for (let rx = 0; rx < b.w; rx++) {
      const x = b.x + rx, y = b.y + ry;
      if ((x === ex && y === ey) || fur.some((f) => f.block && f.rx === rx && f.ry === ry)) continue;
      free.push([x, y]);
    }
    if (!free.length) return null;
    const [ix, iy] = free[Math.floor(h2(n.id, slot, 23) * free.length)];
    return [b.door[0], b.door[1], true, ix, iy, b.id];
  }
  function spotNear(w, pl, id, r) {
    for (let k = 0; k < 12; k++) {
      const dx = Math.floor(h2(id, k, 3) * (2 * r + 1)) - r, dy = Math.floor(h2(id, k, 4) * (r + 1));
      if (walkable(w, pl.x + dx, pl.y + dy)) return [pl.x + dx, pl.y + dy];
    }
    return [pl.x, pl.y];
  }
  function updateWalkers(w, dt) {
    if (w.player && w.player.trip) rideTick(w, dt);
    const px = w.ppos ? w.ppos.x : 75, py = w.ppos ? w.ppos.y : 60;
    const seen = new Set();
    for (const n of w.npcs) {
      if (!n.alive || n.controller === "player") continue;
      const spot = scheduleSpot(w, n);
      if (!spot) continue;
      seen.add(n.id);
      let k = walkers.get(n.id);
      const [sx, sy, inside, ix, iy, bid, road] = spot;
      const tx = sx + 0.5, ty = sy + 0.5;
      if (road) { // 길 위: 정해진 자리를 부드럽게 따라간다
        k = walkers.get(n.id);
        if (!k || !k.road || dist(k.x, k.y, sx, sy) > 6) { k = { x: sx, y: sy, town: n.town, war: false, road: true, path: [], goal: null, inside: false, flee: 0, chase: false, say: k ? k.say : null, sayT: k ? k.sayT : 0, dir: "down", hitCd: 0, fight: false }; walkers.set(n.id, k); }
        const ddx = sx - k.x, ddy = sy - k.y;
        if (Math.abs(ddx) + Math.abs(ddy) > 0.01) k.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? "right" : "left") : ddy > 0 ? "down" : "up";
        k.x += ddx * Math.min(1, dt * 3); k.y += ddy * Math.min(1, dt * 3); k.sayT = Math.max(0, k.sayT - dt);
        continue;
      }
      if (!k || k.road || k.town !== A.locOf(n) || k.war !== n.at_war) {
        k = { x: tx, y: ty, town: A.locOf(n), war: n.at_war, path: [], goal: null, inside: !!inside, flee: 0, chase: false, say: null, sayT: 0, dir: "down", hitCd: 0, fight: false };
        walkers.set(n.id, k);
      }
      k.sayT = Math.max(0, k.sayT - dt); k.flee = Math.max(0, k.flee - dt); k.hitCd -= dt;
      const near = dist(k.x, k.y, px, py) < 45;
      const goalKey = sx + "," + sy + (ix !== undefined ? ">" + ix + "," + iy : "");
      // 이미 그 건물 안이면 안에서 걸어 자리를 옮긴다
      if (k.inside && ix !== undefined && k.bd === bid && k.goal !== goalKey) { k.goal = goalKey; k.tix = ix + 0.5; k.tiy = iy + 0.5; }
      if (k.inside && k.tix !== undefined && k.bd === bid) {
        const d = dist(k.x, k.y, k.tix, k.tiy), sp = 1.6 * dt;
        if (d > 0.05) { k.dir = Math.abs(k.tix - k.x) > Math.abs(k.tiy - k.y) ? (k.tix > k.x ? "right" : "left") : k.tiy > k.y ? "down" : "up"; if (d <= sp) { k.x = k.tix; k.y = k.tiy; } else { k.x += (k.tix - k.x) / d * sp; k.y += (k.tiy - k.y) / d * sp; } }
        else if (Math.random() < dt * 0.2) k.dir = ["down", "left", "right", "down"][Math.floor(Math.random() * 4)]; // 일하는 몸짓
        continue;
      }
      if (k.chase || k.fight) {
        const d = dist(k.x, k.y, px, py);
        const p = w.player;
        if (!p || !p.alive || blockedReason(w) || d > 25 || (k.chase && ext(w).wanted.level <= 0)) { k.chase = false; k.fight = false; }
        else {
          const sp = k.chase ? 4.0 : 3.6;
          stepToward(w, k, px, py, sp * dt);
          if (d < 0.8) {
            if (k.chase) arrest(w, n);
            else if (k.hitCd <= 0) { k.hitCd = 1.1; p.health -= 1 + (n.traits.bravery > 0.8 ? 0.5 : 0); G.onHurt && G.onHurt(n.name); if (p.health <= 0) { k.fight = false; faint(w, `${n.name}에게 맞아 쓰러졌다.`); } }
          }
        }
        k.inside = false;
        continue;
      }
      if (k.flee > 0) { const d = Math.max(0.1, dist(k.x, k.y, px, py)); stepToward(w, k, k.x + (k.x - px) / d * 3, k.y + (k.y - py) / d * 3, 4.5 * dt); continue; }
      if (k.seek && w.ppos) {
        stepToward(w, k, px, py, 3.2 * dt);
        if (dist(k.x, k.y, px, py) < 1.3) { const f = k.seek; k.seek = null; f(); }
        continue;
      }
      const enter = () => { k.inside = !!inside; k.bd = bid; k.tix = undefined; if (ix !== undefined) { k.x = ix + 0.5; k.y = iy + 0.5; k.tix = k.x; k.tiy = k.y; } }; // 문에 닿으면 안쪽 자리로
      if (k.goal !== goalKey) {
        k.goal = goalKey; k.inside = false; k.bd = undefined; k.tix = undefined;
        k.path = near ? findPath(w, k.x, k.y, tx, ty, 4000) || [] : [];
        if (!near) { k.x = tx; k.y = ty; enter(); }
      }
      if (k.path.length) {
        const [nx, ny] = k.path[0], d = dist(k.x, k.y, nx, ny), sp = 2.6 * dt;
        k.dir = Math.abs(nx - k.x) > Math.abs(ny - k.y) ? (nx > k.x ? "right" : "left") : ny > k.y ? "down" : "up";
        if (d <= sp) { k.x = nx; k.y = ny; k.path.shift(); if (!k.path.length) enter(); }
        else { k.x += (nx - k.x) / d * sp; k.y += (ny - k.y) / d * sp; }
      } else if (!k.inside && Math.random() < dt * 0.15) {
        const ox = (Math.random() - 0.5) * 1.2, oy = (Math.random() - 0.5) * 1.2;
        if (walkable(w, Math.floor(k.x + ox), Math.floor(k.y + oy)) && dist(k.x + ox, k.y + oy, tx, ty) < 1.8) { k.x += ox * 0.3; k.y += oy * 0.3; }
      }
    }
    for (const id of walkers.keys()) if (!seen.has(id)) walkers.delete(id);
  }
  function stepToward(w, k, tx, ty, sp) {
    const d = dist(k.x, k.y, tx, ty);
    if (d < 0.05) return;
    const nx = k.x + (tx - k.x) / d * Math.min(sp, d), ny = k.y + (ty - k.y) / d * Math.min(sp, d);
    if (walkable(w, Math.floor(nx), Math.floor(k.y)) && crossOK(Math.floor(k.x), Math.floor(k.y), Math.floor(nx), Math.floor(k.y))) k.x = nx;
    if (walkable(w, Math.floor(k.x), Math.floor(ny)) && crossOK(Math.floor(k.x), Math.floor(k.y), Math.floor(k.x), Math.floor(ny))) k.y = ny;
    k.dir = Math.abs(tx - k.x) > Math.abs(ty - k.y) ? (tx > k.x ? "right" : "left") : ty > k.y ? "down" : "up";
  }
  function visibleNPCs(w) {
    const out = [], here = insideBuilding(w); // 플레이어가 들어간 건물 안의 사람은 보인다
    for (const [id, k] of walkers) { if (k.inside && !(here && k.bd === here.id && k.tix !== undefined)) continue; out.push({ n: w.npcs[id], k }); }
    return out;
  }
  function say(id, text, t = 3) { const k = walkers.get(id); if (k) { k.say = text; k.sayT = t; } }

  // ================================================================ 범죄와 수배
  function witnesses(w, x, y, exclude) {
    const out = [];
    for (const [id, k] of walkers) {
      if (k.inside || id === exclude) continue;
      const n = w.npcs[id];
      if (!n.alive || n.at_war) continue;
      if (dist(k.x, k.y, x, y) < 9) out.push(n);
    }
    return out;
  }
  /** 플레이어가 저지른 범죄. 본 사람이 있으면 수배가 붙는다. */
  function crime(w, kind, victim, sev, text) {
    const p = w.player, town = townAt(w.ppos.x, w.ppos.y);
    const wit = witnesses(w, w.ppos.x, w.ppos.y, victim ? victim.id : -1);
    const seen = wit.length > 0 || (victim && victim.alive);
    const ev = w.record(kind, text, { actor: p.id, target: victim ? victim.id : null, town: town || p.town, imp: 3 + sev, sent: victim ? -6 * sev : 0, wr: 0, notify: wit.map((n) => n.id) });
    for (const n of wit) { if (!JOBS[n.job].guard) { const k = walkers.get(n.id); if (k) { k.flee = 4; k.say = "!"; k.sayT = 2; } } }
    if (seen && town) {
      const e = ext(w);
      e.wanted = { town, level: Math.min(3, (e.wanted.town === town ? e.wanted.level : 0) + sev), lastSeen: absMin(w) };
      for (const g of w.residents(town, true)) if (JOBS[g.job].guard && g.controller !== "player" && g.jail === 0) { const k = walkers.get(g.id); if (k) { k.chase = true; k.say = "거기 서라!"; k.sayT = 3; } }
      log(w, `수배되었다 (${"★".repeat(e.wanted.level)}). 경비병이 쫓아온다!`, "warn");
    }
    return ev;
  }
  function decayWanted(w) {
    const e = ext(w);
    if (!e.wanted.level) return;
    const p = w.player;
    const inTown = p && !p.outside && p.town === e.wanted.town;
    const chasers = [...walkers.values()].some((k) => k.chase && w.ppos && dist(k.x, k.y, w.ppos.x, w.ppos.y) < 12);
    if (inTown && chasers) e.wanted.lastSeen = absMin(w);
    if (absMin(w) - e.wanted.lastSeen > 120) { e.wanted.level -= 1; e.wanted.lastSeen = absMin(w); if (e.wanted.level <= 0) { e.wanted.level = 0; log(w, "수배가 풀렸다."); for (const k of walkers.values()) k.chase = false; } }
  }
  function arrest(w, guard) {
    const p = w.player, e = ext(w);
    const lv = Math.max(1, e.wanted.level);
    const fine = Math.min(Math.floor(p.gold), 15 * lv);
    p.gold -= fine; p.jail = lv * 2;
    e.wanted = { town: null, level: 0, lastSeen: 0 };
    for (const k of walkers.values()) { k.chase = false; k.fight = false; }
    w.record("arrest", `${jo(guard.name, "이/가")} 수배 중이던 ${jo(p.name, "을/를")} 붙잡았다`, { actor: guard.id, target: p.id, town: p.town, imp: 4, sent: -4, wr: 0.5 });
    syncPos(w);
    log(w, `${guard.name}에게 붙잡혔다. 벌금 ${fine}닢을 내고 ${p.jail}일 동안 갇힌다.`, "warn");
  }

  // ================================================================ 도구 쓰기
  /** (tx, ty) 타일에 손에 든 것을 쓴다. 결과 문장을 돌려준다. */
  function useAt(w, tx, ty) {
    const p = w.player, e = ext(w);
    const why = blockedReason(w);
    if (why) return why;
    const item = e.hot[e.sel] || "hand";
    face(w, tx, ty);
    const tool = ITEMS[item];
    if (!tool) return null;
    if (item !== "hand" && !tool.tool && !has(w, item)) return `${jo(tool.name, "이/가")} 없다.`;
    const key = fkey(tx, ty), f = e.farm[key], o = objAt(w, tx, ty), i = MAP.I(tx, ty);
    const npcHere = npcAtTile(w, tx, ty);
    const animal = animals.find((a) => dist(a.x, a.y, tx + 0.5, ty + 0.5) < 1.1);
    const out = (t, mins, en) => { if (mins || en) spend(w, mins || 0, en || 0); if (t) log(w, t); return t; };
    if (tool.weapon || (item === "hand" && animal && animal.type !== "chicken" && false)) {
      p.energy = Math.max(0, p.energy - 1.5);
      G.onSwing && G.onSwing();
      if (animal) return out(hitAnimal(w, animal, weaponDmg(w)));
      if (npcHere) return out(attackNPC(w, npcHere, weaponDmg(w)));
      if (o === O.BUSH || o === O.FLOWER) return null;
      return null;
    }
    if (tool.act === "throw") return throwAt(w, tx + 0.5, ty + 0.5, item);
    // 집 안: 가구 놓기·치우기
    const inBd = insideBuilding(w);
    if (inBd && homeBuilding(w) && inBd.id === homeBuilding(w).id && MAP.solid[MAP.I(tx, ty)] === inBd.id) {
      const rx = tx - inBd.x, ry = ty - inBd.y, list = (e.furn = e.furn || {})[furnKey(inBd)] = e.furn[furnKey(inBd)] || [];
      const here = list.findIndex((f) => f.rx === rx && f.ry === ry);
      if (tool.furniture) {
        if (ry < 1 || here >= 0 || furnitureIn(w, inBd).some((f) => f.rx === rx && f.ry === ry) || (tx === entryOf(inBd)[0] && ty === entryOf(inBd)[1])) return "거기엔 놓을 수 없다.";
        take(w, item, 1); list.push({ id: item, rx, ry });
        return out(`${jo(tool.name, "을/를")} 놓았다. 집이 조금 더 내 집 같아졌다.`, 5, 1);
      }
      if (item === "hand" && here >= 0) { const f = list.splice(here, 1)[0]; give(w, f.id, 1); return out(`${jo(ITEMS[f.id].name, "을/를")} 가방에 넣었다.`, 3, 0); }
    }
    if (tool.teaches) return readScroll(w, item);
    if (o === O.RUIN && (item === "hand" || tool.act === "till")) return out(searchRuin(w, tx, ty), 0, 0);
    if (o === O.MOUND) {
      if (tool.act === "till") return out(searchRuin(w, tx, ty), 0, 0);
      if (item === "hand") return "흙이 단단하다. 괭이가 있으면 파 볼 수 있겠다.";
    }
    switch (tool.act || item) {
      case "hand": {
        if (npcHere) { G.onTalk && G.onTalk(npcHere.id); return null; }
        if (f && f.crop && f.crop.dead) { delete f.crop; return out("시든 작물을 뽑아냈다.", 5, 1); }
        if (f && f.crop && f.crop.g >= CROPS[f.crop.type].days) {
          const c = CROPS[f.crop.type], n = w.rng.randint(c.y[0], c.y[1]) + (p.job === "farmer" && w.rng.next() < 0.4 ? 1 : 0);
          give(w, c.item, n, "밭에서 거두기");
          if (c.regrow) f.crop.g = c.days - c.regrow; else delete f.crop;
          return out(`${c.name} ${n}개를 거뒀다.`, 5, 1);
        }
        if (f && f.crop) return `${jo(CROPS[f.crop.type].name, "이/가")} 자라는 중이다 (${f.crop.g}/${CROPS[f.crop.type].days}일).${f.watered === w.day ? "" : " 오늘은 아직 물을 주지 않았다."}`;
        return out(forage(w, tx, ty, o, false));
      }
      case "till": {
        if (f) return "이미 갈아 둔 땅이다.";
        if (!canTill(w, tx, ty)) return "여기는 갈 수 없는 땅이다. 마을 공동 밭이나 내 집 주변 풀밭을 갈 수 있다.";
        e.farm[key] = { watered: -1, crop: null, owner: p.id };
        return out("땅을 갈았다.", 10, 3);
      }
      case "water": {
        if (!f) return MAP.getT(tx, ty) === T.WATER ? "물을 가득 채웠다." : "물을 줄 밭이 없다.";
        if (f.watered === w.day) return "오늘은 이미 물을 줬다.";
        f.watered = w.day;
        return out(f.crop ? `${CROPS[f.crop.type].name}에 물을 줬다.` : "갈아 둔 땅에 물을 뿌렸다.", 3, 1);
      }
      case "chop": {
        if (o === O.OAK || o === O.PINE) {
          const y = tool.yield || 2;
          e.removed[i] = w.day;
          give(w, "wood", y, "나무 베기"); practice(w, "chop");
          if (townAt(tx, ty) && w.rng.next() < 0.3) crime(w, "vandal", null, 1, `${jo(p.name, "이/가")} 마을의 나무를 함부로 베었다`);
          return out(`나무를 베어 나무 ${y}개를 얻었다.`, y >= 3 ? 20 : 35, y >= 3 ? 6 : 9);
        }
        if (o === O.APPLE) return "과일나무는 베지 않는 게 좋겠다.";
        return "벨 것이 없다.";
      }
      case "skill": return jobSkill(w, tx, ty, npcHere, f, o);
      default: {
        if (tool.seed) {
          if (!f) return "먼저 괭이로 땅을 갈아야 한다.";
          if (f.crop) return "이미 무언가 심겨 있다.";
          const c = CROPS[tool.seed];
          if (!c.seasons.includes(w.season)) return `${jo(c.name, "은/는")} ${c.seasons.join("·")}에만 자란다.`;
          take(w, item); f.crop = { type: tool.seed, g: 0, planted: w.day };
          return out(`${jo(c.name, "을/를")} 심었다. 매일 물을 주면 ${c.days}일 뒤에 거둘 수 있다.`, 3, 1);
        }
        if (tool.food || tool.heal) return eat(w, item);
      }
    }
    return null;
  }
  // ================================================================ 던지기
  const projectiles = [];
  /** 돌멩이처럼 던지는 물건. (x, y) 쪽으로 7칸까지 날아가고, 길목의 첫 짐승을 맞힐 수 있다. */
  function throwAt(w, x, y, item) {
    const p = w.player, it = ITEMS[item];
    if (!take(w, item, 1)) return `${jo(it.name, "이/가")} 없다.`;
    const sx = w.ppos.x, sy = w.ppos.y - 0.4, d0 = Math.max(0.1, dist(sx, sy, x, y)), ux = (x - sx) / d0, uy = (y - sy) / d0, R = 7;
    face(w, Math.floor(sx + ux * 2), Math.floor(sy + uy * 2));
    p.energy = Math.max(0, p.energy - 1);
    let hit = null, hd = R;
    for (const a of animals) {
      const t = (a.x - sx) * ux + (a.y - 0.3 - sy) * uy;
      if (t < 0 || t > R) continue;
      const off = Math.abs((a.x - sx) * uy - (a.y - 0.3 - sy) * ux);
      if (off < 0.8 && t < hd) { hd = t; hit = a; }
    }
    const end = hit ? [hit.x, hit.y - 0.3] : [sx + ux * Math.min(R, d0 + 2), sy + uy * Math.min(R, d0 + 2)];
    projectiles.push({ x0: sx, y0: sy, x1: end[0], y1: end[1], t: 0, dur: 0.12 + dist(sx, sy, ...end) * 0.04 });
    if (!hit) return "돌멩이가 허공을 갈랐다.";
    if (w.rng.next() > 0.92 - hd * 0.07) { hit.state = "idle"; return `빗나갔다! ${jo(ANIMAL[hit.type].name, "이/가")} 놀라 달아난다.`; }
    const r = hitAnimal(w, hit, it.dmg || 1, "맞혔다");
    log(w, r);
    return r;
  }
  function updateProjectiles(dt) { for (let i = projectiles.length - 1; i >= 0; i--) { projectiles[i].t += dt; if (projectiles[i].t > projectiles[i].dur + 0.15) projectiles.splice(i, 1); } }

  // ================================================================ 만들기
  /* 제작법은 CONTENT.recipes(content.js)에 있다: { id, out, n, needs: {아이템: 개수}, station, mins, energy, hint, build }
   * station: 없으면 맨손으로 어디서나 / "workbench": 내 집 작업대 앞 / "home": 내 집 앞
   * build: 아이템 대신 설비가 생긴다 (예: "workbench") */
  const STATION_NAME = { workbench: "작업대", home: "내 집" };
  function nearHome(w) { const h = homeBuilding(w); return !!(h && w.ppos && dist(h.door[0] + 0.5, h.door[1] + 0.5, w.ppos.x, w.ppos.y) < 5); }
  function stationReady(w, st) {
    const e = ext(w), p = w.player;
    if (!st) return null;
    if (st === "home") return p.home ? (nearHome(w) ? null : "내 집 앞에서 만들 수 있다") : "집이 있어야 한다";
    if (e.stations && e.stations[st] && e.stations[st] === p.home) return nearHome(w) ? null : `집 앞 ${STATION_NAME[st] || st}에 가야 한다`;
    return st === "workbench" ? "집 앞에 작업대를 세워야 한다" : `${STATION_NAME[st] || st}이(가) 있어야 한다`;
  }
  /** 집 앞에 세운 설비(작업대 등). 누르면 그 설비에서 만들 수 있는 것들이 나온다 */
  function stationPlaces(w) {
    const e = ext(w), p = w.player, h = homeBuilding(w);
    if (!p || !h || !e.stations) return [];
    return Object.entries(e.stations).filter(([, town]) => town === p.home).map(([id], i) => ({ kind: "station", station: id, town: p.home, name: STATION_NAME[id] || id, x: h.x + h.w + i, y: h.y + h.h - 1 }));
  }
  function recipes(w) {
    const p = w.player, e = ext(w);
    return A.CONTENT.recipes.filter((r) => !(r.build && e.stations && e.stations[r.build] === p.home)).map((r) => {
      const lack = Object.entries(r.needs).filter(([id, n]) => !has(w, id, n)).map(([id, n]) => `${ITEMS[id].name} ${n - (e.inv[id] || 0)}`);
      const unknown = r.know && !A.knows(p, r.know) ? r.know : null;
      const where = unknown ? `‘${A.KNOW(unknown).name}’${jo(A.KNOW(unknown).name, "을/를").slice((A.KNOW(unknown).name).length)} 모른다` : stationReady(w, r.station);
      return { r, lack, where, unknown, ok: !lack.length && !where && p.energy >= (r.energy || 0) };
    });
  }
  function craft(w, id) {
    const why = blockedReason(w);
    if (why) return why;
    const c = recipes(w).find((x) => x.r.id === id);
    if (!c) return "만들 수 없다.";
    if (c.where) return c.where;
    if (c.lack.length) return `재료가 모자라다: ${c.lack.join(", ")}`;
    const r = c.r, e = ext(w), p = w.player;
    for (const [it, n] of Object.entries(r.needs)) take(w, it, n);
    let text;
    if (r.build) { e.stations = e.stations || {}; e.stations[r.build] = p.home; text = `집 앞에 ${jo(r.name, "을/를")} 세웠다. 이제 더 많은 것을 만들 수 있다.`; w.record("build", `${jo(p.name, "이/가")} 집 앞에 손수 ${jo(r.name, "을/를")} 세웠다`, { actor: p.id, town: p.town, imp: 2, wr: 0.3 }); }
    else { give(w, r.out, r.n || 1, "만들기", ""); text = (r.n || 1) > 1 ? `${ITEMS[r.out].name} ${r.n}개를 만들었다.` : `${jo(ITEMS[r.out].name, "을/를")} 만들었다.`; }
    spend(w, r.mins || 0, r.energy || 0);
    log(w, text, "good");
    return text;
  }

  // ================================================================ 유적·흙더미·두루마리
  function rollLoot(w, where) {
    const pool = A.CONTENT.loot.filter((l) => !l.where || l.where.includes(where));
    const pick = w.rng.choices(pool, pool.map((l) => l.w));
    if (!pick.id) return { text: pick.text || "아무것도 없었다" };
    const n = pick.n ? w.rng.randint(pick.n[0], pick.n[1]) : 1;
    give(w, pick.id, n, { ruin: "유적 뒤지기", mound: "흙더미 파기", waste: "황무지 유적" }[where] || "유적 뒤지기");
    return { id: pick.id, n, text: n > 1 ? `${ITEMS[pick.id].name} ${n}개를 찾았다!` : `${jo(ITEMS[pick.id].name, "을/를")} 찾았다!` };
  }
  function searchRuin(w, x, y) {
    const e = ext(w), i = MAP.I(x, y), p = w.player, o = objAt(w, x, y);
    e.looted = e.looted || {};
    if (e.looted[i] !== undefined) return o === O.RUIN ? "이미 샅샅이 뒤진 유적이다. 이끼 낀 돌에 알 수 없는 문양만 남아 있다." : "이미 파 본 자리다.";
    e.looted[i] = w.day;
    const where = o === O.MOUND ? "mound" : MAP.getT(x, y) === T.WASTE ? "waste" : "ruin";
    spend(w, o === O.RUIN ? 60 : 30, o === O.RUIN ? 6 : 10);
    const r = rollLoot(w, where);
    if (r.id && ITEMS[r.id].teaches) w.record("find", `${jo(p.name, "이/가")} ${where === "waste" ? "마왕군 땅의 무너진 보고" : where === "mound" ? "흙더미" : "숲속 유적"}에서 ${jo(ITEMS[r.id].name, "을/를")} 찾아냈다`, { actor: p.id, imp: 5, wr: 0 });
    return `${o === O.RUIN ? "무너진 돌기둥 사이를 한 시간 동안 뒤졌다." : "흙더미를 파헤쳤다."} ${r.text}`;
  }
  /** 두루마리를 읽어 지식을 익힌다. 익힌 지식은 다른 사람에게 가르칠 수 있다 */
  function readScroll(w, item) {
    const p = w.player, it = ITEMS[item], k = A.KNOW(it.teaches);
    if (A.knows(p, k.id)) return `이미 아는 내용이다: ${k.name}`;
    take(w, item, 1); A.learn(p, k.id); spend(w, 60, 4);
    w.record("discovery", `${jo(p.name, "이/가")} 두루마리를 읽고 ‘${k.name}’${jo(k.name, "을/를").slice((k.name).length)} 익혔다`, { actor: p.id, town: p.town, imp: k.lost ? 6 : 3, wr: 0.1, data: { skill: k.id, how: "scroll" } });
    const t = `두루마리를 끝까지 읽었다. ‘${k.name}’${jo(k.name, "을/를").slice((k.name).length)} 익혔다! — ${k.desc || ""}`;
    log(w, t, "good");
    return t;
  }

  function eat(w, item) {
    const p = w.player, it = ITEMS[item];
    if (!take(w, item)) return `${jo(it.name, "이/가")} 없다.`;
    if (it.food) p.hunger = Math.max(0, p.hunger - it.food);
    if (it.energy) p.energy = Math.min(100, p.energy + it.energy);
    if (it.heal) p.health = Math.min(10, p.health + it.heal);
    const t = `${jo(it.name, "을/를")} 먹었다.${it.energy ? ` 기력 +${it.energy}` : ""}${it.heal ? ` 체력 +${it.heal}` : ""}`;
    log(w, t); spend(w, 5, 0);
    return t;
  }
  const REGROW = { [O.APPLE]: 4, [O.BUSH]: 3, [O.HERB]: 3, [O.SHROOM]: 3, [O.FLOWER]: 2, [O.OAK]: 2, [O.PINE]: 2, [O.ROCK]: 1 };
  const berryReady = (w, x, y) => { const last = ext(w).picked[MAP.I(x, y)]; return (w.season === "여름" || w.season === "봄") && (last === undefined || w.day - last >= 3); };
  const fiberReady = (w, x, y) => { const last = ext(w).picked["f" + MAP.I(x, y)]; return last === undefined || w.day - last >= 2; };
  /** 맨손으로 풀을 뜯을 수 있는 땅 (마을 밖 풀밭·숲 바닥) */
  const grassy = (w, x, y) => !objAt(w, x, y) && [T.GRASS, T.FLOOR].includes(MAP.getT(x, y)) && !townAt(x, y) && !ext(w).farm[fkey(x, y)];
  function forageReady(w, x, y) {
    const o = objAt(w, x, y), i = MAP.I(x, y), last = ext(w).picked[i];
    if (o === O.BUSH) return berryReady(w, x, y) || fiberReady(w, x, y);
    if (!REGROW[o]) return false;
    if (o === O.APPLE && !["여름", "가을"].includes(w.season)) return false;
    if (o === O.BUSH && w.season !== "여름" && w.season !== "봄") return false;
    if ((o === O.SHROOM || o === O.HERB || o === O.FLOWER) && w.season === "겨울") return false;
    return last === undefined || w.day - last >= REGROW[o];
  }
  function forage(w, x, y, o, double) {
    const i = MAP.I(x, y), e = ext(w);
    if (!o && grassy(w, x, y)) {
      if (!fiberReady(w, x, y)) return "여기 풀은 방금 뜯었다.";
      e.picked["f" + i] = w.day; const k = w.rng.next() < 0.3 ? 2 : 1; give(w, "fiber", k, "풀 뜯기"); spend(w, 5, 1); practice(w, "fiber", k);
      return `질긴 풀을 뜯어 풀섬유 ${k}개를 얻었다.`;
    }
    if (o === O.BUSH) {
      if (berryReady(w, x, y)) { const k = w.rng.randint(2, 3) * (double ? 2 : 1); e.picked[i] = w.day; give(w, "berry", k, "덤불에서 따기"); spend(w, 5, 1); return `산딸기 ${k}개를 땄다.`; }
      if (!fiberReady(w, x, y)) return "덤불이 다시 무성해질 때까지 기다려야 한다.";
      e.picked["f" + i] = w.day; const k = w.rng.randint(1, 2); give(w, "fiber", k, "덤불 줄기 꺾기"); spend(w, 8, 1); practice(w, "fiber", k);
      return `덤불 줄기를 꺾어 풀섬유 ${k}개를 얻었다.`;
    }
    if (o === O.OAK || o === O.PINE) {
      if (!forageReady(w, x, y)) return "주울 만한 가지가 없다. 도끼가 있으면 벨 수 있다.";
      const k = w.rng.randint(1, 3); e.picked[i] = w.day; give(w, "branch", k, "나무 밑에서 줍기"); spend(w, 6, 1);
      return `나무 밑에서 마른 나뭇가지 ${k}개를 주웠다.`;
    }
    if (o === O.ROCK) {
      if (!forageReady(w, x, y)) return "쓸 만한 돌멩이는 다 주웠다.";
      const k = w.rng.randint(1, 2); e.picked[i] = w.day; give(w, "stone", k, "바위 둘레에서 줍기"); spend(w, 6, 2);
      const extra = Object.entries(ITEMS).filter(([, it]) => it.foundAt === "rock" && w.rng.next() < (it.chance || 0.05)).map(([id]) => { give(w, id, 1, "바위 둘레에서 줍기"); return ITEMS[id].name; }); // 팩의 아이템: foundAt·chance
      return `바위 둘레에서 돌멩이 ${k}개를 주웠다.${extra.length ? ` ${extra.join(", ")}도 하나 나왔다!` : ""}`;
    }
    if (!REGROW[o]) return null;
    if (!forageReady(w, x, y)) return o === O.APPLE ? (["여름", "가을"].includes(w.season) ? "아직 열매가 다시 열리지 않았다." : "지금은 사과가 열리는 철이 아니다.") : "아직 거둘 게 없다.";
    const [id, n] = { [O.APPLE]: ["apple", w.rng.randint(2, 4)], [O.HERB]: ["herb", 1], [O.SHROOM]: ["mushroom", 1], [O.FLOWER]: ["flower", 1] }[o];
    const k = n * (double ? 2 : 1);
    ext(w).picked[i] = w.day;
    give(w, id, k, { apple: "사과나무에서 따기", herb: "약초 캐기", mushroom: "버섯 따기", flower: "들꽃 꺾기" }[id]);
    if (id === "herb" || id === "mushroom") practice(w, "herb", k);
    spend(w, 5, 1);
    return `${ITEMS[id].name} ${k}개를 땄다.`;
  }
  function npcAtTile(w, tx, ty) {
    let best = null, bd = 1.2;
    for (const [id, k] of walkers) { if (k.inside) continue; const d = dist(k.x, k.y, tx + 0.5, ty + 0.5); if (d < bd) { bd = d; best = w.npcs[id]; } }
    return best;
  }
  function attackNPC(w, x, dmg) {
    const p = w.player, k = walkers.get(x.id);
    const first = !k || !k.fight;
    x.health -= dmg * 0.7;
    if (k) { k.say = x.health > 0 ? (x.traits.bravery > 0.55 ? "이게 무슨 짓이야!" : "사, 살려줘!") : "…"; k.sayT = 2; }
    if (first) crime(w, "assault", x, 2, `${jo(p.name, "이/가")} ${jo(x.name, "을/를")} 공격했다`);
    if (x.health <= 0) {
      w.die(x, `${p.name}의 칼에 맞아`, { killer: p.id, imp: 8, kind: "murder" });
      const e = ext(w); e.wanted.level = 3; e.wanted.lastSeen = absMin(w);
      return `${jo(x.name, "이/가")} 쓰러져 숨을 거뒀다…`;
    }
    if (k) { if (x.traits.bravery > 0.55 && x.health > 3) k.fight = true; else k.flee = 6; }
    if (root.Story) root.Story.onHitNPC(w, x);
    return `${jo(x.name, "을/를")} 베었다.`;
  }
  function jobSkill(w, tx, ty, npc, f, o) {
    const p = w.player, e = ext(w);
    const out = (t, mins, en) => { spend(w, mins, en); log(w, t); return t; };
    if (p.energy < 5) return "기력이 없다.";
    switch (p.job) {
      case "farmer":
        if (!f || !f.crop) return "작물에 써야 한다.";
        if (f.crop.boost === w.day) return "오늘은 이미 돌봤다.";
        f.crop.boost = w.day; if (f.watered !== w.day) f.watered = w.day;
        return out(`${jo(CROPS[f.crop.type].name, "을/를")} 정성껏 돌봤다. 내일은 두 배로 자랄 것이다.`, 10, 5);
      case "priest":
        if (!npc) { p.health = Math.min(10, p.health + 2); return out("스스로를 위해 기도했다. 체력 +2", 20, 6); }
        npc.health = Math.min(10, npc.health + 4); adjust(npc, p.id, 8); p.fame += npc.health < 6 ? 1 : 0;
        w.record("bless", `${jo(p.name, "이/가")} ${jo(npc.name, "을/를")} 위해 치유의 기도를 올렸다`, { actor: p.id, target: npc.id, town: p.town, imp: 2, sent: 3, wr: 0.3 });
        return out(`${npc.name}의 상처를 어루만져 주었다. 고마워한다.`, 20, 8);
      case "alchemist": {
        if (o === O.HERB || o === O.SHROOM) return out(forage(w, tx, ty, o, true), 0, 4);
        return "약초나 버섯에 써야 한다.";
      }
      case "guard": {
        if (!npc) return "붙잡을 사람에게 써야 한다.";
        const guilty = w.events.slice(-1500).some((ev) => ev && ev.actor === npc.id && ["theft", "caught", "revenge", "murder", "duel", "assault"].includes(ev.kind) && w.day - ev.day < 40);
        if (!guilty) { adjust(npc, p.id, -10); return out(`${jo(npc.name, "은/는")} 죄가 없다며 화를 냈다.`, 5, 3); }
        npc.jail = Math.max(npc.jail, 5); p.fame += 2;
        w.record("report", `경비병 ${jo(p.name, "이/가")} ${jo(npc.name, "을/를")} 체포했다`, { actor: p.id, target: npc.id, town: p.town, imp: 4, sent: -8, wr: 0.5 });
        if (root.Story) root.Story.onArrest(w, npc);
        return out(`${jo(npc.name, "을/를")} 체포했다.`, 20, 8);
      }
      case "adventurer": e.trackUntil = absMin(w) + 180; return out("짐승의 흔적을 읽기 시작했다. 한동안 지도에 짐승이 보인다.", 10, 5);
      case "blacksmith":
        if (npc) { adjust(npc, p.id, 6); p.gold += 4; return out(`${npc.name}의 연장을 손봐 주고 금화 4닢을 받았다.`, 30, 8); }
        e.sharp = true; return out("내 무기를 날카롭게 갈았다.", 30, 6);
      case "baker":
        if (!take(w, "wheat", 2)) return "밀 2개가 필요하다.";
        give(w, "bread", 3, "직접 굽기", ""); return out("고소한 빵 3개를 구웠다.", 40, 6);
      default: {
        const sk = JOBS[p.job] && JOBS[p.job].skill;
        if (sk && sk.use) return sk.use({ w, p, npc, tile: [tx, ty], farm: f, obj: o, inv: e.inv, ITEMS, adjust, has: (id, n) => has(w, id, n), take: (id, n) => take(w, id, n), give: (id, n) => give(w, id, n, SKILL[p.job].name, ""), out });
        p.energy = Math.min(100, p.energy + 8); return out("숨을 고르고 마음을 다잡았다.", 10, 0);
      }
      case "merchant": {
        if (!npc) return "물건을 팔 사람에게 써야 한다.";
        const sellable = Object.keys(e.inv).filter((id) => ITEMS[id].sell && !ITEMS[id].tool);
        if (!sellable.length) return "팔 물건이 없다.";
        let total = 0;
        for (const id of sellable) { const n = e.inv[id], v = Math.round(ITEMS[id].sell * 1.3) * n; if (npc.gold < v) continue; npc.gold -= v; total += v; take(w, id, n); }
        if (!total) return `${jo(npc.name, "은/는")} 돈이 없다고 했다.`;
        p.gold += total; adjust(npc, p.id, 2);
        return out(`${npc.name}에게 물건을 팔아 금화 ${total}닢을 벌었다.`, 20, 4);
      }
    }
    return null;
  }

  // ================================================================ 직업의 일: 처리 등록표
  /* 일(works)의 sim 이름 → 처리 함수 (w, work, {town, pl}) → 결과 문장. 새 처리는 Game.registerSim(id, fn)으로 더한다.
   * 화면이 따로 필요한 일(미니게임 등)도 여기 등록하고, 함수 안에서 창을 열면 된다. */
  const SIMS = {
    shift(w, wk, { town }) {
      const p = w.player, g0 = p.gold, f0 = town.food;
      rWork(p, w);
      return `열심히 일해 금화 ${(p.gold - g0).toFixed(1)}닢을 벌었다.${town.food > f0 + 0.5 ? ` 곳간에 식량 ${jo(String(Math.round(town.food - f0)), "을/를")} 보탰다.` : ""}`;
    },
    make(w, wk, { town }) { return finishWork(w, null, wk, null, "plain", town).text; },
    // 단계가 있는 업무: 화면에서 조작한다. 여기서는 시작만 알리고, 끝나면 finishWork가 결과를 낸다
    steps: () => null,
  };
  function registerSim(id, fn) { SIMS[id] = fn; }
  /* 조작 부품의 손(플레이어 조작 화면). sims.js가 Sims.register로 채운다. 엔진의 자동 모델(A.TOOL_AUTO)과 둘 다 있어야 쓸 수 있다 */
  const HANDS = {};
  function registerHand(id, impl) { HANDS[id] = impl; }
  const toolReady = (t) => !!(HANDS[t] && A.TOOL_AUTO[t]);
  const workReady = (wk) => !!SIMS[wk.sim] && (!wk.steps || A.toolsOf(wk).every(toolReady));
  /** 플레이어가 이 직업을 가질 수 있는가: 준비된 업무가 하나는 있어야 한다 */
  const jobReady = (j) => A.worksOf(j.id).some(workReady);
  /** 업무를 마친다. scores: 단계별 점수(직접 조작) 또는 null(맡기기 → 자동, 조금 서툴다). grade를 직접 주면 단계 없이 그 품질로 */
  function finishWork(w, pl, wk, scores, grade, townArg) {
    const p = w.player, town = townArg || w.towns[pl.town];
    if (typeof wk === "string") wk = [...A.worksOf(p.job), ...(p.side ? A.worksOf(p.side) : [])].find((x) => x.id === wk);
    if (!wk) return { text: "할 수 없는 일이다" };
    const lack = Object.entries(wk.needs || {}).filter(([id, n]) => !has(w, id, n));
    if (lack.length) return { text: "재료가 모자라다" };
    const auto = !scores && !grade;
    if (auto) scores = A.autoScores(p, wk, w.rng, 0.12);
    const q = grade ? A.GRADES.find((g) => g.id === grade).at + 0.05 : A.workQuality(wk, scores), g = A.gradeOf(q);
    const client = wk.client ? A.workClient(w, p, wk) : null;
    if (wk.client && !client) return { text: "손님이 없다" };
    for (const [id, n] of Object.entries(wk.needs || {})) take(w, id, n);
    const got = [];
    for (const [id, n] of Object.entries(wk.gives || {})) { const k = Math.max(1, Math.round(n * g.mult)); give(w, id, k, wk.name, town.name); got.push(`${ITEMS[id].name} ${k}개`); }
    const fx = wk.effects ? A.applyEffects(w, p, wk, q, client) : [];
    if (wk.skill) A.addXp(p, wk.skill, 2 + Math.round(q * 4));
    ext(w).works = ext(w).works || {}; const rec = ext(w).works[wk.id] || (ext(w).works[wk.id] = { n: 0, best: 0 }); rec.n++; rec.best = Math.max(rec.best, Math.round(q * 100) / 100);
    if (g.id === "master") {
      p.fame += 1;
      w.record("masterwork", `${jo(p.name, "이/가")} ${wk.name}에서 걸작을 내놓았다`, { actor: p.id, town: town.id, imp: 3, wr: 0.2, data: { work: wk.id, q: Math.round(q * 100) / 100 } });
    }
    const text = `${wk.name}${auto ? "(손에 익은 대로)" : ""}: ${g.name} 솜씨${client ? `, 손님 ${client.name}` : ""}. ${got.length ? `${got.join(", ")}를 만들었다.` : ""}${fx.length ? ` ${fx.join(", ")}.` : got.length ? "" : "일을 마쳤다."}`.replace(/\s+/g, " ").trim();
    if (pl) return finish(w, text, wk.mins, wk.energy);
    return { text, q, grade: g };
  }

  // ================================================================ 직업 만들기 (플레이어가 직업·업무를 짠다)
  /* 초안(draft)은 데이터만 담는다. 검사(checkJobDraft)를 통과하고 한 번 시험해 본 뒤 등록(createJob)하면 w.defs에 저장된다.
   * 균형: 만드는 일은 결과물의 값 ≤ 재료 값 + 품삯(시간). 봉사하는 일의 금화는 시간에 비례한다. */
  const JOBMAKE = {
    cost: 20, maxSteps: 5,
    places: [["market", "시장"], ["forge", "대장간"], ["temple", "신전"], ["guild", "길드"], ["inn", "여관"], ["tavern", "주점"], ["fields", "밭"]],
    hats: [["", "없음"], ["straw", "밀짚모자"], ["chef", "요리 모자"], ["cap", "챙 모자"], ["bandana", "두건"], ["hood", "후드"], ["witch", "고깔모자"], ["helmet", "투구"], ["circlet", "화관"]],
    props: [["", "없음"], ["hammer", "망치"], ["staff", "지팡이"], ["sword", "검"], ["basket", "바구니"], ["book", "책"]],
    colors: ["#c8603a", "#d8b84a", "#6a9a4a", "#4a9a8a", "#5a7ad8", "#9a7ad8", "#d89ab8", "#e4e6e8", "#8a6a5a"],
    mins: [30, 60, 90, 120, 180, 240],
    levels: [["쉬움", -0.04], ["보통", 0], ["어려움", 0.08]],
    serve: { // 봉사하는 일의 결과 꼴: 손님 조건과 결과
      pay: { name: "품삯을 받는 일", client: "any", fx: (m) => ({ gold: [0.5, Math.round(m / 30 * 10) / 10], rel: 3 }) },
      heal: { name: "아픈 사람 돌보기", client: "sick", fx: (m) => ({ heal: 3, gold: [0.5, Math.round(m / 50 * 10) / 10], rel: 6 }) },
      bond: { name: "다른 사람들과 잇기", client: "foreign", fx: (m) => ({ bond: 3, gold: [0.5, Math.round(m / 50 * 10) / 10], rel: 4 }) },
      cheer: { name: "마음을 돌보기", client: "any", fx: (m) => ({ rel: 8, gold: [0, Math.round(m / 60 * 10) / 10] }) },
    },
  };
  const itemValue = (bag) => Object.entries(bag || {}).reduce((s, [id, n]) => s + ((ITEMS[id] && (ITEMS[id].sell || (ITEMS[id].price || 3) / 3)) || 1) * n, 0);
  /* 일의 정체: 무엇을 내놓는가. 만드는 일은 결과물, 봉사하는 일은 손님과 결과의 종류.
   * 새 직업은 이 세계에 처음 나오는 일일 때만 만들 수 있다 (이미 누가 하는 일이면 그 직업이 있는 것) */
  const fxKind = (fx) => (!fx ? "" : fx.heal >= 2 ? "heal" : fx.bond ? "bond" : fx.rel >= 8 && !(fx.gold && fx.gold[1] > 2) ? "cheer" : "pay");
  function workSig(wk) {
    if (wk.gives && Object.keys(wk.gives).length) return "make:" + Object.keys(wk.gives).sort().join("+");
    if (wk.effects) { const c = wk.client || "any"; return "serve:" + fxKind(wk.effects) + ":" + (c.startsWith("race:") ? "foreign" : c); }
    return "";
  }
  /** 이 업무와 같은 일을 이미 하는 직업 (없으면 null) */
  function sameWork(w, wk) {
    const sig = workSig(wk);
    if (!sig) return null;
    const x = A.CONTENT.works.find((o) => o.job !== wk.job && JOBS[o.job] && w.jobOpen(o.job) && workSig(o) === sig);
    return x ? { job: JOBS[x.job], work: x } : null;
  }
  function jobDraft(w, addTo) {
    const p = w.player, sk = A.knownSkills(p)[0] || null, J = addTo ? JOBS[addTo] : null;
    return { addTo: addTo || null, name: J ? J.name : "", skill: J ? J.teaches[0] : sk, place: J ? J.workplace : "market", hat: J ? (J.look || {}).hat || "" : "cap", prop: J ? (J.look || {}).prop || "" : "", color: J ? J.color : JOBMAKE.colors[0],
      work: { name: "", mins: 120, kind: "make", needs: {}, gives: {}, serve: "pay", client: "", steps: [{ name: "", tool: "gauge", level: 1 }] }, tried: false };
  }
  /** 초안 검사: 고쳐야 할 것들의 목록 (비면 등록할 수 있다) */
  function checkJobDraft(w, d) {
    const p = w.player, err = [], wd = d.work;
    if (!d.addTo) {
      const nm = (d.name || "").trim();
      if (nm.length < 2 || nm.length > 10) err.push("직업 이름은 2~10자");
      else if (A.CONTENT.jobs.some((j) => j.name === nm)) err.push("이미 있는 직업 이름이다");
      if (!d.skill || !A.knows(p, d.skill)) err.push("바탕 기술은 내가 아는 것이어야 한다");
      if (p.gold < JOBMAKE.cost) err.push(`등록하려면 금화 ${JOBMAKE.cost}닢이 필요하다`);
    } else if (!JOBS[d.addTo] || JOBS[d.addTo].creator !== p.id) err.push("내가 만든 직업에만 업무를 더할 수 있다");
    const wn = (wd.name || "").trim();
    if (wn.length < 2 || wn.length > 12) err.push("업무 이름은 2~12자");
    if (!wd.steps.length || wd.steps.length > JOBMAKE.maxSteps) err.push(`단계는 1~${JOBMAKE.maxSteps}개`);
    if (wd.steps.some((s) => !toolReady(s.tool))) err.push("쓸 수 없는 조작 부품이 있다");
    if (wd.kind === "make") {
      const nv = itemValue(wd.needs), gv = itemValue(wd.gives), labor = wd.mins / 30;
      if (!Object.keys(wd.gives).length) err.push("만들어 낼 물건을 고른다");
      if (!Object.keys(wd.needs).length) err.push("재료를 하나는 고른다");
      if (gv > nv + labor) err.push(`결과물 값(${Math.round(gv)})이 재료 값(${Math.round(nv)})과 품삯(${Math.round(labor)})을 넘는다`);
      if (Object.keys(wd.gives).some((id) => wd.needs[id])) err.push("재료와 결과물이 같으면 안 된다");
    }
    if (!d.addTo) { // 새 직업은 처음 나오는 일이어야 한다
      const same = sameWork(w, draftWork(d, "draft", "draft"));
      if (same) err.push(`이미 ‘${same.job.name}’${jo(same.job.name, "이/가").slice(same.job.name.length)} 하는 일이다 (${same.work.name}). 처음 나오는 일이어야 새 직업이 된다`);
    }
    return err;
  }
  /** 초안 → 업무 정의 (시험할 때도 쓴다) */
  function draftWork(d, jobId, id) {
    const wd = d.work, S = JOBMAKE.serve[wd.serve] || JOBMAKE.serve.pay;
    const steps = wd.steps.map((s) => ({ name: (s.name || "").trim() || (HANDS[s.tool] || {}).name || s.tool, tool: s.tool, p: { level: s.level, hard: JOBMAKE.levels[s.level][1] } }));
    const wk = { id, job: jobId, name: wd.name.trim(), mins: wd.mins, energy: Math.round(wd.mins / 12), skill: d.skill, steps, hint: "" };
    if (wd.kind === "make") { wk.needs = { ...wd.needs }; wk.gives = { ...wd.gives }; }
    else { wk.client = wd.client || S.client; wk.effects = S.fx(wd.mins); }
    wk.place = d.place;
    return wk;
  }
  /** 등록: 새 직업(또는 내 직업의 새 업무)을 이 세계에 남긴다 */
  function createJob(w, d) {
    const p = w.player, err = checkJobDraft(w, d);
    if (err.length) return { ok: false, text: err[0], errors: err };
    w.defs = w.defs || { jobs: [], works: [] };
    if (d.addTo) {
      const J = JOBS[d.addTo], wk = draftWork(d, J.id, `${J.id}_w${A.CONTENT.works.filter((x) => x.job === J.id).length + 1}`);
      wk.place = J.workplace; w.defs.works.push(wk); A.applyDefs(w);
      return { ok: true, text: `${J.name}의 새 업무 ‘${wk.name}’를 짰다.`, work: wk };
    }
    const id = `p${w.defs.jobs.length + 1}_${w.day}`, nm = d.name.trim();
    const job = { id, name: nm, income: [1.5, 4.5], entry_cost: JOBMAKE.cost, weight: 0, shift: false, teaches: [d.skill], needKnow: d.skill,
      color: d.color, workplace: d.place, look: { ...(d.hat ? { hat: d.hat } : {}), ...(d.prop ? { prop: d.prop } : {}) }, born: w.day, creator: p.id, from: d.skill };
    const wk = draftWork(d, id, id + "_w1");
    w.defs.jobs.push(job); w.defs.works.push(wk); A.applyDefs(w);
    p.gold -= JOBMAKE.cost;
    const old = JOBS[p.job] ? JOBS[p.job].name : "", from = p.job;
    A.setJob(p, id); p.pioneer = id; p.fame += 3;
    const K = A.KNOW(d.skill);
    w.record("job_born", `${K.name}${jo(K.name, "을/를").slice(K.name.length)} 익힌 ${jo(p.name, "이/가")} 이 세계에 없던 일, ‘${nm}’${jo(nm, "을/를").slice(nm.length)} 스스로 만들었다`, { actor: p.id, town: p.town, imp: 7, wr: 0.8, data: { job: id, from, skill: d.skill, made: true } });
    return { ok: true, text: `이제 나는 이 세계 최초의 ${nm}다.${old ? ` (${old} 일을 그만두었다)` : ""}`, job, work: wk };
  }

  // ================================================================ 건물 안에서
  function seedsOnSale(w) { return Object.entries(CROPS).filter(([, c]) => c.seasons.includes(w.season)).map(([k]) => SEED_OF[k]); }
  /** 파는 값: 그 마을 재고가 넘치면 덜 쳐준다 (상인은 흥정을 잘한다) */
  function sellPrice(w, id) { const p = w.player, t = w.towns[p.town]; return Math.max(1, Math.round(A.stockSellPrice(w, t, id) * (p.job === "merchant" ? 1.3 : 1))); }
  /** 재고로 파는 물건(마을에서 만드는 것)은 재고에 따라, 그 밖(씨앗·만들지 않는 연장)은 정해진 값 */
  const STOCKED = (id) => !id.startsWith("seed") && !["can", "dagger", "sword", "potion"].includes(id);
  const buyPrice = (w, t, id) => (STOCKED(id) ? A.stockPrice(w, t, id) : ITEMS[id].price);
  /** 건물의 메뉴. {id, label, hint, ok, why, min, e, arg} */
  function buildingMenu(w, pl) {
    const p = w.player, e = ext(w), v = [];
    const add = (o) => { if (o.ok === undefined) o.ok = true; if (o.e > 0 && p.energy < o.e) { o.ok = false; o.why = "기력이 없다"; } v.push(o); };
    if (pl.kind === "station") {
      for (const c of recipes(w).filter((c) => c.r.station === pl.station && !c.unknown)) {
        const r = c.r, it = ITEMS[r.out];
        add({ id: "craft:" + r.id, label: `${it.name} 만들기`, min: r.mins, e: r.energy || 0, hint: `${Object.entries(r.needs).map(([id, n]) => `${ITEMS[id].name} ${Math.min(e.inv[id] || 0, n)}/${n}`).join(" · ")}`, ok: c.ok, why: c.lack.length ? `모자라다: ${c.lack.join(", ")}` : c.where || "" });
      }
      return v;
    }
    const myWorks = [...A.worksOf(p.job), ...(p.side && p.side !== p.job ? A.worksOf(p.side).filter((x) => x.steps) : [])];
    for (const wk of myWorks.filter((x) => x.place === pl.kind)) {
      const lack = Object.entries(wk.needs || {}).filter(([id, n]) => !has(w, id, n)).map(([id, n]) => `${ITEMS[id].name} ${n - (e.inv[id] || 0)}`);
      const client = wk.client ? A.workClient(w, p, wk) : null;
      add({ id: "wk:" + wk.id, label: wk.steps ? `${wk.name} · ${wk.steps.length}단계` : wk.name, min: wk.mins, e: wk.energy, hint: [wk.hint, client ? `손님 ${client.name}` : "", wk.needs ? `재료 ${Object.entries(wk.needs).map(([id, n]) => `${ITEMS[id].name} ${n}`).join(", ")}` : ""].filter(Boolean).join(" · "),
        ok: workReady(wk) && !lack.length && (!wk.client || !!client), why: lack.length ? `재료가 모자라다: ${lack.join(", ")}` : wk.client && !client ? "지금 이 마을엔 이 일을 맡길 손님이 없다" : "아직 할 수 없는 일이다", work: wk, client });
    }
    const jobsHere = A.CONTENT.jobs.filter((j) => (j.workplace || "square") === pl.kind && w.jobOpen(j.id) && jobReady(j)).map((j) => j.id);
    // 부업: 이 일터의 직업 기술을 안다면, 지금 직업은 그대로 두고 그 일도 맡는다
    for (const j of jobsHere) if (j !== p.job && j !== p.side && (JOBS[j].teaches || []).some((k) => A.knows(p, k)) && A.worksOf(j).some((x) => x.steps && workReady(x)))
      add({ id: "side:" + j, label: `${JOBS[j].name} 일을 부업으로 삼기`, min: 0, e: 0, hint: `${JOBS[p.job].name} 일은 그대로 하면서 ${JOBS[j].name}의 업무도 맡는다` });
    for (const j of jobsHere) if (j !== p.job) {
      const c = JOBS[j].entry_cost, nk = JOBS[j].needKnow, known = !nk || A.knows(p, nk);
      add({ id: "job:" + j, label: `${JOBS[j].name}${c ? ` 되기 (금화 ${c})` : " 되기"}`, min: 60, e: 5, hint: "직업을 바꾼다", ok: p.gold >= c && known, why: !known ? `‘${A.KNOW(nk).name}’${jo(A.KNOW(nk).name, "을/를").slice((A.KNOW(nk).name).length)} 알아야 한다` : `금화 ${c}닢이 필요하다` });
    }
    // 아직 이 세계에 없는 직업: 필요한 지식을 안다면 내가 처음 시작할 수 있다
    for (const j of A.CONTENT.jobs) if (j.emerge && !w.jobOpen(j.id) && (j.workplace || "square") === pl.kind && j.needKnow && A.knows(p, j.needKnow))
      add({ id: "pioneer:" + j.id, label: `이 세계 최초의 ${jo(j.name, "이/가")} 되기`, min: 60, e: 5, hint: `‘${A.KNOW(j.needKnow).name}’${jo(A.KNOW(j.needKnow).name, "을/를").slice((A.KNOW(j.needKnow).name).length)} 아는 내가 처음으로 이 일을 시작한다` });
    if (pl.kind === "house") {
      const bd = MAP.buildings[pl.b], ms = (e.missions || []).filter((m) => !m.done && m.type === "build" && m.town === pl.town && m.hid === bd.hid);
      for (const m of ms) {
        const lack = !m.started ? Object.entries(m.needs).filter(([id, n]) => !has(w, id, n)).map(([id, n]) => `${ITEMS[id].name} ${n - (e.inv[id] || 0)}`) : [];
        add({ id: "build:" + m.id, label: `${w.npcs[m.from].name}의 집 공사하기 (2시간)`, min: 0, e: 15, hint: `${m.desc} · ${m.got}/${m.work}시간${!m.started ? ` · 재료 ${Object.entries(m.needs).map(([id, n]) => `${ITEMS[id].name} ${n}`).join(", ")}` : ""}`, ok: !lack.length, why: `재료가 모자라다: ${lack.join(", ")}` });
      }
      const inv = inviteAt(w, bd), inside = insideBuilding(w) === bd;
      if (inv && inside) {
        const host = w.npcs[inv.to];
        add({ id: "visit:tea", label: `${jo(host.name, "과/와")} 차 마시기 (1시간)`, min: 60, e: -5, hint: "더 가까워진다. 속 이야기를 들을지도 모른다" });
        if (hour(w) >= 17) add({ id: "visit:meal", label: "저녁 대접받기 (1시간)", min: 60, e: 0, hint: "배를 채우고 기력 +25", ok: !inv.ate, why: "이미 배불리 먹었다" });
        add({ id: "visit:look", label: "집 구경하기 (10분)", min: 10, e: 0, hint: "집을 칭찬한다", ok: !inv.looked, why: "이미 구경했다" });
        if (hour(w) >= 20.5 && (host.lover === p.id || host.spouse === p.id || A.opinion(host, p.id) >= 70)) add({ id: "visit:stay", label: "하룻밤 묵어가기", min: 0, e: 0, hint: "이 집에서 자고 간다" });
      } else if (inv && !inside) add({ id: "locked", label: `${w.npcs[inv.to].name}의 집 (초대받음)`, ok: false, why: "문으로 걸어 들어가면 된다" });
      const bi = breakinAt(w, bd);
      if (bi && inside) { add({ id: "steal:rummage", label: "서랍 뒤지기 (20분)", min: 0, e: 0, hint: sleepersIn(w, bd).length ? "자는 사람이 깰 수도 있다" : "아무도 없다", ok: !bi.looted, why: "이미 다 뒤졌다" }); add({ id: "steal:leave", label: "조용히 빠져나가기", min: 0, e: 0, hint: "" }); }
      if (!inv && !bi && !inside) add({ id: "steal:breakin", label: "몰래 들어가기 (10분)", min: 0, e: 3, hint: isNight(w) ? "밤이라 거리엔 사람이 적다. 들키면 수배된다" : "대낮이다. 지나가는 사람이 볼 수 있다" });
      if (!ms.length && !inv && !bi) add({ id: "locked", label: "남의 집이다", ok: false, why: p.job === "builder" ? "집주인에게 ‘고칠 데 없어요?’라고 물어 일을 받아 보자" : "문이 잠겨 있다" });
    }
    if (pl.kind === "market") {
      const tw = w.towns[pl.town], st = tw.stock || {};
      for (const id of Object.keys(st).filter((id) => ITEMS[id] && !["hoe", "axe"].includes(id) && st[id] > 0).sort((a, b) => st[b] - st[a]).slice(0, 6)) {
        const pr = buyPrice(w, tw, id); add({ id: "buy:" + id, label: `${ITEMS[id].name} 사기 (금화 ${pr})`, min: 0, e: 0, hint: `이 마을 재고 ${st[id]}개`, ok: p.gold >= pr, why: "금화가 모자라다" });
      }
      if (!(st.bread > 0)) add({ id: "soldout:bread", label: "빵 (품절)", ok: false, why: "빵집에서 아직 굽지 않았다" });
      for (const id of seedsOnSale(w)) add({ id: "buy:" + id, label: `${ITEMS[id].name} 사기 (금화 ${ITEMS[id].price})`, min: 0, e: 0, hint: id.startsWith("seed") ? `${CROPS[ITEMS[id].seed].days}일이면 자란다` : "기력을 채워 준다", ok: p.gold >= ITEMS[id].price, why: "금화가 모자라다" });
      const sell = Object.keys(e.inv).filter((id) => ITEMS[id].sell && !ITEMS[id].tool);
      for (const id of sell) add({ id: "sell:" + id, label: `${ITEMS[id].name} 팔기 ×${e.inv[id]} (개당 ${sellPrice(w, id)})`, min: 0, e: 0, hint: "전부 판다" });
    }
    if (pl.kind === "forge") {
      const tw = w.towns[pl.town], st = tw.stock || {};
      for (const id of ["hoe", "can", "axe", "dagger", "sword"]) if (!e.inv[id]) {
        if (STOCKED(id) && !(st[id] > 0)) { add({ id: "soldout:" + id, label: `${ITEMS[id].name} (품절)`, ok: false, why: "대장간에 남은 게 없다. 대장장이가 벼려야 한다" }); continue; }
        add({ id: "buy:" + id, label: `${ITEMS[id].name} 사기 (금화 ${buyPrice(w, tw, id)})`, min: 0, e: 0, hint: ITEMS[id].hint + (STOCKED(id) ? ` · 재고 ${st[id]}개` : ""), ok: p.gold >= buyPrice(w, tw, id), why: "금화가 모자라다" });
      }
      if (!e.sharp) add({ id: "sharpen", label: "무기 벼리기 (금화 10)", min: 30, e: 0, hint: "무기가 더 아프게 벤다", ok: p.gold >= 10, why: "금화가 모자라다" });
    }
    if (pl.kind === "tavern") {
      add({ id: "meal", label: "따뜻한 식사 (금화 6)", min: 40, e: 0, hint: "배를 채우고 기력 +30", ok: p.gold >= 6 });
      add({ id: "cook", label: "고기 스튜 만들어 달라기 (고기 2, 금화 2)", min: 30, e: 0, hint: "든든한 스튜를 얻는다", ok: has(w, "meat", 2) && p.gold >= 2, why: "고기 2개와 금화 2닢이 필요하다" });
      add({ id: "drink", label: "술 한 잔 (금화 2)", min: 60, e: 2, hint: "옆자리 사람에게 소문을 듣는다", ok: p.gold >= 2 });
      add({ id: "treat", label: "모두에게 한턱 (금화 15)", min: 60, e: 4, hint: "마을 사람들과 가까워지고 이름이 알려진다", ok: p.gold >= 15 });
      add({ id: "story", label: "내가 아는 이야기 들려주기", min: 60, e: 4, hint: "소문을 퍼뜨린다" });
    }
    if (pl.kind === "temple") {
      add({ id: "heal", label: "치료받기 (금화 4)", min: 30, e: 0, hint: "체력을 되찾는다", ok: p.gold >= 4 && p.health < 10 });
      add({ id: "buy:potion", label: "치유 물약 사기 (금화 15)", min: 0, e: 0, hint: "언제든 마시면 체력 +5", ok: p.gold >= 15 });
      if (p.job === "alchemist") add({ id: "brew", label: "물약 빚기 (약초 3)", min: 60, e: 8, hint: "치유 물약 2개", ok: has(w, "herb", 3), why: "약초 3개가 필요하다" });
      add({ id: "pray", label: "기도하기", min: 30, e: -5, hint: "마음이 차분해진다" });
    }
    if (pl.kind === "guild") {
      add({ id: "board", label: "의뢰 게시판 보기", min: 0, e: 0, hint: "사냥·채집·현상금 의뢰" });
      add({ id: "report", label: "범죄 신고하기", min: 30, e: 2, hint: "내가 아는 범죄를 고발한다" });
      const mine = JOBS[p.job] && JOBS[p.job].creator === p.id;
      add({ id: "jobmake", label: mine ? "내 직업에 업무 더하기" : "새 직업 만들기", min: 0, e: 0, hint: mine ? `${JOBS[p.job].name}의 일을 하나 더 짠다` : "아는 기술로 이 세계에 없던 일을 만든다", ok: A.knownSkills(p).length > 0, why: "바탕이 될 기술을 하나는 알아야 한다" });
      if (e.wanted.level > 0 && e.wanted.town === pl.town) add({ id: "surrender", label: `자수하기 (벌금 ${15 * e.wanted.level})`, min: 30, e: 0, hint: "감옥에 가지 않고 수배를 푼다", ok: p.gold >= 15 * e.wanted.level, why: "벌금이 모자라다" });
      if (w.war.active) add({ id: "enlist", label: "전쟁에 참전하기", min: 0, e: 0, hint: "몇 계절 동안 전선에서 싸운다" });
    }
    if (pl.kind === "inn") {
      if (p.home === pl.town && e.reno) add({ id: "reno_info", label: `공사 중 (${Math.max(0, e.reno.until - w.day)}일 남음)`, ok: false, why: `${jo(w.npcs[e.reno.builder].name, "이/가")} ‘${e.reno.name || "집"}’ 공사를 하고 있다` });
      if (p.home === pl.town && !e.reno) add({ id: "reno_hint", label: "집 고치기", ok: false, why: w.alive().some((n) => n.job === "builder") ? "목수를 찾아가 ‘집을 고치고 싶어요’라고 말하자" : "이 세계엔 아직 목수가 없다" });
      if (p.home === pl.town) add({ id: "craft", label: "만들기", min: 0, e: 0, hint: e.stations && e.stations.workbench === p.home ? "작업대에서 도구와 물건을 만든다" : "맨손으로 만들거나, 작업대를 세운다" });
      if (p.home === pl.town) add({ id: "sleep:home", label: "잠자기", min: 0, e: 0, hint: "다음 날 아침까지. 일찍 잘수록 개운하다" }, { id: "rest", label: "쉬기 (1시간)", min: 60, e: -12, hint: "기력을 조금 되찾는다" }, { id: "family", label: "가족과 시간 보내기 (1시간)", min: 60, e: 0, hint: "같은 마을에 있는 가족과 가까워진다" });
      else add({ id: "sleep:inn", label: "여관에서 묵기 (금화 3)", min: 0, e: 0, hint: "다음 날 아침까지", ok: p.gold >= 3 }, { id: "settle", label: "이 마을에 방 얻기", min: 60, e: 5, hint: "이곳이 내 집이 된다" });
    }
    if (pl.kind === "camp" && w.war.active) add({ id: "enlist", label: "전쟁에 참전하기", min: 0, e: 0, hint: "전선에서 싸운다" });
    return v;
  }
  function doBuilding(w, pl, id, arg) {
    const p = w.player, e = ext(w);
    const why = blockedReason(w);
    if (why) return { text: why };
    if (id.startsWith("sleep:")) { sleep(w, id.slice(6)); return { text: null, slept: true }; }
    if (id === "work") { const m = buildingMenu(w, pl).find((a) => a.work && a.work.sim === "shift"); if (m) id = m.id; } // 예전 이름 (자동 진행)
    const def = buildingMenu(w, pl).find((a) => a.id === id);
    if (id.startsWith("craft:") && def && def.ok) return { text: craft(w, id.slice(6)) };
    if (id.startsWith("build:") && def && def.ok) return { text: doBuildWork(w, +id.slice(6)) };
    if (id.startsWith("steal:") && def && def.ok) {
      const bd = MAP.buildings[pl.b], what = id.slice(6);
      if (what === "breakin") return { text: breakIn(w, bd) };
      if (what === "rummage") return { text: rummage(w, bd) };
      if (what === "leave") { e.breakin = null; w.ppos = { x: bd.door[0] + 0.5, y: bd.door[1] + 0.6 }; const t = wakeCheck(w, bd, 0.1); return { text: t || "아무도 모르게 빠져나왔다." }; }
    }
    if (id.startsWith("visit:") && def && def.ok) {
      const bd = MAP.buildings[pl.b], inv = inviteAt(w, bd), host = inv && w.npcs[inv.to];
      if (!host) return { text: "초대가 끝났다." };
      const what = id.slice(6);
      if (what === "stay") {
        adjust(host, p.id, 8); adjust(p, host.id, 6); inv.done = true;
        w.record("visit", `${jo(p.name, "이/가")} ${host.name}의 집에서 하룻밤을 묵었다`, { actor: p.id, target: host.id, town: bd.town, imp: 3, sent: 2, wr: 0.25 });
        sleep(w, "guest", host.name); return { text: null, slept: true };
      }
      let text = "";
      if (what === "tea") {
        adjust(host, p.id, 6); adjust(p, host.id, 4);
        const news = host.mem.filter((m) => !p.known.has(m.e) && w.events[m.e] && w.events[m.e].imp >= 2);
        if (host.dream && w.rng.next() < 0.5) { e.dreams = e.dreams || {}; e.dreams[host.id] = host.dream.id + "@" + host.dream.since; text = `따뜻한 차를 마시며 ${jo(host.name, "이/가")} 털어놓았다. "사실 나는… ‘${A.dreamName(host)}’, 그게 꿈이에요."`; }
        else if (news.length) { const ev = w.events[maxBy(news, (m) => w.events[m.e].imp * m.s).e]; w.remember(p, ev, false, host.id); text = `찻잔을 사이에 두고 ${jo(host.name, "이/가")} 조용히 말했다. "${ev.text}… 아무한테도 말하지 마요."`; }
        else text = `${jo(host.name, "과/와")} 차를 마시며 시시콜콜한 이야기를 나눴다. 시간 가는 줄 몰랐다.`;
      } else if (what === "meal") {
        inv.ate = true; p.hunger = 0; p.energy = Math.min(100, p.energy + 25); host.gold = Math.max(0, host.gold - 2); adjust(host, p.id, 5);
        text = `${jo(host.name, "이/가")} 정성껏 차린 저녁을 함께 먹었다. ${JOBS[host.job].id === "cook" ? "요리사의 솜씨라 그런지 기가 막혔다." : "소박하지만 따뜻한 밥이었다."}`;
      } else if (what === "look") {
        inv.looked = true; adjust(host, p.id, 3);
        const ha = houseAsset(w, bd.town, bd.hid) || {}, st = { ...(ha.style || {}), grown: (ha.mods || {}).grown }, S = A.CONTENT.styles, bits = [];
        if (st.roof && S.roof[st.roof]) bits.push(S.roof[st.roof].name + " 지붕"); if (st.wall && S.wall[st.wall]) bits.push(S.wall[st.wall].name);
        if (st.grown) bits.push("넓힌 방");
        text = bits.length ? `${bits.join(", ")}이 눈에 띈다. 칭찬하자 ${jo(host.name, "이/가")} 쑥스러운 듯 웃었다.` : `작지만 깔끔한 집이다. ${jo(host.name, "이/가")} "누추하죠?" 하며 웃었다.`;
      }
      return finish(w, text, def.min, def.e);
    }
    if (id.startsWith("pioneer:") && def && def.ok) {
      const j = JOBS[id.slice(8)], old = JOBS[p.job].name, from = p.job;
      w.jobsOpen = w.jobsOpen || []; w.jobsOpen.push(j.id); A.setJob(p, j.id); p.pioneer = j.id; p.fame += 3;
      w.record("job_born", `${old} 일을 하던 ${jo(p.name, "이/가")} 이 세계에서 처음으로 ‘${j.name}’ 일을 시작했다`, { actor: p.id, town: p.town, imp: 7, wr: 0.8, data: { job: j.id, from } });
      return finish(w, `이제 나는 이 세계 최초의 ${j.name}다! 사람들이 신기한 눈으로 본다.`, 60, 5);
    }
    if (!def || !def.ok) return { text: def && def.why ? def.why : "지금은 할 수 없다" };
    const town = w.towns[pl.town];
    let text = "";
    if (id === "jobmake") return { jobmake: true };
    if (id.startsWith("side:")) { p.side = id.slice(5); return finish(w, `이제 ${JOBS[p.side].name} 일을 부업으로 한다.`, 0, 0); }
    if (id.startsWith("wk:") && def.work.steps) return { sim: def.work }; // 조작 화면을 연다 (ui → Sims.run → finishWork)
    if (id.startsWith("wk:")) {
      text = SIMS[def.work.sim](w, def.work, { town, pl });
    } else if (id.startsWith("job:")) {
      const j = JOBS[id.slice(4)], old = JOBS[p.job].name, from = p.job;
      p.gold -= j.entry_cost; A.setJob(p, j.id);
      w.record("career", `${jo(old, "이었던/였던")} ${jo(p.name, "이/가")} ${j.start_text || jo(j.name, "이/가") + " 되었다"}`, { actor: p.id, town: p.town, imp: 4, wr: 0.4, data: { from, to: j.id, cost: j.entry_cost } });
      text = `이제 나는 ${j.name}다. 직업 기술이 ‘${SKILL[j.id].name}’(으)로 바뀌었다.`;
    } else if (id.startsWith("buy:")) {
      const it = id.split(":")[1], pr = buyPrice(w, town, it);
      if (STOCKED(it) && !A.stockTake(town, it)) return { text: "방금 다 팔렸다." };
      p.gold -= pr; give(w, it, 1, "사기", `${town.name} ${pl.name}`); text = `${jo(ITEMS[it].name, "을/를")} 금화 ${pr}닢에 샀다.`;
      return finish(w, text, 0, 0);
    } else if (id.startsWith("sell:")) {
      const it = id.split(":")[1], n = e.inv[it], v = sellPrice(w, it) * n;
      take(w, it, n); p.gold += v; A.stockAdd(town, it, n); text = `${ITEMS[it].name} ${n}개를 팔아 금화 ${v}닢을 받았다.`;
      return finish(w, text, 0, 0);
    } else if (id === "sharpen") { p.gold -= 10; e.sharp = true; text = "대장장이가 무기를 날카롭게 벼려 주었다."; }
    else if (id === "meal") { p.gold -= 6; p.hunger = 0; p.energy = Math.min(100, p.energy + 30); text = "따끈한 스튜와 빵으로 배를 채웠다."; }
    else if (id === "cook") { take(w, "meat", 2); p.gold -= 2; give(w, "meal", 1, "여관에 요리 맡기기", town.name); text = "주인장이 고기 스튜를 끓여 주었다."; }
    else if (id === "drink") {
      p.gold -= 2;
      const pats = visibleNPCs(w).filter(({ n }) => n.town === pl.town && dist(walkers.get(n.id).x, walkers.get(n.id).y, pl.x, pl.y) < 6).map(({ n }) => n);
      const x = pats.length ? w.rng.choice(pats) : null;
      if (x) {
        adjust(x, p.id, 2);
        const news = x.mem.filter((m) => !p.known.has(m.e) && w.events[m.e] && w.events[m.e].imp >= 2);
        if (news.length) { const ev = w.events[maxBy(news, (m) => w.events[m.e].imp * m.s).e]; w.remember(p, ev, false, x.id); text = `옆자리의 ${jo(x.name, "이/가")} 취해서 털어놓았다. "${ev.text}"`; }
        else text = `${jo(x.name, "과/와")} 잔을 부딪쳤다.`;
      } else text = "혼자 조용히 마셨다. 주점이 한산하다.";
    } else if (id === "treat") {
      p.gold -= 15; p.fame += 1;
      for (const x of w.residents(pl.town, true)) if (x.id !== p.id) adjust(x, p.id, 4);
      w.record("treat", `${jo(p.name, "이/가")} ${town.name} 주점에서 모두에게 한턱을 냈다`, { actor: p.id, town: pl.town, imp: 3, wr: 0.6 });
      text = "주점이 떠들썩해졌다. 다들 내 이름을 기억할 것이다.";
    } else if (id === "story") {
      const mine = p.mem.filter((m) => w.events[m.e] && w.events[m.e].imp >= 4).sort((a, b) => w.events[b.e].imp - w.events[a.e].imp);
      if (!mine.length) text = "들려줄 만한 이야기가 없었다.";
      else { const ev = w.events[mine[0].e]; const ls = w.rng.shuffle(w.residents(pl.town, true).filter((x) => x.id !== p.id)).slice(0, 4); for (const x of ls) w.remember(x, ev, false, p.id); if (ev.imp >= 6) p.fame += 1; text = `"${ev.text}" 이야기를 들려주자 ${ls.length}명이 귀를 기울였다.`; }
    } else if (id === "heal") { p.gold -= 4; p.health = 10; text = "사제가 상처를 돌봐 주었다."; }
    else if (id === "brew") { take(w, "herb", 3); give(w, "potion", 2, "약초 달이기", town.name); text = "약초를 달여 치유 물약 2병을 만들었다."; }
    else if (id === "pray") { p.energy = Math.min(100, p.energy + 5); if (p.goal && w.rng.next() < 0.3) { adjust(p, p.goal.target, 15); text = `기도하는 동안 ${w.npcs[p.goal.target].name}에 대한 미움이 조금 누그러졌다.`; } else text = "조용히 기도했다. 마음이 차분해졌다."; }
    else if (id === "board") return { text: null, board: true };
    else if (id === "craft") return { text: null, craft: true };
    else if (id === "report") return { text: null, report: true };
    else if (id === "surrender") { const f = 15 * e.wanted.level; p.gold -= f; e.wanted = { town: null, level: 0, lastSeen: 0 }; for (const k of walkers.values()) k.chase = false; text = `벌금 ${f}닢을 내고 수배를 풀었다.`; }
    else if (id === "enlist") { enlist(p, w); syncPos(w); text = "전선으로 떠났다."; return finish(w, text, 0, 0); }
    else if (id === "rest") { p.energy = Math.min(100, p.energy + 12); p.health = Math.min(10, p.health + 0.5); text = "한숨 돌렸다."; }
    else if (id === "family") {
      const fam = [...family(p)].map((i) => w.npcs[i]).filter((x) => x.alive && x.town === p.town && !x.at_war);
      for (const x of fam) { adjust(x, p.id, 6); adjust(p, x.id, 5); }
      text = fam.length ? `${jo(fam.map((x) => x.name).join(", "), "과/와")} 함께 시간을 보냈다.` : "함께할 가족이 이 마을에 없다.";
    } else if (id === "settle") { p.home = pl.town; text = `${jo(town.name, "이/가")} 이제 내 집이다. 집 앞마당을 밭으로 일굴 수 있다.`; w.record("travel", `${jo(p.name, "이/가")} ${jo(town.name, "에/에")} 자리를 잡았다`, { actor: p.id, town: pl.town, imp: 3, wr: 0.3 }); }
    return finish(w, text, def.min, def.e);
  }
  function finish(w, text, mins, energy) { if (text) log(w, text); spend(w, mins || 0, energy || 0); return { text }; }
  function reportCrime(w, evId) {
    const p = w.player;
    const j = [...w.journal].reverse().find((x) => x.e === evId);
    const ev = w.events[evId];
    if (!ev || !j) return "신고할 일을 골라야 한다.";
    const guards = w.residents(p.town, true).filter((g) => JOBS[g.job].guard && g.controller !== "player").length;
    if (!guards) return "이 마을엔 경비병이 없다.";
    j.r = 1;
    const c = w.npcs[ev.actor];
    if (j.s === "seen" || j.s === "self" || w.rng.next() < 0.4) {
      c.jail = Math.max(c.jail, ev.kind === "murder" ? 20 : w.rng.randint(4, 8));
      w.record("report", `${jo(p.name, "이/가")} ${c.name}의 일을 고발해 ${jo(c.name, "이/가")} 감옥에 갇혔다 (${ev.text})`, { actor: p.id, target: c.id, town: p.town, imp: 4, sent: -8, wr: 0.4 });
      if (root.Story) root.Story.onArrest(w, c);
      spend(w, 30, 2);
      return `${jo(c.name, "이/가")} 붙잡혀 갔다.`;
    }
    spend(w, 30, 2);
    return `경비대는 "소문만으로는 잡아갈 수 없다"며 돌려보냈다.`;
  }
  function knownCrimes(w) {
    const p = w.player, seen = new Set(), out = [];
    for (let i = w.journal.length - 1; i >= 0; i--) {
      const j = w.journal[i], e = w.events[j.e];
      if (!e || seen.has(e.id) || !["theft", "revenge", "murder", "duel", "assault"].includes(e.kind) || e.actor === null || e.actor === p.id || j.r) continue;
      const c = w.npcs[e.actor];
      if (!c.alive || c.at_war || c.jail > 0) continue;
      seen.add(e.id); out.push({ e, j });
      if (out.length >= 8) break;
    }
    return out;
  }

  // ================================================================ 이곳의 사람들
  /** 요즘 형편 한마디 (인물 수첩): 앓는 중·일을 놓음·상중 */
  function lifeState(w, n) {
    if (!n.alive) return "";
    const I = A.illOf(n), out = [];
    if (I) out.push(I.hurt ? "다쳐서 쉬는 중" : `${jo(I.name, "으로/로")} 앓는 중`);
    if (n.retired) out.push(`${w.ago(n.retired)} 일을 놓았다`);
    if (n.grief && w.npcs[n.grief.of]) out.push(`${jo(w.npcs[n.grief.of].name, "을/를")} 잃고 상중`);
    return out.join(" · ");
  }
  function activity(w, n) {
    if (n.away && w.towns[n.away.at]) { const home = w.towns[n.town].name, a = n.away, hn = a.host !== undefined && w.npcs[a.host] ? w.npcs[a.host].name : ""; return `${home}에서 온 손님 · ${{ see: hn ? jo(hn, "을/를") + " 보러" : "다니러", shop: "장 보러", heal: "몸 고치러", tour: "구경하러" }[a.why] || "다니러"}`; }
    if (n.going && !n.trip) return "마차 기다리는 중";
    { const L = n.life && n.life.day === w.day ? n.life : null, I = A.illOf(n);
      if (I && !n.trip && (!L || ["rest", "sleep"].includes(L.act))) return I.hurt ? "다쳐서 쉬는 중" : `${jo(I.name, "으로/로")} 앓는 중`;
      if (L && L.act === "help") { const par = w.npcs[L.with]; return `${par ? par.name + " 곁에서 " : ""}${(JOBS[L.job] || {}).name || ""} 일 거드는 중`; } }
    const k = walkers.get(n.id);
    if (!k) return n.at_war ? "전선" : "어딘가";
    if (n.jail > 0) return "감옥";
    const tr = n.trip && (w.trips || []).find((x) => x.id === n.trip);
    if (tr) { const to = w.towns[tr.to].name, wait = w.day * 1440 + w.clock < tr.t0; return tr.by !== n.id ? `${jo(to, "으로/로")} 마차 타고 가는 중` : wait ? `${jo(to, "으로/로")} 떠날 채비 중` : tr.kind === "goods" ? `${jo(to, "으로/로")} 짐 나르는 중` : tr.kind === "walk" ? `${jo(to, "으로/로")} 걸어가는 중` : `${jo(to, "으로/로")} 마차 모는 중`; }
    const L = n.life && n.life.day === w.day ? n.life : null;
    if (L) {
      const where = { tavern: "주점에서 ", market: "시장에서 ", temple: "신전에서 ", meadow: "들판에서 ", river: "냇가에서 ", hill: "언덕에서 ", square: "광장에서 ", house: "집에서 " }[L.place] || "";
      const withN = L.with !== undefined && w.npcs[L.with] ? ` (${jo(w.npcs[L.with].name, "과/와")})` : "";
      if (k.path && k.path.length && L.act !== "sleep") return { work: "일하러 가는 중", meal: "밥 먹으러 가는 중", play: "놀러 가는 중", social: "만나러 가는 중", shop: "장 보러 가는 중", pray: "기도하러 가는 중" }[L.act] || "걷는 중";
      if (L.act === "work") return `${(JOBS[n.job] || {}).name || ""} 일하는 중`;
      if (L.feast) return `광장에서 ${A.LIFE_LABEL_FEAST}`;
      return (L.act === "meal" || L.act === "social" || L.act === "play" ? where : "") + A.LIFE_LABEL[L.act] + withN;
    }
    if (k.inside) return isNight(w) ? "집에서 자는 중" : "건물 안";
    if (k.chase) return "나를 쫓는 중!";
    if (k.fight) return "나와 싸우는 중!";
    const near = MAP.places.filter((p) => p.town === n.town).map((p) => [p, dist(p.x, p.y, k.x, k.y)]).sort((a, b) => a[1] - b[1])[0];
    if (!near || near[1] > 4) return "걷는 중";
    const pk = near[0].kind;
    return { fields: "밭일 중", tavern: "주점에서 쉬는 중", market: "시장에서", forge: "대장간에서", temple: "신전에서", guild: "길드에서", square: "광장에서", inn: "여관 앞", house: "집 앞" }[pk] || "근처";
  }
  function peopleHere(w) {
    const p = w.player;
    if (!p || !w.ppos) return [];
    const t = townAt(w.ppos.x, w.ppos.y);
    const out = [];
    for (const [id, k] of walkers) {
      const n = w.npcs[id];
      if (t ? A.locOf(n) !== t || n.trip || n.at_war : dist(k.x, k.y, w.ppos.x, w.ppos.y) > 14) continue; // 마을 안: 지금 이 마을에 있는 사람 (다니러 온 손님 포함)
      out.push({ n, k, act: activity(w, n), d: dist(k.x, k.y, w.ppos.x, w.ppos.y) });
    }
    return out.sort((a, b) => (a.k.inside - b.k.inside) || a.d - b.d);
  }

  // ================================================================ 얻는 곳
  /* 아이템을 어디서 얻는지. 채집물·작물·짐승·제작법·가게·직업 기술·유적 정보에서 만든다.
   * 새 아이템은 정의에 source: ["…"]를 주면 그 문장이 맨 앞에 붙는다. */
  const FORAGE_SRC = {
    apple: "사과나무에서 딴다 (여름·가을)", berry: "덤불에서 딴다 (봄·여름)", herb: "숲의 약초를 딴다 (겨울 제외)", mushroom: "숲의 버섯을 딴다 (겨울 제외)",
    flower: "들판의 들꽃을 딴다 (겨울 제외)", branch: "나무 밑에서 줍는다 (맨손, 같은 나무는 2일 뒤 다시)", stone: "바위 둘레에서 줍는다 (맨손, 다음 날 다시)",
    fiber: "마을 밖 풀밭이나 덤불에서 뜯는다 (맨손)", wood: "도끼로 나무를 벤다",
  };
  const ANIMAL_ZONE = { rabbit: "들판", deer: "들판·숲", boar: "숲", wolf: "북쪽 황무지·숲, 밤", chicken: "마을 (잡으면 범죄)" };
  const SKILL_SRC = { bread: "빵집 주인 기술: 밀 2개로 빵 3개", honey: "양봉가 기술: 하루 한 번", dish: "요리사 기술: 먹을거리 2개로" };
  function sourcesOf(w, id) {
    const it = ITEMS[id] || {}, out = [...(it.source || [])];
    if (FORAGE_SRC[id]) out.push(FORAGE_SRC[id]);
    for (const [cid, c] of Object.entries(CROPS)) if (c.item === id) out.push(`밭에서 기른다: ${ITEMS[SEED_OF[cid]].name}(시장) · ${c.seasons.join("·")} · ${c.days}일`);
    const hunters = Object.entries(ANIMAL).filter(([, a]) => a.drop.some(([d]) => d === id)).map(([k, a]) => `${a.name}(${ANIMAL_ZONE[k] || ""})`);
    if (hunters.length) out.push(`사냥한다: ${hunters.join(", ")}`);
    for (const r of A.CONTENT.recipes) if (r.out === id) out.push(`만든다: ${Object.entries(r.needs).map(([n, k]) => `${ITEMS[n].name} ${k}`).join(", ")}${r.station === "workbench" ? " (집 작업대)" : ""}${r.know ? ` · ‘${A.KNOW(r.know).name}’ 필요` : ""}`);
    if (["hoe", "can", "axe", "dagger", "sword"].includes(id)) out.push(`대장간에서 산다 (금화 ${it.price})`);
    if (id === "bread" || id.startsWith("seed_")) out.push(`시장에서 산다 (금화 ${it.price})`);
    if (id === "potion") out.push(`신전에서 산다 (금화 ${it.price})`);
    if (SKILL_SRC[id]) out.push(SKILL_SRC[id]);
    if (A.CONTENT.loot.some((l) => l.id === id)) out.push("숲속 유적·흙더미에서 드물게 나온다");
    return out.length ? out : ["얻는 곳이 알려지지 않았다"];
  }

  const G = { boardCoach, rideFare, lifeState,
    buyPrice, STOCKED, syncGenItems, JOBMAKE, jobDraft, checkJobDraft, workSig, sameWork, draftWork, createJob, itemValue, SIMS, registerSim, HANDS, registerHand, toolReady, workReady, finishWork, jobReady, houseAsset, furnKey, sourcesOf, note, codexHas, catOf, CODEX_CATS, knownRecipes, zoneName,
    MAP, T, O, MW, MH, TOWN_POS, FRONT, rebuildMap, styleOf, crossOK, unstick, inviteAt, seeOut, breakinAt, residentsOf, canExpand, houseExpandOptions, applyHouseWork, houseOfNpc, practice, doBuildWork, renoOptions, orderReno, renoDawn, renoName, stationPlaces, findSite, insideBuilding, furnitureIn, entryOf, canEnter, readScroll, ITEMS, berryReady, projectiles, updateProjectiles, throwAt, recipes, craft, stationReady, nearHome, grassy, CROPS, SKILL, ANIMAL, animals, walkers,
    walkable, townAt, placeOf, findPath, objAt, ext, has, give, take, absMin, clockText, hour, isNight,
    setup, newLife, resetLife, extOf, blockedReason, tick, spend, sleep, faint, syncPos, placeIn, move, facingTile, face, useAt, eat,
    updateAnimals, updateWalkers, visibleNPCs, say, npcAtTile, forageReady, farmDawn, canTill, homeBuilding,
    buildingMenu, doBuilding, reportCrime, knownCrimes, crime, peopleHere, activity, weaponDmg, log, attackNPC,
    pendingMins: 0, onLog: null, onHurt: null, onSwing: null, onTalk: null,
  };
  root.Game = G;
  G.findSite = findSite;
})(typeof window !== "undefined" ? window : globalThis);
