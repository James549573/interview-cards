// 从素材提取全部编号定义 → src/data/codes.json
// 名称来源优先级：附录 H/T 表格 > K/X 卡标题 > T1 索引表 > 内联"编号 名称" > 未找到
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.env.INTERVIEW_PREP_DIR || path.join(ROOT, 'source');

// 素材优先级：合并包是唯一事实源
const FILE_PRIORITY = [
  '面试官证据源包_T0核心合并版.md',
  '04_T0增补_K34_招生季与年度报名口径.md',
  '03_三体预演与新增知识点.md',
  'T0_模块1_AI410_模块2_AI401.md',
  'T0_模块3_4_5_RAG_合规_管理.md',
  '附录与补充.md',
  '面试官Prompt_可直接复制.md'
];

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md'));
const texts = {};
for (const f of files) texts[f] = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n?/g, '\n');

// ---------- 编号识别 ----------
// 显式词表类（无连字符或有特殊形态）
const SPECIAL = ['TRL', 'E6', 'F-2', 'A-4'];
const GENERIC = /\b(R\d{1,2}|N\d{1,2}|V\d{1,2}|I\d{1,2}|M\d{1,2}[bc]?|K-\d{2}|X-\d{2}|T1-\d{2}|AI-\d{3}|CL-(?:RAG-)?\d{1,3}|ADR-[\d-]+|ISSUE-\d{3}|GF-\d+(?:\.\d+)?|AC-\d{2}|G\d{1,2}|T-\d{2}|C\d{1,2}|D\d{1,2}|RK-\d{2}|SC-\d{2}|P-\d{1,2}|P\d\b|US-\d|INF-\d{2,3}|IL-\d{3}|Q-[A-Z]{2}-\d{2}|M-修\d)\b/g;

function extractCodes(text) {
  const set = new Set();
  let m;
  while ((m = GENERIC.exec(text))) set.add(m[1]);
  for (const s of SPECIAL) if (new RegExp(`\\b${s.replace('-', '-')}\\b`).test(text)) set.add(s);
  return set;
}

// 规范化：M1b → M1（同条目），去重
function norm(code) {
  const m = code.match(/^(M\d{1,2})[bc]$/);
  return m ? m[1] : code;
}

// 任务书要求的覆盖范围（素材未出现的也要有条目，标【素材未展开】）
const REQUIRED_RANGES = [];
for (let i = 1; i <= 27; i++) REQUIRED_RANGES.push('R' + i);
for (let i = 1; i <= 22; i++) REQUIRED_RANGES.push('N' + i);
for (let i = 1; i <= 18; i++) REQUIRED_RANGES.push('V' + i);
for (let i = 1; i <= 14; i++) REQUIRED_RANGES.push('I' + i);
for (let i = 1; i <= 35; i++) REQUIRED_RANGES.push('M' + i);
for (let i = 1; i <= 19; i++) REQUIRED_RANGES.push('C' + i);
for (let i = 6; i <= 12; i++) REQUIRED_RANGES.push('T-' + String(i).padStart(2, '0'));
for (let i = 1; i <= 26; i++) REQUIRED_RANGES.push('D' + i);
for (let i = 1; i <= 10; i++) REQUIRED_RANGES.push('G' + i);
for (let i = 1; i <= 8; i++) REQUIRED_RANGES.push('X-' + String(i).padStart(2, '0'));
for (let i = 1; i <= 34; i++) REQUIRED_RANGES.push('K-' + String(i).padStart(2, '0'));
for (let i = 9; i <= 40; i++) REQUIRED_RANGES.push('T1-' + String(i).padStart(2, '0'));
for (const c of ['AI-106', 'AI-201', 'AI-205', 'AI-208', 'AI-402', 'AI-403', 'AI-406', 'AI-411', 'AI-602', 'AI-101', 'AI-103', 'AI-105', 'AI-109', 'AI-410', 'AI-401', 'INF-03', 'INF-04', 'IL-401', 'RK-08', 'SC-08', 'P-1', 'P-2', 'P7', 'P-11', 'US-6', 'F-2', 'E6', 'A-4', 'TRL', 'CL-03', 'CL-04', 'CL-13', 'CL-18', 'CL-19', 'ADR-410-01', 'ISSUE-082']) REQUIRED_RANGES.push(c);

