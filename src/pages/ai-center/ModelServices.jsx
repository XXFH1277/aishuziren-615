import { ApiOutlined, ExperimentOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Card, Descriptions, Empty, Form, Input, List, Modal, Slider, Space, Switch, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  getModelCredentials,
  getModelProviders,
  getModelRoleSettings,
  saveModelCredentials,
  getModelUsageScenes,
  testAiModel,
  updateAiModel,
  updateModelDefaults,
} from '../../services/aiService';

const modelUsageScenes = getModelUsageScenes();

export default function ModelServices() {
  const [form] = Form.useForm();
  const [modelProviders, setModelProviders] = useState([]);
  const [modelRoleSettings, setModelRoleSettings] = useState([]);
  const [configuring, setConfiguring] = useState(null);
  const [credentialInfo, setCredentialInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [modelsResult, defaultsResult] = await Promise.all([
        getModelProviders({}),
        getModelRoleSettings({}),
      ]);
      setModelProviders(modelsResult.list || []);
      setModelRoleSettings(defaultsResult.list || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openConfig = async (model) => {
    setConfiguring(model);
    setCredentialInfo({
      apiKeyConfigured: model.apiKeyConfigured,
      apiKeyMasked: model.apiKeyMasked,
      credentialRef: model.credentialRef,
    });
    form.setFieldsValue({
      provider: model.name,
      baseUrl: model.officialBaseUrl || model.baseUrlOptions?.[0] || '',
      modelName: model.defaultModel,
      apiKey: '',
      maxTokens: model.maxTokens || 2048,
      temperature: model.temperature || 0.7,
      enabled: model.enabled,
    });

    try {
      const credential = await getModelCredentials(model.id);
      setCredentialInfo(credential);
      form.setFieldsValue({
        baseUrl: credential.baseUrl || model.officialBaseUrl || model.baseUrlOptions?.[0] || '',
        modelName: credential.modelName || model.defaultModel,
      });
    } catch (requestError) {
      message.error(requestError.message || '读取凭证状态失败');
    }
  };

  const closeConfig = () => {
    setConfiguring(null);
    setCredentialInfo(null);
    form.resetFields();
  };

  const saveConfig = async () => {
    if (!configuring) return;

    try {
      setSaving(true);
      const values = form.getFieldsValue();
      const updated = await updateAiModel(configuring.id, {
        baseUrl: values.baseUrl,
        modelName: values.modelName,
        maxTokens: values.maxTokens,
        temperature: values.temperature,
        enabled: values.enabled,
      });
      const apiKey = String(values.apiKey || '').trim();
      let credential = null;

      if (apiKey) {
        credential = await saveModelCredentials(configuring.id, {
          source: 'local_sqlite_masked',
          apiKey,
          baseUrl: values.baseUrl,
          modelName: values.modelName,
          remark: 'AI 模型配置页保存，仅保存脱敏状态',
        });
      }

      setModelProviders((items) => items.map((item) => (
        item.id === updated.id
          ? {
              ...updated,
              ...(credential || {}),
            }
          : item
      )));
      message.success(apiKey ? '模型配置和脱敏凭证状态已保存，未保存明文 API Key' : '模型服务配置已保存');
      closeConfig();
      await loadData();
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (model) => {
    try {
      const result = await testAiModel(model.id, {
        sourcePage: 'AI模型配置页',
      });
      message.info(`${model.name} 测试连接：${result.status}，默认 fake provider，不调用真实模型`);
      await loadData();
    } catch (requestError) {
      message.error(requestError.message || '测试失败');
    }
  };

  const handleSetDefault = async (model) => {
    try {
      await updateModelDefaults({
        role: 'copywriting',
        providerId: model.id,
        modelName: model.defaultModel,
        value: `${model.name} / ${model.defaultModel}`,
      });
      message.success(`${model.name} 已设为普通文案默认模型 Mock`);
      await loadData();
    } catch (requestError) {
      message.error(requestError.message || '设置失败');
    }
  };

  return (
    <>
      <PageHeader
        title="模型服务配置"
        description="统一管理模型服务商、默认模型和连接状态。当前默认使用 fake provider，不调用真实模型。"
      />

      <Alert
        className="studio-alert"
        type="warning"
        showIcon
        message="当前默认使用 fake provider，不会调用真实模型。"
        description="API Key 只会提交给本地后端保存脱敏状态；前端不保存明文，测试连接不调用 Kimi / Mimo / OpenAI / DeepSeek。真实模型调用需在后端环境变量和权限策略确认后开启。"
      />
      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <div className="ai-model-grid">
        {modelProviders.map((model) => (
          <Card
            className="model-card"
            key={model.id}
            loading={loading}
            actions={[
              <Button type="link" icon={<SettingOutlined />} onClick={() => openConfig(model)} key="config">配置</Button>,
              <Button type="link" icon={<ApiOutlined />} onClick={() => handleTest(model)} key="test">测试连接</Button>,
              <Button type="link" onClick={() => handleSetDefault(model)} key="default">设为默认</Button>,
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
              <div>预设类型：{model.isOfficialPreset ? '官方预设参考' : '手动配置'}</div>
              <div>今日调用：{model.todayCalls} 次</div>
              <div>今日费用：¥{model.todayCost.toFixed(2)}</div>
            </div>
            <Space wrap className="ai-model-tags">
              {model.usage.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}
              {model.isOfficialPreset ? <Tag color="green">官方预设</Tag> : <Tag>手动配置</Tag>}
              {model.apiKeyConfigured ? <Tag color="green">Key 已配置：{model.apiKeyMasked || '已脱敏'}</Tag> : <Tag>未保存 Key</Tag>}
            </Space>
            <p className="ai-card-description">{model.description}</p>
            <p className="ai-docs-note">{model.docsNote}</p>
          </Card>
        ))}
      </div>
      {!loading && !modelProviders.length ? <Card className="panel-card"><Empty description="暂无模型服务配置" /></Card> : null}

      <Card title="默认模型设置" className="panel-card" loading={loading}>
        <List
          dataSource={modelRoleSettings}
          renderItem={(item) => (
            <List.Item actions={[<Button type="link" onClick={() => message.info('默认模型切换已通过卡片按钮做 Mock 演示')} key="change">修改</Button>]}>
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
        confirmLoading={saving}
        okText="保存配置"
      >
        <Alert
          className="ai-modal-alert"
          type="warning"
          showIcon
          message="官方 URL 和模型名仅作为预设参考，请以服务商最新文档为准。"
          description="当前默认 fake provider，不调用真实模型；API Key 明文不会返回前端，也不会写入日志、Mock 或文档。"
        />
        <Form form={form} layout="vertical">
          <Form.Item label="服务商" name="provider">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="baseUrl"
            name="baseUrl"
            extra={configuring?.isOfficialPreset ? '可选择官方预设，也可以手动编辑。' : '该服务商暂无官方预设，请手动填写。'}
          >
            <AutoComplete
              options={(configuring?.baseUrlOptions || []).map((value) => ({ label: value, value }))}
              placeholder={configuring?.isOfficialPreset ? '选择或输入 baseUrl' : '用户手动填写 baseUrl'}
              filterOption={(inputValue, option) => option?.value?.toLowerCase().includes(inputValue.toLowerCase())}
            />
          </Form.Item>
          <Form.Item
            label="modelName"
            name="modelName"
            extra={configuring?.modelOptions?.length ? '可选择常用模型，也可以手动输入。' : '该服务商暂无模型预设，请手动填写。'}
          >
            <AutoComplete
              options={(configuring?.modelOptions || []).map((value) => ({ label: value, value }))}
              placeholder={configuring?.modelOptions?.length ? '选择或输入 modelName' : '用户手动填写 modelName'}
              filterOption={(inputValue, option) => option?.value?.toLowerCase().includes(inputValue.toLowerCase())}
            />
          </Form.Item>
          <Form.Item
            label="apiKey"
            name="apiKey"
            extra={credentialInfo?.apiKeyConfigured ? `当前脱敏状态：${credentialInfo.apiKeyMasked || '已配置'}` : '留空则只保存模型配置；输入后仅提交本地后端保存脱敏状态。'}
          >
            <Input.Password placeholder="本地联调可输入 fake key，不要输入真实 API Key" autoComplete="new-password" />
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
            <Descriptions.Item label="凭证状态">
              {credentialInfo?.apiKeyConfigured ? `已配置（${credentialInfo.apiKeyMasked || '已脱敏'}）` : '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label="凭证引用">{credentialInfo?.credentialRef || '-'}</Descriptions.Item>
            <Descriptions.Item label="预设说明">{configuring?.docsNote}</Descriptions.Item>
            <Descriptions.Item label="可选用途">{modelUsageScenes.join(' / ')}</Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>
    </>
  );
}
