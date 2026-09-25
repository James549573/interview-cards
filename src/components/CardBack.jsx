import { useMemo, useState } from 'preact/hooks';
import { marked } from 'marked';
import { CHAPTER_MAP } from '../lib/cards';
import { buildTemplate, copyText } from '../lib/clipboard';
import { annotateCodes } from '../lib/codes';
import RefModal from './RefModal.jsx';

export default function CardBack({ card, onNextReviewPreview, onFlipBack }) {
  const [refCode, setRefCode] = useState(null);
  const { html: annotated } = useMemo(() => annotateCodes(card.answerMarkdown), [card]);
  const html = useMemo(() => marked.parse(annotated), [annotated]);

  // 事件委托：点击编号徽章弹出面板
  function onBodyClick(e) {
    const badge = e.target.closest('.ref-badge');
    if (badge) {
      e.stopPropagation();
      setRefCode(badge.dataset.code);
    }
  }

  async function copyVerify(e) {
    e.stopPropagation();
    const ok = await copyText(buildTemplate(card, CHAPTER_MAP[card.chapter]));
    alert(ok ? '已复制，去 DeepSeek 粘贴提问' : '复制失败，请手动选择文本复制');
  }

  return (
    <div class="flex-1 flex flex-col bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-2xl shadow-md p-5">
      {card.memoryHook && (
        <div class="mb-4 border-l-4 border-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-r">
          <div class="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-0.5">记忆钩子</div>
          <div class="text-sm font-medium">{card.memoryHook}</div>
        </div>
      )}
      <div class="md-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
      <div class="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={copyVerify}
          class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm min-h-[44px]"
        >
          📋 复制查证模板
        </button>
        {onFlipBack && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFlipBack();
            }}
            class="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm min-h-[44px]"
          >
            ↩ 看问题
          </button>
        )}
        {onNextReviewPreview && <span class="text-xs text-gray-400">{onNextReviewPreview}</span>}
      </div>
      {refCode && <RefModal code={refCode} onClose={() => setRefCode(null)} />}
    </div>
  );
}
