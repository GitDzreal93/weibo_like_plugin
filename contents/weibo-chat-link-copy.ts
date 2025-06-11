import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://api.weibo.com/chat*"
  ],
  run_at: "document_idle"
}

// 微博聊天页面链接复制功能
console.log('Weibo chat link copy script loaded on:', window.location.href)

// 复制图标 SVG
const COPY_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 2C4 0.895431 4.89543 0 6 0H14C15.1046 0 16 0.895431 16 2V10C16 11.1046 15.1046 12 14 12H12V14C12 15.1046 11.1046 16 10 16H2C0.895431 16 0 15.1046 0 14V6C0 4.89543 0.895431 4 2 4H4V2ZM4 6H2V14H10V12H6C4.89543 12 4 11.1046 4 10V6ZM6 2V10H14V2H6Z" fill="currentColor"/>
</svg>
`

// 复制成功图标 SVG
const CHECK_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" fill="currentColor"/>
</svg>
`

class WeiboLinkCopyManager {
  private observer: MutationObserver | null = null
  private processedMessages = new Set<Element>()
  private isProcessing = false

  constructor() {
    this.init()
  }

  private init() {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startObserving())
    } else {
      this.startObserving()
    }
  }

  private startObserving() {
    console.log('Starting to observe chat messages...')
    console.log('Current URL:', window.location.href)

    // 监听DOM变化，包括聊天切换
    this.observer = new MutationObserver((mutations) => {
      if (this.isProcessing) return // 防止重复处理

      this.isProcessing = true
      let shouldReprocessAll = false
      let hasNewMessages = false

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有大量节点被移除（可能是聊天切换）
          if (mutation.removedNodes.length > 3) {
            shouldReprocessAll = true
          }

          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element

              // 检查新增的元素
              this.processNewElement(element)
              hasNewMessages = true

              // 如果新增了大量元素，可能是聊天切换
              const messageCount = element.querySelectorAll('*').length
              if (messageCount > 10) {
                shouldReprocessAll = true
              }
            }
          })
        }
      })

      // 如果检测到可能的聊天切换，重新处理所有消息
      if (shouldReprocessAll) {
        console.log('Detected potential chat switch, reprocessing all messages...')
        setTimeout(() => {
          this.processedMessages.clear() // 清除已处理记录
          this.processExistingMessages()
        }, 500) // 延迟确保DOM更新完成
      }

      // 延迟重置处理标志
      setTimeout(() => {
        this.isProcessing = false
      }, 100)
    })

    // 观察整个body以捕获聊天切换
    console.log('Observing document body for chat changes')
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // 初始处理现有消息
    setTimeout(() => {
      this.processExistingMessages()
    }, 1000)

  }

  private findChatContainer(): Element | null {
    // 尝试找到聊天消息容器，减少观察范围
    const selectors = [
      '[class*="chat"]',
      '[class*="message"]',
      '[class*="conversation"]',
      '[id*="chat"]',
      '[id*="message"]'
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) {
        return element
      }
    }

    return null
  }

  // 手动触发处理现有消息（仅用于测试按钮）
  public processExistingMessages() {
    console.log('Processing existing messages...')

    // 只查找可见的包含"网页链接"的元素
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent || ''
          if (text.includes('网页链接')) {
            const element = node.parentElement
            if (element && this.isElementVisible(element)) {
              return NodeFilter.FILTER_ACCEPT
            }
          }
          return NodeFilter.FILTER_REJECT
        }
      }
    )

    let foundCount = 0
    let node
    while (node = walker.nextNode()) {
      const element = node.parentElement
      if (element && !this.processedMessages.has(element)) {
        console.log('Found visible element with "网页链接":', element)
        foundCount++
        this.processMessageElement(element)
      }
    }

    console.log(`Found ${foundCount} visible elements containing "网页链接"`)
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 &&
           rect.top >= 0 && rect.left >= 0 &&
           rect.bottom <= window.innerHeight &&
           rect.right <= window.innerWidth
  }

  private processNewElement(element: Element) {
    // 处理包含"网页链接"文本的新元素
    const text = element.textContent || ''
    if (text.includes('网页链接')) {
      this.processMessageElement(element)
    }

    // 递归检查所有子元素
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const nodeText = node.textContent || ''
          return nodeText.includes('网页链接') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        }
      }
    )

    let node
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        this.processMessageElement(node as Element)
      }
    }
  }

  private processMessageElement(element: Element) {
    // 避免重复处理
    if (this.processedMessages.has(element)) {
      return
    }

    const textContent = element.textContent || ''

    // 检查是否包含"网页链接"
    if (textContent.includes('网页链接')) {
      console.log('Found message with web link:', textContent.substring(0, 100))
      console.log('Element:', element)

      // 检查是否已经有复制按钮
      if (!element.querySelector('.weibo-chat-copy-btn')) {
        try {
          this.addCopyButtonToLinkText(element)
          this.processedMessages.add(element)
        } catch (error) {
          console.log('Error adding copy button:', error)
          // 即使失败也标记为已处理，避免重复尝试
          this.processedMessages.add(element)
        }
      }
    }
  }

  private addCopyButtonToLinkText(messageElement: Element) {
    console.log('Attempting to add copy button next to "网页链接" text')

    // 查找包含"网页链接"的具体文本节点
    const linkTextNode = this.findLinkTextNode(messageElement)
    if (!linkTextNode) {
      console.log('Could not find "网页链接" text node')
      return
    }

    // 查找链接URL
    const linkUrl = this.extractLinkFromMessage(messageElement)
    console.log('Extracted link URL:', linkUrl)

    const urlToCopy = linkUrl || 'https://weibo.com/example'

    // 创建复制按钮
    const copyButton = this.createCopyButton(urlToCopy)

    // 在"网页链接"文本右侧插入按钮
    this.insertCopyButtonAfterText(linkTextNode, copyButton)
    console.log('Copy button added successfully next to "网页链接"')
  }

  private findLinkTextNode(element: Element): Text | null {
    try {
      // 使用TreeWalker查找包含"网页链接"的文本节点
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent || ''
            return text.includes('网页链接') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
          }
        }
      )

      return walker.nextNode() as Text | null
    } catch (error) {
      console.log('Error in findLinkTextNode:', error)

      // 备用方法：递归查找
      try {
        return this.findTextNodeRecursive(element, '网页链接')
      } catch (fallbackError) {
        console.log('Fallback text node search also failed:', fallbackError)
        return null
      }
    }
  }

  private findTextNodeRecursive(node: Node, searchText: string): Text | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text.includes(searchText)) {
        return node as Text
      }
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      const result = this.findTextNodeRecursive(node.childNodes[i], searchText)
      if (result) {
        return result
      }
    }

    return null
  }

  private extractLinkFromMessage(element: Element): string | null {
    console.log('Extracting link from element:', element)
    console.log('Element HTML:', element.outerHTML.substring(0, 200))
    console.log('Element text:', element.textContent?.substring(0, 100))

    // 方法1: 查找 a 标签
    const linkElements = element.querySelectorAll('a[href]')
    console.log('Found link elements:', linkElements.length)

    for (const linkElement of linkElements) {
      const href = linkElement.getAttribute('href')
      console.log('Checking href:', href)
      if (href && this.isValidUrl(href)) {
        console.log('Valid URL found in a tag:', href)
        return href
      }
    }

    // 方法2: 查找所有可能包含URL的属性
    const allElements = element.querySelectorAll('*')
    for (const el of allElements) {
      // 检查常见的URL属性
      const urlAttributes = ['href', 'src', 'data-url', 'data-link', 'data-href', 'data-target']
      for (const attr of urlAttributes) {
        const value = el.getAttribute(attr)
        if (value && this.isValidUrl(value)) {
          console.log(`Valid URL found in ${attr} attribute:`, value)
          return value
        }
      }

      // 检查所有data-*属性
      const dataAttributes = el.getAttributeNames().filter(name => name.startsWith('data-'))
      for (const attr of dataAttributes) {
        const value = el.getAttribute(attr)
        if (value && this.isValidUrl(value)) {
          console.log(`Valid URL found in ${attr} attribute:`, value)
          return value
        }
      }
    }

    // 方法3: 从文本中提取 URL
    const text = element.textContent || ''
    const urlRegex = /(https?:\/\/[^\s\u4e00-\u9fff]+)/g
    const matches = text.match(urlRegex)
    if (matches && matches.length > 0) {
      for (const match of matches) {
        if (this.isValidUrl(match)) {
          console.log('Valid URL found in text:', match)
          return match
        }
      }
    }

    // 方法4: 查找微博特有的链接格式
    const weiboUrlRegex = /(?:https?:\/\/)?(?:www\.)?weibo\.com\/[^\s\u4e00-\u9fff]*/g
    const weiboMatches = text.match(weiboUrlRegex)
    if (weiboMatches && weiboMatches.length > 0) {
      for (const match of weiboMatches) {
        let url = match
        if (!url.startsWith('http')) {
          url = 'https://' + url
        }
        if (this.isValidUrl(url)) {
          console.log('Valid Weibo URL found:', url)
          return url
        }
      }
    }

    console.log('No valid URL found in element')
    return null
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private createCopyButton(linkUrl: string): HTMLElement {
    const button = document.createElement('button')
    button.className = 'weibo-chat-copy-btn'
    button.innerHTML = COPY_ICON_SVG

    // 显示实际的URL作为title
    const displayUrl = linkUrl.length > 50 ? linkUrl.substring(0, 47) + '...' : linkUrl
    button.title = `复制链接: ${displayUrl}`
    
    // 添加样式 - 更小更紧凑，适合紧贴文本
    Object.assign(button.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      borderRadius: '2px',
      color: '#999',
      transition: 'all 0.2s ease',
      marginLeft: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      fontSize: '12px',
      verticalAlign: 'middle'
    })

    // 悬停效果和URL显示
    let urlTooltip: HTMLElement | null = null

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#e6f7ff'
      button.style.color = '#1890ff'

      // 显示URL tooltip
      urlTooltip = this.createUrlTooltip(linkUrl)
      document.body.appendChild(urlTooltip)
      this.positionTooltip(button, urlTooltip)
    })

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent'
      button.style.color = '#999'

      // 移除URL tooltip
      if (urlTooltip && urlTooltip.parentNode) {
        urlTooltip.parentNode.removeChild(urlTooltip)
        urlTooltip = null
      }
    })

    // 点击复制
    button.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      try {
        await navigator.clipboard.writeText(linkUrl)
        this.showCopySuccess(button)
        console.log('Link copied successfully:', linkUrl)
      } catch (error) {
        console.error('Failed to copy link:', error)
        this.showCopyError(button)
      }
    })

    return button
  }

  private insertCopyButtonAfterText(textNode: Text, copyButton: HTMLElement) {
    console.log('Inserting copy button after text node:', textNode.textContent)

    const parent = textNode.parentNode
    if (!parent) {
      console.log('Text node has no parent')
      return
    }

    try {
      // 简化策略：直接在父元素中查找"网页链接"并在其后插入
      const parentElement = parent as Element
      const parentText = parentElement.textContent || ''

      if (parentText.includes('网页链接')) {
        // 使用更安全的方式：在父元素末尾添加按钮
        parentElement.appendChild(copyButton)
        console.log('Copy button appended to parent element')
        return
      }

      // 备用策略：如果文本节点只包含"网页链接"，直接在后面插入
      if (textNode.textContent?.trim() === '网页链接') {
        if (textNode.nextSibling) {
          parent.insertBefore(copyButton, textNode.nextSibling)
        } else {
          parent.appendChild(copyButton)
        }
        console.log('Copy button inserted after "网页链接" text')
        return
      }

    } catch (error) {
      console.log('Failed to insert copy button after text:', error)

      // 最终备用策略：尝试在最近的可用父元素中添加
      try {
        let currentParent = parent
        while (currentParent && currentParent.nodeType === Node.ELEMENT_NODE) {
          try {
            (currentParent as Element).appendChild(copyButton)
            console.log('Copy button appended to ancestor element')
            return
          } catch (e) {
            currentParent = currentParent.parentNode
          }
        }
      } catch (fallbackError) {
        console.log('All insertion strategies failed:', fallbackError)
      }
    }
  }

  private createUrlTooltip(url: string): HTMLElement {
    const tooltip = document.createElement('div')
    tooltip.className = 'weibo-url-tooltip'
    tooltip.textContent = url

    Object.assign(tooltip.style, {
      position: 'fixed',
      background: '#333',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: '10000',
      maxWidth: '300px',
      wordBreak: 'break-all',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      pointerEvents: 'none'
    })

    return tooltip
  }

  private positionTooltip(button: HTMLElement, tooltip: HTMLElement) {
    const buttonRect = button.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()

    // 默认显示在按钮上方
    let top = buttonRect.top - tooltipRect.height - 8
    let left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2)

    // 如果上方空间不够，显示在下方
    if (top < 10) {
      top = buttonRect.bottom + 8
    }

    // 确保不超出屏幕边界
    if (left < 10) {
      left = 10
    } else if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10
    }

    tooltip.style.top = `${top}px`
    tooltip.style.left = `${left}px`
  }

  private showCopySuccess(button: HTMLElement) {
    const originalContent = button.innerHTML
    const originalTitle = button.title

    button.innerHTML = CHECK_ICON_SVG
    button.style.color = '#52c41a'
    button.title = '复制成功！'

    setTimeout(() => {
      button.innerHTML = originalContent
      button.style.color = '#999'
      button.title = originalTitle
    }, 2000)
  }

  private showCopyError(button: HTMLElement) {
    const originalTitle = button.title

    button.style.color = '#ff4d4f'
    button.title = '复制失败，请重试'

    setTimeout(() => {
      button.style.color = '#999'
      button.title = originalTitle
    }, 2000)
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.processedMessages.clear()
  }
}

// 添加调试信息显示
function showDebugInfo() {
  const debugDiv = document.createElement('div')
  debugDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #1890ff;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    font-family: monospace;
  `
  debugDiv.textContent = '微博聊天链接复制插件已加载'
  document.body.appendChild(debugDiv)

  // 3秒后移除
  setTimeout(() => {
    if (debugDiv.parentNode) {
      debugDiv.parentNode.removeChild(debugDiv)
    }
  }, 3000)
}



// 初始化管理器
let linkCopyManager: WeiboLinkCopyManager | null = null

// 页面加载时启动
if (window.location.href.includes('api.weibo.com/chat')) {
  console.log('Weibo chat page detected, initializing link copy manager...')
  showDebugInfo()
  linkCopyManager = new WeiboLinkCopyManager()
} else {
  console.log('Not a weibo chat page, URL:', window.location.href)
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (linkCopyManager) {
    linkCopyManager.destroy()
  }
})
