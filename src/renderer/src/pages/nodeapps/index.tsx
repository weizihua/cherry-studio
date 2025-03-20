import React, { useState } from 'react'
import { Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import AppsManager from './AppsManager'
import PackageDeployer from './PackageDeployer'
import NodeSettings from './NodeSettings'

const NodeAppsPage: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('apps')

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  return (
    <Container>
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <Tabs.TabPane tab={t('nodeapp.appsManagerTab')} key="apps">
          <AppsManager />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeapp.packageDeployerTab')} key="deploy">
          <PackageDeployer />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeapp.nodeSettingsTab')} key="settings">
          <NodeSettings />
        </Tabs.TabPane>
      </Tabs>
    </Container>
  )
}

const Container = styled.div`
  padding: 0;
  height: 100%;
`

export default NodeAppsPage
