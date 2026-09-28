import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { CARDS } from '../lib/cards';
import { buildQueue, applyFeedback, newProgress, formatDuration, formatNextReview, dayKey, DAILY_FAIL_LIMIT } from '../lib/srs';
import { storage, KEYS } from '../lib/storage';
import CardFront from './CardFront.jsx';
import CardBack from './CardBack.jsx';
import FeedbackBar from './FeedbackBar.jsx';

/**
 * 记忆会话 = 队列快照调度：
 * - 进会话时一次性生成队列，答一张移出一张、后面的卡自然补位；
 * - 会话中途新到期的卡只排队，不重排、不插队，绝不顶掉当前正在记的卡；
 * - 同一张卡一个自然日内最多确认 DAILY_FAIL_LIMIT 次「没记住」（模糊/没记住合计），
 *   达到上限自动排到明天 00:00；答「记住了」走正常间隔升级并清零计数。
 */
export default function MemorizeView({ progress, saveProgress, showToast }) {
  const [allowNew, setAllowNew] = useState(() => storage.get(KEYS.allowNew, false));
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [lastFeedback, setLastFeedback] = useState(null); // { id, nextReview, dailyDeferred }
  // 会话队列快照：null = 尚未生成
  const [session, setSession] = useState(null);
  const touchStart = useRef(null);
  // 触摸期间发生移动（滚动/滑动）→ 抑制随后的 click，避免误翻面
  const suppressClick = useRef(false);
  // 始终读最新值，避免 effect 闭包过期
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const allowNewRef = useRef(allowNew);
  allowNewRef.current = allowNew;

  const buildSession = useCallback(() => {
    const ids = buildQueue(CARDS, progressRef.current, Date.now(), allowNewRef.current).map((c) => c.id);
    return { ids, builtAt: Date.now() };
  }, []);

  // 生成/重建会话队列：仅挂载与「学新卡」切换时（用户显式动作），进度与时钟变化不重建
  useEffect(() => {
    storage.set(KEYS.allowNew, allowNew);
    setSession(buildSession());
    setIdx(0);
  }, [allowNew, buildSession]);

  // 定时刷新 now（驱动倒计时显示）；空队列时低频重查新到期卡（如「没记住」5 分钟后回归）
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setSession((s) => {
        if (s && s.ids.length === 0 && Date.now() - s.builtAt >= 30000) return buildSession();
        return s;
      });
    }, 30000);
    return () => clearInterval(t);
  }, [buildSession]);

  const cardById = useMemo(() => {
    const m = {};
    for (const c of CARDS) m[c.id] = c;
    return m;
  }, []);
  const queue = useMemo(
    () => (session ? session.ids.map((id) => cardById[id]).filter(Boolean) : []),
    [session, cardById]
  );
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
    if (!current || !session) return;
    const prev = progress.cards[current.id] || newProgress();
    const next = applyFeedback(prev, feedback);
    saveProgress({ ...progress, cards: { ...progress.cards, [current.id]: next } });
    setLastFeedback({ id: current.id, nextReview: next.nextReview, dailyDeferred: !!next.dailyDeferred });
    // 快照队列：答完的卡移出，剩余卡保持原序补位（当前题号不变=下一张顶上来，无重排）
    const remaining = session.ids.filter((id) => id !== current.id);
    setSession({ ...session, ids: remaining });
    setIdx(remaining.length === 0 ? 0 : Math.min(idx, remaining.length - 1));
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

  // 空闲状态：会话队列耗尽
  if (session && queue.length === 0) {
    const dk = dayKey(now);
    let deferred = 0;
    let nextDue = null;
    for (const c of CARDS) {
      if (c.srs === false) continue;
      const e = progress.cards[c.id];
      if (!e) continue;
      if (e.failCount >= DAILY_FAIL_LIMIT && e.failDay === dk && e.nextReview > now) deferred++;
      if (e.nextReview > now && (!nextDue || e.nextReview < nextDue.nextReview)) {
        nextDue = { ...e, card: c };
      }
    }
    return (
      <div class="pt-16 text-center">
        <div class="text-5xl mb-4">✅</div>
        <h2 class="text-xl font-bold mb-2">今日已完成</h2>
        {deferred > 0 && (
          <p class="text-sm text-amber-600 dark:text-amber-400 mb-2">
            另有 {deferred} 张今天三次没记住的卡，已排到明天
          </p>
        )}
        {nextDue && (
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            下一张（{nextDue.card.id}）{formatDuration(nextDue.nextReview)}到期
          </p>
        )}
        <div class="flex items-center justify-center gap-3">
          {!allowNew && (
            <button
              onClick={() => setAllowNew(true)}
              class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium min-h-[44px]"
            >
              提前学新卡
            </button>
          )}
          <button
            onClick={() => {
              setSession(buildSession());
              setIdx(0);
              setFlipped(false);
              setLastFeedback(null);
            }}
            class="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-medium min-h-[44px]"
          >
            检查新到期
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;
  const feedbackPreview = lastFeedback
    ? (lastFeedback.dailyDeferred
        ? '已连续 3 次没记住，今天先到这，明天再来这张'
        : formatNextReview(lastFeedback.nextReview, now))
    : null;

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
