import { Buf } from "./art.js";
import { paintGround, waterFx } from "./ground16.js";
import { tree, pine, bush, rock, fence } from "./props16.js";
import { building, SIGN } from "./house16.js";
import { SHEETS } from "./cast.js";
const MAP = [
  "GGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
  "GDDDDDDDDDDDDDDDDDDG",
  "GGGGDGGGGGGGGDGGGGGG",
  "GGGGDGGGGGGGGDGGGGGG",
  "GGGGDGGGGGGGGDGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGG",
];
const g = paintGround(MAP), W = g.buf.w, H = g.buf.h;
const home = building({ w: 5, wall: "plank", wallH: 32, roof: "red", door: { window: true }, windows: [{ x: 6, shutters: "green", box: true }, { x: 64, shutters: "green", box: true }], chimney: { at: 0.5 }, gableWindow: true, porch: { depth: 7 }, annex: { side: "right", kind: "woodpile", w: 20 } });
const inn = building({ w: 6, wall: "plaster", roof: "teal", wallH: 34, posts: [40, 54], braces: [[3, 14], [93, 82]], door: { w: 14 }, windows: [{ x: 14, y: 8, w: 12 }, { x: 66, y: 8, w: 12 }], chimney: { at: -0.55 }, sign: { icon: SIGN.mug }, gableWindow: true });
const smith = building({ w: 4, wall: "stone", wallH: 32, roof: "slate", door: { w: 14, x: 4, mat: "log" }, windows: [{ x: 44, y: 7, w: 10 }], chimney: { at: 0.45 }, sign: { icon: SIGN.anvil }, annex: { side: "left", kind: "shed", w: 18 } });
const hut = building({ w: 3, wall: "log", roof: "thatch", gableH: 14, roofDepth: 18, wallH: 29, door: { w: 10, h: 23 }, windows: [{ x: 34, y: 6, w: 8, h: 7 }] });
const props = [
  { ...home, x: 66, y: 84 }, { ...smith, x: 252, y: 78 }, { ...inn, x: 196, y: 172 },
  { ...hut, x: 44, y: 170 }, { ...tree(2, "apple"), x: 152, y: 66 }, { ...pine(3), x: 312, y: 172 }, { ...tree(5), x: 116, y: 176 },
  { ...bush(3), x: 14, y: 86 }, { ...bush(6, false), x: 300, y: 112 }, { ...rock(4), x: 140, y: 120 }, { ...fence(4), x: 90, y: 128 },
];
const WALK = [[0, "right", 30, 96, 1], [1, "down", 0, 0, 0, 252, 100], [2, "left", 290, 94, 1], [3, "down", 0, 0, 0, 216, 142], [4, "right", 120, 98, 0.7], [5, "up", 0, 0, 0, 70, 128], [6, "down", 0, 0, 0, 108, 86]];
export function render(canvas, t) {
  const out = new Buf(W, H); out.px.set(g.buf.px); waterFx(out, g, t);
  const people = WALK.map(([i, dir, x0, y0, sp, sx, sy]) => {
    const moving = !!sp, f = moving ? Math.floor(t * 7) % 4 : 0;
    const x = moving ? (dir === "right" ? x0 + ((t * 14 * sp) % 120) : x0 - ((t * 14 * sp) % 120)) : sx, y = moving ? y0 : sy;
    return { buf: SHEETS[i][dir][f], ax: 10, ay: 38, x, y, shadow: { rx: 5, ry: 1, dy: 0 } };
  });
  const ents = props.concat(people).sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.shadow) { const s = e.shadow; for (let y = -s.ry; y <= s.ry; y++) for (let x = -s.rx; x <= s.rx; x++) if ((x / s.rx) ** 2 + (y / s.ry) ** 2 <= 1) out.shade(e.x + x, e.y + y + s.dy, 0.3); }
    else if (e.roofH) for (let y = 1; y < 6; y++) for (let x = 0; x < e.w - 4; x++) out.shade(e.x - e.ax + 3 + x + y, e.y + y - 1, 0.3 * (1 - y / 6)); // 건물 그림자
  }
  for (const e of ents) out.blit(e.buf, Math.round(e.x - e.ax), Math.round(e.y - e.ay));
  canvas.width = W; canvas.height = H;
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(out.px.buffer.slice(0)), W, H), 0, 0);
}
