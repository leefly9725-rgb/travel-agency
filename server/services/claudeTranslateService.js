// server/services/claudeTranslateService.js
// 商务条款翻译服务 — 调用 Claude API 翻译 rich_text 模块
// 依赖：仅使用 Node.js 内置 fetch（Node 18+）
// 密钥读取：process.env.ANTHROPIC_API_KEY

"use strict";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_API_VERSION = "2023-06-01";
const MAX_TOKENS = 4096;

const LANG_NAMES = {
  en: "English",
  sr: "Serbian (Latin alphabet / Srpski latiničnim pismom)",
};

function getApiKey() {
  const key = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY 未配置，无法调用翻译服务。");
  return key;
}

function buildSystemPrompt(targetLang) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  return (
    `你是专业的旅游行业商务文件翻译员。请将以下中文商务条款翻译成 ${langName}。\n` +
    `要求：\n` +
    `1. 保持商务正式语气\n` +
    `2. 专业术语准确\n` +
    `3. 如果输入是数组，输出也必须是相同长度的数组，每项对应翻译\n` +
    `4. 只返回翻译结果，不要解释，不要加任何前缀\n` +
    `5. 如果是数组，返回 JSON 数组格式`
  );
}

/**
 * 调用 Claude API 翻译单个 rich_text block 的内容
 * @param {string[]|string} content - zh 内容（数组或字符串）
 * @param {string} targetLang - "en" 或 "sr"
 * @returns {Promise<string[]|string>} 翻译结果（同类型）
 */
async function translateContent(content, targetLang) {
  const isArray = Array.isArray(content);
  const apiKey = getApiKey();

  let userMessage;
  if (isArray) {
    userMessage = JSON.stringify(content, null, 2);
  } else {
    userMessage = String(content || "");
  }

  if (!userMessage.trim() || (isArray && content.length === 0)) {
    return isArray ? [] : "";
  }

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(targetLang),
    messages: [{ role: "user", content: userMessage }],
  };

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": CLAUDE_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API 请求失败：${response.status} ${text}`);
  }

  const result = await response.json();
  const rawText = (result.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();

  if (!rawText) throw new Error("Claude API 返回空内容。");

  if (isArray) {
    // 解析返回的 JSON 数组
    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) throw new Error("Claude 返回格式不是数组。");
      if (parsed.length !== content.length) {
        throw new Error(
          `Claude 返回数组长度 (${parsed.length}) 与输入 (${content.length}) 不一致。`
        );
      }
      return parsed;
    } catch (e) {
      // 兜底：按换行切割
      const lines = rawText.split("\n").filter((l) => l.trim());
      return lines.slice(0, content.length);
    }
  }

  return rawText;
}

module.exports = { translateContent };
