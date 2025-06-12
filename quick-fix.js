// 快速修复脚本 - 在微博页面的浏览器控制台中运行
// 这个脚本会立即修复链接复制问题

console.log('🔧 开始快速修复链接复制问题...');

// 1. 检查当前环境
function checkEnvironment() {
    console.log('📍 当前页面:', window.location.href);
    
    const isWeiboPage = window.location.href.includes('weibo.com') || window.location.href.includes('weibo.cn');
    console.log('✅ 是否为微博页面:', isWeiboPage);
    
    if (!isWeiboPage) {
        console.warn('⚠️ 当前不是微博页面，插件可能不会工作');
        return false;
    }
    
    return true;
}

// 2. 检查插件状态
function checkPluginStatus() {
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    console.log('🔍 找到复制按钮数量:', copyButtons.length);
    
    if (copyButtons.length === 0) {
        console.warn('❌ 没有找到复制按钮，可能的原因:');
        console.warn('1. 插件没有加载');
        console.warn('2. 页面中没有"网页链接"文本');
        console.warn('3. 插件需要重新加载');
        return false;
    }
    
    return true;
}

// 3. 分析现有按钮的链接
function analyzeExistingButtons() {
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    let hasCorrectLinks = true;
    
    copyButtons.forEach((button, index) => {
        const title = button.title || '';
        console.log(`📋 按钮 ${index + 1} 链接:`, title);
        
        const isWeiboLink = title.includes('weibo.com') && !title.includes('sinaimg.cn');
        const isImageLink = title.includes('.png') || title.includes('.jpg') || title.includes('sinaimg.cn');
        
        if (isImageLink) {
            console.warn(`❌ 按钮 ${index + 1} 选择了图片链接`);
            hasCorrectLinks = false;
        } else if (isWeiboLink) {
            console.log(`✅ 按钮 ${index + 1} 正确选择了微博链接`);
        } else {
            console.log(`ℹ️ 按钮 ${index + 1} 选择了其他类型链接`);
        }
    });
    
    return hasCorrectLinks;
}

// 4. 手动修复链接选择
function manualFixLinks() {
    console.log('🛠️ 开始手动修复链接选择...');
    
    // 查找所有包含"网页链接"的元素
    const linkElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('网页链接')
    );
    
    console.log(`找到 ${linkElements.length} 个包含"网页链接"的元素`);
    
    linkElements.forEach((element, index) => {
        console.log(`\n--- 处理元素 ${index + 1} ---`);
        
        // 收集该元素中的所有链接
        const allUrls = [];
        
        // 查找 a 标签
        const aElements = element.querySelectorAll('a[href]');
        aElements.forEach(a => {
            const href = a.getAttribute('href');
            if (href) {
                allUrls.push(href);
                console.log('找到 a 标签链接:', href);
            }
        });
        
        // 查找 img 标签
        const imgElements = element.querySelectorAll('img[src]');
        imgElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                allUrls.push(src);
                console.log('找到图片链接:', src);
            }
        });
        
        // 应用优先级选择
        const bestUrl = selectBestUrl(allUrls);
        console.log('选择的最佳链接:', bestUrl);
        
        // 查找现有的复制按钮
        const existingButton = element.querySelector('.weibo-chat-copy-btn');
        if (existingButton) {
            // 更新现有按钮
            updateCopyButton(existingButton, bestUrl);
            console.log('✅ 已更新现有复制按钮');
        } else {
            // 创建新的复制按钮
            createNewCopyButton(element, bestUrl);
            console.log('✅ 已创建新的复制按钮');
        }
    });
}

// 5. 链接优先级选择逻辑
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
        console.log('✅ 选择微博链接:', weiboUrls[0]);
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
        console.log('⚠️ 选择非图片链接:', nonImageUrls[0]);
        return nonImageUrls[0];
    }
    
    // 最后选择: 图片链接
    console.log('❌ 只能选择图片链接:', urls[0]);
    return urls[0];
}

// 6. 更新现有复制按钮
function updateCopyButton(button, newUrl) {
    if (!newUrl) return;
    
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
                newButton.style.color = originalColor;
            }, 2000);
        } catch (error) {
            console.error('❌ 复制失败:', error);
        }
    });
    
    button.parentNode.replaceChild(newButton, button);
}

// 7. 创建新的复制按钮
function createNewCopyButton(element, url) {
    if (!url) return;
    
    const button = document.createElement('button');
    button.className = 'weibo-chat-copy-btn';
    button.innerHTML = '📋';
    button.title = `复制链接: ${url}`;
    
    // 样式
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        borderRadius: '2px',
        color: '#1890ff',
        marginLeft: '4px',
        fontSize: '12px'
    });
    
    // 点击事件
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            await navigator.clipboard.writeText(url);
            console.log('✅ 链接复制成功:', url);
            button.style.color = '#52c41a';
            setTimeout(() => {
                button.style.color = '#1890ff';
            }, 2000);
        } catch (error) {
            console.error('❌ 复制失败:', error);
        }
    });
    
    // 插入按钮
    const linkTextNode = findLinkTextInElement(element);
    if (linkTextNode && linkTextNode.parentNode) {
        linkTextNode.parentNode.appendChild(button);
    } else {
        element.appendChild(button);
    }
}

// 8. 查找"网页链接"文本节点
function findLinkTextInElement(element) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                return node.textContent.includes('网页链接') ? 
                    NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        }
    );
    return walker.nextNode();
}

// 主修复函数
function quickFix() {
    console.log('🚀 开始快速修复...\n');
    
    // 检查环境
    if (!checkEnvironment()) {
        console.log('❌ 环境检查失败，无法继续');
        return;
    }
    
    // 检查插件状态
    const hasButtons = checkPluginStatus();
    
    if (hasButtons) {
        // 分析现有按钮
        const hasCorrectLinks = analyzeExistingButtons();
        
        if (hasCorrectLinks) {
            console.log('✅ 所有链接都正确，无需修复');
            return;
        }
    }
    
    // 执行手动修复
    manualFixLinks();
    
    console.log('\n🎉 快速修复完成！');
    console.log('📋 请测试复制功能是否正常工作');
}

// 运行快速修复
quickFix();
