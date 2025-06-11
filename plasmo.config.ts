import { PlasmoConfig } from "plasmo"

const config: PlasmoConfig = {
  manifest: {
    action: {
      default_title: "微博控评助手"
      // 不设置 default_popup，这样点击图标会触发 sidepanel
    }
  }
}

export default config
