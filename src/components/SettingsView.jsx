import { useRef } from 'preact/hooks';
import { mergeProgress } from '../lib/github';
import { GENERATED_AT } from '../lib/cards';

export default function SettingsView({ theme, setTheme, progress, onImport, onClearLocal, onLogout }) {
  const fileRef = useRef(null);
  const confirmRef = useRef(false);

  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interview-cards-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importProgress(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || !data.cards) throw new Error('格式不对');
      onImport(mergeProgress(progress, data));
    } catch (err) {
      alert('导入失败：' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  function clearLocal() {
    if (!confirmRef.current) {
      confirmRef.current = true;
      setTimeout(() => (confirmRef.current = false), 4000);
      alert('再点一次「清空本地进度」确认执行（4 秒内）');
      return;
    }
    confirmRef.current = false;
    onClearLocal();
  }

  return (
    <div class="pt-4 space-y-4 max-w-xl">
      <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-4">
        <h3 class="font-bold mb-3">外观</h3>
        <div class="flex items-center justify-between">
          <span class="text-sm">主题</span>
          <div class="flex gap-1">
            <button
              onClick={() => setTheme('dark')}
              class={`px-3 py-1.5 rounded-lg text-sm ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              暗色
            </button>
            <button
              onClick={() => setTheme('light')}
              class={`px-3 py-1.5 rounded-lg text-sm ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              亮色
            </button>
          </div>
        </div>
      </div>

      <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-4">
        <h3 class="font-bold mb-3">进度数据</h3>
        <div class="flex flex-wrap gap-2">
          <button onClick={exportProgress} class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm min-h-[44px]">
            导出进度 JSON
          </button>
          <button onClick={() => fileRef.current && fileRef.current.click()} class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm min-h-[44px]">
            导入进度 JSON
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" class="hidden" onChange={importProgress} />
          <button onClick={clearLocal} class="px-3 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-sm min-h-[44px]">
            清空本地进度
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-2">导入采用卡片级合并（按 updatedAt 取新），不会覆盖较新的记录。</p>
      </div>

      <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-4">
        <h3 class="font-bold mb-3">账号</h3>
        <button onClick={onLogout} class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm min-h-[44px]">
          退出登录（清除 PAT，保留本地进度）
        </button>
      </div>

      <div class="bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
        <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-200">素材更新</h3>
        <p>面试素材更新后，在项目目录执行：</p>
        <pre class="mt-2 p-2 rounded bg-gray-100 dark:bg-gray-800 text-xs overflow-x-auto">npm run parse{'\n'}git add src/data/cards.json{'\n'}git commit -m "update cards"{'\n'}git push</pre>
        <p class="mt-2">
          当前卡片数据生成于 {GENERATED_AT ? new Date(GENERATED_AT).toLocaleString('zh-CN') : '未知'}，共{' '}
          {progress.cards ? Object.keys(progress.cards).length : 0} 张卡有学习记录。
        </p>
      </div>
    </div>
  );
}
