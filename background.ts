interface TaskData {
  links: string[]
  settings: {
    keyword: string
    maxLikes: number
    interval: number
  }
  executionRecord?: ExecutionRecord
}

interface TaskState {
  isRunning: boolean
  currentIndex: number
  totalLinks: number
  currentLink: string
  startTime?: number
  progress?: number
}

interface ExecutionRecord {
  id: string
  timestamp: number
  settings: any
  links: string[]
  status: 'completed' | 'failed' | 'stopped'
  result: {
    totalLinks: number
    processedLinks: number
    successCount: number
    errorCount: number
    duration: number
  }
}

let currentTask: TaskState | null = null
let taskAbortController: AbortController | null = null

// 初始化sidepanel
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

// 监听来自popup/sidepanel的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message)

  switch (message.action) {
    case 'startTask':
      startTask(message.data).then(() => {
        sendResponse({ success: true })
      }).catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
      return true // 保持消息通道开放用于异步响应
    case 'stopTask':
      stopTask().then(() => {
        sendResponse({ success: true })
      }).catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
      return true // 保持消息通道开放用于异步响应
    case 'getTaskState':
      sendResponse(currentTask)
      return false // 同步响应，不需要保持通道开放
  }

  return false // 默认不保持消息通道开放
})

// 开始任务
async function startTask(taskData: TaskData) {
  if (currentTask?.isRunning) {
    console.log('Task already running, ignoring...')
    return
  }

  console.log('Starting task with data:', taskData)

  const startTime = Date.now()

  currentTask = {
    isRunning: true,
    currentIndex: 0,
    totalLinks: taskData.links.length,
    currentLink: '',
    startTime: startTime,
    progress: 0
  }

  taskAbortController = new AbortController()

  // 保存任务状态
  await chrome.storage.local.set({ taskState: currentTask })

  // 通知popup更新状态
  notifyPopup('updateStatus')

  // 初始化执行记录
  let executionRecord = taskData.executionRecord
  if (executionRecord) {
    executionRecord.result.duration = 0
    executionRecord.status = 'completed' // 将在任务结束时更新
  }

  try {
    for (let i = 0; i < taskData.links.length; i++) {
      if (taskAbortController.signal.aborted) {
        addLog('任务被用户停止', 'warning')
        break
      }

      const rawLink = taskData.links[i]
      // 清理URL参数，只保留基本的微博链接
      const link = cleanWeiboUrl(rawLink)

      currentTask.currentIndex = i + 1
      currentTask.currentLink = link

      // 更新状态
      await chrome.storage.local.set({ taskState: currentTask })
      notifyPopup('updateStatus')

      addLog(`开始处理第${i + 1}个链接: ${link}`, 'info')

      // 验证链接格式
      if (!isValidWeiboLink(link)) {
        addLog(`无效的微博链接格式: ${link}`, 'error')
        continue
      }

      try {
        // 打开或切换到微博页面
        const tab = await openWeiboTab(link)

        if (tab?.id) {
          addLog(`成功打开标签页 ID: ${tab.id}`, 'info')

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

    // 更新执行记录为成功
    if (executionRecord) {
      executionRecord.status = 'completed'
      executionRecord.result.duration = Date.now() - startTime
      executionRecord.result.processedLinks = taskData.links.length
      await saveExecutionRecord(executionRecord)
    }

  } catch (error) {
    console.error('Task execution error:', error)
    addLog(`任务执行出错: ${error.message}`, 'error')

    // 更新执行记录为失败
    if (executionRecord) {
      executionRecord.status = 'failed'
      executionRecord.result.duration = Date.now() - startTime
      await saveExecutionRecord(executionRecord)
    }
  } finally {
    // 重置任务状态
    currentTask = {
      isRunning: false,
      currentIndex: 0,
      totalLinks: 0,
      currentLink: '',
      startTime: 0,
      progress: 0
    }

    await chrome.storage.local.set({ taskState: currentTask })
    notifyPopup('updateStatus')
    taskAbortController = null
  }
}

// 停止任务
async function stopTask() {
  console.log('Background: Stopping task...')

  // 立即中止任务控制器
  if (taskAbortController) {
    taskAbortController.abort()
    console.log('Background: Task aborted')
  }

  // 立即更新任务状态
  if (currentTask) {
    console.log('Background: Updating task state to stopped')
    currentTask.isRunning = false
    currentTask.progress = 0

    // 立即保存状态
    await chrome.storage.local.set({ taskState: currentTask })
    console.log('Background: Task state saved')

    // 立即通知UI更新
    notifyPopup('updateStatus')
    console.log('Background: UI notified')

    // 向所有微博标签页发送停止消息
    try {
      const tabs = await chrome.tabs.query({})
      const weiboTabs = tabs.filter(tab =>
        tab.url && (tab.url.includes('weibo.com') || tab.url.includes('m.weibo.cn'))
      )

      console.log(`Background: Found ${weiboTabs.length} weibo tabs`)

      for (const tab of weiboTabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'stopTask' })
            console.log('Background: Stop message sent to tab:', tab.id)
          } catch (error) {
            // 忽略无法发送消息的标签页（可能没有content script）
            console.log('Background: Failed to send stop message to tab:', tab.id, error.message)
          }
        }
      }
    } catch (error) {
      console.error('Background: Error sending stop messages:', error)
    }
  }

  addLog('任务已停止', 'warning')
  console.log('Background: Stop task completed')
}

