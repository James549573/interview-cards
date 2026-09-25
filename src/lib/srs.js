// 艾宾浩斯间隔重复调度
// INTERVALS 单位为秒，stage 0 表示新卡
export const INTERVALS = [
  0, // 新卡
  5 * 60, // 5 分钟
  30 * 60, // 30 分钟
  12 * 3600, // 12 小时
  24 * 3600, // 1 天
  2 * 86400,
  4 * 86400,
  7 * 86400,
  15 * 86400,
  30 * 86400,
  60 * 86400,
  120 * 86400
];

export function newProgress(now = Date.now()) {
  return {
    stage: 0,
    status: 'new', // new | known | fuzzy | forgotten
    nextReview: 0,
    lastReview: 0,
    reviews: 0,
    lapses: 0,
    fuzzyCount: 0,
    correctStreak: 0,
    updatedAt: now
  };
}

/**
 * 应用反馈，返回新的进度对象（不修改原对象）
 * @param {'known'|'fuzzy'|'forgotten'} feedback
 */
export function applyFeedback(prev, feedback, now = Date.now()) {
  const p = { ...prev };
  if (feedback === 'known') {
    p.stage = Math.min((p.stage || 0) + 1, INTERVALS.length - 1);
    p.status = 'known';
    p.nextReview = now + INTERVALS[p.stage] * 1000;
    p.correctStreak = (p.correctStreak || 0) + 1;
  } else if (feedback === 'fuzzy') {
    p.stage = Math.max(1, (p.stage || 0) - 1);
    p.status = 'fuzzy';
    p.nextReview = now + Math.max(5 * 60, INTERVALS[p.stage] * 0.5) * 1000;
    p.fuzzyCount = (p.fuzzyCount || 0) + 1;
  } else {
    p.stage = 1;
    p.status = 'forgotten';
    p.nextReview = now + 5 * 60 * 1000;
    p.lapses = (p.lapses || 0) + 1;
    p.correctStreak = 0;
  }
  p.reviews = (p.reviews || 0) + 1;
  p.lastReview = now;
  p.updatedAt = now;
  return p;
}

/** 把毫秒时长格式化为「X 分钟后 / X 小时后 / X 天后」 */
export function formatDuration(ms) {
  if (ms <= 0) return '现在';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} 分钟后`;
  const hours = min / 60;
  if (hours < 24) return `${Math.round(hours)} 小时后`;
  return `${Math.round(hours / 24)} 天后`;
}

export function formatNextReview(nextReview, now = Date.now()) {
  return `下次复习：${formatDuration(nextReview - now)}`;
}

/**
 * 选题队列：未掌握到期 > 已掌握到期 > 新卡
 * @param {Array} cards
 * @param {{cards: Object}} progress
 * @param {number} now
 * @param {boolean} allowNew 是否允许学习新卡
 */
export function buildQueue(cards, progress, now = Date.now(), allowNew = true) {
  const store = progress.cards || {};
  const entryOf = (id) => store[id] || newProgress();
  const srs = cards.filter((c) => c.srs !== false);

  const chapterOrder = (c) => c._chapterIdx ?? 0;
  const idOrder = (a, b) => {
    const na = parseInt(a.id.replace(/\D+/g, ''), 10) || 0;
    const nb = parseInt(b.id.replace(/\D+/g, ''), 10) || 0;
    return na - nb;
  };

  const dueUnmastered = [];
  const dueMastered = [];
  const fresh = [];
  for (const c of srs) {
    const e = entryOf(c.id);
    if (e.nextReview > 0 && e.nextReview <= now) {
      if (e.status === 'known') dueMastered.push(c);
      else if (e.status === 'fuzzy' || e.status === 'forgotten' || e.status === 'learning') dueUnmastered.push(c);
    } else if (e.status === 'new' || (!e.nextReview && e.reviews === 0)) {
      fresh.push(c);
    }
  }
  dueUnmastered.sort((a, b) => entryOf(a.id).nextReview - entryOf(b.id).nextReview);
  dueMastered.sort((a, b) => entryOf(a.id).nextReview - entryOf(b.id).nextReview);
  fresh.sort((a, b) => chapterOrder(a) - chapterOrder(b) || idOrder(a, b));

  const queue = [...dueUnmastered, ...dueMastered];
  if (allowNew) queue.push(...fresh);
  return queue;
}

/** 今日到期数（不含新卡）与今日已复习数 */
export function todayStats(cards, progress, now = Date.now()) {
  const store = progress.cards || {};
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  let due = 0;
  let reviewed = 0;
  for (const c of cards) {
    if (c.srs === false) continue;
    const e = store[c.id];
    if (!e) continue;
    if (e.nextReview > 0 && e.nextReview <= now && e.status !== 'new') due++;
    if (e.lastReview >= dayStart.getTime()) reviewed++;
  }
  return { due, reviewed };
}

/** 未来 7 天每日到期数量（含第 0 天=今天） */
export function upcomingDays(cards, progress, now = Date.now(), days = 7) {
  const store = progress.cards || {};
  const buckets = Array.from({ length: days }, () => 0);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const t0 = dayStart.getTime();
  for (const c of cards) {
    if (c.srs === false) continue;
    const e = store[c.id];
    if (!e || e.nextReview <= 0) continue;
    const idx = Math.floor((e.nextReview - t0) / 86400000);
    if (idx < 0) buckets[0]++;
    else if (idx < days) buckets[idx]++;
  }
  return buckets;
}
