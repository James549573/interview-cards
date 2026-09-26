# tech1 试跑 · 子会话派发模板（复制给 DeepSeek v4.1-flash 子会话）

> 主会话复制下面整段发给子会话。子会话只做填充，不做架构判断。

---

# 任务：生成「编程基础」技术面试卡，共 26 张

你是面试题库的卡片写作执行者，只做按模板填充，不做任何架构判断。

## 一、你拥有的素材（只读，不要去找别的数据源）

### 1. 本组技术知识点（表格三列：一级目录 | 二级目录 | 三级子点）

```
python | 面向对象三大特性
python | 数据类型及其适用场景
python | 常用函数、常见魔法方法
python | 进程、线程、协程
python | agent开发涉及常见第三方库及其使用要点
python | 装饰器与闭包
python | 生成器与迭代器
python | GIL 与并发模型
python | 内存管理与垃圾回收
http协议 | TCP、udp
http协议 | http/https
http协议 | 请求方式
http协议 | websocket
http协议 | 状态码及其含义
http协议 | 报文结构与请求/响应头
http协议 | 缓存机制（强缓存与协商缓存）
http协议 | HTTP/2 与 HTTP/3
fastapi | 选型依据
fastapi | 如何实现异步
fastapi | jwt认证
fastapi | 模块化路由
fastapi | 常见问题及处理 | 异步阻塞导致性能问题；跨域 CORS 配置；依赖注入与请求校验报错排查；生命周期/启动事件与全局状态；部署（uvicorn/gunicorn）与超时、网关问题
fastapi | 依赖注入机制
fastapi | 请求校验与 Pydantic 模型
fastapi | 中间件与生命周期
fastapi | 权限与 OAuth2
```

一个「二级目录」= 一张卡。它右侧的「三级子点」合并进同一张卡，作为追问线索，不单独成卡。
共 26 张，编号 TT1-001 ~ TT1-026（按上表顺序）。

### 2. 锚点表（唯一事实源）

完整锚点表在 `C:\Users\admin\WorkBuddy\interview-cards\plan\anchors.json`，先完整读一遍。
你只能在卡片里引用锚点表中已定义的 code。本组生产实践优先落到这两个项目锚点：

- `PRJ-01` 浙江省智慧教育平台 AI 能力建设（fastapi / http协议 / 后端工程的主落地项目）
- `PRJ-02` 浙江省产业链分析平台（python / 数据工程的落地项目）

## 二、铁律（违反整卡作废）

1. 只输出 JSON 数组，可被 JSON.parse 直接解析，不要任何解释性前言。
2. 数字只能逐字复制锚点表 `quotable` 字段，一个都不许自造；锚点表没有的写定性描述（如「显著增加」「不可接受」）。
3. 只能用锚点表里的 code，不许新造编号。
4. 素材不足的卡标 `"gap": true`，在 `gapNote` 写缺什么，不要用推断凑满。
5. 不许出现「素材」「文档」「原表」「未展开」「推断」这类词。不足就标 gap，不在正文解释。
6. 禁止引用这些旧口径/禁词：`7 段`、`290 表`、`2,175 列`、`2025.03`、`Aho-Corasick`、`353 人日`、`57,651`、`32 人三方`、`15 个向量库`、`<5ms`、`<50ms`、`<2s`。

## 三、每张卡产出契约（字段一个都不能少）

```json
{
  "id": "TT1-001",
  "chapter": "tech1",
  "title": "二级目录原文",
  "questions": ["首项 = title，加 3~5 个面试会追问的问句"],
  "answerMarkdown": "## 结论\n定义 + 30 秒能说完的关键结论\n## 原理与边界\n底层机制、因果关系、适用条件、常见误区、与相近概念区别\n## 生产实践\n结合 PRJ-01/PRJ-02 真实项目：怎么实现、怎么验证、故障怎么排查、性能/安全取舍、风险与回滚；必须显式引用 ≥1 个锚点 code（如 DEC-06、NUM-02）",
  "memoryHook": "一句话钩子，30 字内",
  "tags": ["技术"],
  "anchors": ["PRJ-01", "DEC-06"],
  "gap": false,
  "gapNote": "",
  "priority": "T0",
  "related": ["TT1-003"],
  "srs": true
}
```

## 四、写作要求

1. `answerMarkdown` 350~600 字；超过 800 字说明没合并三级子点。
2. 用工程师讲决策的口吻：先问题、再选择、再代价。不要「值得注意的是」「综上所述」。
3. 三个段标题 `## 结论` / `## 原理与边界` / `## 生产实践` 一个字都不能改。
4. `related` 只连本组内（TT1-xxx），跨组连线交给后续组。
5. priority：python/fastapi 核心考点标 T0，边缘考点标 T1；总数 T0 约 70%。

## 五、输出与回报

把 JSON 数组写到 `C:\Users\admin\WorkBuddy\interview-cards\out\tech-group1.json`，用 `JSON.stringify(arr, null, 2)`。
写完回我一行统计：张数 / gap 张数 / 引用锚点去重数 / 最长卡字数。