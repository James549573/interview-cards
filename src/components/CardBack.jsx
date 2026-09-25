import { useMemo } from 'preact/hooks';
import { marked } from 'marked';
import { CHAPTER_MAP } from '../lib/cards';
import { buildTemplate, copyText } from '../lib/clipboard';

export default function CardBack({ card, onNextReviewPreview }) {
  const html = useMemo(() => marked.parse(card.answerMarkdown), [card]);

  async function copyVerify(e) {
    e.stopPropagation();
    const ok = await copyText(buildTemplate(card, CHAPTER_MAP[card.chapter]));
    alert(ok ? '已复制，去 DeepSeek 粘贴提问' : '复制失败，请手动选择文本复制');
  }

  return (
    <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-2xl shadow-md p-5">
      {card.memoryHook && (
        <div class="mb-4 border-l-4 border-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-r">
          <div class="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-0.5">记忆钩子</div>
          <div class="text-sm font-medium">{card.memoryHook}</div>
        </div>
      )}
      <div class="md-body" dangerouslySetInnerHTML={{ __html: html }} />
      <div class="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={copyVerify}
          class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm min-h-[44px]"
        >
          📋 复制查证模板
        </button>
        {onNextReviewPreview && <span class="text-xs text-gray-400">{onNextReviewPreview}</span>}
      </div>
    </div>
  );
}
