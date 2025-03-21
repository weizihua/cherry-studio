import React, { FC, useEffect, useState } from 'react'
import { Button, Card, Form, Input, Select, Typography, notification, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { LoadingOutlined, SyncOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const { Option } = Select

const NodeSettings: FC = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [nodeInstalled, setNodeInstalled] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')

  // 默认提供的Node.js版本选项
  const nodeVersions = [
    { value: '20.11.1', label: 'v20.11.1 (LTS)' },
    { value: '18.18.0', label: 'v18.18.0 (LTS)' },
    { value: '16.20.2', label: 'v16.20.2 (LTS)' },
    { value: '14.21.3', label: 'v14.21.3 (LTS)' }
  ]

  // 检查Node.js是否已安装
  const checkNodeStatus = async () => {
    try {
      setCheckingVersion(true)
      const isNodeInstalled = await window.api.nodeapp.checkNode()
      setNodeInstalled(isNodeInstalled)

      if (isNodeInstalled) {
        try {
          // 获取当前安装的Node.js版本
          // 使用ipc调用获取Node.js版本
          const versionFromConfig = await window.api.config.get('NODE_VERSION')
          if (versionFromConfig) {
            setCurrentVersion(versionFromConfig)
          } else {
            setCurrentVersion('Unknown')
          }
        } catch (error) {
          console.error('Error getting Node.js version:', error)
          setCurrentVersion('Unknown')
        }
      }
    } catch (error) {
      console.error('Error checking Node.js status:', error)
    } finally {
      setCheckingVersion(false)
    }
  }

  // 组件加载时检查状态
  useEffect(() => {
    checkNodeStatus()
  }, [])

  // 安装Node.js
  const handleInstall = async (values: any) => {
    try {
      setLoading(true)

      // 设置环境变量来指定要安装的Node.js版本
      if (values.nodeVersion) {
        await window.api.config.set('NODE_VERSION', values.nodeVersion)
      }

      const success = await window.api.nodeapp.installNode()

      if (success) {
        notification.success({
          message: t('common.success'),
          description: t('nodeapp.nodeSettings.installSuccess', {
            version: values.nodeVersion
          })
        })

        // 重新检查状态
        await checkNodeStatus()
      } else {
        notification.error({
          message: t('common.error'),
          description: t('nodeapp.nodeSettings.installFailed')
        })
      }
    } catch (error) {
      console.error('Error installing Node.js:', error)
      notification.error({
        message: t('common.error'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <Card title={<Title level={4}>{t('nodeapp.nodeSettings.title')}</Title>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{t('nodeapp.nodeSettings.description')}</Text>

          <StatusSection>
            <Text strong>{t('nodeapp.nodeSettings.status')}: </Text>
            {checkingVersion ? (
              <Text type="secondary">
                <LoadingOutlined style={{ marginRight: 8 }} />
                {t('nodeapp.nodeSettings.checking')}
              </Text>
            ) : nodeInstalled ? (
              <Text type="success">
                {t('nodeapp.nodeSettings.installed')}
                {currentVersion && ` (${currentVersion})`}
              </Text>
            ) : (
              <Text type="warning">{t('nodeapp.nodeSettings.notInstalled')}</Text>
            )}
            <Button
              type="text"
              size="small"
              icon={<SyncOutlined />}
              onClick={checkNodeStatus}
              loading={checkingVersion}
            >
              {t('nodeapp.nodeSettings.refresh')}
            </Button>
          </StatusSection>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleInstall}
            initialValues={{
              nodeVersion: '18.18.0'
            }}
          >
            <Form.Item
              name="nodeVersion"
              label={t('nodeapp.nodeSettings.version')}
              help={t('nodeapp.nodeSettings.versionHelp')}
            >
              <Select>
                {nodeVersions.map((version) => (
                  <Option key={version.value} value={version.value}>
                    {version.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="customVersion"
              label={t('nodeapp.nodeSettings.customVersion')}
              help={t('nodeapp.nodeSettings.customVersionHelp')}
            >
              <Input
                placeholder="20.12.1"
                onChange={(e) => {
                  if (e.target.value) {
                    form.setFieldsValue({ nodeVersion: e.target.value })
                  }
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
              >
                {nodeInstalled ? t('nodeapp.nodeSettings.reinstall') : t('nodeapp.nodeSettings.install')}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </Container>
  )
}

const Container = styled.div`
  margin: 16px;
`

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
`

export default NodeSettings
