// Lightweight WeChat login — gets the user's openid via cloud function.
// The openid is cached locally so we only call the cloud function once per install.

import Taro from '@tarojs/taro'

const USER_KEY = 'utanote.user'

export function getUser() {
  try {
    return Taro.getStorageSync(USER_KEY) || null
  } catch {
    return null
  }
}

export async function login() {
  const cached = getUser()
  if (cached && cached.openid) return cached

  try {
    const res = await Taro.cloud.callFunction({ name: 'login', data: {} })
    const user = res && res.result
    if (user && user.openid) {
      Taro.setStorageSync(USER_KEY, user)
    }
    return user
  } catch (e) {
    console.warn('login failed:', e)
    return null
  }
}
