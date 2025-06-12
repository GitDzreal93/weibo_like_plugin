// 测试重定向链接修复
console.log('🔧 测试重定向链接修复...');

// 测试重定向链接解析
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

// 测试你的具体链接
const testLinks = [
    'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5174508459136591',
    'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5174193555769706',
    'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5173204882296842'
];

console.log('\n=== 测试重定向链接解析 ===');
testLinks.forEach((link, index) => {
    console.log(`\n--- 测试 ${index + 1} ---`);
    const result = extractActualUrl(link);
    console.log('原链接:', link);
    console.log('解析结果:', result);
    console.log('是否为微博链接:', result.includes('weibo.com') && !result.includes('sinaimg.cn'));
});

// 测试链接优先级选择
function selectBestUrl(urls) {
    if (urls.length === 0) return null;
    
    console.log('\n=== 应用优先级选择 ===');
    console.log('候选链接:', urls);
    
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
    
    // 其他优先级...
    console.log('⚠️ 未找到微博链接');
    return urls[0];
}

// 模拟完整的链接提取和选择过程
console.log('\n=== 模拟完整处理过程 ===');

const mockUrls = [
    'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
    'https://weibo.cn/sinaurl?u=https%3A%2F%2Fweibo.com%2F6623521716%2F5174508459136591'
];

console.log('原始链接列表:', mockUrls);

// 第1步: 解析重定向
const processedUrls = mockUrls.map(url => extractActualUrl(url));
console.log('解析后链接列表:', processedUrls);

// 第2步: 选择最佳链接
const bestUrl = selectBestUrl(processedUrls);
console.log('最终选择的链接:', bestUrl);

// 验证结果
const isCorrect = bestUrl && bestUrl.includes('weibo.com') && !bestUrl.includes('sinaimg.cn');
console.log('选择结果是否正确:', isCorrect ? '✅ 正确' : '❌ 错误');

if (isCorrect) {
    console.log('🎉 修复成功！现在应该能正确复制微博链接了。');
} else {
    console.log('❌ 修复失败，需要进一步调试。');
}

// 提供手动修复代码
console.log('\n=== 手动修复代码 ===');
console.log('如果自动修复不工作，请在微博页面控制台运行以下代码:');

const manualFixCode = `
// 手动修复重定向链接问题
document.querySelectorAll('.weibo-chat-copy-btn').forEach(button => {
    const parent = button.closest('*');
    const links = Array.from(parent.querySelectorAll('a[href]'));
    
    // 查找并解析重定向链接
    const weiboLink = links.find(a => {
        let href = a.href;
        
        // 处理重定向
        if (href.includes('weibo.cn/sinaurl?u=')) {
            try {
                const url = new URL(href);
                const uParam = url.searchParams.get('u');
                if (uParam) {
                    href = decodeURIComponent(uParam);
                }
            } catch (e) {}
        }
        
        return href.includes('weibo.com') && !href.includes('sinaimg.cn');
    });
    
    if (weiboLink) {
        let actualUrl = weiboLink.href;
        
        // 解析重定向
        if (actualUrl.includes('weibo.cn/sinaurl?u=')) {
            try {
                const url = new URL(actualUrl);
                const uParam = url.searchParams.get('u');
                if (uParam) {
                    actualUrl = decodeURIComponent(uParam);
                }
            } catch (e) {}
        }
        
        // 更新按钮
        button.title = \`复制链接: \${actualUrl}\`;
        button.onclick = async () => {
            await navigator.clipboard.writeText(actualUrl);
            console.log('✅ 复制成功:', actualUrl);
        };
        
        console.log('✅ 已修复按钮，链接:', actualUrl);
    }
});
`;

console.log(manualFixCode);
