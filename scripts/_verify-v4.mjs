// V4 验证取证脚本（可复跑）：六项验证任务的原文证据提取
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => fs.readFileSync(path.join(root, 'source', f), 'utf8');
const out = [];
const P = (...a) => out.push(a.join(' '));

// ---------- V-01: Prompt R 线 21 句枚举 ----------
const prompt = src('面试官Prompt_可直接复制.md');
const rLine = prompt.split('\n').find(l => l.startsWith('[') && l.includes('越权召回'));
// R 线行以 "[" 开头（枚举体），需准确定位
const lines = prompt.split('\n');
const rHead = lines.findIndex(l => l.includes('RAG 全流程线（R1–R21）核心'));
const rBody = lines[rHead + 1];

P('====== V-01.A Prompt R 线枚举整行原文 ======');
P(rBody);
P('');
P('====== V-01.B 按 "；" 与 "。" 切分后的分句（编号 1..N） ======');
const rSents = rBody.replace(/^\[|\]$/g, '').split(/；|。/).map(s => s.trim()).filter(Boolean);
rSents.forEach((s, i) => P(`${i + 1}. ${s}`));
P(`共 ${rSents.length} 句`);
P('');

// ---------- V-01: M 线枚举（供 V-02/V-03/V-04 用） ----------
const mHead = lines.findIndex(l => l.includes('管理/交付线（M1–M35）核心') || l.includes('管理线（M'));
P('====== V-01.C M 线枚举整行原文（定位行号 ' + (mHead + 1) + '） ======');
if (mHead >= 0) {
  P(lines[mHead]);
  P('');
  const mBody = lines[mHead + 1];
  const mSents = mBody.replace(/^\[|\]$/g, '').split(/；|。/).map(s => s.trim()).filter(Boolean);
  P('====== V-01.D M 线分句（编号 1..N） ======');
  mSents.forEach((s, i) => P(`${i + 1}. ${s}`));
  P(`共 ${mSents.length} 句`);
}
P('');

// ---------- V-01: code-knowledge.mjs 中 R21 内容 ----------
const ck = src('../scripts/code-knowledge.mjs').toString ? null : null;
const ckText = fs.readFileSync(path.join(root, 'scripts', 'code-knowledge.mjs'), 'utf8');
const r21Idx = ckText.indexOf("'R21'");
const r21Block = ckText.slice(r21Idx, r21Idx + 4000);
P('====== V-01.E code-knowledge.mjs R21 条目（前 4000 字符） ======');
P(r21Block);
P('');

// ---------- V-03: codes.json 中 M8 条目 ----------
const codes = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'codes.json'), 'utf8')).codes);
const m8 = codes.find(c => c.code === 'M8');
P('====== V-03.A codes.json M8 完整条目 ======');
P(JSON.stringify(m8, null, 2));
P('');

const m27 = codes.find(c => c.code === 'M27');
P('====== V-04.A codes.json M27 完整条目 ======');
P(JSON.stringify(m27, null, 2));
P('');

// ---------- V-02: 当前"家族命名"条目清单（name 或 fullContent 含未展开/未单独/未逐条 标记） ----------
P('====== V-02.A 当前 codes.json 中名称含"未"标记的条目 ======');
const fam = codes.filter(c => /未展开|未单独|未逐条|未定义|未披露|未提供/.test(c.name || ''));
fam.forEach(c => P(`${c.code} | ${c.name} | fullContent 长度=${(c.fullContent || '').length}`));
P(`共 ${fam.length} 条`);
P('');

// ---------- V-05: K-29 素材原文（03 文件 + 合并版） ----------
for (const f of ['03_三体预演与新增知识点.md', '面试官证据源包_T0核心合并版.md']) {
  const t = src(f);
  const ls = t.split('\n');
  const st = ls.findIndex(l => l.startsWith('### K-29'));
  if (st < 0) { P(`====== V-05 ${f}: 未找到 K-29 章节 ======`); continue; }
  let en = st + 1;
  while (en < ls.length && !ls[en].startsWith('### ')) en++;
  const seg = ls.slice(st, en);
  const segText = seg.join('\n');
  P(`====== V-05.B ${f} K-29 章节（行 ${st + 1}~${en}，共 ${seg.length} 行） ======`);
  P(segText);
  const charsNoWs = segText.replace(/\s/g, '').length;
  P(`[该章节去空白字符数 = ${charsNoWs}]`);
  P('');
}

// ---------- V-05: cards.json K-29 ----------
const cards = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'cards.json'), 'utf8')).cards;
const k29 = cards.find(c => c.id === 'K-29');
P('====== V-05.C cards.json K-29 完整条目 ======');
P(JSON.stringify(k29, null, 2));
P(`[answerMarkdown 字数（含空白）= ${(k29.answerMarkdown || '').length}，去空白 = ${(k29.answerMarkdown || '').replace(/\s/g, '').length}]`);
P('');

// ---------- V-06: G 系列全文搜索 ----------
P('====== V-06.A G1~G10 在全部素材中的出现（逐行） ======');
const srcFiles = fs.readdirSync(path.join(root, 'source')).filter(f => f.endsWith('.md'));
for (let g = 1; g <= 10; g++) {
  const patterns = [`G-${g}`, `G${g}`];
  P(`---- G${g} ----`);
  for (const f of srcFiles) {
    const ls = src(f).split('\n');
    ls.forEach((l, i) => {
      for (const pat of patterns) {
        // G 编号边界：后面不能跟数字
        const re = new RegExp(pat + '(?![0-9])');
        if (re.test(l)) { P(`${f}:${i + 1}: ${l.trim().slice(0, 300)}`); break; }
      }
    });
  }
}
P('');

// ---------- V-02/V-03: M 线 27 句主题池在 codes.json 中的注入情况 ----------
P('====== V-02.B 无锚点 M 条目的 fullContent 前 600 字符（抽查 M8） ======');
if (m8) P((m8.fullContent || '').slice(0, 600));

fs.writeFileSync(path.join(root, '_verify-v4-output.txt'), out.join('\n'), 'utf8');
console.log('written _verify-v4-output.txt, lines=' + out.length);
