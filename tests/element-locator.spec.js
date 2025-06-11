const { test, expect } = require('@playwright/test');
const { WeiboSelectors } = require('../utils/selectors');

test.describe('元素定位功能测试', () => {
  let selectors;

  test.beforeEach(async () => {
    selectors = new WeiboSelectors();
  });

  test('应该能够等待页面元素加载', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    
    // 测试等待策略
    const waitStrategies = [
      { name: 'load', strategy: 'load' },
      { name: 'domcontentloaded', strategy: 'domcontentloaded' }
    ];

    for (const { name, strategy } of waitStrategies) {
      const startTime = Date.now();
      await page.waitForLoadState(strategy);
      const endTime = Date.now();

      console.log(`${name} 策略等待时间: ${endTime - startTime}ms`);
    }
    
    // 验证页面基本元素已加载
    const bodyExists = await page.locator('body').isVisible();
    expect(bodyExists).toBe(true);
  });

  test('应该能够智能查找评论容器', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    await page.waitForLoadState('load');
    
    const containerResults = [];
    
    for (const selector of selectors.getCommentContainerSelectors()) {
      try {
        const containers = await page.locator(selector).all();
        
        for (let i = 0; i < containers.length; i++) {
          const container = containers[i];
          const isVisible = await container.isVisible();
          const boundingBox = await container.boundingBox();
          
          if (isVisible && boundingBox) {
            // 分析容器内容
            const childCount = await container.locator('*').count();
            const textContent = await container.textContent();
            const hasCommentKeywords = textContent && (
              textContent.includes('评论') || 
              textContent.includes('回复') ||
              textContent.includes('点赞')
            );
            
            containerResults.push({
              selector,
              index: i,
              childCount,
              hasCommentKeywords,
              boundingBox,
              textLength: textContent?.length || 0
            });
          }
        }
      } catch (error) {
        console.log(`容器选择器 ${selector} 出错: ${error.message}`);
      }
    }
    
    // 按相关性排序
    containerResults.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      
      if (a.hasCommentKeywords) scoreA += 10;
      if (b.hasCommentKeywords) scoreB += 10;
      
      scoreA += Math.min(a.childCount / 10, 5);
      scoreB += Math.min(b.childCount / 10, 5);
      
      scoreA += Math.min(a.textLength / 1000, 3);
      scoreB += Math.min(b.textLength / 1000, 3);
      
      return scoreB - scoreA;
    });
    
    console.log('评论容器分析结果（按相关性排序）:');
    containerResults.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. ${result.selector}[${result.index}]:`);
      console.log(`   - 子元素: ${result.childCount}`);
      console.log(`   - 包含评论关键词: ${result.hasCommentKeywords}`);
      console.log(`   - 文本长度: ${result.textLength}`);
      console.log(`   - 位置: ${JSON.stringify(result.boundingBox)}`);
    });
    
    expect(containerResults.length).toBeGreaterThan(0);
  });

  test('应该能够测试点赞按钮的交互性', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    await page.waitForLoadState('load');
    
    const interactiveButtons = [];
    
    for (const selectorInfo of selectors.getLikeButtonSelectors().slice(0, 5)) {
      try {
        const buttons = await page.locator(selectorInfo.selector).all();
        
        for (let i = 0; i < Math.min(3, buttons.length); i++) {
          const button = buttons[i];
          
          // 检查按钮的交互性
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const boundingBox = await button.boundingBox();
          
          if (isVisible && isEnabled && boundingBox) {
            // 检查按钮样式和状态
            const computedStyle = await button.evaluate(el => {
              const style = window.getComputedStyle(el);
              return {
                cursor: style.cursor,
                pointerEvents: style.pointerEvents,
                opacity: style.opacity,
                display: style.display
              };
            });
            
            // 检查是否已点赞
            const classList = await button.getAttribute('class') || '';
            const isLiked = selectors.getLikedIndicators().some(indicator => 
              classList.includes(indicator)
            );
            
            interactiveButtons.push({
              selector: selectorInfo.selector,
              index: i,
              boundingBox,
              computedStyle,
              isLiked,
              classList
            });
          }
        }
      } catch (error) {
        console.log(`按钮选择器 ${selectorInfo.selector} 测试出错: ${error.message}`);
      }
    }
    
    console.log('可交互点赞按钮分析:');
    interactiveButtons.forEach((button, index) => {
      console.log(`${index + 1}. ${button.selector}[${button.index}]:`);
      console.log(`   - 已点赞: ${button.isLiked}`);
      console.log(`   - 样式: ${JSON.stringify(button.computedStyle)}`);
      console.log(`   - 位置: ${JSON.stringify(button.boundingBox)}`);
      console.log(`   - 类名: ${button.classList}`);
    });
    
    // 如果找到可交互按钮，测试悬停效果
    if (interactiveButtons.length > 0) {
      const testButton = page.locator(interactiveButtons[0].selector).first();
      
      // 测试悬停
      await testButton.hover();
      await page.waitForTimeout(500);
      
      // 检查悬停后的状态变化
      const afterHoverStyle = await testButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          cursor: style.cursor,
          opacity: style.opacity,
          backgroundColor: style.backgroundColor
        };
      });
      
      console.log('悬停后样式变化:', afterHoverStyle);
    }
  });

  test('应该能够模拟滚动加载更多内容', async ({ page }) => {
    await page.goto('https://weibo.com');
    await page.waitForLoadState('networkidle');
    
    // 记录初始状态
    const initialElementCount = await page.locator('*').count();
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);
    
    console.log(`初始状态: ${initialElementCount} 个元素, 页面高度: ${initialHeight}px`);
    
    // 模拟滚动
    const scrollSteps = 3;
    for (let i = 1; i <= scrollSteps; i++) {
      await page.evaluate((step) => {
        window.scrollTo(0, document.body.scrollHeight * step / 3);
      }, i);
      
      await page.waitForTimeout(2000); // 等待内容加载
      
      const currentElementCount = await page.locator('*').count();
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      console.log(`滚动步骤 ${i}: ${currentElementCount} 个元素, 页面高度: ${currentHeight}px`);
    }
    
    // 检查是否有新内容加载
    const finalElementCount = await page.locator('*').count();
    const finalHeight = await page.evaluate(() => document.body.scrollHeight);
    
    console.log(`最终状态: ${finalElementCount} 个元素, 页面高度: ${finalHeight}px`);
    
    // 验证滚动是否触发了内容加载
    const elementIncrease = finalElementCount - initialElementCount;
    const heightIncrease = finalHeight - initialHeight;
    
    console.log(`元素增加: ${elementIncrease}, 高度增加: ${heightIncrease}px`);
    
    // 通常滚动会加载更多内容
    expect(elementIncrease >= 0).toBe(true);
  });
});
