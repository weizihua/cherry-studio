import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Center } from '@renderer/components/Layout'
import { useNodeApps } from '@renderer/hooks/useNodeApps'
import { NodeAppType } from '@renderer/types'
import { Button, Col, Empty, Input, Modal, Row, Spin, Tabs, Typography, notification } from 'antd'
import { isEmpty } from 'lodash'
import React, { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import NodeApp from './NodeApp'
import NodeAppForm from './NodeAppForm'
import PackageDeployer from './PackageDeployer'

const { Title } = Typography
const { TabPane } = Tabs

const NodeAppsPage: FC = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { apps, loading, addApp, refresh } = useNodeApps()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  // Filter apps based on search
  const filteredApps = search
    ? apps.filter(
        (app) =>
          app.name.toLowerCase().includes(search.toLowerCase()) ||
          app.description?.toLowerCase().includes(search.toLowerCase()) ||
          app.author?.toLowerCase().includes(search.toLowerCase())
      )
    : apps

  // Handle adding a new app
  const handleAddApp = useCallback(async (values: NodeAppType) => {
    try {
      setFormLoading(true)
      await addApp({
        ...values,
        type: 'node'
      })
      setIsModalVisible(false)
      notification.success({
        message: t('common.success'),
        description: t('nodeapp.addSuccess', { name: values.name })
      })
    } catch (err) {
      notification.error({
        message: t('common.error'),
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setFormLoading(false)
    }
  }, [addApp, t])

  // Disable right-click menu in blank area
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // Handle successful package deployment
  const handleDeployed = useCallback(() => {
    refresh()
  }, [refresh])

  return (
    <Container onContextMenu={handleContextMenu}>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', justifyContent: 'space-between' }}>
          {t('nodeapp.title')}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Input
              placeholder={t('common.search')}
              className="nodrag"
              style={{ width: '250px', height: 28 }}
              size="small"
              variant="filled"
              suffix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setIsModalVisible(true)}
            >
              {t('nodeapp.add')}
            </Button>
          </div>
          <div style={{ width: 80 }} />
        </NavbarCenter>
      </Navbar>

      <ContentContainer id="content-container">
        <Tabs defaultActiveKey="apps" style={{ height: '100%' }}>
          <TabPane tab={t('nodeapp.marketplaceTab')} key="apps">
            {loading ? (
              <Center>
                <Spin size="large" />
              </Center>
            ) : isEmpty(filteredApps) ? (
              <Center>
                <Empty
                  description={
                    <div style={{ marginTop: '16px' }}>
                      <p>{t('nodeapp.empty')}</p>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsModalVisible(true)}
                      >
                        {t('nodeapp.add')}
                      </Button>
                    </div>
                  }
                />
              </Center>
            ) : (
              <div style={{ padding: '16px' }}>
                <Title level={5} style={{ marginBottom: '16px' }}>{t('nodeapp.featured')}</Title>
                <Row gutter={[16, 16]}>
                  {filteredApps.map((app) => (
                    <Col key={app.id} xs={24} sm={12} md={8} lg={6}>
                      <NodeApp app={app} />
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </TabPane>
          <TabPane tab={t('nodeapp.packageDeployerTab')} key="packageDeployer">
            <PackageDeployer onDeployed={handleDeployed} />
          </TabPane>
        </Tabs>
      </ContentContainer>

      <Modal
        title={t('nodeapp.addNew')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <NodeAppForm
          onSubmit={handleAddApp}
          onCancel={() => setIsModalVisible(false)}
          loading={formLoading}
        />
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`

const ContentContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding-bottom: 20px;
`

export default NodeAppsPage
