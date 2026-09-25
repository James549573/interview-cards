// 卡片数据加载、章节映射、筛选与检索
import data from '../data/cards.json';

export const CHAPTERS = data.chapters;
export const CARDS = data.cards;
export const GENERATED_AT = data.generatedAt;
export const CHAPTER_MAP = Object.fromEntries(CHAPTERS.map((c) => [c.id, c.name]));

export const ALL_TAGS = ['T0', 'T1', '准T0', '技术', '管理', 'FDE', '合规', '红线', '附录'];

// 预挂章节序号，供新卡排序用
const orderIdx = Object.fromEntries(CHAPTERS.map((c, i) => [c.id, i]));
for (const c of CARDS) c._chapterIdx = orderIdx[c.chapter] ?? 99;

/** 按 title + answerMarkdown 全文检索 */
export function searchCards(cards, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(
    (c) => c.title.toLowerCase().includes(q) || c.answerMarkdown.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  );
}

export function filterCards(cards, filter, query) {
  let out = cards;
  if (filter.chapter) out = out.filter((c) => c.chapter === filter.chapter);
  if (filter.tags && filter.tags.length) {
    out = out.filter((c) => filter.tags.every((t) => c.tags.includes(t)));
  }
  return searchCards(out, query);
}

export function cardsInChapter(chapterId) {
  return CARDS.filter((c) => c.chapter === chapterId);
}
