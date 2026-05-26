import { ReloadOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Select, Space, Switch, Upload, message } from 'antd';
import PageHeader from '../../components/PageHeader';
import { getBasicSettings, getSettingsOptions, saveBasicSettingsMock } from '../../services/settingsService';

const basicSettings = getBasicSettings();
const settingsOptions = getSettingsOptions();

const normalizeUpload = (event) => (Array.isArray(event) ? event : event?.fileList);

export default function BasicSettings() {
  const [form] = Form.useForm();

  const handleSave = () => {
    const response = saveBasicSettingsMock(form.getFieldsValue());
    if (response.success) {
      message.success('基础设置已保存 Mock，不写入后端或数据库');
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
        description="集中管理系统名称、默认展示项和开发阶段安全提示。当前仅保存前端 Mock 状态，不写入真实配置。"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              恢复默认 Mock
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              保存 Mock
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

      <Form form={form} layout="vertical" initialValues={basicSettings}>
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
