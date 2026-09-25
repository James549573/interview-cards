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

// ---------- B13: T1 空洞（V6 展示层重构后阈值与 V2-t1 对齐：精简卡为合规形态，只防真空卡） ----------
const t1Cards = cards.filter((c) => c.id.startsWith('T1-'));
const hollowT1 = t1Cards.filter((c) => c.answerMarkdown.length < 45);
console.log('T1 卡总数:', t1Cards.length, '| 真空卡(<45字):', hollowT1.length);
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

// ---------- V2: 内容充足性（T2-FIX-06） ----------
console.log('\n== V2 内容充足性 ==');
if (codesJson) {
  const entries = Object.values(codesJson.codes);
  const noName = entries.filter((e) => !e.name);
  const thinSummary = entries.filter((e) => e.name && (e.summary || '').length < 30);
  const thinFull = entries.filter((e) => (e.fullContent || '').length < 50);
  console.log(`codes: 总 ${entries.length} | 无名称 ${noName.length} | summary<30字 ${thinSummary.length} | fullContent<50字 ${thinFull.length}`);
  for (const e of noName) add(`V2-name-${e.code}`, 'V2 编号无名称', '高', `codes:${e.code}`, 'name 为空', '补命名', 'T2-FIX-01');
  for (const e of thinSummary) add(`V2-sum-${e.code}`, 'V2 summary 过短', '中', `codes:${e.code}`, `summary 仅 ${(e.summary || '').length} 字`, '补到 ≥30 字', 'T2-FIX-02');
  for (const e of thinFull) add(`V2-full-${e.code}`, 'V2 fullContent 过短', '高', `codes:${e.code}`, `fullContent 仅 ${(e.fullContent || '').length} 字`, '补到 ≥50 字', 'T2-FIX-02');
}
// V6 展示层重构后：T1 卡分"四段卡"与"精简卡"（素材只有枚举句时只出它是什么，硬约束），
// 精简卡最短约 50 字。此处只防"几乎无内容"的真空卡（<45 字），内容充足性由 V6-empty/V6-R3 接管。
const thinT1 = cards.filter((c) => c.id.startsWith('T1-') && c.answerMarkdown.length < 45);
// K/X 短卡：与素材源段长度对比——只有明显短于源段才算截断/丢失，素材本身短则记为受限短卡
function srcSectionLen(id) {
  for (const t of Object.values(texts)) {
    const m = t.match(new RegExp('^### ' + id.replace('-', '\\-') + '[\\s\\S]*?(?=^### |^## )', 'm'));
    if (m) return m[0].length;
  }
  return 0;
}
const shortKX = cards.filter((c) => /^[KX]-/.test(c.id) && c.answerMarkdown.length < 500);
const thinKX = shortKX.filter((c) => c.answerMarkdown.length < srcSectionLen(c.id) - 150);
const limitedKX = shortKX.filter((c) => !thinKX.includes(c));
console.log(`T1 卡 <200字: ${thinT1.length}${thinT1.length ? ' → ' + thinT1.map((c) => c.id).join(',') : ''}`);
console.log(`K/X 卡 <500字: ${shortKX.length}（其中截断嫌疑 ${thinKX.length}，素材受限短卡 ${limitedKX.length}: ${limitedKX.map((c) => c.id).join(',')}）`);
for (const c of thinT1) add(`V2-t1-${c.id}`, 'V2 T1 卡内容不足', '高', c.id, `answerMarkdown 仅 ${c.answerMarkdown.length} 字`, '五段式补全', 'T2-FIX-03');
for (const c of thinKX) add(`V2-kx-${c.id}`, 'V2 K/X 卡疑截断', '高', c.id, `卡 ${c.answerMarkdown.length} 字 << 素材源段 ${srcSectionLen(c.id)} 字`, '核对解析边界', 'T2-FIX-02');

// ---------- V3：内容溯源与充足性 ----------

// V3-R1: C 类污染检测——fullContent 含"通行实践/通常做法/常见反模式"等模型自带知识字样
if (codesJson) {
  const cWords = ['通行实践', '通常做法', '常见反模式', '业界通行', '一般来说'];
  for (const c of Object.values(codesJson.codes)) {
    for (const w of cWords) {
      if ((c.fullContent || '').includes(w)) {
        add('V3-cpollute-' + c.code, 'V3 C类污染', '高', c.code, `fullContent 含"${w}"（疑似模型自带知识混入）`, '移除或降级为"通行实践参考"并显式标注', 'F-01');
      }
    }
  }
}

