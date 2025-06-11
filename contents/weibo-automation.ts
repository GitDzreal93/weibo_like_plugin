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
let taskSettings: any = {}

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
   * 提取评论数据
   */
  async extractCommentData(element: Element, keyword?: string): Promise<any | null> {
    const text = element.textContent?.trim()
    if (!text || text.length < 5) return null
    
    // 如果指定了关键词，检查是否包含
    if (keyword && !text.includes(keyword)) return null
    
    // 查找点赞按钮
    const likeButton = await this.findLikeButton(element)
    
    return {
      element,
      text,
      likeButton,
      isLiked: likeButton ? this.checkIfLiked(likeButton) : false,
      boundingBox: element.getBoundingClientRect()
    }
  }

  /**
   * 智能查找点赞按钮
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
          return button
        }
      }
    }
    
    return null
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
            htmlElement.onclick ||
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

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message)

  if (message.action === 'executeTask') {
    if (!isTaskRunning) {
      console.log('Starting task execution...')
      executeTask(message.settings)
    } else {
      console.log('Task already running, ignoring...')
    }
  }

  // 发送响应确认消息已收到
  sendResponse({ received: true })
})

// 执行主要任务 - 使用现代化元素查找器
async function executeTask(settings: any) {
  isTaskRunning = true
  taskSettings = settings

  try {
    sendProgress('开始分析页面...', 'info')
    sendProgress(`当前页面URL: ${window.location.href}`, 'info')

    // 等待页面完全加载
    await waitForPageLoad()
    sendProgress('页面加载完成', 'info')

    // 等待额外时间让动态内容加载
    await modernFinder.sleep(3000)
    sendProgress('开始查找评论区...', 'info')

    // 使用现代化方法查找评论区
    const comments = await modernFinder.findComments({
      keyword: settings.keyword,
      maxResults: 100
    })
    
    if (comments.length === 0) {
      sendProgress('未找到评论区，尝试滚动页面加载更多内容...', 'warning')

      // 尝试滚动页面加载评论
      window.scrollTo(0, document.body.scrollHeight)
      await modernFinder.sleep(2000)

      // 再次尝试查找评论
      const commentsAfterScroll = await modernFinder.findComments({
        keyword: settings.keyword,
        maxResults: 100
      })
      
      if (commentsAfterScroll.length === 0) {
        sendProgress('仍未找到评论区，可能页面结构已变化', 'error')
        completeTask()
        return
      }
      comments.push(...commentsAfterScroll)
    }
    
    sendProgress(`找到${comments.length}条评论`, 'info')
    
    // 筛选包含关键词且未点赞的评论
    const targetComments = comments.filter(comment => {
      return comment.text.includes(settings.keyword) && 
             comment.likeButton && 
             !comment.isLiked
    })
    
    if (targetComments.length === 0) {
      sendProgress(`未找到包含"${settings.keyword}"的可点赞评论`, 'warning')
      completeTask()
      return
    }
    
    sendProgress(`找到${targetComments.length}条包含关键词的可点赞评论`, 'info')
    
    // 点赞评论
    const maxLikes = Math.min(targetComments.length, settings.maxLikes)
    let likedCount = 0
    
    for (let i = 0; i < maxLikes; i++) {
      const comment = targetComments[i]
      
      try {
        // 使用现代化的安全点击方法
        await modernFinder.safeClick(comment.likeButton, {
          scrollIntoView: true,
          delay: 500
        })
        
        // 等待一下检查是否点赞成功
        await modernFinder.sleep(1000)
        
        // 检查点赞状态
        const isNowLiked = modernFinder.checkIfLiked(comment.likeButton)
        
        if (isNowLiked) {
          likedCount++
          sendProgress(`成功点赞第${likedCount}条评论: ${comment.text.substring(0, 30)}...`, 'success')
        } else {
          sendProgress(`点赞第${i + 1}条评论可能失败`, 'warning')
        }
        
      } catch (error) {
        sendProgress(`点赞第${i + 1}条评论失败: ${error.message}`, 'warning')
      }
      
      // 添加延迟避免被检测
      if (i < maxLikes - 1) {
        await modernFinder.sleep(settings.interval)
      }
    }
    
    sendProgress(`任务完成，共点赞${likedCount}条评论`, 'success')
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

// 发送进度更新
function sendProgress(message: string, type: string = 'info') {
  console.log(`[${type}] ${message}`)
  try {
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      data: { message, type }
    })
  } catch (error) {
    console.error('Failed to send progress message:', error)
  }
}

// 完成任务
function completeTask() {
  console.log('Task completed')
  try {
    chrome.runtime.sendMessage({
      action: 'taskComplete'
    })
  } catch (error) {
    console.error('Failed to send task complete message:', error)
  }
}
