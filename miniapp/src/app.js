import Taro, { useLaunch } from '@tarojs/taro'
import { login } from './logic/auth'
import './app.css'

function App({ children }) {
  useLaunch(() => {
    if (Taro.cloud) {
      Taro.cloud.init({ traceUser: true })
    }
    // Auto-login to get openid (silent, no user interaction needed)
    login()
  })
  return children
}

export default App
