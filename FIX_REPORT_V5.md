# V5 修复报告（FIX_REPORT_V5）

生成：2026-09-25
配套：`REVIEW_REPORT.md`（复核证据）、`VERIFY_REPORT_V5.md`（线上实测证据）、`M_LINE_PENDING.md`（待用户填写）
线上：commit `daaab14` 已部署 https://james549573.github.io/interview-cards/

## 一、任务清单及状态

| 任务 | 动作 | 状态 |
|---|---|---|
| 复核 1 A′ 收紧 | R21 #1 降级 B（源卡 K-19 挂钩 M27/R29 不含 R21），#10~#12 保留 A′（源卡 K-17 挂钩含 R21）；卡头声明与等级统计更新为 8A+3A′+1B | ✅ |
| 复核 2 name 优先级 | `parse-codes.mjs`：8 级 name 来源落注释（curated > phrase > 表格行 > T1 挂钩 > 卡片标题挂钩 > 自动推断）；hookFromTitle 分支补 `!name` 守卫 | ✅ |
| 复核 3 M 线排除法 | 12 条编号素材 0 次出现（实测），维持"素材未定义"；M19/M20 撤同源误标 | ✅ |
| F-02 name 覆盖 bug | 同复核 2；修后 M27/M35/M21 的 name 与正文一致（线上 bundle 断言通过） | ✅ |
| F-03 M8 展示 | 无锚点 M 条目 fullContent 重写：头部"M8 · 素材未定义"+ 素材边界说明 + 有锚点编号清单（含新考证的 X 卡锚点）+ 自补入口提示；**27 句主题池全文已移除**；顺带去掉空转的"它是什么"开头 | ✅ |
| F-06 G1/G4 | G1：补素材定义句（03:107/合并版:982"G-1「AI 结论 = 0」…否决项"）+ 整体口径，name 更新，脱离家族命名清单；G4：补 D26 G-4 散落引用并诚实标注"是否同一编号体系未说明" | ✅ |
| F-05 K-29 排版 | "自述。**---"粘连修复（写出前全局规范化 `([^\n])---` → `$1\n\n---`） | ✅ |
| 方案 A 自补入口 | `src/lib/notes.js`（模块级事件总线）+ `RefModal.jsx` 补充说明区（输入/编辑/删除/时间戳）+ `app.jsx` 接线（并入 progress → localStorage + Gist 防抖同步）+ `github.js` mergeProgress 支持 customNotes 条目级按 updatedAt 合并 + 清空进度时保留补充说明 | ✅ |
| 方案 C 批量填空 | `M_LINE_PENDING.md`：12 条待补编号 + 排查提示（M↔D 编号同构规律） | ✅ |
| audit V5 | 四条新规则：V5-name（name/正文矛盾，LCS<4 且非诚实未定义才报）、V5-stuff（>800 字且标未展开=过度填充）、V5-aprime（A′ 源卡挂钩程序化核查）、V3-family 分隔符补「（正是 G1 案例此前漏检的原因） | ✅ |

## 二、新增 / 修改文件

- `scripts/parse-codes.mjs` —— name 守卫 + 优先级注释；M 线无锚点条目内容重写；"它是什么"跳过条件
- `scripts/code-knowledge.mjs` —— R21 等级收紧（8A+3A′+1B）；G1/G4 素材内容；M19/M20 名称修正
- `scripts/parse-cards.mjs` —— 分隔线粘连全局规范化
- `scripts/audit.mjs` —— V5 四规则
- `src/lib/notes.js` —— **新增**：补充说明模块
- `src/components/RefModal.jsx` —— 补充说明 UI
- `src/app.jsx` / `src/lib/github.js` —— customNotes 状态接线与云端合并
- `src/data/codes.json` / `src/data/cards.json` —— 重新生成
- `REVIEW_REPORT.md` / `VERIFY_REPORT_V5.md` / `M_LINE_PENDING.md` —— **新增**报告与清单

## 三、回归

- 卡片 78（42+32+4）✅ | audit 0 问题 ✅ | build 通过 ✅ | R21 等级 8A+3A′+1B ✅
- 线上 12/12 内容断言通过（commit daaab14，Actions success）

## 四、剩余未解决问题（如实列出）

1. **12 条无锚点 M 编号内容**：素材内无解（0 次出现），已给两条出路（应用内自补 / M_LINE_PENDING 填空回传）。按 M↔D 编号同构规律查底层 D 系列文档是最短路径。
2. **G4 与 D26 G-4 是否同一编号体系**：素材未说明，维持诚实标注，待底层材料确认。
3. 前端"补充说明"未做多端实时冲突提示——合并策略按 updatedAt 取新，最后保存者生效，单人使用无影响。
