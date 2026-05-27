import { Alert, Button, Card, Empty, Form, Input, List, Select, Space, Switch, Tabs, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getAiAssistantSettings, saveAiAssistantSettings } from '../../services/aiService';

const workModes = ['文案生成模式', '合规审核模式', '问题排查模式', '直播中控建议模式', '技术工单模式'];
const contextPermissions = [
  '允许读取商品信息',
  '允许读取数字人信息',
  '允许读取直播间配置',
  '允许读取弹幕问题',
  '允许读取待播队列',
  '允许读取错误日志',
];

export default function AiAssistant() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setError('');
        const settings = await getAiAssistantSettings();

        if (mounted) {
          form.setFieldsValue({
            enabled: settings.enabled,
            assistantName: settings.assistantName,
            defaultMode: settings.defaultMode,
            defaultTone: settings.defaultTone,
            allowReadPageContext: settings.allowReadPageContext,
            allowFillForm: settings.allowFillForm,
            enableComplianceReminder: settings.enableComplianceReminder,
            allowedContextScopes: settings.allowedContextScopes || [],
          });
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [form]);

  const handleSave = async (values) => {
    try {
      setSaving(true);
      await saveAiAssistantSettings(values);
      message.success('AI 助理设置已保存到本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI助理设置"
        description="配置后台右下角 AI 助理的行为、工作模式和页面上下文权限。当前只保存本地 Mock 设置，不调用真实模型服务。"
      />

      <Alert
        className="studio-alert"
        type="warning"
        showIcon
        message="安全提示"
        description="本页只保存本地 SQLite Mock 配置，不读取 .env.local，不读取模型api.txt，不写入任何 API Key。"
      />
      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <div className="ai-center-layout-grid">
          <Card title="基础设置" className="panel-card" loading={loading}>
            {error && !loading ? (
              <Empty description="暂无 AI 助理设置" />
            ) : (
              <>
                <div className="form-grid">
                  <Form.Item label="是否开启悬浮 AI 助理" name="enabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="助理名称" name="assistantName" rules={[{ required: true, message: '请输入助理名称' }]}>
                    <Input placeholder="例如：直播运营 AI 助理" />
                  </Form.Item>
                  <Form.Item label="默认工作模式" name="defaultMode">
                    <Select options={workModes.map((item) => ({ label: item, value: item }))} />
                  </Form.Item>
                  <Form.Item label="默认语气" name="defaultTone">
                    <Select options={['专业', '亲切', '热情', '解释型', '安抚型'].map((item) => ({ label: item, value: item }))} />
                  </Form.Item>
                  <Form.Item label="是否读取当前页面上下文" name="allowReadPageContext" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="是否允许一键填入表单" name="allowFillForm" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="是否开启合规提醒" name="enableComplianceReminder" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
                <Space>
                  <Button type="primary" htmlType="submit" loading={saving}>
                    保存设置
                  </Button>
                  <Button onClick={() => form.resetFields()}>恢复当前设置</Button>
                </Space>
              </>
            )}
          </Card>

          <Card title="工作模式与权限" className="panel-card" loading={loading}>
            <Tabs
              items={[
                {
                  key: 'modes',
                  label: '工作模式',
                  children: (
                    <List
                      dataSource={workModes}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={<Space><span>{item}</span><Tag color="blue">Mock</Tag></Space>}
                            description="用于约束 AI 助理在不同后台页面中的回答风格和建议边界。"
                          />
                        </List.Item>
                      )}
                    />
                  ),
                },
                {
                  key: 'permissions',
                  label: '页面上下文权限',
                  children: (
                    <Form.Item name="allowedContextScopes">
                      <Select
                        mode="multiple"
                        options={contextPermissions.map((item) => ({ label: item, value: item }))}
                        placeholder="选择允许读取的页面上下文"
                      />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </Form>
    </>
  );
}
