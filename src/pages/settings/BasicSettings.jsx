import { ReloadOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Select, Space, Switch, Upload, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getBasicSettings, getSettingsOptions, saveBasicSettings } from '../../services/settingsService';

const settingsOptions = getSettingsOptions();

const normalizeUpload = (event) => (Array.isArray(event) ? event : event?.fileList);

const serializeBasicSettings = (values) => ({
  ...values,
  logo: Array.isArray(values.logo)
    ? values.logo.map((file) => ({
        uid: file.uid,
        name: file.name,
        status: file.status,
      }))
    : values.logo,
});

export default function BasicSettings() {
  const [form] = Form.useForm();
  const [basicSettings, setBasicSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchBasicSettings() {
      setLoading(true);
      setError('');

      try {
        const data = await getBasicSettings();

        if (!ignore) {
          setBasicSettings(data);
          form.setFieldsValue(data);
        }
      } catch (requestError) {
        const messageText = requestError.message || '基础设置加载失败';

        if (!ignore) {
          setError(messageText);
          message.error(messageText);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchBasicSettings();

    return () => {
      ignore = true;
    };
  }, [form]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const values = await form.validateFields();
      const savedSettings = await saveBasicSettings(serializeBasicSettings(values));

      setBasicSettings(savedSettings);
      form.setFieldsValue(savedSettings);
      message.success('基础设置已保存到本地 SQLite');
    } catch (requestError) {
      if (!requestError.errorFields) {
        message.error(requestError.message || '基础设置保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(basicSettings);
    message.info('已恢复默认 Mock 设置');
  };

  return (
    <>
      <PageHeader
        title="基础设置"
        description="集中管理系统名称、默认展示项和开发阶段安全提示，当前通过本地 API 读取并保存到 SQLite。"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={loading || saving}>
              恢复当前配置
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存设置
            </Button>
          </Space>
        }
      />

      <Alert
        className="settings-alert"
        type="warning"
        showIcon
        message="安全边界"
        description="API Key 不进入前端，.env.local 不提交 GitHub，真实模型调用必须走后端代理。本页不会读取模型api.txt 或 .env.local。"
      />

      {error ? <Alert className="settings-alert" type="error" showIcon message={error} /> : null}

      <Form form={form} layout="vertical" initialValues={basicSettings} disabled={loading}>
        <div className="settings-two-column">
          <Card title="系统信息" className="panel-card">
            <Form.Item label="系统名称" name="systemName">
              <Input placeholder="数字人直播带货中控系统" />
            </Form.Item>
            <Form.Item label="系统 Logo 占位" name="logo" valuePropName="fileList" getValueFromEvent={normalizeUpload}>
              <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>上传 Logo Mock</Button>
              </Upload>
            </Form.Item>
            <Form.Item label="系统副标题" name="systemSubtitle">
              <Input placeholder="Cloud Admin Mock Console" />
            </Form.Item>
            <Form.Item label="默认语言" name="defaultLanguage">
              <Select options={settingsOptions.languages.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item label="默认时区" name="defaultTimezone">
              <Select options={settingsOptions.timezones.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item label="默认直播平台" name="defaultPlatform">
              <Select options={settingsOptions.platforms.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item label="默认页面" name="defaultPage">
              <Select options={settingsOptions.defaultPages} />
            </Form.Item>
          </Card>

          <Card title="开发模式" className="panel-card">
            <div className="settings-switch-list">
              <Form.Item label="Mock 模式开关" name="mockMode" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item label="安全模式开关" name="safeMode" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item label="调试提示开关" name="debugTips" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item label="显示“当前为 Mock 环境”提示" name="showMockBanner" valuePropName="checked">
                <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
              </Form.Item>
            </div>

            <Alert
              className="settings-inner-alert"
              type="info"
              showIcon
              message="当前阶段说明"
              description="这些开关只用于前端原型展示，不会影响真实用户、真实权限、真实模型或真实执行端。"
            />
          </Card>
        </div>
      </Form>
    </>
  );
}
