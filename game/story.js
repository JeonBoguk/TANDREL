/* 이야기 층: 내가 아는 것과 그 출처, 아침 신문, 에피소드, 여러 단계로 이어지는 대화, 미션, 관계도. */
(function (root) {
  "use strict";
  const A = root.Asteria, G = root.Game;
  const { maxBy, clamp, adjust, power, related, enlist } = A._;
  const { JOBS, RACES, jo, opinion, family, isAdult, age } = A;
  const pick = (w, arr) => arr[Math.floor(w.rng.next() * arr.length)];
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] !== undefined ? o[k] : ""));

  // ================================================================ 준비
  function setup(w) {
    w.onLearn = (p, ev, src, via) => onLearn(w, p, ev, src, via);
    w.onApproach = (n, p) => onApproach(w, n, p);
    w.onDawn = () => onDawn(w);
  }
  const EX = (w) => G.ext(w);

  // ================================================================ 아는 것과 그 출처
  const SRC_LABEL = { self: "내가 겪은 일", seen: "직접 봄", told: "들음", paper: "조간 신문" };
  function onLearn(w, p, ev, src, via) {
    w.journal.push({ e: ev.id, d: w.day, t: w.dayOpen ? w.clock : 0, s: src, v: via });
    if (w.journal.length > 4000) w.journal.splice(0, w.journal.length - 4000);
    if (src !== "paper") maybeEpisode(w, p, ev, src);
  }
  function sourceText(w, j) {
    if (j.s === "told") return j.v !== null && w.npcs[j.v] ? `${w.npcs[j.v].name}에게 들음` : "소문으로 들음";
    if (j.s === "seen") { const e = w.events[j.e]; return e && e.town ? `${w.towns[e.town].name}에서 직접 봄` : "직접 봄"; }
    return SRC_LABEL[j.s] || "";
  }

  // ================================================================ 아침
  const PUBLIC = new Set(["war_start", "victory", "fall", "raid", "liberation", "oracle", "hero", "refuse", "deed", "fallen", "death", "murder", "exile",
    "caught", "marriage", "career", "treasure", "drought", "duel", "revenge", "return", "adulthood", "arrival", "reconcile", "lovers", "arrest", "assault", "report",
    "festival", "caravan", "plague", "plague_heal", "bandits_beaten", "bandits_won", "dream_done", "nation_founded", "job_born", "founding", "follow_founder"]);
  function onDawn(w) {
    G.farmDawn(w);
    G.renoDawn(w);
    for (const ep of w.episodes.slice()) if (ep.expires < w.day && !ep.block) resolve(w, ep.id, ep.def, true);
    refreshBoard(w);
    const p = w.player;
    if (!p || !p.alive || p.controller !== "player") return;
    const items = [];
    for (let i = w.events.length - 1; i >= 0; i--) {
      const e = w.events[i];
      if (!e) continue;
      if (e.day < w.lastPaper) break; // 지난 신문 이후의 일 (이미 실린 일은 p.known으로 걸러진다)
      if (!PUBLIC.has(e.kind) || e.imp < 4 || p.known.has(e.id) || (e.kind === "deed" && e.imp < 6)) continue;
      items.push(e);
    }
    items.sort((a, b) => b.imp - a.imp || b.id - a.id);
    const pk = items.slice(0, 6);
    const follow = followNews(w, w.lastPaper, new Set(pk.map((e) => e.id)));
    const local = localNews(w, w.lastPaper, new Set([...pk, ...follow].map((e) => e.id)));
    for (const e of [...pk, ...follow, ...local]) w.remember(p, e, false, null, "paper");
    w.papers.push({ day: w.day, items: pk.map((e) => e.id), follow: follow.map((e) => e.id), local: local.map((e) => e.id), diary: diary(w, [...pk, ...follow, ...local]), front: Math.round(w.war.front), active: w.war.active, lord: A.lordName(w), season: w.season, unread: true });
    if (w.papers.length > 20) w.papers.shift();
    w.lastPaper = w.day;
    const e = EX(w);
    e.dates = (e.dates || []).filter((d) => d.day >= w.day);
    // 아침 초대장: 나를 아끼는 이웃이 오늘 저녁 집으로 부른다
    if (w.rng.next() < 0.2 && !e.missions.some((m) => !m.done && m.type === "visit")) {
      const fr = w.residents(p.town, true).filter((n) => n.id !== p.id && opinion(n, p.id) >= 45 && !related(n, p));
      if (fr.length) { const n = pick(w, fr);
        addEp(w, { kind: "invite_letter", who: n.id, title: "초대장이 왔다", text: `${jo(n.name, "이/가")} 쪽지를 남겼다. "오늘 저녁 6시쯤 우리 집에 놀러 와요. 맛있는 거 해 둘게요."`, def: "no",
          choices: [C("yes", "가겠다고 답한다", "저녁 6시~10시"), C("no", "오늘은 어렵다고 답한다", "")] }); }
    }
  }
  /** 관심 인물(★)의 지난밤 소식: 작은 일까지 싣는다 */
  function followNews(w, since, skip) {
    const fl = new Set(EX(w).follow || []), out = [], p = w.player;
    if (!fl.size) return out;
    for (let i = w.events.length - 1; i >= 0 && out.length < 8; i--) {
      const e = w.events[i];
      if (!e) continue;
      if (e.day < since) break;
      if (skip.has(e.id) || p.known.has(e.id) || e.imp < 2 || e.secret !== null || e.kind === "vow") continue;
      if (fl.has(e.actor) || fl.has(e.target)) out.push(e);
    }
    return out.reverse();
  }
  /** 관심 인물 일기: 큰일이 없던 사람도 어제 무엇을 하며 보냈는지 한 줄 */
  const DIARY = {
    work: (n, w) => pick(w, [`${A.JOBS[n.job].name} 일로 하루를 보냈다`, "묵묵히 맡은 일을 했다", "땀 흘려 일했다"]),
    social: () => "이웃들과 어울리며 이야기꽃을 피웠다", help: () => "어려운 이웃을 도왔다", heal: () => "몸이 좋지 않아 치료를 받았다",
    steal: () => "어딘가 바쁘게 돌아다녔다", revenge: () => "누군가를 찾아 헤맸다", travel: () => "짐을 싸서 길을 떠났다", job: () => "새 일을 시작했다",
    war: () => "전선으로 향했다", soldier: () => "전선에서 싸웠다", forage: () => "숲에서 먹을 것을 구했다", rest: () => "조용히 쉬었다", jail: () => "감옥에서 하루를 보냈다",
  };
  function diary(w, follow) {
    const had = new Set(follow.flatMap((e) => [e.actor, e.target]));
    return (EX(w).follow || []).map((id) => w.npcs[id]).filter((n) => n && n.alive && !had.has(n.id) && n.lastAct && DIARY[n.lastAct])
      .slice(0, 6).map((n) => {
        let t = `${jo(n.name, "은/는")} ${DIARY[n.lastAct](n, w)}`;
        if (knowsDream(w, n)) { const pr = A.dreamProgress(n, w); if (pr >= 0.6) t += `. ‘${A.dreamName(n)}’의 꿈에 한 발짝 더 다가갔다`; }
        return { id: n.id, text: t };
      });
  }
  /** 우리 동네 단신: 내가 사는 마을과 지금 있는 마을의 작은 삶의 소식 */
  const LOCAL = new Set(["lovers", "rejected", "friendship", "birth", "travel", "help", "gift", "quarrel", "reconcile", "dream_start", "dream_done", "dream_lost", "career",
    "arrival", "festival", "feast", "adulthood", "marriage", "treasure", "caught", "enlist", "return", "injury", "plague_heal", "bandits_beaten"]);
  function localNews(w, since, skip) {
    const p = w.player, towns = new Set([p.home, p.town]), out = [];
    for (let i = w.events.length - 1; i >= 0 && out.length < 5; i--) {
      const e = w.events[i];
      if (!e) continue;
      if (e.day < since) break;
      if (!LOCAL.has(e.kind) || !towns.has(e.town) || skip.has(e.id) || p.known.has(e.id) || e.secret !== null || e.actor === p.id || e.target === p.id) continue;
      out.push(e);
    }
    return out.reverse();
  }
  /** 막 태어난 플레이어에게 오는 첫 신문: 최근 한 계절의 큰일을 모은 특별호 */
  function welcomePaper(w) {
    const p = w.player;
    if (!p) return null;
    const items = w.events.filter((e) => e && PUBLIC.has(e.kind) && e.imp >= 5 && w.day - e.day <= 40 && !p.known.has(e.id)).sort((a, b) => b.imp - a.imp || b.id - a.id).slice(0, 7);
    for (const e of items) w.remember(p, e, false, null, "paper");
    const pp = { day: w.day, items: items.map((e) => e.id), follow: [], front: Math.round(w.war.front), active: w.war.active, lord: A.lordName(w), season: w.season, unread: true, special: "새로 온 이웃을 위한 특별호" };
    w.papers.push(pp); w.lastPaper = w.day;
    return pp;
  }
  function paperSection(kind) {
    if (A.CONTENT.eventKinds[kind]) return A.CONTENT.eventKinds[kind];
    if (["war_start", "victory", "fall", "raid", "liberation", "oracle", "hero", "refuse", "deed", "fallen", "return"].includes(kind)) return "전황";
    if (["murder", "exile", "caught", "duel", "revenge", "arrest", "assault", "report"].includes(kind)) return "사건·사고";
    if (["career", "treasure", "drought"].includes(kind)) return "살림·장사";
    return "사람들";
  }
  function afterTick(w) { checkOracle(w); }

  // ================================================================ 에피소드
  const C = (id, label, hint) => ({ id, label, hint });
  function addEp(w, ep) {
    if (w.episodes.some((x) => x.kind === ep.kind && x.who === ep.who && x.day === w.day)) return;
    if (w.episodes.length >= 8) return;
    w.episodes.push({ id: ++w.epSeq, day: w.day, t: G.clockText(w), expires: w.day + 3, ev: null, who: null, data: {}, ...ep });
    if (Story.onEpisode) Story.onEpisode();
  }
  function maybeEpisode(w, p, ev, src) {
    const who = ev.actor !== null ? w.npcs[ev.actor] : null;
    const ok = (x) => x && x.alive;
    if (ev.target === p.id && ev.actor !== p.id) {
      if (ev.kind === "theft" && ok(who)) {
        const amt = +((ev.text.match(/(\d+)닢/) || [])[1] || 0);
        addEp(w, { kind: "robbed", who: who.id, ev: ev.id, data: { amt }, title: "도둑맞았다", text: `${jo(who.name, "이/가")} 내 금화 ${amt}닢을 훔쳤다.`, def: "let",
          choices: [C("report", "경비대에 신고한다", "범인이 감옥에 가고 돈을 일부 돌려받는다"), C("vow", "복수를 다짐한다", "찾아가서 직접 갚아 주자"), C("forgive", "용서한다", "관계가 조금 나아진다"), C("let", "그냥 넘어간다", "")] });
      } else if (ev.kind === "theft_unknown") {
        addEp(w, { kind: "robbed_unknown", ev: ev.id, title: "주머니가 가벼워졌다", text: `${ev.text}. 범인을 찾아볼까?`, def: "let", choices: [C("investigate", "수소문한다 (1시간)", "범인을 알아낼 수도 있다"), C("let", "잊어버린다", "")] });
      } else if (ev.kind === "help" && ok(who)) {
        addEp(w, { kind: "helped", who: who.id, ev: ev.id, title: "도움을 받았다", text: ev.text, def: "thank", choices: [C("thank", "고마움을 전한다", ""), C("promise", "꼭 갚겠다고 약속한다", ""), C("refuse", "자존심에 돌려준다", "")] });
      } else if (["quarrel", "insult", "gossip"].includes(ev.kind) && ok(who)) {
        addEp(w, { kind: "slight", who: who.id, ev: ev.id, title: ev.kind === "gossip" ? "나에 대한 험담" : "기분 나쁜 일", text: ev.text, def: "ignore", choices: [C("vow", "두고 보자고 다짐한다", ""), C("ignore", "신경 쓰지 않는다", ""), C("forgive", "털어 버린다", "")] });
      } else if (["revenge", "counter", "duel", "fight"].includes(ev.kind) && ok(who)) {
        addEp(w, { kind: "attacked", who: who.id, ev: ev.id, title: "습격당했다", text: ev.text, def: "let", choices: [C("vow", "복수를 다짐한다", ""), C("report", "경비대에 신고한다", "상대가 감옥에 간다"), C("forgive", "용서한다", "원한의 고리를 끊는다"), C("let", "그냥 넘어간다", "")] });
      }
    }
    if (["death", "murder", "fallen"].includes(ev.kind) && ev.target !== p.id) {
      const dead = w.npcs[ev.target];
      if (dead && (family(p).has(dead.id) || opinion(p, dead.id) >= 50)) {
        const killer = ev.actor !== null && ev.actor !== p.id ? w.npcs[ev.actor] : null;
        addEp(w, { kind: "mourning", who: dead.id, ev: ev.id, data: { killer: killer ? killer.id : null }, title: "부고", text: ev.text, def: "grieve",
          choices: [C("funeral", "장례를 치른다 (금화 5)", "가족과 친구들이 고마워한다"), ...(killer && killer.alive ? [C("vow", `${killer.name}에게 복수를 다짐한다`, "")] : []), C("grieve", "슬픔을 삼킨다", "")] });
      }
    }
    if (ev.kind === "enlist" && who && who.id !== p.id && (family(p).has(who.id) || opinion(p, who.id) >= 50) && src !== "paper" && w.war.active)
      addEp(w, { kind: "farewell", who: who.id, ev: ev.id, title: "전선으로 떠나는 사람", text: `${jo(who.name, "이/가")} 마왕군과 싸우러 전선으로 떠난다고 한다.`, def: "farewell", choices: [C("together", "나도 함께 간다", "같이 참전한다"), C("farewell", "무사히 돌아오라고 배웅한다", "")] });
    if (ev.kind === "nation_founded" && who && p.follows === who.id) {
      const t = w.towns[ev.town];
      addEp(w, { kind: "migrate", who: who.id, ev: ev.id, data: { town: t.id }, title: "새 나라가 세워졌다", text: `${ev.text}. 함께하기로 했던 나도 그곳으로 갈 수 있다.`, def: "stay",
        choices: [C("go", `${t.name}(으)로 이주한다`, "새 나라의 첫 주민이 된다. 집도 그곳으로 옮긴다"), C("stay", "지금 사는 곳에 남는다", "마음만은 함께한다")] });
    }
    if (ev.kind === "vow" && who && who.goal && who.goal.target === p.id)
      addEp(w, { kind: "threat", who: who.id, ev: ev.id, title: "나를 노리는 사람", text: `${jo(who.name, "이/가")} 나에게 복수를 다짐했다는 이야기를 들었다.`, def: "ignore", choices: [C("guard", "몸조심한다", "한동안 습격에 강해진다"), C("ignore", "신경 쓰지 않는다", "찾아가서 직접 이야기해 볼 수도 있다")] });
    if (ev.kind === "birth" && ev.target !== null && p.children.includes(ev.target)) {
      const c = w.npcs[ev.target];
      const pool = RACES[c.race].names.filter((x) => !w.usedNames.has(x));
      const names = [c.name, ...w.rng.shuffle(pool.slice()).slice(0, 2)];
      addEp(w, { kind: "naming", who: c.id, ev: ev.id, title: "아이가 태어났다", text: "아이의 이름을 지어 주자.", def: "n0", data: { names }, block: true, choices: names.map((nm, i) => C("n" + i, nm, "")) });
    }
    if (src === "seen" && ev.day === w.day && ev.actor !== p.id && ev.target !== p.id && ev.target !== null && who
        && ["theft", "revenge", "counter", "murder", "duel", "quarrel"].includes(ev.kind) && w.rng.next() < 0.7) {
      const victim = w.npcs[ev.target], crime = ev.kind !== "quarrel";
      addEp(w, { kind: "witness", who: who.id, ev: ev.id, data: { victim: victim.id, crime }, title: "눈앞에서 벌어진 일", text: `${ev.text}. 나는 그 자리에 있었다.`, def: "ignore",
        choices: [...(crime && who.alive ? [C("report", "경비대에 증언한다", `${jo(who.name, "이/가")} 벌을 받는다`)] : []), ...(victim.alive ? [C("comfort", `${jo(victim.name, "을/를")} 위로한다`, "")] : []), C("ignore", "모른 척한다", "")] });
    }
  }
  function onApproach(w, n, p) {
    if (!p.alive || p.asleep || p.outside || p.town !== n.town || p.at_war || p.jail > 0) return;
    const k = G.walkers.get(n.id);
    if (!k || k.inside || k.seek || G.ext(w).wanted.level > 0) return;
    const d = Math.hypot(k.x - w.ppos.x, k.y - w.ppos.y);
    if (d > 16) return;
    let opener = "approach";
    if (n.spouse === null && p.spouse === null && !related(n, p) && opinion(n, p.id) >= 55 && n.lover === null && p.lover === null && w.rng.next() < 0.35) opener = "confess";
    else if (n.lover === p.id && opinion(n, p.id) >= 65 && w.rng.next() < 0.3) opener = "propose";
    else if (n.goal && n.goal.target === p.id && n.traits.bravery > 0.5) opener = "confront";
    else if (opinion(n, p.id) >= 40 && G.hour(w) < 17.5 && w.rng.next() < 0.25 && !EX(w).missions.some((m) => !m.done && m.type === "visit")) opener = "invite";
    k.seek = () => { if (Story.onOpenTalk) Story.onOpenTalk(n.id, opener); };
    k.say = opener === "confront" ? "이봐!" : "저기요!"; k.sayT = 2.5;
  }

  function resolve(w, id, choice, silent) {
    const i = w.episodes.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const ep = w.episodes[i];
    w.episodes.splice(i, 1);
    const p = w.player;
    if (!p || !p.alive) return null;
    const x = ep.who !== null ? w.npcs[ep.who] : null;
    const H = EP[ep.kind];
    const text = H ? H(w, p, x, ep, choice) : null;
    const out = silent ? (text ? `(답하지 않은 채 지나갔다) ${text}` : null) : text;
    if (out) G.log(w, out);
    return out;
  }
  const guardsIn = (w, town) => w.residents(town, true).filter((g) => JOBS[g.job].guard && g.controller !== "player").length;
  function jailFor(w, who, days, text, actorId) { who.jail = Math.max(who.jail, days); return w.record("report", text, { actor: actorId, target: who.id, town: who.town, imp: 4, sent: -8, wr: 0.4 }); }
  function playerVow(w, p, x, ev) {
    p.goal = { type: "revenge", target: x.id, origin: ev ? ev.id : null, vow: null, wait: 0 };
    const v = w.record("vow", `${jo(p.name, "이/가")} ${x.name}에게 복수를 다짐했다${ev ? ` (원인: ${ev.text})` : ""}`, { actor: p.id, town: p.town, imp: 4, cause: ev ? ev.id : null, wr: 0.1 });
    p.goal.vow = v.id; if (p.goal.origin === null) p.goal.origin = v.id;
    return `${x.name}에 대한 원한을 마음 깊이 새겼다. 찾아가서 직접 갚아 줄 수 있다.`;
  }
  const EP = {
    invite_letter(w, p, x, ep, c) {
      if (!x || !x.alive) return null;
      if (c !== "yes") { adjust(x, p.id, -2); return `${x.name}에게 오늘은 어렵다고 답했다.`; }
      invite(w, x, 18, 22); adjust(x, p.id, 3); return `${x.name}에게 저녁에 가겠다고 답했다. 저녁 6시에 그 집 문으로 들어가면 된다.`;
    },
    build_offer(w, p, x, ep, c) {
      if (c !== "yes" || !x || !x.alive) { if (x) adjust(x, p.id, -2); return x ? `${x.name}의 부탁을 사양했다.` : null; }
      buildMission(w, x, ep.data.job); adjust(x, p.id, 4);
      return `${x.name}의 집 공사를 맡았다. 재료를 챙겨 그 집 앞에서 일하자.`;
    },
    migrate(w, p, x, ep, c) {
      p.follows = null;
      if (c !== "go") { if (x) adjust(x, p.id, -5); return `${x ? x.name + "에게 " : ""}마음만은 함께하겠다고 편지를 보냈다.`; }
      const t = w.towns[ep.data.town];
      if (!t || t.fallen) return "그곳에는 이제 갈 수 없다.";
      w.move(p, t.id, false); p.home = t.id; G.placeIn(w, t.id, "inn"); if (x) adjust(x, p.id, 15);
      w.record("travel", `${jo(p.name, "이/가")} 새 나라의 첫 주민이 되려 ${jo(t.name, "으로/로")} 이주했다`, { actor: p.id, town: t.id, imp: 4, wr: 0.5 });
      return `긴 길을 걸어 ${t.name}에 닿았다. 이제 이곳이 내 집이다.`;
    },
    robbed(w, p, x, ep, c) {
      if (c === "report") {
        if (!guardsIn(w, p.town)) return "이 마을엔 경비병이 없어 신고할 곳이 없었다.";
        const back = Math.min(ep.data.amt, Math.floor(x.gold)); x.gold -= back; p.gold += back;
        jailFor(w, x, w.rng.randint(4, 8), `${jo(p.name, "이/가")} ${x.name}의 도둑질을 신고해 ${jo(x.name, "이/가")} 감옥에 갇혔다`, p.id);
        return `${jo(x.name, "이/가")} 붙잡혀 갔다. 금화 ${back}닢을 돌려받았다.`;
      }
      if (c === "vow") return playerVow(w, p, x, w.events[ep.ev]);
      if (c === "forgive") { adjust(p, x.id, 15); w.record("forgive", `${jo(p.name, "은/는")} 자신의 돈을 훔친 ${jo(x.name, "을/를")} 용서했다`, { actor: p.id, target: x.id, town: p.town, imp: 3, sent: 6, wr: 0.3 }); return `${jo(x.name, "을/를")} 용서했다.`; }
      return "그냥 넘어가기로 했다.";
    },
    robbed_unknown(w, p, x, ep, c) {
      if (c !== "investigate") return null;
      G.spend(w, 60, 6);
      const ev = w.events[ep.ev], thief = ev && ev.secret !== null ? w.npcs[ev.secret] : null;
      if (thief && thief.alive && thief.id !== p.id && w.rng.next() < 0.45 + guardsIn(w, p.town) * 0.05) {
        w.record("theft", `수소문 끝에 ${jo(thief.name, "이/가")} ${p.name}의 금화를 훔친 범인으로 드러났다`, { actor: thief.id, target: p.id, town: p.town, imp: 4, sent: -8, cause: ev.id, wr: 0.2 });
        return `범인은 ${thief.name}였다.`;
      }
      return "한 시간을 수소문했지만 단서를 찾지 못했다.";
    },
    helped(w, p, x, ep, c) {
      if (c === "thank") { w.record("thanks", `${jo(p.name, "이/가")} ${x.name}에게 고마움을 전했다`, { actor: p.id, target: x.id, town: p.town, imp: 2, sent: 4, wr: 0.2 }); return `${x.name}에게 고맙다고 말했다.`; }
      if (c === "promise") { adjust(x, p.id, 6); return `언젠가 ${x.name}에게 꼭 갚겠다고 약속했다.`; }
      if (c === "refuse") { const a = Math.min(+((w.events[ep.ev].text.match(/(\d+)닢/) || [])[1] || 0), Math.floor(p.gold)); p.gold -= a; x.gold += a; adjust(x, p.id, -6); return "돈을 돌려주었다. 상대가 머쓱해했다."; }
      return null;
    },
    slight(w, p, x, ep, c) {
      if (c === "vow") return playerVow(w, p, x, w.events[ep.ev]);
      if (c === "forgive") { adjust(p, x.id, 10); return "마음에 담아 두지 않기로 했다."; }
      return null;
    },
    attacked(w, p, x, ep, c) {
      if (c === "vow") return playerVow(w, p, x, w.events[ep.ev]);
      if (c === "report") {
        if (!guardsIn(w, p.town)) return "이 마을엔 경비병이 없다.";
        jailFor(w, x, w.rng.randint(5, 10), `${jo(p.name, "이/가")} 자신을 습격한 ${jo(x.name, "을/를")} 신고해 ${jo(x.name, "이/가")} 감옥에 갇혔다`, p.id);
        return `${jo(x.name, "이/가")} 감옥에 갇혔다.`;
      }
      if (c === "forgive") { adjust(p, x.id, 25); w.record("forgive", `${jo(p.name, "은/는")} 자신을 습격한 ${jo(x.name, "을/를")} 용서했다`, { actor: p.id, target: x.id, town: p.town, imp: 5, sent: 8, cause: ep.ev, wr: 0.4 }); return "원한의 고리를 여기서 끊기로 했다."; }
      return null;
    },
    mourning(w, p, x, ep, c) {
      if (c === "funeral") {
        if (p.gold < 5) return "장례를 치를 돈이 없어 조용히 묵념했다.";
        p.gold -= 5; p.fame += 1;
        for (const id of family(x)) if (w.npcs[id].alive && id !== p.id) adjust(w.npcs[id], p.id, 10);
        w.record("funeral", `${jo(p.name, "이/가")} ${x.name}의 장례를 치러 주었다`, { actor: p.id, town: p.town, imp: 4, wr: 0.5 });
        return `${x.name}의 장례를 치렀다. 많은 이들이 함께 슬퍼했다.`;
      }
      if (c === "vow" && ep.data.killer !== null) return playerVow(w, p, w.npcs[ep.data.killer], w.events[ep.ev]);
      return `${jo(x.name, "을/를")} 잃은 슬픔을 삼켰다.`;
    },
    farewell(w, p, x, ep, c) {
      if (c === "together" && w.war.active && !p.at_war) { enlist(p, w); G.syncPos(w); return `${jo(x.name, "과/와")} 함께 전선으로 떠났다.`; }
      adjust(x, p.id, 6); return `${x.name}에게 꼭 살아 돌아오라고 말했다.`;
    },
    threat(w, p, x, ep, c) { if (c === "guard") { p.flags.add("guarded"); return "한동안 몸조심하기로 했다."; } return null; },
    naming(w, p, x, ep, c) {
      const nm = ep.data.names[+c.slice(1)] || x.name;
      if (nm !== x.name) { w.usedNames.delete(x.name); w.usedNames.add(nm); x.name = nm; }
      w.record("naming", `${jo(p.name, "이/가")} 아이에게 ${jo(nm, "이라는/라는")} 이름을 지어 주었다`, { actor: p.id, target: x.id, town: p.town, imp: 4, wr: 0.4 });
      return `아이의 이름을 ${jo(nm, "으로/로")} 지었다.`;
    },
    witness(w, p, x, ep, c) {
      const v = w.npcs[ep.data.victim];
      if (c === "report") {
        if (!guardsIn(w, p.town)) return "증언할 경비병이 이 마을엔 없었다.";
        jailFor(w, x, w.rng.randint(5, 10), `${jo(p.name, "이/가")} 증언해 ${jo(x.name, "이/가")} 감옥에 갇혔다`, p.id);
        adjust(v, p.id, 12); onArrest(w, x);
        return `증언했다. ${jo(x.name, "이/가")} 끌려갔다.`;
      }
      if (c === "comfort") { G.spend(w, 20, 2); adjust(v, p.id, 12); return `${jo(v.name, "을/를")} 위로했다.`; }
      return "못 본 척 지나갔다.";
    },
    oracle(w, p, x, ep, c) { A.answerOracle(w, c === "accept"); G.syncPos(w); return c === "accept" ? "용사의 검을 받아 들었다. 전선으로 향한다." : "평범한 삶을 택했다."; },
  };
  function checkOracle(w) {
    const p = w.player;
    if (p && w.war.offer === p.id && !w.episodes.some((e) => e.kind === "oracle"))
      addEp(w, { kind: "oracle", title: "여신의 신탁", text: "여신이 당신을 다음 용사로 지목했다. 받아들이면 마왕을 쓰러뜨릴 때까지 전선에서 싸운다.", def: "refuse", block: true, expires: 1e9,
        choices: [C("accept", "운명을 받아들인다", ""), C("refuse", "거부하고 평범하게 산다", "")] });
  }

  // ================================================================ 미션
  const MAX_MS = 6;
  function addMission(w, m) {
    const e = EX(w);
    if (e.missions.filter((x) => !x.done).length >= MAX_MS) return null;
    m.id = ++e.msSeq; m.got = m.got || 0; m.day = w.day; m.done = false;
    e.missions.push(m);
    G.log(w, `새 미션: ${missionTitle(w, m)}`, "quiet"); // 미션 칸에 바로 보이므로 알림은 띄우지 않는다
    return m;
  }
  function missionTitle(w, m) {
    const N = (id) => (w.npcs[id] ? w.npcs[id].name : "누군가");
    switch (m.type) {
      case "hunt": return `${G.ANIMAL[m.animal].name} ${m.n}마리 잡아오기 (${Math.min(m.got || 0, m.n)}/${m.n})`;
      case "fetch": return `${G.ITEMS[m.item].name} ${m.n}개 ${m.from !== null && m.from !== undefined ? N(m.from) + "에게" : "길드에"} 가져다주기 (${Math.min(G.ext(w).inv[m.item] || 0, m.n)}/${m.n})`;
      case "message": return `${N(m.to)}에게 ${N(m.from)}의 안부 전하기`;
      case "visit": { const f = (h) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${h % 1 ? "30" : "00"}`; return `${N(m.to)}의 집에 초대받음 (${m.day === w.day ? "오늘" : w.date(m.day)} ${f(m.start)}~${f(m.until)})`; }
      case "build": return `${N(m.from)}의 집 공사: ${m.desc} (${m.got || 0}/${m.work}시간)`;
      case "parcel": return `${N(m.to)}에게 ${m.what || "꾸러미"} 배달 (${N(m.from)}의 심부름)`;
      case "beat": return `${N(m.target)} 혼내 주기 (${N(m.from)}의 부탁)`;
      case "match": return `${N(m.b)}에게 ${N(m.a)}의 마음 전하기`;
      case "bounty": return `현상금: ${N(m.target)} 붙잡기`;
    }
    return "미션";
  }
  function missionWhere(w, m) {
    const id = m.type === "build" ? m.from : m.type === "visit" ? m.to : m.type === "message" || m.type === "parcel" ? m.to : m.type === "match" ? m.b : m.type === "beat" || m.type === "bounty" ? m.target : m.type === "fetch" && m.from !== null && m.from !== undefined ? m.from : null;
    if (id === null || id === undefined) return m.type === "hunt" ? "들판과 숲" : m.board ? `${w.towns[m.board].name} 길드` : "";
    const n = w.npcs[id];
    return n && n.alive ? (n.at_war ? "전선" : w.towns[n.town].name) : "";
  }
  function completeMission(w, m, text) {
    const p = w.player;
    m.done = true;
    p.gold += m.reward;
    p.fame += m.fame || 1;
    if (m.from !== null && m.from !== undefined && w.npcs[m.from]) adjust(w.npcs[m.from], p.id, 15);
    w.record("quest", `${jo(p.name, "이/가")} 의뢰를 해냈다: ${missionTitle(w, m).replace(/ \(.*\)$/, "")}`, { actor: p.id, target: m.from ?? null, town: p.town, imp: 3, sent: 4, wr: 0.3 });
    G.log(w, `${text || "미션 완료!"} 보상으로 금화 ${m.reward}닢을 받았다.`, "good");
    if (Story.onMission) Story.onMission(m);
  }
  function onKill(w, type) {
    for (const m of EX(w).missions) if (!m.done && m.type === "hunt" && m.animal === type) { m.got++; if (m.got >= m.n) completeMission(w, m, `${G.ANIMAL[type].name} 사냥 의뢰를 마쳤다!`); }
  }
  function onItem() {}
  function onHitNPC(w, x) {
    for (const m of EX(w).missions) if (!m.done && m.type === "beat" && m.target === x.id && (x.health <= 4 || !x.alive)) completeMission(w, m, `${jo(x.name, "을/를")} 혼내 주었다.`);
  }
  function onArrest(w, x) {
    for (const m of EX(w).missions) if (!m.done && m.type === "bounty" && m.target === x.id) completeMission(w, m, `현상범 ${jo(x.name, "이/가")} 붙잡혔다!`);
  }
  function onEnterTown() {}
  function refreshBoard(w) {
    const e = EX(w);
    e.board = {};
    for (const t of Object.keys(w.towns)) {
      const list = [];
      const r = (a, b) => w.rng.randint(a, b);
      const an = pick(w, ["rabbit", "deer", "boar", "boar", "wolf"]);
      list.push({ type: "hunt", animal: an, n: an === "rabbit" ? r(3, 5) : r(1, 3), reward: { rabbit: 12, deer: 25, boar: 40, wolf: 45 }[an], board: t, fame: 1 });
      const it = pick(w, ["herb", "mushroom", "hide", "wood", "apple", "berry", "branch", "stone", "fiber", "fiber"]);
      list.push({ type: "fetch", item: it, n: r(3, 6), reward: r(15, 35), board: t, from: null });
      const crooks = w.events.slice(-800).filter((ev) => ev && ["theft", "revenge", "murder", "assault"].includes(ev.kind) && w.day - ev.day < 30 && ev.actor !== null && w.npcs[ev.actor].alive && w.npcs[ev.actor].jail === 0 && w.npcs[ev.actor].controller !== "player").map((ev) => ev.actor);
      if (crooks.length) { const c = pick(w, crooks); list.push({ type: "bounty", target: c, reward: 50, board: t, fame: 3 }); }
      e.board[t] = list;
    }
  }
  function takeBoard(w, town, i) {
    const e = EX(w), m = (e.board && e.board[town] || [])[i];
    if (!m) return "이미 누가 가져간 의뢰다.";
    if (!addMission(w, { ...m })) return "미션을 더 맡을 수 없다 (최대 6개).";
    e.board[town].splice(i, 1);
    return `의뢰를 맡았다: ${missionTitle(w, m)}`;
  }
  function deliverToBoard(w) {
    const e = EX(w), out = [];
    for (const m of e.missions) if (!m.done && m.type === "fetch" && (m.from === null || m.from === undefined) && G.has(w, m.item, m.n)) { G.take(w, m.item, m.n); completeMission(w, m, `${G.ITEMS[m.item].name} 납품을 마쳤다.`); out.push(m); }
    return out.length;
  }

  // ================================================================ 대화
  function tone(n) {
    const t = n.traits;
    if (t.kindness > 0.68) return "warm";
    if (t.greed > 0.68) return "greedy";
    if (t.bravery > 0.72) return "bold";
    if (t.ambition > 0.72) return "proud";
    if (t.bravery < 0.3) return "shy";
    return "plain";
  }
  function tier(w, n) {
    const p = w.player;
    if (p.spouse === n.id) return "spouse";
    if (p.lover === n.id) return "lover";
    if (family(p).has(n.id)) return "family";
    const op = opinion(n, p.id);
    return op <= -25 ? "hostile" : op < 8 ? (n.known.size && [...n.known].some((id) => { const e = w.events[id]; return e && (e.actor === p.id || e.target === p.id); }) ? "acq" : "stranger") : op < 40 ? "acq" : op < 70 ? "friend" : "close";
  }
  const TIMEW = (w) => { const h = G.hour(w); return h < 11 ? "아침" : h < 14 ? "점심" : h < 19 ? "오후" : "저녁"; };
  const GREET = {
    stranger: { warm: ["처음 보는 얼굴이네요. 어서 와요, {town}에 온 걸 환영해요.", "안녕하세요! 이 마을은 처음이세요?"], greedy: ["뭐요? 볼일 있으면 빨리 말해요. 시간이 돈이라.", "흠, 처음 보는데… 뭘 팔러 왔어요, 사러 왔어요?"], bold: ["넌 누구지? 처음 보는 얼굴인데.", "어이, 새로 온 녀석이군."], proud: ["…저를 아시나요? 아, 모르시는구나.", "처음 뵙겠습니다. 저는 {self}라고 합니다. 기억해 두세요."], shy: ["아, 아… 안녕하세요…", "저, 저한테 무슨 볼일이라도…?"], plain: ["안녕하세요. 처음 뵙네요.", "어서 오세요. 무슨 일이세요?"] },
    acq: { warm: ["{me}! 좋은 {time}이에요.", "또 만났네요, {me}. 잘 지냈어요?"], greedy: ["아, {me}. 오늘은 뭐 좋은 일 있어요?", "{me}구먼. 돈 될 얘기라면 언제든 환영이지."], bold: ["{me}, 무슨 일이야?", "오, {me}. 심심하던 참이었는데."], proud: ["{me} 씨군요. 오늘도 바쁘시죠?", "아, {me}. 마침 잘 왔어요."], shy: ["아, {me}… 안녕하세요.", "{me}… 오늘 날씨 좋네요."], plain: ["{me}, 좋은 {time}이에요.", "{me}. 오늘 어때요?"] },
    friend: { warm: ["{me}! 안 그래도 보고 싶었어요.", "어머, {me}! 오늘은 뭐 하고 지냈어요?"], greedy: ["{me}! 내 좋은 친구. 오늘은 내가 한 잔 살… 생각은 없지만, 반가워요.", "{me}, 마침 좋은 정보가 있는데 들어 볼래요?"], bold: ["{me}! 오늘 한판 붙어 볼까? 농담이야.", "어이, {me}! 반갑다."], proud: ["{me}. 당신을 만나면 기분이 좋아요.", "{me}, 오늘 일은 잘 풀렸어요?"], shy: ["{me}! 와 줘서… 기뻐요.", "아, {me}… 헤헤."], plain: ["{me}! 반가워요.", "{me}, 오늘도 왔네요."] },
    close: { warm: ["{me}~! 내 소중한 친구!", "{me}가 오니까 하루가 밝아지네요."], greedy: ["{me}라면 이건 공짜로 알려 줄 수 있지.", "{me}, 당신은 특별하니까."], bold: ["{me}! 내 등을 맡길 수 있는 건 너뿐이야.", "오, 내 친구 {me}!"], proud: ["{me}, 당신만큼 믿는 사람은 없어요.", "{me}, 기다리고 있었어요."], shy: ["{me}… 사실 기다리고 있었어요.", "{me}랑 있으면 마음이 편해요."], plain: ["{me}! 늘 반가워요.", "{me}, 왔어요?"] },
    hostile: { warm: ["…{me}. 무슨 일이죠.", "솔직히 지금은 얼굴 보기가 힘드네요."], greedy: ["뭐야, 또 너야? 돈 갚으러 왔으면 모를까.", "할 말 없으면 가."], bold: ["또 너냐. 한 대 맞고 싶어서 왔어?", "꺼져. 기분 나쁘니까."], proud: ["당신과 말 섞을 시간 없습니다.", "흥. 무슨 볼일이죠?"], shy: ["…왜, 왜 왔어요.", "…"], plain: ["…무슨 일이에요.", "용건만 말해요."] },
    spouse: { _: ["여보! {time}은 먹었어요?", "{me}, 오늘 일찍 들어와요.", "당신 왔어요?"] },
    lover: { _: ["{me}! 보고 싶었어.", "{me}… 오늘도 만나서 좋다.", "어, {me}! 마침 네 생각 하고 있었어."] },
    family: { _: ["{me}야, 밥은 먹고 다니니?", "오, {me}! 가족끼리 이렇게 마주치니 좋구나.", "{me}, 별일 없지?"] },
  };
  function greeting(w, n) {
    const p = w.player, tr = tier(w, n), tn = tone(n);
    const pool = GREET[tr][tn] || GREET[tr]._ || GREET.acq.plain;
    let s = fill(pick(w, pool), { me: p.name, time: TIMEW(w), town: w.towns[n.town].name, self: n.name });
    if (n.hunger >= 3) s += " …배가 너무 고프네요.";
    else if (n.health < 5) s += " 몸이 좀 안 좋아서요.";
    if (G.isNight(w)) s = "이 시간에 무슨 일이에요…? " + s;
    const now = nowLine(w, n);
    if (now && !G.isNight(w)) s = now + " " + s;
    return s;
  }
  /** 지금 하고 있는 일 한마디 (삶의 층 n.life) */
  function nowLine(w, n) {
    const L = n.life && n.life.day === w.day ? n.life : null;
    if (!L || w.rng.next() > 0.75) return "";
    const f = L.with !== undefined && w.npcs[L.with] ? w.npcs[L.with] : null, wk = (w.weather || {}).kind;
    const withF = f ? `${jo(f.name, "이랑/랑")} ` : "";
    switch (L.act) {
      case "work": return pick(w, ["일하던 참이라 길게는 못 얘기해요.", "손이 좀 바빠서요, 금방 얘기해요.", `오늘은 ${(A.JOBS[n.job] || {}).name || "일"} 일이 많네요.`]);
      case "meal": return pick(w, ["밥 먹던 참이었어요.", L.place === "tavern" ? "여기 스튜가 오늘 괜찮아요." : "집밥이 제일이죠."]);
      case "play": return wk === "맑음" ? pick(w, [`날씨가 좋아서 ${withF}놀러 나왔어요.`, `이런 날엔 일 손에 안 잡히죠. ${withF}바람 쐬러 나왔어요.`]) : `${withF}잠깐 나와 있었어요.`;
      case "social": return f ? pick(w, [`${withF}얘기하던 중이에요.`, `${jo(f.name, "이/가")} 불러서 나왔어요.`]) : "그냥 사람 구경 나왔어요.";
      case "rest": return wk === "비" || wk === "폭풍" ? "비가 와서 오늘은 쉬어요." : wk === "눈" ? "눈이 와서 집에 있었어요." : n.fatigue > 0.6 ? "좀 지쳐서 쉬는 중이에요." : "잠깐 쉬고 있었어요.";
      case "shop": return "장 보러 나왔어요.";
      case "pray": return "기도하러 왔어요.";
      case "chores": return "집안일 좀 하던 중이었어요.";
      default: return "";
    }
  }
  const JOBTALK = new Proxy({}, { get: (_, id) => (A.JOBS[id] && A.JOBS[id].talk) || "요즘은 그냥 그래요. 하루하루 열심히 사는 거죠." });
  /** 대화 세션을 연다. opener: talk | approach | confess | propose | confront */
  function talk(w, nid, opener = "talk") {
    const n = w.npcs[nid];
    const s = { nid, lines: [], options: [], over: false, mins: 0, rumors: 0, stack: [] };
    const say = (who, text) => s.lines.push({ who, text });
    s.say = say;
    if (opener === "confess") { say("npc", `저… ${w.player.name}. 할 말이 있어요. 사실… 당신이 좋아요.`); s.options = [O("마음을 받아준다", "연인이 된다", () => romance(w, s, "accept")), O("정중히 거절한다", "", () => romance(w, s, "gentle")), O("차갑게 거절한다", "상대가 크게 상처받는다", () => romance(w, s, "cold"))]; return s; }
    if (opener === "propose") { say("npc", `${w.player.name}. 이거… 받아 줄래? 나와 결혼해 줘.`); s.options = [O("청혼을 받아들인다", "결혼한다", () => { say("me", "응, 좋아!"); say("sys", marry(w, w.player, n)); toMenu(w, s); }), O("아직은 때가 아니라고 말한다", "", () => { adjust(n, w.player.id, -10); say("me", "조금만 더 기다려 줄래?"); say("npc", "…알았어. 기다릴게."); toMenu(w, s); })]; return s; }
    if (opener === "confront") { confrontByNPC(w, s, n); return s; }
    if (opener === "invite") { say("npc", pick(w, [`${w.player.name}! 오늘 저녁에 우리 집에 올래요? 6시쯤부터 있을게요.`, `저기… 오늘 저녁에 시간 돼요? 우리 집에서 밥 한번 같이 먹어요.`])); s.options = inviteChoices(w, n, s); return s; }
    const vc = visitCtx(w, n);
    if (vc) { // 초대받은 집 안: 집에서만 나오는 대화
      const kid = !isAdult(n);
      say("npc", vc.isHost ? (vc.inv.greeted ? pick(w, ["더 필요한 거 있어요? 편하게 있어요.", "차 식기 전에 마셔요.", "심심하진 않죠?"]) : pick(w, [`${w.player.name}, 와 줬네요! 편하게 앉아요.`, "어서 와요. 누추하지만 편하게 있어요.", "기다렸어요! 들어와요, 들어와."]))
        : kid ? pick(w, ["안녕하세요! 손님이다!", `${vc.host.name} 손님이에요? 안녕하세요.`]) : pick(w, [`아, ${vc.host.name}의 손님이군요. 어서 와요.`, `${vc.host.name}한테 얘기 들었어요. 편하게 있어요.`]));
      if (vc.isHost) vc.inv.greeted = true;
      visitMenu(w, s, vc);
      return s;
    }
    say("npc", greeting(w, n));
    if (opener === "approach") {
      const news = n.mem.filter((m) => !w.player.known.has(m.e) && w.events[m.e] && w.events[m.e].imp >= 3);
      if (news.length) { const e = w.events[maxBy(news, (m) => w.events[m.e].imp * m.s).e]; say("npc", `있잖아요, ${e.text}. 들었어요?`); w.remember(w.player, e, false, n.id); s.lastRumor = e.id; }
    }
    toMenu(w, s);
    return s;
  }
  const O = (label, hint, go, cls) => ({ label, hint, go, cls });
  function toMenu(w, s) {
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    const opts = [];
    // 미션과 관련된 말
    for (const m of e.missions) {
      if (m.done) continue;
      if (m.type === "message" && m.to === n.id) opts.push(O(`${w.npcs[m.from].name}의 안부를 전한다`, "미션", () => { s.say("me", `${jo(w.npcs[m.from].name, "이/가")} 안부 전해 달래요.`); s.say("npc", pick(w, ["어머, 정말요? 고마워요. 나도 보고 싶다고 전해 줘요.", "그 사람이? 잊지 않았구나…", "하하, 그 녀석 아직 살아 있었군!"])); adjust(n, m.from, 10); completeMission(w, m); toMenu(w, s); }, "quest"));
      if (m.type === "parcel" && m.to === n.id) opts.push(O(`${jo(m.what || "꾸러미", "을/를")} 건넨다`, "심부름", () => { s.say("me", `${w.npcs[m.from].name}이(가) 보낸 ${m.what || "꾸러미"}예요.`); s.say("npc", pick(w, ["어머, 벌써 왔네요? 수고했어요.", "기다리던 거예요! 고마워요.", "이 먼 데까지… 고생했어요."])); adjust(n, p.id, 4); completeMission(w, m, "심부름을 마쳤다!"); toMenu(w, s); }, "quest"));
      if (m.type === "match" && m.b === n.id) opts.push(O(`${w.npcs[m.a].name}의 마음을 전한다`, "미션", () => matchmake(w, s, m), "quest"));
      if (m.type === "fetch" && m.from === n.id && G.has(w, m.item, m.n)) opts.push(O(`${G.ITEMS[m.item].name} ${m.n}개를 건넨다`, "미션", () => { G.take(w, m.item, m.n); s.say("me", "부탁한 거 가져왔어요."); s.say("npc", pick(w, ["정말 고마워요! 이거 받아요.", "와, 이렇게 빨리? 약속한 보수예요.", "덕분에 살았어요."])); completeMission(w, m); toMenu(w, s); }, "quest"));
    }
    const vc0 = visitCtx(w, n);
    if (vc0) opts.push(O("집에서 함께 시간 보내기", vc0.isHost ? "차·저녁·집 구경·속 이야기" : "가족 이야기", () => visitMenu(w, s, vc0), "heart"));
    const date = (e.dates || []).find((d) => d.who === n.id && d.day === w.day);
    if (date && G.hour(w) >= 18.5 && G.hour(w) < 22.5) opts.push(O("(데이트) 함께 저녁을 먹는다", "약속한 데이트", () => dateNight(w, s, date), "heart"));
    opts.push(O("요즘 어때요?", "그 사람의 사정을 듣는다", () => howAreYou(w, s)));
    opts.push(O("무슨 소식 없어요?", "소문을 듣는다", () => rumor(w, s)));
    if (isAdult(n) && !related(p, n) && !e.missions.some((m) => !m.done && m.type === "visit" && m.to === n.id)) opts.push(O("집에 놀러 가도 돼요?", "친한 사이라면 초대해 준다", () => askVisit(w, s), "heart"));
    if (p.job === "builder" && isAdult(n) && n.id !== p.id && !e.missions.some((m) => !m.done && m.type === "build" && m.from === n.id)) opts.push(O("집에 고칠 데 없어요?", "목수로서 일감을 얻는다", () => askBuild(w, s), "quest"));
    if (n.job === "builder" && isAdult(n) && p.home) opts.push(O("집을 고치고 싶어요", e.reno ? (e.reno.builder === n.id ? `공사 중 · ${Math.max(0, e.reno.until - w.day)}일 남음` : "다른 목수가 공사 중") : "넓히기·지붕·벽·바닥", () => renoMenu(w, s), "quest"));
    if (isAdult(n)) opts.push(O("꿈이 뭐예요?", knowsDream(w, n) ? "이미 들은 꿈이다. 요즘은 어떤지 묻는다" : "그 사람이 바라는 삶을 듣는다", () => askDream(w, s)));
    opts.push(O("…에 대해 물어볼게요", "누군가에 대해 묻는다", () => askMenu(w, s)));
    const canLearn = knowList(n).filter((k) => !A.knows(p, k)), canTeach = knowList(p).filter((k) => !A.knows(n, k));
    if (isAdult(n) && canLearn.length) opts.push(O("무언가 가르쳐 줄 수 있어요?", `${canLearn.map((k) => A.KNOW(k).name).join(", ")}`, () => learnMenu(w, s, canLearn), "quest"));
    if (isAdult(n) && canTeach.length) opts.push(O("내가 아는 걸 알려 줄게요", `${canTeach.map((k) => A.KNOW(k).name).join(", ")}`, () => teachMenu(w, s, canTeach)));
    opts.push(O("선물을 건넨다", "가방에서 고른다", () => giftMenu(w, s)));
    if (isAdult(n) && !s.picked) opts.push(O("(몰래) 주머니를 슬쩍한다", "들키면 수배된다", () => pickpocket(w, s), "harm"));
    opts.push(O("부탁이 있어요", "돈, 일거리", () => favorMenu(w, s)));
    if (isAdult(n) && !related(p, n)) opts.push(O("마음을 표현한다", "칭찬, 데이트, 고백, 청혼", () => heartMenu(w, s), "heart"));
    const wrong = wrongsBy(w, n);
    opts.push(O(wrong ? `${wrong.text.length > 18 ? "그 일" : wrong.text}에 대해 따진다` : "언성을 높인다", wrong ? "나에게 한 짓을 따진다" : "위협하거나 모욕한다", () => conflictMenu(w, s, wrong), "harm"));
    opts.push(O("잘 있어요", "대화를 마친다", () => { s.say("me", pick(w, ["그럼 이만.", "또 봐요.", "잘 있어요!"])); s.say("npc", farewell(w, n)); s.over = true; }));
    s.options = opts;
  }
  function farewell(w, n) {
    const tr = tier(w, n);
    return tr === "hostile" ? pick(w, ["흥.", "다신 오지 마요.", "…"]) : tr === "spouse" || tr === "lover" ? pick(w, ["이따 봐!", "조심해서 다녀와.", "보고 싶을 거야."]) : pick(w, ["또 봐요!", "조심히 가요.", "다음에 또 얘기해요.", "좋은 하루 보내요."]);
  }
  const back = (w, s) => O("다른 이야기를 하자", "", () => toMenu(w, s));
  function tick5(s) { s.mins += 5; }

  // ---- 소매치기
  function pickpocket(w, s) {
    const p = w.player, n = w.npcs[s.nid];
    s.picked = true; s.mins += 2;
    const chance = 0.5 + (p.job === "merchant" ? 0.1 : 0) - (JOBS[n.job].guard ? 0.3 : 0) - n.traits.bravery * 0.15 + (G.isNight(w) ? 0.1 : 0);
    if (w.rng.next() < chance) {
      const amt = Math.max(0, Math.floor(Math.min(n.gold * 0.3, 25)));
      if (!amt) { s.say("sys", "슬쩍 손을 넣어 봤지만, 주머니가 텅 비어 있었다."); toMenu(w, s); return; }
      n.gold -= amt; p.gold += amt;
      w.record("theft_unknown", `누군가 ${n.name}의 주머니에서 금화 ${amt}닢을 슬쩍했다`, { target: n.id, town: n.town, imp: 2, wr: 0.2, secret: p.id });
      s.say("sys", `아무도 모르게 금화 ${amt}닢을 빼냈다.`); toMenu(w, s); return;
    }
    adjust(n, p.id, -35);
    G.crime(w, "pickpocket", n, 1, `${jo(p.name, "이/가")} ${n.name}의 주머니를 털려다 들켰다`);
    s.say("npc", pick(w, ["지금 뭐 하는 거야?! 도둑이야!", "손 치워! 경비병! 경비병!"])); s.over = true;
  }

  // ---- 초대받은 집 안
  /** 지금 이 사람의 집에 초대받아 들어와 있는가 */
  function visitCtx(w, n) {
    const bd = G.insideBuilding(w);
    if (!bd || bd.kind !== "house") return null;
    const inv = G.inviteAt(w, bd);
    if (!inv) return null;
    const hh = G.houseOfNpc(n);
    if (hh.town !== bd.town || hh.hid !== bd.hid) return null;
    return { bd, inv, host: w.npcs[inv.to], isHost: inv.to === n.id, pl: G.MAP.places.find((q) => q.b === bd.id) };
  }
  function visitMenu(w, s, vc) {
    const { inv, host, isHost, pl } = vc, n = w.npcs[s.nid], p = w.player, h = G.hour(w), deep = (inv.deep = inv.deep || {}), fam = (inv.fam = inv.fam || {});
    const act = (id, me, reply) => () => {
      s.say("me", me);
      const r = G.doBuilding(w, pl, id);
      if (r.slept) { s.slept = true; s.over = true; return; }
      if (r.text) s.say("sys", r.text);
      if (reply) s.say("npc", reply);
      visitMenu(w, s, vc);
    };
    const opts = [];
    if (isHost) {
      opts.push(O("차 한잔 해요", "1시간 · 더 가까워진다", act("visit:tea", "차 한잔 마셔도 돼요?", null), "heart"));
      if (h >= 17 && !inv.ate) opts.push(O("같이 저녁 먹어요", "1시간 · 배를 채운다", act("visit:meal", "배고프다… 같이 저녁 먹을래요?", pick(w, ["많이 먹어요. 또 해 줄게요.", "입에 맞아요? 다행이다."]))));
      if (!inv.looked) opts.push(O("집 구경시켜 줄래요?", "10분", act("visit:look", "집 구경 좀 해도 돼요?", null)));
    }
    if (!fam[n.id]) opts.push(O("가족 이야기 들려줄래요?", "이 집에 사는 사람들", () => familyTalk(w, s, vc)));
    if (isAdult(n) && !deep[n.id] && (opinion(n, p.id) >= 45 || p.spouse === n.id || p.lover === n.id)) opts.push(O("요즘 고민 있어요?", "속 깊은 이야기", () => deepTalk(w, s, vc), "heart"));
    if (isHost && h >= 20.5 && (host.lover === p.id || host.spouse === p.id || opinion(host, p.id) >= 70)) opts.push(O("오늘 여기서 자고 가도 될까요?", "하룻밤 묵는다", act("visit:stay", "오늘… 여기서 자고 가도 될까요?", null), "heart"));
    opts.push(O("다른 이야기도 해요", "", () => toMenu(w, s)));
    if (isHost) opts.push(O("이만 가 볼게요", "집을 나선다", () => leaveVisit(w, s, vc)));
    else opts.push(O("잘 있어요", "대화를 마친다", () => { s.say("me", "편히 쉬어요."); s.say("npc", farewell(w, n)); s.over = true; }));
    s.options = opts;
  }
  function familyTalk(w, s, vc) {
    const n = w.npcs[s.nid], fl = familyList(w, n).filter((f) => f.x.alive);
    vc.inv.fam[n.id] = true; tick5(s); adjust(n, w.player.id, 2);
    s.say("me", "가족 이야기 좀 들려줄래요?");
    const home = fl.filter((f) => !f.x.at_war && f.x.town === n.town), away = fl.filter((f) => !home.includes(f));
    if (!fl.length) s.say("npc", pick(w, ["혼자 살아요. 가끔은 적적하죠.", "식구는 없어요. 그래서 이렇게 손님이 오면 좋아요."]));
    else {
      if (home.length) s.say("npc", `이 집엔 ${home.slice(0, 4).map((f) => `${f.rel} ${f.x.name}`).join(", ")}${home.length > 4 ? " 말고도 더 있어요" : ""}. ${pick(w, ["시끌벅적하죠?", "다들 착해요.", "가끔 싸우기도 해요, 하하."])}`);
      const war = away.find((f) => f.x.at_war);
      if (war) s.say("npc", `${f2(war)} 지금 전선에 나가 있어요. …무사히 돌아와야 할 텐데.`);
      else if (away.length) s.say("npc", `${f2(away[0])} ${w.towns[away[0].x.town] ? w.towns[away[0].x.town].name : "먼 곳"}에 살아요. 자주는 못 봐요.`);
      const kid = home.find((f) => !isAdult(f.x));
      if (kid) s.say("npc", `${jo(kid.x.name, "은/는")} 요즘 ${A.age(kid.x) < 6 ? "말이 부쩍 늘었어요" : "뭘 해도 제멋대로예요"}. 귀엽죠.`);
    }
    visitMenu(w, s, vc);
  }
  const f2 = (f) => `${f.rel} ${jo(f.x.name, "은/는")}`;
  /** 속 깊은 이야기: 이 사람이 마음에 품은 것 하나를 털어놓는다 */
  function deepTalk(w, s, vc) {
    const p = w.player, n = w.npcs[s.nid], fam = A.family(n);
    vc.inv.deep[n.id] = true; s.mins += 20; adjust(n, p.id, 4); adjust(p, n.id, 2);
    s.say("me", "요즘 고민 있어요? 들어 줄게요.");
    const ids = Object.keys(n.rel).map(Number).filter((id) => id !== p.id && w.npcs[id] && w.npcs[id].alive && !fam.has(id));
    const fav = maxBy(ids.filter((id) => isAdult(w.npcs[id]) && n.rel[id] >= 50), (id) => n.rel[id]);
    const foe = maxBy(ids.filter((id) => n.rel[id] <= -30), (id) => -n.rel[id]);
    const cand = [];
    if (p.spouse === n.id || p.lover === n.id) cand.push(() => pick(w, ["고민은… 당신이 요즘 너무 바쁜 거? 농담이에요. 이렇게 와 줘서 좋아요.", "가끔 무서워요. 이 행복이 깨질까 봐."]));
    if (fav !== undefined && fav !== null && !n.spouse && !n.lover) cand.push(() => `사실… ${jo(w.npcs[fav].name, "을/를")} 좋아해요. 아무한테도 말하면 안 돼요.`);
    if (foe !== undefined && foe !== null) cand.push(() => `${w.npcs[foe].name}만 생각하면 아직도 속이 끓어요. ${pick(w, ["용서가 잘 안 돼요.", "언젠가 따져야 할까요?"])}`);
    if (n.gold < 10) cand.push(() => "요즘 살림이 빠듯해요. 이번 겨울을 어떻게 날지…");
    if (n.health < 6) cand.push(() => "몸이 예전 같지 않아요. 괜찮은 척하는 거예요.");
    if (n.dream) cand.push(() => { const e = EX(w); e.dreams = e.dreams || {}; e.dreams[n.id] = n.dream.id + "@" + n.dream.since; return `언젠가는 꼭 ‘${A.dreamName(n)}’. ${A.dreamProgress(n, w) > 0.5 ? "이제 거의 다 왔어요." : "아직 한참 멀었지만요."}`; });
    if (!cand.length) cand.push(() => pick(w, ["고민이요? 글쎄요… 이렇게 같이 있으니 딱히 없네요.", "별일 없이 사는 게 제일이죠."]));
    s.say("npc", pick(w, cand)());
    s.say("sys", `${jo(n.name, "과/와")} 한층 가까워졌다.`);
    visitMenu(w, s, vc);
  }
  function leaveVisit(w, s, vc) {
    const n = w.npcs[s.nid];
    s.say("me", pick(w, ["오늘 정말 즐거웠어요. 이만 가 볼게요.", "초대해 줘서 고마워요. 이만 가 볼게요."]));
    s.say("npc", pick(w, ["와 줘서 고마워요. 또 놀러 와요!", "벌써 가요? 조심히 가요.", "다음엔 내가 놀러 갈게요."]));
    adjust(n, w.player.id, 2);
    vc.inv.done = true;
    w.ppos = { x: vc.bd.door[0] + 0.5, y: vc.bd.door[1] + 0.6 };
    s.over = true;
  }

  // ---- 초대
  /** 초대 미션을 만든다. from~until은 시(6~24) */
  function invite(w, n, from, until) {
    const e = EX(w);
    if (e.missions.some((m) => !m.done && m.type === "visit" && m.to === n.id)) return null;
    const hh = G.houseOfNpc(n);
    if (!hh.hid) return null;
    return addMission(w, { type: "visit", to: n.id, town: hh.town, hid: hh.hid, day: w.day, reward: 0, start: Math.max(from, Math.floor(G.hour(w) * 2) / 2), until });
  }
  function askVisit(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], op = opinion(n, p.id), h = G.hour(w);
    s.say("me", pick(w, ["다음에 집에 한번 놀러 가도 돼요?", "집 구경 시켜 줄래요?"]));
    if (op < 30) { s.say("npc", pick(w, ["음… 아직은 좀 그래요. 우리 사이가 그 정도는 아니잖아요.", "집은 좀… 다음에요."])); adjust(n, p.id, -1); toMenu(w, s); return; }
    if (n.at_war || n.jail > 0) { s.say("npc", "지금은 집에 갈 수가 없어요."); toMenu(w, s); return; }
    if (h >= 21) { s.say("npc", "오늘은 너무 늦었어요. 내일 다시 물어봐요."); toMenu(w, s); return; }
    const work = h >= 8 && h < 17 && op < 60;
    const from = work ? 18 : h, until = Math.min(22, (work ? 18 : h) + 3);
    if (!invite(w, n, from, until)) { s.say("npc", "이미 초대했잖아요!"); toMenu(w, s); return; }
    s.say("npc", work ? "좋아요! 지금은 일하는 중이라… 저녁 6시쯤 와요. 맛있는 거 해 놓을게요." : pick(w, ["좋아요, 지금 같이 가요! 좀 어질러져 있지만요.", "물론이죠. 우리 집은 저기예요, 따라와요."]));
    toMenu(w, s);
  }
  /** 주민이 먼저 초대한다 (말을 걸러 오거나, 아침에 초대장을 보낸다) */
  function inviteChoices(w, n, s) {
    return [O("좋아요, 갈게요!", "저녁 6시~10시", () => { invite(w, n, 18, 22); adjust(n, w.player.id, 3); s.say("npc", "와, 기다릴게요!"); toMenu(w, s); }, "heart"),
      O("오늘은 어려워요", "", () => { adjust(n, w.player.id, -2); s.say("npc", "…그래요. 다음에 꼭 와요."); toMenu(w, s); })];
  }

  // ---- 내가 목수일 때: 주민의 집 공사 받기
  function buildMission(w, n, job) {
    return addMission(w, { type: "build", from: n.id, town: job.town, hid: job.hid, kind: job.kind, style: job.style, mod: job.mod, desc: job.desc, fee: job.fee, reward: job.fee, needs: job.needs, work: job.work, got: 0 });
  }
  function askBuild(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", "목수 일을 하고 있어요. 혹시 집에 고칠 데 없어요?");
    if (opinion(n, p.id) < -10) { s.say("npc", "당신한테 우리 집을 맡길 순 없어요."); toMenu(w, s); return; }
    if (n.gold < 40) { s.say("npc", "고치고 싶은 데야 많지만… 지금은 돈이 없어요."); toMenu(w, s); return; }
    const job = A.buildJob(w, n);
    if (!job || n.gold < job.fee * 0.6) { s.say("npc", "지금은 괜찮아요. 나중에 부탁할게요."); toMenu(w, s); return; }
    s.say("npc", `마침 잘 왔어요! ${job.desc}… 해 줄 수 있어요? 금화 ${job.fee}닢 드릴게요. 재료는 ${Object.entries(job.needs).map(([id, k]) => `${G.ITEMS[id].name} ${k}개`).join(", ")}쯤 필요할 거예요.`);
    s.options = [O("맡겨 주세요", `${job.work}시간 일해야 한다 · 집 앞에서 E`, () => { buildMission(w, n, job); s.say("npc", "좋아요, 기대할게요!"); toMenu(w, s); }, "quest"), O("다음에 할게요", "", () => toMenu(w, s))];
  }
  /** 주민이 먼저 목수인 나를 찾아와 공사를 부탁한다 */
  function offerBuild(w, n, job) {
    if (EX(w).missions.some((m) => !m.done && m.type === "build" && m.from === n.id)) return;
    addEp(w, { kind: "build_offer", who: n.id, data: { job }, title: "공사 의뢰가 들어왔다", text: `${jo(n.name, "이/가")} 목수인 나를 찾아왔다. "${job.desc}… 금화 ${job.fee}닢 드릴게요."`, def: "no",
      choices: [C("yes", "맡겠다", `재료 ${Object.entries(job.needs).map(([id, k]) => `${G.ITEMS[id].name} ${k}`).join(", ")} · ${job.work}시간`), C("no", "이번엔 사양한다", "")] });
  }

  // ---- 집 공사
  function renoMenu(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    s.say("me", "제 집을 좀 고치고 싶은데요.");
    if (e.reno) { s.say("npc", e.reno.builder === n.id ? `지금 하고 있잖아요! ${Math.max(0, e.reno.until - w.day)}일만 기다려요.` : "다른 목수한테 맡긴 공사가 있잖아요. 그게 끝나면 와요."); toMenu(w, s); return; }
    if (opinion(n, p.id) < -20) { s.say("npc", "당신 일은 안 받아요."); toMenu(w, s); return; }
    if (n.town !== p.home) s.say("npc", `${w.towns[p.home].name}까지 가야 하는군요. 그래도 해 드리죠.`);
    s.say("npc", pick(w, ["어떻게 고쳐 드릴까요? 재료가 모자라면 제가 구해 오는 대신 값을 더 받아요.", "뭐든 말만 해요. 나무랑 돌을 가져오면 싸게 해 드리죠."]));
    const list = G.renoOptions(w);
    s.options = [...list.slice(0, 12).map((o) => O(`${o.name} — 금화 ${o.cost}`, `${o.r.days}일${Object.keys(o.r.needs || {}).length ? ` · 재료 ${Object.entries(o.r.needs).map(([id, k]) => `${G.ITEMS[id].name} ${k}`).join(", ")}` : ""}${o.extra ? ` (모자란 재료값 ${o.extra} 포함)` : " (재료는 내 것으로)"}`, () => {
      const r = G.orderReno(w, n, o.r.id, o.r.mod); s.say("me", "이걸로 부탁해요.");
      if (e.reno && e.reno.builder === n.id) { s.say("npc", `좋아요, 내일 아침부터 시작할게요. ${o.r.days}일이면 끝나요.`); s.say("sys", `금화 ${o.cost}닢을 냈다.`); }
      else s.say("npc", r.includes("모자라") ? "돈이 모자라잖아요. 더 모아서 와요." : r);
      toMenu(w, s);
    }, o.r.kind === "expand" ? "quest" : null)), back(w, s)];
    if (!list.length) { s.say("npc", "더 고칠 데가 없을 만큼 좋은 집이네요!"); toMenu(w, s); }
  }

  // ---- 지식 주고받기
  const knowList = (n) => A.knownSkills(n);
  function learnMenu(w, s, list) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], op = opinion(n, p.id);
    s.say("me", "혹시 저한테 가르쳐 줄 수 있는 게 있어요?");
    if (op < 5) { s.say("npc", pick(w, ["내가 왜 당신한테 그걸 가르쳐 줘야 하죠?", "아직 그럴 사이는 아닌 것 같네요."])); toMenu(w, s); return; }
    const fee = op >= 40 ? 0 : 8;
    s.say("npc", fee ? `음… 금화 ${fee}닢이면 반나절 가르쳐 줄게요.` : "당신이라면 공짜로 알려 줄게요. 잘 봐요.");
    s.options = [...list.map((k) => O(`‘${A.KNOW(k).name}’ 배우기`, `${A.KNOW(k).desc || ""} · 2시간${fee ? ` · 금화 ${fee}` : ""}`, () => {
      if (p.gold < fee) { s.say("npc", "돈이 모자라잖아요."); toMenu(w, s); return; }
      p.gold -= fee; n.gold += fee; A.learn(p, k); s.mins += 120; adjust(n, p.id, 4);
      w.record("learn", `${jo(p.name, "이/가")} ${n.name}에게 ‘${A.KNOW(k).name}’${jo(A.KNOW(k).name, "을/를").slice((A.KNOW(k).name).length)} 배웠다`, { actor: n.id, target: p.id, town: n.town, imp: 2, sent: 3, wr: 0.2, data: { skill: k } });
      s.say("sys", `‘${A.KNOW(k).name}’${jo(A.KNOW(k).name, "을/를").slice((A.KNOW(k).name).length)} 익혔다. 만들기(K)나 작업대에서 새로 만들 수 있는 것이 생겼다.`); toMenu(w, s);
    }, "quest")), back(w, s)];
  }
  function teachMenu(w, s, list) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", "제가 아는 걸 하나 알려 줄게요.");
    if (opinion(n, p.id) < -10) { s.say("npc", "당신한테 배울 건 없어요."); toMenu(w, s); return; }
    s.options = [...list.map((k) => O(`‘${A.KNOW(k).name}’ 가르치기`, A.KNOW(k).lost ? "잊힌 비술이다. 세상에 퍼지면 무엇이 생길지 모른다" : "1시간", () => {
      A.learn(n, k); s.mins += 60; adjust(n, p.id, 8 + (A.KNOW(k).lost ? 8 : 0)); p.fame += A.KNOW(k).lost ? 2 : 0;
      w.record("learn", `${jo(p.name, "이/가")} ${n.name}에게 ‘${A.KNOW(k).name}’${jo(A.KNOW(k).name, "을/를").slice((A.KNOW(k).name).length)} 가르쳐 주었다`, { actor: p.id, target: n.id, town: n.town, imp: A.KNOW(k).lost ? 6 : 2, sent: 4, wr: 0.3, data: { skill: k } });
      s.say("npc", A.KNOW(k).lost ? pick(w, ["이, 이런 게 세상에 있었다니…!", "평생 잊지 않을게요. 이건 정말 대단한 거예요."]) : pick(w, ["오, 그렇게 하는 거군요!", "고마워요. 써먹을게요."])); toMenu(w, s);
    })), back(w, s)];
  }

  // ---- 꿈
  /** 내가 이 사람의 지금 꿈을 아는가 (꿈이 바뀌면 다시 물어야 안다) */
  function knowsDream(w, n) { const k = (EX(w).dreams || {})[n.id]; return !!(n.dream && k && k === n.dream.id + "@" + n.dream.since); }
  function askDream(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    s.say("me", pick(w, ["당신은 꿈이 뭐예요?", "앞으로 어떻게 살고 싶어요?", "이루고 싶은 게 있어요?"]));
    if (opinion(n, p.id) < -10) { s.say("npc", pick(w, ["그걸 왜 당신한테 말해요?", "…별로 말하고 싶지 않네요."])); toMenu(w, s); return; }
    if (!n.dream) { s.say("npc", pick(w, ["글쎄요… 요즘은 뭘 바라야 할지 모르겠어요.", "꿈이요? 그런 걸 생각해 본 지 오래됐네요.", "아직은 그냥 하루하루 사는 거죠."])); toMenu(w, s); return; }
    const d = A.DREAMS[n.dream.id], pr = A.dreamProgress(n, w), known = knowsDream(w, n);
    const line = { wealth: "언젠가 큰돈을 모아서 아무 걱정 없이 살고 싶어요.", shop: n.dream.job && A.JOBS[n.dream.job] ? `사실… ${jo(A.JOBS[n.dream.job].name, "이/가")} 되는 게 꿈이에요. 그래서 돈을 모으고 있어요.` : null, family: "사랑하는 사람이랑 작은 집에서 아이 키우며 사는 거요.",
      fame: "모두가 내 이름을 아는 날이 올 거예요. 두고 봐요.", nation: "이 땅은 너무 좁아요. 아무도 살지 않는 땅에 누구도 굶지 않는 나라를 세울 거예요. 함께할 사람을 찾고 있어요.", wander: "이 마을 밖 세상이 궁금해요. 여기저기 떠돌며 살아 보고 싶어요.", kindness: "누군가 힘들 때 제일 먼저 떠오르는 사람이 되고 싶어요.", quiet: "큰 거 안 바라요. 오늘 같은 날이 계속되면 좋겠어요." }[n.dream.id]
      || `‘${A.dreamName(n)}’… 그게 제 꿈이에요.`;
    s.say("npc", known ? pick(w, [`아직 그 꿈 그대로예요. ${pr >= 0.6 ? "이제 거의 다 왔어요!" : pr >= 0.3 ? "조금씩 가까워지고 있어요." : "갈 길이 멀지만요."}`, `${pr >= 0.6 ? "곧 이룰 수 있을 것 같아요!" : "여전히 노력 중이에요."}`]) : line);
    e.dreams = e.dreams || {}; e.dreams[n.id] = n.dream.id + "@" + n.dream.since;
    if (!known) adjust(n, p.id, 3);
    s.options = [
      O("응원할게요", "", () => { s.say("me", "꼭 이룰 거예요. 응원할게요."); adjust(n, p.id, 4 + n.traits.kindness * 3); s.say("npc", pick(w, ["고마워요. 힘이 나네요.", "헤헤, 누가 응원해 주니까 좋다."])); toMenu(w, s); }),
      ...(n.dream.id === "nation" && p.follows !== n.id ? [O("나도 그 나라에 함께할게요", "나라가 세워지면 이주할 수 있다", () => { p.follows = n.id; adjust(n, p.id, 15); w.record("follow_founder", `${jo(p.name, "이/가")} 새 나라를 세우겠다는 ${n.name}의 뜻에 함께하기로 했다`, { actor: p.id, target: n.id, town: n.town, imp: 4, sent: 2, wr: 0.5 }); s.say("npc", "정말이야?! 좋아, 우리 함께 새 세상을 만들자."); toMenu(w, s); }, "quest")] : []),
      ...(n.dream.id === "nation" && p.gold >= 20 ? [O("나라 세우는 데 금화 20닢을 보탠다", "개척 자금", () => { p.gold -= 20; n.gold += 20; adjust(n, p.id, 10); s.say("npc", "이 돈은 새 나라의 첫 벽돌이 될 거야. 잊지 않을게."); toMenu(w, s); })] : []),
      ...(n.dream.id === "shop" && p.gold >= 20 && n.job !== n.dream.job ? [O("금화 20닢을 보탠다", "꿈에 한 걸음 다가간다", () => { p.gold -= 20; n.gold += 20; adjust(n, p.id, 15); w.record("help", `${jo(p.name, "이/가")} ${A.JOBS[n.dream.job].name}의 꿈을 꾸는 ${n.name}에게 금화 20닢을 보탰다`, { actor: p.id, target: n.id, town: n.town, imp: 3, sent: 6, wr: 0.3 }); s.say("npc", "이, 이걸요…? 꼭 갚을게요. 정말 고마워요!"); toMenu(w, s); })] : []),
      O("현실적으로 생각해요", "꿈을 깎아내린다", () => { adjust(n, p.id, -6); s.say("npc", pick(w, ["…그렇게 말할 줄은 몰랐네요.", "흥, 두고 봐요."])); toMenu(w, s); }, "harm"),
      back(w, s)];
  }

  // ---- 요즘 어때요
  function howAreYou(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", pick(w, ["요즘 어때요?", "별일 없어요?", "요즘 지내기는 어때요?"]));
    if (opinion(n, p.id) < -25) { s.say("npc", pick(w, ["당신이 알아서 뭐 하게요.", "그걸 왜 당신한테 말해야 하죠?"])); toMenu(w, s); return; }
    // 1) 슬픔
    const fam = family(n);
    const grief = n.mem.map((m) => w.events[m.e]).filter((e) => e && ["death", "murder", "fallen"].includes(e.kind) && (fam.has(e.target) || opinion(n, e.target) >= 60) && w.day - e.day < 60).sort((a, b) => b.day - a.day)[0];
    if (grief) {
      const dead = w.npcs[grief.target], killer = grief.actor !== null ? w.npcs[grief.actor] : null;
      s.say("npc", pick(w, [`${dead.name} 생각만 하면… 아직도 믿기지 않아요.`, `${jo(dead.name, "이/가")} 떠난 뒤로 집이 텅 빈 것 같아요.`, `요즘은… ${dead.name}의 빈자리가 너무 커요.`]));
      s.options = [
        O("힘내요. 내가 곁에 있을게요", "", () => { s.say("me", "힘내요. 필요하면 언제든 불러요."); adjust(n, p.id, 6 + n.traits.kindness * 6); s.say("npc", pick(w, ["…고마워요. 그 말이 큰 힘이 되네요.", "당신은 좋은 사람이에요."])); toMenu(w, s); }),
        ...(killer && killer.alive ? [O("누가 그랬는지 알아요?", "", () => {
          s.say("me", "누가 그런 짓을 했는지 알아요?");
          w.remember(p, grief, false, n.id);
          s.say("npc", `${killer.name}… 그 사람이에요. ${n.goal && n.goal.target === killer.id ? "언젠가 반드시 갚아 줄 거예요." : "생각하고 싶지도 않아요."}`);
          revengeOptions(w, s, n, killer); })] : []),
        back(w, s)];
      return;
    }
    // 2) 복수심
    if (n.goal && n.goal.type === "revenge" && w.npcs[n.goal.target].alive) {
      const t = w.npcs[n.goal.target], og = w.events[n.goal.origin];
      s.say("npc", pick(w, [`${t.name}… 그 녀석만 생각하면 피가 끓어요.`, `${t.name}에게 당한 걸 잊을 수가 없어요.`, `언젠가 ${t.name}에게 갚아 줄 날이 올 거예요.`]) + (og ? ` (${og.text})` : ""));
      if (og) w.remember(p, og, false, n.id);
      revengeOptions(w, s, n, t);
      return;
    }
    // 3) 사랑
    if (n.lover !== null && w.npcs[n.lover].alive && n.lover !== p.id) { s.say("npc", pick(w, [`요즘 ${w.npcs[n.lover].name}이랑 잘 지내요. 헤헤.`, `사실 ${w.npcs[n.lover].name}이랑 사귀고 있어요. 비밀이에요!`])); s.options = [O("잘 어울려요!", "", () => { adjust(n, p.id, 4); s.say("npc", "정말요? 고마워요!"); toMenu(w, s); }), O("오래가길 바라요", "", () => { s.say("npc", "그러게요."); toMenu(w, s); }), back(w, s)]; return; }
    const crush = Object.entries(n.rel).map(([k, v]) => [w.npcs[+k], v]).filter(([z, v]) => z && z.alive && v >= 50 && z.id !== p.id && z.spouse === null && n.spouse === null && n.lover === null && !related(n, z) && isAdult(z)).sort((a, b) => b[1] - a[1])[0];
    if (crush && opinion(n, p.id) >= 20) {
      const z = crush[0];
      s.say("npc", pick(w, [`사실… ${jo(z.name, "을/를")} 좋아하는 것 같아요. 아무한테도 말하지 마요!`, `${z.name} 있잖아요… 요즘 자꾸 생각나요.`]));
      s.options = [
        O("응원할게요", "", () => { adjust(n, p.id, 4); s.say("npc", "고마워요… 용기 내 볼게요."); toMenu(w, s); }),
        O("내가 다리를 놓아 줄게요", "미션이 생긴다", () => { s.say("me", `내가 ${z.name}에게 슬쩍 말해 볼게요.`); s.say("npc", "정말요?! 부탁해요!"); addMission(w, { type: "match", a: n.id, b: z.id, from: n.id, reward: 15 }); toMenu(w, s); }, "quest"),
        O("그 사람은 별로인데요", "", () => { adjust(n, z.id, -10); adjust(n, p.id, n.traits.kindness > 0.5 ? -4 : 0); s.say("npc", "…그래요? 왜요?"); toMenu(w, s); }),
        back(w, s)];
      return;
    }
    // 4) 가난
    if (n.gold < 5 || n.hunger >= 2) {
      s.say("npc", pick(w, ["요즘 끼니 잇기도 힘들어요…", "솔직히 주머니가 텅 비었어요.", "일이 잘 안 풀려서요. 먹을 것도 떨어졌고…"]));
      const food = Object.keys(EX(w).inv).find((id) => G.ITEMS[id].food && !G.ITEMS[id].tool);
      s.options = [
        ...(p.gold >= 10 ? [O("금화 10닢을 건넨다", "", () => { p.gold -= 10; n.gold += 10; w.record("help", `${jo(p.name, "이/가")} 형편이 어려운 ${n.name}에게 금화 10닢을 건넸다`, { actor: p.id, target: n.id, town: n.town, imp: 3, sent: 6, wr: 0.2 }); s.say("npc", pick(w, ["이, 이걸 정말 저한테…? 이 은혜는 잊지 않을게요.", "고마워요… 정말로."])); toMenu(w, s); })] : []),
        ...(food ? [O(`${jo(G.ITEMS[food].name, "을/를")} 나눠 준다`, "", () => { G.take(w, food); n.hunger = Math.max(0, n.hunger - 2); adjust(n, p.id, 10); s.say("npc", "와… 오랜만에 배를 채우네요. 고마워요!"); toMenu(w, s); })] : []),
        O("길드 의뢰라도 해 봐요", "", () => { s.say("npc", "…그래야겠네요."); toMenu(w, s); }), back(w, s)];
      return;
    }
    // 5) 전쟁에 간 가족
    const away = [...fam].map((id) => w.npcs[id]).find((x) => x.alive && x.at_war);
    if (away) { s.say("npc", `${jo(away.name, "이/가")} 전선에 나가 있어요. 매일 밤 무사하길 빌어요.`); s.options = [O("무사히 돌아올 거예요", "", () => { adjust(n, p.id, 5); s.say("npc", "…그렇겠죠. 고마워요."); toMenu(w, s); }), back(w, s)]; return; }
    // 6) 일 이야기
    const jt = JOBTALK[n.job];
    s.say("npc", fill(typeof jt === "string" ? jt : jt[w.season], { price: w.foodPrice(w.towns[n.town]) }));
    s.options = [O("도울 일 있어요?", "부탁을 들어준다", () => offerJob(w, s)), O("그렇군요", "", () => toMenu(w, s))];
  }
  function revengeOptions(w, s, n, t) {
    const p = w.player;
    s.options = [
      ...(t.id !== p.id ? [O("내가 대신 혼내 줄게요", "미션: 그 사람을 때려눕힌다 (범죄가 될 수 있다)", () => { s.say("me", `${jo(t.name, "은/는")} 내가 손봐 줄게요.`); s.say("npc", pick(w, ["…정말요? 해 준다면 잊지 않을게요.", "당신이라면 믿을 수 있어요. 부탁해요."])); addMission(w, { type: "beat", target: t.id, from: n.id, reward: 30 }); toMenu(w, s); }, "quest")] : []),
      O("용서하는 게 어때요?", "설득해 본다", () => {
        s.say("me", "원한은 원한을 낳아요. 놓아주는 게 어때요?");
        const chance = 0.15 + n.traits.kindness * 0.5 + Math.max(0, opinion(n, p.id)) / 200;
        if (w.rng.next() < chance) {
          adjust(n, t.id, 40);
          if (n.goal && n.goal.target === t.id) { n.goal = null; w.record("forgive", `${jo(n.name, "은/는")} ${p.name}의 말을 듣고 ${jo(t.name, "을/를")} 용서하기로 했다`, { actor: n.id, target: t.id, town: n.town, imp: 5, sent: 3, wr: 0.2 }); }
          s.say("npc", pick(w, ["…당신 말이 맞을지도 몰라요. 이제 그만 놓아줄게요.", "후… 그래요. 미워하는 것도 지쳤어요."]));
        } else { adjust(n, p.id, -3); s.say("npc", pick(w, ["당신이 뭘 알아요!", "쉽게 말하지 마요.", "…그럴 수 없어요."])); }
        toMenu(w, s);
      }),
      O("그 마음 이해해요", "", () => { adjust(n, p.id, 4); adjust(n, t.id, -5); s.say("npc", "알아주는 사람이 있어서 다행이에요."); toMenu(w, s); }),
      back(w, s)];
  }
  // ---- 소문
  /* 지난 소식 거르기: 그 사람에게 뒤이은 일이 있고, 듣는 사람이나 말하는 사람이 이미 그 뒤 일을 알면 옛 소식은 꺼내지 않는다
   * (말하는 사람만 안다면 그 뒤 일이 소문 후보에 따로 있다). 말하는 사람 자신의 일은 소문으로 전하지 않는다 */
  const NEXT = { enlist: ["return"], travel: ["travel", "return"], lovers: ["marriage", "quarrel"], vow: ["revenge_done", "forgive", "give_up"], dream_start: ["dream_done", "dream_lost", "give_up"], career: ["career", "job_born"], job_born: ["career"] };
  const aboutSelf = (e, n) => e.actor === n.id || e.target === n.id;
  function stale(w, e, p, n) {
    if (e.actor === null || e.actor === undefined) return false;
    const a = w.npcs[e.actor];
    if (a && !a.alive && a.death_day > e.day && NEXT[e.kind]) return true; // 그 뒤로 세상을 떠났다
    const later = (NEXT[e.kind] || []);
    if (!later.length) return false;
    return w.lifeOf(e.actor).some((x) => x.actor === e.actor && x.id > e.id && later.includes(x.kind) && (p.known.has(x.id) || n.known.has(x.id)));
  }
  function rumor(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", s.rumors ? pick(w, ["다른 소식은요?", "또 없어요?"]) : pick(w, ["무슨 소식 없어요?", "요즘 마을에 무슨 일 있어요?", "재밌는 얘기 없어요?"]));
    if (opinion(n, p.id) < -25) { s.say("npc", "당신한테 해 줄 얘기는 없어요."); toMenu(w, s); return; }
    if (s.rumors >= 3) { s.say("npc", "오늘은 아는 게 그게 다예요."); toMenu(w, s); return; }
    const news = n.mem.filter((m) => !p.known.has(m.e) && w.events[m.e] && w.events[m.e].imp >= 2 && w.events[m.e].kind !== "theft_unknown" && !aboutSelf(w.events[m.e], n) && !stale(w, w.events[m.e], p, n));
    if (!news.length) { s.say("npc", pick(w, ["글쎄요, 요즘 조용하네요.", "딱히 새로운 건 없어요.", `${w.season}이라 다들 바쁘죠, 뭐.`])); toMenu(w, s); return; }
    const m = maxBy(news, (x) => w.events[x.e].imp * x.s * (0.6 + w.rng.next() * 0.8));
    const e = w.events[m.e];
    s.rumors++;
    const lead = { warm: "음, 이건 좀 안타까운 얘기인데요… ", greedy: "이건 아무한테나 안 해 주는 얘긴데… ", bold: "들었어? ", proud: "제가 듣기로는요, ", shy: "저, 저도 들은 얘긴데요… ", plain: "그러고 보니, " }[tone(n)];
    s.say("npc", `${lead}${e.text}.${m.f ? " 제가 직접 봤어요." : m.v !== null && w.npcs[m.v] ? ` ${w.npcs[m.v].name}한테 들었어요.` : ""}`);
    w.remember(p, e, false, n.id);
    s.lastRumor = e.id;
    const actor = e.actor !== null && e.actor !== p.id && e.actor !== n.id ? w.npcs[e.actor] : null;
    s.options = [
      O("자세히 들려줘요", "왜 그런 일이 일어났는지", () => {
        tick5(s); s.say("me", "어쩌다 그렇게 됐대요?");
        const cause = e.cause !== null ? w.events[e.cause] : null;
        if (cause && n.known.has(cause.id)) { s.say("npc", `그게 다… ${cause.text}. 그 일 때문이래요.`); w.remember(p, cause, false, n.id); }
        else if (actor) { const op = opinion(n, actor.id); s.say("npc", op <= -30 ? `${jo(actor.name, "이/가")} 원래 그런 사람이에요. 언젠가 일 낼 줄 알았다니까요.` : op >= 30 ? `${jo(actor.name, "이/가")} 그럴 사람이 아닌데… 무슨 사정이 있었겠죠.` : "자세한 건 저도 몰라요."); }
        else s.say("npc", "자세한 건 저도 몰라요.");
        s.options = s.options.filter((o) => o.label !== "자세히 들려줘요");
      }),
      ...(actor ? [O(`${jo(actor.name, "은/는")} 어떤 사람이에요?`, "", () => about(w, s, actor))] : []),
      O("정말요? 믿기 어려운데요", "", () => { s.say("me", "정말요? 믿기 어려운데…"); if (tone(n) === "bold" || tone(n) === "proud") { adjust(n, p.id, -2); s.say("npc", "내 말을 못 믿겠다는 거예요?"); } else s.say("npc", "저도 처음엔 그랬어요."); }),
      O("다른 소식은요?", "", () => rumor(w, s)),
      back(w, s)];
  }
  // ---- 사람에 대해
  function askMenu(w, s) {
    const p = w.player, n = w.npcs[s.nid];
    const ids = new Set(Object.keys(p.rel).map(Number));
    for (let i = w.journal.length - 1; i >= 0 && ids.size < 40; i--) { const e = w.events[w.journal[i].e]; if (e) { if (e.actor !== null) ids.add(e.actor); if (e.target !== null) ids.add(e.target); } }
    ids.delete(p.id); ids.delete(n.id);
    const people = [...ids].map((id) => w.npcs[id]).filter((z) => z && z.alive).sort((a, b) => Math.abs(opinion(p, b.id)) - Math.abs(opinion(p, a.id))).slice(0, 8);
    s.say("sys", "누구에 대해 물어볼까?");
    s.options = [...people.map((z) => O(`${z.name} (${JOBS[z.job] ? JOBS[z.job].name : ""})`, "", () => about(w, s, z))), back(w, s)];
  }
  function about(w, s, z) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", `${jo(z.name, "은/는")} 어떤 사람이에요?`);
    const op = opinion(n, z.id);
    const facts = [];
    if (z.spouse !== null) facts.push(`${jo(w.npcs[z.spouse].name, "과/와")} 부부예요`);
    else if (z.lover !== null) facts.push(`${jo(w.npcs[z.lover].name, "과/와")} 사귄다던데요`);
    facts.push(`${w.towns[z.town].name}에서 ${JOBS[z.job].name} 일을 해요`);
    const feel = family(n).has(z.id) ? "제 가족인걸요." : op >= 50 ? "정말 좋은 사람이에요." : op >= 15 ? "괜찮은 사람이에요." : op <= -50 ? "그 사람 얘기는 하고 싶지도 않아요." : op <= -15 ? "솔직히 좀 별로예요." : "잘은 몰라요.";
    s.say("npc", `${z.name}이요? ${feel} ${facts.join(", ")}.`);
    const mem = n.mem.filter((m) => { const e = w.events[m.e]; return e && (e.actor === z.id || e.target === z.id) && !p.known.has(e.id); }).sort((a, b) => w.events[b.e].imp - w.events[a.e].imp)[0];
    if (mem) { const e = w.events[mem.e]; s.say("npc", `그러고 보니… ${e.text}.`); w.remember(p, e, false, n.id); }
    adjust(n, p.id, 1);
    s.options = [O("다른 사람에 대해서도 물어볼게요", "", () => askMenu(w, s)), back(w, s)];
  }
  // ---- 선물
  const PREF_JOB = new Proxy({}, { get: (_, id) => A.JOBS[id] && A.JOBS[id].likes });
  function pref(w, n, item) {
    if (PREF_JOB[n.job] === item) return "love";
    const r = (Math.imul(n.id + 7, 2654435761) ^ [...item].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0;
    const v = (r % 100) / 100;
    if (["strawberry", "meal", "potion"].includes(item) && v < 0.5) return "love";
    return v < 0.12 ? "love" : v < 0.45 ? "like" : v < 0.82 ? "neutral" : "dislike";
  }
  function giftMenu(w, s) {
    const e = EX(w), n = w.npcs[s.nid];
    const items = Object.keys(e.inv).filter((id) => !G.ITEMS[id].tool && e.inv[id] > 0);
    if ((e.gifted || {})[n.id] === w.day) { s.say("npc", "오늘은 벌써 선물 받았어요. 마음만 받을게요!"); toMenu(w, s); return; }
    if (!items.length) { s.say("sys", "줄 만한 물건이 없다."); toMenu(w, s); return; }
    s.say("sys", "무엇을 줄까?");
    s.options = [...items.slice(0, 10).map((id) => O(`${G.ITEMS[id].name} (${e.inv[id]})`, "", () => giveGift(w, s, id))), back(w, s)];
  }
  function giveGift(w, s, id) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    G.take(w, id); e.gifted = e.gifted || {}; e.gifted[n.id] = w.day;
    const pr = pref(w, n, id), nm = G.ITEMS[id].name;
    s.say("me", `이거, ${nm}인데 받아요.`);
    const lines = {
      love: [`어머나, ${nm}! 제가 제일 좋아하는 거예요! 어떻게 알았어요?`, `${nm}?! 이건… 정말 최고의 선물이에요!`],
      like: [`${nm}이네요. 고마워요, 잘 쓸게요.`, `오, ${nm}! 좋아요.`],
      neutral: [`아… ${nm}이요. 고마워요.`, "음, 마음만은 고마워요."],
      dislike: [`…${nm}? 이건 좀… 별로예요.`, `왜 하필 ${nm}이에요? 으.`],
    };
    s.say("npc", pick(w, lines[pr]));
    adjust(n, p.id, { love: 18, like: 10, neutral: 4, dislike: -6 }[pr]);
    if (pr === "love") w.record("gift", `${jo(p.name, "이/가")} ${n.name}에게 ${jo(nm, "을/를")} 선물했고, ${jo(n.name, "이/가")} 무척 기뻐했다`, { actor: p.id, target: n.id, town: n.town, imp: 2, sent: 4, wr: 0.2 });
    toMenu(w, s);
  }
  // ---- 부탁
  function favorMenu(w, s) {
    s.say("sys", "무엇을 부탁할까?");
    s.options = [O("돈을 좀 빌려줄 수 있어요?", "친한 사이여야 들어준다", () => borrow(w, s)), O("도울 일 있어요?", "일거리를 받는다", () => offerJob(w, s)), back(w, s)];
  }
  function borrow(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid];
    s.say("me", "저기… 돈을 좀 빌려줄 수 있어요?");
    if (opinion(n, p.id) >= 25 && n.gold > 15) {
      const amt = Math.round(Math.min(15, n.gold * 0.2)); n.gold -= amt; p.gold += amt; adjust(n, p.id, -3);
      w.record("lend", `${jo(n.name, "이/가")} ${p.name}에게 금화 ${amt}닢을 빌려주었다`, { actor: n.id, target: p.id, town: n.town, imp: 2, wr: 0.1 });
      s.say("npc", tone(n) === "greedy" ? `…${amt}닢. 이자는 친구니까 봐줄게요. 꼭 갚아요.` : `여기 ${amt}닢이요. 급할 땐 서로 돕는 거죠.`);
    } else s.say("npc", n.gold <= 15 ? "저도 형편이 어려워서요…" : tone(n) === "greedy" ? "돈 얘기는 친한 사이끼리도 하는 거 아니에요." : "미안하지만 그건 좀 곤란해요.");
    toMenu(w, s);
  }
  const JOB_ASK = new Proxy({}, { get: (_, id) => (A.JOBS[id] && A.JOBS[id].ask) || ["wood", 3, "땔감이 좀 모자라요."] });
  function offerJob(w, s) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    s.say("me", "제가 도울 일 있어요?");
    if (e.missions.some((m) => !m.done && m.from === n.id)) { s.say("npc", "지난번에 부탁한 것부터 해 줘요!"); toMenu(w, s); return; }
    if (opinion(n, p.id) < -10) { s.say("npc", "당신한테 부탁할 일은 없어요."); toMenu(w, s); return; }
    // 멀리 사는 친구에게 안부
    const far = Object.entries(n.rel).map(([k, v]) => [w.npcs[+k], v]).find(([z, v]) => z && z.alive && !z.at_war && v >= 50 && z.town !== n.town && z.id !== p.id);
    if (far && w.rng.next() < 0.4) {
      const z = far[0];
      s.say("npc", `${w.towns[z.town].name}에 사는 ${z.name}에게 안부 좀 전해 줄래요? 못 본 지 오래됐어요.`);
      s.options = [O("전해 줄게요", "미션", () => { addMission(w, { type: "message", to: z.id, from: n.id, reward: 12 }); s.say("npc", "고마워요!"); toMenu(w, s); }, "quest"), O("지금은 바빠요", "", () => toMenu(w, s))];
      return;
    }
    // 같은 마을 사람에게 물건 배달: 빈손으로 시작한 사람도 바로 할 수 있는 심부름
    const neighbor = w.residents(n.town, true).filter((z) => z.id !== n.id && z.id !== p.id && z.controller !== "player");
    if (neighbor.length && w.rng.next() < 0.35) {
      const z = pick(w, neighbor), what = pick(w, ["빵 바구니", "약초 꾸러미", "편지", "빌린 냄비", "수선한 옷", "말린 생선 꾸러미"]);
      s.say("npc", `이 ${what} 좀 ${z.name}에게 갖다줄래요? 금화 ${5}닢 줄게요.`);
      s.options = [O("다녀올게요", "심부름", () => { addMission(w, { type: "parcel", to: z.id, from: n.id, what, reward: 5 }); s.say("npc", "고마워요! 조심히 다녀와요."); toMenu(w, s); }, "quest"), O("다음에요", "", () => toMenu(w, s))];
      return;
    }
    const EARLY = [["branch", 6, "아궁이에 넣을 나뭇가지가 모자라요."], ["stone", 5, "담장 틈을 메울 돌멩이가 필요해요."], ["fiber", 6, "바구니를 짤 풀섬유가 모자라요."], ["berry", 4, "산딸기 잼을 만들고 싶어요."], ["flower", 3, "식탁에 꽃을 좀 놓고 싶네요."]];
    const [item, cnt, why] = w.rng.next() < 0.5 ? pick(w, EARLY) : JOB_ASK[n.job];
    const reward = Math.round(G.ITEMS[item].sell * cnt * 1.6) + 5;
    s.say("npc", `${why} ${G.ITEMS[item].name} ${cnt}개만 구해다 줄래요? 금화 ${reward}닢 줄게요.`);
    s.options = [O("맡겨 주세요", "미션", () => { addMission(w, { type: "fetch", item, n: cnt, from: n.id, reward }); s.say("npc", "정말 고마워요!"); toMenu(w, s); }, "quest"), O("다음에요", "", () => toMenu(w, s))];
  }
  // ---- 마음
  function heartMenu(w, s) {
    const p = w.player, n = w.npcs[s.nid];
    const single = (x) => x.spouse === null;
    const opts = [O("칭찬한다", "", () => {
      tick5(s);
      s.say("me", pick(w, ["오늘따라 멋져 보이네요.", "당신은 정말 일을 잘하는 것 같아요.", "당신이랑 얘기하면 기분이 좋아져요.", `${JOBS[n.job].name}로서 정말 대단해요.`]));
      if (opinion(n, p.id) < -30) { adjust(n, p.id, -2); s.say("npc", "…비꼬는 거죠?"); }
      else { adjust(n, p.id, 2 + n.traits.kindness * 4 + (tone(n) === "proud" ? 3 : 0)); s.say("npc", { warm: "어머, 고마워요!", greedy: "칭찬은 공짜니까 많이 해 줘요.", bold: "하하, 당연하지!", proud: "후후, 역시 알아보는군요.", shy: "아, 아니에요… 헤헤.", plain: "그래요? 고마워요." }[tone(n)]); }
      toMenu(w, s);
    })];
    if (single(p) && single(n) && isAdult(n)) {
      if (p.lover !== n.id) opts.push(O("오늘 저녁에 주점에서 만날래요?", "데이트 신청 (19~22시 주점)", () => {
        tick5(s); s.say("me", "오늘 저녁에 주점에서 같이 밥 먹을래요?");
        if (opinion(n, p.id) >= 30) { const e = EX(w); e.dates = (e.dates || []).filter((d) => d.who !== n.id); e.dates.push({ who: n.id, day: w.day, town: n.town }); s.say("npc", pick(w, ["좋아요! 저녁에 봐요.", "…네. 기다릴게요.", "오, 데이트 신청이에요? 좋아요!"])); }
        else { adjust(n, p.id, -2); s.say("npc", pick(w, ["음… 오늘은 좀 바빠서요.", "아직은 좀…", "됐어요."])); }
        toMenu(w, s);
      }, "heart"));
      if (p.lover === null && n.lover === null) opts.push(O("마음을 고백한다", "상대도 나를 좋아해야 받아준다", () => {
        tick5(s); s.say("me", "사실… 당신을 좋아해요.");
        if (opinion(n, p.id) >= 48) { p.lover = n.id; n.lover = p.id; adjust(n, p.id, 10); adjust(p, n.id, 10); w.record("lovers", `${jo(p.name, "이/가")} ${n.name}에게 마음을 고백했고, 두 사람은 연인이 되었다`, { actor: p.id, target: n.id, town: n.town, imp: 4, sent: 3, wr: 0.3 }); s.say("npc", pick(w, ["…저도요. 오래전부터요.", "정말요? 저도 좋아해요!", "얼굴이 화끈거리네요… 네, 좋아요."])); }
        else { w.record("rejected", `${jo(p.name, "이/가")} ${n.name}에게 고백했지만 거절당했다`, { actor: p.id, target: n.id, town: n.town, imp: 3, wr: 0.3 }); s.say("npc", opinion(n, p.id) >= 20 ? "좋은 사람이지만… 아직은 아니에요. 미안해요." : "에? 갑자기 왜 그래요…"); }
        toMenu(w, s);
      }, "heart"));
      if (p.lover === n.id) opts.push(O("청혼한다", "깊이 아끼면 받아준다", () => { tick5(s); s.say("me", "나와 결혼해 줄래?"); if (opinion(n, p.id) >= 60) { s.say("npc", "…응! 당연하지!"); s.say("sys", marry(w, p, n)); } else { adjust(n, p.id, -4); s.say("npc", "조금만 더 시간을 줘."); } toMenu(w, s); }, "heart"));
    }
    opts.push(back(w, s));
    s.options = opts;
  }
  function dateNight(w, s, date) {
    const p = w.player, n = w.npcs[s.nid], e = EX(w);
    e.dates = e.dates.filter((d) => d !== date);
    s.mins += 60;
    s.say("sys", `${jo(n.name, "과/와")} 주점 구석 자리에 마주 앉았다.`);
    s.say("npc", pick(w, ["와 줘서 고마워요. 사실 좀 떨렸어요.", "이런 데서 보니까 새롭네요.", "오늘 하루 어땠어요?"]));
    const end = (d, line) => { adjust(n, p.id, d); adjust(p, n.id, d / 2); s.say("npc", line); w.record("date", `${jo(p.name, "과/와")} ${jo(n.name, "이/가")} 주점에서 함께 저녁을 보냈다`, { actor: p.id, target: n.id, town: n.town, imp: 3, sent: 2, wr: 0.4 }); toMenu(w, s); };
    s.options = [
      O("내 어린 시절 이야기를 들려준다", "", () => { s.say("me", "어릴 땐 말이죠…"); end(10 + n.traits.kindness * 8, "후후, 귀여웠겠네요."); }),
      O(`${JOBS[n.job].name} 일에 대해 묻는다`, "", () => { s.say("me", "일은 어때요? 힘들지 않아요?"); end(10 + n.traits.ambition * 8, "그걸 물어봐 준 사람은 당신이 처음이에요."); }),
      O("허풍을 섞어 내 무용담을 자랑한다", "", () => { s.say("me", "그때 내가 멧돼지를 한 손으로…"); end(n.traits.bravery > 0.6 ? 14 : 2, n.traits.bravery > 0.6 ? "하하! 대단한데요?" : "…정말요? 흠."); }),
    ];
  }
  function marry(w, p, x) {
    p.spouse = x.id; x.spouse = p.id; p.lover = x.lover = null;
    adjust(p, x.id, 15); adjust(x, p.id, 15);
    w.record("marriage", `${jo(p.name, "과/와")} ${jo(x.name, "이/가")} ${w.towns[x.town].name}에서 결혼했다`, { actor: p.id, target: x.id, town: x.town, imp: 6, sent: 5, wr: 0.7 });
    return `${jo(x.name, "과/와")} 결혼했다!`;
  }
  function romance(w, s, c) {
    const p = w.player, n = w.npcs[s.nid];
    if (c === "accept") { s.say("me", "…나도 좋아해."); p.lover = n.id; n.lover = p.id; adjust(n, p.id, 12); adjust(p, n.id, 12); w.record("lovers", `${jo(n.name, "과/와")} ${jo(p.name, "이/가")} 연인이 되었다`, { actor: n.id, target: p.id, town: n.town, imp: 4, sent: 3, wr: 0.3 }); s.say("npc", "정말?! …고마워."); }
    else if (c === "cold") { s.say("me", "미안하지만 관심 없어."); adjust(n, p.id, -25); s.say("npc", "…알았어요."); }
    else { s.say("me", "마음은 고맙지만… 미안해요."); adjust(n, p.id, -6); s.say("npc", "…괜찮아요. 말해 줘서 고마워요."); }
    toMenu(w, s);
  }
  function matchmake(w, s, m) {
    tick5(s);
    const p = w.player, n = w.npcs[s.nid], a = w.npcs[m.a];
    s.say("me", `있잖아요, ${jo(a.name, "이/가")} 당신을 좋아한대요.`);
    adjust(n, a.id, 15 + n.traits.kindness * 10);
    s.say("npc", opinion(n, a.id) >= 45 ? `${jo(a.name, "이/가")}요? …사실 나도 싫지 않았어요.` : opinion(n, a.id) >= 10 ? `에, ${a.name}이요? 생각해 본 적 없는데… 한번 얘기해 볼게요.` : `${a.name}? 미안하지만 그건 좀…`);
    completeMission(w, m, "마음을 전해 주었다.");
    toMenu(w, s);
  }
  // ---- 갈등
  function wrongsBy(w, n) {
    const p = w.player, e = EX(w);
    e.confronted = e.confronted || {};
    for (let i = w.journal.length - 1; i >= 0; i--) {
      const j = w.journal[i], ev = w.events[j.e];
      if (!ev || ev.actor !== n.id || ev.target !== p.id || ev.sent >= 0 || e.confronted[ev.id] || w.day - ev.day > 90) continue;
      return ev;
    }
    return null;
  }
  function conflictMenu(w, s, wrong) {
    const p = w.player, n = w.npcs[s.nid], tn = tone(n), e = EX(w);
    const opts = [];
    if (wrong) opts.push(O(`"${wrong.text}" 왜 그랬어요?`, "따진다", () => {
      tick5(s); e.confronted[wrong.id] = 1;
      s.say("me", "그때 일, 왜 그랬어요?");
      if (tn === "warm" || tn === "shy") {
        s.say("npc", pick(w, ["…정말 미안해요. 그땐 제정신이 아니었어요.", "할 말이 없어요… 미안해요."]));
        s.options = [O("용서할게요", "", () => { adjust(n, p.id, 15); adjust(p, n.id, 15); w.record("forgive", `${jo(p.name, "은/는")} 사과한 ${jo(n.name, "을/를")} 용서했다`, { actor: p.id, target: n.id, town: n.town, imp: 4, sent: 6, cause: wrong.id, wr: 0.3 }); s.say("npc", "고마워요… 정말로."); toMenu(w, s); }),
          O("말로만 사과하면 다예요?", "보상을 요구한다", () => { const g = Math.min(Math.floor(n.gold), 15); n.gold -= g; p.gold += g; adjust(n, p.id, -3); s.say("npc", g ? `…여기 ${g}닢이요. 이걸로 봐줘요.` : "드릴 게 없어요… 정말 미안해요."); toMenu(w, s); }),
          back(w, s)];
      } else if (tn === "greedy") {
        s.say("npc", "에이, 지난 일 가지고. 금화 10닢이면 되겠죠? 깔끔하게 끝냅시다.");
        s.options = [O("받고 끝낸다", "", () => { const g = Math.min(10, Math.floor(n.gold)); n.gold -= g; p.gold += g; s.say("npc", "거래 성립."); toMenu(w, s); }), O("돈으로 될 일이 아니에요!", "", () => { adjust(n, p.id, -6); s.say("npc", "그럼 뭘 원하는데요?"); toMenu(w, s); }), back(w, s)];
      } else {
        s.say("npc", pick(w, ["그래서 뭐? 할 말 있어?", "그걸 아직도 담아 두고 있었어?", "내가 왜 그랬을 것 같은데?"]));
        s.options = [
          O("사과해!", "용기로 밀어붙인다", () => { if (w.rng.next() < 0.25 + p.fame * 0.02) { adjust(n, p.id, 8); s.say("npc", "…알았어, 미안하다. 됐지?"); } else { adjust(n, p.id, -6); s.say("npc", "웃기지 마."); } toMenu(w, s); }),
          O("한판 붙자", "정정당당한 결투 (범죄가 아니다)", () => duel(w, s)),
          O("물러선다", "", () => { s.say("npc", "흥."); toMenu(w, s); })];
      }
    }));
    opts.push(O("돈 내놔", "위협한다 (범죄)", () => {
      tick5(s); s.say("me", "가진 돈 다 내놔. 험한 꼴 보기 싫으면.");
      if (n.traits.bravery < 0.4) { const g = Math.min(Math.floor(n.gold), 20); n.gold -= g; p.gold += g; s.say("npc", "히익… 여, 여기요!"); G.crime(w, "extort", n, 1, `${jo(p.name, "이/가")} ${jo(n.name, "을/를")} 협박해 금화 ${g}닢을 빼앗았다`); s.over = true; }
      else { s.say("npc", "뭐? 이게 미쳤나!"); const k = G.walkers.get(n.id); if (k) k.fight = true; adjust(n, p.id, -20); s.over = true; }
    }, "harm"));
    opts.push(O("모욕한다", "", () => {
      tick5(s); s.say("me", pick(w, ["넌 정말 쓸모없는 인간이야.", "얼굴 보기도 싫어.", `${JOBS[n.job].name} 주제에.`]));
      w.record("insult", `${jo(p.name, "이/가")} ${jo(n.name, "을/를")} 모욕했다`, { actor: p.id, target: n.id, town: n.town, imp: 3, sent: -8, wr: 0.3 });
      if (n.traits.bravery > 0.6 && w.rng.next() < 0.5) { s.say("npc", "말 다 했어? 이리 와!"); const k = G.walkers.get(n.id); if (k) k.fight = true; s.over = true; }
      else { s.say("npc", pick(w, ["…너무하네요.", "두고 봐요.", "…"])); toMenu(w, s); }
    }, "harm"));
    opts.push(back(w, s));
    s.options = opts;
  }
  function duel(w, s) {
    const p = w.player, n = w.npcs[s.nid];
    s.mins += 20;
    const pw = power(w, p) + G.weaponDmg(w) + w.rng.uniform(0, 8), nw = power(w, n) + w.rng.uniform(0, 8);
    const win = pw >= nw;
    const [a, b] = win ? [p, n] : [n, p];
    b.health = Math.max(1, b.health - w.rng.uniform(2, 5));
    w.record("duel", `${jo(p.name, "과/와")} ${jo(n.name, "이/가")} 결투를 벌였다. ${jo(a.name, "이/가")} 이겼다`, { actor: a.id, target: b.id, town: n.town, imp: 5, sent: -6, wr: 0.6 });
    s.say("sys", win ? `주먹이 오갔다. ${jo(n.name, "이/가")} 먼저 무릎을 꿇었다.` : `주먹이 오갔다. 내가 먼저 바닥에 쓰러졌다.`);
    s.say("npc", win ? pick(w, ["…졌다. 인정하지.", "크윽… 다음엔 안 져."]) : pick(w, ["하하, 그 정도로는 안 되지.", "다시는 덤비지 마."]));
    if (win) { adjust(n, p.id, n.traits.bravery > 0.6 ? 10 : -5); onHitNPC(w, n); if (p.goal && p.goal.target === n.id) { p.goal = null; s.say("sys", "마침내 복수를 이뤘다."); } }
    toMenu(w, s);
  }
  function confrontByNPC(w, s, n) {
    const p = w.player, og = n.goal ? w.events[n.goal.origin] : null;
    s.say("npc", pick(w, ["드디어 만났군.", "너, 거기 서.", "기다리고 있었다."]) + (og ? ` ${og.text}… 잊었다고 생각했어?` : ""));
    if (og) w.remember(p, og, false, n.id);
    s.options = [
      O("미안해요. 정말 잘못했어요", "진심으로 사과한다", () => {
        s.say("me", "그 일은… 정말 미안해요.");
        adjust(n, p.id, 10 + n.traits.kindness * 25);
        if (opinion(n, p.id) > -25) { n.goal = null; w.record("forgive", `${jo(n.name, "은/는")} 사과를 받아들이고 ${jo(p.name, "을/를")} 용서했다`, { actor: n.id, target: p.id, town: n.town, imp: 5, sent: 3, wr: 0.3 }); s.say("npc", "…그 말을 기다렸어. 이번만이야."); toMenu(w, s); }
        else { s.say("npc", "사과로 될 일이 아니야!"); s.options = [O("싸울 수밖에 없나", "결투", () => duel(w, s)), O("도망친다", "", () => { s.over = true; })]; }
      }),
      O("덤벼", "결투", () => duel(w, s)),
      O("도망친다", "", () => { s.say("npc", "도망쳐 봐야 소용없어!"); s.over = true; })];
  }
  function endTalk(w, s) { if (s.mins) G.spend(w, s.mins, Math.round(s.mins / 15)); }

  // ================================================================ 관계
  function attitudeWord(op) { return op >= 60 ? "깊이 아낀다" : op >= 25 ? "호감이 있다" : op > -25 ? "무덤덤하다" : op > -60 ? "껄끄럽다" : "적대한다"; }
  function relTag(p, x) {
    if (p.spouse === x.id) return "배우자";
    if (p.lover === x.id) return "연인";
    if (p.parents.includes(x.id)) return "부모";
    if (p.children.includes(x.id)) return "자녀";
    if (p.parents.some((q) => x.parents.includes(q))) return "형제";
    if (p.goal && p.goal.target === x.id) return "원수";
    if (x.goal && x.goal.target === p.id && p.known.has(x.goal.vow)) return "나를 노림";
    const op = opinion(p, x.id);
    return op >= 50 ? "친구" : op <= -50 ? "앙숙" : "";
  }
  function familyList(w, n) {
    const L = [];
    const add = (rel, id) => { const x = w.npcs[id]; if (x) L.push({ rel, x }); };
    for (const id of n.parents) add("부모", id);
    if (n.spouse !== null) add("배우자", n.spouse);
    if (n.lover !== null) add("연인", n.lover);
    for (const id of n.children) add("자녀", id);
    for (const x of w.npcs) if (x.id !== n.id && n.parents.length && n.parents.some((q) => x.parents.includes(q))) L.push({ rel: "형제", x });
    return L;
  }
  function relGraph(w, limit = 14) {
    const p = w.player;
    const ids = new Set(familyList(w, p).filter((f) => f.x.alive).map((f) => f.x.id));
    const scored = w.npcs.filter((x) => x.id !== p.id && x.alive && (Math.abs(opinion(p, x.id)) >= 8 || Math.abs(opinion(x, p.id)) >= 15))
      .sort((a, b) => Math.max(Math.abs(opinion(p, b.id)), Math.abs(opinion(b, p.id))) - Math.max(Math.abs(opinion(p, a.id)), Math.abs(opinion(a, p.id))));
    for (const x of scored) { if (ids.size >= limit) break; ids.add(x.id); }
    const nodes = [...ids].map((id) => w.npcs[id]).map((x) => ({ id: x.id, name: x.name, mine: opinion(p, x.id), theirs: opinion(x, p.id), tag: relTag(p, x) }));
    const edges = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = w.npcs[nodes[i].id], b = w.npcs[nodes[j].id], v = (opinion(a, b.id) + opinion(b, a.id)) / 2;
      const link = a.spouse === b.id || a.lover === b.id || family(a).has(b.id);
      if (Math.abs(v) >= 45 || link) edges.push({ a: a.id, b: b.id, v, tag: a.spouse === b.id ? "부부" : a.lover === b.id ? "연인" : family(a).has(b.id) ? "가족" : "" });
    }
    return { nodes, edges };
  }
  function reasons(w, xid, n = 8) {
    const seen = new Set(), out = [];
    for (let i = w.journal.length - 1; i >= 0; i--) {
      const j = w.journal[i], e = w.events[j.e];
      if (!e || seen.has(e.id) || (e.actor !== xid && e.target !== xid)) continue;
      seen.add(e.id); out.push({ e, j });
    }
    return out.sort((a, b) => b.e.imp - a.e.imp || b.e.day - a.e.day).slice(0, n);
  }

  const Story = { setup, onDawn, welcomePaper, knowsDream, offerBuild, completeMission, afterTick, sourceText, SRC_LABEL, paperSection, resolve, checkOracle, addMission, missionTitle, missionWhere, takeBoard, deliverToBoard, refreshBoard,
    onKill, onItem, onHitNPC, onArrest, onEnterTown, talk, toMenu, endTalk, tone, tier, attitudeWord, relTag, familyList, relGraph, reasons,
    onEpisode: null, onOpenTalk: null, onMission: null };
  root.Story = Story;
})(typeof window !== "undefined" ? window : globalThis);
