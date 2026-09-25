# interview-cards · 面试知识点记忆卡

把 Markdown 面试素材解析成结构化卡片，支持艾宾浩斯间隔重复、GitHub 私有 Gist 跨设备同步、PWA 离线使用的单页应用。

**线上地址**：<https://james549573.github.io/interview-cards/>

---

## 一、前置操作（只需一次）

1. 在 GitHub 上创建仓库 `interview-cards`（public）
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
3. 本地把本目录推送到该仓库的 `main` 分支

## 二、生成 PAT（登录用）

打开 <https://github.com/settings/tokens/new?scopes=gist&description=interview-cards>，勾选 **gist** 一个权限即可，生成后复制。

- 应用首次打开会出现登录页，粘贴 PAT 即可
- 进度保存在你的**私有 Gist**（描述为 `interview-cards-progress`）中，手机/电脑用同一个 PAT 登录即自动同步

## 三、本地开发

```bash
npm install
# 解析素材生成 src/data/cards.json（素材目录可用环境变量覆盖）
INTERVIEW_PREP_DIR="C:\Users\admin\WorkBuddy\2026-09-24-22-32-06\outputs\interview_prep" npm run parse
npm run dev
```

## 四、更新素材后重新生成卡片

```bash
npm run parse
git add src/data/cards.json
git commit -m "update cards"
git push
```

push 到 `main` 后 GitHub Actions 会自动构建并发布到 Pages（`.github/workflows/deploy.yml`）。

## 五、手机访问

1. 浏览器打开 <https://james549573.github.io/interview-cards/>
2. 粘贴**同一个 PAT** 登录，进度自动合并
3. 可"添加到主屏幕"作为 PWA 使用；已加载的卡片可离线刷

## 六、数据存储位置

- 登录后自动创建/复用一个**私有 Gist**，描述为 `interview-cards-progress`
- 进度存于其中的 `progress.json` 文件，按卡片级合并（每张卡按 `updatedAt` 取新）
- 退出登录：设置页 → 退出登录（清除本机 PAT，本地进度保留）

## 七、素材目录结构

素材默认目录（不进仓库，已被 `.gitignore` 的 `source/` 规则排除）：

```
C:\Users\admin\WorkBuddy\2026-09-24-22-32-06\outputs\interview_prep\
├── 面试官证据源包_T0核心合并版.md   ← 唯一事实源，冲突时以它为准
├── 附录与补充.md
├── 04_T0增补_K34_招生季与年度报名口径.md
├── 03_三体预演与新增知识点.md
├── T0_模块1_AI410_模块2_AI401.md
└── T0_模块3_4_5_RAG_合规_管理.md
```

解析优先级：合并包 → K-34 增补 → 三体预演 → 模块 1/2 → 模块 3/4/5 → 附录补充；同 ID 冲突以高优先级文件为准。

## 八、卡片构成（共 78 张）

| 类型 | 编号 | 数量 | 说明 |
|---|---|---|---|
| 完整卡（五段式） | K-01 ~ K-34 | 34 | T0 为主，含 K-34 业务口径 |
| 完整卡（五段式） | X-01 ~ X-08 | 8 | 准 T0 |
| T1 索引卡 | T1-09 ~ T1-40 | 32 | 只含知识点名 + 挂钩 + 岗位轴 |
| 附录参考卡 | APP-A / T / F / H | 4 | 不参与间隔重复调度 |

## 九、功能速览

- **浏览模式**：章节/标签筛选 + 全文检索，点开看完整五段式答案
- **记忆模式**：正面问题、点击翻面；底部三档反馈（已记住 / 模糊 / 没记住）；左滑下一题、右滑上一题、上滑翻面；键盘 Space 翻面、1/2/3 评分、←/→ 切题
- **间隔重复**：5 分钟 → 30 分钟 → 12 小时 → 1/2/4/7/15/30/60/120 天；未掌握到期 > 已掌握到期 > 新卡
- **查证模板**：答案页一键复制三段式查证文本，自行去 DeepSeek 网页版提问（不调任何外部 API）
- **同步策略**：反馈后防抖 2 秒上传；关页前强制上传；401 自动登出
