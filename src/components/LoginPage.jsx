import { useState } from 'preact/hooks';

const PAT_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=interview-cards';

export default function LoginPage({ onLogin }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onLogin(token.trim(), setStep);
    } catch (err) {
      setError(err.message || '登录失败，请检查 PAT');
    } finally {
      setBusy(false);
      setStep('');
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-md bg-lightcard dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-2xl shadow-lg p-6">
        <div class="text-3xl mb-1">🃏</div>
        <h1 class="text-xl font-bold mb-1">面试知识点记忆卡</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
          需要一个 GitHub Personal Access Token（gist scope）才能登录。进度会保存在你的私有 Gist 中。
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={token}
            onInput={(e) => setToken(e.currentTarget.value)}
            placeholder="粘贴 PAT（ghp_…）"
            autocomplete="off"
            class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <div class="text-sm text-red-500 mb-3">{error}</div>}
          {busy && step && <div class="text-sm text-blue-500 mb-3">{step}</div>}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium text-base"
          >
            {busy ? '登录中…' : '登录'}
          </button>
        </form>
        <a href={PAT_URL} target="_blank" rel="noreferrer" class="block mt-4 text-sm text-blue-500 hover:underline">
          → 没有 PAT？点这里一键生成（只需 gist 权限）
        </a>
      </div>
    </div>
  );
}
