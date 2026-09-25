import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { storage, KEYS } from './lib/storage';
import { CARDS, CHAPTER_MAP } from './lib/cards';
import { verifyPat, findOrCreateGist, fetchProgress, mergeProgress, pushProgress, createUploader } from './lib/github';
import { todayStats } from './lib/srs';
import LoginPage from './components/LoginPage.jsx';
import TopBar from './components/TopBar.jsx';
import BrowseView from './components/BrowseView.jsx';
import MemorizeView from './components/MemorizeView.jsx';
import StatsView from './components/StatsView.jsx';
import SettingsView from './components/SettingsView.jsx';

export function App() {
  const [pat, setPat] = useState(() => storage.get(KEYS.pat) || null);
  const [gistId, setGistId] = useState(() => storage.get(KEYS.gist) || null);
  const [progress, setProgress] = useState(() => storage.get(KEYS.progress) || { version: 1, updatedAt: 0, cards: {} });
  const [view, setView] = useState('memorize');
  const [theme, setTheme] = useState(() => storage.get(KEYS.theme, 'dark'));
  const [filter, setFilter] = useState(() => storage.get(KEYS.filter, { chapter: null, tags: [] }));
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | error
  const [toast, setToast] = useState(null);

  // refs 供上传器读取最新值
  const patRef = useRef(pat);
  const gistRef = useRef(gistId);
  const progressRef = useRef(progress);
  patRef.current = pat;
  gistRef.current = gistId;
  progressRef.current = progress;

  // 主题
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    storage.set(KEYS.theme, theme);
  }, [theme]);

  // 进度持久化
  useEffect(() => {
    storage.set(KEYS.progress, progress);
  }, [progress]);

  useEffect(() => {
    storage.set(KEYS.filter, filter);
  }, [filter]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const uploader = useMemo(
    () =>
      createUploader({
        onAuth: () => ({ pat: patRef.current, gistId: gistRef.current, progress: progressRef.current }),
        onStatus: setSyncStatus,
        onFatal: () => logout(true)
      }),
    []
  );

  // beforeunload 强制上传
  useEffect(() => {
    const handler = () => uploader.flush(true);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploader]);

  const saveProgress = useCallback(
    (next) => {
      setProgress(next);
      uploader.schedule();
    },
    [uploader]
  );

  async function handleLogin(patInput, onStep) {
    onStep('正在校验 PAT…');
    await verifyPat(patInput);
    const gist = await findOrCreateGist(patInput, progress);
    onStep('正在拉取云端进度…');
    const remote = await fetchProgress(patInput, gist);
    const merged = mergeProgress(progress, remote);
    setPat(patInput);
    setGistId(gist);
    storage.set(KEYS.pat, patInput);
    storage.set(KEYS.gist, gist);
    setProgress(merged);
    storage.set(KEYS.progress, merged);
    onStep('正在上传合并结果…');
    try {
      await pushProgress(patInput, gist, merged);
    } catch {
      /* 上传失败不阻塞进入，同步状态会标记 */
    }
  }

  function logout(patInvalid = false) {
    storage.remove(KEYS.pat);
    storage.remove(KEYS.gist);
    setPat(null);
    setGistId(null);
    if (patInvalid) showToast('PAT 已失效，请重新登录');
    uploader.reset();
  }

  if (!pat || !gistId) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const stats = todayStats(CARDS, progress);

  return (
    <div class="min-h-screen flex flex-col">
      <TopBar
        view={view}
        setView={setView}
        theme={theme}
        setTheme={setTheme}
        syncStatus={syncStatus}
        dueCount={stats.due}
        reviewedCount={stats.reviewed}
        onLogout={() => logout()}
      />
      <main
        class={`flex-1 w-full max-w-3xl mx-auto px-4 pb-24 ${view === 'memorize' ? 'flex flex-col min-h-0' : ''}`}
      >
        {view === 'browse' && <BrowseView filter={filter} setFilter={setFilter} />}
        {view === 'memorize' && <MemorizeView progress={progress} saveProgress={saveProgress} showToast={showToast} />}
        {view === 'stats' && <StatsView progress={progress} />}
        {view === 'settings' && (
          <SettingsView
            theme={theme}
            setTheme={setTheme}
            progress={progress}
            onImport={(merged) => {
              setProgress(merged);
              uploader.schedule();
              showToast('已导入并合并');
            }}
            onClearLocal={() => {
              const empty = { version: 1, updatedAt: Date.now(), cards: {} };
              setProgress(empty);
              storage.set(KEYS.progress, empty);
              showToast('本地进度已清空');
            }}
            onLogout={() => logout()}
          />
        )}
      </main>
      {toast && (
        <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
