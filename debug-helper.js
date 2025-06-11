// 调试辅助脚本 - 可以在浏览器控制台中运行来测试微博页面结构

// 检查页面是否为微博页面
function checkWeiboPage() {
    const url = window.location.href;
    const isWeibo = url.includes('weibo.com');
    console.log('当前页面:', url);
    console.log('是否为微博页面:', isWeibo);
    return isWeibo;
}

// 查找评论区域
function findCommentArea() {
    const selectors = [
        '.WB_feed_detail .list_con',
        '.WB_feed_detail .comment_list',
        '.Feed_detail .CommentItem',
        '.comment-list',
        '[class*="comment"]',
        '[class*="Comment"]'
    ];
    
    console.log('正在查找评论区域...');
    
    selectors.forEach((selector, index) => {
        const elements = document.querySelectorAll(selector);
        console.log(`选择器 ${index + 1} (${selector}):`, elements.length, '个元素');
        if (elements.length > 0) {
            console.log('找到的元素:', elements[0]);
        }
    });
}

// 查找评论文本
function findCommentTexts() {
    const textSelectors = [
        '.WB_text',
        '.comment-text',
        '[class*="text"]',
        '[class*="Text"]'
    ];
    
    console.log('正在查找评论文本...');
    
    textSelectors.forEach((selector, index) => {
        const elements = document.querySelectorAll(selector);
        console.log(`文本选择器 ${index + 1} (${selector}):`, elements.length, '个元素');
        
        if (elements.length > 0) {
            elements.forEach((el, i) => {
                if (i < 5) { // 只显示前5个
                    console.log(`  文本 ${i + 1}:`, el.textContent?.trim().substring(0, 50) + '...');
                }
            });
        }
    });
}

// 查找点赞按钮
function findLikeButtons() {
    const likeSelectors = [
        '.ficon_praise',
        '[action-type="feed_list_like"]',
        '.like',
        '[class*="like"]',
        '[class*="praise"]',
        '.icon-praise',
        '.icon-like'
    ];
    
    console.log('正在查找点赞按钮...');
    
    likeSelectors.forEach((selector, index) => {
        const elements = document.querySelectorAll(selector);
        console.log(`点赞选择器 ${index + 1} (${selector}):`, elements.length, '个元素');
        
        if (elements.length > 0) {
            console.log('找到的点赞按钮:', elements[0]);
        }
    });
}

// 搜索包含特定关键词的评论
function searchKeywordComments(keyword = '陈昊宇') {
    console.log(`正在搜索包含"${keyword}"的评论...`);
    
    const allTextElements = document.querySelectorAll('*');
    const matchingElements = [];
    
    allTextElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.includes(keyword) && text.length > keyword.length && text.length < 500) {
            matchingElements.push({
                element: el,
                text: text,
                tagName: el.tagName,
                className: el.className
            });
        }
    });
    
    console.log(`找到 ${matchingElements.length} 个包含关键词的元素:`);
    matchingElements.forEach((item, index) => {
        if (index < 10) { // 只显示前10个
            console.log(`${index + 1}. [${item.tagName}.${item.className}] ${item.text.substring(0, 100)}...`);
        }
    });
    
    return matchingElements;
}

// 运行完整检查
function runFullCheck(keyword = '陈昊宇') {
    console.log('=== 微博页面结构检查 ===');
    checkWeiboPage();
    console.log('\n=== 评论区域检查 ===');
    findCommentArea();
    console.log('\n=== 评论文本检查 ===');
    findCommentTexts();
    console.log('\n=== 点赞按钮检查 ===');
    findLikeButtons();
    console.log('\n=== 关键词搜索 ===');
    searchKeywordComments(keyword);
    console.log('\n=== 检查完成 ===');
}

// 模拟点击测试
function testClick(selector) {
    const element = document.querySelector(selector);
    if (element) {
        console.log('找到元素，准备点击:', element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            element.click();
            console.log('点击完成');
        }, 1000);
    } else {
        console.log('未找到元素:', selector);
    }
}

// 导出到全局作用域
window.weiboDebug = {
    checkWeiboPage,
    findCommentArea,
    findCommentTexts,
    findLikeButtons,
    searchKeywordComments,
    runFullCheck,
    testClick
};

console.log('调试工具已加载！使用 weiboDebug.runFullCheck() 开始检查页面结构');
console.log('可用方法:', Object.keys(window.weiboDebug));
