// WeChat Cloud Function: ensureTtsAsset
// Thin compatibility entrypoint. The actual implementation lives in generateLineTts
// so existing callers keep working while new code can call ensureTtsAsset.

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const res = await cloud.callFunction({
    name: 'generateLineTts',
    data: event,
  })
  return res && res.result ? res.result : res
}
