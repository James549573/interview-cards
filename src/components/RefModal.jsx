import { useState, useEffect } from 'preact/hooks';
import { lookupCode } from '../lib/codes';
import { getNote, saveNote, deleteNote, onChange } from '../lib/notes';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 编号补充说明（方案 A）：用户自己的答案，存 progress.customNotes，随 Gist 同步 */
function NoteSection({ code }) {
  const initial = getNote(code);
  const [text, setText] = useState(initial ? initial.text : '');
  const [savedAt, setSavedAt] = useState(initial ? initial.updatedAt : null);
  const [editing, setEditing] = useState(!initial);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    // 同一弹窗生命周期内，其他入口（如多端合并）更新了备注则跟随
    return onChange((evt) => {
      if (evt && evt.type === 'save' && evt.code === code && evt.entry) {
        setSavedAt(evt.entry.updatedAt);
      }
    });
  }, [code]);

  const doSave = () => {
    const entry = saveNote(code, text);
    if (entry) {
      setSavedAt(entry.updatedAt);
      setEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    }
  };

  return (
    <div class="mt-4 border-t border-gray-200 dark:border-gray-600 pt-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="text-xs font-bold text-gray-500 dark:text-gray-300">
          补充说明（你的答案，随进度同步）
        </div>
        {savedAt && !editing && (
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">保存于 {fmtTime(savedAt)}</span>
            <button
              class="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
            <button
              class="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-red-500"
              onClick={() => {
                deleteNote(code);
                setText('');
                setSavedAt(null);
                setEditing(true);
              }}
            >
              删除
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            class="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 min-h-[72px]"
            placeholder={`这个编号在素材里没有定义（或你想记下自己的理解）。\n在这里写下你知道的内容，保存后本地留存并同步到 Gist。`}
            value={text}
            onInput={(e) => setText(e.target.value)}
          />
          <div class="flex gap-2 mt-2">
            <button
              class="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={!text.trim()}
              onClick={doSave}
            >
              保存
            </button>
            {savedAt && (
              <button
                class="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => {
                  setText(getNote(code) ? getNote(code).text : '');
                  setEditing(false);
                }}
              >
                取消
              </button>
            )}
          </div>
        </div>
      ) : (
        <div class="text-sm whitespace-pre-wrap rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-2">
          {text || '（空）'}
          {justSaved && <span class="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已保存并将同步</span>}
        </div>
      )}
    </div>
  );
}

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
        class="relative w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-5 m-0 sm:m-4"
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
        <NoteSection code={code} />
      </div>
    </div>
  );
}
