export const callClaude = async (messages, system, apiKey, maxTokens = 1024) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content.map((b) => b.text || "").join("");
};

export const callProxy = async (messages, system, accessToken, maxTokens = 2048) => {
  const res = await fetch("/api/automation/invoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      runId: crypto.randomUUID(),
      model: "claude-haiku-4-5-20251001",
      maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.text;
};

export const getAIKey = (settings) => ({
  apiKey: settings.apiKey || "",
  accessToken: settings.accessToken || "",
  hasKey: !!settings.apiKey,
  hasToken: !!settings.accessToken,
});
