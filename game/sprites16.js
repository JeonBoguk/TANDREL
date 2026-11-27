/* 작은 그림들: 작물·동물·들풀·천막·표지판·유적·흙더미. 글자 틀 + 색표 → 외곽선을 두른 캔버스.
 * 모두 오른쪽을 본다(왼쪽은 뒤집어 그린다). 발밑 기준점 ax·ay. */
(function (root) {
  "use strict";
  const ART = root.Art16;
  if (!ART) return;
  const INK = ART.INK;
  const cache = new Map();
  function make(rows, pal, opt = {}) {
    const H = rows.length, W = Math.max(...rows.map((r) => r.length)), B = new ART.Buf(W + 2, H + 2);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { const c = pal[ch]; if (c) B.set(x + 1, y + 1, opt.white ? "#ffffff" : c); }));
    if (opt.outline !== false) B.outline(opt.white ? "#ffffff" : opt.ink || INK);
    const c = document.createElement("canvas"); c.width = B.w; c.height = B.h;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(B.px.buffer.slice(0)), B.w, B.h), 0, 0);
    return c;
  }
  const get = (key, f) => { let v = cache.get(key); if (!v) { v = f(); cache.set(key, v); } return v; };

  // ---------------------------------------------------------------- 작물
  const LEAF = { d: "#2f4738", g: "#4f7250", G: "#71a05c", s: "#6a8a3a" };
  const CROP_PAL = {
    turnip: { ...LEAF, p: "#7a4a7a", P: "#a06aa0", w: "#d8d0c8", W: "#f4f0ea" },
    potato: { ...LEAF, f: "#f0ecd8", o: "#8a6440", O: "#b08a5a" },
    wheat: { ...LEAF, y: "#c8a050", Y: "#e4c478", s: "#a8884a" },
    strawberry: { ...LEAF, r: "#b4403a", R: "#e0705a" },
    pumpkin: { ...LEAF, o: "#c8662a", O: "#e48a3a", x: "#9a4a20" },
  };
  const STAGE = [
    ["......G.G.....", ".......gg.....", ".......d......"],
    ["......G..G....", ".....Ggg.gG...", "......gdgg....", ".......dd....."],
    ["....G......G..", "...Ggg..G.ggG.", "....gGgGggGg..", ".....dggggd...", "......dddd....", ".......dd....."],
  ];
  const RIPE = {
    turnip: ["....G.....G...", "...Ggg.G.ggG..", "....gdgggdg...", ".....ddgdd....", "......pppp....", ".....pPPPPp...", ".....wWWWWw...", "......wwww....", ".......ww....."],
    potato: ["...G...G..G...", "..GggG.gGggG..", "..gggggggggg..", "...dggfgggd...", "....ddddddd...", "...oO..oO.....", "...oo..oo....."],
    wheat: ["..y.y.y.y.y...", "..Y.Y.Y.Y.Y...", "..YyYyYyYyY...", "..s.s.s.s.s...", "..s.s.s.s.s...", "..s.s.s.s.s...", "..sssssssss..."],
    strawberry: ["....G....G....", "...GggG.GggG..", "..gggrggggrgg.", "..dgRrdggRrd..", "...rr.dd.rr...", "....r.....r..."],
    pumpkin: [".....G.dd.....", "....GggdG.....", "...ooOOOOoo...", "..oOOoOOoOOo..", "..oOoooOoooo..", "..ooxooxooxo..", "...oooooooo..."],
  };
  const DEAD = ["......b..b....", ".......bb.....", "......bbbb...."];
  function crop(type, stage) {
    return get(`c${type}${stage}`, () => {
      const pal = CROP_PAL[type] || CROP_PAL.turnip, rows = stage < 0 ? DEAD : stage < 3 ? STAGE[stage] : RIPE[type] || STAGE[2];
      const c = make(rows, { ...pal, b: "#7a6040" });
      return { c, ax: 8, ay: c.height - 2 };
    });
  }

  // ---------------------------------------------------------------- 동물 (두 프레임: 0 서기·1 뛰기)
  const ANIM = {
    rabbit: { pal: { w: "#d8d0c4", W: "#f0ebe2", e: INK, k: "#e0909a", d: "#b0a698" },
      f: [[".......ww...", ".......wW...", "......wwww..", "..wwwwwwwek.", ".wWWwwwwwww.", ".wwwwwwwwd..", "..wd...wd..."],
          [".......ww...", ".......wW...", "......wwww..", "..wwwwwwwek.", ".wWWwwwwwww.", ".wwwwwwwwd..", ".wd.....wd.."]] },
    chicken: { pal: { w: "#e8e2d6", W: "#ffffff", r: "#c84a3a", e: INK, y: "#e0a030", d: "#b8ae9e" },
      f: [[".......rr...", "......wwwr..", "......wwew..", ".......wwyy.", "..ww..www...", ".wWwwwwww...", ".wwwwwwdw...", "..wwwwdd....", "....y..y...."],
          [".......rr...", "......wwwr..", "......wwew..", ".......wwyy.", "..ww..www...", ".wWwwwwww...", ".wwwwwwdw...", "..wwwwdd....", "...y....y..."]] },
    deer: { pal: { a: "#6a5040", b: "#9a6a40", B: "#be8a58", d: "#6e4a2c", t: "#efe6d4", e: INK, n: "#3a2a22" },
      f: [["...........a.a..", "............a...", "...........bbb..", "...........bebn.", "..........bbb...", "..bbbbbbbbbb....", ".tbBBBBBBbbb....", "..bbbbbbbbbb....", "..bBbbbbbbd.....", "..b.b....b.b....", "..b.b....b.b....", "..d.d....d.d...."],
          [["...........a.a.."], ["............a..."], ["...........bbb.."], ["...........bebn."], ["..........bbb..."], ["..bbbbbbbbbb...."], [".tbBBBBBBbbb...."], ["..bbbbbbbbbb...."], ["..bBbbbbbbd....."], [".b...b..b...b..."], [".b...b..b...b..."], [".d...d..d...d..."]].flat()] },
    boar: { pal: { d: "#3a281c", b: "#5a3d2b", B: "#7a5a40", s: "#efe6d0", e: INK, n: "#8a6a5a", w: "#efe6d0" },
      f: [["...dddddd.......", "..dbbbbbbbbd....", ".dbbBBBbbbbbbs..", ".dbbbbbbbbbebbn.", ".dbbbbbbbbbbbbw.", "..bbbbbbbbbbb...", "..bb.bb..bb.bb..", "..dd.dd..dd.dd.."],
          ["...dddddd.......", "..dbbbbbbbbd....", ".dbbBBBbbbbbbs..", ".dbbbbbbbbbebbn.", ".dbbbbbbbbbbbbw.", "..bbbbbbbbbbb...", ".bb..bb.bb..bb..", ".dd..dd.dd..dd.."]] },
    wolf: { pal: { g: "#7a7e88", G: "#a4a8b0", d: "#4a4e58", e: "#e8c040", n: INK, w: "#d8dade" },
      f: [["...........g.g..", "..........ggg...", "gg........gegG..", ".ggggggggggggn..", "..gGGGGgggggw...", "..gggggggggg....", "..g.g....g.g....", "..d.d....d.d...."],
          ["...........g.g..", "..........ggg...", "gg........gegG..", ".ggggggggggggn..", "..gGGGGgggggw...", "..gggggggggg....", ".g...g..g...g...", ".d...d..d...d..."]] },
  };
  function animal(type, frame, hurt) {
    return get(`a${type}${frame}${hurt ? 1 : 0}`, () => {
      const A = ANIM[type] || ANIM.rabbit, c = make(A.f[frame % 2], A.pal, { white: hurt });
      return { c, ax: Math.round(c.width / 2), ay: c.height - 2 };
    });
  }

  // ---------------------------------------------------------------- 들풀·소품
  const OBJ = {
    herb: { pal: { d: "#2f4738", g: "#4f8a4a", G: "#86b866", w: "#e8f0c8" }, rows: ["......G.G.....", ".....GgGgG....", "....gGwdgGg...", ".....gdgdg....", "......ddd....."] },
    herbSmall: { pal: { d: "#2f4738", g: "#4f7250" }, rows: [".......g......", "......gd......"] },
    shroom: { pal: { r: "#b4403a", R: "#d86a54", w: "#f2ecdc", s: "#d8ccb4" }, rows: ["...rRr........", "..rRwRr..rr...", "..rrrrr.rRwr..", "....s...rrrr..", "....s.....s...", "....s.....s..."] },
    tent: { pal: { a: "#8a7450", b: "#bca47a", B: "#d8c49a", d: "#5a4630", o: "#3a2a22", p: "#6a4630" }, rows: ["..........p.........", ".........bBp........", "........bbBBp.......", ".......bbbBBap......", "......bbbbBBaap.....", ".....bbbbBoBaaap....", "....bbbbBooBaaaap...", "...bbbbbBooBaaaaap..", "..bbbbbbBooBaaaaaap.", ".dddddddddddddddddd."] },
    sign: { pal: { a: "#7f5c45", A: "#ad8a68", d: "#4d362b", t: "#33241f" }, rows: [".AAAAAAAAAA.", ".aaaaaaaaaa.", ".atttttttaa.", ".aaaaaaaaaa.", ".attttttaaa.", ".dddddddddd.", ".....da.....", ".....da.....", ".....da.....", ".....da....."] },
    ruin: { pal: { s: "#868890", S: "#a2a4a8", T: "#bfc0c0", d: "#55565e", m: "#678a5e", M: "#82a26e" }, rows: ["..TTSS..........", "..SSSs..........", "..Sssd....TTS...", "..Sssd....SSsd..", "..Sm sd...Sssd..", "..Ssdsd...Ssmd..", "..Sssd....Sssd..", "..Mssd....SssdM.", ".mMmsdm..mSmsdm.", "mmmmmmm.mmmmmmmm"] },
    mound: { pal: { o: "#80603f", O: "#9c784e", P: "#b89060", d: "#5e4230" }, rows: ["....OPPPO.....", "..OOPPPOOoo...", ".oOOOOOooood..", "ooooooooodddd."] },
  };
  const FLOWER_C = [["#d6bc66", "#ece0a0"], ["#dcdcd6", "#ffffff"], ["#b494b8", "#d8c0d6"], ["#7894c6", "#a8bce0"]];
  function obj(kind, v) {
    if (kind === "flower") return get(`f${v}`, () => { const [a, b] = FLOWER_C[v % 4], c = make(["..A.....B....", ".AaA...BbB...", "..A.g..gB....", "..g..g.g.....", "...g.gg......"], { A: a, a: b, B: a, b: b, g: "#4f7250" }); return { c, ax: 7, ay: c.height - 2 }; });
    return get(`o${kind}`, () => { const O = OBJ[kind], c = make(O.rows, O.pal); return { c, ax: Math.round(c.width / 2), ay: c.height - 2 }; });
  }
  root.Spr16 = { crop, animal, obj };
})(typeof window !== "undefined" ? window : globalThis);
