import codesData from '../data/codes.json';

const CODE_MAP = codesData.codes || {};
// M1b/M1c 归一到 M1
export function normCode(code) {
  const m = code.match(/^(M\d{1,2})[bc]$/);
  return m ? m[1] : code;
}

export function lookupCode(code) {
  return CODE_MAP[normCode(code)] || null;
}

export const CODES_STATS = codesData.stats || {};

// 编号正则（与 parse-codes.mjs 口径一致）
const CODE_RE = /\b(R\d{1,2}|N\d{1,2}|V\d{1,2}|I\d{1,2}|M\d{1,2}[bc]?|K-\d{2}|X-\d{2}|T1-\d{2}|AI-\d{3}|CL-(?:RAG-)?\d{1,3}|ADR-[\d-]+|ISSUE-\d{3}|GF-\d+(?:\.\d+)?|AC-\d{2}|G\d{1,2}|T-\d{2}|C\d{1,2}|D\d{1,2}|RK-\d{2}|SC-\d{2}|P-\d{1,2}|US-\d|INF-\d{2,3}|IL-\d{3}|Q-[A-Z]{2}-\d{2}|E6|F-2|A-4|TRL)\b/g;

/**
 * 把 markdown 正文中的编号替换为可点击徽章。
 * 不替换：代码块/行内代码、URL、已有 HTML 标签内部。
 * 返回 { html: 替换后的 markdown 源, unknown: 未收录编号数组 }
 */
export function annotateCodes(md) {
  if (!md) return { html: '', unknown: [] };
  const protected_ = [];
  // 保护代码块 / 行内代码 / URL
  let src = md.replace(/```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s)<>]+/g, (m) => {
    protected_.push(m);
    return `\u0000P${protected_.length - 1}\u0000`;
  });
  const unknown = [];
  const seenUnknown = new Set();
  src = src.replace(CODE_RE, (code) => {
    const entry = lookupCode(code);
    if (!entry) {
      if (!seenUnknown.has(code)) {
        seenUnknown.add(code);
        unknown.push(code);
        console.warn('[Ref] 未收录编号:', code);
      }
      return `<span class="ref-badge ref-missing" data-code="${code}" title="编号未收录">${code}⚠</span>`;
    }
    const name = entry.name || '名称未定义';
    return `<button class="ref-badge" data-code="${code}" data-name="${name.replace(/"/g, '&quot;')}" type="button">${code}</button>`;
  });
  // 还原保护段
  src = src.replace(/\u0000P(\d+)\u0000/g, (_, i) => protected_[i]);
  return { html: src, unknown };
}
