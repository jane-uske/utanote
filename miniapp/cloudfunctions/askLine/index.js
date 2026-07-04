// WeChat Cloud Function: askLine
// Per-line AI singing coach. Answers are content-addressed and globally
// cached: a cache hit costs nothing; only a real DeepSeek generation on a
// cache miss consumes quota — same invariant as generateLineTts.
//
// event: { questionType: 'singing', line: { text, kana? } }
// The DeepSeek key comes from the same env vars as the parse function
// (DEEPSEEK_KEY / DEEPSEEK_BASE / DEEPSEEK_MODEL); the mini-program never
// sees it. Deploy: right-click this folder in WeChat DevTools → 上传并部署.

const https = require('https')
const http = require('http')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
const {
  PROMPT_VERSION,
  DAILY_USER_AI_ASK_LIMIT,
  GLOBAL_DAILY_AI_ASK_LIMIT,
  AI_REQUEST_TIMEOUT_MS,
  normalizeQuestionType,
  normalizeLine,
  buildCacheKey,
  buildSingingMessages,
  extractJSON,
  normalizeAnswer,
  answerToSafetyText,
  splitContentForSafety,
  contentSafetyDecision,
} = require('./helpers')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const CONTENT_SECURITY_SCENE = Number(process.env.WX_CONTENT_SECURITY_SCENE || 2)

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function findOne(collection, query) {
  const { data } = await db.collection(collection).where(query).limit(1).get()
  return data && data[0]
}

async function readUsage(collection, query, field) {
  const existing = await findOne(collection, query)
  return { existing, count: existing ? Number(existing[field] || 0) : 0 }
}

async function checkQuota(openid) {
  const date = todayKey()
  const global = await readUsage('ai_usage_global_daily', { date }, 'askCount')
  if (global.count >= GLOBAL_DAILY_AI_ASK_LIMIT) {
    return { ok: false, code: 'GLOBAL_AI_LIMIT_EXCEEDED', message: '今日 AI 讲解生成较多，请稍后再试，已生成的讲解仍可查看。' }
  }
  const user = await readUsage('ai_usage_daily', { openid, date }, 'askCount')
  if (user.count >= DAILY_USER_AI_ASK_LIMIT) {
    return { ok: false, code: 'AI_DAILY_LIMIT_EXCEEDED', message: '今日 AI 讲解额度已用完，已生成的讲解仍可继续查看。' }
  }
  return { ok: true }
}

async function commitUsage(openid, tokenUsage) {
  const date = todayKey()
  const global = await findOne('ai_usage_global_daily', { date })
  if (global && global._id) await db.collection('ai_usage_global_daily').doc(global._id).update({ data: { askCount: _.inc(1), totalTokens: _.inc(tokenUsage.total_tokens || 0), updatedAt: db.serverDate() } })
  else await db.collection('ai_usage_global_daily').add({ data: { date, askCount: 1, totalTokens: tokenUsage.total_tokens || 0, updatedAt: db.serverDate() } })

  const user = await findOne('ai_usage_daily', { openid, date })
  if (user && user._id) await db.collection('ai_usage_daily').doc(user._id).update({ data: { askCount: _.inc(1), updatedAt: db.serverDate() } })
  else await db.collection('ai_usage_daily').add({ data: { openid, date, askCount: 1, updatedAt: db.serverDate() } })
}

async function remainingFor(openid) {
  const usage = await readUsage('ai_usage_daily', { openid, date: todayKey() }, 'askCount')
  return { remainingAskCount: Math.max(0, DAILY_USER_AI_ASK_LIMIT - usage.count), dailyAskLimit: DAILY_USER_AI_ASK_LIMIT }
}

function httpRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(parsed, options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve({ statusCode: res.statusCode, body: raw })
      })
    })
    req.on('error', reject)
    req.setTimeout(AI_REQUEST_TIMEOUT_MS, () => { req.destroy(new Error('LLM request timeout')) })
    if (body) req.write(body)
    req.end()
  })
}

async function callLLM({ baseURL, apiKey, model, messages }) {
  const url = baseURL.replace(/\/+$/, '') + '/chat/completions'
  const payload = JSON.stringify({
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages,
  })
  const res = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`LLM ${res.statusCode}: ${(res.body || '').slice(0, 300)}`)
  }
  const data = JSON.parse(res.body)
  const content = data && data.choices && data.choices[0] && data.choices[0].message.content
  const usage = (data && data.usage) || {}
  return {
    answer: normalizeAnswer(extractJSON(content)),
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    },
  }
}

