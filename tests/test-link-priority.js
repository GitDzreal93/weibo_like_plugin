// 测试链接优先级选择逻辑
// 这个脚本可以在浏览器控制台中运行来测试修复效果

console.log('🔗 开始测试链接优先级选择逻辑...');

// 模拟 selectBestUrl 方法
function selectBestUrl(urls) {
    if (urls.length === 0) {
        return null;
    }

    console.log('选择最佳URL，候选列表:', urls);

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

// 测试用例
const testCases = [
    {
        name: '测试1: emoji图片 + 微博链接',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
            'https://weibo.com/6036398570/5176350752903605'
        ],
        expected: 'https://weibo.com/6036398570/5176350752903605'
    },
    {
        name: '测试2: 多个图片 + 微博链接',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
            'https://example.com/image.jpg',
            'https://weibo.com/u/1234567890/ABCDEFGHIJ'
        ],
        expected: 'https://weibo.com/u/1234567890/ABCDEFGHIJ'
    },
    {
        name: '测试3: emoji + Twitter链接',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
            'https://twitter.com/user/status/1234567890'
        ],
        expected: 'https://twitter.com/user/status/1234567890'
    },
    {
        name: '测试4: emoji + 新闻链接',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
            'https://news.sina.com.cn/article/12345.html'
        ],
        expected: 'https://news.sina.com.cn/article/12345.html'
    },
    {
        name: '测试5: 只有图片链接',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png'
        ],
        expected: 'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png'
    },
    {
        name: '测试6: 复杂混合情况',
        urls: [
            'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png',
            'https://example.com/image.jpg',
            'https://baidu.com',
            'https://weibo.com/5555555555/XYXYXYXYXY'
        ],
        expected: 'https://weibo.com/5555555555/XYXYXYXYXY'
    }
];

// 运行测试
let passedTests = 0;
let totalTests = testCases.length;

console.log(`\n🧪 开始运行 ${totalTests} 个测试用例...\n`);

testCases.forEach((testCase, index) => {
    console.log(`\n--- ${testCase.name} ---`);
    const result = selectBestUrl(testCase.urls);
    const passed = result === testCase.expected;
    
    if (passed) {
        console.log(`✅ 测试通过`);
        console.log(`   结果: ${result}`);
        passedTests++;
    } else {
        console.log(`❌ 测试失败`);
        console.log(`   期望: ${testCase.expected}`);
        console.log(`   实际: ${result}`);
    }
});

console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);

if (passedTests === totalTests) {
    console.log('🎉 所有测试都通过了！链接优先级逻辑工作正常。');
} else {
    console.log('⚠️ 有测试失败，需要检查链接选择逻辑。');
}

// 提供手动测试指导
console.log(`
📋 手动测试步骤:
1. 确保插件开发服务器正在运行 (pnpm run dev)
2. 在Chrome中重新加载插件
3. 访问微博聊天页面
4. 查找包含"网页链接"的消息
5. 点击复制按钮
6. 检查复制的链接是否为微博链接而不是图片链接

🔍 调试提示:
- 在微博聊天页面按F12打开控制台
- 查看插件的日志输出
- 检查 "Extracted link URL:" 和 "Selected best URL:" 的日志
`);
