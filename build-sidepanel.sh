#!/bin/bash

# 构建sidepanel版本的插件
echo "🔨 构建sidepanel版本的微博控评助手..."

# 清理构建目录
rm -rf build

# 执行构建
pnpm build

echo "✅ 构建完成！"
echo "📁 构建文件位置: build/chrome-mv3-prod/"
echo "🔧 请在Chrome扩展管理页面加载 build/chrome-mv3-prod/ 目录"
echo ""
echo "📋 功能说明:"
echo "  • 点击插件图标将打开侧边面板"
echo "  • 侧边面板提供完整的控制界面"
echo "  • 执行日志区域更大，便于查看"
echo "  • 现代化的侧边抽屉设计"
