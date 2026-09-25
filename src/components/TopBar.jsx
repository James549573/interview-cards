import { useState } from 'preact/hooks';

const VIEWS = [
  { id: 'browse', label: '浏览' },
  { id: 'memorize', label: '记忆' },
  { id: 'stats', label: '统计' },
  { id: 'settings', label: '设置' }
];

const SYNC = {
  idle: { dot: '●', label: '已同步', cls: 'text-green-500' },
  syncing: { dot: '↻', label: '同步中', cls: 'text-blue-500 animate-pulse' },
  error: { dot: '⚠', label: '未同步', cls: 'text-yellow-500' }
};

export default function TopBar({ view, setView, theme, setTheme, syncStatus, dueCount, reviewedCount, onLogout }) {
  const s = SYNC[syncStatus] || SYNC.idle;
  return (
    <header class="sticky top-0 z-40 bg-lightcard/95 dark:bg-darkcard/95 backdrop-blur border-b border-gray-200 dark:border-darkborder">
      <div class="max-w-3xl mx-auto px-3 py-2 flex items-center gap-2 min-w-0">
        <div class="font-bold shrink-0 text-sm sm:text-base">
          <span class="hidden sm:inline">🃏 面试记忆卡</span>
          <span class="sm:hidden">🃏 记忆卡</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
          到期 <span class="font-semibold text-orange-500">{dueCount}</span> / 已复习{' '}
          <span class="font-semibold text-green-500">{reviewedCount}</span>
        </div>
        <div class="flex-1" />
        <span class={`text-xs shrink-0 ${s.cls}`} title={s.label}>
          {s.dot}
          <span class="hidden sm:inline"> {s.label}</span>
        </span>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          class="shrink-0 w-9 h-9 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          title="切换主题"
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </button>
        <button
          onClick={onLogout}
          class="shrink-0 w-9 h-9 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          title="退出登录"
        >
          ⏻
        </button>
      </div>
      <nav class="max-w-3xl mx-auto px-3 pb-1 flex gap-1 overflow-x-auto no-scrollbar">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            class={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              view === v.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
