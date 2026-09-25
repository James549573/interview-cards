import { CHAPTER_MAP } from '../lib/cards';

export default function CardFront({ card }) {
  if (!card) return null;
  const main = card.questions[0];
  const subs = card.questions.slice(1, 5);
  return (
    <div class="flex-1 flex flex-col select-none bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-2xl shadow-md p-5">
      <div class="flex items-center gap-2 flex-wrap text-xs mb-3">
        <span class="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono">{card.id}</span>
        <span class="text-gray-500 dark:text-gray-400">{CHAPTER_MAP[card.chapter]}</span>
        {card.redline && <span class="px-2 py-0.5 rounded-full bg-red-600/90 text-white">红线</span>}
        {card.tags.map((t) => (
          <span key={t} class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {t}
          </span>
        ))}
      </div>
      <h2 class="text-lg font-bold mb-3">{card.title}</h2>
      <p class="text-base font-medium mb-2">{main}</p>
      {subs.length > 0 && (
        <ul class="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-3">
          {subs.map((q, i) => (
            <li key={i}>· {q}</li>
          ))}
        </ul>
      )}
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-auto pt-4 text-center">点击卡片任意位置查看答案</p>
    </div>
  );
}
