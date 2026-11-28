/* 16px 도트 키트 (proto/*.js를 묶은 것: 직접 고치지 말고 proto에서 고친 뒤 bundle_art.py로 다시 만든다) */
(function (root) {
"use strict";
const M_art = (() => {
/* 새 도트 시안: 32px 타일, 명암 램프, 빛 레이어.
 * 모든 그림은 코드로 찍는다(이미지 파일 없음). 색은 램프(어두움→밝음)에서만 고른다. */

// ------------------------------------------------------------ 색
/* 재질마다 실제로는 세 톤(그림자·기본·밝음)과 선·반짝임만 쓴다. 같은 색이 반복되는 칸은 일부러 같게 둔 것 */
const RAMP = {
  grass: ["#3a5a3c", "#557a48", "#6a9150", "#7ea25a", "#7ea25a", "#98b86a", "#b2cc80"],
  dirt: ["#5e4230", "#80603f", "#9c784e", "#b89060", "#b89060", "#caa674", "#dabc8c"],
  sand: ["#a8916c", "#bba37c", "#cbb58e", "#cbb58e", "#dccaa4"],
  water: ["#2c4c68", "#3a6280", "#4a7c9c", "#4a7c9c", "#4a7c9c", "#5e92b0", "#86b2c6", "#d4e6e4"],
  wood: ["#33241f", "#4d362b", "#6a4b39", "#7f5c45", "#7f5c45", "#987456", "#ad8a68"],
  roof: ["#3a2228", "#5a3032", "#7a4038", "#93503f", "#93503f", "#a8654c", "#bb7c5e"],
  plaster: ["#7a6656", "#9a8470", "#b7a088", "#cbb69a", "#cbb69a", "#dccab0", "#e8dcc6"],
  stone: ["#3a3a42", "#55565e", "#6d6f77", "#868890", "#868890", "#a2a4a8", "#bfc0c0"],
  leaf: ["#203a30", "#2e5038", "#3e6840", "#548050", "#548050", "#71a05c", "#92ba70"],
  paint: ["#2c3c3a", "#3d5250", "#516c66", "#6a867c", "#86a092"],
  glass: ["#26303e", "#38485a", "#526a80", "#7894a6", "#a8bcc6"],
  warm: ["#3a1a10", "#7a3a14", "#c8661c", "#f09a30", "#ffc65a", "#ffe9a0", "#fffbe6"],
  red: ["#3a1a1e", "#6a2a2c", "#94403a", "#b45a4a", "#cc7a66"],
  petal: ["#5a4466", "#8a6a94", "#b494b8", "#d8c0d6"],
  yellow: ["#7a6430", "#b0944a", "#d6bc66", "#ece0a0"],
  white: ["#7c8088", "#b0b4b8", "#dcdcd6", "#f0eee6"],
};
const INK = "#2a2226";
const U32 = new Map();
function u32(hex) {
  let v = U32.get(hex);
  if (v !== undefined) return v;
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  U32.set(hex, v);
  return v;
}

// ------------------------------------------------------------ 잡음
const hash = (a, b, c = 0) => { let n = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;

// ------------------------------------------------------------ 버퍼
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Uint32Array(w * h); }
  set(x, y, hex) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || !hex) return; this.px[y * this.w + x] = u32(hex); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x]; }
  rect(x, y, w, h, hex) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex); }
  /** 그림자: 이미 있는 색을 어둡고 차갑게 */
  shade(x, y, k, cool = 0.25) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, c = this.px[i]; if (!(c >>> 24)) return;
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, f = 1 - k;
    const nr = r * f * (1 - cool * k), ng = g * f, nb = Math.min(255, b * f + 40 * k * cool);
    this.px[i] = ((255 << 24) | (Math.round(nb) << 16) | (Math.round(ng) << 8) | Math.round(nr)) >>> 0;
  }
  /** 다른 버퍼를 (dx,dy)에 겹친다. 투명은 건너뛴다 */
  blit(src, dx, dy, flip = false) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const c = src.px[j * src.w + (flip ? src.w - 1 - i : i)]; if (!(c >>> 24)) continue;
      const x = dx + i, y = dy + j; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      this.px[y * this.w + x] = c;
    }
  }
  /** 바깥 테두리: 투명 픽셀 중 칠한 픽셀과 맞닿은 곳에 잉크 */
  outline(hex = INK, diag = false) {
    const out = new Uint32Array(this.px), v = u32(hex), w = this.w;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      if (this.get(x, y) >>> 24) continue;
      const n = (this.get(x - 1, y) | this.get(x + 1, y) | this.get(x, y - 1) | this.get(x, y + 1) | (diag ? this.get(x - 1, y - 1) | this.get(x + 1, y + 1) | this.get(x + 1, y - 1) | this.get(x - 1, y + 1) : 0)) >>> 24;
      if (n) out[y * w + x] = v;
    }
    this.px = out;
  }
}

