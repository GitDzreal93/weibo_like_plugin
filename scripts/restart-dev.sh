#!/bin/bash

# 微博控评插件开发重启脚本
# 用于解决 Extension context invalidated 错误

echo "🔄 重启微博控评插件开发环境..."

# 停止当前的开发服务器
echo "⏹️  停止当前开发服务器..."
pkill -f "plasmo dev" || true
sleep 2

# 清理构建缓存
echo "🧹 清理构建缓存..."
rm -rf build/
rm -rf .plasmo/
rm -rf node_modules/.cache/
rm -rf dist/

# 重新启动开发服务器
echo "🚀 重新启动开发服务器..."
pnpm run dev &

# 等待构建完成
echo "⏳ 等待构建完成..."
sleep 5

echo "✅ 重启完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. 在 Chrome 中访问 chrome://extensions/"
echo "2. 找到 '微博控评助手' 扩展"
echo "3. 点击刷新按钮 🔄"
echo "4. 或者删除扩展后重新加载 build/chrome-mv3-dev 目录"
echo ""
echo "🔍 如果仍有问题，请检查："
echo "- 开发者模式是否已启用"
echo "- 扩展权限是否正确设置"
echo "- 浏览器控制台是否有新的错误信息"
