// DOM元素
const elements = {
    keyword: document.getElementById('keyword'),
    maxLikes: document.getElementById('maxLikes'),
    interval: document.getElementById('interval'),
    keepTabs: document.getElementById('keepTabs'),
    weiboLinks: document.getElementById('weiboLinks'),
    linkCount: document.getElementById('linkCount'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    clearBtn: document.getElementById('clearBtn'),
    status: document.getElementById('status'),
    progress: document.getElementById('progress'),
    currentLink: document.getElementById('currentLink'),
    logOutput: document.getElementById('logOutput'),
    clearLogBtn: document.getElementById('clearLogBtn')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await updateStatus();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    // 链接输入框变化
    elements.weiboLinks.addEventListener('input', updateLinkCount);
    
    // 按钮事件
    elements.startBtn.addEventListener('click', startExecution);
    elements.stopBtn.addEventListener('click', stopExecution);
    elements.clearBtn.addEventListener('click', clearAll);
    elements.clearLogBtn.addEventListener('click', clearLog);
    
    // 设置变化自动保存
    ['keyword', 'maxLikes', 'interval', 'keepTabs'].forEach(id => {
        elements[id].addEventListener('change', saveSettings);
    });
}

// 更新链接数量
function updateLinkCount() {
    const links = getLinksFromTextarea();
    elements.linkCount.textContent = links.length;
}

// 从文本框获取链接
function getLinksFromTextarea() {
    const text = elements.weiboLinks.value.trim();
    if (!text) return [];
    
    return text.split('\n')
        .map(link => link.trim())
        .filter(link => link && (link.includes('weibo.com') || link.includes('m.weibo.cn')));
}

// 保存设置
async function saveSettings() {
    const settings = {
        keyword: elements.keyword.value,
        maxLikes: parseInt(elements.maxLikes.value),
        interval: parseInt(elements.interval.value),
        keepTabs: elements.keepTabs.checked
    };

    await chrome.storage.local.set({ settings });
}

// 加载设置
async function loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) {
        elements.keyword.value = result.settings.keyword || '陈昊宇';
        elements.maxLikes.value = result.settings.maxLikes || 3;
        elements.interval.value = result.settings.interval || 1000;
        elements.keepTabs.checked = result.settings.keepTabs !== false; // 默认为true
    }
}

// 更新状态显示
async function updateStatus() {
    const result = await chrome.storage.local.get(['taskState']);
    const taskState = result.taskState;
    
    if (taskState && taskState.isRunning) {
        elements.status.textContent = '执行中';
        elements.progress.textContent = `${taskState.currentIndex}/${taskState.totalLinks}`;
        elements.currentLink.textContent = taskState.currentLink || '无';
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;
    } else {
        elements.status.textContent = '待机';
        elements.progress.textContent = '0/0';
        elements.currentLink.textContent = '无';
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
    }
    
    // 加载日志
    await loadLogs();
}

// 开始执行
async function startExecution() {
    const links = getLinksFromTextarea();
    if (links.length === 0) {
        addLog('错误：请输入至少一个有效的微博链接', 'error');
        return;
    }
    
    await saveSettings();
    
    const taskData = {
        links: links,
        settings: {
            keyword: elements.keyword.value,
            maxLikes: parseInt(elements.maxLikes.value),
            interval: parseInt(elements.interval.value)
        }
    };
    
    // 发送消息给background script开始任务
    chrome.runtime.sendMessage({
        action: 'startTask',
        data: taskData
    });
    
    addLog(`开始执行任务，共${links.length}个链接`, 'info');
    await updateStatus();
}

// 停止执行
async function stopExecution() {
    chrome.runtime.sendMessage({ action: 'stopTask' });
    addLog('用户手动停止任务', 'warning');
    await updateStatus();
}

// 清空所有
function clearAll() {
    elements.weiboLinks.value = '';
    updateLinkCount();
    clearLog();
}

// 清空日志
function clearLog() {
    elements.logOutput.innerHTML = '';
    chrome.storage.local.remove(['logs']);
}

// 添加日志
async function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // 显示在界面上
    const logDiv = document.createElement('div');
    logDiv.className = `log-entry log-${type}`;
    logDiv.textContent = logEntry;
    elements.logOutput.appendChild(logDiv);
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
    
    // 保存到storage
    const result = await chrome.storage.local.get(['logs']);
    const logs = result.logs || [];
    logs.push({ message: logEntry, type, timestamp: Date.now() });
    
    // 只保留最近100条日志
    if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
    }
    
    await chrome.storage.local.set({ logs });
}

// 加载日志
async function loadLogs() {
    const result = await chrome.storage.local.get(['logs']);
    const logs = result.logs || [];
    
    elements.logOutput.innerHTML = '';
    logs.forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry log-${log.type}`;
        logDiv.textContent = log.message;
        elements.logOutput.appendChild(logDiv);
    });
    
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
        updateStatus();
    } else if (message.action === 'addLog') {
        addLog(message.message, message.type);
    }
});
