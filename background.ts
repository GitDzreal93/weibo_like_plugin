import type { PlasmoMessaging } from "@plasmohq/messaging"

interface TaskData {
  links: string[]
  settings: {
    keyword: string
    maxLikes: number
    interval: number
  }
}

interface TaskState {
  isRunning: boolean
  currentIndex: number
  totalLinks: number
  currentLink: string
}

let currentTask: TaskState | null = null
let taskAbortController: AbortController | null = null

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message)

  switch (message.action) {
    case 'startTask':
      startTask(message.data)
      break
    case 'stopTask':
      stopTask()
      break
    case 'getTaskState':
      sendResponse(currentTask)
      break
  }

  return true // 保持消息通道开放
})

// 开始任务
async function startTask(taskData: TaskData) {
  if (currentTask?.isRunning) {
    console.log('Task already running, ignoring...')
    return
  }

  console.log('Starting task with data:', taskData)

  currentTask = {
    isRunning: true,
    currentIndex: 0,
    totalLinks: taskData.links.length,
    currentLink: ''
  }

  taskAbortController = new AbortController()

  // 保存任务状态
  await chrome.storage.local.set({ taskState: currentTask })

  // 通知popup更新状态
  notifyPopup('updateStatus')

  try {
    for (let i = 0; i < taskData.links.length; i++) {
      if (taskAbortController.signal.aborted) {
        addLog('任务被用户停止', 'warning')
        break
      }

      const link = taskData.links[i]
      currentTask.currentIndex = i + 1
      currentTask.currentLink = link

      // 更新状态
      await chrome.storage.local.set({ taskState: currentTask })
      notifyPopup('updateStatus')

      addLog(`开始处理第${i + 1}个链接: ${link}`, 'info')

      try {
        // 打开或切换到微博页面
        const tab = await openWeiboTab(link)
        
        if (tab?.id) {
          // 等待页面加载
          await sleep(3000)

          // 执行内容脚本
          await executeContentScript(tab.id, taskData.settings)

          // 等待任务完成
          await sleep(2000)

          addLog(`完成处理第${i + 1}个链接`, 'success')
        } else {
          addLog(`无法打开链接: ${link}`, 'error')
        }

      } catch (error) {
        console.error('Error processing link:', error)
        addLog(`处理链接失败: ${error.message}`, 'error')
      }

      // 添加间隔
      if (i < taskData.links.length - 1) {
        await sleep(1000)
      }
    }

    addLog('所有任务执行完成', 'success')

  } catch (error) {
    console.error('Task execution error:', error)
    addLog(`任务执行出错: ${error.message}`, 'error')
  } finally {
    // 重置任务状态
    currentTask = {
      isRunning: false,
      currentIndex: 0,
      totalLinks: 0,
      currentLink: ''
    }

    await chrome.storage.local.set({ taskState: currentTask })
    notifyPopup('updateStatus')
    taskAbortController = null
  }
}

// 停止任务
async function stopTask() {
  if (taskAbortController) {
    taskAbortController.abort()
  }

  if (currentTask) {
    currentTask.isRunning = false
    await chrome.storage.local.set({ taskState: currentTask })
    notifyPopup('updateStatus')
  }

  addLog('任务已停止', 'warning')
}

// 打开微博标签页
async function openWeiboTab(url: string): Promise<chrome.tabs.Tab | null> {
  try {
    // 查找是否已有相同的标签页
    const tabs = await chrome.tabs.query({ url: url })
    
    if (tabs.length > 0) {
      // 切换到已存在的标签页
      await chrome.tabs.update(tabs[0].id!, { active: true })
      return tabs[0]
    } else {
      // 创建新标签页
      const tab = await chrome.tabs.create({ url: url, active: true })
      return tab
    }
  } catch (error) {
    console.error('Error opening tab:', error)
    return null
  }
}

// 执行内容脚本
async function executeContentScript(tabId: number, settings: any) {
  try {
    // 注入内容脚本（如果还没有注入）
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    })

    // 发送执行任务消息
    await chrome.tabs.sendMessage(tabId, {
      action: 'executeTask',
      settings: settings
    })

  } catch (error) {
    console.error('Error executing content script:', error)
    throw error
  }
}

// 添加日志
async function addLog(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = Date.now()
  const logEntry = {
    message: `[${new Date().toLocaleTimeString()}] ${message}`,
    type,
    timestamp
  }

  // 获取现有日志
  const result = await chrome.storage.local.get(['logs'])
  const logs = result.logs || []
  
  // 添加新日志
  logs.push(logEntry)
  
  // 只保留最近100条
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100)
  }

  // 保存日志
  await chrome.storage.local.set({ logs })

  // 通知popup更新日志
  notifyPopup('addLog', { message: logEntry.message, type })
}

// 通知popup
function notifyPopup(action: string, data?: any) {
  chrome.runtime.sendMessage({
    action,
    ...data
  }).catch(() => {
    // Popup可能已关闭，忽略错误
  })
}

// 延迟函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateProgress') {
    notifyPopup('updateStatus')
  } else if (message.action === 'taskComplete') {
    addLog('当前页面任务完成', 'success')
  } else if (message.action === 'taskError') {
    addLog(`任务出错: ${message.error}`, 'error')
  }
})

console.log('Background script loaded')