function categoryOf(code) {
  if (/^R\d/.test(code)) return 'RAG';
  if (/^N\d/.test(code)) return 'AI-410 数据问答线';
  if (/^V\d/.test(code)) return 'AI-401 招生核验线';
  if (/^I\d/.test(code) || /^INF-/.test(code)) return '基础设施线';
  if (/^M\d|^M-/.test(code)) return '管理/交付线';
  if (/^K-/.test(code)) return '知识点卡';
  if (/^X-/.test(code)) return '准 T0 知识点';
  if (/^T1-/.test(code)) return 'T1 索引';
  if (/^AI-/.test(code)) return '建设对象';
  if (/^CL-/.test(code)) return '合同条款';
  if (/^ADR-/.test(code)) return '架构决策记录';
  if (/^ISSUE-/.test(code)) return '材料问题登记';
  if (/^GF-/.test(code)) return 'GF 规范';
  if (/^AC-/.test(code)) return '验收标准';
  if (/^G\d/.test(code)) return '上线硬门槛';
  if (/^T-/.test(code)) return '内部张力（附录 T）';
  if (/^C\d/.test(code)) return '待确认清单（附录 H）';
  if (/^D\d/.test(code)) return '需求/文档编号';
  if (/^RK-/.test(code)) return '风险登记';
  if (/^SC-/.test(code)) return '安全约束';
  if (/^P-?\d/.test(code)) return '人员/角色';
  if (/^US-/.test(code)) return '用户故事';
  if (/^IL-/.test(code)) return '集成约束';
  if (code === 'TRL') return '技术成熟度';
  if (code === 'E6') return '评测集';
  if (code === 'F-2' || code === 'A-4') return '监控/告警指标';
  return '其他';
}

// ---------- 名称提取 ----------
// 0) 人工核校命名（最高优先级）：scripts/code-knowledge.mjs
import { NAMES as CURATED_NAMES, CONTENT as CURATED_CONTENT, FAMILY_NOTE, buildPhraseContent } from './code-knowledge.mjs';

