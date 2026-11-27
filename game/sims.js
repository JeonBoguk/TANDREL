/* 업무 조작 화면 (window.Sims)
 * 업무(works)는 단계의 나열이고, 단계마다 조작 부품(tool) 하나를 쓴다. 이 파일은 부품의 '손'(플레이어가 직접 하는 화면)과
 * 단계를 차례로 이어 주는 진행기다. 부품의 자동 점수(주민·맡기기)는 engine.js의 TOOL_AUTO에 있다.
 *
 * 새 부품 더하기:
 *   Sims.register("id", { name, how: "조작 설명 한 줄", play(ctx) { ...; return 정리함수; } })
 *   ctx = { box(그릴 곳), p(단계 값), lv(솜씨 1~4), ease(솜씨에 따른 여유 배수), done(점수 0~1), press(콜백 등록) }
 *   그리고 엔진에 자동 점수 모델: Asteria.registerTool("id", (p, lv, rng, n) => 0~1)
 * 둘 다 있어야 그 부품을 쓰는 업무가 열린다.
 *
 * 입력: Space(또는 화면 누르기) = 누르기. 연마는 ←/→ 또는 화면 왼쪽·오른쪽. 선 따라가기는 끌기. Esc = 그만두기 */
(function (root) {
  "use strict";
  const G = root.Game, A = root.Asteria;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const css = (name) => (root.getComputedStyle ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : "") || "#888";
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) e.setAttribute(k, v); }
    for (const c of kids.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : String(c));
    return e;
  };

  /** 그림판: 폭에 맞춘 캔버스와 색 */
  function stage(box, h = 120) {
    const c = el("canvas", { class: "simcv", role: "img" });
    box.append(c);
    const dpr = root.devicePixelRatio || 1, W = Math.max(240, Math.min(520, box.clientWidth || 360));
    c.width = W * dpr; c.height = h * dpr; c.style.width = W + "px"; c.style.height = h + "px";
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    const col = { bg: css("--sunk"), line: css("--line-2"), text: css("--text"), dim: css("--text-3"), zone: css("--ok"), accent: css("--accent"), warn: css("--warn"), bad: css("--danger") };
    return { c, g, W, H: h, col };
  }
  /** 매 프레임 (초 단위 dt, 경과 t). stop()으로 멈춘다 */
  function loop(fn) {
    let on = true, last = performance.now(), t = 0;
    const f = (now) => { if (!on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; fn(dt, t); if (on) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    return () => { on = false; };
  }
  const bar = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const label = (g, text, x, y, color, align = "left") => { g.fillStyle = color; g.font = "13px " + (css("--font") || "sans-serif"); g.textAlign = align; g.fillText(text, x, y); };
  /** 구간을 솜씨만큼 넓힌다 */
  const widen = ([a, b], ease) => { const m = (a + b) / 2, h = ((b - a) / 2) * ease; return [clamp(m - h, 0, 1), clamp(m + h, 0, 1)]; };

  /** 글자 무늬: 씨앗 문자열로 정해지는 5×5 좌우 대칭 도트 (낯선 문자, 증상, 기도문 표식) */
  function glyph(seed) {
    let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const cells = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) { h = Math.imul(h ^ (h >>> 13), 1274126177); if ((h >>> 8) % 100 < 48) { cells.push([x, y]); if (x < 2) cells.push([4 - x, y]); } }
    return cells.length < 5 ? glyph(seed + "+") : cells;
  }
  function glyphCanvas(cells, px, color, bg) {
    const c = el("canvas", { class: "glyph" }); const s = 5 * px + 4; c.width = s; c.height = s; c.style.width = s + "px"; c.style.height = s + "px";
    const g = c.getContext("2d"); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, s, s); } g.fillStyle = color; for (const [x, y] of cells) g.fillRect(2 + x * px, 2 + y * px, px, px);
    return c;
  }
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /* 말 고르기: 손님의 성격이 원하는 말투. 성격 수치 → 말투와 겉으로 보이는 기색 */
  const TONES = [
    { id: "warm", name: "다정하게", trait: "kindness", cue: ["눈치를 보며 머뭇거린다", "작은 목소리로 겨우 말을 꺼낸다"] },
    { id: "plain", name: "솔직하게", trait: "bravery", cue: ["팔짱을 끼고 본론을 기다린다", "단도직입적으로 묻는다"] },
    { id: "polite", name: "정중하게", trait: "ambition", cue: ["고개를 꼿꼿이 들고 있다", "자기 체면을 신경 쓰는 눈치다"] },
    { id: "calm", name: "차분하게", trait: "greed", cue: ["주위를 두리번거리며 불안해한다", "손익을 따지듯 말을 아낀다"] },
  ];

  const HANDS = {
    // ---------------------------------------------------------------- 불·온도 지키기
    gauge: { name: "온도 지키기", how: "누르고 있으면 오르고, 떼면 내려간다. 초록 구간 안에 머물게 한다", play(ctx) {
      const S = stage(ctx.box), zone = widen(ctx.p.zone || [0.6, 0.8], ctx.ease), secs = ctx.p.secs || 5;
      let v = 0.15, hold = false, inside = 0, total = 0;
      ctx.press((down) => { hold = down; });
      return loop((dt, t) => {
        v = clamp(v + (hold ? 0.5 : -0.38) * dt + Math.sin(t * 7) * 0.02 * dt, 0, 1);
        if (t > 0.8) { total += dt; if (v >= zone[0] && v <= zone[1]) inside += dt; }
        const { g, W, H, col } = S, x0 = 16, w = W - 32, y = 44, h = 26;
        g.clearRect(0, 0, W, H);
        label(g, ctx.p.label || "온도", x0, 24, col.dim);
        bar(g, x0, y, w, h, col.bg); bar(g, x0 + zone[0] * w, y, (zone[1] - zone[0]) * w, h, col.zone + "55");
        bar(g, x0 + zone[0] * w, y, 2, h, col.zone); bar(g, x0 + zone[1] * w - 2, y, 2, h, col.zone);
        bar(g, x0 + v * w - 2, y - 6, 4, h + 12, v >= zone[0] && v <= zone[1] ? col.zone : col.warn);
        bar(g, x0, 96, w, 6, col.bg); bar(g, x0, 96, w * clamp(t / (secs + 0.8), 0, 1), 6, col.line);
        if (t >= secs + 0.8) ctx.done(total ? inside / total : 0);
      });
    } },
    // ---------------------------------------------------------------- 박자 맞추기
    rhythm: { name: "박자 맞추기", how: "오른쪽에서 오는 표시가 세로선에 닿을 때 누른다", play(ctx) {
      const S = stage(ctx.box), n = ctx.p.beats || 8, gap = 60 / (ctx.p.bpm || 90), lead = 1.6, win = 0.16 * ctx.ease;
      const notes = Array.from({ length: n }, (_, i) => ({ at: lead + i * gap, s: null }));
      let now = 0, flash = 0;
      ctx.press((down) => {
        if (!down) return;
        const cand = notes.filter((x) => x.s === null && Math.abs(x.at - now) <= win * 1.6).sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0];
        if (cand) { cand.s = clamp(1 - Math.abs(cand.at - now) / (win * 1.6), 0, 1); flash = cand.s > 0.5 ? 1 : -1; } else flash = -1;
      });
      return loop((dt, t) => {
        now = t;
        for (const x of notes) if (x.s === null && t > x.at + win * 1.6) x.s = 0;
        const { g, W, H, col } = S, hitX = 64, pxs = 150;
        g.clearRect(0, 0, W, H);
        bar(g, 0, 40, W, 34, col.bg);
        bar(g, hitX - 2, 30, 4, 54, flash > 0 ? col.zone : flash < 0 ? col.bad : col.line);
        flash *= 0.9; if (Math.abs(flash) < 0.05) flash = 0;
        for (const x of notes) { const px = hitX + (x.at - t) * pxs; if (px < -10 || px > W + 10) continue; bar(g, px - 6, 46, 12, 22, x.s === null ? col.accent : x.s > 0.5 ? col.zone : col.dim); }
        const hit = notes.filter((x) => x.s !== null).length;
        label(g, `${hit} / ${n}`, W - 16, 24, col.dim, "right");
        if (notes.every((x) => x.s !== null) && t > notes[n - 1].at + 0.5) ctx.done(notes.reduce((s, x) => s + x.s, 0) / n);
      });
    } },
    // ---------------------------------------------------------------- 때 맞추기
    timing: { name: "때 맞추기", how: "움직이는 바늘이 초록 구간에 올 때 한 번 누른다", play(ctx) {
      const S = stage(ctx.box), zone = widen(ctx.p.zone || [0.65, 0.8], ctx.ease), sp = (ctx.p.speed || 1) * 0.55 * (2 - ctx.ease);
      let v = 0, dir = 1, stopped = null;
      ctx.press((down) => {
        if (!down || stopped !== null) return;
        stopped = v;
        const m = (zone[0] + zone[1]) / 2, half = (zone[1] - zone[0]) / 2;
        const s = v >= zone[0] && v <= zone[1] ? 1 - (Math.abs(v - m) / half) * 0.3 : clamp(0.6 - Math.min(Math.abs(v - zone[0]), Math.abs(v - zone[1])) * 4, 0, 0.6);
        setTimeout(() => ctx.done(s), 500);
      });
      return loop((dt, t) => {
        if (stopped === null) { v += dir * sp * dt; if (v > 1) { v = 1; dir = -1; } if (v < 0) { v = 0; dir = 1; } if (t > 12) { stopped = v; ctx.done(0); } }
        const { g, W, H, col } = S, x0 = 16, w = W - 32, y = 44, h = 26;
        g.clearRect(0, 0, W, H);
        label(g, ctx.p.label || "알맞은 때", x0, 24, col.dim);
        bar(g, x0, y, w, h, col.bg); bar(g, x0 + zone[0] * w, y, (zone[1] - zone[0]) * w, h, col.zone + "55");
        const on = v >= zone[0] && v <= zone[1];
        bar(g, x0 + v * w - 2, y - 6, 4, h + 12, stopped !== null ? (on ? col.zone : col.bad) : col.text);
      });
    } },
    // ---------------------------------------------------------------- 계량
    measure: { name: "계량", how: "누르고 있으면 차오른다. 표시선에 가깝게 맞추고 ‘다 됐다’를 누른다. 넘치면 안 된다", play(ctx) {
      const S = stage(ctx.box), target = ctx.p.target || 0.6, sp = (ctx.p.speed || 0.5) * (2.1 - ctx.ease), tol = 0.03 * ctx.ease;
      let v = 0, hold = false, over = false;
      ctx.press((down) => { hold = down; });
      const ok = el("button", { type: "button", class: "wbtn" }, "다 됐다 (Enter)");
      const finish = () => { const d = Math.abs(v - target); ctx.done(v > target + tol * 2 ? clamp(0.5 - (v - target) * 3, 0, 0.5) : clamp(1 - Math.max(0, d - tol) * 4, 0, 1)); };
      ok.addEventListener("click", finish); ctx.box.append(ok); ctx.onEnter(finish);
      return loop((dt) => {
        if (hold) v = clamp(v + sp * dt * (0.6 + v), 0, 1.05);
        over = v > target + tol * 2;
        const { g, W, H, col } = S, x0 = 16, w = W - 32, y = 44, h = 26;
        g.clearRect(0, 0, W, H);
        label(g, ctx.p.label || "양", x0, 24, col.dim);
        bar(g, x0, y, w, h, col.bg); bar(g, x0, y, Math.min(1, v) * w, h, over ? col.bad : col.accent);
        bar(g, x0 + target * w - 1, y - 8, 2, h + 16, col.text);
        bar(g, x0 + (target - tol) * w, y + h + 4, tol * 2 * w, 3, col.zone);
      });
    } },
    // ---------------------------------------------------------------- 선 따라가기
    trace: { name: "선 따라가기", how: "왼쪽 동그라미에서 시작해 선을 따라 끝까지 끈다", play(ctx) {
      const S = stage(ctx.box, 150), { W, H } = S, shape = ctx.p.shape || "line", N = 48, tol = 12 * ctx.ease;
      const pts = Array.from({ length: N }, (_, i) => { const u = i / (N - 1), x = 24 + u * (W - 48);
        const y = shape === "arc" ? H / 2 + 40 - Math.sin(u * Math.PI) * 70 : shape === "zigzag" ? H / 2 + (Math.abs(((u * 4) % 2) - 1) - 0.5) * 70 : H / 2;
        return [x, y]; });
      let next = 0, dev = 0, cnt = 0, drag = false, ended = false;
      const pos = (e) => { const r = S.c.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
      const end = () => { if (ended) return; ended = true; const cover = next / N, acc = cnt ? clamp(1 - dev / cnt / tol, 0, 1) : 0; ctx.done(cover * (0.5 + 0.5 * acc)); };
      S.c.style.touchAction = "none";
      S.c.addEventListener("pointerdown", (e) => { const [x, y] = pos(e); if (Math.hypot(x - pts[0][0], y - pts[0][1]) < 24) { drag = true; S.c.setPointerCapture(e.pointerId); } });
      S.c.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const [x, y] = pos(e);
        let d = Infinity; for (let i = Math.max(0, next - 3); i < Math.min(N, next + 6); i++) d = Math.min(d, Math.hypot(x - pts[i][0], y - pts[i][1]));
        dev += Math.min(d, tol * 2); cnt++;
        while (next < N && Math.hypot(x - pts[next][0], y - pts[next][1]) < tol * 1.6) next++;
        if (next >= N) end();
      });
      S.c.addEventListener("pointerup", () => { if (drag && next > 2) end(); drag = false; });
      return loop(() => {
        const { g, col } = S;
        g.clearRect(0, 0, W, H); bar(g, 0, 0, W, H, col.bg);
        g.lineWidth = tol * 2; g.lineCap = "round"; g.strokeStyle = col.line + "66"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.lineWidth = 3; g.strokeStyle = col.zone; g.beginPath(); pts.slice(0, Math.max(1, next)).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.fillStyle = col.accent; g.beginPath(); g.arc(pts[0][0], pts[0][1], 9, 0, 7); g.fill();
        g.strokeStyle = col.text; g.lineWidth = 2; g.beginPath(); g.arc(pts[N - 1][0], pts[N - 1][1], 9, 0, 7); g.stroke();
      });
    } },
    // ---------------------------------------------------------------- 연마
    grind: { name: "연마", how: "←와 →(또는 화면 왼쪽·오른쪽)를 번갈아 고르게 누른다", play(ctx) {
      const S = stage(ctx.box), n = ctx.p.n || 14, secs = (ctx.p.secs || 6) * ctx.ease;
      let side = null, good = 0, slip = 0, last = 0, gaps = [], t0 = 0;
      const hit = (s) => { if (side === s) { slip++; return; } if (last) gaps.push(t0 - last); last = t0; side = s; good++; };
      ctx.side(hit);
      S.c.addEventListener("pointerdown", (e) => { const r = S.c.getBoundingClientRect(); hit(e.clientX - r.left < r.width / 2 ? "L" : "R"); });
      return loop((dt, t) => {
        t0 = t;
        const { g, W, H, col } = S;
        g.clearRect(0, 0, W, H);
        bar(g, 0, 0, W / 2 - 2, 84, side === "L" ? col.line : col.bg); bar(g, W / 2 + 2, 0, W / 2 - 2, 84, side === "R" ? col.line : col.bg);
        label(g, "←", W / 4, 50, col.text, "center"); label(g, "→", (W * 3) / 4, 50, col.text, "center");
        bar(g, 16, 96, W - 32, 6, col.bg); bar(g, 16, 96, (W - 32) * clamp(good / n, 0, 1), 6, col.zone);
        bar(g, 16, 108, (W - 32) * clamp(1 - t / secs, 0, 1), 3, col.line);
        if (good >= n || t >= secs) {
          const m = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1, sd = gaps.length ? Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) : 1;
          ctx.done(clamp(good / n, 0, 1) * (0.65 + 0.35 * clamp(1 - sd / Math.max(0.05, m), 0, 1)) * Math.pow(0.95, slip));
        }
      });
    } },
    // ---------------------------------------------------------------- 말 고르기 (사람 대하기)
    talk: { name: "말 고르기", how: "손님의 기색을 보고 알맞은 말투를 고른다", play(ctx) {
      const n = ctx.client, rounds = ctx.p.rounds || 2, tr = n ? n.traits : { kindness: 0.6, bravery: 0.5, ambition: 0.5, greed: 0.4 };
      const rank = TONES.slice().sort((a, b) => tr[b.trait] - tr[a.trait]);
      let r = 0, sum = 0; const box = el("div", { class: "simtalk" }); ctx.box.append(box);
      const round = () => {
        const want = rank[r % 2 === 0 || rank[1] === undefined ? 0 : (Math.random() < 0.7 ? 0 : 1)], cue = want.cue[r % want.cue.length];
        box.replaceChildren(el("p", null, `${n ? n.name : "손님"}${n ? "은(는)" : "은"} ${cue}.`), el("div", { class: "simchoices" }, shuffle(TONES).map((t) => el("button", { type: "button", class: "wbtn", onclick: () => {
          sum += t === want ? 1 : t === rank[1] ? 0.5 : 0; r++; if (r >= rounds) ctx.done(sum / rounds); else round(); } }, t.name))));
      };
      round();
      return () => {};
    } },
    // ---------------------------------------------------------------- 살피기 (다른 하나 찾기)
    observe: { name: "살피기", how: "모두 같아 보이지만 하나가 다르다. 그것을 누른다", play(ctx) {
      const rounds = ctx.p.rounds || 3, limit = 9 * ctx.ease; let r = 0, sum = 0, t0 = performance.now(), timer = null;
      const grid = el("div", { class: "simgrid" }), tbar = el("div", { class: "simtime" }); ctx.box.append(grid, tbar);
      const col = css("--text"), bg = css("--sunk");
      const round = () => {
        const base = glyph("o" + Math.random()), odd = base.slice(); const k = Math.floor(Math.random() * odd.length); odd.splice(k, 1); // 한 점이 빠진 것
        const N = 12, at = Math.floor(Math.random() * N); t0 = performance.now();
        grid.replaceChildren(...Array.from({ length: N }, (_, i) => { const b = el("button", { type: "button", class: "simcell" }); b.append(glyphCanvas(i === at ? odd : base, 6, col, bg));
          b.addEventListener("click", () => { const dt = (performance.now() - t0) / 1000; sum += i === at ? clamp(1 - Math.max(0, dt - 2) / limit, 0.4, 1) : 0; next(); }); return b; }));
      };
      const next = () => { r++; if (r >= rounds) { clearInterval(timer); ctx.done(sum / rounds); } else round(); };
      timer = setInterval(() => { const dt = (performance.now() - t0) / 1000; tbar.style.width = `${clamp(1 - dt / limit, 0, 1) * 100}%`; if (dt > limit) next(); }, 100);
      round();
      return () => clearInterval(timer);
    } },
    // ---------------------------------------------------------------- 순서 외우기
    memory: { name: "순서 외우기", how: "나타나는 무늬의 순서를 외웠다가 그대로 누른다", play(ctx) {
      const len = ctx.p.len || 4, opts = Array.from({ length: 6 }, (_, i) => glyph("m" + i + Math.random())), seq = Array.from({ length: len }, () => Math.floor(Math.random() * 6));
      const show = el("div", { class: "simshow" }), pad = el("div", { class: "simgrid" }); ctx.box.append(show, pad);
      const col = css("--text"), acc = css("--accent"), bg = css("--sunk"); let i = 0, got = 0, input = false, timers = [];
      const step = 0.9 / ctx.ease * 1000;
      seq.forEach((k, j) => timers.push(setTimeout(() => show.replaceChildren(glyphCanvas(opts[k], 10, acc, bg), el("span", { class: "small muted" }, `${j + 1} / ${len}`)), 300 + j * step)));
      timers.push(setTimeout(() => { show.replaceChildren(el("span", { class: "small muted" }, "이제 순서대로 누른다")); input = true; }, 300 + len * step));
      pad.append(...opts.map((o, k) => { const b = el("button", { type: "button", class: "simcell" }); b.append(glyphCanvas(o, 6, col, bg));
        b.addEventListener("click", () => { if (!input) return; if (k === seq[i]) { got++; i++; show.replaceChildren(el("span", { class: "small" }, `${i} / ${len}`)); if (i >= len) ctx.done(1); } else ctx.done(got / len * 0.8); }); return b; }));
      return () => timers.forEach(clearTimeout);
    } },
    // ---------------------------------------------------------------- 낱말 옮기기 (사전을 보고 뜻 고르기)
    match: { name: "낱말 옮기기", how: "사전을 보고 낯선 글자가 뜻하는 말을 고른다", play(ctx) {
      const vocab = shuffle(ctx.vocab && ctx.vocab.length >= 4 ? ctx.vocab : ["물", "불", "길", "빛", "돌", "숲"]).slice(0, 6), n = ctx.p.words || 3, limit = 20 * ctx.ease;
      const seed = ctx.p.script || "glyphs", gl = Object.fromEntries(vocab.map((v) => [v, glyph(seed + v)]));
      const col = css("--text"), acc = css("--accent"), bg = css("--sunk");
      const dict = el("div", { class: "simdict" }, vocab.map((v) => el("span", { class: "chip" }, glyphCanvas(gl[v], 3, col, null), " ", v)));
      const q = el("div", { class: "simtalk" }), tbar = el("div", { class: "simtime" }); ctx.box.append(dict, q, tbar);
      const words = shuffle(vocab).slice(0, n); let i = 0, sum = 0; const t0 = performance.now();
      const round = () => {
        const want = words[i], opts = shuffle([want, ...shuffle(vocab.filter((v) => v !== want)).slice(0, 3)]);
        q.replaceChildren(el("div", { class: "simshow" }, glyphCanvas(gl[want], 9, acc, bg), el("span", { class: "small muted" }, `${i + 1} / ${n}`)),
          el("div", { class: "simchoices" }, opts.map((v) => el("button", { type: "button", class: "wbtn", onclick: () => { sum += v === want ? 1 : 0; i++; if (i >= n) end(); else round(); } }, v))));
      };
      let done = false; const end = () => { if (done) return; done = true; clearInterval(timer); const dt = (performance.now() - t0) / 1000; ctx.done((sum / n) * clamp(1.15 - dt / limit * 0.4, 0.6, 1)); };
      const timer = setInterval(() => { const dt = (performance.now() - t0) / 1000; tbar.style.width = `${clamp(1 - dt / (limit * 1.5), 0, 1) * 100}%`; if (dt > limit * 1.5) end(); }, 100);
      round();
      return () => clearInterval(timer);
    } },
  };
  for (const [id, impl] of Object.entries(HANDS)) G.registerHand(id, impl);
  const register = (id, impl) => { HANDS[id] = impl; G.registerHand(id, impl); };

  // ================================================================ 진행기: 단계를 차례로
  let cur = null;
  /** 업무를 시작한다. host 안에 그린다. onEnd({scores} | {auto:true} | null) */
  function run(host, wk, lv, onEnd, extra = {}) {
    stop();
    const steps = wk.steps, scores = [];
    const ease = 1 + 0.18 * (Math.max(1, lv) - 1);
    const st = { wk, i: 0, cleanup: null, pressCb: null, sideCb: null, enterCb: null, keyDown: null, keyUp: null, onEnd };
    cur = st;
    const head = el("div", { class: "simhead" }), body = el("div", { class: "simbody" }), how = el("div", { class: "simhow small muted" }), foot = el("div", { class: "simfoot" });
    host.replaceChildren(head, how, body, foot);
    const chips = () => head.replaceChildren(el("b", null, wk.name), el("div", { class: "chips" }, steps.map((s, i) => el("span", { class: "chip" + (i === st.i ? " accent" : "") + (i < st.i ? " done" : "") }, `${i + 1}. ${s.name}${i < st.i ? ` ${Math.round(scores[i] * 100)}` : ""}`))));
    foot.append(
      el("button", { type: "button", class: "wbtn", onclick: () => end({ auto: true }) }, "손에 익은 대로 맡기기"),
      el("button", { type: "button", class: "wbtn", onclick: () => end(null) }, "그만두기"));
    const press = (down) => st.pressCb && st.pressCb(down);
    body.addEventListener("pointerdown", (e) => { if (e.target.closest("button") || !st.pressCb) return; e.preventDefault(); press(true); });
    root.addEventListener("pointerup", st.pu = () => press(false));
    st.keyDown = (e) => {
      if (e.key === "Escape") { stop(); return; } // Esc는 ui가 메뉴를 닫는다
      e.stopImmediatePropagation();
      if (e.key === " " || e.code === "Space") { e.preventDefault(); if (!e.repeat) press(true); }
      else if (e.key === "Enter") { e.preventDefault(); st.enterCb && st.enterCb(); }
      else if (/^(arrowleft|a)$/i.test(e.key)) { e.preventDefault(); st.sideCb && st.sideCb("L"); }
      else if (/^(arrowright|d)$/i.test(e.key)) { e.preventDefault(); st.sideCb && st.sideCb("R"); }
    };
    st.keyUp = (e) => { if (e.key === " " || e.code === "Space") { e.stopImmediatePropagation(); press(false); } };
    root.addEventListener("keydown", st.keyDown, true); root.addEventListener("keyup", st.keyUp, true);
    function begin() {
      chips();
      const s = steps[st.i], hand = HANDS[s.tool];
      st.pressCb = st.sideCb = st.enterCb = null;
      how.textContent = `${s.name}: ${hand.how}`;
      body.replaceChildren();
      let finished = false;
      const lvEase = ease * ([1.25, 1, 0.8][(s.p || {}).level ?? 1] || 1); // 단계 난이도(직업 만들기에서 고른 것)
      st.cleanup = hand.play({ box: body, p: s.p || {}, lv, ease: lvEase, client: extra.client || null, vocab: extra.vocab || null,
        press: (cb) => { st.pressCb = cb; }, side: (cb) => { st.sideCb = cb; }, onEnter: (cb) => { st.enterCb = cb; },
        done: (score) => { if (finished || cur !== st) return; finished = true; if (st.cleanup) st.cleanup(); scores[st.i] = clamp(score, 0, 1); st.i++; if (st.i >= steps.length) { chips(); end({ scores }); } else setTimeout(() => cur === st && begin(), 350); } });
    }
    function end(res) { if (cur !== st) return; stop(); onEnd(res); }
    begin();
  }
  function stop() {
    if (!cur) return;
    const st = cur; cur = null;
    if (st.cleanup) st.cleanup();
    root.removeEventListener("keydown", st.keyDown, true); root.removeEventListener("keyup", st.keyUp, true); root.removeEventListener("pointerup", st.pu);
  }
  const running = () => !!cur;
  root.Sims = { run, stop, running, register, HANDS };
})(typeof window !== "undefined" ? window : globalThis);
