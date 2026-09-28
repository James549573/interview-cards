#!/usr/bin/env node
/**
 * parse-replay.mjs
 * 从《面试复盘_全景手册.html》（2026-09-27 模拟面试复盘）提取 DATA 数组，
 * 生成 src/data/cards.json —— 整库替换旧卡源（旧 K/T1/X/tech 卡保留在 git 历史中）。
 *
 * 用法：node scripts/parse-replay.mjs
 * 环境变量 REPLAY_HTML 可覆盖手册路径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HTML = 'C:\\Users\\admin\\WorkBuddy\\2026-09-27-16-11-58\\面试复盘_全景手册.html';
const SRC_HTML = process.env.REPLAY_HTML || DEFAULT_HTML;
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'cards.json');

// ---------- 提取手册 DATA ----------
const html = fs.readFileSync(SRC_HTML, 'utf8');
const lines = html.split('\n');
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^const DATA = \[$/.test(lines[i].trim()) && start === -1) start = i;
  else if (start > -1 && /^\];\s*$/.test(lines[i].trim())) { end = i; break; }
}
if (start === -1 || end === -1) throw new Error('未找到 DATA 数组');
const data = new Function(lines.slice(start, end + 1).join('\n') + '; return DATA;')();

// ---------- rel 悬空修复（人工核校表） ----------
const REL_FIX = { 'C12': { 'D6': 'D6-10' } };

// ---------- HTML → Markdown ----------
function htmlToMd(src) {
  let s = src;
  s = s.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n');
  s = s.replace(/<b>/g, '**').replace(/<\/b>/g, '**');
  s = s.replace(/<strong>/g, '**').replace(/<\/strong>/g, '**');
  s = s.replace(/<br\s*\/?>/g, '\n');
  s = s.replace(/<li>/g, '- ').replace(/<\/li>/g, '');
  s = s.replace(/<\/?[uo]l>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/&nbsp;/g, ' ');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 钩子：取答案第一个 <b> 的内容，超长截断
function extractHook(src) {
  const m = src.match(/<b>([\s\S]*?)<\/b>/);
  if (!m) return '';
  const text = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  return text.length > 90 ? text.slice(0, 88) + '…' : text;
}

const PRIO = { 3: 'T0', 2: 'T1', 1: '附录' };

const chapters = [];
const cards = [];
const idSet = new Set();
for (const g of data) for (const c of g.items) idSet.add(c.id);

for (const g of data) {
  chapters.push({ id: g.cat, name: g.title });
  for (const c of g.items) {
    let rel = (c.rel || []).filter((r) => idSet.has(r));
    const fix = REL_FIX[c.id];
    if (fix) {
      for (const [bad, good] of Object.entries(fix)) {
        rel = rel.filter((r) => r !== bad);
        if (idSet.has(good) && !rel.includes(good)) rel.push(good);
      }
    }
    const tags = [PRIO[c.imp] || 'T1'];
    if (g.cat === 'hard') tags.push('红线');
    cards.push({
      id: c.id,
      chapter: g.cat,
      title: c.q,
      questions: [c.q],
      answerMarkdown: htmlToMd(c.a),
      memoryHook: extractHook(c.a),
      tags,
      source: '',
      redline: g.cat === 'hard',
      priority: PRIO[c.imp] || 'T1',
      related: rel,
      srs: true
    });
  }
}

const out = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sourceDir: SRC_HTML,
  chapters,
  cards
};

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log(`已生成 ${OUT_FILE}`);
console.log(`章节 ${chapters.length} 个，卡片 ${cards.length} 张`);
const pr = {};
for (const c of cards) pr[c.priority] = (pr[c.priority] || 0) + 1;
console.log('priority 分布:', pr);
