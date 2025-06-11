import React, { useState, useEffect } from 'react'
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
  ConfigProvider
} from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DeleteOutlined
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
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  timestamp: number
}

function IndexPopup() {
  const [settings, setSettings] = useState<Settings>({
    keyword: '陈昊宇',
    maxLikes: 3,
    interval: 1000,
    keepTabs: true
  })
  
  const [weiboLinks, setWeiboLinks] = useState('')
  const [taskState, setTaskState] = useState<TaskState>({
    isRunning: false,
    currentIndex: 0,
    totalLinks: 0,
    currentLink: ''
  })
  
  const [logs, setLogs] = useState<LogEntry[]>([])

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
  }, [])

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(['settings'])
      if (result.settings) {
        setSettings(result.settings)
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
      .filter(link => link && (link.includes('weibo.com') || link.includes('m.weibo.cn')))
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

    try {
      chrome.runtime.sendMessage({
        action: 'startTask',
        data: taskData
      })
      
      addLog(`开始执行任务，共${links.length}个链接`, 'info')
      message.success('任务已开始执行')
      await updateStatus()
    } catch (error) {
      message.error('启动任务失败')
    }
  }

  const stopExecution = async () => {
    try {
      chrome.runtime.sendMessage({ action: 'stopTask' })
      addLog('用户手动停止任务', 'warning')
      message.warning('任务已停止')
      await updateStatus()
    } catch (error) {
      message.error('停止任务失败')
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

  return (
    <div style={{ width: 400, minHeight: 600, padding: 16, backgroundColor: '#f5f5f5' }}>
      <Title level={4} style={{ textAlign: 'center', margin: '0 0 20px 0' }}>
        微博控评助手
      </Title>

      {/* 设置区域 */}
      <Card title="设置" size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>关键词:</Text>
            <Input
              size="small"
              value={settings.keyword}
              onChange={(e) => setSettings({ ...settings, keyword: e.target.value })}
              onBlur={() => saveSettings(settings)}
              style={{ width: 200 }}
              placeholder="输入要搜索的关键词"
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>每条微博最大点赞数:</Text>
            <InputNumber
              size="small"
              min={1}
              max={10}
              value={settings.maxLikes}
              onChange={(value) => setSettings({ ...settings, maxLikes: value || 3 })}
              onBlur={() => saveSettings(settings)}
              style={{ width: 80 }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>点赞间隔(毫秒):</Text>
            <InputNumber
              size="small"
              min={500}
              max={5000}
              step={100}
              value={settings.interval}
              onChange={(value) => setSettings({ ...settings, interval: value || 1000 })}
              onBlur={() => saveSettings(settings)}
              style={{ width: 100 }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>完成后保持标签页打开:</Text>
            <Switch
              size="small"
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
      <Card title="微博链接" size="small" style={{ marginBottom: 12 }}>
        <TextArea
          rows={5}
          value={weiboLinks}
          onChange={(e) => setWeiboLinks(e.target.value)}
          placeholder="请输入微博链接，每行一个链接&#10;例如：&#10;https://weibo.com/6623521716/5176315180748087&#10;https://weibo.com/7674044294/5176314018922507"
          style={{ fontSize: 12, fontFamily: 'monospace' }}
        />
        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            链接数量: <Text strong>{linkCount}</Text>
          </Text>
        </div>
      </Card>

      {/* 操作按钮 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={startExecution}
            disabled={taskState.isRunning}
            size="small"
            style={{ flex: 1 }}
          >
            开始执行
          </Button>
          <Button
            icon={<PauseCircleOutlined />}
            onClick={stopExecution}
            disabled={!taskState.isRunning}
            size="small"
            style={{ flex: 1 }}
          >
            停止
          </Button>
          <Button
            danger
            icon={<ClearOutlined />}
            onClick={clearAll}
            size="small"
            style={{ flex: 1 }}
          >
            清空
          </Button>
        </Space>
      </Card>

      {/* 执行状态 */}
      <Card title="执行状态" size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>状态:</Text>
            <Tag color={taskState.isRunning ? 'processing' : 'default'}>
              {taskState.isRunning ? '执行中' : '待机'}
            </Tag>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>进度:</Text>
            <Text style={{ fontSize: 12 }}>
              {taskState.currentIndex}/{taskState.totalLinks}
            </Text>
          </div>
          
          {taskState.totalLinks > 0 && (
            <Progress 
              percent={progress} 
              size="small" 
              status={taskState.isRunning ? 'active' : 'normal'}
            />
          )}
          
          <div>
            <Text style={{ fontSize: 12 }}>当前处理:</Text>
            <div style={{ 
              fontSize: 11, 
              wordBreak: 'break-all', 
              maxHeight: 40, 
              overflow: 'hidden',
              color: '#666'
            }}>
              {taskState.currentLink || '无'}
            </div>
          </div>
        </Space>
      </Card>

      {/* 执行日志 */}
      <Card 
        title="执行日志" 
        size="small"
        extra={
          <Button 
            size="small" 
            icon={<DeleteOutlined />} 
            onClick={clearLogs}
            type="text"
          >
            清空
          </Button>
        }
      >
        <div style={{
          backgroundColor: '#f8f8f8',
          border: '1px solid #e8e8e8',
          borderRadius: 4,
          padding: 8,
          height: 100,
          overflowY: 'auto',
          fontSize: 11,
          fontFamily: 'monospace',
          lineHeight: 1.4
        }}>
          {logs.map((log, index) => (
            <div 
              key={index} 
              style={{ 
                marginBottom: 2, 
                wordWrap: 'break-word',
                color: getLogColor(log.type)
              }}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default IndexPopup
