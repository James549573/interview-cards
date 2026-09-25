// 编号补充说明（方案 A）：存于 progress.customNotes，随 Gist 进度自动同步。
// App 订阅 change 事件把写入并入 progress 状态；RefModal 等组件直接读写本模块。
import { storage, KEYS } from './storage';

let cache = {};
const listeners = new Set();

/** App 每次 progress 变化后调用，刷新组件侧缓存 */
export function syncFromProgress(progress) {
  cache = (progress && progress.customNotes) || {};
  listeners.forEach((fn) => fn());
}

export function getNotes() {
  return cache;
}

export function getNote(code) {
  return cache[code] || null;
}

/** 保存某编号的用户补充；App 通过 onChange 收到后并入 progress（持久化 + Gist 同步） */
export function saveNote(code, text) {
  const entry = { text: String(text || '').trim().slice(0, 2000), updatedAt: Date.now() };
  if (!entry.text) return null;
  cache = { ...cache, [code]: entry };
  listeners.forEach((fn) => fn({ type: 'save', code, entry }));
  return entry;
}

/** 删除某编号的补充说明 */
export function deleteNote(code) {
  const next = { ...cache };
  delete next[code];
  cache = next;
  listeners.forEach((fn) => fn({ type: 'delete', code }));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 仅本地兜底读取（App 未挂载时的极端情况） */
export function readFromStorage() {
  return (storage.get(KEYS.progress) || {}).customNotes || {};
}
