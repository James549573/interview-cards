// 终审检查：对 6 组修订稿做结构/禁词/数字保全三道关
// 用法: node scripts/check-rewrite.mjs
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const groups = [1, 2, 3, 4, 5, 6];

// 载入修订稿与原卡
const rewrites = [];
const workByGroup = {};
for (const g of groups) {
  workByGroup[g] = JSON.parse(fs.readFileSync(path.join(root, 'rewrite-out', `work-group${g}.json`), 'utf8'));
  for (const item of JSON.parse(fs.readFileSync(path.join(root, 'rewrite-out', `group${g}.json`), 'utf8'))) {
    rewrites.push({ ...item, _group: g });
  }
}

const problems = [];
const K_SECTIONS = ['【项目位置】', '【当时约束】', '【选择与取舍】', '【不这么选会怎样】', '【面试官会从哪追问】', '【一句话记忆钩子】'];
const X_SECTIONS = ['【简历位置】', '【技术要点】', '【生产实践】', '【面试官会从哪追问】', '【记忆钩子】'];
const T1_SECTIONS = ['## 它是什么', '## 为什么这么做', '## 面试会怎么问', '## 关联的完整决策'];
// 硬禁词：任何语境都不允许
const HARD_BANNED = ['素材', '定位说明', '互证', '最长公共子串', '登记行', '仅此一句', '附录 U', '原表', '已由已知挂钩', '该知识点属于'];
// "材料"只在指代素材文档时禁止（招生材料/申请材料/汇报材料是合法业务名词）
const MATERIAL_RE = /材料(给|侧|未|中|明确|只|原文|缺口|写得|出处|以|里)/;
// 软禁词：单独报告人工判断（"文档"可能出现在合法技术语境，如"文档解析"）
const SOFT_BANNED = ['文档'];

// 数字/编号保全：从原卡提取 token，检查新稿
const tokenRe = /\d+(?:\.\d+)?(?:\s*(?:ms|s|万|个|张|条|次|%|倍|月|天|件|库|表|列|页|批|pp))?|[A-Z]{1,4}-?\d+(?:\.\d+)?/g;

for (const item of rewrites) {
  const { id, answerMarkdown } = item;
  const orig = workByGroup[item._group].find((c) => c.id === id);
  if (!orig) { problems.push(`${id}: 原卡缺失`); continue; }

  // 1. 结构
  const secs = id.startsWith('K-') ? K_SECTIONS : id.startsWith('X-') ? X_SECTIONS : id.startsWith('T1-') ? T1_SECTIONS : null;
  if (secs) {
    const missing = secs.filter((s) => !answerMarkdown.includes(s));
    if (missing.length) problems.push(`${id}: 结构缺失 ${missing.join(' ')}`);
  }

  // 2. 禁词
  for (const w of HARD_BANNED) {
    if (answerMarkdown.includes(w)) problems.push(`${id}: 禁词「${w}」`);
  }
  if (MATERIAL_RE.test(answerMarkdown)) problems.push(`${id}: 禁词「材料+指代模式」`);
  // 出错位置提示
  if (MATERIAL_RE.test(answerMarkdown)) {
    const m = answerMarkdown.match(MATERIAL_RE);
    const i = answerMarkdown.indexOf(m[0]);
    problems.push(`${id}: 「材料」上下文 → …${answerMarkdown.slice(Math.max(0, i - 25), i + 35).replace(/\n/g, ' ')}…`);
  }
  for (const w of SOFT_BANNED) {
    if (answerMarkdown.includes(w)) problems.push(`${id}: 软禁词「${w}」（人工确认）`);
  }

  // 3. 数字/编号保全（原卡有、新稿无 = 丢失）
  const origTokens = new Set((orig.answerMarkdown || '').match(tokenRe) || []);
  const newTxt = answerMarkdown;
  const lost = [];
  for (const t of origTokens) {
    const bare = t.replace(/[^0-9A-Za-z.-]/g, '');
    if (!bare || bare.length < 2) continue;
    // 跳过纯列表序号（行首 1. 2. 3.）与常见格式噪声
    if (/^\d+\.$/.test(t)) continue;
    if (!newTxt.includes(bare) && !newTxt.includes(t)) lost.push(t);
  }
  if (lost.length) problems.push(`${id}: 数字/编号丢失 → ${lost.slice(0, 10).join(' | ')}`);
}

// 汇总
console.log(`终审检查：${rewrites.length} 张卡`);
if (!problems.length) {
  console.log('✓ 全部通过：结构完整、硬禁词清零、数字/编号保全');
} else {
  console.log(`✗ ${problems.length} 条问题：`);
  problems.forEach((p) => console.log('  ' + p));
}
