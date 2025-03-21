import { NodeAppType } from '@renderer/types'
import { Button, Form, Input, Space } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onSubmit: (values: NodeAppType) => void
  onCancel: () => void
  loading: boolean
  initialValues?: Partial<NodeAppType>
}

const NodeAppForm: FC<Props> = ({ onSubmit, onCancel, loading, initialValues }) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  const handleSubmit = (values: any) => {
    onSubmit({
      ...values,
      type: 'node',
      isInstalled: false,
      isRunning: false
    } as NodeAppType)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={initialValues}
      autoComplete="off"
    >
      <Form.Item
        name="name"
        label={t('nodeapp.form.name')}
        rules={[{ required: true, message: t('nodeapp.form.nameRequired') }]}
      >
        <Input placeholder={t('nodeapp.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="repositoryUrl"
        label={t('nodeapp.form.repositoryUrl')}
        rules={[
          { required: true, message: t('nodeapp.form.repositoryUrlRequired') },
          {
            pattern: /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/,
            message: t('nodeapp.form.repositoryUrlInvalid')
          }
        ]}
      >
        <Input placeholder={t('nodeapp.form.repositoryUrlPlaceholder')} />
      </Form.Item>

      <Form.Item
        name="description"
        label={t('nodeapp.form.description')}
      >
        <Input.TextArea
          rows={3}
          placeholder={t('nodeapp.form.descriptionPlaceholder')}
        />
      </Form.Item>

      <Form.Item
        name="author"
        label={t('nodeapp.form.author')}
      >
        <Input placeholder={t('nodeapp.form.authorPlaceholder')} />
      </Form.Item>

      <Form.Item
        name="homepage"
        label={t('nodeapp.form.homepage')}
      >
        <Input placeholder={t('nodeapp.form.homepagePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="installCommand"
        label={t('nodeapp.form.installCommand')}
        help={t('nodeapp.form.installCommandHelp')}
      >
        <Input placeholder="npm install" />
      </Form.Item>

      <Form.Item
        name="startCommand"
        label={t('nodeapp.form.startCommand')}
        help={t('nodeapp.form.startCommandHelp')}
      >
        <Input placeholder="npm start" />
      </Form.Item>

      <Form.Item
        name="port"
        label={t('nodeapp.form.port')}
        help={t('nodeapp.form.portHelp')}
      >
        <Input placeholder="3000" type="number" />
      </Form.Item>

      <Form.Item>
        <Space style={{ float: 'right' }}>
          <Button onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t('common.submit')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default NodeAppForm
