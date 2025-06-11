/**
 * 微博页面元素选择器工具
 * 使用 Playwright 的现代选择器语法
 */

class WeiboSelectors {
  constructor() {
    // 评论相关选择器 - 按优先级排序
    this.commentSelectors = [
      // 新版微博评论
      '[data-testid="comment-item"] .comment-text',
      '[class*="CommentItem"] [class*="text"]',
      '.Feed_detail .CommentItem_text',
      
      // 经典版微博评论
      '.WB_feed_detail .list_con .WB_text',
      '.WB_feed_detail .comment_list .WB_text',
      '.comment-list .comment-item .comment-text',
      '.WB_detail .WB_text',
      '.WB_feed .WB_text',
      '.comment_list_item .WB_text',
      
      // 通用评论选择器
      '[class*="comment"] [class*="text"]',
      '[class*="Comment"] [class*="Text"]',
    ];

    // 点赞按钮选择器
    this.likeButtonSelectors = [
      // 新版微博点赞按钮
      '[data-testid="like-button"]',
      '[aria-label*="点赞"]',
      '[aria-label*="赞"]',
      '[title*="点赞"]',
      '[title*="赞"]',
      
      // 经典版微博点赞按钮
      '.WB_func .ficon_praise',
      '.WB_func [action-type="feed_list_like"]',
      '.toolbar_item .like',
      '.icon-praise',
      '.icon-like',
      
      // 通用点赞按钮
      '[class*="like"]',
      '[class*="Like"]',
      '[class*="praise"]',
      '[class*="Praise"]',
      '[class*="zan"]',
      '[class*="thumb"]',
      '[class*="heart"]',
      'button[class*="toolbar"]',
      'a[class*="toolbar"]',
      '.toolbar button',
      '.toolbar a'
    ];

    // 评论容器选择器
    this.commentContainerSelectors = [
      '[data-testid="comment-list"]',
      '.comment-list',
      '.WB_feed_detail',
      '.Feed_detail',
      '[class*="comment"]',
      '[class*="Comment"]',
      '[class*="feed"]',
      '[class*="Feed"]'
    ];

    // 已点赞状态指示器
    this.likedIndicators = [
      'WB_praised',
      'praised',
      'liked',
      'active',
      'selected'
    ];
  }

  /**
   * 获取评论选择器（Playwright 格式）
   */
  getCommentSelectors() {
    return this.commentSelectors.map(selector => ({
      selector,
      description: `评论文本: ${selector}`
    }));
  }

  /**
   * 获取点赞按钮选择器（Playwright 格式）
   */
  getLikeButtonSelectors() {
    return this.likeButtonSelectors.map(selector => ({
      selector,
      description: `点赞按钮: ${selector}`
    }));
  }

  /**
   * 获取评论容器选择器
   */
  getCommentContainerSelectors() {
    return this.commentContainerSelectors;
  }

  /**
   * 构建包含关键词的文本选择器
   */
  getTextWithKeywordSelector(keyword) {
    return `text="${keyword}"`;
  }

  /**
   * 构建部分匹配关键词的文本选择器
   */
  getTextContainingKeywordSelector(keyword) {
    return `text=/${keyword}/i`;
  }

  /**
   * 获取已点赞状态检查器
   */
  getLikedIndicators() {
    return this.likedIndicators;
  }

  /**
   * 构建复合选择器 - 查找包含特定文本的评论及其点赞按钮
   */
  getCommentWithLikeButtonSelector(keyword) {
    return {
      commentText: `text=/${keyword}/i`,
      likeButton: `text=/${keyword}/i >> xpath=ancestor::*[contains(@class, 'comment') or contains(@class, 'Comment')] >> ${this.likeButtonSelectors[0]}`
    };
  }

  /**
   * 获取等待元素出现的选择器配置
   */
  getWaitForSelectors() {
    return {
      commentList: this.commentContainerSelectors[0],
      anyComment: this.commentSelectors[0],
      timeout: 10000
    };
  }
}

module.exports = { WeiboSelectors };
