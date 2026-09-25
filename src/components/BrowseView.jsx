import { useState, useMemo } from 'preact/hooks';
import { CARDS, CHAPTERS, CHAPTER_MAP } from '../lib/cards';
import { todayStats, upcomingDays, newProgress } from '../lib/srs';
import { marked } from 'marked';
import { annotateCodes } from '../lib/codes';
import RefModal from './RefModal.jsx';

export default function BrowseView({ filter, setFilter }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [refCode, setRefCode] = useState(null);

  const shown = useMemo(() => {
    let out = CARDS;
    if (filter.chapter) out = out.filter((c) => c.chapter === filter.chapter);
    if (filter.tags && filter.tags.length) out = out.filter((c) => filter.tags.every((t) => c.tags.includes(t)));
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.answerMarkdown.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(q)) ||
          (c.source || '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [filter, query]);

  function onBodyClick(e) {
    const badge = e.target.closest('.ref-badge');
    if (badge) setRefCode(badge.dataset.code);
  }

  const toggleTag = (t) => {
    const tags = filter.tags.includes(t) ? filter.tags.filter((x) => x !== t) : [...filter.tags, t];
    setFilter({ ...filter, tags });
  };

  return (
    <div class="pt-4">
      {/* 章节筛选 */}
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2">
        <button
          onClick={() => setFilter({ ...filter, chapter: null })}
          class={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
            !filter.chapter ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          全部
        </button>
        {CHAPTERS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setFilter({ ...filter, chapter: filter.chapter === ch.id ? null : ch.id })}
            class={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              filter.chapter === ch.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {ch.name}
          </button>
        ))}
      </div>
      {/* 标签筛选 */}
      <div class="flex gap-1.5 flex-wrap mb-2">
        {['T0', 'T1', '准T0', '技术', '管理', 'FDE', '合规', '红线', '附录'].map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            class={`px-2.5 py-1 rounded-full text-xs ${
              filter.tags.includes(t)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {/* 搜索 */}
      <input
        type="search"
        value={query}
        onInput={(e) => setQuery(e.currentTarget.value)}
        placeholder="搜索标题 / 全文 / 编号…"
        class="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base"
      />
      <div class="text-xs text-gray-400 mb-2">{shown.length} 张卡</div>
      {/* 卡片列表 */}
      <div class="space-y-2 pb-4">
        {shown.map((c) => (
          <div key={c.id} class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              class="w-full text-left px-4 py-3 flex items-center gap-2 flex-wrap hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-mono shrink-0">{c.id}</span>
              <span class="font-medium text-sm flex-1">{c.title}</span>
              {c.redline && <span class="px-1.5 py-0.5 rounded bg-red-600 text-white text-xs shrink-0">红线</span>}
              {c.tier === 'B' && <span class="px-1.5 py-0.5 rounded bg-amber-500 text-white text-xs shrink-0">索引卡</span>}
              {c.tags.map((t) => (
                <span key={t} class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-300 shrink-0">
                  {t}
                </span>
              ))}
            </button>
            {expanded === c.id && <ExpandedBody card={c} onBodyClick={onBodyClick} />}
          </div>
        ))}
      </div>
      {refCode && <RefModal code={refCode} onClose={() => setRefCode(null)} />}
    </div>
  );
}

function ExpandedBody({ card, onBodyClick }) {
  const { html: annotated } = useMemo(() => annotateCodes(card.answerMarkdown), [card]);
  const html = useMemo(() => marked.parse(annotated), [annotated]);
  return (
    <div class="px-4 pb-4">
      {card.memoryHook && (
        <div class="mb-3 border-l-4 border-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-r text-sm">
          <span class="text-yellow-600 dark:text-yellow-400 font-semibold">记忆钩子：</span>
          {card.memoryHook}
        </div>
      )}
      <div class="md-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
