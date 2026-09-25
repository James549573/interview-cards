// GitHub PAT 校验、Gist 进度读写、卡片级合并、防抖上传
export const GIST_DESC = 'interview-cards-progress';
export const GIST_FILE = 'progress.json';
const API = 'https://api.github.com';

async function gh(pat, path, opts = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      keepalive: !!opts.keepalive
    });
  } catch (e) {
    const err = new Error('网络错误，请检查网络连接');
    err.status = 0;
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    const err = new Error(res.status === 401 ? 'PAT 无效或已过期' : 'GitHub API 速率限制，请稍后重试');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`GitHub API 错误（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** 校验 PAT，返回登录名 */
export async function verifyPat(pat) {
  const user = await gh(pat, '/user');
  return user.login;
}

/** 查找已有进度 Gist（按 description 匹配），没有则创建 */
export async function findOrCreateGist(pat, initialProgress = null) {
  const gists = await gh(pat, '/gists?per_page=100');
  const found = Array.isArray(gists) ? gists.find((g) => g.description === GIST_DESC && !g.fork) : null;
  if (found) return found.id;
  const created = await gh(pat, '/gists', {
    method: 'POST',
    body: {
      description: GIST_DESC,
      public: false,
      files: {
        [GIST_FILE]: {
          content: initialProgress ? JSON.stringify(initialProgress) : '{"version":1,"cards":{}}'
        }
      }
    }
  });
  return created.id;
}

/** 读取远端进度；Gist 里没有 progress.json 时视为空进度 */
export async function fetchProgress(pat, gistId) {
  const gist = await gh(pat, `/gists/${gistId}`);
  const file = gist.files && gist.files[GIST_FILE];
  if (!file || !file.content) return { version: 1, cards: {} };
  try {
    const parsed = JSON.parse(file.content);
    return parsed && typeof parsed === 'object' ? parsed : { version: 1, cards: {} };
  } catch {
    return { version: 1, cards: {} };
  }
}

/** 写远端进度 */
export async function pushProgress(pat, gistId, progress, keepalive = false) {
  await gh(pat, `/gists/${gistId}`, {
    method: 'PATCH',
    body: { files: { [GIST_FILE]: { content: JSON.stringify(progress) } } },
    keepalive
  });
}

/** 卡片级合并：按每张卡的 updatedAt 取新；customNotes（编号补充说明）按条目 updatedAt 取新 */
export function mergeProgress(local, remote) {
  const result = {
    version: 1,
    updatedAt: Date.now(),
    cards: { ...(remote && remote.cards ? remote.cards : {}) }
  };
  for (const [id, lc] of Object.entries((local && local.cards) || {})) {
    const rc = result.cards[id];
    if (!rc || (lc.updatedAt || 0) > (rc.updatedAt || 0)) {
      result.cards[id] = lc;
    }
  }
  const ln = (local && local.customNotes) || {};
  const rn = (remote && remote.customNotes) || {};
  const customNotes = { ...rn };
  for (const [code, le] of Object.entries(ln)) {
    const re = customNotes[code];
    if (!re || (le.updatedAt || 0) > (re.updatedAt || 0)) {
      customNotes[code] = le;
    }
  }
  result.customNotes = customNotes;
  return result;
}

/**
 * 创建防抖上传器。
 * onAuth 返回 { pat, gistId, progress }；onStatus 更新同步状态；onFatal(401) 时登出。
 */
export function createUploader({ onAuth, onStatus, onFatal }) {
  let timer = null;
  let lastSnapshot = '';
  let failed = false;

  async function flush(keepalive = false) {
    const { pat, gistId, progress } = onAuth();
    if (!pat || !gistId) return;
    const snapshot = JSON.stringify(progress);
    if (!keepalive && snapshot === lastSnapshot && !failed) {
      onStatus('idle');
      return;
    }
    onStatus('syncing');
    try {
      await pushProgress(pat, gistId, progress, keepalive);
      lastSnapshot = snapshot;
      failed = false;
      onStatus('idle');
    } catch (e) {
      if (e.status === 401) {
        if (onFatal) onFatal();
        return;
      }
      if (!failed) {
        // 静默重试一次
        failed = true;
        try {
          await pushProgress(pat, gistId, progress, keepalive);
          lastSnapshot = snapshot;
          failed = false;
          onStatus('idle');
          return;
        } catch {
          /* fallthrough */
        }
      }
      onStatus('error');
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 2000);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    timer = null;
    lastSnapshot = '';
    failed = false;
    onStatus('idle');
  }

  return { schedule, flush, reset };
}
