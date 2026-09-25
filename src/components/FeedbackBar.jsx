const BTN = [
  { id: 'known', label: '已记住', cls: 'bg-green-600 hover:bg-green-700' },
  { id: 'fuzzy', label: '模糊', cls: 'bg-yellow-500 hover:bg-yellow-600' },
  { id: 'forgotten', label: '没记住', cls: 'bg-red-600 hover:bg-red-700' }
];

export default function FeedbackBar({ visible, onFeedback, nextReviewPreview }) {
  if (!visible) return null;
  return (
    <div class="fixed bottom-0 left-0 right-0 z-40 bg-lightcard/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-darkborder safe-bottom">
      <div class="max-w-3xl mx-auto px-4 py-3">
        {nextReviewPreview && <div class="text-center text-xs text-gray-400 mb-2">{nextReviewPreview}</div>}
        <div class="grid grid-cols-3 gap-2">
          {BTN.map((b) => (
            <button
              key={b.id}
              onClick={() => onFeedback(b.id)}
              class={`${b.cls} text-white rounded-xl py-3 text-base font-medium min-h-[48px]`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
