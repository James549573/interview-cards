import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { CARDS, CHAPTER_MAP } from '../lib/cards';
import { buildQueue, applyFeedback, newProgress, formatDuration, formatNextReview } from '../lib/srs';
import { storage, KEYS } from '../lib/storage';
import CardFront from './CardFront.jsx';
import CardBack from './CardBack.jsx';
import FeedbackBar from './FeedbackBar.jsx';

export default function MemorizeView({ progress, saveProgress, showToast }) {
  const [allowNew, setAllowNew] = useState(() => storage.get(KEYS.allowNew, false));
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [lastFeedback, setLastFeedback] = useState(null); // { id, nextReview }
  const touchStart = useRef(null);
  // 触摸期间发生移动（滚动/滑动）→ 抑制随后的 click，避免误翻面
  const suppressClick = useRef(false);

  // 定时刷新 now，驱动到期与倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    storage.set(KEYS.allowNew, allowNew);
  }, [allowNew]);

  const queue = useMemo(() => buildQueue(CARDS, progress, now, allowNew), [progress, now, allowNew]);
  const current = queue[Math.min(idx, Math.max(0, queue.length - 1))] || null;
  const entry = current ? progress.cards[current.id] || newProgress() : null;

  const goNext = useCallback(() => {
    setFlipped(false);
    setLastFeedback(null);
    setIdx((i) => i + 1);
  }, []);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setLastFeedback(null);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // 键盘：Space 翻面 / 1 已记住 / 2 模糊 / 3 没记住 / ← 上一题 / → 下一题
  useEffect(() => {
    function onKey(e) {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (flipped && current) {
        if (e.key === '1') handleFeedback('known');
        else if (e.key === '2') handleFeedback('fuzzy');
        else if (e.key === '3') handleFeedback('forgotten');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleFeedback(feedback) {
    if (!current) return;
    const prev = progress.cards[current.id] || newProgress();
    const next = applyFeedback(prev, feedback);
    saveProgress({ ...progress, cards: { ...progress.cards, [current.id]: next } });
    setLastFeedback({ id: current.id, nextReview: next.nextReview, label: feedback });
    // 进度更新后队列重建，当前卡移出队列，回到第 0 张
    setIdx(0);
    setFlipped(false);
  }

  // 触摸手势：左右滑切题。竖向滚动不触发任何动作（不再有上滑翻面）。
  // 点击翻面由卡片区域的 onClick 处理，且仅当触摸期间没有移动时生效。
  function onTouchStart(e) {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, moved: false };
  }
  function onTouchMove(e) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - touchStart.current.x) > 10 || Math.abs(t.clientY - touchStart.current.y) > 10) {
      touchStart.current.moved = true;
    }
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const moved = touchStart.current.moved;
    touchStart.current = null;
    // 任何移动（含左右滑）都抑制随后的 click，防止滑动结束被当成点击
    suppressClick.current = moved;
    // 仅横向滑动切题：位移足够大且横向明显占优
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = true;
      if (dx < 0) goNext();
      else goPrev();
    }
  }
  function onCardClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    // 点击卡片任意区域：正面翻到背面；背面不动作（返回问题用专门按钮）
    if (!flipped) setFlipped(true);
  }

  // 空闲状态：无到期且无新卡
  if (queue.length === 0) {
    // 找下一张最近的到期卡
    let nextDue = null;
    for (const c of CARDS) {
      if (c.srs === false) continue;
      const e = progress.cards[c.id];
      if (e && e.nextReview > now && (!nextDue || e.nextReview < nextDue.nextReview)) {
        nextDue = { ...e, card: c };
      }
    }
    return (
      <div class="pt-16 text-center">
        <div class="text-5xl mb-4">✅</div>
        <h2 class="text-xl font-bold mb-2">今日已完成</h2>
        {nextDue && (
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            下一张（{nextDue.card.id}）{formatDuration(nextDue.nextReview)}到期
          </p>
        )}
        {!allowNew && (
          <button
            onClick={() => setAllowNew(true)}
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium min-h-[44px]"
          >
            提前学新卡
          </button>
        )}
      </div>
    );
  }

  if (!current) return null;
  const feedbackPreview = lastFeedback ? formatNextReview(lastFeedback.nextReview, now) : null;

  return (
    <div class="flex-1 flex flex-col min-h-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div class="flex items-center justify-between text-xs text-gray-400 mb-2 shrink-0">
        <span>队列剩余 {Math.max(0, queue.length - idx)} 张</span>
        <label class="flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={allowNew} onChange={(e) => setAllowNew(e.currentTarget.checked)} class="accent-blue-600" />
          学新卡
        </label>
      </div>
      {/* 卡片区域：撑满剩余空间，整片可点 */}
      <div class="flex-1 flex flex-col min-h-0" onClick={onCardClick}>
        {flipped ? (
          <CardBack
            card={current}
            onNextReviewPreview={entry && entry.nextReview > 0 ? formatNextReview(entry.nextReview, now) : null}
            onFlipBack={() => setFlipped(false)}
          />
        ) : (
          <CardFront card={current} />
        )}
      </div>
      <FeedbackBar visible={flipped} onFeedback={handleFeedback} nextReviewPreview={feedbackPreview} />
    </div>
  );
}