return { RAMP, INK, u32, hash, vnoise, fbm, Buf };
})();
const M_props16 = (() => {
  const { RAMP, Buf, hash, fbm, INK } = M_art;
/* 16px 소품: 나무·덤불·바위·그루터기·울타리. 빛은 왼쪽 위. 굵은 외곽선 + 덩어리 안쪽 선. */

const lit = (nx, ny) => -(nx * -0.55 + ny * -0.83);

/** 덩어리들의 합집합을 칠한다. 앞(아래) 덩어리가 뒤 덩어리를 덮고, 덮인 경계에 어두운 선을 긋는다 */
function clumpMass(B, clumps, ramp, seed, opts = {}) {
  const { w: W, h: H } = B, owner = new Int16Array(W * H).fill(-1);
  clumps.sort((a, b) => a.y - b.y);
  clumps.forEach((c, k) => {
    for (let y = Math.floor(c.y - c.r - 1); y <= c.y + c.r + 1; y++) for (let x = Math.floor(c.x - c.r - 1); x <= c.x + c.r + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x + 0.5 - c.x) / c.r, ny = (y + 0.5 - c.y) / c.r;
      if (nx * nx + ny * ny > 1 + (hash(x, y, seed + k) - 0.5) * 0.25) continue;
      owner[y * W + x] = k;
    }
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = owner[y * W + x]; if (k < 0) continue;
    const c = clumps[k], nx = (x + 0.5 - c.x) / c.r, ny = (y + 0.5 - c.y) / c.r;
    // 밝은 테는 덩어리의 왼쪽 위 가장자리에만, 그림자는 전체 수관의 오른쪽 아래에만
    const g = lit(nx, ny), whole = opts.whole ? lit(...opts.whole(x, y)) : 0, rim = nx * nx + ny * ny > 0.45;
    let idx = g > 0.55 && rim && whole > -0.2 ? 5 : whole < -0.45 || (g < -0.6 && rim) ? 2 : 4;
    // 위쪽 덩어리와 맞닿은 경계: 짙은 선 (덩어리가 겹쳐 보이게)
    const up = y > 0 ? owner[(y - 1) * W + x] : -1;
    if (up >= 0 && up !== k && clumps[up].y < c.y) idx = 1;
    // 잎 무늬: 밝은 곳엔 작은 밝은 잎, 어두운 곳엔 짙은 잎
    if (idx === 5 && hash(x, y, seed + 7) < 0.1) idx = 6;
    B.set(x, y, ramp[idx]);
  }
  return owner;
}

function tree(seed = 1, kind = "oak", leafRamp) {
  const W = 48, H = 64, B = new Buf(W, H), cx = 24, base = 61, Wd = RAMP.wood;
  // 줄기: 밑동이 벌어진다
  for (let y = base - 22; y <= base; y++) {
    const k = (y - (base - 22)) / 22, half = 3 + (k > 0.75 ? Math.round((k - 0.75) * 12) : 0);
    for (let x = cx - half; x <= cx + half - 1; x++) {
      const u = (x - (cx - half)) / (2 * half - 1);
      let c = u < 0.3 ? Wd[4] : u < 0.7 ? Wd[3] : Wd[2];
      if ((x === cx - 1 || x === cx + 1) && hash(x, y >> 1, seed) < 0.6 && k < 0.8) c = Wd[2]; // 결
      B.set(x, y, c);
    }
  }
  const R = (n) => hash(seed, n, 31);
  const spots = [[0, -40, 12], [-10, -35, 9], [10, -36, 9], [-6, -47, 8], [6, -48, 8], [-13, -26, 8], [13, -27, 8], [0, -27, 10], [-6, -21, 7], [7, -21, 7]];
  const clumps = spots.map(([dx, dy, r], i) => ({ x: cx + dx + (R(i) - 0.5) * 2, y: base + dy + (R(i + 20) - 0.5) * 2, r: r + (R(i + 40) - 0.5) * 1.5 }));
  const ramp = leafRamp ? leafRamp : kind === "autumn" ? ["#3a2420", "#5a3226", "#7e4630", "#a0603c", "#a0603c", "#b97c4e", "#cc9866"] : RAMP.leaf;
  clumpMass(B, clumps, ramp, seed, { whole: (x, y) => [(x - cx) / 22, (y - (base - 34)) / 26] });
  if (kind === "apple") for (let i = 0; i < 6; i++) {
    const c = clumps[(i * 3 + 1) % clumps.length], a = R(60 + i) * 6.28, rr = c.r * 0.5;
    const x = Math.round(c.x + Math.cos(a) * rr), y = Math.round(c.y + Math.sin(a) * rr);
    B.set(x, y, RAMP.red[3]); B.set(x + 1, y, RAMP.red[2]); B.set(x, y + 1, RAMP.red[2]); B.set(x + 1, y + 1, RAMP.red[1]); B.set(x, y - 1, RAMP.red[4]);
  }
  B.outline(INK);
  return { buf: B, ax: cx, ay: base, shadow: { rx: 14, ry: 4, dy: 0 } };
}
function pine(seed = 1, leafRamp) {
  const W = 32, H = 64, B = new Buf(W, H), cx = 16, base = 61, Lf = leafRamp || ["#1e2e2c", "#2a4038", "#365442", "#46684c", "#46684c", "#5c7e58", "#749366"], Wd = RAMP.wood;
  for (let y = base - 8; y <= base; y++) for (let x = cx - 2; x < cx + 2; x++) B.set(x, y, x < cx - 1 ? Wd[4] : x > cx ? Wd[2] : Wd[3]);
  // 층층이 쌓인 삼각형 가지
  const tiers = [[base - 9, 14, 12], [base - 19, 12, 11], [base - 28, 10, 10], [base - 36, 7, 9], [base - 43, 4, 8]];
  for (const [by, half, th] of tiers) for (let y = by - th; y <= by; y++) {
    const k = (y - (by - th)) / th, hw = Math.round(half * k + 1);
    for (let x = cx - hw; x < cx + hw; x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let idx = u < 0.3 ? 5 : u < 0.6 ? 4 : u < 0.85 ? 3 : 2;
      if (y === by) idx = 1; else if (y === by - 1 && (x + y) % 2) idx = 2;
      if (idx >= 4 && hash(x, y, seed) < 0.12) idx = 6;
      B.set(x, y, Lf[idx]);
    }
  }
  B.outline(INK);
  return { buf: B, ax: cx, ay: base, shadow: { rx: 10, ry: 3, dy: 0 } };
}
function bush(seed = 1, berries = true, leafRamp) {
  const W = 22, H = 18, B = new Buf(W, H);
  const clumps = [{ x: 7, y: 10, r: 6 }, { x: 15, y: 10, r: 6 }, { x: 11, y: 7, r: 6.5 }, { x: 11, y: 12, r: 5.5 }];
  clumpMass(B, clumps, leafRamp || RAMP.leaf, seed, { whole: (x, y) => [(x - 11) / 10, (y - 9) / 8] });
  if (berries) for (let i = 0; i < 4; i++) { const x = 5 + Math.floor(hash(seed, i, 3) * 12), y = 5 + Math.floor(hash(seed, i, 4) * 8); B.set(x, y, RAMP.petal[2]); B.set(x + 1, y, RAMP.petal[1]); B.set(x, y - 1, RAMP.petal[3]); }
  B.outline(INK);
  return { buf: B, ax: 11, ay: H - 2, shadow: { rx: 9, ry: 2, dy: 0 } };
}
function rock(seed = 1) {
  const W = 16, H = 13, B = new Buf(W, H), St = RAMP.stone, cx = 8, cy = 8;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x + 0.5 - cx) / 7, ny = (y + 0.5 - cy) / 5;
    if (nx * nx + ny * ny * (ny < 0 ? 1 : 2.2) > 1 + (hash(x, y, seed) - 0.5) * 0.2) continue;
    const g = lit(nx, ny);
    B.set(x, y, ny > 0.5 ? St[2] : St[g > 0.5 ? 5 : g > 0 ? 4 : 3]);
  }
  B.set(cx, cy - 2, St[2]); B.set(cx + 1, cy - 1, St[2]); B.set(cx + 1, cy, St[1]); B.set(cx - 3, cy - 3, St[6]);
  B.outline(INK);
  return { buf: B, ax: cx, ay: H - 2, shadow: { rx: 7, ry: 2, dy: 0 } };
}
function stump(seed = 1) {
  const W = 16, H = 13, B = new Buf(W, H), Wd = RAMP.wood;
  for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) B.set(x, y, x < 5 ? Wd[4] : x > 10 ? Wd[2] : Wd[3]);
  for (let y = 1; y < 6; y++) for (let x = 3; x < 13; x++) { const nx = (x + 0.5 - 8) / 5, ny = (y + 0.5 - 3.5) / 2.5; if (nx * nx + ny * ny <= 1) B.set(x, y, (Math.round(Math.hypot(nx * 3, ny * 3)) % 2) ? Wd[5] : Wd[6]); }
  B.rect(2, 11, 3, 1, Wd[3]); B.rect(11, 11, 3, 1, Wd[2]);
  B.outline(INK);
  return { buf: B, ax: 8, ay: 11, shadow: { rx: 7, ry: 2, dy: 0 } };
}
function fence(n = 4) {
  const W = n * 8 + 3, H = 13, B = new Buf(W, H), Wd = RAMP.wood;
  for (const y of [4, 8]) { B.rect(0, y, W, 2, Wd[3]); B.rect(0, y, W, 1, Wd[5]); }
  for (let i = 0; i <= n; i++) { const x = i * 8; B.rect(x, 1, 3, 12, Wd[3]); B.rect(x, 1, 1, 12, Wd[5]); B.rect(x + 2, 1, 1, 12, Wd[2]); B.rect(x, 0, 3, 1, Wd[6]); }
  B.outline(INK);
  return { buf: B, ax: 0, ay: H - 1 };
}

