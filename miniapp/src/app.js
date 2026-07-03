import Taro, { useLaunch } from '@tarojs/taro'
import './app.css'

function App({ children }) {
  useLaunch(() => {
    // Init WeChat Cloud so wx.cloud.callFunction('parse') works.
    // If you have multiple cloud environments, pass { env: '你的环境ID' }.
    if (Taro.cloud) {
      Taro.cloud.init({ traceUser: true })
    }
  })
  return children
}

export default App
