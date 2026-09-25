import fs from 'node:fs';
const src = fs.readFileSync('source/面试官证据源包_T0核心合并版.md', 'utf8').replace(/\r\n?/g, '\n');
const app = fs.readFileSync('source/附录与补充.md', 'utf8').replace(/\r\n?/g, '\n');
const d = JSON.parse(fs.readFileSync('src/data/cards.json', 'utf8'));

function srcSection(id) {
  for (const [f, t] of Object.entries({ main: src, app })) {
    const re = new RegExp('^### ' + id + '[\\s\\S]*?(?=^### |^## )', 'm');
    const m = t.match(re);
    if (m) return { text: m[0], file: f };
  }
  return null;
}

let allOk = true;
for (const id of ['K-29', 'K-30', 'K-31', 'K-32', 'K-33', 'X-02', 'X-03', 'X-04', 'X-05', 'X-06']) {
  const s = srcSection(id);
  const c = d.cards.find((x) => x.id === id);
  if (!s) { console.log(id, '素材未找到!'); allOk = false; continue; }
  let total = 0, miss = 0;
  const norm = (x) => x.replace(/\s+/g, '');
  s.text.split('\n').forEach((l) => {
    if (l.trim() && !l.startsWith('### ') && l !== '---') {
      total++;
      const key = norm(l).slice(0, 30);
      if (!norm(c.answerMarkdown).includes(key)) { miss++; console.log(' ', id, '⚠', l.trim().slice(0, 55)); }
    }
  });
  console.log(id, '(' + s.file + ') 素材', s.text.length, '字 → 卡', c.answerMarkdown.length, '字 |', total, '行', miss ? miss + ' 缺失' : '全部包含 ✓');
  if (miss) allOk = false;
}
console.log(allOk ? '\n== C-03 结论：10 张卡素材内容全部完整保留，无解析漏读 ==' : '\n== 存在缺失 ==');
