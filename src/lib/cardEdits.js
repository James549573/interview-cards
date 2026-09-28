// 卡片内容修改（用户侧编辑）：存于 progress.cardEdits，随 Gist 进度自动同步。
// 应用方式：原地覆盖 CARDS 中对应卡片的 title / memoryHook / answerMarkdown，
// 全站（浏览、检索、复习、SRS）无需 prop 透传即可生效。
import { useState, useEffect } from 'preact/hooks';
import { CARDS } from './cards';

let cache = {};
const changeListeners = new Set(); // App 订阅：收到 {type,id,entry} 后并入 progress
const revListeners = new Set(); // 组件订阅：任何应用动作后触发重渲染
let rev = 0;

// 原版快照（模块加载时固定），用于"还原原版"
const pristine = new Map(
  CARDS.map((c) => [c.id, { title: c.title, answerMarkdown: c.answerMarkdown, memoryHook: c.memoryHook }])
);

// ---- 数据源更新检测 ----
// 保存修改时记录当时原版的指纹 baseHash；每次数据加载后与当前原版指纹比对，
// 不一致说明数据源（cards.json）更新过 → 标记 stale，提示用户重审，绝不静默覆盖用户修改。
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const pristineHash = new Map(
  [...pristine.entries()].map(([id, p]) => [id, hashStr(`${p.title}\u0000${p.memoryHook || ''}\u0000${p.answerMarkdown}`)])
);
const staleSet = new Set();

function hasSourceUpdate(entry, id) {
  if (!entry || !entry.baseHash) return false;
  return entry.baseHash !== pristineHash.get(id);
}

function applyToCards(edits) {
  staleSet.clear();
  for (const c of CARDS) {
    const e = edits[c.id];
    const p = pristine.get(c.id);
    if (e && e.data) {
      c.title = e.data.title != null ? e.data.title : p.title;
      c.answerMarkdown = e.data.answerMarkdown != null ? e.data.answerMarkdown : p.answerMarkdown;
      c.memoryHook = e.data.memoryHook != null ? e.data.memoryHook : p.memoryHook;
      c._edited = true;
      if (hasSourceUpdate(e, c.id)) staleSet.add(c.id);
    } else if (c._edited) {
      c.title = p.title;
      c.answerMarkdown = p.answerMarkdown;
      c.memoryHook = p.memoryHook;
      c._edited = false;
    }
  }
  rev++;
  revListeners.forEach((fn) => fn());
}

/** App 每次 progress 变化后调用：把云端/本地的修改套到卡片数据上 */
export function applyEdits(edits) {
  cache = edits || {};
  applyToCards(cache);
}

export function getEdits() {
  return cache;
}

export function getEdit(id) {
  return cache[id] || null;
}

/** 该卡的修改是否基于旧版原文（数据源已更新过） */
export function isStale(id) {
  return staleSet.has(id);
}

/** 基于旧版原文的修改数量 */
export function staleCount() {
  return staleSet.size;
}

export function getPristine(id) {
  return pristine.get(id) || null;
}

export function revision() {
  return rev;
}

/** 保存某张卡的修改；App 通过 onChange 收到后并入 progress（持久化 + Gist 同步） */
export function saveEdit(id, data) {
  const clean = {};
  if (data.title != null) clean.title = String(data.title).trim();
  if (data.memoryHook != null) clean.memoryHook = String(data.memoryHook).trim();
  if (data.answerMarkdown != null) clean.answerMarkdown = String(data.answerMarkdown);
  const entry = { data: clean, baseHash: pristineHash.get(id), updatedAt: Date.now() };
  cache = { ...cache, [id]: entry };
  applyToCards(cache);
  changeListeners.forEach((fn) => fn({ type: 'save', id, entry }));
  return entry;
}

/** 还原某张卡为原版（删除该卡的修改记录） */
export function resetEdit(id) {
  const next = { ...cache };
  delete next[id];
  cache = next;
  applyToCards(cache);
  changeListeners.forEach((fn) => fn({ type: 'delete', id }));
}

/** 还原全部修改 */
export function resetAllEdits() {
  cache = {};
  applyToCards(cache);
  changeListeners.forEach((fn) => fn({ type: 'resetAll' }));
}

export function onChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function onRev(fn) {
  revListeners.add(fn);
  return () => revListeners.delete(fn);
}

/** 组件侧 hook：修改应用后触发重渲染 */
export function useRev() {
  const [r, setR] = useState(rev);
  useEffect(() => onRev(() => setR(rev)), []);
  return r;
}
