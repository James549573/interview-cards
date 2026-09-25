import { useMemo } from 'preact/hooks';
import { CARDS, CHAPTERS, CHAPTER_MAP } from '../lib/cards';
import { newProgress, todayStats, upcomingDays, INTERVALS } from '../lib/srs';

export default function StatsView({ progress }) {
  const stats = useMemo(() => {
    const srsCards = CARDS.filter((c) => c.srs !== false);
    const store = progress.cards || {};
    const counts = { known: 0, fuzzy: 0, forgotten: 0, new: 0 };
    const byChapter = {};
    for (const c of srsCards) {
      const e = store[c.id] || newProgress();
      counts[e.status === 'learning' ? 'new' : e.status] = (counts[e.status === 'learning' ? 'new' : e.status] || 0) + 1;
      const ch = (byChapter[c.chapter] = byChapter[c.chapter] || { total: 0, known: 0 });
      ch.total++;
      if (e.status === 'known') ch.known++;
    }
    const t = todayStats(CARDS, progress);
    const upcoming = upcomingDays(CARDS, progress);
    return { srsCount: srsCards.length, counts, byChapter, today: t, upcoming };
  }, [progress]);

  const total = stats.srsCount;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  const TILES = [
    { label: '已掌握', value: stats.counts.known, cls: 'text-green-500' },
    { label: '模糊', value: stats.counts.fuzzy, cls: 'text-yellow-500' },
    { label: '没记住', value: stats.counts.forgotten, cls: 'text-red-500' },
    { label: '新卡', value: stats.counts.new, cls: 'text-blue-500' }
  ];

  return (
    <div class="pt-4 space-y-6">
      <div>
        <div class="text-sm text-gray-400 mb-2">共 {total} 张参与调度的卡（附录 4 张参考卡不参与）</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TILES.map((t) => (
            <div key={t.label} class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-3 text-center">
              <div class={`text-2xl font-bold ${t.cls}`}>{t.value}</div>
              <div class="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-orange-500">{stats.today.due}</div>
            <div class="text-xs text-gray-400 mt-1">今日剩余到期</div>
          </div>
          <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-green-500">{stats.today.reviewed}</div>
            <div class="text-xs text-gray-400 mt-1">今日已复习</div>
          </div>
        </div>
      </div>

      <div>
        <h3 class="font-bold mb-2">按章节掌握度</h3>
        <div class="space-y-2">
          {CHAPTERS.filter((ch) => stats.byChapter[ch.id]).map((ch) => {
            const s = stats.byChapter[ch.id];
            const p = s.total ? Math.round((s.known / s.total) * 100) : 0;
            return (
              <div key={ch.id}>
                <div class="flex justify-between text-xs mb-1">
                  <span>{ch.name}</span>
                  <span class="text-gray-400">
                    {s.known}/{s.total}
                  </span>
                </div>
                <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div class="h-full bg-green-500 rounded-full" style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 class="font-bold mb-2">未来 7 天到期</h3>
        <div class="grid grid-cols-7 gap-1 text-center">
          {stats.upcoming.map((n, i) => (
            <div key={i} class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-lg py-2">
              <div class="text-[10px] text-gray-400">{i === 0 ? '今天' : `+${i}天`}</div>
              <div class={`font-bold ${n > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
