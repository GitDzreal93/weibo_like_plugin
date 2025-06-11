// 微博页面内容脚本
console.log('Content script loaded on:', window.location.href);
let isTaskRunning = false;
let taskSettings = {};

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);

    if (message.action === 'executeTask') {
        if (!isTaskRunning) {
            console.log('Starting task execution...');
            executeTask(message.settings);
        } else {
            console.log('Task already running, ignoring...');
        }
    }

    // 发送响应确认消息已收到
    sendResponse({received: true});
});

// 执行主要任务
async function executeTask(settings) {
    isTaskRunning = true;
    taskSettings = settings;

    try {
        sendProgress('开始分析页面...', 'info');
        sendProgress(`当前页面URL: ${window.location.href}`, 'info');

        // 等待页面完全加载
        await waitForPageLoad();
        sendProgress('页面加载完成', 'info');

        // 等待额外时间让动态内容加载
        await sleep(3000);
        sendProgress('开始查找评论区...', 'info');

        // 查找评论区
        const comments = await findComments();
        if (comments.length === 0) {
            sendProgress('未找到评论区，尝试滚动页面加载更多内容...', 'warning');

            // 尝试滚动页面加载评论
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(2000);

            // 再次尝试查找评论
            const commentsAfterScroll = await findComments();
            if (commentsAfterScroll.length === 0) {
                sendProgress('仍未找到评论区，可能页面结构已变化', 'error');
                completeTask();
                return;
            }
            comments.push(...commentsAfterScroll);
        }
        
        sendProgress(`找到${comments.length}条评论`, 'info');
        
        // 筛选包含关键词的评论
        const targetComments = filterCommentsByKeyword(comments, settings.keyword);
        if (targetComments.length === 0) {
            sendProgress(`未找到包含"${settings.keyword}"的评论`, 'warning');
            completeTask();
            return;
        }
        
        sendProgress(`找到${targetComments.length}条包含关键词的评论`, 'info');
        
        // 点赞评论
        const maxLikes = Math.min(targetComments.length, settings.maxLikes);
        let likedCount = 0;
        
        for (let i = 0; i < maxLikes; i++) {
            const comment = targetComments[i];
            const success = await likeComment(comment, settings.interval);
            
            if (success) {
                likedCount++;
                sendProgress(`成功点赞第${likedCount}条评论`, 'success');
            } else {
                sendProgress(`点赞第${i + 1}条评论失败`, 'warning');
            }
            
            // 添加延迟避免被检测
            if (i < maxLikes - 1) {
                await sleep(settings.interval);
            }
        }
        
        sendProgress(`任务完成，共点赞${likedCount}条评论`, 'success');
        completeTask();
        
    } catch (error) {
        sendProgress(`任务执行出错: ${error.message}`, 'error');
        chrome.runtime.sendMessage({
            action: 'taskError',
            error: error.message
        });
    } finally {
        isTaskRunning = false;
    }
}

// 等待页面加载
function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

