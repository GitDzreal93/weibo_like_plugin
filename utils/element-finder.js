/**
 * 现代化的元素查找工具
 * 基于 Playwright 的最佳实践，但适用于浏览器环境
 */

class ModernElementFinder {
  constructor() {
    this.selectors = {
      // 评论文本选择器（按优先级排序）
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
      
      // 点赞按钮选择器
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
    };
    
    this.likedIndicators = ['WB_praised', 'praised', 'liked', 'active', 'selected'];
  }

  /**
   * 等待元素出现（类似 Playwright 的 waitFor）
   */
  async waitForElement(selector, options = {}) {
    const { timeout = 10000, visible = true } = options;
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        
        if (element) {
          if (!visible || this.isElementVisible(element)) {
            resolve(element);
            return;
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`元素 ${selector} 在 ${timeout}ms 内未找到`));
          return;
        }
        
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  }

  /**
   * 等待多个选择器中的任一个出现
   */
  async waitForAnyElement(selectors, options = {}) {
    const { timeout = 10000 } = options;
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElements = () => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && this.isElementVisible(element)) {
            resolve({ element, selector });
            return;
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`所有选择器在 ${timeout}ms 内都未找到元素`));
          return;
        }
        
        setTimeout(checkElements, 100);
      };
      
      checkElements();
    });
  }

  /**
   * 智能查找评论元素
   */
  async findComments(options = {}) {
    const { keyword, maxResults = 50 } = options;
    const comments = [];
    
    // 首先尝试等待评论容器加载
    try {
      await this.waitForAnyElement(this.selectors.commentContainer, { timeout: 5000 });
    } catch (error) {
      console.log('评论容器未找到，继续尝试其他方法');
    }
    
    // 尝试各种评论选择器
    for (const selector of this.selectors.commentText) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        if (comments.length >= maxResults) break;
        
        const commentData = await this.extractCommentData(element, keyword);
        if (commentData) {
          comments.push(commentData);
        }
      }
      
      if (comments.length > 0) {
        console.log(`使用选择器 ${selector} 找到 ${comments.length} 条评论`);
        break;
      }
    }
    
    // 如果还没找到，使用文本搜索
    if (comments.length === 0 && keyword) {
      const keywordComments = await this.findCommentsByText(keyword);
      comments.push(...keywordComments);
    }
    
    return comments;
  }

  /**
   * 通过文本内容查找评论
   */
  async findCommentsByText(keyword) {
    const comments = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent.trim();
          return text.includes(keyword) && text.length > keyword.length + 5 && text.length < 500
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const element = node.parentElement;
      if (element && this.isElementVisible(element)) {
        const commentData = await this.extractCommentData(element, keyword);
        if (commentData) {
          comments.push(commentData);
        }
      }
    }
    
    return comments;
  }

  /**
   * 提取评论数据
   */
  async extractCommentData(element, keyword = null) {
    const text = element.textContent?.trim();
    if (!text || text.length < 5) return null;
    
    // 如果指定了关键词，检查是否包含
    if (keyword && !text.includes(keyword)) return null;
    
    // 查找点赞按钮
    const likeButton = await this.findLikeButton(element);
    
    return {
      element,
      text,
      likeButton,
      isLiked: likeButton ? this.checkIfLiked(likeButton) : false,
      boundingBox: element.getBoundingClientRect()
    };
  }

  /**
   * 智能查找点赞按钮
   */
  async findLikeButton(commentElement) {
    // 从评论元素向上查找包含点赞按钮的容器
    let container = commentElement;
    
    for (let level = 0; level < 8; level++) {
      if (!container || !container.parentElement) break;
      container = container.parentElement;
      
      // 在当前容器中查找点赞按钮
      for (const selector of this.selectors.likeButton) {
        const button = container.querySelector(selector);
        if (button && this.isClickableElement(button)) {
          return button;
        }
      }
    }
    
    return null;
  }

  /**
   * 检查元素是否可见
   */
  isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }

  /**
   * 检查元素是否可点击
   */
  isClickableElement(element) {
    if (!element || !this.isElementVisible(element)) return false;
    
    const style = window.getComputedStyle(element);
    return !element.disabled &&
           style.pointerEvents !== 'none' &&
           (element.tagName === 'BUTTON' || 
            element.tagName === 'A' || 
            element.onclick ||
            element.getAttribute('role') === 'button' ||
            style.cursor === 'pointer');
  }

  /**
   * 检查是否已点赞
   */
  checkIfLiked(likeButton) {
    if (!likeButton) return false;
    
    // 检查类名指示器
    for (const indicator of this.likedIndicators) {
      if (likeButton.classList.contains(indicator)) {
        return true;
      }
    }
    
    // 检查颜色变化
    const style = window.getComputedStyle(likeButton);
    const color = style.color;
    if (color.includes('rgb(255') || color.includes('#ff') || 
        color.includes('#f4') || color.includes('orange') ||
        color.includes('red')) {
      return true;
    }
    
    return false;
  }

  /**
   * 安全点击元素
   */
  async safeClick(element, options = {}) {
    const { scrollIntoView = true, delay = 500 } = options;
    
    if (!element || !this.isClickableElement(element)) {
      throw new Error('元素不可点击');
    }
    
    if (scrollIntoView) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(delay);
    }
    
    // 模拟真实用户点击
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // 触发鼠标事件序列
    const events = ['mousedown', 'mouseup', 'click'];
    for (const eventType of events) {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      element.dispatchEvent(event);
      await this.sleep(50);
    }
    
    return true;
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出给浏览器环境使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModernElementFinder };
} else {
  window.ModernElementFinder = ModernElementFinder;
}
