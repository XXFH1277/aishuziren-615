import { ApiOutlined, ExperimentOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Input, List, Modal, Select, Slider, Space, Switch, Tag, message } from 'antd';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { modelProviders, modelRoleSettings, modelUsageScenes } from '../../mock/aiModels';

export default function ModelServices() {
  const [form] = Form.useForm();
  const [configuring, setConfiguring] = useState(null);

  const openConfig = (model) => {
    setConfiguring(model);
    form.setFieldsValue({
      provider: model.name,
      baseUrl: '',
      modelName: model.defaultModel,
      maxTokens: 2048,
      temperature: 0.7,
      enabled: model.enabled,
    });
  };

  const closeConfig = () => {
    setConfiguring(null);
    form.resetFields();
  };

  const saveConfig = () => {
    message.success('模型服务配置已 Mock 保存，不读取或写入真实 API Key');
    closeConfig();
  };

  return (
    <>
      <PageHeader
        title="模型服务配置"
        description="统一管理模型服务商、默认模型和连接状态。当前为前端 Mock，不读取真实 Key，不调用 Kimi / Mimo。"
      />

      <Alert
        className="studio-alert"
        type="warning"
        showIcon
        message="当前为 Mock，不读取真实 Key"
        description="apiKey 输入框仅为占位输入，不会保存到文件、日志、Mock 数据或浏览器外部服务。"
      />

      <div className="ai-model-grid">
        {modelProviders.map((model) => (
          <Card
            className="model-card"
            key={model.id}
            actions={[
              <Button type="link" icon={<SettingOutlined />} onClick={() => openConfig(model)} key="config">配置</Button>,
              <Button type="link" icon={<ApiOutlined />} onClick={() => message.info(`${model.name} 测试连接为 Mock 操作`)} key="test">测试连接</Button>,
              <Button type="link" onClick={() => message.success(`${model.name} 已设为默认 Mock`)} key="default">设为默认</Button>,
            ]}
          >
            <div className="model-card-title">
              <h3>
                <ExperimentOutlined /> {model.name}
              </h3>
              <StatusTag status={model.status} />
            </div>
            <div className="model-meta">
              <div>服务商：{model.provider}</div>
              <div>默认模型：{model.defaultModel}</div>
              <div>今日调用：{model.todayCalls} 次</div>
              <div>今日费用：¥{model.todayCost.toFixed(2)}</div>
            </div>
            <Space wrap className="ai-model-tags">
              {model.usage.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}
            </Space>
            <p className="ai-card-description">{model.description}</p>
          </Card>
        ))}
      </div>

      <Card title="默认模型设置" className="panel-card">
        <List
          dataSource={modelRoleSettings}
          renderItem={(item) => (
            <List.Item actions={[<Button type="link" onClick={() => message.info('默认模型切换为 Mock 操作')} key="change">修改</Button>]}>
              <List.Item.Meta title={item.label} description={item.value} />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={configuring ? `配置 ${configuring.name}` : '配置模型服务'}
        open={Boolean(configuring)}
        onCancel={closeConfig}
        onOk={saveConfig}
        okText="保存 Mock 配置"
      >
        <Alert
          className="ai-modal-alert"
          type="warning"
          showIcon
          message="请勿输入真实 API Key"
          description="本阶段仅验证表单交互，不读取模型api.txt 或 .env.local。"
        />
        <Form form={form} layout="vertical">
          <Form.Item label="服务商" name="provider">
            <Input disabled />
          </Form.Item>
          <Form.Item label="baseUrl" name="baseUrl">
            <Input placeholder="https://api.example.com/mock" />
          </Form.Item>
          <Form.Item label="modelName" name="modelName">
            <Input placeholder="model-name-mock" />
          </Form.Item>
          <Form.Item label="apiKey 占位输入框" name="apiKey">
            <Input.Password placeholder="仅占位，不要输入真实 API Key" autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="maxTokens" name="maxTokens">
            <Slider min={512} max={8192} step={256} />
          </Form.Item>
          <Form.Item label="temperature" name="temperature">
            <Slider min={0} max={1} step={0.1} />
          </Form.Item>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="可选用途">{modelUsageScenes.join(' / ')}</Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>
    </>
  );
}
