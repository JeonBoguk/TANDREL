/* 16px 소품: 나무·덤불·바위·그루터기·울타리. 빛은 왼쪽 위. 굵은 외곽선 + 덩어리 안쪽 선. */
import { RAMP, Buf, hash, fbm, INK } from "./art.js";

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

export function tree(seed = 1, kind = "oak", leafRamp) {
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
export function pine(seed = 1, leafRamp) {
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
export function bush(seed = 1, berries = true, leafRamp) {
  const W = 22, H = 18, B = new Buf(W, H);
  const clumps = [{ x: 7, y: 10, r: 6 }, { x: 15, y: 10, r: 6 }, { x: 11, y: 7, r: 6.5 }, { x: 11, y: 12, r: 5.5 }];
  clumpMass(B, clumps, leafRamp || RAMP.leaf, seed, { whole: (x, y) => [(x - 11) / 10, (y - 9) / 8] });
  if (berries) for (let i = 0; i < 4; i++) { const x = 5 + Math.floor(hash(seed, i, 3) * 12), y = 5 + Math.floor(hash(seed, i, 4) * 8); B.set(x, y, RAMP.petal[2]); B.set(x + 1, y, RAMP.petal[1]); B.set(x, y - 1, RAMP.petal[3]); }
  B.outline(INK);
  return { buf: B, ax: 11, ay: H - 2, shadow: { rx: 9, ry: 2, dy: 0 } };
}
export function rock(seed = 1) {
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
export function stump(seed = 1) {
  const W = 16, H = 13, B = new Buf(W, H), Wd = RAMP.wood;
  for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) B.set(x, y, x < 5 ? Wd[4] : x > 10 ? Wd[2] : Wd[3]);
  for (let y = 1; y < 6; y++) for (let x = 3; x < 13; x++) { const nx = (x + 0.5 - 8) / 5, ny = (y + 0.5 - 3.5) / 2.5; if (nx * nx + ny * ny <= 1) B.set(x, y, (Math.round(Math.hypot(nx * 3, ny * 3)) % 2) ? Wd[5] : Wd[6]); }
  B.rect(2, 11, 3, 1, Wd[3]); B.rect(11, 11, 3, 1, Wd[2]);
  B.outline(INK);
  return { buf: B, ax: 8, ay: 11, shadow: { rx: 7, ry: 2, dy: 0 } };
}
export function fence(n = 4) {
  const W = n * 8 + 3, H = 13, B = new Buf(W, H), Wd = RAMP.wood;
  for (const y of [4, 8]) { B.rect(0, y, W, 2, Wd[3]); B.rect(0, y, W, 1, Wd[5]); }
  for (let i = 0; i <= n; i++) { const x = i * 8; B.rect(x, 1, 3, 12, Wd[3]); B.rect(x, 1, 1, 12, Wd[5]); B.rect(x + 2, 1, 1, 12, Wd[2]); B.rect(x, 0, 3, 1, Wd[6]); }
  B.outline(INK);
  return { buf: B, ax: 0, ay: H - 1 };
}