async function checkTextContentSafety({ openid, content }) {
  if (!openid) {
    return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '无法完成内容安全检查，请稍后再试。' }
  }
  const chunks = splitContentForSafety(content)
  if (!chunks.length) return { ok: true }
  if (!cloud.openapi || !cloud.openapi.security || typeof cloud.openapi.security.msgSecCheck !== 'function') {
    return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '内容安全检查暂不可用，请稍后再试。' }
  }

  for (const part of chunks) {
    let resp
    try {
      resp = await cloud.openapi.security.msgSecCheck({
        version: 2,
        openid,
        scene: CONTENT_SECURITY_SCENE,
        content: part,
      })
    } catch (e) {
      console.warn('content safety check failed:', e)
      return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '内容安全检查暂不可用，请稍后再试。' }
    }
    const decision = contentSafetyDecision(resp)
    if (!decision.ok) {
      return {
        ok: false,
        code: decision.code,
        error: decision.code === 'CONTENT_RISK'
          ? '这句内容暂不支持 AI 讲解。'
          : '内容安全检查暂不可用，请稍后再试。',
      }
    }
  }
  return { ok: true }
}

function success(payload) {
  return { ok: true, ...payload }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_OPENID', error: '无法识别用户，请稍后再试。' }

  const questionType = normalizeQuestionType(event.questionType)
  if (!questionType) return { ok: false, code: 'INVALID_QUESTION_TYPE', error: '无效的提问类型。' }

  const lineCheck = normalizeLine(event.line)
  if (!lineCheck.ok) return { ok: false, code: lineCheck.code, error: lineCheck.message }
  const { text, kana } = lineCheck.line

  const model = (process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim()
  const cacheKey = buildCacheKey({ questionType, text, kana, model })

  // ── Cache hit: free, no quota, no safety re-check (checked at write time) ──
  try {
    const cached = await findOne('ai_answers', { cacheKey })
    if (cached && cached.answer) {
      const remain = await remainingFor(OPENID)
      return success({ answer: cached.answer, cacheKey, questionType, cacheHit: true, generated: false, quotaConsumed: false, ...remain })
    }
  } catch (e) { console.warn('answer cache lookup failed:', e) }

  const quota = await checkQuota(OPENID)
  if (!quota.ok) return { ok: false, code: quota.code, error: quota.message }

  const apiKey = (process.env.DEEPSEEK_KEY || '').trim()
  const baseURL = (process.env.DEEPSEEK_BASE || DEFAULT_BASE).trim()
  if (!apiKey) return { ok: false, code: 'AI_NOT_CONFIGURED', error: 'AI 讲解服务未配置。' }

  // The line arrives from the client (songs live in device storage, there is
  // no server-side song library), so check the input before spending tokens.
  const inputSafety = await checkTextContentSafety({ openid: OPENID, content: [text, kana].filter(Boolean).join('\n') })
  if (!inputSafety.ok) return inputSafety

  // One retry on a malformed answer — bad JSON or empty schema throws, and a
  // failed attempt never reaches commitUsage, so it costs the user nothing.
  const messages = buildSingingMessages({ text, kana })
  let result
  try {
    result = await callLLM({ baseURL, apiKey, model, messages })
  } catch (e1) {
    console.warn('first LLM attempt failed:', e1)
    try {
      result = await callLLM({ baseURL, apiKey, model, messages })
    } catch (e2) {
      console.warn('second LLM attempt failed:', e2)
      return { ok: false, code: 'AI_BAD_ANSWER', error: 'AI 讲解生成失败，请稍后再试。' }
    }
  }

  const outputSafety = await checkTextContentSafety({ openid: OPENID, content: answerToSafetyText(result.answer) })
  if (!outputSafety.ok) return outputSafety

  try {
    await db.collection('ai_answers').add({
      data: {
        cacheKey,
        questionType,
        promptVersion: PROMPT_VERSION,
        model,
        text,
        kana,
        answer: result.answer,
        tokenUsage: result.usage,
        createdAt: db.serverDate(),
      },
    })
    await commitUsage(OPENID, result.usage)
  } catch (e) {
    console.warn('answer cache write failed:', e)
    // The answer itself is fine — return it even if persisting failed; the
    // next request will simply regenerate.
  }

  const remain = await remainingFor(OPENID)
  return success({ answer: result.answer, cacheKey, questionType, cacheHit: false, generated: true, quotaConsumed: true, ...remain })
}