return { tree, pine, bush, rock, stump, fence };
})();
const M_house16 = (() => {
  const { Buf, hash, INK } = M_art;
/* 건물 조립 키트 (16px 기준). 앞으로 박공이 보이는 지붕 + 벽 + 문·창·굴뚝·간판.
 * building({ w, wallH, roofDepth, gableH, wall, roof, door, windows, chimney, sign, gableWindow }) */

const MAT = {
  plank: ["#3a2a22", "#5a4030", "#7a583e", "#94704c", "#94704c", "#ac8a60", "#c2a276"],
  plaster: ["#6e5c4e", "#9a8470", "#bba48a", "#d2bea0", "#d2bea0", "#e2d2b8", "#eee4d0"],
  stone: ["#2e2e36", "#4a4b54", "#62646c", "#7a7c84", "#7a7c84", "#9698a0", "#b2b4b6"],
  log: ["#3a2618", "#5e3e28", "#7c5436", "#956a44", "#956a44", "#ae8458", "#c49e70"],
  timber: ["#2e1e18", "#4a3024", "#634232", "#7a5640", "#7a5640", "#8e6a50", "#a28062"],
  red: ["#3c2024", "#62302e", "#874236", "#a4553f", "#a4553f", "#bc6e50", "#cf8a66"],
  slate: ["#262c38", "#36404e", "#4a5666", "#5e6c7c", "#5e6c7c", "#76869a", "#90a0b0"],
  thatch: ["#4a3a20", "#6e5630", "#8e7240", "#a88c52", "#a88c52", "#c0a666", "#d4be80"],
  blue: ["#232a44", "#323e64", "#465886", "#5c72a4", "#5c72a4", "#7a90bc", "#98acd0"],
  green: ["#22362a", "#30503a", "#42684a", "#58845c", "#58845c", "#72a074", "#90ba8e"],
  gold: ["#4a3a1a", "#705828", "#987a36", "#b89648", "#b89648", "#ceb060", "#e2c87e"],
  purple: ["#30223e", "#46325a", "#5e4678", "#785e96", "#785e96", "#9278ae", "#ac96c6"],
  brick: ["#3a1e1c", "#5e2e28", "#844236", "#a05444", "#a05444", "#b86a56", "#cc8470"],
  teal: ["#22383a", "#30504e", "#426a64", "#58847a", "#58847a", "#72a092", "#90b8a8"],
  glass: ["#26324a", "#38506c", "#557a96", "#86a8bc", "#c0d6de"],
  green: ["#2a3c2c", "#3c5640", "#527456", "#6c9070", "#88aa86"],
  flower: ["#9a4a5a", "#c46a74", "#e0a0a0", "#e8c46a"],
};

function building(o) {
  const tw = o.w, Wp = tw * 16, ov = 3, wallH = o.wallH ?? 26, gableH = o.gableH ?? 18, depth = o.roofDepth ?? 22, fnd = 3;
  const ax = o.annex ? (o.annex.w || 22) : 0, padL = o.annex && o.annex.side === "left" ? ax : 0, padR = (o.annex && o.annex.side !== "left" ? ax : 0) + (o.sign && o.sign.x == null ? 12 : 0);
  const pd = o.porch ? (o.porch.depth || 8) : 0;
  const W = Wp + ov * 2 + 2 + padL + padR, cx = padL + (Wp + ov * 2 + 2) / 2, eaveY = depth + gableH + 4, baseY = eaveY + wallH + fnd, H = baseY + 1 + pd + (pd ? 2 : 0);
  const B = new Buf(W, H), Wm = MAT[o.wall], Rm = MAT[o.roof], Tm = MAT.timber;
  const left = cx - Wp / 2, right = cx + Wp / 2; // 벽 좌우
  const apexY = eaveY - gableH, topY = apexY - depth;
  const halfRoof = Wp / 2 + ov;
  const edgeY = (x) => apexY + (Math.abs(x + 0.5 - cx) / halfRoof) * gableH; // 박공 앞선의 높이
  // ---------------- 벽 (재질별 결)
  const wallPx = (x, y, top) => {
    const u = x - left, v = y - top;
    switch (o.wall) {
      case "plank": { const k = u % 5; return k === 0 ? Wm[1] : k === 1 ? Wm[5] : hash(Math.floor(u / 5), Math.floor(v / 7), 3) < 0.25 && k === 3 ? Wm[2] : Wm[3]; }
      case "log": { const k = (v + 100) % 5; return k === 4 ? Wm[1] : k === 0 ? Wm[5] : k === 3 ? Wm[2] : Wm[3]; }
      case "brick": { const row = Math.floor((v + 100) / 3), off = (row % 2) * 3, k = (u + off) % 6, j = (v + 100) % 3; return j === 2 || k === 0 ? MAT.plaster[2] : hash(Math.floor((u + off) / 6), row, 7) < 0.3 ? Wm[2] : j === 0 ? Wm[4] : Wm[3]; }
      case "stone": { const row = Math.floor((v + 100) / 5), off = (row % 2) * 4, k = (u + off) % 8, j = (v + 100) % 5; return j === 4 || k === 0 ? Wm[1] : j === 0 || k === 1 ? Wm[5] : hash(Math.floor((u + off) / 8), row, 7) < 0.3 ? Wm[2] : Wm[3]; }
      default: return hash(x >> 2, y >> 2, 5) < 0.08 ? Wm[2] : Wm[3];
    }
  };
  for (let y = eaveY; y < baseY - fnd; y++) for (let x = left; x < right; x++) B.set(x, y, wallPx(x, y, eaveY));
  // 박공 벽(삼각형)
  for (let y = apexY; y < eaveY; y++) for (let x = left; x < right; x++) if (y > edgeY(x) + 2) B.set(x, y, wallPx(x, y, eaveY));
  // 회벽은 나무 뼈대를 두른다
  if (o.wall === "plaster") {
    const beam = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let s = 0; s <= n; s++) { const x = Math.round(x0 + (x1 - x0) * s / n), y = Math.round(y0 + (y1 - y0) * s / n); B.set(x, y, Tm[3]); B.set(x + 1, y, Tm[2]); } };
    for (let x = left; x < right; x++) { B.set(x, eaveY, Tm[3]); B.set(x, eaveY + 1, Tm[2]); B.set(x, baseY - fnd - 2, Tm[3]); B.set(x, baseY - fnd - 1, Tm[2]); }
    for (const x of [left, right - 2, ...(o.posts || [])]) for (let y = eaveY; y < baseY - fnd; y++) { B.set(x, y, Tm[3]); B.set(x + 1, y, Tm[2]); }
    if (o.braces) for (const [x0, x1] of o.braces) beam(x0, baseY - fnd - 2, x1, eaveY + 1);
  }
  // 벽 그늘: 처마 밑 두 줄, 오른쪽 끝 한 줄
  for (let x = left; x < right; x++) { B.set(x, eaveY, Wm[1]); B.set(x, eaveY + 1, Wm[2]); }
  for (let y = eaveY; y < baseY - fnd; y++) B.set(right - 1, y, Wm[2]);
  // 주춧돌
  const St = MAT.stone;
  for (let y = baseY - fnd; y < baseY; y++) for (let x = left - 1; x < right + 1; x++) B.set(x, y, y === baseY - fnd ? St[5] : (x + (y % 2) * 3) % 7 === 0 ? St[1] : St[3]);
  // ---------------- 부속채 (외쪽 지붕을 단 낮은 칸)
  if (o.annex) {
    const R = o.annex.side !== "left", x0 = R ? right : left - ax, x1 = R ? right + ax : left, wTop = eaveY + 8, Rn = MAT[o.annex.roof || o.roof];
    for (let y = wTop; y < baseY - fnd; y++) for (let x = x0; x < x1; x++) {
      if (o.annex.kind === "woodpile") { // 통나무 단면을 쌓은 벽
        const row = Math.floor((y - wTop) / 4), cxl = x0 + 2 + ((row % 2) * 2) + Math.round((x - x0 - 2 - (row % 2) * 2) / 4) * 4, cyl = wTop + row * 4 + 2;
        const d = Math.hypot(x - cxl, (y - cyl) * 1.1);
        B.set(x, y, d < 1 ? MAT.log[5] : d < 1.8 ? MAT.log[4] : MAT.log[1]);
      } else B.set(x, y, (x - x0) % 5 === 0 ? MAT.plank[1] : (x - x0) % 5 === 1 ? MAT.plank[5] : MAT.plank[2]);
    }
    for (let x = x0; x < x1; x++) { B.set(x, wTop, MAT.timber[1]); B.set(x, wTop + 1, MAT.timber[2]); }
    for (let y = baseY - fnd; y < baseY; y++) for (let x = x0; x < x1; x++) B.set(x, y, y === baseY - fnd ? St[5] : St[3]);
    // 외쪽 지붕: 본채에서 바깥으로 내려간다
    for (let x = x0 - (R ? 0 : 2); x < x1 + (R ? 2 : 0); x++) {
      const t = R ? (x - x0) / ax : (x1 - x) / ax, eY = Math.round(wTop - 2 + t * 4), tY = Math.round(eaveY - 12 + t * 4);
      for (let y = tY; y <= eY; y++) { const k = (eY - y) % 4; B.set(x, y, y === eY ? MAT.timber[3] : k === 0 ? Rn[1] : k === 3 ? Rn[5] : (x + Math.floor((eY - y) / 4) * 3) % 6 === 0 ? Rn[2] : Rn[3]); }
    }
  }
  // ---------------- 지붕
  for (let y = topY; y < eaveY + 1; y++) for (let x = Math.floor(cx - halfRoof); x < cx + halfRoof; x++) {
    const e = edgeY(x);
    if (y > e + 2) continue; // 박공 벽 쪽
    if (y < Math.ceil(e - depth)) continue; // 뒤쪽 박공 선 위로는 하늘
    if (y === Math.ceil(e - depth)) { B.set(x, y, Tm[x + 0.5 < cx ? 4 : 3]); continue; } // 뒤쪽 장식널
    const leftSide = x + 0.5 < cx;
    if (y > e - 1) { B.set(x, y, Tm[y > e + 1 ? 2 : 4]); continue; } // 앞선 장식널
    // 기와 줄: 지붕면을 따라 비스듬히(앞선과 평행) 4px 간격
    const d = Math.floor(e - y), row = Math.floor(d / 4), k = d - row * 4;
    const along = Math.floor((x + (row % 2) * 3) / 6), seam = (x + (row % 2) * 3) % 6 === 0;
    const hi = leftSide ? Rm[5] : Rm[3], lo = leftSide ? Rm[3] : Rm[2];
    let c;
    if (o.roof === "thatch") {
      // 짚: 세로 결이 촘촘한 묶음, 묶음 아래 끝은 어둡다
      // 짚단을 층층이: 5px 층, 층 아래 끝은 들쭉날쭉한 그늘, 세로 결
      const r5 = Math.floor(d / 5), k5 = d - r5 * 5, strand = hash(x, r5, 4), rag = hash(x, r5, 7) < 0.45;
      c = k5 === 0 || (k5 === 1 && rag) ? Rm[1] : k5 === 4 && strand > 0.4 ? (leftSide ? Rm[6] : Rm[4]) : strand < 0.22 ? lo : hi;
    } else {
      // 비늘 기와: 아래 가장자리가 둥근 조각. 이음매는 조각 윗부분에만
      const u = (x + (row % 2) * 3) % 6;
      c = k === 0 ? Rm[1] : k === 1 && (u === 0 || u === 5) ? Rm[1] : k === 3 && u > 0 && u < 4 ? (leftSide ? Rm[6] : Rm[4]) : u === 0 && k >= 2 ? lo : hi;
      if (hash(along, row, 9) < 0.1 && k > 0 && u !== 0) c = lo; // 색이 조금 다른 조각
    }
    B.set(x, y, c);
  }
  // 눈: 지붕 뒤쪽 끝에서 앞으로 두껍게 덮이고, 기와 줄마다 조금씩 얹힌다
  if (o.snow) for (let x = Math.floor(cx - halfRoof); x < cx + halfRoof; x++) {
    const e = edgeY(x), top = Math.ceil(e - depth), cover = Math.floor(depth * 0.55 + hash(x >> 1, 3, 77) * 4);
    for (let y = top; y < top + cover && y < e - 1; y++) B.set(x, y, y === top ? "#ffffff" : (x + 0.5 < cx ? "#eef3f5" : "#d2dee4"));
    for (let y = top + cover; y < e - 1; y++) if (Math.floor(e - y) % 4 === 3 && hash(x, y, 78) < 0.55) B.set(x, y, x + 0.5 < cx ? "#eef3f5" : "#d2dee4");
  }
  // 용마루: 가운데 세로줄
  for (let y = topY; y < apexY + 1; y++) { B.set(Math.floor(cx) - 1, y, Rm[6]); B.set(Math.floor(cx), y, Rm[2]); }
  // 처마 끝 그림자를 벽에
  // ---------------- 박공 창
  if (o.gableWindow) { const gx = Math.floor(cx), gy = apexY + Math.floor(gableH * 0.62); for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const r = Math.hypot(x, y); if (r <= 3.3) B.set(gx + x, gy + y, r > 2.3 ? Tm[2] : (x === 0 || y === 0) ? Tm[3] : x + y < 0 ? MAT.glass[3] : MAT.glass[2]); } }
  // ---------------- 앞 데크 (널마루 + 계단)
  if (o.porch) {
    const Pm = MAT.plank, x0 = left - 2, x1 = right + 2;
    for (let y = baseY - 1; y < baseY + pd; y++) for (let x = x0; x < x1; x++) { const k = (y - baseY + 1) % 3; B.set(x, y, k === 2 ? Pm[1] : k === 0 ? Pm[5] : Pm[3]); }
    for (let x = x0; x < x1; x++) { B.set(x, baseY + pd, Pm[2]); B.set(x, baseY + pd + 1, Pm[1]); }
    for (const px of [x0, x1 - 2]) for (let y = baseY - 1; y < baseY + pd + 2; y++) { B.set(px, y, Pm[1]); B.set(px + 1, y, Pm[2]); }
  }
  // ---------------- 문
  const lights = [];
  if (o.door) {
    const dw = o.door.w || 12, dh = o.door.h || 25, dx = Math.round(left + (o.door.x ?? (Wp - dw) / 2)), dy = baseY - fnd - dh;
    const Dm = MAT[o.door.mat || "plank"];
    for (let y = dy - 2; y < baseY - fnd; y++) for (let x = dx - 2; x < dx + dw + 2; x++) B.set(x, y, Tm[x < dx || y < dy ? 4 : 2]);
    for (let y = dy; y < baseY - fnd; y++) for (let x = dx; x < dx + dw; x++) { const k = (x - dx) % 4; B.set(x, y, k === 0 ? Dm[1] : k === 1 ? Dm[5] : Dm[3]); }
    if (o.door.window) for (let y = dy + 3; y < dy + 7; y++) for (let x = dx + 3; x < dx + dw - 3; x++) B.set(x, y, y === dy + 3 ? MAT.glass[3] : MAT.glass[2]);
    B.set(dx + dw - 3, dy + 10, "#d8c070"); B.set(dx + dw - 3, dy + 11, "#8a6a30");
    if (o.porch) for (let x = dx - 1; x < dx + dw + 1; x++) { B.set(x, baseY + pd + 1, MAT.plank[5]); B.set(x, baseY + pd + 2, MAT.plank[2]); }
    else for (let x = dx - 3; x < dx + dw + 3; x++) { B.set(x, baseY - 1, St[5]); B.set(x, baseY, St[2]); }
    o._door = { x: dx + dw / 2, y: baseY + pd };
  }
  // ---------------- 창
  for (const wn of o.windows || []) {
    const x0 = Math.round(left + wn.x), y0 = eaveY + (wn.y ?? 6), ww = wn.w || 10, wh = wn.h || 9;
    if (wn.shutters) for (const sx of [x0 - 4, x0 + ww]) for (let y = y0; y < y0 + wh; y++) for (let x = sx; x < sx + 4; x++) B.set(x, y, (y - y0) % 3 === 0 ? MAT[wn.shutters][1] : x === sx ? MAT[wn.shutters][4] : MAT[wn.shutters][2]);
    for (let y = y0 - 1; y < y0 + wh + 1; y++) for (let x = x0 - 1; x < x0 + ww + 1; x++) B.set(x, y, Tm[y === y0 - 1 ? 4 : 2]);
    for (let y = y0; y < y0 + wh; y++) for (let x = x0; x < x0 + ww; x++) {
      const mid = x === x0 + (ww >> 1) || y === y0 + (wh >> 1);
      B.set(x, y, mid ? Tm[3] : (x - x0) + (y - y0) === 2 || (x - x0) + (y - y0) === 3 ? MAT.glass[4] : y < y0 + 2 ? MAT.glass[3] : MAT.glass[2]);
    }
    if (wn.box) { for (let x = x0 - 1; x < x0 + ww + 1; x++) { B.set(x, y0 + wh + 1, Tm[4]); B.set(x, y0 + wh + 2, Tm[2]); } for (let x = x0; x < x0 + ww; x += 2) { B.set(x, y0 + wh, MAT.flower[hash(x, y0, 1) < 0.5 ? 1 : 3]); B.set(x + 1, y0 + wh, MAT.green[3]); } }
    lights.push({ x: x0 + ww / 2, y: y0 + wh / 2, r: 22, k: 0.7 });
  }
  // ---------------- 굴뚝
  if (o.chimney) {
    const chx = Math.round(cx + halfRoof * (o.chimney.at ?? 0.5)), chTop = Math.round(edgeY(chx + 4) - depth) - 6, chBot = Math.round(edgeY(chx) - 6);
    for (let y = chTop; y < chBot; y++) for (let x = chx; x < chx + 8; x++) {
      if (y < 0) continue;
      const row = Math.floor((y - chTop) / 3), k = (x + (row % 2) * 2) % 4, j = (y - chTop) % 3;
      B.set(x, y, j === 2 || k === 0 ? St[1] : x === chx + 1 ? St[5] : St[3]);
    }
    for (let x = chx - 1; x < chx + 9; x++) { B.set(x, Math.max(0, chTop), St[5]); B.set(x, Math.max(0, chTop) + 1, St[2]); }
    o._chimney = { x: chx + 4, y: chTop };
  }
  // ---------------- 간판 (처마에 매단 나무판 + 그림)
  if (o.sign) {
    const sx = Math.round(o.sign.x != null ? left + o.sign.x : right + 1), sy = eaveY + 3;
    B.set(sx, sy - 2, Tm[2]); B.set(sx + 1, sy - 2, Tm[2]); B.set(sx + 2, sy - 2, Tm[2]); B.set(sx + 7, sy - 2, Tm[2]); B.set(sx + 8, sy - 2, Tm[2]);
    for (let y = sy; y < sy + 9; y++) for (let x = sx; x < sx + 10; x++) B.set(x, y, y === sy ? MAT.plank[5] : y === sy + 8 ? MAT.plank[1] : MAT.plank[3]);
    B.set(sx + 1, sy - 1, Tm[1]); B.set(sx + 8, sy - 1, Tm[1]);
    if (o.sign.icon) o.sign.icon(B, sx + 2, sy + 1);
  }
  B.outline(INK);
  return { buf: B, ax: Math.round(cx), ay: baseY + pd, shadow: null, lights, door: o._door, chimney: o._chimney, roofH: eaveY - topY, w: W, h: H };
}
/* 간판 그림 (6×6) */
const SIGN = {
  mug: (B, x, y) => { for (let j = 1; j < 6; j++) for (let i = 0; i < 4; i++) B.set(x + i, y + j, j === 1 ? "#f0e6c8" : "#d6a640"); B.set(x + 4, y + 2, "#8a6a30"); B.set(x + 5, y + 3, "#8a6a30"); B.set(x + 4, y + 4, "#8a6a30"); },
  anvil: (B, x, y) => { for (let i = 0; i < 6; i++) B.set(x + i, y + 2, "#3a3c44"); for (let i = 1; i < 5; i++) B.set(x + i, y + 1, "#6a6c74"); B.set(x + 2, y + 3, "#3a3c44"); B.set(x + 3, y + 3, "#3a3c44"); for (let i = 1; i < 5; i++) B.set(x + i, y + 4, "#3a3c44"); },
  bread: (B, x, y) => { for (let i = 0; i < 6; i++) for (let j = 2; j < 5; j++) B.set(x + i, y + j, j === 2 ? "#e0a860" : "#b87838"); B.set(x + 1, y + 2, "#f0c880"); B.set(x + 3, y + 2, "#f0c880"); },
};