// 查找评论
async function findComments() {
    sendProgress('正在查找评论区...', 'info');

    const comments = [];

    // 微博PC版评论选择器（按优先级排序）
    const commentSelectors = [
        '.WB_feed_detail .list_con .WB_text',  // 主要评论文本
        '.WB_feed_detail .comment_list .WB_text', // 评论列表
        '.Feed_detail .CommentItem_text', // 新版评论
        '.comment-list .comment-item .comment-text', // 备用选择器
        '.WB_detail .WB_text', // 详情页评论
        '.WB_feed .WB_text', // Feed页评论
        '[class*="CommentItem"] [class*="text"]', // 通用新版评论
        '.comment_list_item .WB_text' // 评论列表项
    ];

    sendProgress(`尝试${commentSelectors.length}种评论选择器...`, 'info');

    for (let i = 0; i < commentSelectors.length; i++) {
        const selector = commentSelectors[i];
        const elements = document.querySelectorAll(selector);
        sendProgress(`选择器${i+1}: ${selector} - 找到${elements.length}个元素`, 'info');

        if (elements.length > 0) {
            elements.forEach(element => {
                const commentData = extractCommentData(element);
                if (commentData) {
                    comments.push(commentData);
                }
            });

            if (comments.length > 0) {
                sendProgress(`使用选择器${i+1}成功找到${comments.length}条评论`, 'success');
                break; // 找到评论就停止尝试其他选择器
            }
        }
    }

    // 如果还是没找到，尝试更通用的方法
    if (comments.length === 0) {
        sendProgress('使用通用方法查找评论...', 'info');

        // 先分析页面结构
        await analyzePageStructure();

        const allTextElements = document.querySelectorAll('*');
        let foundCount = 0;

        allTextElements.forEach(element => {
            const text = element.textContent?.trim();
            if (text && text.length > 20 && text.length < 500 &&
                !element.querySelector('*') && // 确保是叶子节点
                element.offsetHeight > 0) { // 确保元素可见

                const commentData = extractCommentData(element);
                if (commentData) {
                    comments.push(commentData);
                    foundCount++;
                }
            }
        });

        if (foundCount > 0) {
            sendProgress(`通用方法找到${foundCount}条可能的评论`, 'info');
        } else {
            // 最后尝试：直接搜索包含关键词的文本
            sendProgress('尝试直接搜索关键词...', 'info');
            const keywordComments = await findCommentsByKeyword(taskSettings.keyword || '陈昊宇');
            comments.push(...keywordComments);
            if (keywordComments.length > 0) {
                sendProgress(`直接搜索找到${keywordComments.length}条包含关键词的文本`, 'success');
            }
        }
    }

    return comments;
}

// 分析页面结构
async function analyzePageStructure() {
    sendProgress('开始分析页面结构...', 'info');

    // 查找所有可能的评论容器
    const containerSelectors = [
        '[class*="comment"]',
        '[class*="Comment"]',
        '[class*="feed"]',
        '[class*="Feed"]',
        '[class*="list"]',
        '[class*="List"]',
        '[class*="item"]',
        '[class*="Item"]'
    ];

    let totalContainers = 0;
    containerSelectors.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        if (containers.length > 0) {
            sendProgress(`找到${containers.length}个 ${selector} 容器`, 'info');
            totalContainers += containers.length;
        }
    });

    // 查找所有文本元素
    const allElements = document.querySelectorAll('*');
    let textElements = 0;
    let longTextElements = 0;

    allElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
            textElements++;
            if (text.length > 50 && text.length < 300) {
                longTextElements++;
            }
        }
    });

    sendProgress(`页面分析: ${totalContainers}个容器, ${textElements}个文本元素, ${longTextElements}个长文本`, 'info');
}

// 直接通过关键词查找评论
async function findCommentsByKeyword(keyword) {
    sendProgress(`直接搜索包含"${keyword}"的文本...`, 'info');

    const comments = [];
    const allElements = document.querySelectorAll('*');

    allElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.includes(keyword) &&
            text.length > keyword.length + 5 &&
            text.length < 500 &&
            !element.querySelector('*') && // 叶子节点
            element.offsetHeight > 0) { // 可见元素

            // 尝试找到点赞按钮
            const likeButton = findLikeButtonAdvanced(element);

            const commentData = {
                element: element,
                text: text,
                likeButton: likeButton,
                isLiked: likeButton ? checkIfLiked(likeButton) : false
            };

            comments.push(commentData);
            sendProgress(`找到关键词文本: ${text.substring(0, 50)}...`, 'info');
        }
    });

    return comments;
}

// 高级点赞按钮查找
function findLikeButtonAdvanced(textElement) {
    // 从文本元素开始，向上查找多层父元素
    let current = textElement;

    for (let level = 0; level < 10; level++) {
        if (!current || !current.parentElement) break;
        current = current.parentElement;

        // 在当前层级查找点赞按钮
        const likeButton = findLikeButtonInContainer(current);
        if (likeButton) {
            sendProgress(`在第${level + 1}层找到点赞按钮`, 'info');
            return likeButton;
        }
    }

    return null;
}

