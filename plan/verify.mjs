// plan/verify.mjs —— 闸 2 脚本化校验
// 机械比对，不进模型。用法：node plan/verify.mjs [卡片文件或目录 glob]
// 拦截三类错误：① 引用未定义编号 ② 出现禁引词（notInV13 / discarded 旧口径）③ 违反 mustMatch 硬事实
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const anchors = JSON.parse(fs.readFileSync(path.join(__dirname, 'anchors.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));

// 合法引用集合
const legalCodes = new Set([
  ...anchors.anchors.map(a => a.code),
  ...anchors.gaps.map(g => g.code),
  ...anchors.conflicts.map(c => c.id),
]);
// 禁引词集合
const forbidden = new Set();
for (const b of baseline.checks) {
  for (const f of b.forbid || []) forbidden.add(f);
  for (const d of b.deprecated || []) forbidden.add(d.value);
  for (const n of b.notInV13 || []) forbidden.add(n);
}
for (const c of anchors.conflicts) {
  forbidden.add(c.discarded);
}

function loadCards(target) {
  const files = [];
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) { console.error('目标不存在: ' + target); process.exit(2); }
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (f.endsWith('.json')) files.push(path.join(target, f));
    }
  } else {
    files.push(target);
  }
  const cards = [];
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    cards.push(...arr);
  }
  return cards;
}

function checkCard(card) {
  const problems = [];
  const text = [card.answerMarkdown || '', card.title || '', (card.questions || []).join('\n')].join('\n');

  // ① 引用编号合法性
  for (const c of card.anchors || []) {
    if (!legalCodes.has(c)) problems.push({ level: 'blocker', kind: 'badCode', code: c });
  }
  // ② 禁引词
  for (const w of forbidden) {
    if (text.includes(w)) problems.push({ level: 'blocker', kind: 'forbidden', word: w });
  }
  // ③ 字段完备
  if (!card.id) problems.push({ level: 'blocker', kind: 'missingField', field: 'id' });
  if (!card.answerMarkdown) problems.push({ level: 'blocker', kind: 'missingField', field: 'answerMarkdown' });
  const len = (card.answerMarkdown || '').length;
  if (len < 350 || len > 800) problems.push({ level: 'major', kind: 'length', len });
  // ④ 三段式标题
  for (const seg of ['## 结论', '## 原理与边界', '## 生产实践']) {
    if (!(card.answerMarkdown || '').includes(seg)) problems.push({ level: 'major', kind: 'missingSegment', seg });
  }
  return problems;
}

const target = process.argv[2] || path.join(root, 'out', 'tech-group1.json');
const cards = loadCards(target);
let block = 0, major = 0, minor = 0;
for (const card of cards) {
  const ps = checkCard(card);
  if (ps.length) {
    console.log(`\n[${card.id}] ${card.title}`);
    for (const p of ps) {
      console.log(`  ${p.level.toUpperCase()} [${p.kind}] ${JSON.stringify(p)}`);
      if (p.level === 'blocker') block++;
      else if (p.level === 'major') major++;
      else minor++;
    }
  }
}
console.log(`\n=== 校验完成：卡片 ${cards.length} 张 | blocker ${block} | major ${major} | minor ${minor} ===`);
if (block > 0) { console.log('结果：FAIL（存在 blocker，打回）'); process.exit(1); }
else { console.log('结果：PASS'); }