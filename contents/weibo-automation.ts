import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://weibo.com/*",
    "https://m.weibo.cn/*", 
    "https://www.weibo.com/*"
  ],
  run_at: "document_idle"
}

// 微博页面内容脚本 - 使用 Playwright 最佳实践改进
console.log('Weibo automation content script loaded on:', window.location.href)

let isTaskRunning = false
let likedCommentsMap = new Map<string, boolean>() // 记录已点赞的评论
let taskStartTime = 0 // 任务开始时间
const MAX_TASK_DURATION = 5 * 60 * 1000 // 5分钟最大执行时间

// 现代化元素查找器类
class ModernElementFinder {
  private selectors = {
    // 评论文本选择器（按优先级排序，基于 Playwright 测试结果）
    commentText: [
      '[data-testid="comment-item"] .comment-text',
      '[class*="CommentItem"] [class*="text"]',
      '.Feed_detail .CommentItem_text',
      '.WB_feed_detail .list_con .WB_text',
      '.WB_feed_detail .comment_list .WB_text',
      '.comment-list .comment-item .comment-text',
      '.WB_detail .WB_text',
      '.WB_feed .WB_text',
      '.comment_list_item .WB_text',
      '[class*="comment"] [class*="text"]',
      '[class*="Comment"] [class*="Text"]'
    ],
    
    // 点赞按钮选择器（基于 Playwright 测试验证）
    likeButton: [
      '[data-testid="like-button"]',
      '[aria-label*="点赞"]',
      '[aria-label*="赞"]',
      '[title*="点赞"]',
      '[title*="赞"]',
      '.WB_func .ficon_praise',
      '.WB_func [action-type="feed_list_like"]',
      '.toolbar_item .like',
      '.icon-praise',
      '.icon-like',
      '[class*="like"]:not([class*="unlike"])',
      '[class*="Like"]:not([class*="Unlike"])',
      '[class*="praise"]',
      '[class*="Praise"]',
      '[class*="zan"]',
      '[class*="thumb"]',
      '[class*="heart"]'
    ],
    
    // 评论容器选择器
    commentContainer: [
      '[data-testid="comment-list"]',
      '.comment-list',
      '.WB_feed_detail',
      '.Feed_detail',
      '[class*="comment"]',
      '[class*="Comment"]',
      '[class*="feed"]',
      '[class*="Feed"]'
    ]
  }
  
  private likedIndicators = ['WB_praised', 'praised', 'liked', 'active', 'selected']

  /**
   * 等待元素出现（类似 Playwright 的 waitFor）
   */
  async waitForElement(selector: string, options: { timeout?: number; visible?: boolean } = {}): Promise<Element> {
    const { timeout = 10000, visible = true } = options
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkElement = () => {
        const element = document.querySelector(selector)
        
        if (element) {
          if (!visible || this.isElementVisible(element)) {
            resolve(element)
            return
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`元素 ${selector} 在 ${timeout}ms 内未找到`))
          return
        }
        
        setTimeout(checkElement, 100)
      }
      
