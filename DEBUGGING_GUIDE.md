# 🔧 Plasmo 扩展调试指南

## 🚀 如何在浏览器中调试你的扩展

### 第一步：启动开发服务器

```bash
pnpm run dev
```

看到这个输出表示成功：
```
🟢 DONE   | Extension re-packaged in 2331ms! 🚀
```

### 第二步：在 Chrome 中加载扩展

#### 1. 打开扩展管理页面
- 地址栏输入：`chrome://extensions/`
- 或者：Chrome菜单 → 更多工具 → 扩展程序

#### 2. 启用开发者模式
- 在页面右上角打开"开发者模式"开关

#### 3. 加载扩展
- 点击"加载已解压的扩展程序"
- 选择项目中的 `build/chrome-mv3-dev` 目录
- 点击"选择文件夹"

### 第三步：查看扩展效果

#### 🎯 Popup 界面
1. **查看扩展图标**
   - 扩展加载后，工具栏会出现你的扩展图标
   - 如果没看到，点击拼图图标查看所有扩展

2. **打开 Popup**
   - 点击扩展图标
   - 会弹出你的 React + Antd 界面

#### 🌐 在微博页面测试
1. **打开微博网站**
   - 访问 `https://weibo.com`
   - 或者 `https://m.weibo.cn`

2. **测试内容脚本**
   - 内容脚本会自动注入到微博页面
   - 可以在控制台看到相关日志

### 第四步：调试技巧

#### 🔍 调试 Popup
1. **右键点击扩展图标** → "检查弹出内容"
2. 会打开 DevTools，可以：
   - 查看 React 组件
   - 调试 JavaScript 代码
   - 查看网络请求
   - 检查样式

#### 🔍 调试 Background Script
1. 在扩展管理页面，点击"检查视图：Service Worker"
2. 可以查看后台脚本的日志和状态

#### 🔍 调试 Content Script
1. 在微博页面按 F12 打开 DevTools
2. 在 Console 中可以看到内容脚本的日志
3. 在 Sources 中可以找到注入的脚本文件

### 第五步：热重载功能

#### ✨ 自动更新
- 修改代码后，Plasmo 会自动重新构建
- 扩展会自动重新加载
- 无需手动刷新

#### 🔄 手动重新加载（如果需要）
- 在扩展管理页面点击刷新按钮
- 或者重新加载扩展

## 🛠️ 常见问题解决

### ❌ 扩展加载失败
**问题**：无法加载扩展
**解决**：
1. 确保选择的是 `build/chrome-mv3-dev` 目录
2. 检查开发服务器是否正在运行
3. 查看扩展管理页面的错误信息

### ❌ Popup 不显示
**问题**：点击图标没有反应
**解决**：
1. 检查 popup.tsx 是否有语法错误
2. 查看扩展的错误信息
3. 右键检查弹出内容查看错误

### ❌ 内容脚本不工作
**问题**：在微博页面没有效果
**解决**：
1. 检查网站权限是否正确
2. 查看浏览器控制台的错误信息
3. 确认内容脚本的匹配规则

### ❌ 样式显示异常
**问题**：Antd 样式不正确
**解决**：
1. 检查 CSS 是否正确加载
2. 查看是否有样式冲突
3. 确认 Antd 版本兼容性

## 📱 测试流程

### 1. 基础功能测试
- [ ] 扩展图标显示正常
- [ ] Popup 界面打开正常
- [ ] 所有设置项可以正常操作
- [ ] 按钮点击有响应

### 2. 微博页面测试
- [ ] 打开微博页面
- [ ] 输入微博链接
- [ ] 点击"开始执行"
- [ ] 查看执行日志
- [ ] 验证点赞功能

### 3. 开发体验测试
- [ ] 修改代码后自动重新加载
- [ ] DevTools 调试正常
- [ ] 错误信息清晰可见

## 🎯 调试最佳实践

### 1. **使用 Console.log**
```typescript
console.log('Popup mounted:', settings)
console.log('Background task started:', taskData)
console.log('Content script found comments:', comments.length)
```

### 2. **使用 Chrome DevTools**
- Elements：检查 DOM 结构
- Console：查看日志和错误
- Network：监控网络请求
- Sources：设置断点调试

### 3. **使用 React DevTools**
- 安装 React Developer Tools 扩展
- 可以查看组件状态和 props
- 调试 React 组件更容易

### 4. **错误处理**
```typescript
try {
  await executeTask(settings)
} catch (error) {
  console.error('Task failed:', error)
  // 显示用户友好的错误信息
}
```

## 🚀 生产环境构建

当开发完成后，构建生产版本：

```bash
pnpm run build
```

生产版本在 `build/chrome-mv3-prod` 目录中，可以：
- 打包成 .crx 文件
- 提交到 Chrome Web Store
- 分发给用户

## 📞 获取帮助

如果遇到问题：
1. 查看 Plasmo 官方文档
2. 检查浏览器控制台错误
3. 查看扩展管理页面的错误信息
4. 使用 `pnpm run build` 检查构建错误