// V3-R2: 家族命名逃避检测——name 标"未展开"但素材中存在该编号的定义行（"编号 + 中文名"模式）
if (codesJson) {
  for (const c of Object.values(codesJson.codes)) {
    if (!c.name || !/未展开|未单独/.test(c.name)) continue;
    const code = c.code;
    const defRe = new RegExp('(^|[^A-Za-z0-9-])' + code.replace(/[-]/g, '\\-') + '\\s*[-——:：\\s「]\\s*[^，。；\\n]{4,}');
    let found = null;
    for (const [f, t] of Object.entries(texts)) {
      for (const l of t.split('\n')) {
        if (defRe.test(l) && !/^\|/.test(l.trim()) && !/T1-\d/.test(l)) { found = `${f}: ${l.trim().slice(0, 60)}`; break; }
      }
      if (found) break;
    }
    if (found) add('V3-family-' + code, 'V3 家族命名逃避', '高', code, `name 标"未展开"但素材存在疑似定义行：${found}`, '人工核对，是定义则映射为具体名称', 'F-02');
  }
}

// V3-R3: 内容漏读检测——K/X 卡 answerMarkdown < 素材源段 80%
for (const c of cards) {
  if (!/^[KX]-/.test(c.id)) continue;
  let srcLen = 0;
  for (const t of Object.values(texts)) {
    const m = t.match(new RegExp('^### ' + c.id + '[\\s\\S]*?(?=^### |^## |^# )', 'm'));
    if (m) { srcLen = m[0].length; break; }
  }
  if (srcLen > 0 && c.answerMarkdown.length < srcLen * 0.8) {
    add('V3-loss-' + c.id, 'V3 内容漏读', '高', c.id, `卡片 ${c.answerMarkdown.length} 字 < 素材源段 ${srcLen} 字的 80%`, '检查解析截断', 'F-03');
  }
}

// ---------- V5：name/正文一致性 + 过度填充 + A′ 挂钩核查 ----------
console.log('\n== V5 一致性核查 ==');

// 最长公共子串（用于 name 与 fullContent 主题的相似度判断）
function lcsLen(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (a[i] === b[j]) {
        let k = 1;
        while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
        if (k > best) best = k;
      }
    }
  }
  return best;
}

if (codesJson) {
  // V5-R1: name 与 fullContent 首标题矛盾（M27 案例：name"三步法"、正文"越权门槛写死"）
  // 规则：fullContent 首行 "**CODE · 主题**" 提取主题；name 与主题既不互相包含、
  // 且最长公共子串 < 4 字 → 报警。诚实未定义条目（name/theme 含"未展开/未定义"）跳过。
  for (const c of Object.values(codesJson.codes)) {
    const fc = c.fullContent || '';
    const m = fc.match(/^\*\*(?:[A-Za-z0-9\-]+)\s*·\s*(.+?)\*\*/m);
    if (!m || !c.name) continue;
    const theme = m[1].trim();
    const nameCore = c.name.replace(/（[^）]*）/g, '').trim();
    if (/未展开|未定义|未逐条|未单独/.test(c.name + theme)) continue; // 诚实未定义合法（用原始 name 判断，括号内的"未逐条"也算）
    const contained = nameCore.includes(theme) || theme.includes(nameCore);
    const sim = lcsLen(nameCore, theme);
    if (!contained && sim < 4) {
      add('V5-name-' + c.code, 'V5 name/正文矛盾', '高', c.code, `name="${c.name.slice(0, 40)}" 与正文主题"${theme.slice(0, 40)}"不匹配`, '修正 name 或正文，二者必须一致', 'F-02');
    }
  }

  // V5-R2: 过度填充掩盖缺失（V4 任务书规则）——fullContent > 800 字但 name 标"未展开"
  for (const c of Object.values(codesJson.codes)) {
    if ((c.fullContent || '').length > 800 && /未展开|未定义|未单独/.test(c.name || '')) {
      add('V5-stuff-' + c.code, 'V5 过度填充', '中', c.code, `fullContent ${(c.fullContent || '').length} 字但 name 标"未展开"（疑似用长内容掩盖缺失）`, '收缩为诚实声明或映射真实内容', 'F-03');
    }
  }

  // V5-R3: A′ 挂钩核查——R21 的 A′ 条目取自 K-17 正文，依据是 K-17 标题挂钩含 R21；
  // 源卡标题挂钩不含目标编号 → A′ 不成立（V5 复核 1 的程序化守护）
  const A_PRIME_CLAIMS = [
    { target: 'R21', card: 'K-17', note: 'R21 条目 10~12 标 A′，依据 K-17 标题挂钩 R21' }
  ];
  for (const claim of A_PRIME_CLAIMS) {
    let title = null;
    for (const [, t] of Object.entries(texts)) {
      const m = t.match(new RegExp('^### ' + claim.card.replace('-', '\\-') + '[^\\n]*', 'm'));
      if (m) { title = m[0]; break; }
    }
    if (!title) {
      add('V5-aprime-' + claim.target, 'V5 A′源卡缺失', '高', claim.target, `A′ 依据卡 ${claim.card} 在素材中不存在`, '核对', 'F-01');
    } else {
      const hookM = title.match(/【已挂钩([^\]]*)】/);
      const codes = hookM ? hookM[1].split(/[\/、,，\s]+/).map((s) => s.trim()).filter(Boolean) : [];
      if (!codes.includes(claim.target)) {
        add('V5-aprime-' + claim.target, 'V5 A′挂钩不成立', '高', claim.target, `${claim.note}，但 ${claim.card} 标题挂钩为 [${codes.join('/')}]，不含 ${claim.target} → 该 A′ 应降级 B`, '降级并修正卡头声明', 'F-01');
      }
    }
  }

  // V5 汇总
  const v5 = problems.filter((p) => p.dim.startsWith('V5'));
  console.log('name/正文矛盾:', problems.filter((p) => p.id.startsWith('V5-name')).length);
  console.log('过度填充（>800 字且标未展开）:', problems.filter((p) => p.id.startsWith('V5-stuff')).length);
  console.log('A′ 挂钩不成立:', problems.filter((p) => p.id.startsWith('V5-aprime')).length);
  if (!v5.length) console.log('V5 全部规则: 通过（0 问题）');
}