return { MAT, building, SIGN };
})();
const M_person16 = (() => {
  const { Buf, INK } = M_art;
/* 16×32 인물. 손으로 찍은 틀(글자 그림)에 색 램프를 입힌다. 4방향 × 걷기 4프레임.
 * 글자: s/S/k 피부(기본/밝음/그늘) · h/H/j 머리 · c/C/d 윗옷 · p/P/q 바지 · b/B 신발 · e 눈 · i 눈동자 · r 볼 · m 입 · t 허리띠 · a/A/z 앞치마 */

const HEAD = {
  down: [
    "................", "................", "................", "................",
    "....ssssssss....", "...sSSssssssk...", "..sSSsssssssskk.", "..sSsssssssssk..",
    "..ssssssssssskk.", "..ssssssssssskk.", "..ssssssssssskk.", "..ssssssssssskk.",
    "..ssssssssssskk.", "...sssssssssk...", "....sssssskk....", "......kkkk......",
  ],
  side: [
    "................", "................", "................", "................",
    "....ssssssss....", "...sssssssSSs...", "..ssssssssSSss..", "..sssssssssssss.",
    "..sssssssssssss.", "..ssssssssssssss", "..ssssssssssssss", "..sssssssssssss.",
    "..kssssssssssss.", "...kssssssssss..", "....kkssssss....", ".....kkkk.......",
  ],
  up: [
    "................", "................", "................", "................",
    "....ssssssss....", "...ssssssssss...", "..ssssssssssss..", "..ssssssssssss..",
    "..ssssssssssss..", "..ssssssssssss..", "..ssssssssssss..", "..ssssssssssss..",
    "..ssssssssssss..", "...ssssssssss...", "....ssssssss....", "......kkkk......",
  ],
};
const FACE = {
  down: [[4, 9, "e"], [5, 9, "e"], [4, 10, "w"], [5, 10, "i"], [4, 11, "i"], [5, 11, "I"],
         [10, 9, "e"], [11, 9, "e"], [10, 10, "w"], [11, 10, "i"], [10, 11, "i"], [11, 11, "I"],
         [3, 12, "r"], [12, 12, "r"], [8, 12, "k"], [7, 13, "m"], [8, 13, "m"]],
  side: [[10, 9, "e"], [11, 9, "e"], [10, 10, "w"], [11, 10, "i"], [10, 11, "i"], [11, 11, "I"], [12, 12, "r"], [13, 13, "m"], [14, 10, "s"], [14, 11, "k"], [7, 10, "k"], [7, 11, "k"]],
  up: [],
};
/* 머리 모양: 방향별 틀. j 짙음 · h 기본 · H 밝음 · g 윤기. '.'은 비움 */
const TOP = ["................", "................", ".....hhhhhh.....", "...hhHgHHhhhh...", "..hHgHHhhhhhhj..", ".hHgHhhhjhhhhhj.", ".hHHhhhjhhhjhhj.", ".hhhhhjhhhhjhhj.", ".hhhjhhhhjhhhhj."];
const TOPS = ["................", "................", ".....hhhhhh.....", "...hhHgHHhhh....", "..hHgHHhhhhhh...", ".hHgHhhhhhhhhh..", ".hHHhhhjhhhhhhh.", ".hhhhhjhhhhjhhh.", ".hhhjhhhhhjhhh.h"];
const BACKTOP = ["................", "................", ".....hhhhhh.....", "...hhHgHHhhhh...", "..hHgHHhhhhhhj..", ".hHgHhhhhhhhhhj.", ".hHHhhjhhhjhhhj.", ".hhhhjhhhhjhhhj.", ".hhhjhhhhjhhhhj."];
const BUN = ["......jhhj......", ".....hHghhj.....", ".....hhhhjj....."];
const HAIR = {
  short: {
    down: [...TOP, ".hh...jhh....hj.", ".hj..........hj.", "..j..........j.."],
    side: [...TOPS, ".hhjhhhj.h......", ".hjhhhj.........", ".jhhhhj.........", "..jhhj..........", "...jj..........."],
    up: [...BACKTOP, ".hhjhhhhjhhhhjj.", ".hhjhhhjhhhhhjj.", ".jhhhhhjhhhhjjj.", "..jhhhhhhhhhjj..", "...jjhhhhhjjj...", "......jjjj......"],
  },
  long: {
    down: [...TOP, ".hh...jhh....hj.", ".hhj.........hj.", ".hHj........jhj.", ".hhj........jhj.", ".hhj........jhj.", ".hhj........jhj.", ".hjj........jjj.", ".jj..........jj."],
    side: [...TOPS, ".hhjhhhj.h......", ".hjhhhj.........", ".hhhhhj.........", ".hhhhj..........", ".hHhhj..........", ".hhhhj..........", ".jhhj...........", "..jj............"],
    up: [...BACKTOP, ".hhjhhhhjhhhhjj.", ".hhjhhhjhhhhhjj.", ".hhjhhhjhhhhjhj.", ".hHjhhhjhhhhjhj.", ".hhjhhhjhhhhjhj.", ".hhjhhhjhhhjjhj.", ".jhjhhhjhhhjjjj.", ".jjjjhjjjhjjjj..", "..jj..jj..jj...."],
  },
  bun: {
    down: [BUN[0], BUN[1], BUN[2], ...TOP.slice(3), ".hh...jhh....hj.", ".hj..........hj.", "..j..........j.."],
    side: ["...jhhj.........", "..hHghhj........", "..hhhhjj........", ...TOPS.slice(3), ".hhjhhhj.h......", ".hjhhhj.........", ".jhhhhj.........", "..jhhj..........", "...jj..........."],
    up: [BUN[0], BUN[1], BUN[2], ...BACKTOP.slice(3), ".hhjhhhhjhhhhjj.", ".jhhhhhjhhhhjjj.", "..jhhhhhhhhhjj..", "...jjhhhhhjjj...", "......jjjj......"],
  },
};
const lighten = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * f)); return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); };
const darken = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - f))); return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); };


