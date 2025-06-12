// 立即修复重定向链接问题
// 在微博页面的浏览器控制台中运行这个代码

console.log('🔧 开始立即修复重定向链接问题...');

// 重定向链接解析函数
function extractActualUrl(url) {
    console.log('处理链接:', url);
    
    // 处理微博重定向链接
    if (url.includes('weibo.cn/sinaurl?u=')) {
        try {
            const urlObj = new URL(url);
            const uParam = urlObj.searchParams.get('u');
            if (uParam) {
                const decodedUrl = decodeURIComponent(uParam);
                console.log('✅ 从重定向提取:', decodedUrl);
                return decodedUrl;
            }
        } catch (error) {
            console.log('❌ 重定向解析失败:', error);
        }
    }
    
    // 处理其他重定向格式
    if (url.includes('sinaurl') && url.includes('http')) {
        const match = url.match(/https?%3A%2F%2F[^&]+/);
        if (match) {
            const decodedUrl = decodeURIComponent(match[0]);
            console.log('✅ 从编码重定向提取:', decodedUrl);
            return decodedUrl;
        }
    }
    
    console.log('ℹ️ 无需处理，返回原链接');
    return url;
}

// 链接优先级选择
function selectBestUrl(urls) {
    if (urls.length === 0) return null;
    
    console.log('应用优先级选择，候选链接:', urls);
    
    // 优先级1: 微博链接
    const weiboUrls = urls.filter(url => 
        url.includes('weibo.com') && 
        !url.includes('sinaimg.cn') && 
        !url.includes('timeline_card')
    );
    if (weiboUrls.length > 0) {
        console.log('✅ 找到微博链接:', weiboUrls);
        return weiboUrls[0];
    }
    
    // 优先级2: 非图片链接
    const nonImageUrls = urls.filter(url => 
        !url.includes('.jpg') &&
        !url.includes('.png') &&
        !url.includes('.gif') &&
        !url.includes('.jpeg') &&
        !url.includes('.webp') &&
        !url.includes('sinaimg.cn')
    );
    if (nonImageUrls.length > 0) {
        console.log('⚠️ 找到非图片链接:', nonImageUrls);
        return nonImageUrls[0];
    }
    
    // 最后选择: 图片链接
    console.log('❌ 只找到图片链接:', urls[0]);
    return urls[0];
}

// 立即修复所有现有的复制按钮
function fixAllCopyButtons() {
    console.log('🛠️ 开始修复所有复制按钮...');
    
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    console.log(`找到 ${copyButtons.length} 个复制按钮`);
    
    if (copyButtons.length === 0) {
        console.log('❌ 没有找到复制按钮，尝试手动创建...');
        createNewCopyButtons();
        return;
    }
    
    copyButtons.forEach((button, index) => {
        console.log(`\n--- 修复按钮 ${index + 1} ---`);
        
        // 找到按钮所在的消息元素
        let messageElement = button.closest('*');
        while (messageElement && !messageElement.textContent.includes('网页链接')) {
            messageElement = messageElement.parentElement;
        }
        
        if (!messageElement) {
            console.log(`❌ 按钮 ${index + 1} 找不到消息元素`);
            return;
        }
        
        console.log(`按钮 ${index + 1} 消息元素:`, messageElement);
        
        // 收集该元素中的所有链接
        const allUrls = [];
        
        // 查找 a 标签
        const linkElements = messageElement.querySelectorAll('a[href]');
        linkElements.forEach(linkElement => {
            const href = linkElement.getAttribute('href');
            if (href) {
                // 处理重定向
                const actualUrl = extractActualUrl(href);
                allUrls.push(actualUrl);
                console.log(`  从 a 标签获取: ${actualUrl}`);
            }
        });
        
        // 查找 img 标签
        const imgElements = messageElement.querySelectorAll('img[src]');
        imgElements.forEach(imgElement => {
            const src = imgElement.getAttribute('src');
            if (src) {
                allUrls.push(src);
                console.log(`  从 img 标签获取: ${src}`);
            }
        });
        
        console.log(`按钮 ${index + 1} 收集到的所有URL:`, allUrls);
        
        // 选择最佳链接
        const bestUrl = selectBestUrl(allUrls);
        console.log(`按钮 ${index + 1} 选择的最佳链接:`, bestUrl);
        
        if (bestUrl) {
            // 更新按钮
            updateCopyButton(button, bestUrl);
            console.log(`✅ 按钮 ${index + 1} 修复完成`);
        } else {
            console.log(`❌ 按钮 ${index + 1} 没有找到合适的链接`);
        }
    });
}

