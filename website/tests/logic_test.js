// Tests the website's JavaScript tree and game logic WITHOUT a browser.
// Run from the website folder:   node tests/logic_test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// A tiny fake "browser" so the scripts can run in Node.
const ctx = { performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 }, console };
ctx.window = ctx;
vm.createContext(ctx);
['caseData.js', 'tree.js', 'game.js', 'experiment.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
const { Tree: T, Game: G, Exp: E, caseData: D } = ctx.DMG;

let pass = 0, fail = 0;
function check(ok, text) { (ok ? pass++ : fail++); console.log((ok ? '  PASS  ' : '  FAIL  ') + text); }
const ids = list => list.map(n => n.id).join(' ');

const root = T.build(D);
check(T.countNodes(root) === 15 && T.countLeaves(root) === 8 && T.height(root) === 3, '15 nodes, 8 leaves, height 3');
check(ids(T.preorder(root)) === '1 2 4 8 9 5 10 11 3 6 12 13 7 14 15', 'preorder');
check(ids(T.inorder(root)) === '8 4 9 2 10 5 11 1 12 6 13 3 14 7 15', 'inorder');
check(ids(T.postorder(root)) === '8 9 4 10 11 5 2 12 13 6 14 15 7 3 1', 'postorder');
check(ids(T.levelOrder(root)) === '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15', 'level-order');
check(T.findById(root, 7).title === 'Gate Register' && T.findById(root, 99) === null, 'findById');
check(T.isFull(root) && T.isComplete(root) && T.isPerfect(root), 'case tree is full, complete and perfect');
const props = s => [T.isFull(T.demo(s)), T.isComplete(T.demo(s)), T.isPerfect(T.demo(s))].join();
check(props(1) === 'true,true,true', 'demo 1: perfect');
check(props(2) === 'false,true,false', 'demo 2: complete only');
check(props(3) === 'true,false,false', 'demo 3: full only');
check(props(4) === 'false,false,false', 'demo 4: skewed');

const g = G.create(D);
G.start(g);
check(G.attempt(g, D.culpritId) === 'BLOCKED' && g.blocked === 1, 'correct suspect refused at 6.7%');
let guard = 0;
while (g.exploredCount < 14 && guard++ < 100) {
  const c = g.current;
  if (c.left && !c.left.explored) G.followLead(g, true);
  else if (c.right && !c.right.explored) G.followLead(g, false);
  else G.goBack(g);
}
check(G.attempt(g, D.culpritId) === 'BLOCKED', 'correct suspect STILL refused at 14 of 15');
while (!G.allExplored(g) && guard++ < 200) {
  const c = g.current;
  if (c.left && !c.left.explored) G.followLead(g, true);
  else if (c.right && !c.right.explored) G.followLead(g, false);
  else G.goBack(g);
}
check(g.steps === 25, 'full depth-first walk = 25 steps');
check(G.attempt(g, 1) === 'WRONG' && g.incorrect === 1, 'wrong suspect at 100% is WRONG');
check(G.attempt(g, D.culpritId) === 'SOLVED' && g.solved, 'correct suspect at 100% is SOLVED');
check(G.deduce(g) === D.culpritId, "deduction names the culprit");
check([25, 50, 75, 100].map(p => G.targetNodes(p, 15)).join() === '4,8,12,15', 'percent targets 4, 8, 12, 15');

const rows = E.runAll(D, 200);
check(rows.filter(r => r.percent < 100).every(r => r.acceptedPct === 0), 'bot: accusation never accepted below 100%');
check(rows.filter(r => r.percent === 100).every(r => r.acceptedPct === 100 && r.solvedPct === 100), 'bot: always accepted and solved at 100%');
check(rows.slice(0, 4).map(r => r.avgSteps).join() === '3,11,19,25', 'bot DFS steps 3, 11, 19, 25');

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
