import { Buf } from "./art.js";
import { paintGround, waterFx } from "./ground16.js";
import { tree, pine, bush, rock, stump, fence } from "./props16.js";
const MAP = [
  "GGGGGGGGGGGGWWWW",
  "GGGGGGGGGGGGWWWW",
  "GGGGGGGGGGGGGWWW",
  "GGGDDGGGGGGGGWWW",
  "GGGDDDDDDDDDDGWW",
  "GGGGGGGGGGDDGGGW",
  "GGGGGGGGGGGDGGGG",
  "GGGGGGGGGGGDDGGG",
  "GGGGGGGGGGGGDGGG",
];
const g = paintGround(MAP), W = g.buf.w, H = g.buf.h;
const props = [
  { ...tree(2, "apple"), x: 40, y: 52 }, { ...tree(5), x: 128, y: 40 }, { ...pine(3), x: 170, y: 34 }, { ...pine(6), x: 186, y: 50 },
  { ...tree(7, "autumn"), x: 22, y: 140 }, { ...tree(9), x: 228, y: 132 },
  { ...bush(3), x: 92, y: 56 }, { ...bush(8, false), x: 150, y: 110 }, { ...rock(4), x: 196, y: 92 }, { ...rock(9), x: 70, y: 118 },
  { ...stump(1), x: 110, y: 124 }, { ...fence(5), x: 60, y: 98 },
];
export function render(canvas, t) {
  const out = new Buf(W, H); out.px.set(g.buf.px); waterFx(out, g, t);
  const ents = props.slice().sort((a, b) => a.y - b.y);
  for (const e of ents) { const s = e.shadow; if (!s) continue; for (let y = -s.ry; y <= s.ry; y++) for (let x = -s.rx; x <= s.rx; x++) if ((x / s.rx) ** 2 + (y / s.ry) ** 2 <= 1) out.shade(e.x + x, e.y + y + s.dy, 0.3); }
  for (const e of ents) out.blit(e.buf, Math.round(e.x - e.ax), Math.round(e.y - e.ay));
  canvas.width = W; canvas.height = H;
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(out.px.buffer.slice(0)), W, H), 0, 0);
}
