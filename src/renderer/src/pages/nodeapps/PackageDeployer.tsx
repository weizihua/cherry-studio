import { CloudUploadOutlined, GithubOutlined, LoadingOutlined, SettingOutlined, InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { FileType } from '@renderer/types'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Tabs,
  Typography,
  Upload,
  notification,
  Popover,
  Select,
  Checkbox
} from 'antd'
import React, { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text } = Typography
const { Panel } = Collapse
const { TabPane } = Tabs
const { Option } = Select

interface Props {
  onDeployed?: (result: { port: number; url: string }) => void
}

const PackageDeployer: FC<Props> = ({ onDeployed }) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [gitForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [gitLoading, setGitLoading] = useState(false)
  const [file, setFile] = useState<FileType | null>(null)
  const [advancedVisible, setAdvancedVisible] = useState(false)
  const [gitAdvancedVisible, setGitAdvancedVisible] = useState(false)
  const [isNodeAvailable, setIsNodeAvailable] = useState<boolean | null>(null)
  const [isInstallingNode, setIsInstallingNode] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [activeTab, setActiveTab] = useState('zip')

  // Check if Node.js is available
  useEffect(() => {
    const checkNodeAvailability = async () => {
      try {
        const isAvailable = await window.api.nodeapp.checkNode()
        setIsNodeAvailable(isAvailable)
      } catch (error) {
        console.error('Error checking Node.js availability:', error)
        setIsNodeAvailable(false)
      }
    }

    checkNodeAvailability()
  }, [])

  // Handle Node.js installation
  const handleInstallNode = async () => {
    try {
      setIsInstallingNode(true)
      const success = await window.api.nodeapp.installNode()

      if (success) {
        setIsNodeAvailable(true)
        notification.success({
          message: t('common.success'),
          description: t('nodeapp.packageDeployer.nodeInstallSuccess')
        })
      } else {
        notification.error({
          message: t('common.error'),
          description: t('nodeapp.packageDeployer.nodeInstallFailed')
        })
      }
    } catch (error) {
      console.error('Error installing Node.js:', error)
      notification.error({
        message: t('common.error'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsInstallingNode(false)
    }
  }

  const handleFileSelect = async () => {
    try {
      const files = await window.api.file.select({
        filters: [
          { name: 'ZIP Files', extensions: ['zip'] }
        ],
        properties: ['openFile']
      })

      if (files && files.length > 0) {
        setFile(files[0])
        form.setFieldsValue({
          name: files[0].name.replace(/\.zip$/, ''),
          file: files[0]
        })
        setUploadUrl(files[0].path)
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    }
  }

  const handleDeploy = async (values: any) => {
    // First check if Node.js is available
    if (isNodeAvailable === false) {
      Modal.confirm({
        title: t('nodeapp.packageDeployer.nodeRequired'),
        content: t('nodeapp.packageDeployer.installNodePrompt'),
        okText: t('nodeapp.packageDeployer.installNode'),
        cancelText: t('common.cancel'),
        onOk: handleInstallNode
      })
      return
    }

    if (!file) {
      notification.warning({
        message: t('common.warning'),
        description: t('nodeapp.packageDeployer.noFileSelected')
      })
      return
    }

    try {
      setLoading(true)

      // 检测是否为Next.js应用，如果文件名包含next或文件是从next.js项目导出的
      const isNextJs = file.name.toLowerCase().includes('next') ||
                      (values.isNextJs === true);

      // 如果是Next.js应用，自动设置构建步骤
      if (isNextJs && !values.buildCommand) {
        values.buildCommand = 'npm run build';
        notification.info({
          message: t('nodeapp.packageDeployer.nextJsDetected'),
          description: t('nodeapp.packageDeployer.buildStepAdded'),
          duration: 5
        });
      }

      // Display note about ES modules compatibility
      if (file.name.includes('react') || file.name.includes('next') || file.name.includes('vue')) {
        notification.info({
          message: t('nodeapp.packageDeployer.moduleTypeError'),
          description: t('nodeapp.packageDeployer.esModuleError'),
          duration: 8
        })
      }

      // Deploy the ZIP package
      const result = await window.api.nodeapp.deployZip(file.path, {
        name: values.name,
        port: values.port ? parseInt(values.port) : undefined,
        startCommand: values.startCommand,
        installCommand: values.installCommand,
        buildCommand: values.buildCommand
      })

      if (result) {
        notification.success({
          message: t('common.success'),
          description: t('nodeapp.packageDeployer.deploySuccess', {
            name: values.name,
            port: result.port
          }),
          btn: (
            <Button type="primary" size="small" onClick={() => window.api.openWebsite(result.url)}>
              {t('nodeapp.packageDeployer.open')}
            </Button>
          )
        })

        // Reset form and state
        form.resetFields()
        setFile(null)
        setAdvancedVisible(false)
        setUploadUrl('')

        // Notify parent
        if (onDeployed) {
          onDeployed(result)
        }
      } else {
        notification.error({
          message: t('common.error'),
          description: t('nodeapp.packageDeployer.deployFailed')
        })
      }
    } catch (error) {
      console.error('Error deploying ZIP:', error)
      notification.error({
        message: t('common.error'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeployGit = async (values: any) => {
    // First check if Node.js is available
    if (isNodeAvailable === false) {
      Modal.confirm({
        title: t('nodeapp.packageDeployer.nodeRequired'),
        content: t('nodeapp.packageDeployer.installNodePrompt'),
        okText: t('nodeapp.packageDeployer.installNode'),
        cancelText: t('common.cancel'),
        onOk: handleInstallNode
      })
      return
    }

    if (!values.repoUrl) {
      notification.warning({
        message: t('common.warning'),
        description: t('nodeapp.packageDeployer.noRepoUrlProvided')
      })
      return
    }

    try {
      setGitLoading(true)

      // 检测是否为Next.js应用
      const isNextJs = values.repoUrl.toLowerCase().includes('next') ||
                      (values.isNextJs === true);

      // 如果是Next.js应用，自动设置构建步骤
      if (isNextJs && !values.buildCommand) {
        values.buildCommand = 'npm run build';
        notification.info({
          message: t('nodeapp.packageDeployer.nextJsDetected'),
          description: t('nodeapp.packageDeployer.buildStepAdded'),
          duration: 5
        });
      }

      // Deploy from Git repository
      const result = await window.api.nodeapp.deployGit(values.repoUrl, {
        name: values.name,
        port: values.port ? parseInt(values.port) : undefined,
        startCommand: values.startCommand,
        installCommand: values.installCommand,
        buildCommand: values.buildCommand
      })

      if (result) {
        notification.success({
          message: t('common.success'),
          description: t('nodeapp.packageDeployer.deploySuccess', {
            name: values.name || 'Git App',
            port: result.port
          }),
          btn: (
            <Button type="primary" size="small" onClick={() => window.api.openWebsite(result.url)}>
              {t('nodeapp.packageDeployer.open')}
            </Button>
          )
        })

        // Reset form and state
        gitForm.resetFields()
        setGitAdvancedVisible(false)

        // Notify parent
        if (onDeployed) {
          onDeployed(result)
        }
      } else {
        notification.error({
          message: t('common.error'),
          description: t('nodeapp.packageDeployer.deployFailed')
        })
      }
    } catch (error) {
      console.error('Error deploying from Git:', error)
      notification.error({
        message: t('common.error'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setGitLoading(false)
    }
  }

  return (
    <Container>
      <Card title={t('nodeapp.packageDeployer.deployPackage')}>
        {isNodeAvailable === false && (
          <Alert
            type="warning"
            message={t('nodeapp.packageDeployer.nodeNotAvailable')}
            description={
              <Space>
                <Text>{t('nodeapp.packageDeployer.nodeNeeded')}</Text>
                <Button
                  type="primary"
                  onClick={handleInstallNode}
                  loading={isInstallingNode}
                >
                  {t('nodeapp.packageDeployer.installNode')}
                </Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <CloudUploadOutlined /> {t('nodeapp.packageDeployer.deployFromZip')}
              </span>
            }
            key="zip"
          >
            <Form form={form} layout="vertical" onFinish={handleDeploy}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>{t('nodeapp.packageDeployer.description')}</Text>

                <UploadContainer>
                  {file ? (
                    <FileInfo>
                      <div>
                        <CloudUploadOutlined style={{ fontSize: 24, marginRight: 8 }} />
                        <Text strong>{file.name}</Text>
                      </div>
                      <Button size="small" onClick={() => {
                        setFile(null);
                        form.setFieldsValue({ file: null });
                        setUploadUrl('');
                      }}>
                        {t('common.remove')}
                      </Button>
                    </FileInfo>
                  ) : (
                    <UploadButton onClick={handleFileSelect}>
                      <CloudUploadOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                      <div>{t('nodeapp.packageDeployer.selectZip')}</div>
                    </UploadButton>
                  )}
                </UploadContainer>

                <Form.Item
                  name="name"
                  label={t('nodeapp.form.name')}
                  rules={[{ required: true, message: t('nodeapp.form.nameRequired') }]}
                >
                  <Input placeholder={t('nodeapp.packageDeployer.namePlaceholder')} />
                </Form.Item>

                <Collapse
                  ghost
                  activeKey={advancedVisible ? ['1'] : []}
                  onChange={() => setAdvancedVisible(!advancedVisible)}
                >
                  <Panel
                    header={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <SettingOutlined style={{ marginRight: 8 }} />
                        {t('nodeapp.packageDeployer.advancedOptions')}
                      </div>
                    }
                    key="1"
                  >
                    <Form.Item
                      name="port"
                      label={t('nodeapp.form.port')}
                      help={t('nodeapp.form.portHelp')}
                    >
                      <Input placeholder="3000" type="number" />
                    </Form.Item>

                    <Form.Item
                      name="installCommand"
                      label={t('nodeapp.form.installCommand')}
                      help={t('nodeapp.form.installCommandHelp')}
                    >
                      <Input placeholder="npm install" />
                    </Form.Item>

                    <Form.Item
                      name="buildCommand"
                      label={t('nodeapp.form.buildCommand')}
                      help={t('nodeapp.form.buildCommandHelp')}
                    >
                      <Input placeholder="npm run build" />
                    </Form.Item>

                    <Form.Item
                      name="startCommand"
                      label={t('nodeapp.form.startCommand')}
                      help={t('nodeapp.form.startCommandHelp')}
                    >
                      <Input placeholder="npm start" />
                    </Form.Item>

                    <Form.Item
                      name="isNextJs"
                      valuePropName="checked"
                    >
                      <Checkbox onChange={(e) => {
                        if (e.target.checked) {
                          form.setFieldsValue({
                            buildCommand: 'npm run build',
                            startCommand: 'npm run start',
                            installCommand: 'npm install --legacy-peer-deps'
                          });
                        }
                      }}>{t('nodeapp.form.isNextJs')}</Checkbox>
                    </Form.Item>

                    <Alert
                      message={t('nodeapp.packageDeployer.nextJsInfo')}
                      description={t('nodeapp.packageDeployer.nextJsDescription')}
                      type="info"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                  </Panel>
                </Collapse>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={!file}
                    loading={loading}
                    icon={loading ? <Spin size="small" /> : <CloudUploadOutlined />}
                  >
                    {t('nodeapp.packageDeployer.deploy')}
                  </Button>
                </Form.Item>
              </Space>
            </Form>
          </TabPane>

          <TabPane
            tab={
              <span>
                <GithubOutlined /> {t('nodeapp.packageDeployer.deployFromGit')}
              </span>
            }
            key="git"
          >
            <Form form={gitForm} layout="vertical" onFinish={handleDeployGit}>
              <Form.Item
                name="repoUrl"
                label={t('nodeapp.packageDeployer.repoUrl')}
                rules={[{ required: true, message: t('nodeapp.packageDeployer.repoUrlRequired') }]}
              >
                <Input placeholder="https://github.com/username/repo" />
              </Form.Item>

              <Form.Item name="name" label={t('nodeapp.form.name')}>
                <Input placeholder={t('nodeapp.packageDeployer.namePlaceholder')} />
              </Form.Item>

              <Form.Item
                name="port"
                label={
                  <span>
                    {t('nodeapp.form.port')}
                    <Popover
                      content={t('nodeapp.form.portHelp')}
                      title={t('common.tips')}
                    >
                      <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                    </Popover>
                  </span>
                }
              >
                <Input placeholder="3000" type="number" />
              </Form.Item>

              <Button
                type="link"
                onClick={() => setGitAdvancedVisible(!gitAdvancedVisible)}
                style={{ paddingLeft: 0, marginBottom: 16 }}
              >
                {gitAdvancedVisible
                  ? t('nodeapp.packageDeployer.hideAdvanced')
                  : t('nodeapp.packageDeployer.showAdvanced')}
              </Button>

              {gitAdvancedVisible && (
                <Collapse ghost>
                  <Panel header={t('nodeapp.packageDeployer.advancedOptions')} key="1">
                    <Form.Item
                      name="installCommand"
                      label={t('nodeapp.form.installCommand')}
                      help={t('nodeapp.form.installCommandHelp')}
                    >
                      <Input placeholder="npm install" />
                    </Form.Item>

                    <Form.Item name="buildCommand" label={t('nodeapp.form.buildCommand')}
                      help={t('nodeapp.form.buildCommandHelp')}>
                      <Input placeholder="npm run build" />
                    </Form.Item>

                    <Form.Item name="startCommand" label={t('nodeapp.form.startCommand')}
                      help={t('nodeapp.form.startCommandHelp')}>
                      <Input placeholder="npm start" />
                    </Form.Item>

                    <Form.Item name="isNextJs" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Checkbox onChange={(e) => {
                        if (e.target.checked) {
                          gitForm.setFieldsValue({
                            buildCommand: 'npm run build',
                            startCommand: 'npm run start',
                            installCommand: 'npm install --legacy-peer-deps'
                          });
                        }
                      }}>{t('nodeapp.form.isNextJs')}</Checkbox>
                    </Form.Item>
                  </Panel>
                </Collapse>
              )}

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={gitLoading}>
                  {t('nodeapp.packageDeployer.deploy')}
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </Container>
  )
}

const Container = styled.div`
  margin: 16px;
`

const UploadContainer = styled.div`
  margin-bottom: 16px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  background-color: #fafafa;
  transition: border-color 0.3s;

  &:hover {
    border-color: #1890ff;
  }
`

const UploadButton = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
  cursor: pointer;
  padding: 16px;
`

const FileInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`

export default PackageDeployer
