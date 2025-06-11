// 任务状态管理
let taskState = {
    isRunning: false,
    currentIndex: 0,
    totalLinks: 0,
    links: [],
    settings: {},
    currentTabId: null
};

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender) => {
    switch (message.action) {
        case 'startTask':
            startTask(message.data);
            break;
        case 'stopTask':
            stopTask();
            break;
        case 'taskComplete':
            handleTaskComplete();
            break;
        case 'taskError':
            handleTaskError(message.error);
            break;
        case 'updateProgress':
            updateProgress(message.data);
            break;
    }
});

// 开始任务
async function startTask(data) {
    if (taskState.isRunning) {
        sendLogToPopup('任务已在运行中', 'warning');
        return;
    }
    
    taskState = {
        isRunning: true,
        currentIndex: 0,
        totalLinks: data.links.length,
        links: data.links,
        settings: data.settings,
        currentTabId: null
    };
    
    // 保存状态到storage
    await saveTaskState();
    
    sendLogToPopup('任务开始执行', 'info');
    processNextLink();
}

// 停止任务
async function stopTask() {
    taskState.isRunning = false;

    // 不关闭标签页，只是停止任务
    if (taskState.currentTabId) {
        sendLogToPopup('任务已停止，当前标签页保持打开', 'warning');
    }

    // 清除状态
    await clearTaskState();
    sendLogToPopup('任务已停止', 'warning');
    notifyPopupStatusUpdate();
}

// 处理下一个链接
async function processNextLink() {
    if (!taskState.isRunning || taskState.currentIndex >= taskState.totalLinks) {
        await completeAllTasks();
        return;
    }
    
    const currentLink = taskState.links[taskState.currentIndex];
    taskState.currentLink = currentLink;
    
    sendLogToPopup(`开始处理第${taskState.currentIndex + 1}个链接`, 'info');
    
    try {
        // 创建新标签页
        const tab = await chrome.tabs.create({
            url: currentLink,
            active: false
        });
        
        taskState.currentTabId = tab.id;
        await saveTaskState();
        notifyPopupStatusUpdate();
        
        // 等待页面加载完成后注入脚本
        chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo) {
            if (tabId === taskState.currentTabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onTabUpdated);

                sendLogToPopup('页面加载完成，准备注入脚本...', 'info');

                // 延迟确保页面完全加载
                setTimeout(() => {
                    injectTaskScript(tabId);
                }, 3000);
            }
        });
        
    } catch (error) {
        sendLogToPopup(`打开链接失败: ${error.message}`, 'error');
        await moveToNextLink();
    }
}

// 注入任务脚本
async function injectTaskScript(tabId) {
    try {
        // 首先检查标签页是否还存在
        const tab = await chrome.tabs.get(tabId);
        if (!tab) {
            throw new Error('标签页不存在');
        }

        // 检查URL是否为微博页面
        if (!tab.url.includes('weibo.com') && !tab.url.includes('weibo.cn')) {
            throw new Error('不是微博页面');
        }

        sendLogToPopup('正在注入脚本到微博页面...', 'info');

        // 先注入一个简单的测试脚本
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                console.log('脚本注入成功，页面URL:', window.location.href);
                return window.location.href;
            }
        });

        // 发送消息给content script执行任务
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: 'executeTask',
                settings: taskState.settings
            });
            sendLogToPopup('任务消息已发送到页面', 'info');
        } catch (msgError) {
            throw new Error(`发送消息失败: ${msgError.message}`);
        }

        sendLogToPopup('脚本注入成功，开始分析页面', 'info');

        // 设置超时检查，如果10秒内没有响应就认为失败
        setTimeout(() => {
            if (taskState.isRunning && taskState.currentTabId === tabId) {
                sendLogToPopup('页面分析超时，可能页面结构不匹配', 'warning');
                handleTaskError('页面分析超时');
            }
        }, 10000);

    } catch (error) {
        if (error.message.includes('Cannot access')) {
            sendLogToPopup('权限错误：请重新安装插件并确保权限设置正确', 'error');
        } else {
            sendLogToPopup(`注入脚本失败: ${error.message}`, 'error');
        }
        await moveToNextLink();
    }
}

// 注释：现在使用消息传递而不是函数注入

// 处理任务完成
async function handleTaskComplete() {
    sendLogToPopup(`第${taskState.currentIndex + 1}个链接处理完成`, 'success');

    // 不关闭标签页，只是标记为完成
    sendLogToPopup('任务完成，标签页保持打开状态', 'info');

    await moveToNextLink();
}

// 处理任务错误
async function handleTaskError(error) {
    sendLogToPopup(`处理链接时出错: ${error}`, 'error');

    // 不关闭标签页，只是标记为出错
    sendLogToPopup('任务出错，标签页保持打开状态以便检查', 'warning');

    await moveToNextLink();
}

// 移动到下一个链接
async function moveToNextLink() {
    taskState.currentIndex++;
    taskState.currentTabId = null;
    await saveTaskState();
    
    // 等待一段时间再处理下一个链接，避免过于频繁
    setTimeout(() => {
        processNextLink();
    }, taskState.settings.interval || 1000);
}

// 完成所有任务
async function completeAllTasks() {
    taskState.isRunning = false;
    await clearTaskState();
    
    sendLogToPopup(`所有任务完成！共处理${taskState.totalLinks}个链接`, 'success');
    notifyPopupStatusUpdate();
}

// 更新进度
async function updateProgress(data) {
    sendLogToPopup(data.message, data.type || 'info');
}

// 保存任务状态
async function saveTaskState() {
    await chrome.storage.local.set({ taskState });
}

// 清除任务状态
async function clearTaskState() {
    await chrome.storage.local.remove(['taskState']);
}

// 发送日志到popup
function sendLogToPopup(message, type = 'info') {
    chrome.runtime.sendMessage({
        action: 'addLog',
        message: message,
        type: type
    }).catch(() => {
        // popup可能已关闭，忽略错误
    });
}

// 通知popup更新状态
function notifyPopupStatusUpdate() {
    chrome.runtime.sendMessage({
        action: 'updateStatus'
    }).catch(() => {
        // popup可能已关闭，忽略错误
    });
}

// 扩展启动时恢复任务状态
chrome.runtime.onStartup.addListener(async () => {
    const result = await chrome.storage.local.get(['taskState']);
    if (result.taskState && result.taskState.isRunning) {
        // 如果有未完成的任务，重置状态
        await clearTaskState();
    }
});

// 扩展安装时清理状态
chrome.runtime.onInstalled.addListener(async () => {
    await clearTaskState();
});