// 在容器中查找点赞按钮
function findLikeButtonInContainer(container) {
    const likeSelectors = [
        '[class*="like"]',
        '[class*="Like"]',
        '[class*="praise"]',
        '[class*="Praise"]',
        '[class*="zan"]',
        '[class*="thumb"]',
        '[class*="heart"]',
        '[title*="赞"]',
        '[title*="点赞"]',
        '[aria-label*="赞"]',
        '[aria-label*="点赞"]',
        'button[class*="toolbar"]',
        'a[class*="toolbar"]',
        '.toolbar button',
        '.toolbar a'
    ];

    for (const selector of likeSelectors) {
        const buttons = container.querySelectorAll(selector);
        for (const button of buttons) {
            if (isClickable(button) && isLikeButton(button)) {
                return button;
            }
        }
    }

    return null;
}

// 判断是否为点赞按钮
function isLikeButton(element) {
    const text = element.textContent?.toLowerCase() || '';
    const title = element.title?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';

    const likeKeywords = ['赞', '点赞', 'like', 'praise', 'thumb', 'heart'];
    const allText = text + ' ' + title + ' ' + ariaLabel + ' ' + className;

    return likeKeywords.some(keyword => allText.includes(keyword));
}

// 提取评论数据
function extractCommentData(element) {
    const text = element.textContent?.trim();
    if (!text || text.length < 5) return null;
    
    // 查找点赞按钮
    const likeButton = findLikeButton(element);
    
    return {
        element: element,
        text: text,
        likeButton: likeButton,
        isLiked: checkIfLiked(likeButton)
    };
}

// 查找点赞按钮
function findLikeButton(commentElement) {
    // 从评论元素向上查找包含点赞按钮的容器
    let container = commentElement;
    for (let i = 0; i < 5; i++) {
        container = container.parentElement;
        if (!container) break;
        
        // 查找点赞按钮的各种可能选择器
        const likeSelectors = [
            '.WB_func .ficon_praise', // 微博点赞图标
            '.WB_func [action-type="feed_list_like"]', // 点赞按钮
            '.toolbar_item .like', // 工具栏点赞
            '[class*="like"]', // 包含like的类名
            '[class*="praise"]', // 包含praise的类名
            '.icon-praise', // 点赞图标
            '.icon-like' // 点赞图标
        ];
        
        for (const selector of likeSelectors) {
            const button = container.querySelector(selector);
            if (button && isClickable(button)) {
                return button;
            }
        }
    }
    
    return null;
}

// 检查元素是否可点击
function isClickable(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           !element.disabled &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
}

// 检查是否已点赞
function checkIfLiked(likeButton) {
    if (!likeButton) return false;
    
    // 检查各种已点赞的标识
    const likedIndicators = [
        'WB_praised', // 微博已点赞类名
        'praised', // 已点赞
        'liked', // 已点赞
        'active' // 激活状态
    ];
    
    for (const indicator of likedIndicators) {
        if (likeButton.classList.contains(indicator)) {
            return true;
        }
    }
    
    // 检查颜色变化（已点赞通常是红色或橙色）
    const style = window.getComputedStyle(likeButton);
    const color = style.color;
    if (color.includes('rgb(255') || color.includes('#ff') || color.includes('#f4') || color.includes('orange')) {
        return true;
    }
    
    return false;
}

// 根据关键词筛选评论
function filterCommentsByKeyword(comments, keyword) {
    return comments.filter(comment => {
        return comment.text.includes(keyword) && 
               comment.likeButton && 
               !comment.isLiked;
    });
}

// 点赞评论
async function likeComment(comment, interval) {
    if (!comment.likeButton || comment.isLiked) {
        return false;
    }

    try {
        // 滚动到评论位置
        comment.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // 点击点赞按钮
        comment.likeButton.click();

        // 等待一下检查是否点赞成功
        await sleep(1000);

        // 检查点赞状态
        const isNowLiked = checkIfLiked(comment.likeButton);
        return isNowLiked;

    } catch (error) {
        console.error('点赞失败:', error);
        return false;
    }
}

// 等待元素出现
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`元素 ${selector} 未找到`));
        }, timeout);
    });
}

// 延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 发送进度更新
function sendProgress(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    try {
        chrome.runtime.sendMessage({
            action: 'updateProgress',
            data: { message, type }
        });
    } catch (error) {
        console.error('Failed to send progress message:', error);
    }
}

// 完成任务
function completeTask() {
    console.log('Task completed');
    try {
        chrome.runtime.sendMessage({
            action: 'taskComplete'
        });
    } catch (error) {
        console.error('Failed to send task complete message:', error);
    }
}
