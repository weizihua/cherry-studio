import { DownloadOutlined, GithubOutlined, LoadingOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useNodeApps } from '@renderer/hooks/useNodeApps'
import { NodeAppType } from '@renderer/types'
import { Avatar, Button, Card, Dropdown, Menu, Space, Tag, Tooltip, Typography, notification } from 'antd'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Paragraph, Text } = Typography

interface Props {
  app: NodeAppType
}

const NodeApp: FC<Props> = ({ app }) => {
  const { t } = useTranslation()
  const { installApp, updateApp, startApp, stopApp, uninstallApp } = useNodeApps()
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState<string>('')

  // Handle installation
  const handleInstall = async () => {
    try {
      setLoading(true)
      setActionType('install')
      await installApp(app.id as string)
      notification.success({
        message: t('common.success'),
        description: t('nodeapp.installSuccess', { name: app.name })
      })
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      setActionType('')
    }
  }

  // Handle update
  const handleUpdate = async () => {
    try {
      setLoading(true)
      setActionType('update')
      await updateApp(app.id as string)
      notification.success({
        message: t('common.success'),
        description: t('nodeapp.updateSuccess', { name: app.name })
      })
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      setActionType('')
    }
  }

  // Handle start
  const handleStart = async () => {
    try {
      setLoading(true)
      setActionType('start')
      const result = await startApp(app.id as string)
      if (result) {
        notification.success({
          message: t('common.success'),
          description: t('nodeapp.startSuccess', { name: app.name, port: result.port })
        })
        window.api.openWebsite(result.url)
      }
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      setActionType('')
    }
  }

  // Handle stop
  const handleStop = async () => {
    try {
      setLoading(true)
      setActionType('stop')
      await stopApp(app.id as string)
      notification.success({
        message: t('common.success'),
        description: t('nodeapp.stopSuccess', { name: app.name })
      })
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      setActionType('')
    }
  }

  // Handle uninstall
  const handleUninstall = async () => {
    try {
      setLoading(true)
      setActionType('uninstall')
      await uninstallApp(app.id as string)
      notification.success({
        message: t('common.success'),
        description: t('nodeapp.uninstallSuccess', { name: app.name })
      })
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      setActionType('')
    }
  }

  // Open GitHub repository
  const openRepository = () => {
    if (app.repositoryUrl) {
      window.api.openWebsite(app.repositoryUrl)
    }
  }

  // Open app homepage
  const openHomepage = () => {
    if (app.homepage) {
      window.api.openWebsite(app.homepage)
    }
  }

  // Render app status tag
  const renderStatusTag = () => {
    if (app.isRunning) {
      return <Tag color="green">{t('nodeapp.running')}</Tag>
    }
    if (app.isInstalled) {
      return <Tag color="blue">{t('nodeapp.installed')}</Tag>
    }
    return <Tag color="default">{t('nodeapp.notInstalled')}</Tag>
  }

  return (
    <Card
      hoverable
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      cover={
        <CardCoverContainer>
          {app.logo ? (
            <img alt={app.name} src={app.logo} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
          ) : (
            <AppLogo>
              <Avatar size={64} style={{ backgroundColor: '#1890ff' }}>
                {app.name.substring(0, 2).toUpperCase()}
              </Avatar>
            </AppLogo>
          )}
          {renderStatusTag()}
        </CardCoverContainer>
      }
      actions={[
        // Show different actions based on app status
        app.isInstalled ? (
          app.isRunning ? (
            <Tooltip title={t('nodeapp.stop')}>
              <Button
                type="text"
                icon={loading && actionType === 'stop' ? <LoadingOutlined /> : <StopOutlined />}
                onClick={handleStop}
                loading={loading && actionType === 'stop'}
                disabled={loading}
              />
            </Tooltip>
          ) : (
            <Tooltip title={t('nodeapp.start')}>
              <Button
                type="text"
                icon={loading && actionType === 'start' ? <LoadingOutlined /> : <PlayCircleOutlined />}
                onClick={handleStart}
                loading={loading && actionType === 'start'}
                disabled={loading}
              />
            </Tooltip>
          )
        ) : (
          <Tooltip title={t('nodeapp.install')}>
            <Button
              type="text"
              icon={loading && actionType === 'install' ? <LoadingOutlined /> : <DownloadOutlined />}
              onClick={handleInstall}
              loading={loading && actionType === 'install'}
              disabled={loading}
            />
          </Tooltip>
        ),
        app.isInstalled && (
          <Tooltip title={t('nodeapp.update')}>
            <Button
              type="text"
              icon={loading && actionType === 'update' ? <LoadingOutlined /> : <ReloadOutlined />}
              onClick={handleUpdate}
              loading={loading && actionType === 'update'}
              disabled={loading}
            />
          </Tooltip>
        ),
        app.repositoryUrl && (
          <Tooltip title={t('nodeapp.viewRepository')}>
            <Button
              type="text"
              icon={<GithubOutlined />}
              onClick={openRepository}
              disabled={loading}
            />
          </Tooltip>
        )
      ].filter(Boolean)}
    >
      <Card.Meta
        title={<Title level={5}>{app.name}</Title>}
        description={
          <div style={{ minHeight: '100px' }}>
            <Paragraph ellipsis={{ rows: 3 }}>{app.description}</Paragraph>

            {app.author && (
              <Space style={{ marginTop: '8px' }}>
                <Text type="secondary">{t('nodeapp.author')}:</Text>
                <Text>{app.author}</Text>
              </Space>
            )}

            {app.version && (
              <Space style={{ marginTop: '4px' }}>
                <Text type="secondary">{t('nodeapp.version')}:</Text>
                <Text>{app.version}</Text>
              </Space>
            )}

            {app.isInstalled && (
              <div style={{ marginTop: '12px' }}>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'uninstall',
                        danger: true,
                        label: t('nodeapp.uninstall'),
                        onClick: handleUninstall
                      }
                    ]
                  }}
                  trigger={['click']}
                >
                  <Button type="link" size="small" danger>
                    {t('nodeapp.more')}
                  </Button>
                </Dropdown>
              </div>
            )}
          </div>
        }
      />
    </Card>
  )
}

const CardCoverContainer = styled.div`
  position: relative;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f2f5;

  .ant-tag {
    position: absolute;
    top: 8px;
    right: 8px;
  }
`

const AppLogo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 140px;
`

export default NodeApp