// 1) K/X 卡标题：K-01 → 标题
const cardTitleName = {};
for (const [f, t] of Object.entries(texts)) {
  let m; const re = /^### (K-\d{2}|X-\d{2}) (.+)$/gm;
  while ((m = re.exec(t))) {
    if (cardTitleName[m[1]]) continue;
    const title = m[2].replace(/【[^】]*】/g, '').replace(/★[^★]*/g, '').replace(/[（(][^)）]*[)）]/g, '').trim();
    cardTitleName[m[1]] = { name: title, file: f };
  }
}
// 2) T1 索引表行：| T1-30 | 名称 | R21 | 轴 |  → 同时建立挂钩编号→名称的反向映射
const t1RowName = {};
const hookFromT1 = {};
for (const [f, t] of Object.entries(texts)) {
  let m; const re = /^\|\s*(T1-\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  while ((m = re.exec(t))) {
    if (!t1RowName[m[1]]) {
      t1RowName[m[1]] = { name: m[2].trim(), file: f, hook: m[3].trim(), axis: m[4].trim() };
      for (const h of m[3].split(/[\/、,，]/).map((s) => norm(s.trim())).filter((s) => /^(R|N|V|I|M)\d{1,2}$/.test(s))) {
        if (!hookFromT1[h]) hookFromT1[h] = { name: m[2].trim(), file: f };
      }
    }
  }
}
// 2b) K/X 卡标题的【已挂钩 …】→ 标题核心词（比 T1 名称粗，优先级更低）
const hookFromTitle = {};
for (const [f, t] of Object.entries(texts)) {
  let m; const re = /^### (K-\d{2}|X-\d{2}) (.+)$/gm;
  while ((m = re.exec(t))) {
    const hm = m[2].match(/【(?:已挂钩|半挂钩)\s*([^】]+)】/);
    if (!hm) continue;
    const title = m[2].replace(/【[^】]*】/g, '').replace(/★[^★]*/g, '').trim();
    for (const h of hm[1].split(/[\/、,，]/).map((s) => norm(s.trim())).filter((s) => /^(R|N|V|I|M)\d{1,2}$/.test(s))) {
      if (!hookFromTitle[h]) hookFromTitle[h] = { name: title.slice(0, 30), file: f };
    }
  }
}
// 3) 附录 T / H 表格行
const tableRow = {}; // code -> { name, fullRow, file, table }
for (const [f, t] of Object.entries(texts)) {
  let m; const re = /^\|\s*\*{0,2}(T-\d{2}|C\d{1,2})\*{0,2}\s*\|\s*([^|]+)\|([^|]*)\|([^|]*)\|/gm;
  while ((m = re.exec(t))) {
    const code = m[1];
    if (!tableRow[code]) {
      tableRow[code] = {
        name: m[2].replace(/\*{1,2}/g, '').trim(),
        fullRow: m[0].replace(/\s*\|/g, ' | ').trim(),
        file: f,
        table: code.startsWith('T-') ? '附录 T · 内部张力清单' : '附录 H · 待确认清单'
      };
    }
  }
}
// 4) 内联"编号 名称"：AI-201 智能答疑 / CL-13 人工评审不得由承建方自查 / R21：xxx
const inlineName = {}; // code -> { name, file } 取最高优先级文件
for (const f of FILE_PRIORITY) {
  const t = texts[f];
  if (!t) continue;
  let m; const re = /\b(R\d{1,2}|N\d{1,2}|V\d{1,2}|I\d{1,2}|M\d{1,2}|AI-\d{3}|CL-(?:RAG-)?\d{1,3}|ADR-[\d-]+|ISSUE-\d{3}|AC-\d{2}|RK-\d{2}|SC-\d{2}|INF-\d{2,3}|IL-\d{3}|US-\d|E6|F-2|A-4|GF-\d+(?:\.\d+)?)\s+([一-龥][^，。；|）)】\n]{2,60})/g;
  while ((m = re.exec(t))) {
    const code = norm(m[1]);
    // 名称：截到第一个 "/" 或 "【"，去 ★ 尾注，限 30 字
    const name = m[2].split(/[\/【]/)[0].replace(/★.*$/, '').trim().slice(0, 30).replace(/[，。；]$/, '');
    // 过滤：名称不能以"等/和/与/的"开头这类连词碎片，也不能是纯数字
    if (!inlineName[code] && name.length >= 2 && !/^[等和与的及其在]/.test(name)) inlineName[code] = { name, file: f };
  }
  // "CODE：名称" 形态
  const re2 = /\b(R\d{1,2}|N\d{1,2}|V\d{1,2}|I\d{1,2}|M\d{1,2}|AI-\d{3}|AC-\d{2}|D\d{1,2})\s*[：:]\s*([一-龥][^。\n]{3,60})/g;
  while ((m = re2.exec(t))) {
    const code = norm(m[1]);
    const name = m[2].trim();
    if (!inlineName[code]) inlineName[code] = { name, file: f };
  }
}

// ---------- 上下文（fullContent / summary） ----------
const allCards = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cards.json'), 'utf8')).cards;
const cardMentions = {}; // code -> [cardId]
for (const c of allCards) {
  if (!c.answerMarkdown) continue;
  const found = extractCodes(c.title + ' ' + c.answerMarkdown);
  for (const code of found) (cardMentions[code] = cardMentions[code] || []).push(c.id);
}

function contextFor(code) {
  // 按优先级收集提及该编号的行
  const lines = [];
  for (const f of FILE_PRIORITY) {
    const t = texts[f];
    if (!t) continue;
    const re = new RegExp(`(^|[^\\w-])(${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\w-])`, 'g');
    for (const line of t.split('\n')) {
      if (re.test(line)) lines.push({ file: f, line: line.trim() });
      re.lastIndex = 0;
    }
  }
  return lines;
}

