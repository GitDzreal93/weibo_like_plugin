// 调试微博聊天链接复制功能
// 在微博聊天页面的浏览器控制台中运行这个脚本

console.log('🔍 开始调试微博聊天链接复制功能...');

// 检查插件是否已加载
function checkExtensionLoaded() {
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    console.log(`找到 ${copyButtons.length} 个复制按钮`);
    
    if (copyButtons.length === 0) {
        console.warn('❌ 没有找到复制按钮，可能的原因：');
        console.warn('1. 插件没有加载');
        console.warn('2. 页面URL不匹配 (需要包含 api.weibo.com/chat)');
        console.warn('3. 页面中没有"网页链接"文本');
        console.warn('当前页面URL:', window.location.href);
        
        // 检查是否有"网页链接"文本
        const linkTexts = document.querySelectorAll('*');
        let foundLinkText = false;
        for (const element of linkTexts) {
            if (element.textContent && element.textContent.includes('网页链接')) {
                foundLinkText = true;
                console.log('✅ 找到"网页链接"文本:', element);
                break;
            }
        }
        
        if (!foundLinkText) {
            console.warn('❌ 页面中没有找到"网页链接"文本');
        }
        
        return false;
    }
    
    return true;
}

// 分析复制按钮的链接
function analyzeButtons() {
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    
    copyButtons.forEach((button, index) => {
        console.log(`\n--- 复制按钮 ${index + 1} ---`);
        console.log('按钮元素:', button);
        console.log('按钮title:', button.title);
        
        // 查找按钮所在的消息元素
        let messageElement = button.closest('*');
        while (messageElement && !messageElement.textContent.includes('网页链接')) {
            messageElement = messageElement.parentElement;
        }
        
        if (messageElement) {
            console.log('消息元素:', messageElement);
            console.log('消息文本:', messageElement.textContent.substring(0, 200));
            console.log('消息HTML:', messageElement.outerHTML.substring(0, 300));
            
            // 分析消息中的所有链接
            const allLinks = messageElement.querySelectorAll('a[href]');
            console.log(`消息中的链接数量: ${allLinks.length}`);
            
            allLinks.forEach((link, linkIndex) => {
                const href = link.getAttribute('href');
                console.log(`  链接 ${linkIndex + 1}: ${href}`);
                console.log(`    链接文本: "${link.textContent}"`);
                console.log(`    是否为微博链接: ${href && href.includes('weibo.com') && !href.includes('sinaimg.cn')}`);
                console.log(`    是否为图片链接: ${href && (href.includes('.png') || href.includes('.jpg') || href.includes('sinaimg.cn'))}`);
            });
            
            // 分析所有img标签
            const allImages = messageElement.querySelectorAll('img[src]');
            console.log(`消息中的图片数量: ${allImages.length}`);
            
            allImages.forEach((img, imgIndex) => {
                const src = img.getAttribute('src');
                console.log(`  图片 ${imgIndex + 1}: ${src}`);
            });
        }
    });
}

// 模拟链接提取逻辑
function simulateExtraction(messageElement) {
    console.log('\n🧪 模拟链接提取逻辑...');
    
    const allUrls = [];
    
    // 方法1: 查找 a 标签
    const linkElements = messageElement.querySelectorAll('a[href]');
    console.log(`找到 ${linkElements.length} 个 a 标签`);
    
    for (const linkElement of linkElements) {
        const href = linkElement.getAttribute('href');
        if (href) {
            allUrls.push(href);
            console.log(`从 a 标签获取: ${href}`);
        }
    }
    
    // 方法2: 查找所有元素的URL属性
    const allElements = messageElement.querySelectorAll('*');
    for (const el of allElements) {
        const urlAttributes = ['href', 'src', 'data-url', 'data-link', 'data-href', 'data-target'];
        for (const attr of urlAttributes) {
            const value = el.getAttribute(attr);
            if (value && value.startsWith('http') && !allUrls.includes(value)) {
                allUrls.push(value);
                console.log(`从 ${attr} 属性获取: ${value}`);
            }
        }
    }
    
    // 方法3: 从文本中提取URL
    const text = messageElement.textContent || '';
    const urlRegex = /(https?:\/\/[^\s\u4e00-\u9fff]+)/g;
    const matches = text.match(urlRegex);
    if (matches) {
        for (const match of matches) {
            if (!allUrls.includes(match)) {
                allUrls.push(match);
                console.log(`从文本获取: ${match}`);
            }
        }
    }
    
    console.log('\n所有找到的URL:', allUrls);
    
    // 应用优先级选择
    const bestUrl = selectBestUrl(allUrls);
    console.log('选择的最佳URL:', bestUrl);
    
    return bestUrl;
}

