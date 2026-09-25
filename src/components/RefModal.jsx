import { lookupCode } from '../lib/codes';

export default function RefModal({ code, onClose }) {
  if (!code) return null;
  const entry = lookupCode(code);
  return (
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div class="absolute inset-0 bg-black/50" />
      <div
        class="relative w-full sm:max-w-lg max-h-[75vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-5 m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono text-sm">{code}</span>
              {entry && <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">{entry.category}</span>}
            </div>
            <h3 class="text-base font-bold mt-2">
              {entry ? entry.name || '⚠ 名称未定义（素材未展开）' : '⚠ 编号未收录'}
            </h3>
          </div>
          <button
            onClick={onClose}
            class="shrink-0 w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-lg"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        {entry ? (
          <>
            <div class="text-sm text-gray-600 dark:text-gray-300 mb-3">{entry.summary}</div>
            <div class="text-sm whitespace-pre-wrap border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-1 mb-3 md-body">
              {entry.fullContent}
            </div>
            <div class="text-xs text-gray-400 space-y-1">
              <div>出处：{entry.sourceFile || '未知'}{entry.sourceAnchor ? ` · ${entry.sourceAnchor}` : ''}</div>
              {entry.relatedCards && entry.relatedCards.length > 0 && (
                <div>关联卡片：{entry.relatedCards.join('、')}</div>
              )}
            </div>
          </>
        ) : (
          <div class="text-sm text-gray-500">该编号未在 codes.json 中登记，请到素材中手动检索。</div>
        )}
      </div>
    </div>
  );
}
