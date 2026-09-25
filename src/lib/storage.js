// localStorage 封装：PAT、Gist ID、本地进度、主题、筛选
const KEYS = {
  pat: 'interview_cards_pat',
  gist: 'interview_cards_gist_id',
  progress: 'interview_cards_progress',
  theme: 'interview_cards_theme',
  filter: 'interview_cards_filter',
  allowNew: 'interview_cards_allow_new'
};

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    if (raw.startsWith('j:')) return JSON.parse(raw.slice(2));
    return raw;
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try {
    const raw = typeof value === 'string' ? value : 'j:' + JSON.stringify(value);
    localStorage.setItem(key, raw);
  } catch {
    /* 存储满或被禁用时静默失败 */
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const storage = { get, set, remove, KEYS };
export { KEYS };
