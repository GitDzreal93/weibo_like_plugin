# 🎯 智能标签页管理功能

## 📋 功能概述

新增智能标签页管理功能，根据当前页面情况自动决定是否需要打开新标签页：

- **当前页面是目标页面** → 直接在当前页面执行
- **已有目标页面标签页** → 切换到已存在的标签页
- **没有目标页面** → 创建新标签页

## 🔧 技术实现

### 1. 智能判断逻辑

```javascript
// 1. 检查当前活动标签页
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

if (activeTab && cleanWeiboUrl(activeTab.url) === cleanWeiboUrl(targetUrl)) {
  // 当前页面就是目标页面，直接使用
  return activeTab
}

// 2. 查找已存在的标签页
const matchingTabs = allTabs.filter(tab => 
  cleanWeiboUrl(tab.url) === cleanWeiboUrl(targetUrl)
)

if (matchingTabs.length > 0) {
  // 切换到已存在的标签页
  await chrome.tabs.update(matchingTabs[0].id, { active: true })
  return matchingTabs[0]
}

// 3. 创建新标签页
const tab = await chrome.tabs.create({ url: targetUrl, active: true })
return tab
```

### 2. URL标准化处理

为了准确比较微博URL，实现了智能URL清理功能：

```javascript
function cleanWeiboUrl(url: string): string {
  // 标准化主机名：m.weibo.cn → weibo.com
  // 提取核心路径：/u/5185196272/5176353147060619 → /5185196272/5176353147060619
  // 移除查询参数和片段
  // 返回标准化的URL用于比较
}
```

## 📊 使用场景

### 场景1：当前页面就是目标页面
```
用户操作：
1. 已经打开微博详情页：https://weibo.com/5185196272/5176353147060619
2. 在插件中输入该链接
3. 点击"开始执行"

插件行为：
✅ 检测到当前页面就是目标页面
✅ 直接在当前页面执行任务
❌ 不会打开新标签页

日志显示：
[info] 当前标签页就是目标页面，直接使用
```

### 场景2：已有目标页面的标签页
```
用户操作：
1. 浏览器中已打开目标微博页面（但不是当前活动标签页）
2. 在插件中输入该链接
3. 点击"开始执行"

插件行为：
✅ 检测到已存在目标页面标签页
✅ 自动切换到该标签页
✅ 在该标签页中执行任务
❌ 不会创建新标签页

日志显示：
[info] 找到已存在的标签页，切换到该页面
```

### 场景3：需要创建新标签页
```
用户操作：
1. 当前没有打开目标微博页面
2. 在插件中输入链接
3. 点击"开始执行"

插件行为：
✅ 检测到没有目标页面
✅ 创建新标签页
✅ 在新标签页中执行任务

日志显示：
[info] 创建新标签页
```

## 🎯 优势特点

### 1. **用户体验优化**
- 避免不必要的新标签页创建
- 减少标签页混乱
- 更符合用户操作习惯

### 2. **智能URL匹配**
- 自动处理URL参数差异
- 支持移动版和桌面版URL转换
- 准确识别相同的微博页面

### 3. **资源节省**
- 减少重复页面加载
- 降低内存占用
- 提高执行效率

## 📝 日志示例

执行时会看到详细的判断过程：

```
[info] Attempting to open URL: https://weibo.com/5185196272/5176353147060619?ua=xxx
[info] Cleaned URL: https://weibo.com/5185196272/5176353147060619
[info] Active tab URL: https://weibo.com/5185196272/5176353147060619
[info] 当前标签页就是目标页面，直接使用
[info] 开始分析页面...
[info] 页面加载完成
```

或者：

```
[info] Attempting to open URL: https://weibo.com/5185196272/5176353147060619
[info] Cleaned URL: https://weibo.com/5185196272/5176353147060619
[info] Active tab URL: https://weibo.com/other/page
[info] 找到已存在的标签页，切换到该页面
[info] 开始分析页面...
```

## 🚀 使用方法

1. **重新加载插件**：在Chrome扩展管理页面重新加载插件
2. **正常使用**：功能完全透明，无需额外操作
3. **观察日志**：在执行日志中查看智能判断过程

## ⚙️ 配置说明

此功能无需额外配置，会自动根据以下设置工作：

- **完成后保持标签页打开**：控制任务完成后是否关闭标签页
- 智能标签页管理：自动启用，无法关闭

## 🔍 技术细节

- **文件位置**：`background.ts` 第215-265行
- **核心函数**：`openWeiboTab()` 和 `cleanWeiboUrl()`
- **URL比较**：基于清理后的标准化URL进行精确匹配
- **标签页查询**：使用Chrome Tabs API进行智能查找
