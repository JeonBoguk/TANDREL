/* 건물 조립 키트 (16px 기준). 앞으로 박공이 보이는 지붕 + 벽 + 문·창·굴뚝·간판.
 * building({ w, wallH, roofDepth, gableH, wall, roof, door, windows, chimney, sign, gableWindow }) */
import { Buf, hash, INK } from "./art.js";

export const MAT = {
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

export function building(o) {
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
export const SIGN = {
  mug: (B, x, y) => { for (let j = 1; j < 6; j++) for (let i = 0; i < 4; i++) B.set(x + i, y + j, j === 1 ? "#f0e6c8" : "#d6a640"); B.set(x + 4, y + 2, "#8a6a30"); B.set(x + 5, y + 3, "#8a6a30"); B.set(x + 4, y + 4, "#8a6a30"); },
  anvil: (B, x, y) => { for (let i = 0; i < 6; i++) B.set(x + i, y + 2, "#3a3c44"); for (let i = 1; i < 5; i++) B.set(x + i, y + 1, "#6a6c74"); B.set(x + 2, y + 3, "#3a3c44"); B.set(x + 3, y + 3, "#3a3c44"); for (let i = 1; i < 5; i++) B.set(x + i, y + 4, "#3a3c44"); },
  bread: (B, x, y) => { for (let i = 0; i < 6; i++) for (let j = 2; j < 5; j++) B.set(x + i, y + j, j === 2 ? "#e0a860" : "#b87838"); B.set(x + 1, y + 2, "#f0c880"); B.set(x + 3, y + 2, "#f0c880"); },
};