// 智能打开微博标签页
async function openWeiboTab(url: string): Promise<chrome.tabs.Tab | null> {
  try {
    console.log('Attempting to open URL:', url)

    // 清理URL以便比较
    const cleanUrl = cleanWeiboUrl(url)
    console.log('Cleaned URL:', cleanUrl)

    // 首先检查当前活动标签页是否就是目标页面
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (activeTab && activeTab.url) {
      const activeCleanUrl = cleanWeiboUrl(activeTab.url)
      console.log('Active tab URL:', activeCleanUrl)

      if (activeCleanUrl === cleanUrl) {
        console.log('Current active tab is already the target page, using it:', activeTab.id)
        addLog('当前标签页就是目标页面，直接使用', 'info')
        return activeTab
      }
    }

    // 查找是否已有相同的标签页
    const allTabs = await chrome.tabs.query({})
    const matchingTabs = allTabs.filter(tab => {
      if (!tab.url) return false
      const tabCleanUrl = cleanWeiboUrl(tab.url)
      return tabCleanUrl === cleanUrl
    })

    if (matchingTabs.length > 0) {
      console.log('Found existing tab, switching to it:', matchingTabs[0].id)
      addLog('找到已存在的标签页，切换到该页面', 'info')
      // 切换到已存在的标签页
      await chrome.tabs.update(matchingTabs[0].id!, { active: true })
      return matchingTabs[0]
    } else {
      console.log('Creating new tab for URL:', url)
      addLog('创建新标签页', 'info')
      // 创建新标签页
      const tab = await chrome.tabs.create({ url: url, active: true })
      console.log('Created new tab:', tab.id)
      return tab
    }
  } catch (error) {
    console.error('Error opening tab:', error)
    addLog(`打开标签页失败: ${error.message}`, 'error')
    return null
  }
}

// 等待标签页准备就绪
async function waitForTabReady(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (tab.status === 'complete') {
          resolve()
        } else {
          setTimeout(checkTab, 500)
        }
      } catch (error) {
        reject(error)
      }
    }
    checkTab()
  })
}

// 执行内容脚本 - 修复文件名和错误处理
async function executeContentScript(tabId: number, settings: any) {
  try {
    console.log('Injecting content script into tab:', tabId)

    // 等待标签页完全加载
    await waitForTabReady(tabId)

    // 注入内容脚本（Plasmo 会自动处理文件名）
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['contents/weibo-automation.js']
      })
    } catch (error) {
      // 如果文件不存在，说明 Plasmo 可能使用了不同的文件名
      console.warn('Failed to inject with standard name, content script may already be injected:', error.message)
    }

    console.log('Content script injection attempted')
    addLog('内容脚本注入尝试完成', 'info')

    // 等待一下确保脚本完全加载
    await sleep(1000)

    // 发送执行任务消息
    console.log('Sending executeTask message to content script')
    await chrome.tabs.sendMessage(tabId, {
      action: 'executeTask',
      settings: settings
    })

    console.log('Task message sent to content script')
    addLog('任务消息已发送到内容脚本', 'info')

  } catch (error) {
    console.error('Error executing content script:', error)
    addLog(`执行内容脚本失败: ${error.message}`, 'error')
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

// 清理微博URL，移除不必要的参数，用于URL比较
function cleanWeiboUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // 标准化主机名
    let hostname = urlObj.hostname
    if (hostname === 'm.weibo.cn') {
      hostname = 'weibo.com'
    }

    // 获取路径并移除末尾的斜杠
    let pathname = urlObj.pathname.replace(/\/$/, '')

    // 对于微博详情页，提取核心ID部分
    // 例如：/5185196272/5176353147060619 或 /u/5185196272/5176353147060619
    const weiboDetailMatch = pathname.match(/\/(?:u\/)?(\d+)\/(\d+)/)
    if (weiboDetailMatch) {
      pathname = `/${weiboDetailMatch[1]}/${weiboDetailMatch[2]}`
    }

    // 只保留基本路径，移除所有查询参数和片段
    const cleanedUrl = `https://${hostname}${pathname}`
    console.log(`URL cleaned: ${url} -> ${cleanedUrl}`)
    return cleanedUrl
  } catch (error) {
    console.error('Invalid URL format:', url, error)
    return url // 如果解析失败，返回原URL
  }
}

// 验证微博链接格式
function isValidWeiboLink(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('weibo.com') || urlObj.hostname.includes('m.weibo.cn')
  } catch (error) {
    console.error('Invalid URL format:', url, error)
    return false
  }
}

// 保存执行记录
async function saveExecutionRecord(record: ExecutionRecord) {
  try {
    const result = await chrome.storage.local.get(['executionHistory'])
    const history = result.executionHistory || []

    // 添加新记录到开头
    history.unshift(record)

    // 只保留最近5条记录
    const trimmedHistory = history.slice(0, 5)

    await chrome.storage.local.set({ executionHistory: trimmedHistory })
    console.log('Execution record saved:', record)
  } catch (error) {
    console.error('Failed to save execution record:', error)
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'updateProgress') {
    // 更新进度信息
    if (message.data) {
      addLog(message.data.message, message.data.type || 'info')
    }
    notifyPopup('updateStatus')
  } else if (message.action === 'taskComplete') {
    addLog('当前页面任务完成', 'success')
    notifyPopup('updateStatus')
  } else if (message.action === 'taskError') {
    addLog(`任务出错: ${message.error}`, 'error')
    notifyPopup('updateStatus')
  }
})

console.log('Background script loaded')
