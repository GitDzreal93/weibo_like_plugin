# 🔧 Extension Context Invalidated 错误解决方案

## 问题描述

你遇到的 "Extension context invalidated" 错误是 Chrome 扩展开发中的常见问题，特别是在使用 Plasmo 框架进行热重载开发时。

## 错误原因

1. **热重载冲突**: Plasmo 的热重载机制与 Chrome 扩展的上下文管理冲突
2. **WebSocket 连接断开**: HMR (热模块替换) 连接中断
3. **扩展重新加载**: 开发过程中扩展被自动重新加载，导致旧的上下文失效

## 解决步骤

### 🚀 快速解决方案

1. **使用重启脚本**:
   ```bash
   ./scripts/restart-dev.sh
   ```

2. **手动重启开发服务器**:
   ```bash
   # 停止当前服务器 (Ctrl+C)
   pnpm run dev
   ```

3. **刷新扩展**:
   - 访问 `chrome://extensions/`
   - 找到 "微博控评助手"
   - 点击刷新按钮 🔄

### 🔍 详细排查步骤

#### 步骤 1: 检查开发服务器状态
```bash
# 检查是否有 plasmo 进程在运行
ps aux | grep plasmo

# 如果有多个进程，杀死所有
pkill -f "plasmo dev"
```

#### 步骤 2: 清理缓存
```bash
# 清理所有缓存
rm -rf build/ .plasmo/ node_modules/.cache/ dist/
```

#### 步骤 3: 重新构建
```bash
# 重新安装依赖（如果需要）
pnpm install

# 启动开发服务器
pnpm run dev
```

#### 步骤 4: 重新加载扩展
1. 打开 `chrome://extensions/`
2. 启用 "开发者模式"
3. 删除现有的 "微博控评助手" 扩展
4. 点击 "加载已解压的扩展程序"
5. 选择 `build/chrome-mv3-dev` 目录

### 🛠️ 代码层面的修复

我已经在代码中添加了以下修复：

#### 1. 内容脚本错误处理
```typescript
// 检查扩展上下文是否有效
if (chrome.runtime?.id) {
  chrome.runtime.sendMessage({...}).catch(error => {
    console.error('Failed to send message:', error)
  })
} else {
  console.warn('Extension context invalidated')
}
```

#### 2. 消息监听器改进
```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    // 处理消息...
    sendResponse({ received: true })
  } catch (error) {
    sendResponse({ received: false, error: error.message })
  }
  return true // 保持消息通道开放
})
```

#### 3. 后台脚本优化
- 添加了标签页状态检查
- 改进了内容脚本注入逻辑
- 增强了错误处理机制

## 预防措施

### 1. 开发最佳实践
- 避免频繁修改代码触发热重载
- 使用 `console.log` 而不是 `debugger` 进行调试
- 定期重启开发服务器

### 2. 扩展设置
- 确保在 `chrome://extensions/` 中启用了所有必要权限
- 检查 "在所有网站上" 权限是否已启用

### 3. 浏览器设置
- 关闭其他可能冲突的扩展
- 使用独立的 Chrome 配置文件进行开发

## 常见错误信息

### ❌ "Extension context invalidated"
**解决**: 重启开发服务器并刷新扩展

### ❌ "Could not establish connection"
**解决**: 检查内容脚本是否正确注入

### ❌ "WebSocket connection failed"
**解决**: 重启开发服务器

### ❌ "PerformanceObserver does not support buffered flag"
**解决**: 这是警告，不影响功能，可以忽略

## 验证修复

修复后，你应该能看到：

1. ✅ 扩展图标正常显示
2. ✅ Popup 界面可以正常打开
3. ✅ 在微博页面控制台看到: "Weibo automation content script loaded on: ..."
4. ✅ 没有 "Extension context invalidated" 错误

## 如果问题仍然存在

1. **检查 Chrome 版本**: 确保使用最新版本的 Chrome
2. **检查 Node.js 版本**: 确保使用 Node.js 16+ 
3. **检查依赖版本**: 运行 `pnpm list` 检查包版本
4. **完全重置**: 删除 `node_modules` 和 `pnpm-lock.yaml`，重新安装

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run dev
```

## 联系支持

如果以上步骤都无法解决问题，请提供：
- Chrome 版本信息
- 完整的错误日志
- 操作系统信息
- 具体的复现步骤
