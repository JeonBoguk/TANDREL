/* 16px 땅. 큰 도트(4배)로 본다. 경계는 부드럽게 이은 뒤 잡음으로 흔든다. */
import { RAMP, Buf, hash, fbm, vnoise } from "./art.js";

export const TS = 16;
const sm = (t) => t * t * (3 - 2 * t);

export function terrainField(map) {
  const H = map.length, W = map[0].length, w = W * TS, h = H * TS;
  const at = (tx, ty) => map[Math.max(0, Math.min(H - 1, ty))][Math.max(0, Math.min(W - 1, tx))];
  const smooth = (ch, x, y) => {
    const fx = x / TS - 0.5, fy = y / TS - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = sm(fx - x0), v = sm(fy - y0);
    const k = (tx, ty) => (at(tx, ty) === ch ? 1 : 0);
    return k(x0, y0) * (1 - u) * (1 - v) + k(x0 + 1, y0) * u * (1 - v) + k(x0, y0 + 1) * (1 - u) * v + k(x0 + 1, y0 + 1) * u * v;
  };
  const f = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (fbm(x / 9, y / 9, 3) - 0.5) * 0.5;
    let c = 0;
    if (smooth("D", x, y) + n > 0.5) c = 1;
    if (smooth("W", x, y) + n * 0.7 > 0.5) c = 2;
    f[y * w + x] = c;
  }
  return { f, w, h };
}
function distTo(field, pred) {
  const { f, w, h } = field, d = new Int16Array(w * h).fill(999), q = [];
  for (let i = 0; i < w * h; i++) if (pred(f[i])) { d[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

export function paintGround(map) {
  const field = terrainField(map), { f, w, h } = field, B = new Buf(w, h);
  const toWater = distTo(field, (v) => v === 2), toLand = distTo(field, (v) => v !== 2), toDirt = distTo(field, (v) => v === 1);
  const G = RAMP.grass, D = RAMP.dirt, Wt = RAMP.water, S = RAMP.sand;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = f[i];
    if (t === 2) {
      const d = toLand[i] + (fbm(x / 14, y / 14, 5) - 0.5) * 3;
      B.set(x, y, d < 2.5 ? Wt[5] : Wt[3]);
      continue;
    }
    if (toWater[i] <= 2) { B.set(x, y, toWater[i] === 1 ? S[1] : S[3]); continue; }
    if (t === 1) { B.set(x, y, fbm(x / 10, y / 10, 11) > 0.63 ? D[4] : D[3]); continue; }
    B.set(x, y, fbm(x / 22, y / 22, 1) > 0.6 ? G[4] : G[3]);
  }
  // 흙 결: 짧은 가로 붓질(위는 밝고 아래는 어둡게)
  for (let gy = 0; gy < h; gy += 3) for (let gx = 0; gx < w; gx += 5) {
    const x = gx + Math.floor(hash(gx, gy, 13) * 5), y = gy + Math.floor(hash(gx, gy, 14) * 3);
    if (f[y * w + x] !== 1 || toDirt[y * w + x] !== 0 || hash(gx, gy, 15) > 0.4) continue;
    const L = 2 + Math.floor(hash(gx, gy, 16) * 2);
    for (let k = 0; k < L; k++) if (f[y * w + x + k] === 1) B.set(x + k, y, D[2]);
    if (hash(gx, gy, 17) < 0.3) B.set(x, y - 1, D[5]);
  }
  // 자갈
  for (let gy = 0; gy < h; gy += 6) for (let gx = 0; gx < w; gx += 6) {
    const x = gx + Math.floor(hash(gx, gy, 5) * 6), y = gy + Math.floor(hash(gx, gy, 6) * 6);
    if (f[y * w + x] !== 1 || toDirt[y * w + x] !== 0 || hash(gx, gy, 7) > 0.07) continue;
    B.set(x, y, RAMP.stone[5]); B.set(x + 1, y, RAMP.stone[4]); B.set(x, y + 1, RAMP.stone[2]); B.set(x + 1, y + 1, D[1]);
  }
  // 풀 포기: 잡음으로 듬성한 곳과 빽빽한 곳을 나누고, 크기도 섞는다
  const small = [[-1, 0, 2], [0, 0, 2], [-1, -1, 4], [0, -1, 5]];
  const mid = [[-1, 0, 2], [0, 0, 2], [1, 0, 2], [-1, -1, 4], [0, -1, 3], [1, -1, 4], [-1, -2, 5], [1, -2, 5]];
  const tall = [[-1, 0, 2], [0, 0, 2], [1, 0, 2], [2, 0, 2], [-1, -1, 3], [0, -1, 4], [1, -1, 3], [2, -1, 4], [-1, -2, 4], [0, -2, 5], [2, -2, 5], [0, -3, 6], [-1, -3, 5]];
  for (let gy = 0; gy < h; gy += 3) for (let gx = 0; gx < w; gx += 4) {
    const x = gx + Math.floor(hash(gx, gy, 1) * 4), y = gy + Math.floor(hash(gx, gy, 2) * 3);
    if (f[y * w + x] !== 0 || toWater[y * w + x] < 4 || toDirt[y * w + x] < 3) continue;
    const dens = vnoise(x / 13, y / 13, 41), r = hash(gx, gy, 3), up = fbm(x / 22, y / 22, 1) > 0.6 ? 1 : 0;
    if (r < 0.012) { flower(B, x, y, hash(gx, gy, 4)); continue; }
    if (r > dens * 0.75 - 0.1) continue;
    const shape = r < dens * 0.18 ? tall : r < dens * 0.45 ? mid : small;
    for (const [dx, dy, k] of shape) B.set(x + dx, y + dy, G[Math.min(6, k + up)]);
  }
  // 풀과 흙의 경계: 흙 쪽에 어두운 테, 풀잎이 늘어진다
  for (let y = 0; y < h - 2; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (f[i] === 0 && f[i + w] === 1) { B.set(x, y + 1, D[1]); if (hash(x, y, 12) < 0.45) { B.set(x, y + 1, G[2]); B.set(x, y + 2, D[1]); } B.set(x, y, G[5]); }
    else if (f[i] === 1 && f[i + w] === 0) { B.set(x, y, D[1]); B.set(x, y + 1, G[2]); }
    else if (f[i] === 0 && ((x > 0 && f[i - 1] === 1) || (x < w - 1 && f[i + 1] === 1))) B.set(x, y, G[2]);
  }
  // 물가: 모래와 물 사이 거품 줄은 waterFx에서
  return { buf: B, field, toWater, toLand };
}
function flower(B, x, y, r) {
  const P = r < 0.4 ? RAMP.white : r < 0.75 ? RAMP.yellow : RAMP.petal;
  B.set(x, y, RAMP.grass[2]); B.set(x, y - 1, P[2]); B.set(x - 1, y - 1, P[1]); B.set(x + 1, y - 1, P[1]); B.set(x, y - 2, P[3]);
}
export function waterFx(out, g, t) {
  const { field, toLand } = g, { f, w, h } = field, Wt = RAMP.water;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (f[i] !== 2) continue;
    const d = toLand[i];
    if (d === 1 && Math.sin(t * 2.2 + x * 0.6 + y * 0.4) > 0.2) out.set(x, y, Wt[7]);
    else if (d > 3 && y % 3 === 0) {
      const ph = (x + t * 3 + hash(0, y) * 100) / 13, k = ph - Math.floor(ph);
      if (k < 0.2 && vnoise(x / 14, y / 6 + t * 0.15, 77) > 0.5) out.set(x, y, Wt[6]);
    }
  }
}
