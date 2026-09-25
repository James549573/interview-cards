// 程序化审计：扫描 cards.json 与素材，输出结构化问题清单
// 用法: node scripts/audit.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'source');
const problems = [];
function add(id, dim, sev, where, what, fix, task) {
  problems.push({ id, dim, sev, where, what, fix, task });
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md'));
const texts = {};
for (const f of files) texts[f] = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n?/g, '\n');
const main = texts['面试官证据源包_T0核心合并版.md'];
const cardsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cards.json'), 'utf8'));
const cards = cardsData.cards;
const byId = new Map(cards.map((c) => [c.id, c]));

// ---------- 编号正则 ----------
const CODE_RE = /\b(R\d{1,2}|N\d{1,2}|V\d{1,2}|I\d{1,2}|M\d{1,2}|K-\d{2}|X-\d{2}|T1-\d{2}|AI-\d{3}|CL-(?:RAG-)?\d{1,3}|ADR-[\d-]+|ISSUE-\d{3}|GF-\d+(?:\.\d+)?|AC-\d{2}|G\d{1,2}|T-\d{2}|C\d{1,2}|D\d{1,2}|RK-\d{2}|SC-\d{2}|P-\d{1,2}|US-\d|INF-\d{2,3}|IL-\d{3})\b/g;

// ---------- A1/A2: 裸编号 + 无映射 ----------
const codesWithCards = {}; // code -> [cardIds]
let bareTotal = 0;
for (const c of cards) {
  if (!c.answerMarkdown) continue;
  // 去掉代码块后扫描
  const noCode = c.answerMarkdown.replace(/```[\s\S]*?```/g, '');
  const seen = new Set();
  let m;
  while ((m = CODE_RE.exec(noCode))) {
    const code = m[1];
    bareTotal++;
    if (!codesWithCards[code]) codesWithCards[code] = [];
    if (!seen.has(code)) {
      seen.add(code);
      codesWithCards[code].push(c.id);
    }
  }
}
const allCodes = Object.keys(codesWithCards).sort();
const codesJsonPath = path.join(ROOT, 'src/data/codes.json');
const codesJson = fs.existsSync(codesJsonPath) ? JSON.parse(fs.readFileSync(codesJsonPath, 'utf8')) : null;
console.log('== A1/A2 编号统计 ==');
console.log('正文中出现的不同编号数:', allCodes.length, '| 总出现次数:', bareTotal);
if (!codesJson) {
  console.log('codes.json 不存在 → 全部', allCodes.length, '个编号无映射（P-001/P-002 高危）');
}

// ---------- A6: 格式不统一 ----------
const fmtVariants = {};
for (const code of allCodes) {
  const norm = code.replace(/-/g, '');
  (fmtVariants[norm] = fmtVariants[norm] || []).push(code);
}
const dupFmt = Object.entries(fmtVariants).filter(([, v]) => v.length > 1);
if (dupFmt.length) console.log('A6 格式变体:', JSON.stringify(dupFmt));

// ---------- A4: related 失效 ----------
for (const c of cards) {
  for (const r of c.related || []) {
    if (!byId.has(r)) add(`A4-${c.id}-${r}`, 'A4 交叉引用失效', '中', `${c.id}.related`, `指向不存在的卡片 ${r}`, '修正或删除引用', 'T-FIX-04');
  }
}

// ---------- B: 字段完整性 ----------
const REQUIRED = ['id', 'title', 'questions', 'answerMarkdown', 'memoryHook', 'tags', 'source', 'chapter'];
// memoryHook 对参考卡（srs:false，即 T1 索引卡与附录卡）不作强制要求
for (const c of cards) {
  const isRefCard = c.srs === false;
  for (const f of REQUIRED) {
    if (isRefCard && f === 'memoryHook') continue;
    if (c[f] === undefined || c[f] === null || c[f] === '' || (Array.isArray(c[f]) && c[f].length === 0)) {
      add(`B8-${c.id}-${f}`, 'B8 字段缺失', f === 'memoryHook' ? '中' : '高', c.id, `必填字段 ${f} 缺失或为空`, '回素材补齐', 'T-FIX-04');
    }
  }
  if (c.srs !== false && (!c.questions || c.questions.length === 0)) {
    add(`B9-${c.id}`, 'B9 questions 为空', '高', c.id, '无问题可显示', '补问题', 'T-FIX-04');
  }
  // B7 截断：answer 应含钩子段标记（附录卡除外）
  if (c.srs !== false && c.id.startsWith('K-') && !c.answerMarkdown.includes('记忆钩子')) {
    add(`B7-${c.id}`, 'B7 疑似截断', '高', c.id, 'answerMarkdown 无【一句话记忆钩子】段', '检查解析边界', 'T-FIX-04');
  }
}

