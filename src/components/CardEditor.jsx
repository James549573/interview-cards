// 卡片内容编辑器（模态）：编辑标题 / 记忆钩子 / 正文（Markdown 源码）
import { useState } from 'preact/hooks';
import { saveEdit, resetEdit, getEdit, getPristine, isStale } from '../lib/cardEdits';

export default function CardEditor({ card, onClose }) {
  const edit = getEdit(card.id);
  const p = getPristine(card.id);
  const stale = isStale(card.id);
  const [title, setTitle] = useState(card.title);
  const [memoryHook, setMemoryHook] = useState(card.memoryHook || '');
  const [answer, setAnswer] = useState(card.answerMarkdown);
  const [showNew, setShowNew] = useState(false);

  function save() {
    saveEdit(card.id, { title, memoryHook, answerMarkdown: answer });
    alert('已保存，将自动同步到云端（Gist）');
    onClose();
  }

  function rebase() {
    if (!confirm('放弃当前修改，改用新版原文重新编辑？')) return;
    resetEdit(card.id);
    setTitle(p.title);
    setMemoryHook(p.memoryHook || '');
    setAnswer(p.answerMarkdown);
    setShowNew(false);
  }

  function restore() {
    if (!confirm('确定还原这张卡为原版？当前修改将被删除。')) return;
    resetEdit(card.id);
    setTitle(p.title);
    setMemoryHook(p.memoryHook || '');
    setAnswer(p.answerMarkdown);
    alert('已还原为原版');
  }

  return (
    <div class="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkborder rounded-2xl shadow-xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="px-5 pt-4 pb-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-mono shrink-0">{card.id}</span>
            <span class="font-bold text-sm truncate">编辑内容</span>
            {edit && <span class="px-1.5 py-0.5 rounded bg-amber-500 text-white text-xs shrink-0">已修改</span>}
          </div>
          <button onClick={onClose} class="px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm shrink-0">
            ✕
          </button>
        </div>
        <div class="px-5 pb-5 space-y-3">
          {stale && (
            <div class="border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2 rounded-r text-sm">
              <div class="font-semibold text-amber-600 dark:text-amber-400 mb-1">⚠ 数据源已更新</div>
              <div class="text-gray-600 dark:text-gray-300">
                这张卡的线上原版在你上次修改之后更新过，你的修改基于旧版原文。你的修改不会被覆盖，可选择：
              </div>
              <div class="flex flex-wrap gap-2 mt-2">
                <button onClick={rebase} class="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs">
                  改用新版原文重新编辑
                </button>
                <button
                  onClick={() => setShowNew(!showNew)}
                  class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-xs"
                >
                  {showNew ? '收起新版原文' : '查看新版原文'}
                </button>
              </div>
              {showNew && (
                <pre class="mt-2 p-2 rounded bg-gray-100 dark:bg-gray-900 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{p.answerMarkdown}</pre>
              )}
            </div>
          )}
          <div>
            <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">标题</label>
            <input
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div>
            <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">记忆钩子（可选）</label>
            <input
              value={memoryHook}
              onInput={(e) => setMemoryHook(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div>
            <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">正文（Markdown 源码）</label>
            <textarea
              value={answer}
              onInput={(e) => setAnswer(e.currentTarget.value)}
              rows="14"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono leading-relaxed"
            />
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            {edit && (
              <button onClick={restore} class="px-3 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white text-sm min-h-[44px]">
                还原原版
              </button>
            )}
            <button
              onClick={onClose}
              class="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm min-h-[44px]"
            >
              取消
            </button>
            <button onClick={save} class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm min-h-[44px]">
              保存修改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