// M 线主题池：Prompt 管理线"核心"的 27 个分句（素材未提供 M1–M35 逐条对应，仅作无锚点条目的参考池）
const mLinePool = (() => {
  const t = texts['面试官Prompt_可直接复制.md'] || '';
  const i = t.indexOf('管理 / 交付线（M1–M35）核心');
  if (i === -1) return [];
  const seg = t.slice(i, t.indexOf('\n\n', i));
  const body = seg.split('**').filter(Boolean).pop();
  return body.split('；').map((s) => s.trim()).filter((s) => s.length > 4);
})();

const PHRASE_CONTENT = buildPhraseContent(
  texts['面试官Prompt_可直接复制.md'],
  Object.entries(t1RowName).map(([id, v]) => ({ name: v.name, hook: v.hook }))
);

// ---------- 组装 ----------
const codes = {};
const allSeen = new Set();
for (const [f, t] of Object.entries(texts)) for (const c of extractCodes(t)) allSeen.add(norm(c));
const universe = new Set([...allSeen, ...REQUIRED_RANGES]);

for (const rawCode of [...universe].sort()) {
  const code = norm(rawCode);
  if (codes[code]) continue;
  const cat = categoryOf(code);
  let name = '';
  let sourceFile = '';
  let sourceAnchor = '';
  let fullContent = '';

  // 0) 人工核校内容（最高优先级）
  const curated = CURATED_CONTENT[code];
  const ctx = contextFor(code);
  const mentions = cardMentions[code] || [];
  if (CURATED_NAMES[code]) {
    name = CURATED_NAMES[code];
    sourceFile = 'scripts/code-knowledge.mjs（人工核校）';
    sourceAnchor = curated ? '人工核校条目' : '人工核校命名';
  }

  // Prompt 线句子互证条目：内容为素材原文，定位经 T1 名称互证
  const pc = PHRASE_CONTENT[code];
  if (pc) {
    const t1name = Object.values(t1RowName).find((v) => v.hook.split(/[\/、,，]/).map((s) => norm(s.trim())).includes(code))?.name || '';
    if (!name) {
      name = t1name || pc.phrase.slice(0, 30);
      sourceFile = '面试官Prompt_可直接复制.md';
      sourceAnchor = `${pc.lineName}核心 · 第 ${pc.idx + 1} 条`;
    }
    const phraseFull = [
      `**${code} · ${name}**`,
      '',
      `${pc.phrase}。`,
      '',
      `> 出处：面试官 Prompt ${pc.lineName}核心 · 第 ${pc.idx + 1} 条`
    ].join('\n');
    const summary = `${code}（${cat}）· ${name}：${pc.phrase}。`;
    codes[code] = {
      code,
      category: cat,
      name: name || code,
      summary: summary.length >= 50 ? summary : summary + ' 素材原文见 fullContent。',
      fullContent: phraseFull,
      sourceFile: '面试官Prompt_可直接复制.md',
      sourceAnchor: `${pc.lineName}核心 · 第 ${pc.idx + 1} 条`,
      relatedCards: mentions,
      phraseMatch: true
    };
    continue;
  }

  if (!name && tableRow[code]) {
    // 优先级③ 表格行：素材中显式表格给出的名称（素材原文，权威性低于人工核校）
    name = tableRow[code].name;
    sourceFile = tableRow[code].file;
    sourceAnchor = tableRow[code].table;
    fullContent = tableRow[code].fullRow;
  } else if (!name && hookFromT1[code]) {
    // 优先级④ T1 索引挂钩：附录 U 表格行挂钩（素材原文）
    name = hookFromT1[code].name + '（T1 索引挂钩）';
    sourceFile = hookFromT1[code].file;
    sourceAnchor = 'T1 索引表（附录 U）挂钩映射';
  } else if (!name && hookFromTitle[code]) {
    // 优先级⑤ 卡片标题挂钩（素材原文）。V5 修复：补 !name 守卫——此前缺守卫，
    // 会覆盖① curated 名称（M27/M35/M21 的 name 被 K 卡标题覆盖，与正文矛盾）
    name = hookFromTitle[code].name + '（卡片标题挂钩）';
    sourceFile = hookFromTitle[code].file;
    sourceAnchor = 'K/X 卡标题【已挂钩】';
  }

  if (!name) {
    // 优先级⑥/⑦/⑧ 自动推断兜底（无人工核校、无挂钩时的最后手段）
    if (cardTitleName[code]) {
      name = cardTitleName[code].name;
      sourceFile = cardTitleName[code].file;
      sourceAnchor = code + ' 标题';
    } else if (t1RowName[code]) {
      name = t1RowName[code].name;
      sourceFile = t1RowName[code].file;
      sourceAnchor = 'T1 索引表（附录 U）';
    } else if (inlineName[code]) {
      name = inlineName[code].name;
      sourceFile = inlineName[code].file;
      sourceAnchor = '内联定义';
    }
  }

  // 人工核校条目直接采用
  if (curated) {
    codes[code] = {
      code,
      category: cat,
      name: name || code,
      summary: curated.summary,
      fullContent: curated.fullContent,
      sourceFile: sourceFile || (ctx.length ? ctx[0].file : ''),
      sourceAnchor: sourceAnchor || (ctx.length ? `提及于 ${ctx.length} 行` : '人工核校'),
      relatedCards: mentions,
      curated: true
    };
    continue;
  }

  if (!fullContent) {
    const picked = [];
    const seenLines = new Set();
    for (const f of FILE_PRIORITY) {
      for (const { file, line } of ctx) {
        if (file !== f || seenLines.has(line)) continue;
        seenLines.add(line);
        picked.push(`- (${file}) ${line.slice(0, 200)}`);
        if (picked.length >= 8) break;
      }
      if (picked.length >= 8) break;
    }
    fullContent = picked.length ? picked.join('\n') : '';
  }

  // 结构化：定义行 + 引用上下文 + 关联卡钩子 + 家族推断（保证 L3 信息量）
  const proseLen = fullContent.replace(/^-\s*\([^)]*\)\s*/gm, '').replace(/\s/g, '').length;
  const parts = [];
  // M 线无锚点条目在下方 V5 块中给出"素材未定义"完整声明，此处不再推"它是什么"式空转开头
  if (name && name.length < 60 && !(/^M\d{1,2}$/.test(code) && mLinePool.length)) parts.push(`**它是什么**：${name}（${cat}）。`);
  if (fullContent) parts.push(`**素材中的引用上下文**：\n${fullContent}`);
  if (mentions.length) {
    const hooks = mentions
      .slice(0, 3)
      .map((id) => {
        const c = allCards.find((x) => x.id === id);
        return c && c.memoryHook ? `【${id}】${c.memoryHook}` : null;
      })
      .filter(Boolean);
    if (hooks.length) parts.push(`**关联卡记忆钩子**（素材原文）：\n${hooks.join('\n')}`);
  }
  if (proseLen < 100) {
    // M 线无锚点条目（V5 修复 F-03）：不再铺 27 句主题池全文（答非所问），
    // 改为"M 素材未定义"明确声明 + 有锚点编号清单 + 用户自补入口提示
    if (/^M\d{1,2}$/.test(code) && mLinePool.length) {
      parts.push(
        [
          `**${code} · 素材未定义**（素材只提供编号引用，未提供内容）`,
          '',
          '【素材边界说明（V5 复核）】素材的 M 线"核心"（Prompt 管理线行）仅提供 27 个主题分句，未提供 M1–M35 的逐条编号对应；且本编号在素材全文中出现 0 次（无引用、无卡片挂钩）。经挂钩锚点与主题句逐字核对（M15↔"极高风险五件套+CL-19"、M34↔"批8三处放松"、M28↔"结构不变量验收"、M31↔"数据下钻边界"），已确认归属的主题句均属有锚点编号，剩余句无法可靠分配到具体编号——**本编号的具体内容，素材中未提供**，需回底层 D 系列文档查证。',
          '',
          '【有明确引用锚点的 M 编号（语义以挂钩卡为准）】M1/M29（X-05）、M2/M21（K-25）、M4/M5/M6（K-23）、M11（X-04）、M12（K-01）、M15（X-06）、M22（X-07）、M23（K-24）、M24/M25/M26（K-26）、M27（K-19/K-33）、M28（K-22）、M31（K-20）、M34（X-08）、M35（K-27/K-31）。',
          '',
          '【补充说明】如果你在底层材料里找到本编号的定义，可在卡片页点"补充说明"记下你的答案，会保存并随进度同步。'
        ].join('\n')
      );
    } else {
      parts.push(FAMILY_NOTE[cat] || `【素材未展开，以下是上下文推断】编号 ${code} 属于${cat}体系，素材中未出现其展开定义，仅在上述上下文/挂钩中出现。面试被问到时先回素材核对，不要引用推断内容作事实。`);
    }
  }
  fullContent = parts.join('\n\n');

  // summary：≥50 字，结构化
  let summary = '';
  if (ctx.length) {
    const first = ctx[0].line.replace(/\*\*/g, '').replace(/^>\s*/, '').replace(/^-\s*\([^)]*\)\s*/, '').slice(0, 120);
    summary = `${code}（${cat}）${name ? '· ' + name : ''}：${first}`;
  } else {
    summary = `编号 ${code} 属于${cat}体系，本素材中仅以编号形式出现，未展开内容。`;
  }
  if (summary.length < 50) {
    summary += (name ? ` 相关卡片：${mentions.join('、') || '无'}；详见 fullContent 与出处。` : ` 素材中未展开，详见 fullContent 的推断说明与出处。`);
  }
  if (summary.length < 50) summary += ' 面试引用前建议回素材核对原文。';

  codes[code] = {
    code,
    category: cat,
    name: name || '',
    summary,
    fullContent,
    sourceFile: sourceFile || (ctx.length ? ctx[0].file : ''),
    sourceAnchor: sourceAnchor || (ctx.length ? `提及于 ${ctx.length} 行` : '未出现'),
    relatedCards: mentions
  };
}