/* 모자: 숫자 글자 1(짙음)·2(기본)·3(밝음)·4·5·6(장식). y는 머리 틀 기준 위치(음수면 머리 위로) */
const sideOf = (rows) => rows;
const HATS = {
  straw: { pal: { 1: "#8a6a30", 2: "#c8a050", 3: "#e4c478", 4: "#a24a2e" },
    down: { y: 1, rows: ["................", ".....333333.....", "....33222222....", "....34444441....", "3333222222221111", ".22222222222211.", "..111111111111.."] },
    side: { y: 1, rows: ["................", ".....33333......", "....3322222.....", "....3444441.....", ".333222222221111", "..22222222222211", "...111111111111."] },
    up: { y: 1, rows: ["................", ".....333333.....", "....33222222....", "....34444441....", "3333222222221111", ".22222222222211.", "..111111111111.."] } },
  chef: { pal: { 1: "#b8b4aa", 2: "#e8e6e0", 3: "#ffffff", 4: "#c8c2b4" },
    down: { y: -5, rows: ["....333.333.....", "...33332223.....", "...333222222....", "...322222221....", "....2222221.....", "....2222221.....", "....4444441.....", "...222222221...."] },
    side: { y: -5, rows: [".....333.33.....", "....3332223.....", "....3322222.....", "....3222221.....", ".....222221.....", ".....222221.....", ".....444441.....", "....22222221...."] },
    up: { y: -5, rows: ["....333.333.....", "...33332223.....", "...333222222....", "...322222221....", "....2222221.....", "....2222221.....", "....4444441.....", "...222222221...."] } },
  wizard: { pal: { 1: "#2a2440", 2: "#46407a", 3: "#6a62a8", 4: "#d6b45a", 5: "#f0dc8a" },
    down: { y: -8, rows: ["..........11....", ".........121....", "........2221....", ".......32221....", "......322221....", ".....3222221....", ".....3225221....", "....32222221....", "....34444441....", "..3322222222211.", ".222222222222211", "..111111111111.."] },
    side: { y: -8, rows: ["....11..........", "....121.........", "....1222........", "....12223.......", "....122223......", "....1222223.....", "....1225223.....", "....12222223....", "....14444443....", "..3322222222211.", ".222222222222211", "..111111111111.."] },
    up: { y: -8, rows: ["..........11....", ".........121....", "........2221....", ".......32221....", "......322221....", ".....3222221....", ".....3222221....", "....32222221....", "....34444441....", "..3322222222211.", ".222222222222211", "..111111111111.."] } },
  helmet: { pal: { 1: "#3a3c48", 2: "#7a7e8c", 3: "#b4b8c2", 4: "#5a5e6a", 5: "#e0e2e6" },
    down: { y: 1, rows: [".....355333.....", "...3332222221...", "..332222222211..", ".33222222222211.", ".32222222222221.", ".44444444444441.", ".32..........21.", ".32..........21.", ".1............1."] },
    side: { y: 1, rows: [".....355333.....", "...3332222221...", "..332222222211..", ".33222222222211.", ".32222222222221.", ".44444444444441.", ".322222.........", ".322222.........", ".11111.........."] },
    up: { y: 1, rows: [".....355333.....", "...3332222221...", "..332222222211..", ".33222222222211.", ".32222222222221.", ".44444444444441.", ".32222222222221.", ".32222222222221.", ".11111111111111."] } },
  hood: { pal: { 1: "#3a2a22", 2: "#6a5040", 3: "#8e705a" },
    down: { y: 1, rows: [".....222222.....", "...2233222221...", "..223322222221..", ".22332222222221.", ".2332222222.221.", ".232..........1.", ".22...........1.", ".22...........1.", ".21..........11.", ".21..........11.", "..11........11.."] },
    side: { y: 1, rows: [".....222222.....", "...22332222.....", "..2233222222....", ".22332222222....", ".23322222222....", ".2322222........", ".222222.........", ".222222.........", ".22222..........", ".2222...........", "..11............"] },
    up: { y: 1, rows: [".....222222.....", "...2233222221...", "..223322222221..", ".22332222222221.", ".23322222222221.", ".23222222222221.", ".22222222222221.", ".22222222222221.", ".22222222222211.", ".12222222222211.", "..112222222211..", "....11111111...."] } },
  beanie: { pal: { 1: "#2e4a4a", 2: "#4a7470", 3: "#6e9a92", 4: "#d8d0b8", 5: "#efe8d4" },
    down: { y: 0, rows: ["......55........", ".....335333.....", "...3332222221...", "..332222222221..", ".3322222222221..", ".45454545454541.", ".44444444444441."] },
    side: { y: 0, rows: [".......55.......", ".....335333.....", "...3332222221...", "..332222222221..", ".3322222222221..", ".45454545454541.", ".44444444444441."] },
    up: { y: 0, rows: ["......55........", ".....335333.....", "...3332222221...", "..332222222221..", ".3322222222221..", ".45454545454541.", ".44444444444441."] } },
  cap: { pal: { 1: "#2a3a5a", 2: "#3d5a8a", 3: "#5a7aaa", 4: "#e2b84a" },
    down: { y: 2, rows: [".....333333.....", "...3332222221...", "..332222222221..", ".33222222222221.", ".22444444444421.", "..111111111111.."] },
    side: { y: 2, rows: [".....33333......", "...3332222221...", "..332222222221..", ".332222222222221", ".224444444442222", "...111111111111."] },
    up: { y: 2, rows: [".....333333.....", "...3332222221...", "..332222222221..", ".33222222222221.", ".22222222222221.", "..111111111111.."] } },
  bandana: { pal: { 1: "#5a2a2a", 2: "#8a4038", 3: "#b05a48", 4: "#e8d8b0" },
    down: { y: 4, rows: ["..332222222211..", ".3224222242222..", ".222222222222211"] },
    side: { y: 4, rows: ["..332222222211..", ".3224222242222..", ".222222222222211"] },
    up: { y: 4, rows: ["..332222222211..", ".3222222222222..", ".222222222222211", ".......22.......", "......2..2......"] } },
  crown: { pal: { 1: "#3e6a3a", 2: "#5e8a4a", 4: "#e8a0b0", 5: "#f0d878", 6: "#fff4d8" },
    down: { y: 4, rows: [".24.25.24.25.24.", "2.22.22.22.22.21"] },
    side: { y: 4, rows: [".24.25.24.25....", "2.22.22.22.21..."] },
    up: { y: 4, rows: [".25.24.25.24.25.", "2.22.22.22.22.21"] } },
  ribbon: { pal: { 4: "#c0485a", 5: "#e47886", 1: "#8a2a3a" },
    down: { y: 2, rows: ["..........4.4...", ".........45144..", "..........4.4..."] },
    side: { y: 3, rows: [".4.4............", "45144...........", ".4.4............"] },
    up: { y: 2, rows: ["...4.4..........", "..44154.........", "...4.4.........."] } },
};
/* 손에 든 것: ax·ay = 손이 쥐는 곳. back이면 뒷모습에서 등 뒤로 보인다 */
const PROPS = {
  hammer: { ax: 2, ay: 4, pal: { 1: "#3a3c44", 2: "#7a7e88", 3: "#b4b8c0", 4: "#7a5436", 5: "#a07448" }, rows: ["12222", "13332", "12221", "..45.", "..45.", "..45."] },
  staff: { ax: 1, ay: 9, back: true, pal: { 1: "#2a4a6a", 4: "#6a4630", 5: "#5a9ad0", 6: "#c8ecff", 7: "#94704a" }, rows: [".5.", "565", "515", ".5.", ".7.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4."] },
  sword: { ax: 1, ay: 10, back: true, pal: { 1: "#4a3a22", 2: "#8a909c", 3: "#e4e8ee", 4: "#c49a3a", 5: "#7a2a2a" }, rows: [".3.", ".32", ".32", ".32", ".32", ".32", ".32", ".32", "4444", ".1.", ".1.", ".5."] },
  basket: { ax: 2, ay: 0, pal: { 1: "#5a3a22", 2: "#9a7040", 3: "#c49a5a", 4: "#d04a4a", 5: "#e8c070" }, rows: [".111.", "1...1", "24542", "23332", "22222", ".222."] },
  book: { ax: 1, ay: 1, pal: { 1: "#3a2030", 2: "#8a3a4a", 3: "#efe4c8", 4: "#d6b45a" }, rows: ["22222", "24332", "23332", "23332", "11111"] },
};
const RAMPS = {
  skin: { fair: ["#c48464", "#ecb48e", "#f8d2b0"], tan: ["#9a5c3e", "#c8865e", "#dca47a"], deep: ["#5e3626", "#87523a", "#a06a4c"], pale: ["#c89a8a", "#f0d0c0", "#fce6da"], green: ["#5e7e52", "#86a874", "#a4c08e"], scale: ["#7a6a8c", "#a08eb2", "#bcaecc"] },
  hair: { brown: ["#3e2a22", "#6a4632", "#8e6444"], black: ["#1e1c26", "#34303e", "#4c4656"], blond: ["#8a6a30", "#c8a050", "#e4c478"], red: ["#6a2a1e", "#a24a2e", "#c86a40"], white: ["#8c8c96", "#c4c4c8", "#e8e8e6"], blue: ["#26385a", "#3e5a86", "#6080aa"], green: ["#2e4a34", "#4c7050", "#6e9468"] },
  cloth: { blue: ["#2e4058", "#46627e", "#6486a0"], red: ["#5a2a2a", "#8a4038", "#a85a4a"], green: ["#2e4632", "#4a6a48", "#6a8a5e"], cream: ["#8a7a62", "#c4b292", "#ddd0b2"], purple: ["#3e2e4e", "#5e4874", "#7e6694"], brown: ["#4a3426", "#6e5038", "#8e6c4c"], gray: ["#3a3c44", "#5a5e66", "#7c8088"] },
};

