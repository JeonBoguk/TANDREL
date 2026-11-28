global.window = globalThis;
const dir = require('path').join(__dirname, '../game/');
for (const f of ['engine', 'content', 'pack-jeweler', 'game', 'sims', 'story', 'test']) require(dir + f + '.js');
const A = Asteria;
let all = 0, ok = 0;
for (const seed of (process.env.SEEDS ? process.env.SEEDS.split(",").map(Number) : [1, 2, 3, 5, 7, 8, 11, 42])) {
  const w = A.newWorld(seed, 't'); for (let i = 0; i < 400; i++) A.step(w); Game.setup(w);
  const r = AsteriaTest.runAll(w.serialize());
  all += r.length; ok += r.filter((x) => x.ok).length;
  for (const x of r) if (!x.ok) console.log(seed, x.name, x.checks.filter((c) => !c.ok).map((c) => c.msg), x.error && x.error.split('\n').slice(0, 2).join(' | '));
}
console.log('pass', ok + '/' + all);