// ---- V6 展示层净化：fullContent 是用户点开看到的，只讲知识 ----
// "**素材原文**（X）：Y" → Y（直接陈述）；行首 "**出处**：Z" → "> 出处：Z"（引用块）
function normalizeDisplayContent(fc) {
  if (!fc) return fc;
  return fc
    .split('\n')
    .map((line) => {
      let t = line.replace(/^\*\*素材原文\*\*（[^）]*）：/, '').replace(/^\*\*素材原文\*\*：/, '');
      t = t.replace(/^\*\*出处\*\*：/, '> 出处：');
      return t;
    })
    .join('\n');
}
for (const c of Object.values(codes)) {
  c.fullContent = normalizeDisplayContent(c.fullContent);
  if (c.summary) c.summary = c.summary.replace(/（面试官 Prompt [^）]*互证[^）]*）/, '');
}

const out = {
  version: 1,
  generatedAt: new Date().toISOString(),
  stats: {
    total: Object.keys(codes).length,
    withName: Object.values(codes).filter((c) => c.name).length,
    unnamed: Object.values(codes).filter((c) => !c.name).length,
    unexpanded: Object.values(codes).filter((c) => c.fullContent.startsWith('【素材未展开】')).length
  },
  codes
};
fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/data/codes.json'), JSON.stringify(out, null, 2));
console.log(`codes.json 生成：共 ${out.stats.total} 条 | 有名称 ${out.stats.withName} | 无名称 ${out.stats.unnamed} | 未展开 ${out.stats.unexpanded}`);

// 抽查
for (const k of ['R21', 'AI-201', 'T-06', 'C15', 'K-16', 'M31', 'CL-19']) {
  const e = codes[k];
  console.log(`--- ${k}: name=${e ? e.name || '(空)' : 'MISSING'} | cards=${e ? e.relatedCards.join(',') : ''}`);
}
