// Minimal OpenAI-compatible chat client — runs from the browser, direct to the
// user-configured endpoint (BYO key + url). Works with any /v1/chat/completions
// provider: DeepSeek, Qwen (DashScope compat), Moonshot, OpenAI, etc.
//
// Note: browser → third-party LLM calls are subject to the endpoint's CORS
// policy. Providers that don't send permissive CORS headers require the user to
// point baseURL at a CORS-enabled proxy. This is inherent to the no-backend,
// user-supplied-url design and is surfaced as a clear error below.

function endpointFrom(baseURL) {
  const base = (baseURL || '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('未配置 API 地址（baseURL）')
  return `${base}/chat/completions`
}

// Strip ```json fences some models wrap around JSON.
function extractJSON(text) {
  if (!text) throw new Error('模型返回为空')
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // Fall back to the outermost {...} if there's leading prose.
  if (t[0] !== '{') {
    const first = t.indexOf('{')
    const last = t.lastIndexOf('}')
    if (first >= 0 && last > first) t = t.slice(first, last + 1)
  }
  return JSON.parse(t)
}

// POST a chat completion and return parsed JSON from the assistant message.
export async function chatJSON({ settings, system, user, signal, temperature = 0.2 }) {
  const url = endpointFrom(settings.baseURL)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error(
      '无法连接解析服务。多为跨域（CORS）限制或网络问题 —— ' +
        '请确认 API 地址可从浏览器直连，或改用支持 CORS 的中转地址。',
    )
  }

  if (!res.ok) {
    // Read the body once as text, then try to pull a structured message out of it.
    let detail = ''
    try {
      const text = await res.text()
      if (text) {
        try {
          const body = JSON.parse(text)
          detail = body?.error?.message || body?.message || text
        } catch {
          detail = text
        }
      }
    } catch {
      /* body unavailable */
    }
    detail = (detail || '').trim().slice(0, 300)
    if (res.status === 401) throw new Error('API Key 无效或未授权（401）。请检查密钥。')
    if (res.status === 403) throw new Error(`无权访问（403）${detail ? '：' + detail : '。可能是密钥权限或网络策略限制。'}`)
    if (res.status === 404) throw new Error('接口地址或模型名不存在（404）。请检查 baseURL / model。')
    if (res.status === 429) throw new Error('调用过于频繁或额度不足（429）。稍后再试。')
    throw new Error(`解析服务返回错误（${res.status}）${detail ? '：' + detail : ''}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  return extractJSON(content)
}