// 链接优先级选择逻辑
function selectBestUrl(urls) {
    if (urls.length === 0) return null;
    
    console.log('应用优先级选择...');
    
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
    
    // 优先级2: 其他社交媒体链接
    const socialUrls = urls.filter(url => 
        url.includes('twitter.com') || 
        url.includes('facebook.com') || 
        url.includes('instagram.com') ||
        url.includes('douyin.com') ||
        url.includes('tiktok.com')
    );
    if (socialUrls.length > 0) {
        console.log('✅ 找到社交媒体链接:', socialUrls);
        return socialUrls[0];
    }
    
    // 优先级3: 新闻或内容网站
    const contentUrls = urls.filter(url => 
        !url.includes('sinaimg.cn') && 
        !url.includes('timeline_card') &&
        !url.includes('.jpg') &&
        !url.includes('.png') &&
        !url.includes('.gif') &&
        !url.includes('.jpeg') &&
        !url.includes('.webp')
    );
    if (contentUrls.length > 0) {
        console.log('✅ 找到内容链接:', contentUrls);
        return contentUrls[0];
    }
    
    // 最后选择: 任何非图片链接
    const nonImageUrls = urls.filter(url => 
        !url.includes('.jpg') &&
        !url.includes('.png') &&
        !url.includes('.gif') &&
        !url.includes('.jpeg') &&
        !url.includes('.webp')
    );
    if (nonImageUrls.length > 0) {
        console.log('✅ 找到非图片链接:', nonImageUrls);
        return nonImageUrls[0];
    }
    
    // 如果只有图片链接，返回第一个
    console.log('⚠️ 只找到图片链接，返回第一个:', urls[0]);
    return urls[0];
}

// 测试特定的微博链接
function testSpecificLink() {
    const testUrl = 'https://weibo.com/2323589097/5176488632521341?ua=Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML,%20like%20Gecko%29%20Chrome%2F137.0.0.0%20Safari%2F537.36';
    
    console.log('\n🔗 测试特定微博链接:', testUrl);
    
    const testUrls = [
        'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
        testUrl
    ];
    
    const result = selectBestUrl(testUrls);
    console.log('选择结果:', result);
    console.log('是否选择了微博链接:', result === testUrl);
}

// 主要调试函数
function debugLinkCopy() {
    console.log('🔍 开始完整调试...\n');
    
    // 1. 检查插件是否加载
    if (!checkExtensionLoaded()) {
        return;
    }
    
    // 2. 分析现有按钮
    analyzeButtons();
    
    // 3. 测试特定链接
    testSpecificLink();
    
    // 4. 为每个消息元素模拟提取
    const copyButtons = document.querySelectorAll('.weibo-chat-copy-btn');
    copyButtons.forEach((button, index) => {
        let messageElement = button.closest('*');
        while (messageElement && !messageElement.textContent.includes('网页链接')) {
            messageElement = messageElement.parentElement;
        }
        
        if (messageElement) {
            console.log(`\n--- 模拟消息 ${index + 1} 的链接提取 ---`);
            simulateExtraction(messageElement);
        }
    });
    
    console.log('\n✅ 调试完成！');
    console.log('\n📋 下一步操作建议:');
    console.log('1. 如果插件没有加载，请重新加载Chrome扩展');
    console.log('2. 如果选择了错误的链接，请检查控制台中的"Selected best URL"日志');
    console.log('3. 如果需要强制重新处理，请刷新页面');
}

// 运行调试
debugLinkCopy();
