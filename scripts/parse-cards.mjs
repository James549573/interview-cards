#!/usr/bin/env node
/**
 * parse-cards.mjs
 * 解析面试素材 Markdown，生成 src/data/cards.json
 *
 * 事实源优先级：面试官证据源包_T0核心合并版.md 为唯一事实源；
 * 其余分册按序兜底，同 ID 冲突时以先出现（更高优先级文件）为准。
 *
 * 用法：node scripts/parse-cards.mjs
 * 环境变量 INTERVIEW_PREP_DIR 可覆盖素材目录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT as CODE_CONTENT, buildPhraseContent } from './code-knowledge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = 'C:\\Users\\admin\\WorkBuddy\\2026-09-24-22-32-06\\outputs\\interview_prep';
const SRC_DIR = process.env.INTERVIEW_PREP_DIR || DEFAULT_DIR;

// 优先级从高到低
const FILES = [
  '面试官证据源包_T0核心合并版.md',
  '04_T0增补_K34_招生季与年度报名口径.md',
  '03_三体预演与新增知识点.md',
  'T0_模块1_AI410_模块2_AI401.md',
  'T0_模块3_4_5_RAG_合规_管理.md',
  '附录与补充.md'
];

const CHAPTERS = [
  { id: 'mod1', name: '模块1 · AI-410 数据问答' },
  { id: 'mod2', name: '模块2 · AI-401 招生核验' },
  { id: 'mod3', name: '模块3 · RAG 全流程' },
  { id: 'mod4', name: '模块4 · 权限与合规' },
  { id: 'mod5', name: '模块5 · 项目管理与三方协作' },
  { id: 'mod6', name: '模块6 · 三体预演新增' },
  { id: 'mod7', name: '模块7 · 业务口径（K-34）' },
  { id: 'xseries', name: 'X 系列 · 准 T0' },
  { id: 't1index', name: 'T1 速览（索引卡）' },
  { id: 'appendix', name: '附录（参考卡）' }
];

function chapterOf(id) {
  if (id.startsWith('X-')) return 'xseries';
  const n = parseInt(id.replace(/^K-/, ''), 10);
  if (n <= 7) return 'mod1';
  if (n <= 15) return 'mod2';
  if (n <= 18) return 'mod3';
  if (n <= 22) return 'mod4';
  if (n <= 27) return 'mod5';
  if (n <= 33) return 'mod6';
  return 'mod7'; // K-34
}

function priorityOf(id, rawTitle) {
  if (/【T0】/.test(rawTitle)) return 'T0';
  if (/【T1】/.test(rawTitle)) return 'T1';
  if (id.startsWith('X-')) return '准T0';
  return 'T0'; // 合并包口径：K-01 ~ K-29 + K-34 为 T0
}

// ---------- 通用切分 ----------

/** 提取某标题行之后、下一个同层级或更高级标题之前的内容 */
function sliceSection(text, startMatch, level = 2) {
  const start = startMatch.index + startMatch[0].length;
  const re = new RegExp(`^#{${level},${6}}\\s`, 'gm');
  re.lastIndex = start;
  const m = re.exec(text);
  const end = m ? m.index : text.length;
  return text.slice(start, end);
}