// ---------- V6 展示层净化（卡片是给用户看的，不是给审核者看的） ----------
console.log('\n== V6 展示层净化 ==');
{
  // V6-R1: 卡片正文禁词（审核痕迹泄漏）
  const FORBIDDEN = [
    ['定位说明', '审核证据'],
    ['最长公共子串', '审核证据'],
    ['互证匹配', '审核证据'],
    ['定位可信', '审核证据'],
    ['该知识点属于', '元数据'],
    ['T1 索引表', '元数据'],
    ['登记行', '元数据'],
    ['关联卡 暂无', '元数据'],
    ['素材未展开本条', '审核结论'],
    ['无独立承载卡', '审核结论'],
    ['附录 U 原表', '审核结论'],
    ['素材说明（V3', '审核结论'],
    ['逐行比对无删减', '审核结论'],
    ['复习时先过关联卡', '元数据'],
    ['**素材原文**', '出处段'],
    ['**出处**', '出处段'],
    ['关键约束（据挂钩', '元数据'],
    ['来源说明（V5', '审核证据'],
    ['等级统计', '审核证据']
  ];
  if (cardsData && cardsData.cards) {
    for (const c of cardsData.cards) {
      const body = c.answerMarkdown || '';
      for (const [pat, kind] of FORBIDDEN) {
        if (body.includes(pat)) {
          add('V6-trace-' + c.id, 'V6 审核痕迹泄漏', '高', c.id, `卡片正文出现"${pat}"（${kind}）`, '移除，审核证据迁 TRACE_REPORT', '展示层重构');
        }
      }
    }
    // V6-R2（V7 分档制）: A 档卡"它是什么"须实质内容（≥40 字）；B 档卡为挂钩句原文，允许短，
    // 但结构必须正确——A 档四段齐、B 档只有"它是什么"一段（不允许 B 档硬凑四段）
    for (const c of cardsData.cards) {
      if (!c.id.startsWith('T1-')) continue;
      const md = c.answerMarkdown || '';
      const m = md.match(/## 它是什么\n([\s\S]*?)(\n## |\n> |$)/);
      const len = m ? m[1].trim().length : 0;
      const isB = c.tier === 'B';
      if (isB) {
        if (len < 8) {
          add('V6-empty-' + c.id, 'V6 B 档卡空段', '中', c.id, `"它是什么"段仅 ${len} 字`, 'B 档至少要有挂钩句原文', '展示层重构');
        }
        if (/^## (为什么这么做|面试会怎么问)/m.test(md)) {
          add('V6-tier-' + c.id, 'V6 B 档卡结构越界', '中', c.id, 'B 档卡出现"为什么这么做/面试会怎么问"段（挂钩句信息量不足以支撑，疑似硬凑）', 'B 档只保留"它是什么"+ 关联指引，或升 A 档并人工核校', 'V7 分档');
        }
      } else {
        if (len < 40) {
          add('V6-empty-' + c.id, 'V6 A 档卡内容不足', '中', c.id, `"它是什么"段仅 ${len} 字`, 'A 档须实质知识内容；内容不足应降 B 档', 'V7 分档');
        }
        for (const sec of ['## 为什么这么做', '## 面试会怎么问']) {
          if (!md.includes(sec)) {
            add('V6-tier-' + c.id, 'V6 A 档卡缺段', '中', c.id, `A 档卡缺少 ${sec} 段`, '补齐四段或降 B 档', 'V7 分档');
          }
        }
      }
      // V6-R3: T1 卡禁止整段"上下文推断"填满四段（硬约束：推断只允许"为什么这么做"正文段声明一次，
      // 引用块（> 出处：…）中的来源声明不算）
      const inferCount = (c.answerMarkdown || '')
        .split('\n')
        .filter((l) => !l.startsWith('>'))
        .join('\n').match(/上下文推断/g);
      if (inferCount && inferCount.length > 1) {
        add('V6-infer-' + c.id, 'V6 推断填充过量', '中', c.id, `正文出现 ${inferCount.length} 处"上下文推断"（疑似用推断填满多段）`, '只允许"为什么这么做"段声明推断一次，其余段落删除', '展示层重构');
      }
    }
  }
  // V6-R4: codes.json fullContent 禁词（RefModal 点开也是展示层）
  if (codesJson) {
    for (const c of Object.values(codesJson.codes)) {
      const fc = c.fullContent || '';
      for (const pat of ['定位说明', '最长公共子串', '互证匹配', '**素材原文**', '**出处**', '与 T1 卡挂钩互证']) {
        if (fc.includes(pat)) {
          add('V6-code-' + c.code, 'V6 编号内容审核痕迹', '中', c.code, `fullContent 出现"${pat}"`, '清理为知识内容 + 末尾引用块出处', '展示层重构');
        }
      }
    }
  }
  const v6 = problems.filter((p) => p.dim.startsWith('V6'));
  console.log('卡片审核痕迹:', problems.filter((p) => p.id.startsWith('V6-trace')).length);
  console.log('T1 内容不足:', problems.filter((p) => p.id.startsWith('V6-empty')).length);
  console.log('推断填充过量:', problems.filter((p) => p.id.startsWith('V6-infer')).length);
  console.log('编号内容痕迹:', problems.filter((p) => p.id.startsWith('V6-code')).length);
  if (!v6.length) console.log('V6 全部规则: 通过（0 问题）');
}

// ---------- 输出 ----------
console.log('\n== V3 溯源核查 ==');
{
  const v3 = problems.filter((p) => p.dim.startsWith('V3'));
  if (codesJson) {
    const famCount = Object.values(codesJson.codes).filter((c) => c.name && /未展开|未单独/.test(c.name)).length;
    const poolCount = Object.values(codesJson.codes).filter((c) => (c.fullContent || '').includes('主题池供参考')).length;
    console.log('C 类污染（通行实践字样）:', problems.filter((p) => p.id.startsWith('V3-cpollute')).length);
    console.log('家族命名逃避（素材有定义行但标未展开）:', problems.filter((p) => p.id.startsWith('V3-family')).length);
    console.log('内容漏读（卡 < 源段 80%）:', problems.filter((p) => p.id.startsWith('V3-loss')).length);
    console.log('诚实标注"未展开"的编号:', famCount, '| 其中已注入 M 线主题池:', poolCount);
  }
  if (!v3.length) console.log('V3 全部规则: 通过（0 问题）');
}
console.log('\n== 结构化问题数 ==', problems.length);
const out = problems.length ? problems : [];
fs.writeFileSync(path.join(ROOT, 'audit-problems.json'), JSON.stringify(out, null, 2));
console.log('写出 audit-problems.json');
// 打印明细
for (const p of out) console.log(`[${p.sev}] ${p.id}: ${p.what} @ ${p.where}`);
