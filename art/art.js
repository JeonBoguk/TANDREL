/* 새 도트 시안: 32px 타일, 명암 램프, 빛 레이어.
 * 모든 그림은 코드로 찍는다(이미지 파일 없음). 색은 램프(어두움→밝음)에서만 고른다. */

// ------------------------------------------------------------ 색
/* 재질마다 실제로는 세 톤(그림자·기본·밝음)과 선·반짝임만 쓴다. 같은 색이 반복되는 칸은 일부러 같게 둔 것 */
export const RAMP = {
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
export const INK = "#2a2226";
const U32 = new Map();
export function u32(hex) {
  let v = U32.get(hex);
  if (v !== undefined) return v;
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  U32.set(hex, v);
  return v;
}

// ------------------------------------------------------------ 잡음
export const hash = (a, b, c = 0) => { let n = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;

// ------------------------------------------------------------ 버퍼
export class Buf {
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
