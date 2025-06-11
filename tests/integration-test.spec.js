const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('微博插件集成测试', () => {
  let extensionId;

  test.beforeAll(async ({ browser }) => {
    // 加载Chrome扩展
    const context = await browser.newContext({
      // 注意：这需要在实际测试中配置扩展路径
    });
  });

  test('应该能够在测试页面上正确识别和点赞评论', async ({ page }) => {
    // 加载测试页面
    await page.goto(`file://${path.join(__dirname, 'mock-weibo-page.html')}`);
    
    // 等待页面加载
    await page.waitForLoadState('load');
    
    // 注入改进后的内容脚本逻辑进行测试
    await page.addScriptTag({
      path: path.join(__dirname, '../utils/element-finder.js')
    });
    
    // 测试现代化元素查找器
    const testResults = await page.evaluate(async () => {
      const finder = new ModernElementFinder();
      
      // 测试查找评论
      const comments = await finder.findComments({
        keyword: '陈昊宇',
        maxResults: 10
      });
      
      const results = {
        totalComments: comments.length,
        commentsWithKeyword: comments.filter(c => c.text.includes('陈昊宇')).length,
        commentsWithLikeButton: comments.filter(c => c.likeButton).length,
        unlikedComments: comments.filter(c => !c.isLiked).length
      };
      
      // 测试点赞功能
      let likeTestResults = [];
      for (const comment of comments.slice(0, 2)) {
        if (comment.likeButton && !comment.isLiked) {
          try {
            await finder.safeClick(comment.likeButton);
            await finder.sleep(500);
            
            const isNowLiked = finder.checkIfLiked(comment.likeButton);
            likeTestResults.push({
              text: comment.text.substring(0, 30),
              clickSuccess: true,
              likedAfterClick: isNowLiked
            });
          } catch (error) {
            likeTestResults.push({
              text: comment.text.substring(0, 30),
              clickSuccess: false,
              error: error.message
            });
          }
        }
      }
      
      results.likeTests = likeTestResults;
      return results;
    });
    
    console.log('测试结果:', testResults);
    
    // 验证结果
    expect(testResults.totalComments).toBeGreaterThan(0);
    expect(testResults.commentsWithKeyword).toBeGreaterThan(0);
    expect(testResults.commentsWithLikeButton).toBeGreaterThan(0);
    
    // 验证点赞功能
    if (testResults.likeTests.length > 0) {
      const successfulLikes = testResults.likeTests.filter(t => t.clickSuccess && t.likedAfterClick);
      expect(successfulLikes.length).toBeGreaterThan(0);
      console.log(`成功点赞 ${successfulLikes.length} 条评论`);
    }
  });

  test('应该能够处理各种选择器', async ({ page }) => {
    await page.goto(`file://${path.join(__dirname, 'mock-weibo-page.html')}`);
    await page.waitForLoadState('load');
    
    // 测试各种选择器的有效性
    const selectorResults = await page.evaluate(() => {
      const selectors = [
        '[data-testid="comment-item"] .comment-text',
        '[class*="CommentItem"] [class*="text"]',
        '.Feed_detail .CommentItem_text',
        '.WB_feed_detail .list_con .WB_text',
        '.WB_text',
        '.comment-text'
      ];
      
      return selectors.map(selector => ({
        selector,
        elementCount: document.querySelectorAll(selector).length,
        hasVisibleElements: Array.from(document.querySelectorAll(selector))
          .some(el => el.offsetHeight > 0 && el.offsetWidth > 0)
      }));
    });
    
    console.log('选择器测试结果:', selectorResults);
    
    // 至少应该有一个选择器能找到元素
    const workingSelectors = selectorResults.filter(r => r.elementCount > 0);
    expect(workingSelectors.length).toBeGreaterThan(0);
  });

  test('应该能够正确识别点赞按钮状态', async ({ page }) => {
    await page.goto(`file://${path.join(__dirname, 'mock-weibo-page.html')}`);
    await page.waitForLoadState('load');
    
    const buttonStates = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.like-button');
      return Array.from(buttons).map((button, index) => ({
        index,
        isLiked: button.classList.contains('liked') || button.classList.contains('WB_praised'),
        isVisible: button.offsetHeight > 0 && button.offsetWidth > 0,
        isClickable: !button.disabled && window.getComputedStyle(button).pointerEvents !== 'none',
        text: button.textContent.trim(),
        ariaLabel: button.getAttribute('aria-label')
      }));
    });
    
    console.log('点赞按钮状态:', buttonStates);
    
    // 验证按钮状态检测
    expect(buttonStates.length).toBeGreaterThan(0);
    expect(buttonStates.every(b => b.isVisible)).toBe(true);
    expect(buttonStates.every(b => b.isClickable)).toBe(true);
  });

  test('应该能够模拟真实的点赞交互', async ({ page }) => {
    await page.goto(`file://${path.join(__dirname, 'mock-weibo-page.html')}`);
    await page.waitForLoadState('load');
    
    // 找到第一个未点赞的按钮
    const firstUnlikedButton = page.locator('.like-button:not(.liked):not(.WB_praised)').first();
    
    // 检查初始状态
    const initialState = await firstUnlikedButton.evaluate(el => ({
      isLiked: el.classList.contains('liked') || el.classList.contains('WB_praised'),
      text: el.textContent.trim()
    }));
    
    expect(initialState.isLiked).toBe(false);
    
    // 点击按钮
    await firstUnlikedButton.click();
    
    // 等待状态更新
    await page.waitForTimeout(500);
    
    // 检查点击后状态
    const afterClickState = await firstUnlikedButton.evaluate(el => ({
      isLiked: el.classList.contains('liked') || el.classList.contains('WB_praised'),
      text: el.textContent.trim()
    }));
    
    expect(afterClickState.isLiked).toBe(true);
    console.log('点赞状态变化:', { before: initialState, after: afterClickState });
  });

  test('应该能够处理动态加载的内容', async ({ page }) => {
    await page.goto(`file://${path.join(__dirname, 'mock-weibo-page.html')}`);
    await page.waitForLoadState('load');
    
    // 记录初始评论数量
    const initialCommentCount = await page.locator('.comment-item').count();
    
    // 等待动态内容加载（测试页面会在2秒后添加新评论）
    await page.waitForTimeout(2500);
    
    // 检查新增的评论
    const finalCommentCount = await page.locator('.comment-item').count();
    
    expect(finalCommentCount).toBeGreaterThan(initialCommentCount);
    console.log(`动态加载测试: 初始 ${initialCommentCount} 条评论，最终 ${finalCommentCount} 条评论`);
  });
});
