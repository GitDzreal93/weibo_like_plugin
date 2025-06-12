import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Input,
  InputNumber,
  Switch,
  Button,
  Space,
  Typography,
  message,
  Progress,
  Tag,
  ConfigProvider,
  List,
  Tooltip,
  Badge,
  Spin
} from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DeleteOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined
} from '@ant-design/icons'

import "antd/dist/reset.css"

const { Title, Text } = Typography
const { TextArea } = Input

interface Settings {
  keyword: string
  maxLikes: number
  interval: number
  keepTabs: boolean
}

interface TaskState {
  isRunning: boolean
  currentIndex: number
  totalLinks: number
  currentLink: string
  startTime?: number
  progress?: number
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  timestamp: number
}

interface ExecutionRecord {
  id: string
  timestamp: number
  settings: Settings
  links: string[]
  status: 'completed' | 'failed' | 'stopped'
  result: {
    totalLinks: number
    processedLinks: number
    successCount: number
    errorCount: number
    duration: number
  }
}

function IndexSidepanel() {
  const [settings, setSettings] = useState<Settings>({
    keyword: '陈昊宇',
    maxLikes: 3,
    interval: 15000, // 默认15秒，强化安全性
    keepTabs: true
  })
  
  const [weiboLinks, setWeiboLinks] = useState('')
  const [taskState, setTaskState] = useState<TaskState>({
    isRunning: false,
    currentIndex: 0,
    totalLinks: 0,
    currentLink: '',
    startTime: 0,
    progress: 0
  })

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 日志容器ref，用于自动滚动
  const logContainerRef = useRef<HTMLDivElement>(null)

  // 计算链接数量
  const linkCount = weiboLinks.trim() 
    ? weiboLinks.split('\n')
        .map(link => link.trim())
        .filter(link => link && (link.includes('weibo.com') || link.includes('m.weibo.cn')))
        .length 
    : 0

  // 加载设置和状态
  useEffect(() => {
    loadSettings()
    updateStatus()
    loadLogs()
    loadExecutionHistory()

    // 设置定时器定期更新状态
    const statusInterval = setInterval(updateStatus, 2000)

    // 监听来自background的消息
    const messageListener = (message: any, _sender: any, _sendResponse: any) => {
      console.log('Sidepanel received message:', message)

      if (message.action === 'addLog') {
        // 实时添加日志
        const newLog: LogEntry = {
          message: message.message,
          type: message.type || 'info',
          timestamp: Date.now()
        }
        setLogs(prevLogs => {
          const updatedLogs = [...prevLogs, newLog].slice(-100)
          // 同时更新storage
          chrome.storage.local.set({ logs: updatedLogs }).catch(console.error)
          // 自动滚动到底部
          setTimeout(() => {
            if (logContainerRef.current) {
              logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
            }
          }, 100)
          return updatedLogs
        })
      } else if (message.action === 'updateStatus') {
        // 实时更新状态
        updateStatus()
      }
    }

    // 添加消息监听器
    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      clearInterval(statusInterval)
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(['settings'])
      if (result.settings) {
        // 合并设置，确保新的默认值生效
        const loadedSettings = {
          keyword: '陈昊宇',
          maxLikes: 3,
          interval: 15000, // 默认15秒，更安全
          keepTabs: true,
          ...result.settings // 用户自定义设置覆盖默认值
        }

        // 如果加载的间隔小于10秒，重置为15秒（强化安全性）
        if (loadedSettings.interval < 10000) {
          loadedSettings.interval = 15000
          console.log('检测到危险的点赞间隔，已自动调整为15秒')
        }

        setSettings(loadedSettings)

        // 保存更新后的设置
        await chrome.storage.local.set({ settings: loadedSettings })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async (newSettings: Settings) => {
    try {
      await chrome.storage.local.set({ settings: newSettings })
      setSettings(newSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const updateStatus = async () => {
    try {
      const result = await chrome.storage.local.get(['taskState'])
      if (result.taskState) {
        setTaskState(result.taskState)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const result = await chrome.storage.local.get(['logs'])
      if (result.logs) {
        setLogs(result.logs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  const loadExecutionHistory = async () => {
    try {
      const result = await chrome.storage.local.get(['executionHistory'])
      if (result.executionHistory) {
        setExecutionHistory(result.executionHistory)
      }
    } catch (error) {
      console.error('Failed to load execution history:', error)
    }
  }

  const saveExecutionRecord = async (record: ExecutionRecord) => {
    try {
      const result = await chrome.storage.local.get(['executionHistory'])
      const history = result.executionHistory || []

      // 添加新记录到开头
      history.unshift(record)

      // 只保留最近5条记录
      const trimmedHistory = history.slice(0, 5)

      await chrome.storage.local.set({ executionHistory: trimmedHistory })
      setExecutionHistory(trimmedHistory)
    } catch (error) {
      console.error('Failed to save execution record:', error)
    }
  }

  const addLog = async (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = Date.now()
    const newLog: LogEntry = { message, type, timestamp }
    
    const updatedLogs = [...logs, newLog].slice(-100) // 只保留最近100条
    setLogs(updatedLogs)
    
    try {
      await chrome.storage.local.set({ logs: updatedLogs })
    } catch (error) {
      console.error('Failed to save logs:', error)
    }
  }

  const getLinksFromTextarea = () => {
    const text = weiboLinks.trim()
    if (!text) return []

    return text.split('\n')
      .map(link => link.trim())
      .filter(link => {
        if (!link) return false

        // 基本格式检查
        if (!link.includes('weibo.com') && !link.includes('m.weibo.cn')) {
          return false
        }

        // URL 格式验证
        try {
          new URL(link)
          return true
        } catch (error) {
          console.warn('Invalid URL format:', link)
          return false
        }
      })
  }

  const startExecution = async () => {
    const links = getLinksFromTextarea()
    if (links.length === 0) {
      message.error('请输入至少一个有效的微博链接')
      return
    }

    await saveSettings(settings)

    const taskData = {
      links: links,
      settings: settings
    }

    // 创建执行记录
    const executionRecord: ExecutionRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      settings: { ...settings },
      links: [...links],
      status: 'completed', // 初始状态，后续会更新
      result: {
        totalLinks: links.length,
        processedLinks: 0,
        successCount: 0,
        errorCount: 0,
        duration: 0
      }
    }

    try {
      console.log('Sending startTask message to background:', { ...taskData, executionRecord })

      chrome.runtime.sendMessage({
        action: 'startTask',
        data: { ...taskData, executionRecord }
      }, (response) => {
        console.log('Background response:', response)
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError)
          addLog(`启动任务失败: ${chrome.runtime.lastError.message}`, 'error')
        }
      })

      addLog(`开始执行任务，共${links.length}个链接`, 'info')
      message.success('任务已开始执行')
      await updateStatus()
    } catch (error) {
      console.error('Start execution error:', error)
      addLog(`启动任务失败: ${error.message}`, 'error')
      message.error('启动任务失败')
    }
  }

  const stopExecution = async () => {
    try {
      console.log('UI: Force stopping task...')

      // 立即更新UI状态，避免按钮卡住
      setTaskState(prev => ({
        ...prev,
        isRunning: false,
        progress: 0,
        currentLink: '',
        currentIndex: 0
      }))

      // 发送停止消息到background
      console.log('UI: Sending stop message to background...')
      chrome.runtime.sendMessage({ action: 'stopTask' }, (response) => {
        console.log('UI: Stop task response:', response)
        if (chrome.runtime.lastError) {
          console.error('UI: Stop task error:', chrome.runtime.lastError)
        }
      })

      // 强制清除本地存储状态
      try {
        await chrome.storage.local.set({
          taskState: {
            isRunning: false,
            currentIndex: 0,
            totalLinks: 0,
            currentLink: '',
            startTime: 0,
            progress: 0
          }
        })
        console.log('UI: Local storage cleared')
      } catch (error) {
        console.error('UI: Failed to clear local storage:', error)
      }

      addLog('🛑 用户强制停止任务', 'warning')
      message.warning('任务已强制停止')

      // 延迟更新状态，确保同步
      setTimeout(async () => {
        await updateStatus()
        console.log('UI: Status updated after stop')
      }, 500)

    } catch (error) {
      console.error('UI: Stop execution error:', error)
      message.error('停止任务失败，但已强制重置状态')

      // 即使失败也要重置UI状态
      setTaskState({
        isRunning: false,
        currentIndex: 0,
        totalLinks: 0,
        currentLink: '',
        startTime: 0,
        progress: 0
      })
    }
  }

  const clearAll = () => {
    setWeiboLinks('')
    clearLogs()
  }

  const clearLogs = async () => {
    setLogs([])
    try {
      await chrome.storage.local.remove(['logs'])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const copyLogs = async () => {
    if (logs.length === 0) {
      message.warning('暂无日志可复制')
      return
    }

    try {
      // 格式化日志内容
      const logText = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString()
        const typePrefix = {
          'info': '[信息]',
          'success': '[成功]',
          'error': '[错误]',
          'warning': '[警告]'
        }[log.type] || '[信息]'

        return `[${time}] ${typePrefix} ${log.message}`
      }).join('\n')

      // 添加头部信息
      const header = `微博控评助手执行日志\n生成时间: ${new Date().toLocaleString()}\n总计: ${logs.length}条日志\n${'='.repeat(50)}\n\n`
      const fullText = header + logText

      // 复制到剪贴板
      await navigator.clipboard.writeText(fullText)
      message.success(`已复制${logs.length}条日志到剪贴板`)
    } catch (error) {
      console.error('Failed to copy logs:', error)
      message.error('复制日志失败')
    }
  }

  const retryExecution = async (record: ExecutionRecord) => {
    // 恢复设置
    setSettings(record.settings)
    await saveSettings(record.settings)

    // 恢复链接
    setWeiboLinks(record.links.join('\n'))

    // 开始执行
    message.info('正在重试历史任务...')
    setTimeout(() => {
      startExecution()
    }, 500)
  }

  const clearExecutionHistory = async () => {
    setExecutionHistory([])
    try {
      await chrome.storage.local.remove(['executionHistory'])
      message.success('执行历史已清空')
    } catch (error) {
      console.error('Failed to clear execution history:', error)
    }
  }

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '#52c41a'
      case 'error': return '#ff4d4f'
      case 'warning': return '#faad14'
      default: return '#666'
    }
  }

  const progress = taskState.totalLinks > 0
    ? Math.round((taskState.currentIndex / taskState.totalLinks) * 100)
    : 0

  const getStatusColor = () => {
    if (taskState.isRunning) return 'processing'
    return 'default'
  }

  const getStatusText = () => {
    if (taskState.isRunning) {
      const elapsed = taskState.startTime ? Math.floor((Date.now() - taskState.startTime) / 1000) : 0
      return `执行中 (${elapsed}s)`
    }
    return '待机'
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`
    }
    return `${seconds}秒`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'stopped': return <ClockCircleOutlined style={{ color: '#faad14' }} />
      default: return <ClockCircleOutlined />
    }
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff'
    }}>
      {/* 头部 */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #e8e8e8',
        backgroundColor: '#fafafa'
      }}>
        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
          微博控评助手
        </Title>
        
        {/* 功能提示 */}
        <div style={{
          backgroundColor: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
          fontSize: 13
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>💡 功能提示</div>
          <div style={{ lineHeight: 1.6 }}>• 微博评论自动点赞：在下方配置后执行</div>
          <div style={{ lineHeight: 1.6 }}>• 聊天页面链接复制：访问 api.weibo.com/chat 时自动启用</div>
        </div>
      </div>

      {/* 主体内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 24px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}>
        {/* 设置区域 */}
        <Card
          title="设置"
          size="small"
          style={{
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>关键词:</Text>
              <Input
                size="middle"
                value={settings.keyword}
                onChange={(e) => setSettings({ ...settings, keyword: e.target.value })}
                onBlur={() => saveSettings(settings)}
                style={{ width: 280 }}
                placeholder="输入要搜索的关键词"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>每条微博最大点赞数:</Text>
              <InputNumber
                size="middle"
                min={1}
                max={10}
                value={settings.maxLikes}
                onChange={(value) => setSettings({ ...settings, maxLikes: value || 3 })}
                onBlur={() => saveSettings(settings)}
                style={{ width: 120 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>点赞间隔(秒):</Text>
              <InputNumber
                size="middle"
                min={3}
                max={60}
                step={1}
                value={settings.interval / 1000} // 显示为秒
                onChange={(value) => setSettings({ ...settings, interval: (value || 15) * 1000 })} // 转换为毫秒，默认15秒
                onBlur={() => saveSettings(settings)}
                style={{ width: 140 }}
                precision={1} // 允许小数点后1位
                placeholder="推荐15秒"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>完成后保持标签页打开:</Text>
              <Switch
                checked={settings.keepTabs}
                onChange={(checked) => {
                  const newSettings = { ...settings, keepTabs: checked }
                  setSettings(newSettings)
                  saveSettings(newSettings)
                }}
              />
            </div>
          </Space>
        </Card>

        {/* 微博链接区域 */}
        <Card
          title="微博链接"
          size="small"
          style={{
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <TextArea
            rows={8}
            value={weiboLinks}
            onChange={(e) => setWeiboLinks(e.target.value)}
            placeholder="请输入微博链接，每行一个链接&#10;例如：&#10;https://weibo.com/6623521716/5176315180748087&#10;https://weibo.com/7674044294/5176314018922507"
            style={{
              fontSize: 13,
              fontFamily: 'monospace',
              borderRadius: 6
            }}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Text style={{ fontSize: 14, color: '#666' }}>
              链接数量: <Text strong style={{ color: '#1890ff' }}>{linkCount}</Text>
            </Text>
          </div>
        </Card>

        {/* 操作按钮 */}
        <Card
          size="small"
          style={{
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <Space style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              icon={taskState.isRunning ? <Spin size="small" /> : <PlayCircleOutlined />}
              onClick={startExecution}
              disabled={taskState.isRunning}
              size="large"
              style={{ flex: 1, height: 44, borderRadius: 6 }}
              loading={taskState.isRunning}
            >
              {taskState.isRunning ? '执行中...' : '开始执行'}
            </Button>
            <Button
              icon={<PauseCircleOutlined />}
              onClick={stopExecution}
              disabled={false}  // 永远可点击，强制停止
              size="large"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 6,
                backgroundColor: taskState.isRunning ? '#ff4d4f' : '#faad14',
                borderColor: taskState.isRunning ? '#ff4d4f' : '#faad14',
                color: '#fff'
              }}
              danger={true}
            >
              {taskState.isRunning ? '立即停止' : '强制停止'}
            </Button>
            <Button
              danger
              icon={<ClearOutlined />}
              onClick={clearAll}
              size="large"
              style={{ flex: 1, height: 44, borderRadius: 6 }}
            >
              清空
            </Button>
          </Space>

          {/* 历史记录按钮 */}
          <div style={{ marginTop: 16 }}>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setShowHistory(!showHistory)}
              size="large"
              style={{ width: '100%', height: 40, borderRadius: 6 }}
              type={showHistory ? 'primary' : 'default'}
            >
              执行历史 ({executionHistory.length})
            </Button>
          </div>
        </Card>

        {/* 执行状态 */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>执行状态</span>
              {taskState.isRunning && <Badge status="processing" />}
            </div>
          }
          size="small"
          style={{
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>状态:</Text>
              <Tag color={getStatusColor()}>
                {getStatusText()}
              </Tag>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>进度:</Text>
              <Text style={{ fontSize: 14 }}>
                {taskState.currentIndex}/{taskState.totalLinks}
              </Text>
            </div>

            {taskState.totalLinks > 0 && (
              <Progress
                percent={progress}
                size="default"
                status={taskState.isRunning ? 'active' : 'normal'}
                strokeColor={taskState.isRunning ? '#1890ff' : '#52c41a'}
                strokeWidth={10}
              />
            )}

            {taskState.isRunning && taskState.currentLink && (
              <div>
                <Text style={{ fontSize: 14, fontWeight: 500 }}>当前处理:</Text>
                <Tooltip title={taskState.currentLink}>
                  <div style={{
                    fontSize: 13,
                    wordBreak: 'break-all',
                    maxHeight: 60,
                    overflow: 'hidden',
                    color: '#666',
                    backgroundColor: '#f5f5f5',
                    padding: 12,
                    borderRadius: 6,
                    marginTop: 8
                  }}>
                    {taskState.currentLink.length > 80
                      ? taskState.currentLink.substring(0, 80) + '...'
                      : taskState.currentLink}
                  </div>
                </Tooltip>
              </div>
            )}
          </Space>
        </Card>

        {/* 执行历史 */}
        {showHistory && (
          <Card
            title="执行历史"
            size="small"
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            extra={
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearExecutionHistory}
                type="text"
                danger
              >
                清空
              </Button>
            }
          >
            {executionHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                暂无执行历史
              </div>
            ) : (
              <List
                size="small"
                dataSource={executionHistory}
                renderItem={(record) => (
                  <List.Item
                    style={{ padding: '16px 0' }}
                    actions={[
                      <Button
                        key="retry"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => retryExecution(record)}
                        type="link"
                      >
                        重试
                      </Button>
                    ]}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getStatusIcon(record.status)}
                          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>
                            {record.settings.keyword}
                          </Text>
                        </div>
                        <Text style={{ fontSize: 13, color: '#999' }}>
                          {new Date(record.timestamp).toLocaleString()}
                        </Text>
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                        链接: {record.result.totalLinks} |
                        成功: {record.result.successCount} |
                        耗时: {formatDuration(record.result.duration)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        )}

        {/* 执行日志 */}
        <Card
          title="执行日志"
          size="small"
          style={{
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
          styles={{
            body: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '20px'
            }
          }}
          extra={
            <Space size="small">
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={copyLogs}
                type="text"
                disabled={logs.length === 0}
              >
                复制
              </Button>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearLogs}
                type="text"
              >
                清空
              </Button>
            </Space>
          }
        >
          <div
            ref={logContainerRef}
            style={{
              backgroundColor: '#f8f8f8',
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              padding: 16,
              flex: 1,
              minHeight: 400,
              maxHeight: 800,
              overflowY: 'auto',
              fontSize: 13,
              fontFamily: 'monospace',
              lineHeight: 1.6
            }}>
            {logs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#999',
                padding: '60px 0',
                fontFamily: 'inherit'
              }}>
                暂无执行日志
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 6,
                    wordWrap: 'break-word',
                    color: getLogColor(log.type),
                    padding: '4px 0'
                  }}
                >
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default IndexSidepanel
