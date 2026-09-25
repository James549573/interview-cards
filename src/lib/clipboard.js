// 复制三段式查证模板到剪贴板（不调用任何外部 API）
export function buildTemplate(card, chapterName) {
  return `你是一位严谨的技术审校。下面是我面试准备中的一张知识卡，请帮我查证其可靠性。回答请用中文。

## 一、问题
${card.questions[0] || card.title}

## 二、我的答案
${card.answerMarkdown}

## 三、背景
- 章节：${chapterName}
- 标签：${(card.tags || []).join(', ')}
- 出处：${card.source || '（未标注）'}
- 是否红线：${card.redline ? '是' : '否'}
- 记忆钩子：${card.memoryHook || '（无）'}

请从以下角度评估：
1. 与项目材料的一致性
2. 通用技术准确性
3. 是否存在口径混淆、数字误用、边界缺失
4. 指出疑点（如有）
5. 给出改进建议（如有）
6. 最后给一个总评：可靠 / 部分可靠 / 存疑 / 无法判断

如果你能联网，请附上引用来源；如果不能联网，请明确说明"本次未联网"。
`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  // 降级方案：隐藏 textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