// 更新复制按钮
function updateCopyButton(button, newUrl) {
    const displayUrl = newUrl.length > 50 ? newUrl.substring(0, 47) + '...' : newUrl;
    button.title = `复制链接: ${displayUrl}`;
    
    // 移除旧的事件监听器并添加新的
    const newButton = button.cloneNode(true);
    newButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            await navigator.clipboard.writeText(newUrl);
            console.log('✅ 链接复制成功:', newUrl);
            
            // 显示成功反馈
            const originalColor = newButton.style.color;
            newButton.style.color = '#52c41a';
            setTimeout(() => {
                newButton.style.color = originalColor || '#1890ff';
            }, 2000);
        } catch (error) {
            console.error('❌ 复制失败:', error);
        }
    });
    
    button.parentNode.replaceChild(newButton, button);
}

// 创建新的复制按钮（如果没有找到现有的）
function createNewCopyButtons() {
    console.log('🆕 创建新的复制按钮...');
    
    // 查找所有包含"网页链接"的元素
    const linkElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('网页链接')
    );
    
    console.log(`找到 ${linkElements.length} 个包含"网页链接"的元素`);
    
    linkElements.forEach((element, index) => {
        console.log(`\n--- 处理元素 ${index + 1} ---`);
        
        // 检查是否已经有复制按钮
        if (element.querySelector('.weibo-chat-copy-btn')) {
            console.log(`元素 ${index + 1} 已经有复制按钮，跳过`);
            return;
        }
        
        // 收集链接
        const allUrls = [];
        
        // 查找 a 标签
        const linkElements = element.querySelectorAll('a[href]');
        linkElements.forEach(linkElement => {
            const href = linkElement.getAttribute('href');
            if (href) {
                const actualUrl = extractActualUrl(href);
                allUrls.push(actualUrl);
            }
        });
        
        // 查找 img 标签
        const imgElements = element.querySelectorAll('img[src]');
        imgElements.forEach(imgElement => {
            const src = imgElement.getAttribute('src');
            if (src) {
                allUrls.push(src);
            }
        });
        
        console.log(`元素 ${index + 1} 收集到的URL:`, allUrls);
        
        // 选择最佳链接
        const bestUrl = selectBestUrl(allUrls);
        console.log(`元素 ${index + 1} 选择的链接:`, bestUrl);
        
        if (bestUrl) {
            // 创建复制按钮
            const button = document.createElement('button');
            button.className = 'weibo-chat-copy-btn';
            button.innerHTML = '📋';
            button.title = `复制链接: ${bestUrl}`;
            button.style.cssText = `
                background: none;
                border: none;
                cursor: pointer;
                color: #1890ff;
                margin-left: 4px;
                padding: 2px;
                border-radius: 2px;
                font-size: 12px;
            `;
            
            // 添加点击事件
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    await navigator.clipboard.writeText(bestUrl);
                    console.log('✅ 复制成功:', bestUrl);
                    button.style.color = '#52c41a';
                    setTimeout(() => button.style.color = '#1890ff', 2000);
                } catch (error) {
                    console.error('❌ 复制失败:', error);
                }
            });
            
            // 插入按钮
            element.appendChild(button);
            console.log(`✅ 元素 ${index + 1} 创建复制按钮完成`);
        } else {
            console.log(`❌ 元素 ${index + 1} 没有找到合适的链接`);
        }
    });
}

// 测试重定向解析
function testRedirectParsing() {
    console.log('\n🧪 测试重定向解析...');
    
    const testUrls = [
        'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5174508459136591',
        'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5174193555769706',
        'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png'
    ];
    
    testUrls.forEach((url, index) => {
        console.log(`\n测试 ${index + 1}: ${url}`);
        const result = extractActualUrl(url);
        console.log(`结果: ${result}`);
        console.log(`是否为微博链接: ${result.includes('weibo.com') && !result.includes('sinaimg.cn')}`);
    });
    
    console.log('\n测试优先级选择:');
    const bestUrl = selectBestUrl(testUrls.map(extractActualUrl));
    console.log('最终选择:', bestUrl);
    console.log('选择正确:', bestUrl && bestUrl.includes('weibo.com/6623521716'));
}

// 主函数
function main() {
    console.log('🚀 开始执行立即修复...\n');
    
    // 1. 测试重定向解析
    testRedirectParsing();
    
    // 2. 修复现有按钮
    fixAllCopyButtons();
    
    console.log('\n🎉 立即修复完成！');
    console.log('📋 请测试复制功能是否正常工作');
    console.log('💡 如果还有问题，请刷新页面后重新运行此脚本');
}

// 运行修复
main();
