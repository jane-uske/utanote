// WeChat Cloud Function: initTtsCollections
// 一次性 bootstrap：幂等创建 TTS 所需的数据库集合。
// 已存在的集合会被跳过（视为成功），可安全重复运行。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'users',
  'parse_logs',
  'tts_cache',
  'song_tts_assets',
  'tts_usage_daily',
  'tts_usage_global_daily',
]

function looksLikeAlreadyExists(e) {
  const msg = String((e && (e.errMsg || e.message)) || e)
  const code = String((e && (e.errCode != null ? e.errCode : e.code)) || '')
  return /exist|已存在|-501061|-501001|ResourceExists|CollectionExist/i.test(msg + ' ' + code)
}

exports.main = async () => {
  const results = []
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (e) {
      if (looksLikeAlreadyExists(e)) {
        results.push({ name, status: 'exists' })
      } else {
        results.push({
          name,
          status: 'error',
          code: e && (e.errCode != null ? e.errCode : e.code),
          msg: String((e && (e.errMsg || e.message)) || e),
        })
      }
    }
  }
  const ok = results.every((r) => r.status !== 'error')
  const summary = {
    created: results.filter((r) => r.status === 'created').map((r) => r.name),
    exists: results.filter((r) => r.status === 'exists').map((r) => r.name),
    error: results.filter((r) => r.status === 'error').map((r) => r.name),
  }
  return { ok, summary, results }
}