      checkElement()
    })
  }

  /**
   * 等待多个选择器中的任一个出现
   */
  async waitForAnyElement(selectors: string[], options: { timeout?: number } = {}): Promise<{ element: Element; selector: string }> {
    const { timeout = 10000 } = options
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkElements = () => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (element && this.isElementVisible(element)) {
            resolve({ element, selector })
            return
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`所有选择器在 ${timeout}ms 内都未找到元素`))
          return
        }
        
        setTimeout(checkElements, 100)
      }
      
      checkElements()
    })
  }

  /**
   * 智能查找评论元素
   */
  async findComments(options: { keyword?: string; maxResults?: number } = {}): Promise<any[]> {
    const { keyword, maxResults = 50 } = options
    const comments: any[] = []
    
    // 首先尝试等待评论容器加载
    try {
      await this.waitForAnyElement(this.selectors.commentContainer, { timeout: 5000 })
    } catch (error) {
      console.log('评论容器未找到，继续尝试其他方法')
    }
    
    // 尝试各种评论选择器
    for (const selector of this.selectors.commentText) {
      const elements = document.querySelectorAll(selector)
      
      for (const element of elements) {
        if (comments.length >= maxResults) break
        
        const commentData = await this.extractCommentData(element, keyword)
        if (commentData) {
          comments.push(commentData)
        }
      }
      
      if (comments.length > 0) {
        console.log(`使用选择器 ${selector} 找到 ${comments.length} 条评论`)
        break
      }
    }
    
    // 如果还没找到，使用文本搜索
    if (comments.length === 0 && keyword) {
      const keywordComments = await this.findCommentsByText(keyword)
      comments.push(...keywordComments)
    }
    
    return comments
  }

  /**
   * 通过文本内容查找评论
   */
  async findCommentsByText(keyword: string): Promise<any[]> {
    const comments: any[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent?.trim() || ''
          return text.includes(keyword) && text.length > keyword.length + 5 && text.length < 500
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT
        }
      }
    )
    
    let node: Text | null
    while (node = walker.nextNode() as Text) {
      const element = node.parentElement
      if (element && this.isElementVisible(element)) {
        const commentData = await this.extractCommentData(element, keyword)
        if (commentData) {
          comments.push(commentData)
        }
      }
    }
    
    return comments
  }

  /**
   * 提取评论数据（排除头条微博）
   */
  async extractCommentData(element: Element, keyword?: string): Promise<any | null> {
    const text = element.textContent?.trim()
    if (!text || text.length < 5) return null

    // 如果指定了关键词，检查是否包含
    if (keyword && !text.includes(keyword)) return null

    // 查找点赞按钮（会自动排除头条微博的点赞按钮）
    const likeButton = await this.findLikeButton(element)

    // 如果没有找到点赞按钮，可能是因为被排除了头条微博
    if (!likeButton && keyword && text.includes(keyword)) {
      console.log(`评论包含关键词但无可用点赞按钮（可能是头条微博）: ${text.substring(0, 50)}...`)
    }

    return {
      element,
      text,
      likeButton,
      isLiked: likeButton ? this.checkIfLiked(likeButton) : false,
      boundingBox: element.getBoundingClientRect()
    }
  }

  /**
   * 智能查找点赞按钮（排除头条微博的点赞按钮）
   */
  async findLikeButton(commentElement: Element): Promise<Element | null> {
    // 从评论元素向上查找包含点赞按钮的容器
    let container = commentElement

    for (let level = 0; level < 8; level++) {
      if (!container || !container.parentElement) break
      container = container.parentElement

      // 在当前容器中查找点赞按钮
      for (const selector of this.selectors.likeButton) {
        const button = container.querySelector(selector)
        if (button && this.isClickableElement(button)) {
          // 检查是否是头条微博的点赞按钮，如果是则跳过
          if (this.isMainWeiboLikeButton(button)) {
            console.log('跳过头条微博点赞按钮')
            continue
          }
          return button
        }
      }
    }

    return null
  }

  /**
   * 检查是否是头条微博的点赞按钮（需要排除的）
   */
  private isMainWeiboLikeButton(button: Element): boolean {
    // 头条微博点赞按钮的特征选择器
    const mainWeiboSelectors = [
      // 头条微博容器的特征类名
      '.WB_feed_type',
      '.Feed_main',
      '.WB_detail',
      '.WB_feed_detail .WB_info',
      '.Feed_detail .Feed_main',
      '[class*="main"]',
      '[class*="Main"]',
      // 头条微博的工具栏
      '.WB_func',
      '.toolbar',
      '.Feed_func',
      '[class*="toolbar"]',
      '[class*="Toolbar"]'
    ]

    // 检查按钮是否在头条微博的容器中
    let element = button.parentElement
    let checkLevel = 0

    while (element && checkLevel < 10) {
      // 检查是否匹配头条微博容器的特征
      for (const selector of mainWeiboSelectors) {
        if (element.matches && element.matches(selector)) {
          // 进一步检查是否确实是头条微博区域
          if (this.isInMainWeiboArea(element)) {
            return true
          }
        }
      }

      element = element.parentElement
      checkLevel++
    }

    return false
  }

  /**
   * 检查元素是否在头条微博区域内
   */
  private isInMainWeiboArea(element: Element): boolean {
    // 头条微博区域的特征：
    // 1. 通常在页面顶部或主要内容区域
    // 2. 包含发布者信息、微博内容、工具栏等
    // 3. 不在评论列表容器内

    const rect = element.getBoundingClientRect()
    const isInTopArea = rect.top < window.innerHeight * 0.6 // 在页面上半部分

    // 检查是否在评论区域内（如果在评论区域内，则不是头条微博）
    const commentAreaSelectors = [
      '.comment-list',
      '.WB_feed_detail .list_con',
      '.Feed_detail .comment',
      '[class*="comment"]',
      '[class*="Comment"]',
      '.WB_feed_detail .comment_list',
      '[data-testid="comment-list"]'
    ]

    let parent = element.parentElement
    let level = 0
    while (parent && level < 8) {
      for (const selector of commentAreaSelectors) {
        if (parent.matches && parent.matches(selector)) {
          return false // 在评论区域内，不是头条微博
        }
      }
      parent = parent.parentElement
      level++
    }

    // 如果在页面顶部且不在评论区域内，很可能是头条微博
    return isInTopArea
  }

  /**
   * 检查元素是否可见
   */
  isElementVisible(element: Element): boolean {
    if (!element) return false
    
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0
  }

  /**
   * 检查元素是否可点击
   */
  isClickableElement(element: Element): boolean {
    if (!element || !this.isElementVisible(element)) return false

    const htmlElement = element as HTMLElement
    const style = window.getComputedStyle(element)
    return !htmlElement.hasAttribute('disabled') &&
           style.pointerEvents !== 'none' &&
           (element.tagName === 'BUTTON' ||
            element.tagName === 'A' ||
            !!htmlElement.onclick ||
            element.getAttribute('role') === 'button' ||
            style.cursor === 'pointer')
  }

  /**
   * 检查是否已点赞
   */
  checkIfLiked(likeButton: Element): boolean {
    if (!likeButton) return false
    
    // 检查类名指示器
    for (const indicator of this.likedIndicators) {
      if (likeButton.classList.contains(indicator)) {
        return true
      }
    }
    
    // 检查颜色变化
    const style = window.getComputedStyle(likeButton)
    const color = style.color
    if (color.includes('rgb(255') || color.includes('#ff') || 
        color.includes('#f4') || color.includes('orange') ||
        color.includes('red')) {
      return true
    }
    
    return false
  }

  /**
   * 安全点击元素
   */
  async safeClick(element: Element, options: { scrollIntoView?: boolean; delay?: number } = {}): Promise<boolean> {
    const { scrollIntoView = true, delay = 500 } = options
    
    if (!element || !this.isClickableElement(element)) {
      throw new Error('元素不可点击')
    }
    
    if (scrollIntoView) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await this.sleep(delay)
    }
    
    // 模拟真实用户点击
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    
    // 触发鼠标事件序列
    const events = ['mousedown', 'mouseup', 'click']
    for (const eventType of events) {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      })
      element.dispatchEvent(event)
      await this.sleep(50)
    }
    
    return true
  }

  /**
   * 延迟函数
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 创建全局实例
const modernFinder = new ModernElementFinder()

// 监听来自background的消息 - 添加错误处理
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message)

  try {
    if (message.action === 'executeTask') {
      if (!isTaskRunning) {
        console.log('Starting task execution...')
        executeTask(message.settings).catch(error => {
          console.error('Task execution failed:', error)
          sendProgress(`任务执行失败: ${error.message}`, 'error')
        })
      } else {
        console.log('Task already running, ignoring...')
      }
    }

    // 发送响应确认消息已收到
    sendResponse({ received: true })
  } catch (error) {
    console.error('Error in message listener:', error)
    sendResponse({ received: false, error: error.message })
  }

  return true // 保持消息通道开放
})

// 生成评论唯一标识
function generateCommentId(comment: any): string {
  // 使用评论文本的前50个字符 + 位置信息作为唯一标识
  const textHash = comment.text.substring(0, 50).replace(/\s+/g, '')
  const position = comment.boundingBox ? `${Math.round(comment.boundingBox.top)}_${Math.round(comment.boundingBox.left)}` : 'unknown'
  return `${textHash}_${position}`
}

// 检查是否超时
function isTaskTimeout(): boolean {
  return taskStartTime > 0 && (Date.now() - taskStartTime) > MAX_TASK_DURATION
}

// 格式化剩余时间
function formatRemainingTime(): string {
  if (taskStartTime === 0) return '未知'
  const elapsed = Date.now() - taskStartTime
  const remaining = Math.max(0, MAX_TASK_DURATION - elapsed)
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${minutes}分${seconds}秒`
}

// 执行主要任务 - 使用现代化元素查找器
async function executeTask(settings: any) {
  isTaskRunning = true
  taskStartTime = Date.now()
  likedCommentsMap.clear() // 清空之前的记录

  sendProgress('🚀 任务开始执行', 'info')
  sendProgress(`⏰ 最大执行时间: 5分钟`, 'info')
  sendProgress(`🎯 目标关键词: "${settings.keyword}"`, 'info')
  sendProgress(`👍 最大点赞数: ${settings.maxLikes}`, 'info')
  sendProgress(`⏱️ 点赞间隔: ${settings.interval}ms`, 'info')

  try {
    sendProgress('开始分析页面...', 'info')
    sendProgress(`当前页面URL: ${window.location.href}`, 'info')

    // 等待页面完全加载
    await waitForPageLoad()
    sendProgress('页面加载完成', 'info')

    // 等待额外时间让动态内容加载
    await modernFinder.sleep(3000)
    sendProgress('开始查找评论区...', 'info')

    // 使用智能滚动查找评论区
    sendProgress('正在查找评论区（排除头条微博）...', 'info')
    let comments = await modernFinder.findComments({
      keyword: settings.keyword,
      maxResults: 100
    })

    // 如果没找到评论，进行智能滚动
    if (comments.length === 0) {
      sendProgress('未找到评论区，开始智能滚动加载更多内容...', 'warning')

      // 先尝试调试页面结构
      await debugPageStructure()

      comments = await performIntelligentScroll(settings.keyword)
    }

    sendProgress(`找到${comments.length}条评论（已排除头条微博）`, 'info')
    
    // 筛选包含关键词且未点赞的评论（已排除头条微博）
    sendProgress(`开始筛选包含关键词"${settings.keyword}"的评论...`, 'info')

    const targetComments = comments.filter(comment => {
      const hasKeyword = comment.text.includes(settings.keyword)
      const hasLikeButton = !!comment.likeButton
      const notLiked = !comment.isLiked

      if (hasKeyword && !hasLikeButton) {
        sendProgress(`评论包含关键词但无点赞按钮: ${comment.text.substring(0, 30)}...`, 'warning')
      }

      return hasKeyword && hasLikeButton && notLiked
    })

    if (targetComments.length === 0) {
      sendProgress(`未找到包含"${settings.keyword}"的可点赞评论（头条微博已排除）`, 'warning')
      completeTask()
      return
    }

    sendProgress(`📋 找到${targetComments.length}条包含关键词的可点赞评论（已排除头条微博）`, 'success')

    // 开始智能点赞流程
    const finalLikedCount = await performIntelligentLiking(targetComments, settings)

    sendProgress(`🏁 任务执行完成，共点赞${finalLikedCount}条评论`, 'success')
    completeTask()
    
  } catch (error) {
    sendProgress(`任务执行出错: ${error.message}`, 'error')
    chrome.runtime.sendMessage({
      action: 'taskError',
      error: error.message
    })
  } finally {
    isTaskRunning = false
  }
}

// 等待页面加载
function waitForPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve()
    } else {
      window.addEventListener('load', () => resolve())
    }
  })
}

// 发送进度更新 - 添加上下文检查
function sendProgress(message: string, type: string = 'info') {
  console.log(`[${type}] ${message}`)
  try {
    // 检查扩展上下文是否有效
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        data: { message, type }
      }).catch(error => {
        console.error('Failed to send progress message:', error)
      })
    } else {
      console.warn('Extension context invalidated, cannot send progress message')
    }
  } catch (error) {
    console.error('Failed to send progress message:', error)
  }
}

// 调试页面结构
async function debugPageStructure() {
  sendProgress('开始调试页面结构...', 'info')

  // 检查页面基本信息
  sendProgress(`页面标题: ${document.title}`, 'info')
  sendProgress(`页面URL: ${window.location.href}`, 'info')
  sendProgress(`页面高度: ${document.body.scrollHeight}px`, 'info')

  // 查找可能的评论容器
  const possibleContainers = [
    '.WB_feed_detail',
    '.Feed_detail',
    '.comment-list',
    '.WB_feed_detail .list_con',
    '[class*="comment"]',
    '[class*="Comment"]',
    '[data-testid*="comment"]'
  ]

  for (const selector of possibleContainers) {
    const elements = document.querySelectorAll(selector)
    if (elements.length > 0) {
      sendProgress(`找到容器 ${selector}: ${elements.length}个`, 'info')
    }
  }

  // 查找包含文本的元素
  const textElements = document.querySelectorAll('div, span, p')
  let textCount = 0
  for (const element of textElements) {
    const text = element.textContent?.trim()
    if (text && text.length > 10 && text.length < 200) {
      textCount++
      if (textCount <= 5) {
        sendProgress(`文本元素示例: ${text.substring(0, 50)}...`, 'info')
      }
    }
  }
  sendProgress(`总共找到${textCount}个可能的文本元素`, 'info')
}

// 智能点赞流程
async function performIntelligentLiking(targetComments: any[], settings: any): Promise<number> {
  const maxLikes = Math.min(targetComments.length, settings.maxLikes)
  let likedCount = 0
  let attemptCount = 0
  let scrollAttempts = 0
  const maxScrollAttempts = 20

  sendProgress(`🎯 开始智能点赞流程，目标点赞数: ${maxLikes}`, 'info')
  sendProgress(`⏰ 剩余时间: ${formatRemainingTime()}`, 'info')

  while (likedCount < maxLikes && !isTaskTimeout()) {
    // 检查是否需要滚动寻找更多评论
    if (attemptCount >= targetComments.length && scrollAttempts < maxScrollAttempts) {
      sendProgress(`📜 当前评论已处理完，尝试滚动寻找更多评论 (${scrollAttempts + 1}/${maxScrollAttempts})`, 'info')
      sendProgress(`📊 当前状态: 已点赞${likedCount}/${maxLikes}, 已处理${attemptCount}/${targetComments.length}条评论`, 'info')

      // 记录滚动前的页面状态
      const beforeScrollY = window.scrollY
      const beforeScrollHeight = document.body.scrollHeight

      // 滚动页面 - 使用更大的滚动距离
      const scrollDistance = window.innerHeight * 1.2 // 增加滚动距离
      window.scrollTo({
        top: beforeScrollY + scrollDistance,
        behavior: 'smooth'
      })

      sendProgress(`📜 滚动距离: ${scrollDistance}px, 从${beforeScrollY}px到${beforeScrollY + scrollDistance}px`, 'info')
      await modernFinder.sleep(3000) // 增加等待时间

      // 检查页面是否有新内容加载
      const afterScrollHeight = document.body.scrollHeight
      if (afterScrollHeight > beforeScrollHeight) {
        sendProgress(`📈 页面高度增加: ${beforeScrollHeight}px → ${afterScrollHeight}px`, 'success')
      } else {
        sendProgress(`📊 页面高度未变化: ${beforeScrollHeight}px`, 'warning')
      }

      // 查找新的评论
      const newComments = await modernFinder.findComments({
        keyword: settings.keyword,
        maxResults: 50 // 增加搜索数量
      })

      sendProgress(`🔍 滚动后找到${newComments.length}条评论（包含已处理的）`, 'info')

      // 过滤已处理的评论
      const unprocessedComments = newComments.filter(comment => {
        const commentId = generateCommentId(comment)
        const isNotProcessed = !likedCommentsMap.has(commentId)
        const hasKeyword = comment.text.includes(settings.keyword)
        const hasLikeButton = comment.likeButton
        const notLiked = !comment.isLiked

        return isNotProcessed && hasKeyword && hasLikeButton && notLiked
      })

      if (unprocessedComments.length > 0) {
        targetComments.push(...unprocessedComments)
        sendProgress(`✅ 滚动后找到${unprocessedComments.length}条新的可点赞评论，总评论数: ${targetComments.length}`, 'success')
        // 重置attemptCount，从新评论开始处理
        // attemptCount保持不变，让循环继续处理新评论
      } else {
        sendProgress(`⚠️ 滚动后未找到新的可点赞评论`, 'warning')

        // 如果连续几次滚动都没找到新评论，可能已经到底了
        if (scrollAttempts >= 3) {
          // 检查是否已经滚动到页面底部
          const isAtBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 200
          if (isAtBottom) {
            sendProgress(`📄 已滚动到页面底部，停止继续滚动`, 'info')
            break
          }
        }
      }

      scrollAttempts++
      continue
    }

    // 如果没有更多评论可处理且已经尝试过滚动，退出
    if (attemptCount >= targetComments.length) {
      if (scrollAttempts >= maxScrollAttempts) {
        sendProgress(`📝 已处理所有可用评论且达到最大滚动次数，停止点赞`, 'info')
        break
      } else {
        sendProgress(`📝 当前评论已处理完，将尝试滚动寻找更多评论`, 'info')
        // 继续循环，让滚动逻辑处理
        continue
      }
    }

    const comment = targetComments[attemptCount]
    attemptCount++

    // 生成评论唯一标识
    const commentId = generateCommentId(comment)

    // 检查是否已经点赞过
    if (likedCommentsMap.has(commentId)) {
      sendProgress(`⏭️ 跳过已点赞的评论: ${comment.text.substring(0, 30)}...`, 'info')
      continue
    }

    // 检查超时
    if (isTaskTimeout()) {
      sendProgress(`⏰ 任务执行超时 (5分钟)，停止点赞`, 'warning')
      break
    }

    try {
      sendProgress(`👍 准备点赞第${likedCount + 1}条评论: ${comment.text.substring(0, 30)}...`, 'info')

      // 滚动到评论位置
      comment.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await modernFinder.sleep(500)

      // 再次检查点赞状态（可能在滚动过程中状态发生变化）
      const currentLikeStatus = modernFinder.checkIfLiked(comment.likeButton)
      if (currentLikeStatus) {
        sendProgress(`⚠️ 评论已被点赞，跳过: ${comment.text.substring(0, 30)}...`, 'warning')
        likedCommentsMap.set(commentId, true)
        continue
      }

      // 执行点赞
      await modernFinder.safeClick(comment.likeButton, {
        scrollIntoView: false, // 已经滚动过了
        delay: 300
      })

      // 等待点赞生效
      await modernFinder.sleep(1000)

      // 检查点赞是否成功
      const isNowLiked = modernFinder.checkIfLiked(comment.likeButton)

      if (isNowLiked) {
        likedCount++
        likedCommentsMap.set(commentId, true)
        sendProgress(`✅ 成功点赞第${likedCount}条评论: ${comment.text.substring(0, 30)}...`, 'success')
        sendProgress(`📊 进度: ${likedCount}/${maxLikes} | 剩余时间: ${formatRemainingTime()}`, 'info')
      } else {
        sendProgress(`❌ 点赞失败或被取消: ${comment.text.substring(0, 30)}...`, 'warning')
      }

      // 记录已处理（无论成功失败）
      likedCommentsMap.set(commentId, true)

    } catch (error) {
      sendProgress(`❌ 点赞过程出错: ${error.message}`, 'error')
      likedCommentsMap.set(commentId, true) // 标记为已处理避免重复
    }

    // 添加延迟避免被检测
    if (likedCount < maxLikes && !isTaskTimeout()) {
      sendProgress(`⏳ 等待${settings.interval}ms后继续...`, 'info')
      await modernFinder.sleep(settings.interval)
    }
  }

  // 任务完成总结
  const totalTime = Date.now() - taskStartTime
  const minutes = Math.floor(totalTime / 60000)
  const seconds = Math.floor((totalTime % 60000) / 1000)

  sendProgress(`🎉 点赞任务完成！`, 'success')
  sendProgress(`📊 最终统计: 成功点赞 ${likedCount}/${maxLikes} 条评论`, 'success')
  sendProgress(`⏱️ 总耗时: ${minutes}分${seconds}秒`, 'info')
  sendProgress(`📝 处理评论总数: ${attemptCount}`, 'info')
  sendProgress(`📜 滚动次数: ${scrollAttempts}`, 'info')

  return likedCount
}

// 智能滚动查找评论
async function performIntelligentScroll(keyword: string): Promise<any[]> {
  const maxScrolls = 20
  let scrollCount = 0
  let allComments: any[] = []
  let lastScrollHeight = 0

  sendProgress(`开始智能滚动，最多滚动${maxScrolls}次...`, 'info')

  while (scrollCount < maxScrolls) {
    scrollCount++

    // 记录当前页面高度
    const currentScrollHeight = document.body.scrollHeight

    // 模拟正常浏览速度滚动
    const scrollDistance = window.innerHeight * 0.8 // 每次滚动80%的视窗高度
    const currentScrollTop = window.scrollY
    const targetScrollTop = currentScrollTop + scrollDistance

    sendProgress(`第${scrollCount}次滚动，目标位置: ${Math.round(targetScrollTop)}px`, 'info')

    // 平滑滚动
    window.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    })

    // 等待滚动完成和内容加载
    await modernFinder.sleep(2000)

    // 查找新的评论
    const newComments = await modernFinder.findComments({
      keyword: keyword,
      maxResults: 50
    })

    if (newComments.length > 0) {
      // 过滤重复评论
      const uniqueNewComments = newComments.filter(newComment =>
        !allComments.some(existingComment =>
          existingComment.text === newComment.text
        )
      )

      if (uniqueNewComments.length > 0) {
        allComments.push(...uniqueNewComments)
        sendProgress(`滚动后找到${uniqueNewComments.length}条新评论，总计${allComments.length}条`, 'success')

        // 如果找到足够的评论，可以提前结束
        if (allComments.length >= 10) {
          sendProgress('已找到足够的评论，停止滚动', 'info')
          break
        }
      }
    }

    // 检查是否已经滚动到底部
    if (currentScrollHeight === lastScrollHeight) {
      sendProgress('页面高度未变化，可能已到达底部', 'warning')
      // 再尝试几次
      if (scrollCount > maxScrolls - 3) {
        break
      }
    }

    lastScrollHeight = currentScrollHeight

    // 检查是否已经滚动到页面底部
    if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 100) {
      sendProgress('已滚动到页面底部', 'info')
      break
    }
  }

  sendProgress(`智能滚动完成，共滚动${scrollCount}次，找到${allComments.length}条评论`, 'info')
  return allComments
}

// 完成任务 - 添加上下文检查
function completeTask() {
  console.log('Task completed')
  try {
    // 检查扩展上下文是否有效
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        action: 'taskComplete'
      }).catch(error => {
        console.error('Failed to send task complete message:', error)
      })
    } else {
      console.warn('Extension context invalidated, cannot send task complete message')
    }
  } catch (error) {
    console.error('Failed to send task complete message:', error)
  }
}
