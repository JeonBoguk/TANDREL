/* 16×32 인물. 손으로 찍은 틀(글자 그림)에 색 램프를 입힌다. 4방향 × 걷기 4프레임.
 * 글자: s/S/k 피부(기본/밝음/그늘) · h/H/j 머리 · c/C/d 윗옷 · p/P/q 바지 · b/B 신발 · e 눈 · i 눈동자 · r 볼 · m 입 · t 허리띠 · a/A/z 앞치마 */
import { Buf, INK } from "./art.js";

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
export const HATS = {
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
export const PROPS = {
  hammer: { ax: 2, ay: 4, pal: { 1: "#3a3c44", 2: "#7a7e88", 3: "#b4b8c0", 4: "#7a5436", 5: "#a07448" }, rows: ["12222", "13332", "12221", "..45.", "..45.", "..45."] },
  staff: { ax: 1, ay: 9, back: true, pal: { 1: "#2a4a6a", 4: "#6a4630", 5: "#5a9ad0", 6: "#c8ecff", 7: "#94704a" }, rows: [".5.", "565", "515", ".5.", ".7.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4.", ".4."] },
  sword: { ax: 1, ay: 10, back: true, pal: { 1: "#4a3a22", 2: "#8a909c", 3: "#e4e8ee", 4: "#c49a3a", 5: "#7a2a2a" }, rows: [".3.", ".32", ".32", ".32", ".32", ".32", ".32", ".32", "4444", ".1.", ".1.", ".5."] },
  basket: { ax: 2, ay: 0, pal: { 1: "#5a3a22", 2: "#9a7040", 3: "#c49a5a", 4: "#d04a4a", 5: "#e8c070" }, rows: [".111.", "1...1", "24542", "23332", "22222", ".222."] },
  book: { ax: 1, ay: 1, pal: { 1: "#3a2030", 2: "#8a3a4a", 3: "#efe4c8", 4: "#d6b45a" }, rows: ["22222", "24332", "23332", "23332", "11111"] },
};
export const RAMPS = {
  skin: { fair: ["#c48464", "#ecb48e", "#f8d2b0"], tan: ["#9a5c3e", "#c8865e", "#dca47a"], deep: ["#5e3626", "#87523a", "#a06a4c"], pale: ["#c89a8a", "#f0d0c0", "#fce6da"], green: ["#5e7e52", "#86a874", "#a4c08e"], scale: ["#7a6a8c", "#a08eb2", "#bcaecc"] },
  hair: { brown: ["#3e2a22", "#6a4632", "#8e6444"], black: ["#1e1c26", "#34303e", "#4c4656"], blond: ["#8a6a30", "#c8a050", "#e4c478"], red: ["#6a2a1e", "#a24a2e", "#c86a40"], white: ["#8c8c96", "#c4c4c8", "#e8e8e6"], blue: ["#26385a", "#3e5a86", "#6080aa"], green: ["#2e4a34", "#4c7050", "#6e9468"] },
  cloth: { blue: ["#2e4058", "#46627e", "#6486a0"], red: ["#5a2a2a", "#8a4038", "#a85a4a"], green: ["#2e4632", "#4a6a48", "#6a8a5e"], cream: ["#8a7a62", "#c4b292", "#ddd0b2"], purple: ["#3e2e4e", "#5e4874", "#7e6694"], brown: ["#4a3426", "#6e5038", "#8e6c4c"], gray: ["#3a3c44", "#5a5e66", "#7c8088"] },
};

/** look: { skin, hair, hairStyle, shirt, pants, boots, eye, apron, hat, ears, horns, tail, beard } — 각 색은 3톤 램프
 *  종족 조각: ears "long"|"animal"|"fin"|"small" · horns 모양 "long"|"short"|"curl"|"crown" (hornColor) · tail "thin"|"fluffy"|"scale"
 *  marks "stripes"|"spots"|"scales" (markColor) — 새 종족은 이 조각들을 골라 조합한다 */
export function personFrame(L, dir, frame) {
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
export function personSheet(L) {
  const out = {};
  for (const d of ["down", "left", "right", "up"]) out[d] = [0, 1, 2, 3].map((f) => personFrame(L, d, f));
  return out;
}