// ---------- B11/B12: 素材↔卡片双向对照 ----------
const matK = new Set();
for (const [, t] of Object.entries(texts)) {
  let m; const re = /^### (K-\d{2}|X-\d{2})\b/gm;
  while ((m = re.exec(t))) matK.add(m[1]);
}
const matT1 = new Set();
for (const [, t] of Object.entries(texts)) {
  let m; const re = /^\|\s*(T1-\d{2})\s*\|/gm;
  while ((m = re.exec(t))) matT1.add(m[1]);
}
const cardK = new Set(cards.filter((c) => c.id.startsWith('K-') || c.id.startsWith('X-')).map((c) => c.id));
const cardT1 = new Set(cards.filter((c) => c.id.startsWith('T1-')).map((c) => c.id));
for (const id of matK) if (!cardK.has(id)) add(`B11-${id}`, 'B11 素材有卡没有', '高', id, '素材存在但 cards.json 缺失', '补卡', 'T-FIX-04');
for (const id of cardK) if (!matK.has(id)) add(`B12-${id}`, 'B12 卡有素材没有', '中', id, 'cards.json 有但素材无源', '核对来源', 'T-FIX-04');
for (const id of matT1) if (!cardT1.has(id)) add(`B11-${id}`, 'B11 T1 缺失', '中', id, '素材 T1 表行存在但卡片缺失', '补卡', 'T-FIX-04');
console.log('素材 K/X 卡数:', matK.size, '| cards.json:', cardK.size, '| 素材 T1 行数:', matT1.size, '| T1 卡:', cardT1.size);

// ---------- B13: T1 空洞 ----------
const t1Cards = cards.filter((c) => c.id.startsWith('T1-'));
const hollowT1 = t1Cards.filter((c) => c.answerMarkdown.length < 120);
console.log('T1 卡总数:', t1Cards.length, '| 内容<120字符的空洞卡:', hollowT1.length);
if (hollowT1.length) add('B13-T1', 'B13 T1 内容空洞', '高', hollowT1.map((c) => c.id).slice(0, 5).join(',') + ` 等${hollowT1.length}张`, 'T1 卡只有编号+名称+岗位轴', 'T-FIX-03 补全', 'T-FIX-03');
if (t1Cards.some((c) => c.srs !== false)) add('B-srs-T1', 'T1 进调度', '中', 'T1-*', 'T1 卡参与了 SRS（任务书要求 srs:false）', '置 srs:false', 'T-FIX-03');

// ---------- D21: 章节归属 ----------
const EXPECT_CH = { 'K-34': 'mod7' };
for (const [id, ch] of Object.entries(EXPECT_CH)) {
  const c = byId.get(id);
  if (c && c.chapter !== ch) add(`D21-${id}`, 'D21 章节归属', '中', id, `chapter=${c.chapter}，应为 ${ch}`, '修正', 'T-FIX-04');
}
// K-28~33 应在 mod6（三体预演）
for (const id of ['K-28', 'K-29', 'K-30', 'K-31', 'K-32', 'K-33']) {
  const c = byId.get(id);
  if (c && c.chapter !== 'mod6') add(`D21-${id}`, 'D21 章节归属', '低', id, `chapter=${c.chapter}（三体系素材，建议 mod6）`, '核对', 'T-FIX-04');
}

// ---------- D22: tags vs ★ 标记 ----------
const STAR_TAG = { 技术: '技术', 管理: '管理', FDE: 'FDE', 合规: '合规', 红线: '红线' };
for (const c of cards) {
  if (!c.id.startsWith('K-') && !c.id.startsWith('X-')) continue;
  // 找素材原标题
  let raw = null;
  for (const [, t] of Object.entries(texts)) {
    const m = t.match(new RegExp(`^### ${c.id.replace('-', '\\-')} (.+)$`, 'm'));
    if (m) { raw = m[1]; break; }
  }
  if (!raw) continue;
  for (const star of Object.keys(STAR_TAG)) {
    if (raw.includes(`★${star}`) && !(c.tags || []).includes(star)) {
      add(`D22-${c.id}-${star}`, 'D22 标签缺失', '低', c.id, `素材标题有 ★${star} 但 tags 缺`, '补标签', 'T-FIX-04');
    }
  }
  if (raw.includes('★红线') && !c.redline) {
    add(`D19-${c.id}`, 'G19 红线漏标', '高', c.id, '素材 ★红线 但 redline=false', '置 true', 'T-FIX-04');
  }
}

