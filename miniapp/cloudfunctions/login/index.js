// WeChat Cloud Function: login
// Returns the caller's openid and upserts a user record in the cloud database.

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext()

  // Upsert user record
  try {
    const { data } = await db.collection('users').where({ openid: OPENID }).get()
    if (data.length === 0) {
      await db.collection('users').add({
        data: {
          openid: OPENID,
          appid: APPID,
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate(),
        },
      })
    } else {
      await db.collection('users').doc(data[0]._id).update({
        data: { lastLoginAt: db.serverDate() },
      })
    }
  } catch (e) {
    console.warn('upsert user failed:', e)
  }

  return { openid: OPENID }
}
