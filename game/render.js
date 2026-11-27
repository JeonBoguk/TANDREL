/* 탑다운(3/4 시점) 픽셀 렌더러. 16px 타일을 낮은 해상도 버퍼에 그린 뒤 정수배로 확대한다. */
(function (root) {
  "use strict";
  const G = root.Game, A = root.Asteria;
  const { T, O, MAP, MW, MH } = G;
  const TS = 16;

  const SEASON = {
    봄: { g: ["#78c04f", "#6fb648", "#82c95a"], g2: "#5e9e3d", floor: ["#4f9a46", "#55a04b"], leaf: ["#3e8f3e", "#4ea24a", "#2f7a34"], blossom: "#f2a7c3" },
    여름: { g: ["#67b544", "#5fab3e", "#72be4c"], g2: "#4e9134", floor: ["#3f8c3f", "#459343"], leaf: ["#2f7d36", "#3a8c3c", "#256b2d"], blossom: null },
    가을: { g: ["#b3a54b", "#a89a44", "#bcae54"], g2: "#8d7e36", floor: ["#8a7a3c", "#937f40"], leaf: ["#d98a2f", "#c9622b", "#e3ab3b"], blossom: null },
    겨울: { g: ["#e7eef1", "#dde7eb", "#eef4f6"], g2: "#c4d2d8", floor: ["#d3dfe3", "#dbe5e8"], leaf: ["#3f6b55", "#4b765f", "#355d4a"], blossom: null },
  };
  const C = {
    dirt: ["#c9a067", "#c09661", "#d1a96f"], sand: ["#e8d49a", "#e2cc90", "#eddaa3"], pave: ["#bdb4a3", "#b2a996"], paveL: "#d0c8b8",
    water: "#3f8fd2", water2: "#6fb3e8", deep: "#2a6cb0", foam: "#d9f0ff",
    cliffTop: "#a68a63", cliffTop2: "#98805a", cliffFace: "#7a6347", cliffFace2: "#6a553c", cliffLine: "#584631",
    field: "#8a5f36", tilled: "#6f4a29", wet: "#4f3420", waste: ["#8a6b5c", "#7f6152"], bridge: "#a87a4c", bridge2: "#8b6138",
    trunk: "#6b4a2b", shadow: "rgba(20,30,10,0.28)", stone: "#9a9ea6", stoneD: "#777c85", fence: "#a3743f", fenceD: "#7c5428",
  };
  const ROOF = { tavern: ["#b8463a", "#93362c"], forge: ["#55555f", "#3f3f47"], temple: ["#5b80c2", "#46669f"], guild: ["#4f7041", "#3c5631"], market: ["#e2b84a", "#c4982f"], inn: ["#c76a3f", "#a65330"], house: ["#9a5a3a", "#7e472d"] };
  const WALL = { tavern: "#c08a55", forge: "#8f877b", temple: "#ece4d2", guild: "#b19c74", market: "#e8d6a6", inn: "#e0c79c", house: "#dcc49a" };
  const JOBC = new Proxy({}, { get: (_, id) => (A.JOBS[id] && A.JOBS[id].color) || "#8a8f9a" });
  const SKIN = { human: "#f1c9a5", elf: "#f6dcc7", dwarf: "#e0a982", beastkin: "#c99566" };
  const HAIR = ["#3b2a1e", "#7a4a26", "#d9b25a", "#a33a2a", "#2a2a2a", "#cfcfcf", "#5a3d7a"];
  const hash = (a, b, c = 0) => { let n = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; return n / 4294967296; };

  // ================================================================ 인물 그리기 (도트)
  /* 종족 정의의 look(skin·hair·ears·beard·tail·short·curly)과 직업 정의의 look(hat·apron·trim)·color로 그린다.
   * 새 종족이나 직업을 더하면 따로 그림을 그리지 않아도 그 정의대로 그려진다. 결과는 캐시한다. */
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, bl = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; bl *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; bl += (255 - bl) * f; }
    return "#" + [r, g, bl].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); };
  const HAIR_STYLES = ["short", "long", "pony", "bun", "spiky", "bob"];
  function lookOf(n, isPlayer) {
    const race = A.RACES[n.race] || {}, rl = race.look || {}, job = A.JOBS[n.job] || {}, jl = job.look || {};
    const hsh = (k) => hash(n.id + 7, k, 3);
    const skins = rl.skin || ["#f1c9a5"], hairs = rl.hair || HAIR;
    const kid = !A.isAdult(n);
    const old = !kid && A.age(n) > (race.lifespan ? race.lifespan[0] * 0.75 : 60);
    const cloth = n.role === "hero" ? "#e3c14b" : job.color || "#8a8f9a";
    return {
      key: `${n.race}|${n.job}|${n.id}|${kid ? 1 : 0}|${old ? 1 : 0}|${n.role || ""}|${isPlayer ? 1 : 0}`,
      skin: skins[Math.floor(hsh(1) * skins.length)], hair: old ? "#d8d8d2" : hairs[Math.floor(hsh(2) * hairs.length)],
      style: rl.curly ? "curly" : HAIR_STYLES[Math.floor(hsh(3) * HAIR_STYLES.length)], eye: ["#2a1e16", "#2b4a7a", "#3d6a3a", "#6a3a1a"][Math.floor(hsh(4) * 4)],
      ears: rl.ears || null, horns: rl.horns || null, beard: rl.beard && !kid, tail: rl.tail, short: rl.short || kid, kid,
      cloth, cloth2: shade(cloth, -0.28), pants: shade(job.color ? "#4a4058" : "#3a3a46", hsh(5) * 0.3 - 0.15),
      hat: kid ? null : n.role === "hero" ? "circlet" : jl.hat || null, apron: kid ? null : jl.apron || null, trim: jl.trim || shade(cloth, 0.35),
      blush: hsh(6) < 0.5, player: isPlayer,
    };
  }
  /** 작은 캔버스에 픽셀을 찍고, 마지막에 어두운 외곽선을 두른다 */
  function pixelCanvas(wd, ht, paint) {
    const c = document.createElement("canvas"); c.width = wd; c.height = ht;
    const x = c.getContext("2d");
    const R = (px, py, w2, h2, col) => { if (!col) return; x.fillStyle = col; x.fillRect(px, py, w2, h2); };
    paint(R, x);
    const img = x.getImageData(0, 0, wd, ht), d = img.data, out = new Uint8ClampedArray(d);
    const A_ = (i, j) => (i < 0 || j < 0 || i >= wd || j >= ht ? 0 : d[(j * wd + i) * 4 + 3]);
    for (let j = 0; j < ht; j++) for (let i = 0; i < wd; i++) {
      if (A_(i, j)) continue;
      if (A_(i - 1, j) || A_(i + 1, j) || A_(i, j - 1) || A_(i, j + 1)) { const k = (j * wd + i) * 4; out[k] = 38; out[k + 1] = 26; out[k + 2] = 22; out[k + 3] = 235; }
    }
    x.putImageData(new ImageData(out, wd, ht), 0, 0);
    return c;
  }
  /* 머리 (sprite와 초상화 공용). S=배율, ox/oy=머리 왼쪽 위, view: down|up|side */
  function paintHead(R, L, ox, oy, S, view, flip) {
    const P = (x, y, w2, h2, c) => R(ox + (flip ? (12 - x - w2) : x) * S, oy + y * S, w2 * S, h2 * S, c);
    const hair = L.hair, hairD = shade(hair, -0.3), hairL = shade(hair, 0.25), skin = L.skin, skinD = shade(skin, -0.14);
    // 뒷머리 (긴 머리·포니테일·묶음)
    if (L.style === "long") P(0, 4, 12, view === "up" ? 9 : 8, hairD);
    if (L.style === "pony") { if (view === "side") P(-2, 4, 3, 7, hairD); else if (view === "up") P(5, 9, 2, 5, hairD); }
    if (L.style === "bun") P(4, -2, 4, 3, hair);
    // 뿔 (용족 등)
    if (L.horns) { P(1, -2, 2, 3, L.horns); P(0, -4, 2, 2, L.horns); P(9, -2, 2, 3, L.horns); P(10, -4, 2, 2, L.horns); }
    // 동물 귀
    if (L.ears === "animal") { P(0, -2, 3, 4, hair); P(9, -2, 3, 4, hair); P(1, -1, 1, 2, shade(skin, -0.05)); P(10, -1, 1, 2, shade(skin, -0.05)); }
    // 얼굴
    P(1, 1, 10, 10, skin); P(0, 3, 12, 6, skin); P(1, 10, 10, 1, skinD);
    if (L.ears === "long" && view !== "up") { P(-2, 4, 2, 2, skin); P(-1, 6, 1, 1, skin); P(12, 4, 2, 2, skin); P(12, 6, 1, 1, skin); }
    if (view === "up") { P(0, 1, 12, 10, hair); P(1, 0, 10, 1, hair); P(2, 1, 8, 1, hairL); return; }
    // 눈·입
    const ex = view === "side" ? 2 : 0;
    {
      if (view === "side") { P(7 + ex - 1, 5, 2, 2, L.eye); P(7 + ex - 1, 5, 1, 1, "#ffffff"); }
      else { P(3, 5, 2, 2, L.eye); P(7, 5, 2, 2, L.eye); P(3, 5, 1, 1, "#ffffff"); P(7, 5, 1, 1, "#ffffff"); }
      if (L.blush && view !== "side") { P(2, 7, 1, 1, "#f09a9a"); P(9, 7, 1, 1, "#f09a9a"); }
      if (!L.beard) P(5 + (view === "side" ? 3 : 0), 8, 2, 1, "#b8564a");
    }
    if (L.beard) { P(1, 7, 10, 4, hair); P(2, 11, 8, 2, hair); P(3, 13, 6, 1, hairD); P(4 + (view === "side" ? 2 : 0), 7, 4, 1, skin); }
    // 앞머리
    switch (L.style) {
      case "spiky": P(0, 0, 12, 3, hair); P(1, -1, 2, 1, hair); P(5, -1, 2, 1, hair); P(9, -1, 2, 1, hair); P(0, 3, 1, 3, hair); P(11, 3, 1, 3, hair); P(2, 3, 2, 1, hair); P(7, 3, 2, 1, hair); break;
      case "bob": P(0, 0, 12, 3, hair); P(0, 3, 2, 6, hair); P(10, 3, 2, 6, hair); P(2, 3, 3, 1, hair); P(7, 3, 3, 1, hair); break;
      case "curly": P(0, 0, 12, 3, hair); for (let k = 0; k < 12; k += 2) P(k, -1, 1, 1, hair); P(0, 3, 1, 4, hair); P(11, 3, 1, 4, hair); P(1, 3, 1, 1, hairD); P(4, 3, 2, 1, hair); P(8, 3, 1, 1, hair); break;
      default: P(0, 0, 12, 3, hair); P(0, 3, 1, 4, hair); P(11, 3, 1, 4, hair); P(1, 3, 4, 1, hair); P(view === "side" ? 6 : 8, 3, 3, 1, hair);
    }
    P(2, 0, 6, 1, hairL);
  }
  function paintHat(R, L, ox, oy, S, view, flip) {
    const P = (x, y, w2, h2, c) => R(ox + (flip ? (12 - x - w2) : x) * S, oy + y * S, w2 * S, h2 * S, c);
    const t = L.trim, c = L.cloth;
    switch (L.hat) {
      case "straw": P(-2, 1, 16, 2, "#e8c66a"); P(1, -2, 10, 3, "#e8c66a"); P(1, 0, 10, 1, "#c24a3a"); P(-2, 2, 16, 1, "#c9a24a"); break;
      case "chef": P(1, -4, 10, 5, "#fbf8f0"); P(0, -5, 4, 3, "#fbf8f0"); P(8, -5, 4, 3, "#fbf8f0"); P(1, 0, 10, 1, "#ddd6c8"); break;
      case "cap": P(0, -1, 12, 3, c); P(view === "side" ? 8 : 2, 1, view === "side" ? 6 : 8, 1, shade(c, -0.3)); P(5, -1, 2, 1, t); break;
      case "helmet": P(-1, -1, 14, 5, "#aab0b8"); P(0, -1, 12, 1, "#d6dbe2"); P(5, 3, 2, 3, "#8a9098"); P(-1, 3, 2, 4, "#8a9098"); P(11, 3, 2, 4, "#8a9098"); break;
      case "bandana": P(0, 0, 12, 2, c); P(0, 2, 12, 1, shade(c, -0.25)); if (view !== "up") P(view === "side" ? -2 : 11, 2, 3, 2, c); break;
      case "witch": P(-2, 1, 16, 2, shade(c, -0.2)); P(1, -2, 10, 3, c); P(3, -5, 6, 3, c); P(5, -7, 3, 2, c); P(1, 0, 10, 1, t); break;
      case "hood": P(0, -1, 12, 3, shade(c, -0.15)); P(-1, 1, 1, 9, shade(c, -0.15)); P(12, 1, 1, 9, shade(c, -0.15)); P(1, -1, 10, 1, t); break;
      case "veil": P(-2, 1, 16, 2, "#e8d8a8"); P(1, -2, 10, 3, "#e8d8a8"); P(-2, 3, 1, 7, "rgba(255,255,255,0.6)"); P(13, 3, 1, 7, "rgba(255,255,255,0.6)"); P(-1, 9, 14, 1, "rgba(255,255,255,0.5)"); break;
      case "circlet": P(1, 1, 10, 1, "#ffd75a"); P(5, 0, 2, 1, "#ff6a5a"); break;
    }
  }

  // ================================================================ 16px 도트 (art16.js의 키트를 게임에 잇는다)
  const ART = root.Art16;
  const toCanvas = (b) => { const c = document.createElement("canvas"); c.width = b.w; c.height = b.h; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(b.px.buffer.slice(0)), b.w, b.h), 0, 0); return c; };
  const ramp3 = (hex) => [shade(hex, -0.3), hex, shade(hex, 0.22)];
  const GRASS_S = {
    봄: ART.RAMP.grass,
    여름: ["#2e5434", "#477244", "#5c8a4a", "#6e9a52", "#6e9a52", "#88b060", "#a2c474"],
    가을: ["#4a4a2a", "#6a6a38", "#8a8444", "#a49a50", "#a49a50", "#bcae62", "#d0c27a"],
    겨울: ["#7a8a92", "#a4b2b8", "#c8d2d6", "#e2e8ea", "#e2e8ea", "#f0f4f6", "#ffffff"],
  };
  const LEAF_S = {
    가을: ["#3a2420", "#5a3226", "#7e4630", "#a0603c", "#a0603c", "#b97c4e", "#cc9866"],
    겨울: ["#2a3438", "#3e4c4e", "#5a6a6a", "#9aaaae", "#9aaaae", "#e4ecee", "#ffffff"],
  };
  const PINE_S = { 겨울: ["#1e2e2c", "#2a4038", "#365442", "#9aaaae", "#9aaaae", "#e4ecee", "#ffffff"] };
  const sm3 = (t) => t * t * (3 - 2 * t);
  const CH = 8, CPX = CH * TS, MARG = 2;
  // 지형 묶음: 풀(0)·흙(1)·물(2)·모래(3)·황무지(4). 포장길·밭·다리·벼랑은 타일 그대로 위에 그린다
  const CAT = (t) => (t === T.WATER || t === T.DEEP || t === T.BRIDGE ? 2 : t === T.DIRT || t === T.PAVE || t === T.FIELD ? 1 : t === T.SAND ? 3 : t === T.WASTE ? 4 : t === T.CLIFF ? 5 : 0);
  function paintChunk(w, ccx, ccy, phase) {
    const x0t = ccx * CH - MARG, y0t = ccy * CH - MARG, nT = CH + MARG * 2, W = nT * TS, H = W;
    const B = new ART.Buf(W, H), f = new Uint8Array(W * H), gx0 = x0t * TS, gy0 = y0t * TS;
    const cat = (tx, ty) => CAT(MAP.getT(tx, ty));
    const smooth = (c, gx, gy) => {
      const fx = gx / TS - 0.5, fy = gy / TS - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = sm3(fx - x0), v = sm3(fy - y0);
      const k = (tx, ty) => (cat(tx, ty) === c ? 1 : 0);
      return k(x0, y0) * (1 - u) * (1 - v) + k(x0 + 1, y0) * u * (1 - v) + k(x0, y0 + 1) * (1 - u) * v + k(x0 + 1, y0 + 1) * u * v;
    };
    let hasWater = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const gx = gx0 + x, gy = gy0 + y, n = (ART.fbm(gx / 9, gy / 9, 3) - 0.5) * 0.5;
      let c = 0;
      if (smooth(1, gx, gy) + n > 0.5) c = 1;
      if (smooth(4, gx, gy) + n > 0.5) c = 4;
      if (smooth(3, gx, gy) + n > 0.5) c = 3;
      if (smooth(5, gx, gy) + n * 0.6 > 0.5) c = 5;
      if (smooth(2, gx, gy) + n * 0.7 > 0.5) { c = 2; hasWater = true; }
      f[y * W + x] = c;
    }
    const dist = (pred) => { const d = new Int16Array(W * H).fill(99), q = []; for (let i = 0; i < W * H; i++) if (pred(f[i])) { d[i] = 0; q.push(i); }
      for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); } } } return d; };
    const toWater = dist((v) => v === 2), toLand = hasWater ? dist((v) => v !== 2) : null, toDirt = dist((v) => v === 1);
    const G = GRASS_S[w.season] || GRASS_S.봄, D = ART.RAMP.dirt, Wt = ART.RAMP.water, S = ART.RAMP.sand, X = ["#4a3a36", "#6a5048", "#86685a", "#9a7c6a", "#9a7c6a", "#b0927e", "#c4a894"];
    const tileOf = (x, y) => MAP.getT(x0t + Math.floor(x / TS), y0t + Math.floor(y / TS));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, t = f[i], gx = gx0 + x, gy = gy0 + y;
      if (t === 2) { const d = toLand[i] + (ART.fbm(gx / 14, gy / 14, 5) - 0.5) * 3, deep = tileOf(x, y) === T.DEEP; B.set(x, y, d < 2.5 ? Wt[5] : deep && d > 6 ? Wt[2] : Wt[3]); continue; }
      if (toWater[i] <= 2) { B.set(x, y, toWater[i] === 1 ? S[1] : S[3]); continue; }
      if (t === 3) { B.set(x, y, ART.fbm(gx / 10, gy / 10, 6) > 0.6 ? S[4] : S[3]); continue; }
      if (t === 4) { B.set(x, y, ART.fbm(gx / 10, gy / 10, 8) > 0.6 ? X[5] : X[3]); continue; }
      if (t === 1) { B.set(x, y, ART.fbm(gx / 10, gy / 10, 11) > 0.63 ? D[4] : D[3]); continue; }
      if (t === 5) { // 벼랑: 윗면은 바위 땅, 아래 끝 7px은 깎아지른 면
        let below = 0; while (below < 8 && y + below + 1 < H && f[(y + below + 1) * W + x] === 5) below++;
        const Cl = ["#3a2e2a", "#54443a", "#6e5a4a", "#8a7460", "#a48e76", "#bca88e"];
        if (below < 7) B.set(x, y, below === 6 ? Cl[4] : below === 0 ? Cl[0] : (ART.hash(gx >> 1, gy, 21) < 0.25 ? Cl[1] : below > 3 ? Cl[3] : Cl[2]));
        else B.set(x, y, ART.fbm(gx / 8, gy / 8, 23) > 0.62 ? Cl[5] : Cl[4]);
        continue;
      }
      const floor = tileOf(x, y) === T.FLOOR;
      B.set(x, y, floor ? G[2] : ART.fbm(gx / 22, gy / 22, 1) > 0.6 ? G[4] : G[3]);
    }
    // 흙 결·자갈
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (f[i] !== 1 || toDirt[i] !== 0) continue;
      const gx = gx0 + x, gy = gy0 + y;
      if (gy % 3 === 0 && ART.hash(gx >> 2, gy, 13) < 0.12) { B.set(x, y, D[2]); B.set(x + 1, y, D[2]); }
      else if (ART.hash(gx, gy, 7) < 0.004) { B.set(x, y, ART.RAMP.stone[5]); B.set(x + 1, y, ART.RAMP.stone[4]); B.set(x, y + 1, ART.RAMP.stone[2]); }
    }
    // 풀 포기
    const small = [[-1, 0, 2], [0, 0, 2], [-1, -1, 4], [0, -1, 5]], mid = [[-1, 0, 2], [0, 0, 2], [1, 0, 2], [-1, -1, 4], [0, -1, 3], [1, -1, 4], [-1, -2, 5], [1, -2, 5]];
    const tall = [[-1, 0, 2], [0, 0, 2], [1, 0, 2], [2, 0, 2], [-1, -1, 3], [0, -1, 4], [1, -1, 3], [2, -1, 4], [-1, -2, 4], [0, -2, 5], [2, -2, 5], [0, -3, 6], [-1, -3, 5]];
    for (let gy = Math.floor(gy0 / 3) * 3; gy < gy0 + H; gy += 3) for (let gx = Math.floor(gx0 / 4) * 4; gx < gx0 + W; gx += 4) {
      const x = gx - gx0 + Math.floor(ART.hash(gx, gy, 1) * 4), y = gy - gy0 + Math.floor(ART.hash(gx, gy, 2) * 3);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x; if (f[i] !== 0 || toWater[i] < 4 || toDirt[i] < 3) continue;
      const wx = gx0 + x, wy = gy0 + y, dens = ART.vnoise(wx / 13, wy / 13, 41), r = ART.hash(gx, gy, 3), floor = tileOf(x, y) === T.FLOOR;
      const up = floor ? -1 : ART.fbm(wx / 22, wy / 22, 1) > 0.6 ? 1 : 0;
      if (r < 0.004 && w.season !== "겨울" && !floor) { const P = [ART.RAMP.white, ART.RAMP.yellow, ART.RAMP.petal][Math.floor(ART.hash(gx, gy, 4) * 3)]; B.set(x, y, G[2]); B.set(x, y - 1, P[2]); B.set(x - 1, y - 1, P[1]); B.set(x + 1, y - 1, P[1]); B.set(x, y - 2, P[3]); continue; }
      if (r > dens * 0.75 - 0.1) continue;
      const shape = r < dens * 0.18 ? tall : r < dens * 0.45 ? mid : small;
      for (const [dx, dy, k] of shape) B.set(x + dx, y + dy, G[Math.max(0, Math.min(6, k + up))]);
    }
    // 풀과 흙 경계
    for (let y = 0; y < H - 2; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (f[i] === 0 && f[i + W] === 1) { B.set(x, y + 1, D[1]); if (ART.hash(gx0 + x, gy0 + y, 12) < 0.45) { B.set(x, y + 1, G[2]); B.set(x, y + 2, D[1]); } B.set(x, y, G[5]); }
      else if (f[i] === 1 && f[i + W] === 0) { B.set(x, y, D[1]); B.set(x, y + 1, G[2]); }
      else if (f[i] === 0 && ((x > 0 && f[i - 1] === 1) || (x < W - 1 && f[i + 1] === 1))) B.set(x, y, G[2]);
    }
    // 물: 물가 거품과 잔물결 (phase마다 다르게)
    if (hasWater) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (f[i] !== 2) continue;
      const d = toLand[i], gx = gx0 + x, gy = gy0 + y, t = phase * 0.9;
      if (d === 1 && Math.sin(t * 2.2 + gx * 0.6 + gy * 0.4) > 0.2) B.set(x, y, Wt[7]);
      else if (d > 3 && gy % 3 === 0) { const ph = (gx + t * 3 + ART.hash(0, gy) * 100) / 13, k = ph - Math.floor(ph); if (k < 0.2 && ART.vnoise(gx / 14, gy / 6 + t * 0.15, 77) > 0.5) B.set(x, y, Wt[6]); }
    }
    // 타일 그대로 그리는 것: 포장길·밭·다리·벼랑
    const St = ART.RAMP.stone, Wd = ART.RAMP.wood;
    for (let ty = 0; ty < nT; ty++) for (let tx = 0; tx < nT; tx++) {
      const t = MAP.getT(x0t + tx, y0t + ty), ox = tx * TS, oy = ty * TS;
      if (t === T.PAVE) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const row = Math.floor(y / 4), u = (x + (row % 2) * 4 + 16) % 8, v = y % 4; B.set(ox + x, oy + y, u === 0 || v === 3 ? St[2] : v === 0 || u === 1 ? St[5] : ART.hash(Math.floor((x0t + tx) * 2 + (x + (row % 2) * 4) / 8), (y0t + ty) * 4 + row, 3) < 0.3 ? St[3] : St[4]); }
      else if (t === T.FIELD) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) B.set(ox + x, oy + y, y % 4 === 3 ? D[1] : y % 4 === 0 ? D[4] : D[2]);
      else if (t === T.BRIDGE) {
        const vert = MAP.getT(x0t + tx, y0t + ty - 1) === T.BRIDGE || MAP.getT(x0t + tx, y0t + ty + 1) === T.BRIDGE;
        const hz = MAP.getT(x0t + tx - 1, y0t + ty) === T.BRIDGE || MAP.getT(x0t + tx + 1, y0t + ty) === T.BRIDGE;
        const across = hz || !vert; // 가로 다리면 널빤지가 세로로
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (across ? x : y) % 4; B.set(ox + x, oy + y, k === 3 ? Wd[2] : k === 0 ? Wd[6] : Wd[5]); }
        if (across) { for (let x = 0; x < TS; x++) { B.set(ox + x, oy, Wd[1]); B.set(ox + x, oy + 1, Wd[3]); B.set(ox + x, oy + TS - 2, Wd[3]); B.set(ox + x, oy + TS - 1, Wd[1]); } }
        else for (let y = 0; y < TS; y++) { B.set(ox, oy + y, Wd[1]); B.set(ox + 1, oy + y, Wd[3]); B.set(ox + TS - 2, oy + y, Wd[3]); B.set(ox + TS - 1, oy + y, Wd[1]); }
      }
    }
    const c = document.createElement("canvas"); c.width = CPX; c.height = CPX;
    const full = toCanvas(B);
    c.getContext("2d").drawImage(full, MARG * TS, MARG * TS, CPX, CPX, 0, 0, CPX, CPX);
    c._water = hasWater;
    return c;
  }
  // 소품 그림 (위치마다 씨앗이 달라 모양이 조금씩 다르다)
  const SPR = new Map();
  function sprite(key, make) { let s = SPR.get(key); if (!s) { const r = make(); s = { c: toCanvas(r.buf), ax: r.ax, ay: r.ay, sh: r.shadow }; SPR.set(key, s); } return s; }
  function propSprite(o, seed, season, ready) {
    switch (o) {
      case O.OAK: case O.APPLE: { const kind = o === O.APPLE && ready && (season === "여름" || season === "가을") ? "apple" : season === "가을" ? "autumn" : "oak"; return sprite(`t${kind}${seed}${season}`, () => ART.tree(seed, kind, LEAF_S[season] && kind !== "apple" ? LEAF_S[season] : undefined)); }
      case O.PINE: return sprite(`p${seed}${season}`, () => ART.pine(seed, PINE_S[season]));
      case O.BUSH: return sprite(`b${seed}${ready ? 1 : 0}${season}`, () => ART.bush(seed, ready, LEAF_S[season]));
      case O.ROCK: return sprite(`r${seed}`, () => ART.rock(seed));
      case O.STUMP: return sprite(`s${seed}`, () => ART.stump(seed));
    }
    return null;
  }
  // 건물: 종류별 기본 재질 + 목수 공사 결과
  const BKIND = {
    house: { wall: "plank", roof: "red", shutters: "green", box: true, chimney: true },
    inn: { wall: "plaster", roof: "red", chimney: true, gableWindow: true },
    tavern: { wall: "plaster", roof: "teal", sign: "mug", chimney: true, gableWindow: true, braces: true },
    forge: { wall: "stone", roof: "slate", sign: "anvil", chimney: true },
    temple: { wall: "plaster", roof: "blue", gableWindow: true, doorW: 14 },
    guild: { wall: "log", roof: "green", gableWindow: true },
    market: { wall: "plank", roof: "gold", sign: "bread" },
  };
  function buildingSprite(w, bd, sty) {
    const K = BKIND[bd.kind] || BKIND.house, roof = sty.roofKey && ART.MAT[sty.roofKey] ? sty.roofKey : K.roof, wall = sty.wallKey && ART.MAT[sty.wallKey] ? sty.wallKey : K.wall;
    const doorX = (bd.door[0] - bd.x) * TS + 2, snow = w.season === "겨울", key = `${bd.kind}|${bd.w}|${bd.h}|${doorX}|${roof}|${wall}|${snow ? 1 : 0}`;
    return sprite(key, () => {
      const Wp = bd.w * TS, wallH = Math.min(40, Math.max(30, bd.h * TS - 14)), gableH = Math.round(Math.min(26, Math.max(12, Wp * 0.2))), depth = Math.max(12, bd.h * TS + 24 - wallH - gableH - 7);
      const windows = [];
      for (let x = 5; x + 10 <= Wp - 4; x += 22) if (Math.abs(x + 5 - (doorX + 6)) > 15) windows.push({ x, y: 7, w: 10, shutters: K.shutters, box: K.box });
      const o = { w: bd.w, wall, roof, wallH, gableH, roofDepth: depth, door: { x: doorX - (K.doorW ? 1 : 0), w: K.doorW || 12, window: bd.kind === "house" }, windows, chimney: K.chimney ? { at: 0.5 } : null, gableWindow: K.gableWindow, sign: K.sign ? { icon: ART.SIGN[K.sign] } : null, snow };
      if (K.braces && wall === "plaster") { o.posts = []; o.braces = [[3, Math.min(20, Wp / 3)], [Wp - 3, Wp - Math.min(20, Wp / 3)]]; }
      const r = ART.building(o);
      return { buf: r.buf, ax: 4, ay: r.ay, shadow: { wallH, h: r.h } };
    });
  }
  // 인물: 종족·직업 정의 → 조각 조합
  const HAT16 = { straw: "straw", chef: "chef", cap: "cap", helmet: "helmet", bandana: "bandana", witch: "wizard", hood: "hood", veil: "crown", circlet: "crown" };
  const PROP16 = { blacksmith: "hammer", builder: "hammer", guard: "sword", mercenary: "sword", adventurer: "sword", alchemist: "staff", priest: "book", doctor: "book", baker: "basket", cook: "basket" };
  const STYLE16 = { short: "short", long: "long", pony: "long", bun: "bun", spiky: "short", bob: "short", curly: "short" };
  function look16(n, L) {
    const job = A.JOBS[n.job] || {}, jl = job.look || {}, hat = L.hat ? HAT16[L.hat] : null;
    const robe = L.hat === "witch" || L.hat === "hood" || L.hat === "veil";
    return {
      skin: ramp3(L.skin), hair: [shade(L.hair, -0.38), L.hair, shade(L.hair, 0.22)], hairStyle: STYLE16[L.style] || "short", eye: L.eye,
      shirt: ramp3(L.cloth), pants: ramp3(L.pants), top: robe ? "robe" : (hash(n.id, 5, 9) < 0.5 ? "shirt" : "tunic"),
      over: L.apron ? "apron" : null, apron: L.apron ? ramp3(L.apron) : null,
      bottom: !robe && !L.kid && hash(n.id, 6, 9) < 0.3 ? "skirt" : "pants",
      hat, hatPal: hat && ["cap", "bandana", "wizard", "hood", "beanie"].includes(hat) ? ramp3(L.cloth) : null,
      prop: L.kid ? null : PROP16[n.job] || (job.fighter ? "sword" : null),
      ears: L.ears, horns: !!L.horns, tail: !!L.tail, beard: !!L.beard,
    };
  }
  const INK16 = ART ? ART.INK : "#26180f";
  /* 가구 색을 새 톤으로 (모양은 그대로) */
  const FMAP = ART ? {
    "#26180f": ART.INK, "#8a5a32": ART.RAMP.wood[3], "#a8743f": ART.RAMP.wood[4], "#b07a44": ART.RAMP.wood[4], "#d29a5c": ART.RAMP.wood[6], "#7a5230": ART.RAMP.wood[2],
    "#5a3a20": ART.RAMP.wood[1], "#9a6a3a": ART.RAMP.wood[4], "#b88050": ART.RAMP.wood[5], "#c99a62": ART.RAMP.wood[6], "#6a4428": ART.RAMP.wood[2], "#b88a50": ART.RAMP.wood[5],
    "#d0a868": ART.RAMP.wood[6], "#8a6030": ART.RAMP.wood[2], "#f4efe4": "#e8dcc6", "#c04a4a": "#a85a4a", "#d86a6a": "#c27660", "#e8c04a": "#d6bc66",
    "#6a6a72": ART.RAMP.stone[3], "#8a8a92": ART.RAMP.stone[5], "#4a4a52": ART.RAMP.stone[2], "#3a3a42": ART.RAMP.stone[1], "#7a7a82": ART.RAMP.stone[4], "#9aa0a8": ART.RAMP.stone[5],
    "#8a6a3a": ART.RAMP.wood[3], "#ece4d2": "#e2d6c0", "#e9d36a": "#d6bc66", "#f2e2b8": "#e8dcc0", "#2a2a3a": "#38404e", "#4f8a4a": ART.RAMP.leaf[3], "#6fae5a": ART.RAMP.leaf[5],
    "#e8c45a": "#d6bc66", "#c46a3a": "#a8643c", "#e08a5a": "#c27c54", "#3a8a3a": ART.RAMP.leaf[3], "#4fae4a": ART.RAMP.leaf[5], "#e57ab0": "#c48aa8", "#c9a24a": "#b8964a", "#a8823a": "#94763a",
  } : {};
  const PCACHE = new Map();
  function person16(n, L, dir, frame) {
    const key = L.key + "|" + dir + frame;
    let c = PCACHE.get(key);
    if (!c) { c = toCanvas(ART.personFrame(look16(n, L), dir, frame)); PCACHE.set(key, c); if (PCACHE.size > 3000) PCACHE.delete(PCACHE.keys().next().value); }
    return c;
  }
  const spriteCache = new Map();
  /** 걷는 인물 한 장. 16×28, 발끝이 (8, 27) */
  function personSprite(L, dir, frame) {
    const key = L.key + dir + frame;
    let c = spriteCache.get(key);
    if (c) return c;
    const view = dir === "down" ? "down" : dir === "up" ? "up" : "side", flip = dir === "left";
    c = pixelCanvas(20, 30, (R) => {
      const X = 4, sh = L.short ? 2 : 0;              // 키 작은 종족은 다리·몸이 짧다
      const footY = 28, legH = 4 - (L.short ? 1 : 0), bodyY = footY - legH - 7 + (L.short ? 1 : 0), headY = bodyY - 11 + 1;
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      // 꼬리
      if (L.tail && view !== "up") R(flip ? X + 12 : X - 2, bodyY + 3, 3, 2, L.hair); else if (L.tail) R(X + 5, bodyY + 4, 2, 4, L.hair);
      // 다리
      if (view === "side") { R(X + 4 + step, footY - legH, 3, legH, L.pants); R(X + 5 - step, footY - legH, 3, legH, shade(L.pants, -0.2)); R(X + 4 + step, footY - 1, 4, 1, "#3a2a20"); }
      else { R(X + 3, footY - legH - (step > 0 ? 1 : 0), 3, legH, L.pants); R(X + 7, footY - legH - (step < 0 ? 1 : 0), 3, legH, L.pants); R(X + 3, footY - 1 - (step > 0 ? 1 : 0), 3, 1, "#3a2a20"); R(X + 7, footY - 1 - (step < 0 ? 1 : 0), 3, 1, "#3a2a20"); }
      // 몸
      R(X + 2, bodyY, 9, 7, L.cloth); R(X + 9, bodyY, 2, 7, L.cloth2); R(X + 2, bodyY + 5, 9, 1, L.trim);
      if (L.apron && view !== "up") R(X + 3, bodyY + 1, 7, 6, L.apron);
      if (view === "down") { R(X + 5, bodyY, 3, 1, L.skin); }
      // 팔
      const arm = frame ? step : 0;
      if (view === "side") { R(X + 5 - arm, bodyY + 1, 3, 4, L.cloth2); R(X + 5 - arm, bodyY + 5, 3, 1, L.skin); }
      else { R(X, bodyY + 1 + arm, 2, 5, L.cloth2); R(X + 11, bodyY + 1 - arm, 2, 5, L.cloth2); R(X, bodyY + 5 + arm, 2, 1, L.skin); R(X + 11, bodyY + 5 - arm, 2, 1, L.skin); }
      // 머리
      paintHead(R, L, X + 1 - (view === "side" ? (flip ? -1 : 0) : 0), headY + sh * 0, 1, view, flip);
      if (L.hat) paintHat(R, L, X + 1, headY, 1, view, flip);
    });
    spriteCache.set(key, c);
    return c;
  }
  const portraitCache = new Map();
  /** 대화창·수첩용 초상화 (40×40 픽셀) */
  function portrait(n, isPlayer) {
    const L = lookOf(n, isPlayer);
    let c = portraitCache.get(L.key);
    if (c) return c;
    if (ART) { // 새 도트: 정면 그림에서 머리와 어깨를 잘라 두 배로
      const src = person16(n, L, "down", 0);
      c = document.createElement("canvas"); c.width = 40; c.height = 40;
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 7, 20, 20, 0, 0, 40, 40);
      portraitCache.set(L.key, c);
      return c;
    }
    c = pixelCanvas(40, 40, (R) => {
      const S = 2, ox = 8, oy = 9 - (L.hat === "chef" || L.hat === "witch" ? -3 : 0);
      // 어깨
      R(5, 34, 30, 6, L.cloth); R(27, 34, 8, 6, L.cloth2); R(5, 37, 30, 1, L.trim);
      if (L.apron) R(11, 35, 18, 5, L.apron);
      R(16, 33, 8, 3, shade(L.skin, -0.12));
      if (L.tail) R(31, 30, 4, 6, L.hair);
      paintHead(R, L, ox, oy, S, "down", false);
      if (L.hat) paintHat(R, L, ox, oy, S, "down", false);
    });
    portraitCache.set(L.key, c);
    return c;
  }

  class View {
    constructor(canvas, opts) {
      this.c = canvas; this.ctx = canvas.getContext("2d");
      this.buf = document.createElement("canvas"); this.b = this.buf.getContext("2d");
      this.opts = opts; this.cam = { x: 76, y: 62 }; this.t = 0; this.hover = null; this.swing = 0; this.hurt = 0;
      this.flakes = Array.from({ length: 90 }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), s: 0.4 + hash(i, 3) * 0.8 }));
      this.ents = [];
      this.bind();
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      this.cw = Math.max(200, r.width); this.ch = Math.max(200, r.height); this.dpr = dpr;
      this.c.width = Math.round(this.cw * dpr); this.c.height = Math.round(this.ch * dpr);
      this.px = this.zoomPx || (this.cw < 600 ? 2 : 3);
      this.buf.width = Math.ceil(this.cw / this.px); this.buf.height = Math.ceil(this.ch / this.px);
    }
    zoom(d) { this.zoomPx = Math.max(2, Math.min(5, (this.zoomPx || this.px) + d)); this.resize(); }
    toBuf(x, y) { return [Math.round((x - this.cam.x) * TS + this.buf.width / 2), Math.round((y - this.cam.y) * TS + this.buf.height / 2)]; }
    toWorld(sx, sy) { return [(sx / this.px - this.buf.width / 2) / TS + this.cam.x, (sy / this.px - this.buf.height / 2) / TS + this.cam.y]; }
    bind() {
      let drag = null;
      this.c.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cam: { ...this.cam }, moved: false, btn: e.button }; this.c.setPointerCapture(e.pointerId); });
      this.c.addEventListener("pointermove", (e) => {
        const r = this.c.getBoundingClientRect();
        this.mouse = [e.clientX - r.left, e.clientY - r.top];
        this.hover = this.pick(...this.mouse);
        if (!drag) return;
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
        if (drag.moved && !this.opts.hasPlayer()) { this.cam.x = drag.cam.x - (e.clientX - drag.x) / this.px / TS; this.cam.y = drag.cam.y - (e.clientY - drag.y) / this.px / TS; }
      });
      this.c.addEventListener("pointerup", (e) => {
        const d = drag; drag = null;
        if (d && d.moved) return;
        const r = this.c.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        const [wx, wy] = this.toWorld(sx, sy);
        this.opts.onClick({ wx, wy, tx: Math.floor(wx), ty: Math.floor(wy), hit: this.pick(sx, sy), right: d && d.btn === 2 });
      });
      this.c.addEventListener("contextmenu", (e) => e.preventDefault());
      this.c.addEventListener("pointerleave", () => { this.hover = null; this.mouse = null; });
      this.c.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    }
    pick(sx, sy) {
      const bx = sx / this.px, by = sy / this.px;
      for (let i = this.ents.length - 1; i >= 0; i--) { const s = this.ents[i]; if (bx >= s.x - 8 && bx <= s.x + 8 && by >= s.y - 27 && by <= s.y + 2) return s; }
      const [wx, wy] = this.toWorld(sx, sy);
      const bi = G.MAP.inb(Math.floor(wx), Math.floor(wy)) ? G.MAP.solid[G.MAP.I(Math.floor(wx), Math.floor(wy))] : -1;
      if (bi >= 0) return { building: MAP.buildings[bi] };
      return null;
    }

    // ================================================================ 그리기
    draw(w, state) {
      const b = this.b, W = this.buf.width, H = this.buf.height, pal = SEASON[w.season];
      this.t += state.dt;
      if (w.ppos && state.follow && !this.peek) { this.cam.x += (w.ppos.x - this.cam.x) * Math.min(1, state.dt * 8); this.cam.y += (w.ppos.y - 0.3 - this.cam.y) * Math.min(1, state.dt * 8); }
      const halfW = W / 2 / TS, halfH = H / 2 / TS;
      this.cam.x = Math.max(halfW, Math.min(MW - halfW, this.cam.x));
      this.cam.y = Math.max(halfH, Math.min(MH - halfH, this.cam.y));
      b.imageSmoothingEnabled = false;
      b.fillStyle = C.deep; b.fillRect(0, 0, W, H);
      const x0 = Math.max(0, Math.floor(this.cam.x - halfW) - 1), x1 = Math.min(MW - 1, Math.ceil(this.cam.x + halfW) + 1);
      const y0 = Math.max(0, Math.floor(this.cam.y - halfH) - 1), y1 = Math.min(MH - 1, Math.ceil(this.cam.y + halfH) + 3);
      const e = G.ext(w);
      if (ART) this.groundChunks(b, w, x0, x1, y0, y1, e);
      else for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.ground(b, w, x, y, pal, e);
      // 깊이순으로 세울 것들
      const items = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = G.objAt(w, x, y);
        if (o) items.push({ d: y + 0.9, f: () => this.object(b, w, x, y, o, pal) });
      }
      for (const [key, f] of Object.entries(e.farm)) {
        if (!f.crop) continue;
        const [fx, fy] = key.split(",").map(Number);
        if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
        items.push({ d: fy + 0.7, f: () => this.crop(b, w, fx, fy, f) });
      }
      const inBd = state.showPlayer ? G.insideBuilding(w) : null;
      for (const bd of MAP.buildings) if (bd.x + bd.w >= x0 && bd.x <= x1 && bd.y + bd.h >= y0 && bd.y - 2 <= y1) {
        if (bd === inBd) { // 안에 들어온 건물: 지붕을 걷고 속을 보여 준다
          items.push({ d: -1e9, f: () => this.interior(b, w, bd) });
          items.push({ d: bd.y + 0.02, f: () => this.interior(b, w, bd, true) });
          for (const f of G.furnitureIn(w, bd)) items.push({ d: f.block ? bd.y + f.ry + 0.8 : -1e8, f: () => this.furniture(b, bd.x + f.rx, bd.y + f.ry, f.type) });
          items.push({ d: bd.y + bd.h + 0.01, f: () => this.frontWall(b, bd, w) });
        } else items.push({ d: bd.y + bd.h - 0.05, f: () => this.building(b, w, bd) });
      }
      this.ents = [];
      const marks = state.marks || new Set();
      for (const { n, k } of G.visibleNPCs(w)) {
        if (k.x < x0 - 1 || k.x > x1 + 1 || k.y < y0 - 1 || k.y > y1 + 2) continue;
        const [sx, sy] = this.toBuf(k.x, k.y);
        const ent = { x: sx, y: sy, npc: n.id, n, k, mark: marks.has(n.id) };
        this.ents.push(ent);
        items.push({ d: k.y, f: () => this.person(b, n, sx, sy, k.dir, k.path && k.path.length || k.chase || k.fight || k.flee > 0, false) });
      }
      for (const a of G.animals) {
        if (a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 2) continue;
        const [sx, sy] = this.toBuf(a.x, a.y);
        this.ents.push({ x: sx, y: sy, animal: a });
        items.push({ d: a.y, f: () => this.animal(b, a, sx, sy) });
      }
      const p = w.player;
      if (p && p.alive && w.ppos && state.showPlayer) {
        const [sx, sy] = this.toBuf(w.ppos.x, w.ppos.y);
        this.playerBuf = [sx, sy];
        items.push({ d: w.ppos.y, f: () => this.person(b, p, sx, sy, e.facing, state.walking, true, state) });
      } else this.playerBuf = null;
      items.sort((a, c) => a.d - c.d);
      for (const it of items) it.f();
      for (const pr of G.projectiles) {
        const k = Math.min(1, pr.t / pr.dur), x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * 0.6;
        const [px, py] = this.toBuf(x, y);
        if (k < 1) { b.fillStyle = "#26180f"; b.fillRect(px - 2, py - 2, 4, 4); b.fillStyle = "#b8bcc4"; b.fillRect(px - 1, py - 1, 2, 2); }
        else { b.fillStyle = "rgba(255,255,255,0.7)"; b.fillRect(px - 3, py, 2, 1); b.fillRect(px + 2, py - 1, 2, 1); b.fillRect(px, py - 3, 1, 2); }
      }
      this.ents.sort((a, c) => a.y - c.y);
      // 건물 안에 있으면 바깥을 어둡게
      if (inBd) {
        const [sx, sy] = this.toBuf(inBd.x, inBd.y), Wd = inBd.w * TS, Hd = inBd.h * TS, top = sy - 10;
        b.fillStyle = "rgba(8,10,24,0.58)";
        b.fillRect(0, 0, W, Math.max(0, top)); b.fillRect(0, sy + Hd + 2, W, H); b.fillRect(0, top, Math.max(0, sx - 2), Hd + 12); b.fillRect(sx + Wd + 2, top, W, Hd + 12);
      }
      // 목표 타일 표시
      if (state.target && w.ppos) { const [sx, sy] = this.toBuf(state.target[0], state.target[1]); b.strokeStyle = "rgba(255,240,150,0.9)"; b.lineWidth = 1; b.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1); }
      // 밤
      const h = 6 + w.clock / 60;
      const dark = h < 18 ? 0 : h < 20 ? (h - 18) * 0.15 : h < 24 ? 0.3 + (h - 20) * 0.06 : h < 28 ? 0.54 : h < 30 ? 0.54 - (h - 28) * 0.22 : 0.1;
      if (dark > 0) {
        b.fillStyle = `rgba(16,24,70,${dark})`; b.fillRect(0, 0, W, H);
        b.globalCompositeOperation = "lighter";
        for (const bd of MAP.buildings) {
          if (bd.x + bd.w < x0 || bd.x > x1 || bd.y + bd.h < y0 || bd.y > y1) continue;
          if (bd.kind === "house" && hash(bd.x, bd.y, w.day) > 0.6 && h > 23) continue;
          const [sx, sy] = this.toBuf(bd.x + bd.w / 2, bd.y + bd.h - 0.6);
          const r = bd.kind === "tavern" ? 34 : 18;
          const g = b.createRadialGradient(sx, sy, 1, sx, sy, r);
          g.addColorStop(0, `rgba(255,190,90,${0.5 * dark / 0.54})`); g.addColorStop(1, "rgba(255,190,90,0)");
          b.fillStyle = g; b.fillRect(sx - r, sy - r, r * 2, r * 2);
        }
        if (this.playerBuf) { const [sx, sy] = this.playerBuf; const g = b.createRadialGradient(sx, sy - 6, 1, sx, sy - 6, 40); g.addColorStop(0, `rgba(255,220,150,${0.25 * dark / 0.54})`); g.addColorStop(1, "rgba(255,220,150,0)"); b.fillStyle = g; b.fillRect(sx - 40, sy - 46, 80, 80); }
        b.globalCompositeOperation = "source-over";
      }
      if (w.day < w.droughtUntil) { b.fillStyle = "rgba(240,170,60,0.08)"; b.fillRect(0, 0, W, H); }
      if (w.season === "겨울") {
        b.fillStyle = "rgba(255,255,255,0.9)";
        for (const f of this.flakes) { const fx = ((f.x * W + Math.sin(this.t * f.s + f.y * 9) * 10) % W + W) % W, fy = ((f.y * H + this.t * 20 * f.s) % H + H) % H; b.fillRect(Math.round(fx), Math.round(fy), 1, 1); }
      }
      if (this.hurt > 0) { this.hurt -= state.dt; b.fillStyle = `rgba(200,30,30,${Math.max(0, this.hurt) * 0.6})`; b.fillRect(0, 0, W, H); }
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, 0, 0, W * this.px * this.dpr, H * this.px * this.dpr);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.overlay(ctx, w, state);
    }

    groundChunks(b, w, x0, x1, y0, y1, e) {
      if (!this.gcache || this.gver !== MAP.ver) { this.gcache = new Map(); this.gver = MAP.ver; }
      const ph = Math.floor(this.t * 1.6) % 2;
      for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) {
        const k0 = `${cx},${cy},${w.season}`;
        let c0 = this.gcache.get(k0 + ",0");
        if (!c0) { c0 = paintChunk(w, cx, cy, 0); this.gcache.set(k0 + ",0", c0); if (this.gcache.size > 400) this.gcache.delete(this.gcache.keys().next().value); }
        let c = c0;
        if (c0._water && ph) { c = this.gcache.get(k0 + ",1"); if (!c) { c = paintChunk(w, cx, cy, 1); this.gcache.set(k0 + ",1", c); } }
        const [sx, sy] = this.toBuf(cx * CH, cy * CH);
        b.drawImage(c, sx, sy);
      }
      // 밭은 매일 바뀌므로 따로 얹는다
      const D = ART.RAMP.dirt;
      for (const [key, f] of Object.entries(e.farm)) {
        const [fx, fy] = key.split(",").map(Number);
        if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
        const [sx, sy] = this.toBuf(fx, fy), wet = f.watered === w.day;
        b.fillStyle = wet ? "#4e3a2c" : D[1]; b.fillRect(sx + 1, sy + 1, TS - 2, TS - 2);
        b.fillStyle = wet ? "#6a4e38" : D[2]; for (let k = 2; k < TS - 1; k += 4) b.fillRect(sx + 1, sy + k, TS - 2, 2);
        b.fillStyle = wet ? "#3a2a20" : D[0]; b.fillRect(sx + 1, sy + TS - 2, TS - 2, 1);
      }
    }
    ground(b, w, x, y, pal, e) {
      const t = MAP.tile[MAP.I(x, y)], [sx, sy] = this.toBuf(x, y), v = hash(x, y);
      const fill = (c) => { b.fillStyle = c; b.fillRect(sx, sy, TS, TS); };
      const dot = (c, dx, dy, ww = 1, hh = 1) => { b.fillStyle = c; b.fillRect(sx + dx, sy + dy, ww, hh); };
      switch (t) {
        case T.GRASS: case T.FLOOR: {
          fill(t === T.FLOOR ? pal.floor[v < 0.5 ? 0 : 1] : pal.g[Math.floor(v * 3)]);
          for (let k = 0; k < 3; k++) { const a = hash(x, y, k + 3); dot(pal.g2, Math.floor(a * 14), Math.floor(hash(x, y, k + 9) * 14), 1, 2); }
          if (pal.blossom && v > 0.93) dot(pal.blossom, 7, 7, 2, 2);
          break;
        }
        case T.DIRT: fill(C.dirt[Math.floor(v * 3)]); dot("#b38a55", Math.floor(v * 12), Math.floor(hash(x, y, 4) * 12), 2, 1); break;
        case T.SAND: fill(C.sand[Math.floor(v * 3)]); dot("#d4bd7f", Math.floor(v * 13), Math.floor(hash(x, y, 5) * 13)); break;
        case T.PAVE: fill(C.pave[(x + y) & 1]); b.fillStyle = C.paveL; b.fillRect(sx, sy, TS, 1); b.fillRect(sx, sy, 1, TS); break;
        case T.WASTE: fill(C.waste[v < 0.5 ? 0 : 1]); if (v > 0.85 && w.war.active) dot("#c2452e", 6, 8, 2, 1); break;
        case T.FIELD: fill(C.field); dot("#7a5230", 0, 5, TS, 1); dot("#7a5230", 0, 11, TS, 1); break;
        case T.BRIDGE: fill(C.bridge); for (let k = 0; k < TS; k += 4) dot(C.bridge2, 0, k, TS, 1); break;
        case T.WATER: case T.DEEP: {
          fill(t === T.DEEP ? C.deep : C.water);
          const ph = Math.floor(this.t * 2 + v * 8) % 8;
          dot(C.water2, ph * 2, 4 + Math.floor(v * 6), 4, 1);
          const up = MAP.getT(x, y - 1);
          if (up !== T.WATER && up !== T.DEEP && up !== T.BRIDGE) { dot(C.foam, 0, 0, TS, 1); if ((Math.floor(this.t * 3) + x) % 3 === 0) dot(C.foam, 3, 1, 5, 1); }
          break;
        }
        case T.CLIFF: {
          const below = MAP.getT(x, y + 1);
          fill(v < 0.5 ? C.cliffTop : C.cliffTop2);
          dot("#b89a70", Math.floor(v * 10), 3, 4, 1); dot("#8a7150", Math.floor(hash(x, y, 2) * 10), 9, 3, 1);
          if (below !== T.CLIFF) { b.fillStyle = C.cliffFace; b.fillRect(sx, sy + 7, TS, 9); b.fillStyle = C.cliffFace2; b.fillRect(sx + 2 + Math.floor(v * 6), sy + 9, 3, 6); b.fillRect(sx + 9, sy + 8, 2, 7); b.fillStyle = C.cliffLine; b.fillRect(sx, sy + 7, TS, 1); }
          break;
        }
      }
      // 밭
      const f = e.farm[x + "," + y];
      if (f) {
        b.fillStyle = f.watered === w.day ? C.wet : C.tilled; b.fillRect(sx + 1, sy + 1, TS - 2, TS - 2);
        b.fillStyle = "rgba(0,0,0,0.18)"; for (let k = 3; k < TS; k += 4) b.fillRect(sx + 1, sy + k, TS - 2, 1);
      }
    }
    object(b, w, x, y, o, pal) {
      const [sx, sy] = this.toBuf(x, y), cx = sx + 8, by = sy + 14, v = hash(x, y);
      const sh = (r) => { b.fillStyle = C.shadow; b.beginPath(); b.ellipse(cx, by, r, r * 0.35, 0, 0, Math.PI * 2); b.fill(); };
      const blob = (c, ox, oy, r) => { b.fillStyle = c; b.beginPath(); b.arc(cx + ox, by + oy, r, 0, Math.PI * 2); b.fill(); };
      const ready = G.forageReady(w, x, y);
      if (ART && (o === O.OAK || o === O.APPLE || o === O.PINE || o === O.BUSH || o === O.ROCK || o === O.STUMP)) {
        const s = propSprite(o, 1 + Math.floor(v * 5), w.season, o === O.BUSH ? G.berryReady(w, x, y) : ready);
        if (s.sh) { b.fillStyle = C.shadow; b.beginPath(); b.ellipse(cx, by + 1, s.sh.rx, s.sh.ry + 0.5, 0, 0, Math.PI * 2); b.fill(); }
        b.drawImage(s.c, cx - s.ax, by + 1 - s.ay);
        return;
      }
      const SP = root.Spr16;
      if (SP && [O.HERB, O.SHROOM, O.FLOWER, O.TENT, O.SIGN, O.RUIN, O.MOUND].includes(o)) {
        let s = null;
        if (o === O.HERB) s = SP.obj(ready ? "herb" : "herbSmall");
        else if (o === O.SHROOM) { if (!ready) return; s = SP.obj("shroom"); }
        else if (o === O.FLOWER) { if (w.season === "겨울" || !ready) return; s = SP.obj("flower", Math.floor(v * 4)); }
        else s = SP.obj({ [O.TENT]: "tent", [O.SIGN]: "sign", [O.RUIN]: "ruin", [O.MOUND]: "mound" }[o]);
        if (o === O.TENT || o === O.RUIN) { b.fillStyle = C.shadow; b.beginPath(); b.ellipse(cx, by + 1, 9, 2.5, 0, 0, Math.PI * 2); b.fill(); }
        b.drawImage(s.c, cx - s.ax, by + 1 - s.ay);
        if (o === O.RUIN) { const lt = G.ext(w).looted || {}; if (lt[MAP.I(x, y)] === undefined && Math.floor(this.t * 2 + x) % 4 === 0) { b.fillStyle = "#fff6b0"; b.fillRect(cx + 4, by - 13, 1, 1); b.fillRect(cx + 3, by - 12, 3, 1); b.fillRect(cx + 4, by - 11, 1, 1); } }
        if (o === O.MOUND && Math.floor(this.t * 2 + y) % 3 === 0) { b.fillStyle = "#fff6b0"; b.fillRect(cx + 2, by - 7, 1, 1); }
        return;
      }
      if (ART && o === O.FENCE) {
        const Wd = ART.RAMP.wood, R = (ox, oy, w2, h2, c) => { b.fillStyle = c; b.fillRect(sx + ox, by + oy, w2, h2); };
        R(0, -10, TS, 3, "#2a2226"); R(0, -5, TS, 3, "#2a2226"); R(0, -9, TS, 1, Wd[5]); R(0, -4, TS, 1, Wd[5]);
        R(6, -13, 4, 14, "#2a2226"); R(7, -12, 2, 12, Wd[3]); R(7, -12, 1, 12, Wd[5]);
        return;
      }
      switch (o) {
        case O.OAK: case O.APPLE: {
          sh(8); b.fillStyle = C.trunk; b.fillRect(cx - 2, by - 9, 4, 9);
          const lc = pal.leaf[Math.floor(v * 3)];
          blob(pal.leaf[2], 0, -15, 10); blob(lc, -4, -17, 7); blob(lc, 4, -18, 7); blob(lc, 0, -22, 7);
          b.fillStyle = "rgba(255,255,255,0.18)"; b.fillRect(cx - 4, by - 24, 4, 3);
          if (w.season === "겨울") { b.fillStyle = "#f2f6f8"; b.fillRect(cx - 6, by - 28, 12, 3); }
          if (o === O.APPLE && ready) { b.fillStyle = "#d8352a"; for (const [ox, oy] of [[-5, -15], [3, -20], [6, -13], [-1, -24], [-6, -21]]) b.fillRect(cx + ox, by + oy, 2, 2); }
          if (o === O.APPLE && pal.blossom) { b.fillStyle = pal.blossom; for (const [ox, oy] of [[-4, -19], [4, -16], [0, -25]]) b.fillRect(cx + ox, by + oy, 2, 2); }
          break;
        }
        case O.PINE: {
          sh(7); b.fillStyle = C.trunk; b.fillRect(cx - 1, by - 6, 3, 6);
          const lc = w.season === "가을" ? "#3d6b3a" : pal.leaf[2];
          for (let k = 0; k < 3; k++) { b.fillStyle = k % 2 ? lc : "#2c5e33"; b.beginPath(); b.moveTo(cx - 9 + k * 2, by - 5 - k * 7); b.lineTo(cx + 1, by - 18 - k * 7); b.lineTo(cx + 10 - k * 2, by - 5 - k * 7); b.closePath(); b.fill(); }
          if (w.season === "겨울") { b.fillStyle = "#f2f6f8"; b.fillRect(cx - 2, by - 30, 5, 3); b.fillRect(cx - 6, by - 17, 4, 1); }
          break;
        }
        case O.BUSH: sh(6); blob("#3b7d3a", 0, -5, 7); blob("#4b9145", -3, -7, 4); if (G.berryReady(w, x, y)) { b.fillStyle = "#b02a5a"; for (const [ox, oy] of [[-3, -6], [2, -8], [4, -3], [-1, -2]]) b.fillRect(cx + ox, by + oy, 2, 2); } break;
        case O.ROCK: sh(6); blob(C.stoneD, 0, -3, 6); blob(C.stone, -1, -5, 5); b.fillStyle = "#c2c6cc"; b.fillRect(cx - 3, by - 8, 3, 2); break;
        case O.HERB: if (ready) { b.fillStyle = "#2f8a4a"; b.fillRect(cx - 1, by - 7, 2, 7); b.fillStyle = "#7fd08a"; b.fillRect(cx - 4, by - 6, 3, 2); b.fillRect(cx + 1, by - 8, 3, 2); b.fillRect(cx - 2, by - 10, 3, 2); } else { b.fillStyle = "#4f8a4a"; b.fillRect(cx - 1, by - 2, 2, 2); } break;
        case O.SHROOM: if (ready) { b.fillStyle = "#f1e6d0"; b.fillRect(cx - 1, by - 4, 2, 4); b.fillRect(cx + 4, by - 3, 2, 3); b.fillStyle = "#c8382d"; b.fillRect(cx - 3, by - 6, 6, 2); b.fillRect(cx + 3, by - 5, 4, 2); b.fillStyle = "#fff"; b.fillRect(cx - 2, by - 6, 1, 1); } break;
        case O.FLOWER: if (w.season !== "겨울" && ready) { const fc = ["#f2d14a", "#f0f0f0", "#e57ab0", "#9ab4f0"][Math.floor(v * 4)]; b.fillStyle = "#3f8a3a"; b.fillRect(cx - 4, by - 3, 1, 3); b.fillRect(cx + 2, by - 4, 1, 4); b.fillStyle = fc; b.fillRect(cx - 5, by - 5, 3, 2); b.fillRect(cx + 1, by - 6, 3, 2); } break;
        case O.FENCE: { b.fillStyle = C.fenceD; b.fillRect(sx + 2, by - 10, 2, 10); b.fillRect(sx + 12, by - 10, 2, 10); b.fillStyle = C.fence; b.fillRect(sx, by - 8, TS, 2); b.fillRect(sx, by - 4, TS, 2); break; }
        case O.STUMP: b.fillStyle = C.trunk; b.fillRect(cx - 3, by - 4, 6, 4); b.fillStyle = "#c9a26b"; b.fillRect(cx - 3, by - 5, 6, 2); break;
        case O.TENT: sh(9); b.fillStyle = "#b9a77c"; b.beginPath(); b.moveTo(cx - 10, by); b.lineTo(cx, by - 14); b.lineTo(cx + 10, by); b.closePath(); b.fill(); b.fillStyle = "#6b5a3a"; b.fillRect(cx - 2, by - 6, 4, 6); break;
        case O.RUIN: { sh(8); b.fillStyle = "#26180f"; b.fillRect(cx - 8, by - 15, 7, 16); b.fillRect(cx + 1, by - 10, 7, 11);
          b.fillStyle = "#9aa0a0"; b.fillRect(cx - 7, by - 14, 5, 14); b.fillRect(cx + 2, by - 9, 5, 9); b.fillStyle = "#c2c8c8"; b.fillRect(cx - 7, by - 14, 5, 2); b.fillRect(cx + 2, by - 9, 5, 2);
          b.fillStyle = "#5a8a4a"; b.fillRect(cx - 7, by - 5, 3, 2); b.fillRect(cx + 4, by - 3, 3, 2); b.fillStyle = "#6a7070"; b.fillRect(cx - 6, by - 10, 3, 1); b.fillRect(cx - 5, by - 8, 1, 3);
          const lt = G.ext(w).looted || {}; if (lt[MAP.I(x, y)] === undefined && Math.floor(this.t * 2 + x) % 4 === 0) { b.fillStyle = "#fff6b0"; b.fillRect(cx + 4, by - 13, 1, 1); } break; }
        case O.MOUND: { b.fillStyle = "#26180f"; b.fillRect(cx - 7, by - 5, 14, 6); b.fillStyle = "#8a6038"; b.fillRect(cx - 6, by - 4, 12, 4); b.fillStyle = "#a87a48"; b.fillRect(cx - 4, by - 5, 8, 2);
          if (Math.floor(this.t * 2 + y) % 3 === 0) { b.fillStyle = "#fff6b0"; b.fillRect(cx + 2, by - 7, 1, 1); } break; }
        case O.SIGN: b.fillStyle = C.fenceD; b.fillRect(cx - 1, by - 8, 2, 8); b.fillStyle = C.fence; b.fillRect(cx - 6, by - 14, 12, 7); b.fillStyle = "#5a3d1e"; b.fillRect(cx - 4, by - 12, 8, 1); b.fillRect(cx - 4, by - 10, 6, 1); break;
      }
      // 작물
    }
    crop(b, w, x, y, f) {
      const [sx, sy] = this.toBuf(x, y), c = G.CROPS[f.crop.type], cx = sx + 8, by = sy + 13;
      const st = f.crop.dead ? -1 : Math.min(3, Math.floor((f.crop.g / c.days) * 3 + (f.crop.g >= c.days ? 1 : 0)));
      if (root.Spr16) {
        const s = root.Spr16.crop(f.crop.type, st);
        b.drawImage(s.c, cx - s.ax, by + 2 - s.ay);
        if (st === 3 && Math.floor(this.t * 2) % 2) { b.fillStyle = "rgba(255,255,220,0.95)"; b.fillRect(cx + 5, by - 12, 1, 1); }
        return;
      }
      if (st < 0) { b.fillStyle = "#7a6a40"; b.fillRect(cx - 3, by - 4, 6, 4); return; }
      const leaf = "#4f9d3a", dark = "#3a7a2a";
      if (st === 0) { b.fillStyle = leaf; b.fillRect(cx - 1, by - 3, 1, 3); b.fillRect(cx + 1, by - 4, 1, 4); return; }
      if (st === 1) { b.fillStyle = dark; b.fillRect(cx, by - 7, 1, 7); b.fillStyle = leaf; b.fillRect(cx - 3, by - 6, 3, 2); b.fillRect(cx + 1, by - 8, 3, 2); return; }
      if (st === 2) { b.fillStyle = dark; b.fillRect(cx, by - 10, 1, 10); b.fillStyle = leaf; b.fillRect(cx - 4, by - 8, 4, 3); b.fillRect(cx + 1, by - 11, 4, 3); b.fillRect(cx - 3, by - 4, 3, 2); return; }
      const col = { turnip: "#f0f0f0", potato: "#c9a06a", wheat: "#e8c45a", strawberry: "#e0303a", pumpkin: "#e8862a" }[f.crop.type];
      if (f.crop.type === "wheat") { b.fillStyle = "#c9a53a"; for (let k = -4; k <= 4; k += 2) b.fillRect(cx + k, by - 12, 1, 12); b.fillStyle = col; for (let k = -4; k <= 4; k += 2) b.fillRect(cx + k - 1, by - 14, 2, 4); return; }
      b.fillStyle = leaf; b.fillRect(cx - 5, by - 9, 4, 4); b.fillRect(cx + 1, by - 10, 4, 4); b.fillRect(cx - 2, by - 12, 4, 4);
      b.fillStyle = col;
      if (f.crop.type === "pumpkin") { b.fillRect(cx - 4, by - 5, 8, 5); b.fillStyle = "#c46a1a"; b.fillRect(cx - 1, by - 5, 1, 5); }
      else if (f.crop.type === "strawberry") { for (const [ox, oy] of [[-4, -4], [2, -6], [-1, -3], [4, -3]]) b.fillRect(cx + ox, by + oy, 2, 2); }
      else b.fillRect(cx - 3, by - 4, 6, 4);
      if (Math.floor(this.t * 2) % 2) { b.fillStyle = "rgba(255,255,200,0.9)"; b.fillRect(cx + 4, by - 13, 1, 1); }
    }
    building(b, w, bd) {
      if (ART) return this.building16(b, w, bd);
      const [sx, sy] = this.toBuf(bd.x, bd.y), W = bd.w * TS, H = bd.h * TS;
      const sty = G.styleOf(w, bd);
      const [r1, r2] = sty.roof || ROOF[bd.kind] || ROOF.house, wall = sty.wall || WALL[bd.kind] || WALL.house;
      const wallH = Math.min(18, Math.floor(H * 0.45)), roofBottom = sy + H - wallH;
      b.fillStyle = C.shadow; b.fillRect(sx + 3, sy + H - 2, W, 4);
      // 벽
      b.fillStyle = wall; b.fillRect(sx, roofBottom, W, wallH);
      b.fillStyle = "rgba(0,0,0,0.12)"; b.fillRect(sx, roofBottom, W, 2);
      for (let k = 0; k < W; k += 8) { b.fillStyle = "rgba(0,0,0,0.06)"; b.fillRect(sx + k, roofBottom + 2, 1, wallH - 2); }
      // 문
      const dx = (bd.door[0] - bd.x) * TS + 4;
      b.fillStyle = "#4a3020"; b.fillRect(sx + dx, sy + H - 12, 8, 12); b.fillStyle = "#e0b04a"; b.fillRect(sx + dx + 6, sy + H - 6, 1, 1);
      // 창
      b.fillStyle = "#f4dd8c";
      for (let k = 6; k < W - 6; k += 16) if (Math.abs(sx + k - (sx + dx)) > 9) { b.fillRect(sx + k, roofBottom + 5, 6, 5); b.fillStyle = "#6a5032"; b.fillRect(sx + k + 2, roofBottom + 5, 1, 5); b.fillStyle = "#f4dd8c"; }
      // 지붕 (3/4 시점: 위로 솟은 면)
      const top = sy - 8;
      b.fillStyle = r2; b.fillRect(sx - 2, top, W + 4, roofBottom - top + 2);
      b.fillStyle = r1; b.fillRect(sx - 2, top, W + 4, Math.floor((roofBottom - top) * 0.62));
      b.fillStyle = "rgba(255,255,255,0.12)";
      for (let k = top + 3; k < roofBottom - 2; k += 4) b.fillRect(sx - 2, k, W + 4, 1);
      b.fillStyle = "rgba(0,0,0,0.25)"; b.fillRect(sx - 2, roofBottom, W + 4, 2);
      if (w.season === "겨울") { b.fillStyle = "#f2f6f8"; b.fillRect(sx - 2, top, W + 4, 4); }
      if (bd.kind === "market") { for (let k = 0; k < W + 4; k += 6) { b.fillStyle = k % 12 ? "#ffffff" : "#d24a3a"; b.fillRect(sx - 2 + k, roofBottom - 4, 6, 5); } }
      if (bd.kind === "forge") { b.fillStyle = "#5a524a"; b.fillRect(sx + W - 12, top - 8, 6, 10); const k = Math.floor(this.t * 3) % 3; b.fillStyle = "rgba(220,220,220,0.6)"; b.fillRect(sx + W - 11 + k, top - 13 - k * 3, 3, 3); }
      if (bd.kind === "temple") { b.fillStyle = "#e9d36a"; b.fillRect(sx + W / 2 - 1, top - 10, 2, 9); b.fillRect(sx + W / 2 - 4, top - 7, 8, 2); }
      if (bd.kind === "guild") { b.fillStyle = "#5a4a3a"; b.fillRect(sx + 4, top - 10, 1, 11); b.fillStyle = "#c2452e"; b.fillRect(sx + 5, top - 10, 7, 4); }
      // 간판
      const sign = ["tavern", "forge", "temple", "guild", "market", "inn"].includes(bd.kind);
      if (sign) { b.fillStyle = "#6b4a2b"; b.fillRect(sx + dx + 10, roofBottom + 3, 9, 8); b.fillStyle = "#f2e2b8"; b.fillRect(sx + dx + 11, roofBottom + 4, 7, 6); bd._signAt = [sx + dx + 14.5, roofBottom + 7.5]; }
      const p = w.player;
      if (bd.kind === "inn" && p && p.home === bd.town) { b.fillStyle = "#ffd75a"; b.fillRect(sx + W / 2 - 2, top - 6, 4, 4); }
      if (sty.scaffold) { // 공사 중: 비계
        b.fillStyle = "#8a6238"; for (let k = -2; k <= W; k += 12) b.fillRect(sx + k, top - 4, 2, H + 6); b.fillRect(sx - 3, roofBottom - 2, W + 6, 2); b.fillRect(sx - 3, top + 6, W + 6, 2);
        b.fillStyle = "#e8c04a"; b.fillRect(sx + W / 2 - 6, sy + H - 20, 12, 4); b.fillStyle = "#26180f"; b.fillRect(sx + W / 2 - 4, sy + H - 19, 2, 2); b.fillRect(sx + W / 2 + 2, sy + H - 19, 2, 2);
      }
      const ex = G.ext(w);
      if (bd.kind === "inn" && p && p.home === bd.town && ex.stations && ex.stations.workbench === bd.town) {
        const wx = sx + W + 3, wy = sy + H - 9; // 집 오른쪽의 작업대
        b.fillStyle = C.shadow; b.fillRect(wx, wy + 9, 14, 2);
        b.fillStyle = "#26180f"; b.fillRect(wx - 1, wy - 1, 16, 6); b.fillStyle = "#b07a44"; b.fillRect(wx, wy, 14, 4); b.fillStyle = "#d29a5c"; b.fillRect(wx, wy, 14, 1);
        b.fillStyle = "#7a5230"; b.fillRect(wx + 1, wy + 4, 2, 6); b.fillRect(wx + 11, wy + 4, 2, 6);
        b.fillStyle = "#9aa0a8"; b.fillRect(wx + 3, wy - 2, 4, 2); b.fillStyle = "#8a6a3a"; b.fillRect(wx + 9, wy - 3, 1, 3);
      }
    }
    building16(b, w, bd) {
      const [sx, sy] = this.toBuf(bd.x, bd.y), W = bd.w * TS, H = bd.h * TS, sty = G.styleOf(w, bd), s = buildingSprite(w, bd, sty);
      b.fillStyle = C.shadow; for (let k = 0; k < 4; k++) b.fillRect(sx + 2 + k, sy + H - 1 + k, W, 1);
      b.drawImage(s.c, sx - s.ax, sy + H - s.ay);
      const top = sy + H - s.ay, roofBottom = sy + H - s.sh.wallH - 3;
      bd._signAt = [sx + W / 2, top - 4];
      const p = w.player;
      if (bd.kind === "inn" && p && p.home === bd.town) { b.fillStyle = "#26180f"; b.fillRect(sx + W / 2 - 3, top - 9, 6, 6); b.fillStyle = "#ffd75a"; b.fillRect(sx + W / 2 - 2, top - 8, 4, 4); }
      if (sty.scaffold) {
        b.fillStyle = "#8a6238"; for (let k = -2; k <= W; k += 12) b.fillRect(sx + k, top, 2, sy + H - top); b.fillRect(sx - 3, roofBottom - 2, W + 6, 2); b.fillRect(sx - 3, top + 10, W + 6, 2);
      }
      const ex = G.ext(w);
      if (bd.kind === "inn" && p && p.home === bd.town && ex.stations && ex.stations.workbench === bd.town) {
        const wx = sx + W + 3, wy = sy + H - 9;
        b.fillStyle = C.shadow; b.fillRect(wx, wy + 9, 14, 2);
        b.fillStyle = "#26180f"; b.fillRect(wx - 1, wy - 1, 16, 6); b.fillStyle = "#b07a44"; b.fillRect(wx, wy, 14, 4); b.fillStyle = "#d29a5c"; b.fillRect(wx, wy, 14, 1);
        b.fillStyle = "#7a5230"; b.fillRect(wx + 1, wy + 4, 2, 6); b.fillRect(wx + 11, wy + 4, 2, 6);
        b.fillStyle = "#9aa0a8"; b.fillRect(wx + 3, wy - 2, 4, 2); b.fillStyle = "#8a6a3a"; b.fillRect(wx + 9, wy - 3, 1, 3);
      }
    }
    interior(b, w, bd, wallOnly) {
      this._w = w;
      const sty = G.styleOf(w, bd), [sx, sy] = this.toBuf(bd.x, bd.y), Wd = bd.w * TS, Hd = bd.h * TS, wall = sty.wall || WALL[bd.kind] || WALL.house;
      if (wallOnly) return this.backWall(b, bd, sx, sy, Wd, Hd, wall);
      if (ART) { // 널마루(또는 돌바닥): 4px 널 줄, 이음매가 엇갈린다
        const stone = !sty.floor && (bd.kind === "temple" || bd.kind === "forge"), R = stone ? ART.RAMP.stone : ART.RAMP.wood, carpet = sty.floor && sty.floor[0];
        for (let y = TS; y < bd.h * TS; y++) for (let k = 0; k < Wd; k++) {
          const row = Math.floor(y / 4), v = y % 4, seam = (k + row * 7) % (stone ? 8 : 20) === 0;
          b.fillStyle = v === 3 || seam ? R[2] : v === 0 ? R[stone ? 5 : 6] : R[stone ? 4 : 5];
          b.fillRect(sx + k, sy + y, 1, 1);
        }
        if (carpet) { b.fillStyle = carpet; b.fillRect(sx + 8, sy + TS + 6, Wd - 16, Hd - TS - 12); b.fillStyle = shade(carpet, 0.25); b.fillRect(sx + 10, sy + TS + 8, Wd - 20, 1); b.fillRect(sx + 10, sy + Hd - 8, Wd - 20, 1); }
        return;
      }
      const plank = sty.floor ? sty.floor : bd.kind === "temple" ? ["#d8d0c0", "#cdc4b2"] : bd.kind === "forge" ? ["#8a8478", "#7d776c"] : ["#b98a58", "#ad7f50"];
      for (let ry = 1; ry < bd.h; ry++) for (let k = 0; k < bd.w * 2; k++) { b.fillStyle = plank[(k + ry) & 1]; b.fillRect(sx + k * 8, sy + ry * TS, 8, TS); }
      b.fillStyle = "rgba(0,0,0,0.12)"; for (let ry = 1; ry < bd.h; ry++) b.fillRect(sx, sy + ry * TS, Wd, 1);
    }
    backWall(b, bd, sx, sy, Wd, Hd, wall) {
      if (ART) {
        const K = BKIND[bd.kind] || BKIND.house, M = ART.MAT[(this._w && G.styleOf(this._w, bd).wallKey) || K.wall] || ART.MAT.plaster, Tm = ART.MAT.timber, Gl = ART.MAT.glass;
        for (let y = -10; y < TS; y++) for (let k = 0; k < Wd; k++) {
          const u = k, v = y + 10; let c = M[3];
          if (M === ART.MAT.plank) c = u % 5 === 0 ? M[1] : u % 5 === 1 ? M[5] : M[3];
          else if (M === ART.MAT.log) c = v % 5 === 4 ? M[1] : v % 5 === 0 ? M[5] : M[3];
          else if (M === ART.MAT.stone || M === ART.MAT.brick) { const row = Math.floor(v / 5), kk = (u + (row % 2) * 4) % 8; c = v % 5 === 4 || kk === 0 ? M[1] : v % 5 === 0 ? M[5] : M[3]; }
          else c = hash(sx + k >> 2, y >> 2, 5) < 0.08 ? M[2] : M[3];
          b.fillStyle = c; b.fillRect(sx + k, sy + y, 1, 1);
        }
        b.fillStyle = Tm[2]; b.fillRect(sx, sy + TS - 3, Wd, 3); b.fillStyle = Tm[4]; b.fillRect(sx, sy + TS - 3, Wd, 1); // 걸레받이
        for (let k = 8; k < Wd - 10; k += 24) { // 창
          b.fillStyle = Tm[2]; b.fillRect(sx + k - 1, sy - 6, 12, 10); b.fillStyle = Gl[2]; b.fillRect(sx + k, sy - 5, 10, 8); b.fillStyle = Gl[3]; b.fillRect(sx + k, sy - 5, 10, 2); b.fillStyle = Gl[4]; b.fillRect(sx + k + 2, sy - 3, 1, 1); b.fillRect(sx + k + 3, sy - 4, 1, 1);
          b.fillStyle = Tm[3]; b.fillRect(sx + k + 5, sy - 5, 1, 8); b.fillRect(sx + k, sy - 1, 10, 1);
        }
        if (bd.kind === "guild") { b.fillStyle = Tm[3]; b.fillRect(sx + 4 * TS, sy - 6, 22, 14); b.fillStyle = "#e8dcc0"; for (const [ox, oy] of [[2, 2], [10, 3], [4, 8], [13, 8]]) b.fillRect(sx + 4 * TS + ox, sy - 6 + oy, 6, 4); }
        b.fillStyle = INK16; b.fillRect(sx - 2, sy - 11, 2, Hd + 13); b.fillRect(sx + Wd, sy - 11, 2, Hd + 13); b.fillRect(sx - 2, sy - 11, Wd + 4, 1);
        b.fillStyle = M[1]; b.fillRect(sx - 1, sy - 10, 1, Hd + 11); b.fillRect(sx + Wd, sy - 10, 1, Hd + 11);
        return;
      }
      // 뒷벽 (높이감을 주려고 위로 10px 더)
      b.fillStyle = shade(wall, -0.08); b.fillRect(sx, sy - 10, Wd, TS + 10);
      b.fillStyle = shade(wall, -0.3); b.fillRect(sx, sy + TS - 3, Wd, 3);
      b.fillStyle = "#f4dd8c"; for (let k = 8; k < Wd - 8; k += 24) { b.fillRect(sx + k, sy - 4, 8, 7); b.fillStyle = "#6a5032"; b.fillRect(sx + k + 3, sy - 4, 1, 7); b.fillRect(sx + k, sy - 1, 8, 1); b.fillStyle = "#f4dd8c"; }
      if (bd.kind === "guild") { b.fillStyle = "#8a6238"; b.fillRect(sx + 4 * TS, sy - 6, 22, 14); b.fillStyle = "#f2e2b8"; for (const [ox, oy] of [[2, 2], [10, 3], [4, 8], [13, 8]]) b.fillRect(sx + 4 * TS + ox, sy - 6 + oy, 6, 4); }
      // 옆벽
      b.fillStyle = shade(wall, -0.35); b.fillRect(sx - 2, sy - 10, 2, Hd + 12); b.fillRect(sx + Wd, sy - 10, 2, Hd + 12);
    }
    frontWall(b, bd, w) {
      if (ART) {
        const [sx, sy] = this.toBuf(bd.x, bd.y), Wd = bd.w * TS, Hd = bd.h * TS, dx = (bd.door[0] - bd.x) * TS, St = ART.MAT.stone;
        for (const [x0, x1] of [[-2, dx], [dx + TS, Wd + 2]]) { b.fillStyle = INK16; b.fillRect(sx + x0, sy + Hd - 3, x1 - x0, 5); b.fillStyle = St[3]; b.fillRect(sx + x0, sy + Hd - 2, x1 - x0, 3); b.fillStyle = St[5]; b.fillRect(sx + x0, sy + Hd - 2, x1 - x0, 1); }
        b.fillStyle = ART.MAT.timber[2]; b.fillRect(sx + dx, sy + Hd, 2, 2); b.fillRect(sx + dx + TS - 2, sy + Hd, 2, 2);
        return;
      }
      const [sx, sy] = this.toBuf(bd.x, bd.y), Wd = bd.w * TS, Hd = bd.h * TS, wall = (w && G.styleOf(w, bd).wall) || WALL[bd.kind] || WALL.house;
      const dx = (bd.door[0] - bd.x) * TS;
      b.fillStyle = shade(wall, -0.35); b.fillRect(sx - 2, sy + Hd - 2, dx + 2, 4); b.fillRect(sx + dx + TS, sy + Hd - 2, Wd - dx - TS + 2, 4);
      b.fillStyle = "#4a3020"; b.fillRect(sx + dx, sy + Hd, 2, 2); b.fillRect(sx + dx + TS - 2, sy + Hd, 2, 2);
    }
    /** 가구 한 칸 (타일 좌표) */
    furniture(b, x, y, type) {
      const [sx, sy] = this.toBuf(x, y), R = (ox, oy, w2, h2, c) => { b.fillStyle = (ART && FMAP[c]) || c; b.fillRect(sx + ox, sy + oy, w2, h2); };
      const ol = (ox, oy, w2, h2) => R(ox - 1, oy - 1, w2 + 2, h2 + 2, "#26180f");
      switch (type) {
        case "bed": ol(1, -2, 14, 17); R(1, -2, 14, 17, "#8a5a32"); R(2, -1, 12, 4, "#f4efe4"); R(2, 3, 12, 11, "#c04a4a"); R(2, 3, 12, 2, "#d86a6a"); break;
        case "chest": ol(2, 4, 12, 10); R(2, 4, 12, 10, "#9a6a3a"); R(2, 4, 12, 3, "#b88050"); R(7, 7, 2, 3, "#e8c04a"); break;
        case "barrel": ol(3, 1, 10, 13); R(3, 1, 10, 13, "#8a5a32"); R(3, 4, 10, 1, "#5a3a20"); R(3, 10, 10, 1, "#5a3a20"); R(4, 1, 8, 2, "#a8743f"); break;
        case "counter": ol(0, 2, 16, 12); R(0, 2, 16, 4, "#c99a62"); R(0, 6, 16, 8, "#8a5a32"); R(0, 6, 16, 1, "#5a3a20"); break;
        case "table": ol(1, 3, 14, 9); R(1, 3, 14, 6, "#b07a44"); R(1, 3, 14, 1, "#d29a5c"); R(2, 9, 2, 4, "#7a5230"); R(12, 9, 2, 4, "#7a5230"); break;
        case "furnace": ol(1, -4, 14, 18); R(1, -4, 14, 18, "#6a6a72"); R(1, -4, 14, 2, "#8a8a92"); R(4, 4, 8, 7, "#2a1a10"); R(5, 6 + (Math.floor(this.t * 6) % 2), 6, 4, "#f08a2a"); R(6, 8, 4, 2, "#ffd060"); break;
        case "anvil": ol(2, 5, 12, 8); R(2, 5, 12, 3, "#4a4a52"); R(5, 8, 6, 5, "#3a3a42"); R(2, 5, 12, 1, "#7a7a82"); break;
        case "rack": ol(2, -2, 12, 12); R(2, -2, 12, 2, "#7a5230"); R(4, 0, 1, 9, "#9aa0a8"); R(8, 0, 1, 9, "#8a6a3a"); R(11, 0, 1, 9, "#9aa0a8"); break;
        case "altar": ol(0, 2, 16, 12); R(0, 2, 16, 12, "#ece4d2"); R(0, 2, 16, 2, "#ffffff"); R(6, -4, 4, 6, "#e9d36a"); R(4, -2, 8, 2, "#e9d36a"); break;
        case "bench": ol(0, 6, 16, 6); R(0, 6, 16, 3, "#a8743f"); R(1, 9, 2, 4, "#7a5230"); R(13, 9, 2, 4, "#7a5230"); break;
        case "desk": ol(0, 3, 16, 9); R(0, 3, 16, 6, "#9a6a3a"); R(3, 4, 5, 3, "#f2e2b8"); R(10, 4, 2, 3, "#2a2a3a"); R(1, 9, 2, 4, "#6a4428"); R(13, 9, 2, 4, "#6a4428"); break;
        case "crate": ol(2, 3, 12, 11); R(2, 3, 12, 11, "#b88a50"); R(2, 3, 12, 1, "#d0a868"); R(2, 8, 12, 1, "#8a6030"); R(7, 3, 1, 11, "#8a6030"); break;
        case "chair": ol(4, 1, 8, 12); R(4, 1, 8, 3, "#8a5a32"); R(4, 6, 8, 3, "#b07a44"); R(4, 9, 2, 4, "#7a5230"); R(10, 9, 2, 4, "#7a5230"); break;
        case "rug": R(1, 1, 14, 14, "#4f8a4a"); R(2, 2, 12, 12, "#6fae5a"); R(4, 4, 8, 8, "#e8c45a"); break;
        case "pot": ol(5, 7, 6, 6); R(5, 7, 6, 6, "#c46a3a"); R(5, 7, 6, 1, "#e08a5a"); R(6, 1, 2, 6, "#3a8a3a"); R(8, 2, 3, 3, "#4fae4a"); R(4, 3, 3, 2, "#e57ab0"); break;
        case "basket": ol(3, 6, 10, 7); R(3, 6, 10, 7, "#c9a24a"); for (let k = 3; k < 13; k += 2) R(k, 6, 1, 7, "#a8823a"); R(3, 6, 10, 1, "#e8c46a"); break;
        default: ol(3, 4, 10, 9); R(3, 4, 10, 9, "#9a6a3a");
      }
    }
    person(b, n, sx, sy, dir, moving, isPlayer, state) {
      const L = lookOf(n, isPlayer);
      b.fillStyle = C.shadow; b.beginPath(); b.ellipse(sx, sy, 6, 2, 0, 0, Math.PI * 2); b.fill();
      if (isPlayer) { b.strokeStyle = "rgba(255,220,90,0.9)"; b.lineWidth = 1; b.beginPath(); b.ellipse(sx, sy, 8, 3, 0, 0, Math.PI * 2); b.stroke(); }
      let ht;
      if (ART) {
        const frame = moving ? Math.floor(this.t * 7 + n.id) % 4 : 0, spr = person16(n, L, dir || "down", frame);
        const sc = L.kid ? 0.75 : 1; ht = Math.round(32 * sc);
        b.drawImage(spr, Math.round(sx - 10 * sc), Math.round(sy - 38 * sc), Math.round(20 * sc), Math.round(40 * sc));
      } else {
        const frame = moving ? 1 + (Math.floor(this.t * 8 + n.id) % 2) : 0;
        const spr = personSprite(L, dir || "down", frame);
        const sc = L.kid ? 0.75 : 1, wd = Math.round(20 * sc); ht = Math.round(30 * sc);
        const bob = moving && frame === 1 ? -1 : 0;
        b.drawImage(spr, Math.round(sx - wd / 2), Math.round(sy - ht + 2 * sc) + bob, wd, ht);
      }
      if (isPlayer && state) {
        const item = state.item, it = G.ITEMS[item];
        const dx = { up: 0, down: 4, left: -7, right: 7 }[dir], dy = { up: -8, down: -6, left: -7, right: -7 }[dir];
        if (this.swing > 0) {
          this.swing -= state.dt;
          const a = (1 - this.swing / 0.25) * Math.PI * 0.9 - 0.45 * Math.PI;
          const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir];
          b.strokeStyle = "rgba(255,255,255,0.85)"; b.lineWidth = 2; b.beginPath(); b.arc(sx, sy - 9, 12, base + a - 0.6, base + a); b.stroke();
        } else if (it && item !== "hand" && item !== "skill") {
          const col = it.weapon ? "#d6dbe2" : it.act === "water" ? "#6fa8d8" : it.act === "chop" || it.act === "till" ? "#8a6a3a" : it.act === "throw" ? "#9a9ea6" : "#e0c070";
          b.fillStyle = "#26180f"; b.fillRect(sx + dx - 1, sy + dy - 1, 5, 5); b.fillStyle = col; b.fillRect(sx + dx, sy + dy, 3, 3);
        }
        if (state.wanted) { b.fillStyle = "#ff5a4a"; const top = sy - ht - 4; for (let i = 0; i < state.wanted; i++) b.fillRect(sx - 5 + i * 4, top, 3, 3); }
      }
    }
    animal(b, a, sx, sy) {
      const flip = a.vx < 0 ? -1 : 1, hop = Math.abs(a.vx) + Math.abs(a.vy) > 0.2 ? (Math.floor(this.t * 10 + a.id) % 2) : 0;
      if (root.Spr16) {
        const s = root.Spr16.animal(a.type, hop, a.hurt > 0), big = a.type === "boar" || a.type === "deer" || a.type === "wolf";
        b.fillStyle = C.shadow; b.beginPath(); b.ellipse(sx, sy, big ? 7 : 4, 2, 0, 0, Math.PI * 2); b.fill();
        if (flip < 0) { b.save(); b.translate(Math.round(sx), 0); b.scale(-1, 1); b.drawImage(s.c, -s.ax, Math.round(sy - s.ay - (a.type === "rabbit" ? hop : 0))); b.restore(); }
        else b.drawImage(s.c, Math.round(sx - s.ax), Math.round(sy - s.ay - (a.type === "rabbit" ? hop : 0)));
        return;
      }
      const R = (x, y, w, h, c) => { b.fillStyle = a.hurt > 0 ? "#ffffff" : c; b.fillRect(flip > 0 ? sx + x : sx - x - w, sy + y, w, h); };
      b.fillStyle = C.shadow; b.beginPath(); b.ellipse(sx, sy, a.type === "boar" || a.type === "deer" ? 6 : 4, 2, 0, 0, Math.PI * 2); b.fill();
      switch (a.type) {
        case "rabbit": R(-3, -5 - hop, 6, 4, "#e9e2d6"); R(2, -8 - hop, 3, 3, "#e9e2d6"); R(3, -11 - hop, 1, 3, "#d9cfc2"); R(4, -7 - hop, 1, 1, "#222"); break;
        case "chicken": R(-3, -6, 6, 5, "#f4f1ea"); R(2, -9, 3, 3, "#f4f1ea"); R(3, -10, 1, 1, "#d33"); R(5, -8, 1, 1, "#e0a030"); R(-1, -1, 1, 1, "#e0a030"); break;
        case "deer": R(-5, -9 - hop, 10, 5, "#a8743f"); R(4, -13 - hop, 3, 5, "#a8743f"); R(5, -16 - hop, 1, 3, "#5a3a20"); R(3, -17 - hop, 1, 2, "#5a3a20"); R(-4, -4, 1, 4, "#7a5430"); R(3, -4, 1, 4, "#7a5430"); R(-5, -8 - hop, 2, 1, "#f0e0c0"); break;
        case "boar": R(-6, -8, 12, 6, "#5a3d2b"); R(5, -7, 3, 4, "#4a3021"); R(7, -5, 2, 1, "#f2ead0"); R(-5, -2, 2, 2, "#3a281c"); R(3, -2, 2, 2, "#3a281c"); R(-3, -9, 6, 1, "#3a281c"); break;
        case "wolf": R(-5, -8, 10, 5, "#8f939a"); R(4, -11, 4, 4, "#8f939a"); R(5, -13, 1, 2, "#6f737a"); R(7, -10, 1, 1, "#f0d040"); R(-7, -9, 3, 2, "#8f939a"); R(-4, -3, 1, 3, "#6f737a"); R(3, -3, 1, 3, "#6f737a"); break;
      }
    }

    // 화면 해상도로 그리는 것: 이름, 말풍선, 마크, 표지
    overlay(ctx, w, state) {
      const P = (bx, by) => [bx * this.px, by * this.px];
      const font = (sz) => `500 ${sz}px "Noto Sans KR", system-ui, sans-serif`;
      const outline = (text, x, y, sz, fill) => { ctx.font = font(sz); ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,20,10,0.85)"; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); };
      // 건물 간판 글자
      for (const bd of MAP.buildings) {
        if (!bd._signAt || bd.kind === "house") continue;
        const [bx, by] = this.toBuf(bd.x, bd.y);
        if (bx < -100 || by < -60 || bx > this.buf.width + 100 || by > this.buf.height + 60) continue;
        const [sx, sy] = P(bd._signAt[0], bd._signAt[1]);
        const sg = { tavern: "meal", forge: "axe", temple: "potion", guild: "sword", market: "old_coin", inn: "bread" }[bd.kind]; // 간판 그림
        if (sg) { const sz = Math.round(this.px * 7); ctx.imageSmoothingEnabled = false; ctx.drawImage(itemIconCanvas(sg), Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz); }
        const near = w.ppos && Math.hypot(bd.door[0] + 0.5 - w.ppos.x, bd.door[1] + 0.5 - w.ppos.y) < 5;
        if (near || (this.hover && this.hover.building === bd)) { const [tx, ty] = P(...this.toBuf(bd.x + bd.w / 2, bd.y - 0.7)); outline(bd.kind === "inn" && w.player && w.player.home === bd.town ? "내 집" : bd.name, tx, ty, 14, "#ffe9a8"); }
      }
      // 마을 이름
      for (const [id, [x, y]] of Object.entries(G.TOWN_POS)) {
        const [sx, sy] = P(...this.toBuf(x + 0.5, y - 12.5));
        if (sx < -100 || sx > this.cw + 100 || sy < -30 || sy > this.ch + 30) continue;
        outline(w.towns[id].name, sx, sy, 20, "#fff4d6");
      }
      // 주민 이름과 말풍선
      const pp = this.playerBuf;
      for (const e of this.ents) {
        if (!e.npc) continue;
        const [sx, sy] = P(e.x, e.y - 30);
        const near = pp && Math.hypot(e.x - pp[0], e.y - pp[1]) < 40;
        const hov = this.hover && this.hover.npc === e.npc;
        if (e.mark) { const k = Math.sin(this.t * 5) * 2; outline("!", sx, sy - 14 + k, 20, "#ffd75a"); }
        if (e.k.chase) outline("★", sx, sy - 14, 14, "#ff6a5a");
        if (near || hov) outline(e.n.name, sx, sy, 13, "#ffffff");
        if (e.k.sayT > 0 && e.k.say) {
          ctx.font = font(13); const tw = ctx.measureText(e.k.say).width + 14;
          const bx = sx - tw / 2, by = sy - 34;
          ctx.fillStyle = "rgba(255,250,235,0.95)"; ctx.strokeStyle = "#5a3d1e"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(bx, by, tw, 22, 8); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx - 4, by + 22); ctx.lineTo(sx, by + 28); ctx.lineTo(sx + 4, by + 22); ctx.fill();
          ctx.fillStyle = "#3a2a1c"; ctx.textAlign = "center"; ctx.fillText(e.k.say, sx, by + 16);
        }
      }
      if (this.hover && this.hover.animal) { const a = this.hover.animal; const [sx, sy] = P(...this.toBuf(a.x, a.y - 1.1)); outline(G.ANIMAL[a.type].name, sx, sy, 12, "#ffeacc"); }
    }
  }

  // ================================================================ 미니맵·전체 지도
  const TILE_COL = (t, season) => {
    const pal = SEASON[season];
    return { [T.GRASS]: pal.g[0], [T.FLOOR]: "#3f7f3c", [T.DIRT]: "#c9a067", [T.SAND]: "#e8d49a", [T.WATER]: "#3f8fd2", [T.DEEP]: "#2a6cb0", [T.CLIFF]: "#8a7150", [T.PAVE]: "#cfc6b4", [T.FIELD]: "#8a5f36", [T.WASTE]: "#8a6b5c", [T.BRIDGE]: "#a87a4c" }[t];
  };
  const baseCache = {};
  function baseMap(w) {
    const key = w.season + (MAP.ver || 0);
    if (baseCache[key]) return baseCache[key];
    const c = document.createElement("canvas"); c.width = MW; c.height = MH;
    const x = c.getContext("2d"), img = x.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) {
      let col = TILE_COL(MAP.tile[i], w.season);
      const o = MAP.obj[i];
      if (o === O.OAK || o === O.PINE || o === O.APPLE) col = "#2f6b34";
      if (MAP.solid[i] >= 0) col = "#9a5a3a";
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return (baseCache[key] = c);
  }
  /** 지도를 그린다. full이면 전체, 아니면 플레이어 주변을 확대. marks = [{x,y,color,label}] */
  function drawMap(canvas, w, { full, marks = [], scale = 2 } = {}) {
    const ctx = canvas.getContext("2d"), dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const base = baseMap(w);
    let ox, oy, s;
    if (full) { s = Math.min(r.width / MW, r.height / MH); ox = (r.width - MW * s) / 2; oy = (r.height - MH * s) / 2; }
    else { s = scale; const c = w.ppos || { x: 76, y: 62 }; ox = r.width / 2 - c.x * s; oy = r.height / 2 - c.y * s; }
    ctx.fillStyle = "#2a6cb0"; ctx.fillRect(0, 0, r.width, r.height);
    ctx.drawImage(base, ox, oy, MW * s, MH * s);
    const pt = (x, y) => [ox + x * s, oy + y * s];
    ctx.font = `500 ${full ? 14 : 11}px "Noto Sans KR", system-ui, sans-serif`; ctx.textAlign = "center";
    for (const [id, [x, y]] of Object.entries(G.TOWN_POS)) {
      const [sx, sy] = pt(x, y - (full ? 13 : 12));
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,20,10,0.8)"; ctx.strokeText(w.towns[id].name, sx, sy); ctx.fillStyle = w.towns[id].fallen ? "#ff9b8a" : "#fff4d6"; ctx.fillText(w.towns[id].name, sx, sy);
    }
    for (const m of marks) {
      const [sx, sy] = pt(m.x, m.y);
      ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(sx, sy, m.r || (full ? 4 : 2.5), 0, Math.PI * 2); ctx.fill();
      if (m.label && full) { ctx.font = '500 12px "Noto Sans KR", system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,20,10,0.8)"; ctx.strokeText(m.label, sx, sy - 7); ctx.fillStyle = "#fff"; ctx.fillText(m.label, sx, sy - 7); }
    }
    if (w.ppos) {
      const [sx, sy] = pt(w.ppos.x, w.ppos.y);
      ctx.fillStyle = "#ffd75a"; ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 5, sy + 4); ctx.lineTo(sx - 5, sy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    return { ox, oy, s };
  }

  // ================================================================ 아이템 아이콘 (16×16 도트)
  /* 아이템마다 [모양, 색]. 새 아이템은 정의에 art: [모양, 색]을 주면 되고, 없으면 상자 모양으로 그린다. */
  const ITEM_ART = {
    hand: ["hand", "#e8c4a0"], skill: ["spark", "#e8c86a"], hoe: ["hoe", "#8a8f98"], can: ["can", "#6fa0c8"], axe: ["axe", "#a8aeb6"], stone_axe: ["axe", "#8f8a80"],
    dagger: ["blade", "#c8ced6"], sword: ["sword", "#d6dbe2"], stone_spear: ["spear", "#8f8a80"], rune_spear: ["spear", "#7cb7e8"],
    seed_turnip: ["bag", "#e8e0c8"], seed_potato: ["bag", "#c9a06a"], seed_wheat: ["bag", "#e0c060"], seed_berry: ["bag", "#d05060"], seed_pumpkin: ["bag", "#e08a3a"],
    turnip: ["root", "#efe8f0"], potato: ["round", "#b8915c"], wheat: ["wheat", "#e0c060"], strawberry: ["berry", "#d8404a"], pumpkin: ["round", "#e0842a"],
    apple: ["round", "#d0443a"], berry: ["berries", "#6a4ab0"], mushroom: ["shroom", "#c8483a"], herb: ["leaf", "#5aa84a"], flower: ["flower", "#e8c84a"],
    meat: ["meat", "#c0605a"], roast: ["meat", "#a05a30"], hide: ["hide", "#8a6038"], wood: ["log", "#a07040"], branch: ["stick", "#9a7448"], stone: ["rock", "#9aa0a6"], fiber: ["fiber", "#8ab060"],
    bread: ["bread", "#d8a860"], meal: ["bowl", "#b8703a"], dish: ["bowl", "#d8903a"], honey_cake: ["cake", "#e8c070"], honey: ["jar", "#e0a830"],
    potion: ["bottle", "#d04a5a"], salve: ["jar", "#9ac08a"], fever_tonic: ["bottle", "#6aa86a"], elixir: ["bottle", "#7cb7e8"],
    old_coin: ["coin", "#d8b84a"], relic: ["urn", "#b08a60"], scroll_medicine: ["scroll", "#e8dcc0"], scroll_rune: ["scroll", "#e8dcc0"], scroll_elixir: ["scroll", "#e8dcc0"], scroll_dragon: ["scroll", "#d8c8a8"],
    basket: ["basket", "#c9a24a"], chair: ["chair", "#a07040"], table: ["table", "#a07040"], rug: ["rug", "#6fae5a"], flowerpot: ["pot", "#c46a3a"],
  };
  const iconCache = new Map();
  function itemIconCanvas(id) {
    if (iconCache.has(id)) return iconCache.get(id);
    const it = G.ITEMS[id] || {}, [shape, col] = it.art || ITEM_ART[id] || ["box", "#9a8a70"];
    const d = shade(col, -0.3), l = shade(col, 0.3);
    const c = pixelCanvas(16, 16, (R) => {
      switch (shape) {
        case "hand": R(4, 7, 8, 6, col); R(4, 3, 2, 5, col); R(6, 2, 2, 6, col); R(8, 2, 2, 6, col); R(10, 3, 2, 5, col); R(12, 7, 2, 3, col); R(5, 12, 6, 1, d); break;
        case "spark": R(7, 2, 2, 12, col); R(2, 7, 12, 2, col); R(5, 5, 6, 6, l); R(7, 7, 2, 2, "#ffffff"); break;
        case "hoe": R(7, 4, 2, 11, "#8a6238"); R(3, 2, 8, 3, col); R(3, 5, 2, 2, d); break;
        case "can": R(3, 6, 8, 7, col); R(3, 6, 8, 2, l); R(11, 7, 3, 2, col); R(13, 5, 2, 2, d); R(5, 3, 4, 3, d); break;
        case "axe": R(7, 3, 2, 12, "#8a6238"); R(3, 2, 6, 6, col); R(3, 2, 6, 1, l); R(2, 3, 1, 4, d); break;
        case "blade": R(7, 2, 2, 8, col); R(7, 2, 1, 8, l); R(5, 10, 6, 1, "#8a6238"); R(7, 11, 2, 3, "#6a4a2a"); break;
        case "sword": R(7, 1, 2, 10, col); R(7, 1, 1, 10, l); R(4, 11, 8, 1, "#c8a040"); R(7, 12, 2, 3, "#6a4a2a"); break;
        case "spear": R(7, 5, 2, 10, "#8a6238"); R(6, 1, 4, 5, col); R(7, 0, 2, 2, l); break;
        case "bag": R(4, 6, 8, 8, "#c8b088"); R(5, 4, 6, 2, "#a89068"); R(6, 9, 4, 3, col); break;
        case "root": R(5, 4, 6, 7, col); R(6, 11, 4, 2, col); R(7, 13, 2, 2, d); R(5, 2, 2, 3, "#5aa84a"); R(9, 1, 2, 4, "#5aa84a"); R(5, 4, 6, 2, "#c890c8"); break;
        case "round": R(4, 5, 8, 8, col); R(3, 6, 10, 6, col); R(5, 6, 3, 2, l); R(7, 3, 2, 3, "#5a8a3a"); R(4, 11, 8, 2, d); break;
        case "wheat": R(7, 6, 2, 9, "#b89040"); for (let k = 0; k < 4; k++) { R(5, 2 + k * 2, 2, 2, col); R(9, 2 + k * 2, 2, 2, col); } R(7, 1, 2, 2, col); break;
        case "berry": R(4, 5, 8, 8, col); R(5, 12, 6, 2, col); R(5, 6, 1, 1, "#ffe0a0"); R(8, 8, 1, 1, "#ffe0a0"); R(10, 6, 1, 1, "#ffe0a0"); R(5, 3, 6, 2, "#4a9a3a"); break;
        case "berries": R(3, 7, 4, 4, col); R(8, 5, 4, 4, col); R(7, 10, 4, 4, col); R(4, 7, 1, 1, l); R(9, 5, 1, 1, l); R(8, 10, 1, 1, l); break;
        case "shroom": R(3, 4, 10, 4, col); R(4, 3, 8, 1, col); R(6, 8, 4, 6, "#efe6d0"); R(5, 5, 2, 1, "#ffffff"); R(9, 4, 2, 1, "#ffffff"); break;
        case "leaf": R(7, 8, 2, 7, "#3a7a2a"); R(3, 4, 5, 5, col); R(8, 2, 5, 6, col); R(4, 5, 2, 2, l); R(9, 3, 2, 2, l); break;
        case "flower": R(7, 8, 2, 7, "#3a8a3a"); R(5, 3, 6, 6, col); R(4, 5, 8, 2, col); R(7, 5, 2, 2, "#c86a2a"); break;
        case "meat": R(3, 4, 9, 8, col); R(4, 3, 7, 1, col); R(5, 5, 4, 3, l); R(11, 10, 3, 3, "#f0e8d8"); R(13, 12, 2, 2, "#f0e8d8"); break;
        case "hide": R(3, 3, 10, 10, col); R(2, 5, 1, 6, col); R(13, 5, 1, 6, col); R(5, 5, 6, 6, l); break;
        case "log": R(2, 5, 12, 7, col); R(2, 5, 12, 1, l); R(11, 5, 3, 7, "#d8b080"); R(12, 7, 1, 3, d); break;
        case "stick": R(3, 11, 2, 2, col); R(5, 9, 2, 2, col); R(7, 7, 2, 2, col); R(9, 5, 2, 2, col); R(11, 3, 2, 2, col); R(8, 9, 3, 2, col); break;
        case "rock": R(3, 6, 10, 7, col); R(5, 4, 6, 2, col); R(4, 6, 4, 2, l); R(3, 11, 10, 2, d); break;
        case "fiber": for (let k = 0; k < 4; k++) R(4 + k * 2, 3 + (k % 2), 1, 11, col); R(3, 7, 10, 2, d); break;
        case "bread": R(2, 6, 12, 7, col); R(3, 5, 10, 1, col); R(4, 7, 2, 1, l); R(7, 7, 2, 1, l); R(10, 7, 2, 1, l); R(2, 11, 12, 2, d); break;
        case "bowl": R(2, 7, 12, 3, "#efe6d0"); R(3, 10, 10, 3, "#d8ccb0"); R(3, 6, 10, 2, col); R(5, 3, 1, 3, "#e8e8e8"); R(9, 2, 1, 3, "#e8e8e8"); break;
        case "cake": R(3, 7, 10, 6, col); R(3, 6, 10, 2, "#f8f0e0"); R(7, 3, 2, 3, "#d04a4a"); R(3, 10, 10, 1, d); break;
        case "jar": R(4, 5, 8, 9, col); R(5, 3, 6, 2, "#8a6238"); R(5, 6, 2, 5, l); break;
        case "bottle": R(4, 7, 8, 7, col); R(6, 3, 4, 4, "#c8d8e0"); R(6, 2, 4, 1, "#8a6238"); R(5, 8, 2, 3, l); break;
        case "coin": R(3, 3, 10, 10, col); R(4, 2, 8, 12, col); R(6, 5, 4, 6, d); R(5, 4, 2, 2, l); break;
        case "urn": R(4, 5, 8, 9, col); R(5, 3, 6, 2, col); R(3, 7, 1, 4, d); R(12, 7, 1, 4, d); R(5, 9, 6, 1, d); break;
        case "scroll": R(3, 4, 10, 8, col); R(2, 3, 2, 10, "#a8865a"); R(12, 3, 2, 10, "#a8865a"); R(5, 6, 6, 1, "#7a6a50"); R(5, 8, 5, 1, "#7a6a50"); break;
        case "basket": R(2, 7, 12, 7, col); for (let k = 3; k < 14; k += 2) R(k, 7, 1, 7, d); R(4, 3, 8, 1, d); R(3, 4, 1, 3, d); R(12, 4, 1, 3, d); break;
        case "chair": R(4, 2, 8, 6, col); R(4, 8, 8, 2, l); R(4, 10, 2, 5, d); R(10, 10, 2, 5, d); break;
        case "table": R(2, 5, 12, 3, l); R(2, 8, 12, 1, d); R(3, 9, 2, 6, d); R(11, 9, 2, 6, d); break;
        case "rug": R(2, 3, 12, 10, col); R(4, 5, 8, 6, "#e8c45a"); R(6, 7, 4, 2, col); break;
        case "pot": R(4, 8, 8, 7, col); R(4, 8, 8, 1, l); R(7, 2, 2, 6, "#3a8a3a"); R(4, 3, 3, 3, "#e57ab0"); R(9, 4, 3, 3, "#4fae4a"); break;
        default: R(3, 4, 10, 10, col); R(3, 4, 10, 2, l); R(7, 6, 2, 6, d);
      }
    });
    iconCache.set(id, c);
    return c;
  }
  root.itemIcon = (id, size = 24) => { const src = itemIconCanvas(id), c = document.createElement("canvas"); c.width = 16; c.height = 16; c.getContext("2d").drawImage(src, 0, 0); c.className = "icon"; c.style.width = size + "px"; c.style.height = size + "px"; c.setAttribute("aria-hidden", "true"); return c; };
  root.WorldView = View;
  root.drawPortrait = (n, size, isPlayer) => { const src = portrait(n, isPlayer), c = document.createElement("canvas"); c.width = 40; c.height = 40; c.getContext("2d").drawImage(src, 0, 0); c.style.width = size + "px"; c.style.height = size + "px"; c.style.imageRendering = "pixelated"; return c; };
  root.drawMap = drawMap;
})(typeof window !== "undefined" ? window : globalThis);
