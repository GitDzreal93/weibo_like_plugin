const { test, expect } = require('@playwright/test');
const { WeiboSelectors } = require('../utils/selectors');

test.describe('微博评论检测功能测试', () => {
  let selectors;

  test.beforeEach(async () => {
    selectors = new WeiboSelectors();
  });

  test('应该能够检测微博页面结构', async ({ page }) => {
    // 使用本地测试页面
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);

    // 等待页面加载
    await page.waitForLoadState('load');
    
    // 检查页面标题
    const title = await page.title();
    expect(title).toContain('微博');
    
    // 分析页面结构
    const pageStructure = await page.evaluate(() => {
      const structure = {
        totalElements: document.querySelectorAll('*').length,
        textElements: 0,
        commentLikeElements: 0,
        possibleComments: 0
      };
      
      // 统计文本元素
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
          structure.textElements++;
          if (text.length > 20 && text.length < 500) {
            structure.possibleComments++;
          }
        }
        
        // 检查是否包含点赞相关的类名或属性
        const className = el.className?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        if (className.includes('like') || className.includes('praise') || 
            ariaLabel.includes('赞') || ariaLabel.includes('like')) {
          structure.commentLikeElements++;
        }
      });
      
      return structure;
    });
    
    console.log('页面结构分析:', pageStructure);
    
    // 验证页面包含基本元素
    expect(pageStructure.totalElements).toBeGreaterThan(100);
    expect(pageStructure.textElements).toBeGreaterThan(10);
  });

  test('应该能够使用现代选择器查找评论', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    await page.waitForLoadState('load');
    
    // 测试各种评论选择器
    const commentResults = [];
    
    for (const selectorInfo of selectors.getCommentSelectors()) {
      try {
        const elements = await page.locator(selectorInfo.selector).all();
        commentResults.push({
          selector: selectorInfo.selector,
          count: elements.length,
          description: selectorInfo.description
        });
        
        if (elements.length > 0) {
          console.log(`✓ ${selectorInfo.description}: 找到 ${elements.length} 个元素`);
          
          // 获取前几个元素的文本内容进行验证
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await elements[i].textContent();
            if (text && text.trim().length > 5) {
              console.log(`  - 文本示例 ${i + 1}: ${text.trim().substring(0, 50)}...`);
            }
          }
        }
      } catch (error) {
        commentResults.push({
          selector: selectorInfo.selector,
          count: 0,
          error: error.message,
          description: selectorInfo.description
        });
      }
    }
    
    // 输出测试结果
    console.log('\n评论选择器测试结果:');
    commentResults.forEach(result => {
      if (result.error) {
        console.log(`✗ ${result.description}: 错误 - ${result.error}`);
      } else {
        console.log(`${result.count > 0 ? '✓' : '○'} ${result.description}: ${result.count} 个元素`);
      }
    });
    
    // 至少应该有一个选择器能找到元素
    const successfulSelectors = commentResults.filter(r => r.count > 0);
    expect(successfulSelectors.length).toBeGreaterThan(0);
  });

  test('应该能够查找点赞按钮', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    await page.waitForLoadState('load');
    
    const likeButtonResults = [];
    
    for (const selectorInfo of selectors.getLikeButtonSelectors()) {
      try {
        const elements = await page.locator(selectorInfo.selector).all();
        likeButtonResults.push({
          selector: selectorInfo.selector,
          count: elements.length,
          description: selectorInfo.description
        });
        
        if (elements.length > 0) {
          console.log(`✓ ${selectorInfo.description}: 找到 ${elements.length} 个元素`);
          
          // 检查前几个按钮的属性
          for (let i = 0; i < Math.min(2, elements.length); i++) {
            const button = elements[i];
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();
            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            
            console.log(`  - 按钮 ${i + 1}: 可见=${isVisible}, 可用=${isEnabled}, 文本="${text?.trim()}", aria-label="${ariaLabel}"`);
          }
        }
      } catch (error) {
        likeButtonResults.push({
          selector: selectorInfo.selector,
          count: 0,
          error: error.message,
          description: selectorInfo.description
        });
      }
    }
    
    // 输出测试结果
    console.log('\n点赞按钮选择器测试结果:');
    likeButtonResults.forEach(result => {
      if (result.error) {
        console.log(`✗ ${result.description}: 错误 - ${result.error}`);
      } else {
        console.log(`${result.count > 0 ? '✓' : '○'} ${result.description}: ${result.count} 个元素`);
      }
    });
  });

  test('应该能够查找包含特定关键词的文本', async ({ page }) => {
    await page.goto(`file://${__dirname}/mock-weibo-page.html`);
    await page.waitForLoadState('load');

    const testKeywords = ['陈昊宇', '评论', '点赞', '转发'];
    
    for (const keyword of testKeywords) {
      // 使用 Playwright 的文本选择器
      const exactMatch = page.locator(`text="${keyword}"`);
      const partialMatch = page.locator(`text=/${keyword}/i`);
      
      const exactCount = await exactMatch.count();
      const partialCount = await partialMatch.count();
      
      console.log(`关键词 "${keyword}": 精确匹配 ${exactCount} 个, 部分匹配 ${partialCount} 个`);
      
      if (partialCount > 0) {
        // 获取前几个匹配的元素文本
        const matches = await partialMatch.all();
        for (let i = 0; i < Math.min(3, matches.length); i++) {
          const text = await matches[i].textContent();
          console.log(`  - 匹配文本 ${i + 1}: ${text?.trim().substring(0, 100)}...`);
        }
      }
    }
  });
});