/** look: { skin, hair, hairStyle, shirt, pants, boots, eye, apron, hat, ears, horns, tail, beard } — 각 색은 3톤 램프
 *  종족 조각: ears "long"|"animal"|"fin"|"small" · horns 모양 "long"|"short"|"curl"|"crown" (hornColor) · tail "thin"|"fluffy"|"scale"
 *  marks "stripes"|"spots"|"scales" (markColor) — 새 종족은 이 조각들을 골라 조합한다 */
function personFrame(L, dir, frame) {
  const OX = 2, OY = 8, B = new Buf(20, 40), view = dir === "left" || dir === "right" ? "side" : dir;
  const pal = {
    s: L.skin[1], S: L.skin[2], k: L.skin[0], h: L.hair[1], H: L.hair[2], j: L.hair[0],
    c: L.shirt[1], C: L.shirt[2], d: L.shirt[0], p: L.pants[1], P: L.pants[2], q: L.pants[0],
    b: L.boots ? L.boots[1] : "#5a3e30", B: L.boots ? L.boots[0] : "#3a2620",
    g: lighten(L.hair[2], 0.35), w: "#ffffff", I: darken(L.eye || "#3e5a86", 0.35),
    e: INK, i: L.eye || "#3e5a86", r: "#e8908a", m: "#8a4a44", t: L.belt || "#5a3a28",
    o: "#e6dcc0", O: "#a8987a", W: lighten(L.shirt[2], 0.55), N: darken(L.shirt[0], 0.3), n: "#e8dcb8", y: "#d8b45a", F: lighten(L.boots ? L.boots[1] : "#5a3e30", 0.3),
    v: L.vest ? L.vest[1] : null, V: L.vest ? L.vest[2] : null, u: L.vest ? L.vest[0] : null,
    a: L.apron ? L.apron[1] : null, A: L.apron ? L.apron[2] : null, z: L.apron ? L.apron[0] : null,
    x: L.markColor || darken(L.skin[0], 0.25), X: lighten(L.markColor || L.skin[1], 0.25),
  };
  if (L.hornColor) { pal.o = L.hornColor; pal.O = darken(L.hornColor, 0.3); }
  const put = (x, y, ch) => { if (ch && ch !== "." && pal[ch]) B.set(x + OX, y + OY, pal[ch]); };
  const paint = (rows, ox, oy, P) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (P[ch]) B.set(x + ox + OX, y + oy + OY + bob, P[ch]); }));
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = step ? -1 : 0;
  const tmpl = (rows, ox = 0, oy = 0) => rows.forEach((r, y) => [...r].forEach((ch, x) => put(x + ox, y + oy + bob, ch)));
  // ---- 꼬리 (몸 뒤)
  if (L.tail && view !== "up") {
    const T = L.tail === "fluffy" ? [".HHh", "hHhh", "hhhj", ".hj.", "hj.."] : L.tail === "scale" ? ["..sk", ".skk", "sKk.", "sk..", "k..."] : ["..hh", ".hhj", "hhj.", "hj.."];
    tmpl(T.map((r) => r.replace(/K/g, "x")), view === "side" ? 2 : 11, L.tail === "fluffy" || L.tail === "scale" ? 19 : 20);
  }
  if (L.prop && PROPS[L.prop] && view === "up" && PROPS[L.prop].back) { const Pp = PROPS[L.prop]; paint(Pp.rows, 11 - Pp.ax, 21 - Pp.ay, Pp.pal); }
  const top = L.top || "shirt", over = L.over || null, bottom = top === "robe" ? "robe" : L.bottom || "pants";
  const U = (x, y, ch) => put(x, y + bob, ch); // 윗몸은 걸을 때 1px 오르내린다
  // ---- 다리·신발
  if (view === "side") {
    const legs = step === 0 ? [[6, "q"], [7, "p"]] : [[6 - step, "q"], [7 + step, "p"]];
    for (const [x0, tone] of legs) {
      const y0 = bottom === "skirt" ? 26 : 23 + bob;
      if (bottom !== "robe") for (let y = y0; y < 28; y++) for (let x = x0; x < x0 + 3; x++) put(x, y, bottom === "skirt" ? "q" : tone === "q" ? "q" : x === x0 ? "P" : "p");
      for (let x = x0; x < x0 + 4; x++) { put(x, 28, x === x0 + 1 ? "F" : "b"); put(x, 29, "B"); }
    }
  } else {
    const lift = (side) => (step === 0 ? 0 : (view === "down" ? side === step : side !== step) ? 1 : 0);
    for (const [x0, side] of [[5, 1], [9, -1]]) {
      const l = lift(side), y0 = bottom === "skirt" ? 26 : 25 + bob;
      if (bottom !== "robe") for (let y = y0; y < 28 - l; y++) for (let x = x0; x < x0 + 2; x++) put(x, y, bottom === "skirt" ? "q" : x === x0 && side > 0 ? "P" : x === x0 + 1 && side < 0 ? "q" : "p");
      const sx = side > 0 ? 4 : 9;
      if (side < 0) { put(8, 28 - l, null); }
      for (let x = sx; x < sx + 3; x++) { put(x, 28 - l, x === sx + 1 ? "F" : "b"); put(x, 29 - l, "B"); }
    }
  }
  // ---- 하의 윗부분·치마·로브 자락
  const torsoX = view === "side" ? [6, 11] : [5, 11];
  if (bottom === "pants") for (let y = 23; y < 25; y++) for (let x = torsoX[0]; x < torsoX[1]; x++) U(x, y, x === torsoX[0] ? "P" : x === torsoX[1] - 1 ? "q" : "p");
  if (bottom === "skirt") { const rows = view === "side" ? [[6, 11], [5, 11], [5, 12], [5, 12]] : [[5, 11], [4, 12], [4, 12], [4, 12]]; rows.forEach(([x0, x1], j) => { for (let x = x0; x < x1; x++) U(x, 23 + j, j === 3 ? "q" : x === x0 ? "P" : x >= x1 - 2 ? "q" : "p"); }); }
  if (bottom === "robe") { const rows = view === "side" ? [[6, 11], [5, 11], [5, 11], [5, 12], [5, 12]] : [[5, 11], [4, 12], [4, 12], [4, 12], [4, 12]]; rows.forEach(([x0, x1], j) => { for (let x = x0; x < x1; x++) U(x, 23 + j, j === 4 ? "d" : x === x0 ? "C" : x >= x1 - 2 ? "d" : "c"); }); }
  // ---- 몸통
  for (let y = 16; y < 23; y++) for (let x = torsoX[0]; x < torsoX[1]; x++) {
    if (y === 22) { U(x, y, (x === 7 || x === 8) && view === "down" && top !== "robe" ? "y" : "t"); continue; }
    U(x, y, x === torsoX[0] ? "C" : x === torsoX[1] - 1 ? "d" : "c");
  }
  for (const x of view === "side" ? [] : [4, 11]) U(x, 16, x === 4 ? "C" : "d"); // 어깨
  if (view === "down") {
    if (top === "shirt") { U(6, 16, "W"); U(9, 16, "W"); U(7, 16, "k"); U(8, 16, "k"); U(7, 17, "d"); U(8, 17, "W"); U(8, 19, "N"); U(8, 21, "N"); }
    else { U(7, 16, "k"); U(8, 16, "k"); U(7, 17, "d"); U(8, 17, "d"); }
  } else if (view === "side") { if (top === "shirt") { U(9, 16, "W"); U(10, 16, "W"); U(10, 17, "W"); } else U(10, 16, "k"); }
  else if (top === "shirt") for (let x = 6; x < 10; x++) U(x, 16, "W");
  // ---- 덧옷
  if (over === "vest") {
    if (view === "down") for (let y = 17; y < 22; y++) { U(5, y, "V"); U(6, y, y === 21 ? "u" : "v"); U(9, y, y === 21 ? "u" : "v"); U(10, y, "u"); if (y === 18 || y === 20) U(6, y, "n"); }
    else if (view === "up") for (let y = 17; y < 22; y++) for (let x = 5; x < 11; x++) U(x, y, x === 5 ? "V" : x === 10 ? "u" : "v");
    else for (let y = 17; y < 22; y++) { U(6, y, "V"); U(7, y, "v"); U(10, y, "u"); }
  }
  if (over === "overalls") {
    if (view === "down") { U(6, 16, "p"); U(9, 16, "p"); U(6, 17, "p"); U(9, 17, "p"); for (let y = 18; y < 22; y++) for (let x = 6; x < 10; x++) U(x, y, x === 6 ? "P" : x === 9 ? "q" : "p"); U(6, 18, "y"); U(9, 18, "y"); for (let x = 5; x < 11; x++) U(x, 22, x === 5 ? "P" : x === 10 ? "q" : "p"); }
    else if (view === "up") { for (let y = 16; y < 22; y++) { U(6 + Math.floor((y - 16) / 3), y, "p"); U(9 - Math.floor((y - 16) / 3), y, "p"); } for (let x = 5; x < 11; x++) U(x, 22, "p"); }
    else { for (let y = 18; y < 23; y++) { U(9, y, "p"); U(10, y, "q"); } U(9, 17, "p"); U(9, 16, "p"); }
  }
  if (over === "apron") {
    if (view === "down") { U(6, 16, "A"); U(9, 16, "A"); U(6, 17, "a"); U(9, 17, "a"); for (let y = 18; y < 28; y++) for (let x = (y < 21 ? 6 : 5); x < (y < 21 ? 10 : 11); x++) U(x, y, y === 18 || y === 21 ? "A" : y === 24 ? "z" : x >= (y < 21 ? 9 : 10) ? "z" : "a"); }
    else if (view === "up") for (let x = 5; x < 11; x++) U(x, 22, "z");
    else for (let y = 17; y < 28; y++) { U(10, y, y < 21 ? "a" : "a"); U(11, y, y >= 21 ? "z" : null); }
  }
  // ---- 팔: 소매·소맷부리·손
  const arm = (x0, dy, near) => {
    for (let y = 17 + dy; y < 23 + dy; y++) for (let x = x0; x < x0 + 2; x++) {
      const cuff = y === 20 + dy, hand = y >= 21 + dy;
      U(x, y, hand ? (near ? "s" : "k") : cuff ? (top === "robe" ? "d" : "W") : near ? (x === x0 ? "C" : "c") : "d");
    }
  };
  if (view === "side") arm(7 + step, 0, true);
  else if (view === "down") { arm(3, -step, true); arm(11, step, false); }
  else { arm(3, step, true); arm(11, -step, false); }
  // ---- 머리
  tmpl(HEAD[view], 0, 0);
  for (const [x, y, ch] of FACE[view]) put(x, y, ch);
  if (L.beard && view !== "up") tmpl(view === "side" ? ["........hhhhhh..", ".......hhhhhhh..", "........hhhhh...", ".........hhh...."] : ["..hh........hh..", "..hhhhhmmhhhhj..", "...hhhhhhhhhj...", "....hhhhhhhj....", ".....jhhhhj....."], view === "side" ? 0 : 0, 11);
  tmpl(HAIR[L.hairStyle || "short"][view], 0, 0);
  // ---- 무늬 (얼굴과 손등): 줄무늬·점박이·비늘
  if (L.marks && view !== "up") {
    const M = view === "side"
      ? { stripes: [[9, 6, "x"], [10, 6, "x"], [12, 7, "x"], [13, 7, "x"], [11, 14, "x"]], spots: [[9, 6, "x"], [12, 8, "x"], [7, 12, "x"], [11, 13, "x"]], scales: [[8, 12, "x"], [9, 13, "X"], [10, 12, "x"], [7, 13, "X"], [6, 12, "x"]] }
      : { stripes: [[2, 10, "x"], [3, 10, "x"], [12, 10, "x"], [13, 10, "x"], [7, 6, "x"], [8, 6, "x"], [2, 12, "x"], [13, 12, "x"]], spots: [[3, 7, "x"], [12, 6, "x"], [2, 12, "x"], [13, 13, "x"], [6, 6, "x"]], scales: [[2, 11, "x"], [3, 12, "X"], [2, 13, "x"], [13, 11, "x"], [12, 12, "X"], [13, 13, "x"]] };
    for (const [x, y, ch] of M[L.marks] || []) put(x, y + bob, ch);
  }
  if (L.ears === "fin" && view !== "up") { if (view === "down") tmpl(["S..............k", "sx............xk", "sS............kx", ".x............x."], 0, 8); else tmpl(["....S...........", "....xS..........", "....sx..........", ".....x.........."], 0, 8); }
  if (L.ears === "small" && view !== "up") { if (view === "down") tmpl([".S............k.", ".sS..........kk."], 0, 8); else tmpl([".....S..........", ".....sk.........."], 0, 8); }
  if (L.ears === "long" && view !== "up") { if (view === "down") tmpl(["S..............k", "sS............kk", ".ss..........kk."], 0, 8); else tmpl(["....S...........", "....sS..........", ".....sk........."], 0, 8); }
  if (L.ears === "animal") { tmpl(view === "side" ? ["...hh...........", "..hHhj..........", "..hhhj.........."] : ["..hh.......hh...", ".hHhj.....hHhj..", ".hhhj.....hhhj.."].map((r) => r.slice(0, 16)), 0, 0); }
  const HORN = {
    long: { down: ["................", ".oo..........oo.", ".Ooo........ooO.", "..Oo........oO.."], side: ["..........", "..oo......", "..Ooo.....", "...Oo....."], up: ["................", ".oo..........oo.", ".Ooo........ooO."] },
    short: { down: ["................", "................", "..oo........oo..", "..Oo........oO.."], side: ["..........", "..........", "...oo.....", "...Oo....."], up: ["................", "................", "..oo........oo.."] },
    curl: { down: ["oo............oo", "O.o..........o.O", ".Oo..........oO.", "..Oo........oO.."], side: ["..........", ".ooo......", "O..o......", ".OOo......"], up: ["oo............oo", "O.o..........o.O", ".Oo..........oO."] },
    crown: { down: ["...o...oo...o...", "...O..oOOo..O...", "...OooOooOooO...", "................"], side: ["..........", "....o.o...", "....OoOo..", ".........."], up: ["...o...oo...o...", "...O..oOOo..O...", "...OooOooOooO..."] },
  };
  if (L.horns) { const hs = HORN[L.horns] || HORN.long; tmpl((hs[view] || hs.down).map((r) => r.padEnd(16, ".")), 0, 0); }
  // ---- 모자 (머리 위에 얹는 독립 조각: 방향별 틀 + 자기 색)
  if (L.hat && HATS[L.hat]) {
    const H = HATS[L.hat], P = { ...H.pal, ...(L.hatPal ? { 1: L.hatPal[0], 2: L.hatPal[1], 3: L.hatPal[2] } : {}) };
    const v = H[view] || H.down;
    paint(v.rows, v.x || 0, v.y, P);
  }
  // ---- 손에 든 것 (손 위치에 붙이고, 손가락을 다시 위에 그린다)
  if (L.prop && PROPS[L.prop]) {
    const Pp = PROPS[L.prop], hand = view === "side" ? [7 + step, 21] : view === "down" ? [3, 21 - step] : [3, 21 + step];
    if (view !== "up") {
      paint(Pp.rows, hand[0] - Pp.ax, hand[1] - Pp.ay, Pp.pal);
      U(hand[0], hand[1], "s"); U(hand[0] + 1, hand[1], "s");
    }
  }
  B.outline(INK);
  if (dir === "left") { const F = new Buf(20, 40); F.blit(B, 0, 0, true); return F; }
  return B;
}
function personSheet(L) {
  const out = {};
  for (const d of ["down", "left", "right", "up"]) out[d] = [0, 1, 2, 3].map((f) => personFrame(L, d, f));
  return out;
}

return { HATS, PROPS, RAMPS, personFrame, personSheet };
})();
root.Art16 = Object.assign({}, M_art, M_props16, M_house16, M_person16);
})(typeof window !== "undefined" ? window : globalThis);
