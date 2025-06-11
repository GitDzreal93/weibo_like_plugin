// 简化的测试版本 - 用于调试
console.log('测试脚本已加载');

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.action === 'executeTask') {
        console.log('开始执行测试任务');
        executeTestTask(message.settings);
    }
});

// 简化的测试任务
async function executeTestTask(settings) {
    try {
        console.log('测试任务开始');
        sendProgress('测试脚本已注入成功！', 'success');
        
        // 基本页面信息
        sendProgress(`页面标题: ${document.title}`, 'info');
        sendProgress(`页面URL: ${window.location.href}`, 'info');
        sendProgress(`页面元素总数: ${document.querySelectorAll('*').length}`, 'info');
        
        // 检查是否为微博页面
        const isWeiboPage = window.location.href.includes('weibo.com');
        sendProgress(`是否为微博页面: ${isWeiboPage}`, isWeiboPage ? 'success' : 'error');
        
        if (!isWeiboPage) {
            sendProgress('不是微博页面，任务结束', 'error');
            completeTask();
            return;
        }
        
        // 等待页面加载
        await sleep(2000);
        sendProgress('页面加载等待完成', 'info');
        
        // 查找所有可能的文本元素
        const allTexts = document.querySelectorAll('*');
        let textCount = 0;
        let keywordCount = 0;
        
        allTexts.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && text.length < 200) {
                textCount++;
                if (text.includes(settings.keyword)) {
                    keywordCount++;
                    console.log('找到关键词:', text.substring(0, 100));
                }
            }
        });
        
        sendProgress(`找到${textCount}个文本元素`, 'info');
        sendProgress(`其中${keywordCount}个包含关键词"${settings.keyword}"`, keywordCount > 0 ? 'success' : 'warning');
        
        // 查找可能的点赞按钮
        const likeButtons = document.querySelectorAll('[class*="like"], [class*="praise"], [class*="zan"]');
        sendProgress(`找到${likeButtons.length}个可能的点赞按钮`, 'info');
        
        // 模拟完成
        await sleep(1000);
        sendProgress('测试任务完成！', 'success');
        completeTask();
        
    } catch (error) {
        console.error('测试任务出错:', error);
        sendProgress(`测试任务出错: ${error.message}`, 'error');
        chrome.runtime.sendMessage({
            action: 'taskError',
            error: error.message
        });
    }
}

// 工具函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendProgress(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    chrome.runtime.sendMessage({
        action: 'updateProgress',
        data: { message, type }
    });
}

function completeTask() {
    console.log('任务完成');
    chrome.runtime.sendMessage({
        action: 'taskComplete'
    });
}

console.log('测试脚本初始化完成');