// ---------- D23: priority ----------
for (const c of cards) {
  if (!c.id.startsWith('K-')) continue;
  let raw = null;
  for (const [, t] of Object.entries(texts)) {
    const m = t.match(new RegExp(`^### ${c.id.replace('-', '\\-')} (.+)$`, 'm'));
    if (m) { raw = m[1]; break; }
  }
  if (!raw) continue;
  const isT1 = raw.includes('【T1】');
  if (isT1 && c.priority === 'T0') add(`D23-${c.id}`, 'D23 优先级', '中', c.id, '素材标【T1】但 priority=T0', '核对最终口径（G36）', 'T-FIX-04');
}

// ---------- G36: K-30~33 归属 ----------
for (const id of ['K-30', 'K-31', 'K-32', 'K-33']) {
  const c = byId.get(id);
  if (c) console.log(`G36 ${id}: priority=${c.priority} chapter=${c.chapter} tags=${JSON.stringify(c.tags)}`);
}

// ---------- G37: X↔K related ----------
const xCards = cards.filter((c) => c.id.startsWith('X-'));
const xNoK = xCards.filter((c) => !(c.related || []).some((r) => r.startsWith('K-')));
if (xCards.length && xNoK.length === xCards.length) {
  add('G37-X', 'G37 X↔K related 缺失', '中', 'X-*', '全部 X 卡 related 无 K 系列关联', '按内容补关联', 'T-FIX-04');
} else if (xNoK.length) {
  add('G37-X', 'G37 X↔K related 缺失', '低', xNoK.map((c) => c.id).join(','), 'X 卡 related 无 K 系列关联', '按内容补关联', 'T-FIX-04');
}

// ---------- G38: 附录 A 溯源表 ----------
const appA = byId.get('APP-A');
if (appA) {
  const rows = (appA.answerMarkdown.match(/^\|/gm) || []).length;
  console.log('G38 APP-A 表格行数:', rows);
  if (rows < 10) add('G38', '附录 A 表漏解析', '高', 'APP-A', `表格行仅 ${rows} 行（素材应为 25 行数字溯源表）`, '重新解析附录 A', 'T-FIX-04');
} else add('G38', '附录 A 卡缺失', '高', 'APP-A', '无 APP-A 卡', '补卡', 'T-FIX-04');

// ---------- G39: T-06~T-12 与 G40: C1~C19 ----------
const tensionMentions = {};
for (const c of cards) {
  if (!c.answerMarkdown) continue;
  for (const tn of ['T-06', 'T-07', 'T-08', 'T-09', 'T-10', 'T-11', 'T-12']) {
    if (c.answerMarkdown.includes(tn)) (tensionMentions[tn] = tensionMentions[tn] || []).push(c.id);
  }
}
console.log('G39 张力在卡片中的出现:', JSON.stringify(tensionMentions));
const cMentions = {};
for (const c of cards) {
  if (!c.answerMarkdown) continue;
  const noCode = c.answerMarkdown.replace(/```[\s\S]*?```/g, '');
  let m; const re = /\bC(\d{1,2})\b/g;
  while ((m = re.exec(noCode))) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 19) (cMentions['C' + n] = cMentions['C' + n] || []).push(c.id);
  }
}
console.log('G40 待确认清单编号在卡片中的出现:', Object.keys(cMentions).length, '个 C 编号');

// ---------- G34: 素材未展开标注 ----------
const unexpanded = cards.filter((c) => c.answerMarkdown && c.answerMarkdown.includes('素材未展开'));
console.log('G34 含【素材未展开】标注的卡:', unexpanded.map((c) => c.id).join(',') || '无');

// ---------- H47: ID 排序 ----------
const kIds = cards.filter((c) => /^K-\d+$/.test(c.id)).map((c) => c.id);
const sorted = [...kIds].sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
console.log('H47 K 卡顺序正确:', JSON.stringify(kIds) === JSON.stringify(sorted) ? '是' : '否');

// ---------- H48: 附录卡 srs ----------
for (const id of ['APP-A', 'APP-T', 'APP-F', 'APP-H']) {
  const c = byId.get(id);
  if (c && c.srs !== false) add(`H48-${id}`, '附录卡进调度', '中', id, '附录卡应为 srs:false', '置 false', 'T-FIX-04');
}

// ---------- B10: memoryHook（srs 卡） ----------
const noHook = cards.filter((c) => c.srs !== false && !c.memoryHook);
console.log('B10 无钩子的 srs 卡:', noHook.map((c) => c.id).join(',') || '无');

// ---------- 输出 ----------
console.log('\n== 结构化问题数 ==', problems.length);
const out = problems.length ? problems : [];
fs.writeFileSync(path.join(ROOT, 'audit-problems.json'), JSON.stringify(out, null, 2));
console.log('写出 audit-problems.json');
// 打印明细
for (const p of out) console.log(`[${p.sev}] ${p.id}: ${p.what} @ ${p.where}`);