function cleanBody(body) {
  // 去掉结尾的 --- 分隔线与多余空行
  return body
    .replace(/\n-{3,}\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- 完整卡解析（K-xx / X-xx） ----------

function parseFullCards(text) {
  const heads = [];
  const re = /^### (K-\d+|X-\d+)\b.*$/gm;
  let m;
  while ((m = re.exec(text))) {
    heads.push({ id: m[1], rawTitle: m[0], start: m.index, bodyStart: re.lastIndex });
  }
  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    let end = text.length;
    if (i + 1 < heads.length) end = heads[i + 1].start;
    // K-34 内部含 ### 小节，用下一个一级标题（# 第X部分）兜底截断
    const rest = text.slice(h.bodyStart, end);
    const h1 = rest.search(/^# /m);
    const body = cleanBody(h1 !== -1 ? rest.slice(0, h1) : rest);
    out.push({ id: h.id, rawTitle: h.rawTitle, body });
  }
  return out;
}

function cleanTitle(rawTitle, id) {
  return rawTitle
    .replace(/^###\s+/, '')
    .replace(/【(已挂钩|半挂钩)[^】]*】/g, '')
    .replace(/【T0】|【T1】/g, '')
    .replace(/★[^★]*/g, '')
    .replace(new RegExp(`^${id}\\s*`), '')
    .trim();
}

function extractSource(rawTitle) {
  const m = rawTitle.match(/【(已挂钩|半挂钩)\s+([^】]+)】/);
  return m ? m[2].trim() : '';
}

function extractStars(rawTitle) {
  const tags = [];
  const re = /★(技术|管理|FDE|合规|红线)/g;
  let m;
  while ((m = re.exec(rawTitle))) if (!tags.includes(m[1])) tags.push(m[1]);
  return tags;
}

/** 把一条追问条目转成干净的问题文本 */
function itemToQuestion(s) {
  let t = s.trim();
  // 优先取引号内的问题
  const qm = t.match(/[“"]([^“”"]{4,120})[”"]/);
  if (qm) return qm[1].trim();
  // 去掉加粗、箭头后的解释
  t = t.split(/→|=>/)[0].replace(/\*\*/g, '').trim();
  return t.length > 3 ? t : null;
}

/** 拆 ①②③ 内联条目 */
function splitCircled(s) {
  if (!/[①②③④⑤⑥⑦⑧]/.test(s)) return [s];
  return s
    .split(/[①②③④⑤⑥⑦⑧]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractQuestions(title, body) {
  const qs = [title];
  const lines = body.split('\n');
  let inBlock = false;
  const push = (raw) => {
    for (const part of splitCircled(raw)) {
      const q = itemToQuestion(part);
      if (q && !qs.includes(q) && qs.length < 6) qs.push(q);
    }
  };
  for (const line of lines) {
    const isHeading = /^#{1,6}\s/.test(line);
    // 段落标记形如 **【当时约束】** / 【面试官会从哪追问】**，只认行首的【，
    // 避免正文条目中包含【构造】等字样时误判（K-34 的追问条目含【构造】）
    const isMarker = /^\*{0,2}【/.test(line);
    if (isHeading || isMarker) {
      inBlock = /面试官会从哪追问/.test(line);
      if (inBlock) {
        // X 系列：追问条目与标记同行（①②③）
        const rest = line.replace(/^.*面试官会从哪追问】\*\*\s*/, '').replace(/^#{1,6}\s[^】]*】?\s*/, '').trim();
        if (rest) push(rest);
      }
      continue;
    }
    if (!inBlock) continue;
    const m = line.match(/^\s*(\d+(?:\.\d+)?)\s*[.、．]\s*(.+)$/);
    if (m) push(m[2]);
  }
  return qs.slice(0, 5);
}

function extractHook(body) {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasBracketMarker = /【(一句话记忆钩子|记忆钩子)】/.test(line);
    const isHookHeading = /^#{1,6}\s/.test(line) && /一句话记忆钩子/.test(line);
    if (!hasBracketMarker && !isHookHeading) continue;
    if (hasBracketMarker) {
      // 同行内联（X 系列）
      const inline = line
        .replace(/^.*【(一句话记忆钩子|记忆钩子)】\*\*\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
      if (inline) return inline;
    }
    // 后续 blockquote
    const buf = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (l.startsWith('>')) buf.push(l.replace(/^>\s?/, '').replace(/\*\*/g, '').trim());
      else if (buf.length || l === '') {
        if (buf.length) break;
      } else break;
    }
    if (buf.length) return buf.join(' ').trim();
  }
  return '';
}

// ---------- T1 索引卡（附录 U 表格） ----------

function sliceSectionAt(text, startMatch) {
  const start = startMatch.index;
  const next = text.slice(start + 1).search(/^## /m);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
}

function parseT1Index(text, hookMap, phraseMap = {}) {
  const m = text.match(/^## 附录 U/m);
  if (!m) return [];
  const section = sliceSectionAt(text, m);
  const cards = [];
  const rowRe = /^\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  let r;
  while ((r = rowRe.exec(section))) {
    const idCell = r[1].trim();
    if (!/^T1-\d+$/.test(idCell)) continue; // 跳过 T1-01~08 与表头
    const name = r[2].trim().replace(/\*\*/g, '');
    const hook = r[3].trim();
    const axis = r[4].trim();
    const stars = [];
    const re = /★(技术|管理|FDE|合规|红线)/g;
    let s;
    while ((s = re.exec(axis))) if (!stars.includes(s[1])) stars.push(s[1]);

    // 通过挂钩编号找到关联的 K/X 卡
    const hookCodes = hook === '见原表' ? [] : hook.split(/[\/、,，]/).map((x) => x.trim());
    const relatedIds = [];
    for (const h of hookCodes) for (const cid of hookMap[h] || []) if (!relatedIds.includes(cid)) relatedIds.push(cid);
    const relatedCards = relatedIds.map((id) => hookMap.__cards[id]).filter(Boolean);

    // 一句话说明（≥50 字）：名称 + 挂钩线 + 关联卡
    const hookStr = hookCodes.join(' / ') || '（无挂钩）';
    const relStr = relatedIds.length ? relatedIds.join('、') : '暂无';

    // ---- 五段式内容（T2-FIX-03）----
    // 段1 它是什么（≥80 字）
    const relTitles = relatedCards.map((c) => `${c.id}（${c.title.slice(0, 40)}）`).join('、');
    let what = `${name}。该知识点属于 T1 档（精简复习），通过挂钩 ${hookStr} 挂靠项目决策线，岗位轴为「${axis.replace(/★/g, '')}」。`;
    if (relTitles) what += `项目中的承载卡：${relTitles}。`;
    if (what.length < 80) what += '此条为 T1 索引表（附录 U）登记行，展开内容以关联卡为准。';

    // 段2 为什么重要 / 面试会怎么问（≥80 字）：关联卡记忆钩子 + 素材追问条目
    const hookLines = relatedCards.map((c) => `【${c.id}】${c.memoryHook || c.title}`).filter((x) => x.length > 8);
    const followUps = relatedCards.flatMap((c) => (c.questions || []).slice(1, 3).map((q) => `「${q}」→ ${c.id}`)).slice(0, 4);
    let why = '';
    if (hookLines.length) why += `为什么重要（关联卡记忆钩子，素材原文）：${hookLines.join('；')}。`;
    if (followUps.length) why += `面试会怎么问（素材追问条目）：${followUps.join('；')}。`;
    if (why.length < 80) why += `本条是面试考察的 T1 档知识点，复习时先过关联卡 ${relStr} 的完整五段式，再回到本条做快速自测。`;

    // 段3 具体做法 / 关键约束（≥100 字）：从关联卡正文提取含挂钩编号的段落与约束段
    const excerpts = [];
    const seenEx = new Set();
    for (const c of relatedCards.slice(0, 2)) {
      if (!c.answerMarkdown) continue;
      const paras = c.answerMarkdown.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      const pick = (p) => {
        const t = p.replace(/^【[^】]+】\*\*/, '').replace(/^【[^】]+】/, '').replace(/^>\s*/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 260);
        if (t.length > 40 && !seenEx.has(t.slice(0, 30))) {
          seenEx.add(t.slice(0, 30));
          excerpts.push(`- （${c.id}）${t}`);
        }
      };
      for (const tag of ['【当时约束】', '【选择与取舍】']) {
        for (const p of paras) if (p.replace(/\*\*/g, '').startsWith(tag)) pick(p);
      }
      for (const p of paras) {
        if (excerpts.length >= 3) break;
        if (!p.startsWith('【') && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('>') && hookCodes.some((h) => p.includes(h))) pick(p);
      }
    }
    // 挂钩编号带有人工核校/互证内容的（如 R21/R6/N19），整段注入
    const curatedBlocks = [];
    for (const h of hookCodes) {
      const cc = CODE_CONTENT[h];
      const ph = phraseMap[h];
      const text = cc && cc.fullContent && cc.fullContent.length > 200 ? cc.fullContent : ph && ph.fullText;
      if (text && text.length > 150) {
        curatedBlocks.push(`**关键约束（据挂钩 ${h}）**：\n${text}`);
      }
    }
    let how = excerpts.length ? `具体做法 / 关键约束（摘自关联卡正文，素材原文）：\n${excerpts.join('\n')}` : '';
    if (how.replace(/\s/g, '').length < 100) {
      how += `${how ? '\n' : ''}【素材未展开本条的单独做法段】T1 索引表仅登记名称与挂钩；具体做法与关键约束请打开关联卡 ${relStr} 查看完整五段式答案（含【项目位置】【当时约束】【选择与取舍】）。`;
    }

    cards.push({
      id: idCell,
      chapter: 't1index',
      title: name,
      questions: [name],
      answerMarkdown: [
        `**知识点**：${name} ｜ **挂钩**：${hook} ｜ **岗位轴**：${axis}`,
        ``,
        `## 它是什么`,
        what,
        ``,
        `## 为什么重要 / 面试会怎么问`,
        why,
        ``,
        `## 具体做法 / 关键约束`,
        how,
        ...curatedBlocks.map((b) => `\n${b}`),
        ``,
        `## 关联跳转`,
        relatedIds.length
          ? `关联卡：${relatedIds.join('、')}（浏览模式点击可展开完整答案）`
          : hookCodes.length
            ? `挂钩 ${hookStr} 在 K 卡体系无独立承载卡；实质内容见上方「关键约束」段，原始登记见附录 U 原表。`
            : '（本条无挂钩，见附录 U 原表）'
      ]
        .join('\n')
        .trim(),
      memoryHook: hookLines.length ? hookLines[0].replace(/^【[^】]+】/, '') : '',
      tags: ['T1', ...stars],
      source: hook === '见原表' ? '' : hook,
      redline: false,
      priority: 'T1',
      related: relatedIds,
      srs: false
    });
  }
  return cards;
}

// ---------- 附录参考卡（A / T / F / H） ----------

function parseAppendices(text) {
  const defs = [
    { id: 'APP-A', title: '附录 A · 数字溯源表', key: /^## 附录 A.*$/m },
    { id: 'APP-T', title: '附录 T · 内部张力清单', key: /^## 附录 T.*$/m },
    { id: 'APP-F', title: '附录 F · 考前 30 分钟扫读卡', key: /^## 附录 F.*$/m },
    { id: 'APP-H', title: '附录 H · 待确认清单', key: /^## 附录 H.*$/m }
  ];
  const cards = [];
  for (const d of defs) {
    const m = text.match(d.key);
    if (!m) continue;
    const body = cleanBody(sliceSection(text, m, 2));
    if (!body) continue;
    cards.push({
      id: d.id,
      chapter: 'appendix',
      title: d.title,
      questions: [d.title],
      answerMarkdown: body,
      memoryHook: '',
      tags: ['附录'],
      source: '',
      redline: false,
      priority: '附录',
      related: [],
      srs: false
    });
  }
  return cards;
}

// ---------- 张力 / 待确认标注（G39/G40） ----------
// 数据源：附录 T（T-06~T-12）与附录 H（C1~C19）表格原文
// 映射依据：任务书指定（K-13↔T-06、K-06↔T-07、K-34↔C15）+ 表格"对象/口径"与卡片主题对齐
const TENSION_HINTS = {
  'K-13': ['T-06', 'C6'],
  'K-06': ['T-07', 'C7'],
  'X-07': ['T-08', 'C8'],
  'K-24': ['T-09'],
  'K-26': ['T-08', 'T-09', 'T-10', 'T-11', 'T-12'],
  'X-01': ['T-10'],
  'K-34': ['C14', 'C15']
};

function buildTensionNotes(text) {
  const notes = {};
  // 附录 T：| T-06 | 张力点 | 两方口径 | 建议答法 |
  let m; const reT = /^\|\s*\*{0,2}(T-\d{2})\*{0,2}\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  while ((m = reT.exec(text))) {
    notes[m[1]] = `> ⚠ **关联张力 ${m[1]}**（附录 T · 内部张力清单，标注于卡片末尾，非答案原文）\n> **${m[2].trim()}**：${m[3].trim()}。\n> **建议答法**：${m[4].trim()}`;
  }
  // 附录 H：| C15 | 情形 | 处置 | 需确认 |
  const reC = /^\|\s*\*{0,2}(C\d{1,2})\*{0,2}\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  while ((m = reC.exec(text))) {
    const clean = (s) => s.replace(/\*{1,2}/g, '').trim();
    notes[m[1]] = `> ⚠ **关联待确认 ${m[1]}**（附录 H · 待确认清单，标注于卡片末尾，非答案原文）\n> **${clean(m[2])}**\n> **处置**：${clean(m[3])} | **需确认**：${clean(m[4])}`;
  }
  return notes;
}

// ---------- 主流程 ----------

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`素材目录不存在：${SRC_DIR}`);
    console.error('请用环境变量 INTERVIEW_PREP_DIR 指定素材目录。');
    process.exit(1);
  }

  const seen = new Map(); // id -> card（先到先得 = 事实源优先）
  let fullCount = 0;
  for (const file of FILES) {
    const p = path.join(SRC_DIR, file);
    if (!fs.existsSync(p)) {
      console.warn(`⚠ 缺少文件，跳过：${file}`);
      continue;
    }
    const text = fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
    for (const c of parseFullCards(text)) {
      if (seen.has(c.id)) continue;
      const title = cleanTitle(c.rawTitle, c.id);
      const stars = extractStars(c.rawTitle);
      const priority = priorityOf(c.id, c.rawTitle);
      const qs = extractQuestions(title, c.body);
      seen.set(c.id, {
        id: c.id,
        chapter: chapterOf(c.id),
        title,
        questions: qs,
        answerMarkdown: c.body,
        memoryHook: extractHook(c.body),
        tags: [priority, ...stars],
        source: extractSource(c.rawTitle) || (c.id === 'K-34' ? 'V16 / V15 / C14 / D25-D13（增补材料，标题无挂钩标注）' : ''),
        redline: stars.includes('红线'),
        priority,
        related: [],
        srs: true
      });
      fullCount++;
    }
  }

  // ---- 挂钩编号 → 卡片 映射（供 T1 补全） ----
  // 只收 K 卡挂钩：K 卡的 R/N/V/I/M 挂钩是 RAG/线决策编号体系（已验证语义）；
  // X 卡的 R/M 挂钩是「三体预演」轮次编号（另一套体系，R22+/R44 等），不并入，防错关联。
  const hookMap = { __cards: {} };
  for (const c of seen.values()) {
    hookMap.__cards[c.id] = c;
    if (!c.id.startsWith('K-')) continue;
    const hooks = (c.source || '').split(/[\/、,，]/).map((s) => s.trim()).filter((s) => /^(R|N|V|I|M)\d{1,2}$/.test(s));
    for (const h of hooks) (hookMap[h] = hookMap[h] || []).push(c.id);
  }

  const factSource = fs.readFileSync(path.join(SRC_DIR, FILES[0]), 'utf8').replace(/\r\n?/g, '\n');
  // 短卡源段字数表（K-29~33 / X-02~06 在素材中的原文长度，供素材说明引用）
  const allSources = FILES.map((f) => path.join(SRC_DIR, f))
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n'));
  const srcLenOf = (id) => {
    for (const t of allSources) {
      const m = t.match(new RegExp('^### ' + id + '[\\s\\S]*?(?=^### |^## |^# )', 'm'));
      if (m) return m[0].length;
    }
    return 0;
  };
  // Prompt 线互证内容（供 T1 挂钩注入实质内容）
  const promptText = fs.existsSync(path.join(SRC_DIR, '面试官Prompt_可直接复制.md'))
    ? fs.readFileSync(path.join(SRC_DIR, '面试官Prompt_可直接复制.md'), 'utf8').replace(/\r\n?/g, '\n')
    : '';
  const t1RowsScan = [];
  {
    const re = /^\|\s*(T1-\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
    let m;
    while ((m = re.exec(factSource))) t1RowsScan.push({ name: m[2].trim().replace(/\*\*/g, ''), hook: m[3].trim() });
  }
  const PHRASE = buildPhraseContent(promptText, t1RowsScan);
  const t1 = parseT1Index(factSource, hookMap, PHRASE);
  const appendix = parseAppendices(factSource);
  for (const c of appendix) c.source = `附录与补充.md · ${c.title}（参考卡，不参与调度）`;
  for (const c of [...t1, ...appendix]) if (!seen.has(c.id)) seen.set(c.id, c);

  // ---- G37: X↔K related（人工内容映射） ----
  // X 卡的 R/M 挂钩是预演轮次编号，与 K 卡的线决策编号不同体系，禁止用挂钩做关联；
  // 以下映射按卡片内容主题人工核对（X-04 选型判据在 K-27 追问、X-03 三级串联在 K-21 正文等）。
  const X_CONTENT_RELATED = {
    'X-01': ['K-04', 'K-01'],
    'X-02': ['K-05'],
    'X-03': ['K-21'],
    'X-04': ['K-27'],
    'X-05': ['K-25', 'K-26'],
    'X-06': ['K-27', 'K-08'],
    'X-07': ['K-27'],
    'X-08': ['K-23', 'K-25']
  };
  for (const c of seen.values()) {
    if (!c.id.startsWith('X-')) continue;
    c.related = [...new Set([...(c.related || []), ...(X_CONTENT_RELATED[c.id] || [])])];
  }

  // ---- G37b: K 卡 related 兜底（K 卡挂钩是线决策编号体系，可安全共享） ----
  for (const c of seen.values()) {
    if (!/^K-/.test(c.id) || (c.related || []).length) continue;
    const hooks = (c.source || '').split(/[\/、,，]/).map((s) => s.trim()).filter((s) => /^(R|N|V|I|M)\d{1,2}$/.test(s));
    const rel = new Set();
    for (const h of hooks) for (const cid of hookMap[h] || []) if (cid !== c.id) rel.add(cid);
    if (rel.size) c.related = [...rel].slice(0, 4);
  }

  // ---- V2: 短卡素材说明（素材本身短的卡：补关联跳转与完整性说明，不编造内容） ----
  for (const c of seen.values()) {
    if (!/^[KX]-/.test(c.id) || (c.answerMarkdown || '').length >= 500) continue;
    const rel = c.related || [];
    const note = [
      ``,
      `---`,
      `**素材说明（V3 逐行核查）**：本卡源段在素材中仅 ${srcLenOf(c.id)} 字（K-29~33 / X-02~06 在素材中即为短段落），以上正文为素材完整原文、逐行比对无删减；本知识点素材未做更长展开。`,
      rel.length ? `**关联卡**：${rel.join('、')}（相关决策线的完整五段式答案，可对照复习）。` : ''
    ]
      .filter(Boolean)
      .join('\n');
    // V5 修复（F-05）：素材段拼接时钩子行与 --- 分隔线粘连（"自述。**---"），补空行恢复分隔
    c.answerMarkdown = c.answerMarkdown.replace(/([^\n])---/g, '$1\n\n---');
    c.answerMarkdown += note;
  }

  // ---- G39/G40: 张力与待确认标注（追加引用块，不改原文） ----
  const tensionNotes = buildTensionNotes(factSource);
  for (const [cardId, notes] of Object.entries(TENSION_HINTS)) {
    const card = seen.get(cardId);
    if (!card) continue;
    const parts = [];
    for (const code of notes) {
      if (tensionNotes[code]) parts.push(tensionNotes[code]);
    }
    if (parts.length) {
      card.answerMarkdown += `\n\n---\n\n${parts.join('\n\n')}\n`;
    }
  }

  const cards = [...seen.values()].sort((a, b) => {
    const order = ['mod1', 'mod2', 'mod3', 'mod4', 'mod5', 'mod6', 'mod7', 'xseries', 't1index', 'appendix'];
    const d = order.indexOf(a.chapter) - order.indexOf(b.chapter);
    if (d !== 0) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const expect = { full: 42, t1: 32, appendix: 4, total: 78 };
  const got = {
    full: cards.filter((c) => /^([KX])-/.test(c.id)).length,
    t1: cards.filter((c) => c.chapter === 't1index').length,
    appendix: cards.filter((c) => c.chapter === 'appendix').length,
    total: cards.length
  };
  for (const k of Object.keys(expect)) {
    if (got[k] !== expect[k]) {
      console.warn(`⚠ ${k} 卡数量 ${got[k]} 与预期 ${expect[k]} 有差距`);
    }
  }

  // ---- V5 修复（F-05）：素材段拼接时钩子行与 --- 分隔线粘连（"自述。**---"）。
  // 生成点在素材段装配深处，统一在写出前对所有卡做一次规范化。
  for (const c of cards) {
    if (c.answerMarkdown) c.answerMarkdown = c.answerMarkdown.replace(/([^\n])---/g, '$1\n\n---');
  }

  const data = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceDir: SRC_DIR,
    chapters: CHAPTERS,
    cards
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'cards.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✓ 解析完成：完整卡 ${got.full} 张，T1 索引卡 ${got.t1} 张，附录卡 ${got.appendix} 张，共 ${got.total} 张`);
  console.log(`✓ 输出：${outPath}`);
  if (got.total < 75) {
    console.error('✗ 卡片总数 < 75，请检查素材目录是否完整。');
    process.exit(2);
  }
}

main();
