import { BellOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getNotificationChannels, getNotificationRules, getSettingsOptions } from '../../services/settingsService';

const initialRules = getNotificationRules();
const notificationChannels = getNotificationChannels();
const settingsOptions = getSettingsOptions();

export default function NotificationSettings() {
  const [rules, setRules] = useState(initialRules);
  const [scene, setScene] = useState();
  const [enabled, setEnabled] = useState();
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();

  const stats = useMemo(
    () => ({
      total: rules.length,
      enabled: rules.filter((item) => item.enabled).length,
      disabled: rules.filter((item) => !item.enabled).length,
      sent: rules.filter((item) => item.status === '已发送').length,
    }),
    [rules],
  );

  const filteredRules = useMemo(
    () =>
      rules.filter((item) => {
        const matchScene = !scene || item.scene === scene;
        const matchEnabled = enabled === undefined || item.enabled === enabled;
        return matchScene && matchEnabled;
      }),
    [enabled, rules, scene],
  );

  const openEdit = (record) => {
    setEditingRule(record);
    form.setFieldsValue(record);
  };

  const handleSave = () => {
    const values = form.getFieldsValue();
    setRules((prevRules) => prevRules.map((item) => (item.id === editingRule.id ? { ...item, ...values } : item)));
    message.success('通知规则已保存 Mock，不发送真实通知');
    setEditingRule(null);
  };

  const columns = [
    { title: '通知名称', dataIndex: 'name', width: 180 },
    { title: '通知场景', dataIndex: 'scene', width: 150, render: (value) => <Tag color="blue">{value}</Tag> },
    {
      title: '通知渠道',
      dataIndex: 'channels',
      width: 230,
      render: (values) => (
        <Space size={4} wrap>
          {values.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '是否启用',
      dataIndex: 'enabled',
      width: 110,
      render: (value, record) => (
        <Switch
          checked={value}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={(checked) => {
            setRules((prevRules) => prevRules.map((item) => (item.id === record.id ? { ...item, enabled: checked } : item)));
            message.info(`${record.name} 已${checked ? '启用' : '禁用'} Mock`);
          }}
        />
      ),
    },
    { title: '通知对象', dataIndex: 'recipients', width: 190 },
    { title: '最近触发时间', dataIndex: 'lastTriggeredAt', width: 160 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag status={value} /> },
    {
      title: '操作',
      fixed: 'right',
      width: 170,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => message.success(`${record.name} 测试通知为 Mock，不会发送邮件或企业 IM`)}>
            测试
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="通知设置"
        description="配置执行端、OBS、AI模型、风险话术、工单和成本等提醒规则。当前所有通知渠道均为 Mock，不发送真实消息。"
        extra={
          <Button type="primary" icon={<BellOutlined />} onClick={() => message.info('新增通知规则为 Mock 入口')}>
            新增规则 Mock
          </Button>
        }
      />

      <Alert
        className="settings-alert"
        type="info"
        showIcon
        message="通知服务安全说明"
        description="本页不接邮件、短信、企业微信、飞书、钉钉或任何真实通知服务；测试按钮只显示前端反馈。"
      />

      <div className="settings-stat-grid">
        <DataCard title="通知规则总数" value={stats.total} helper="当前 Mock 规则数量" tone="blue" />
        <DataCard title="已启用规则" value={stats.enabled} helper="会展示 Mock 触发状态" tone="teal" />
        <DataCard title="已禁用规则" value={stats.disabled} helper="暂不触发 Mock 提醒" tone="amber" />
        <DataCard title="今日已发送 Mock" value={stats.sent} helper="仅代表页面状态" tone="rose" />
      </div>

      <Card className="panel-card">
        <div className="toolbar-row">
          <Select
            allowClear
            placeholder="通知场景"
            value={scene}
            onChange={setScene}
            options={settingsOptions.notificationScenes.map((item) => ({ label: item, value: item }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="启用状态"
            value={enabled}
            onChange={setEnabled}
            options={[
              { label: '已启用', value: true },
              { label: '已禁用', value: false },
            ]}
            style={{ width: 140 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRules}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条通知规则` }}
          scroll={{ x: 1320 }}
          locale={{ emptyText: <Empty description="暂无符合条件的通知规则" /> }}
        />
      </Card>

      <Modal
        title="编辑通知规则 Mock"
        open={Boolean(editingRule)}
        onOk={handleSave}
        onCancel={() => setEditingRule(null)}
        okText="保存 Mock"
        cancelText="取消"
        width={680}
      >
        <Form form={form} layout="vertical" className="settings-modal-form">
          <Form.Item label="通知名称" name="name">
            <Input />
          </Form.Item>
          <Form.Item label="通知场景" name="scene">
            <Select options={settingsOptions.notificationScenes.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="通知渠道" name="channels">
            <Select mode="multiple" options={notificationChannels.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="通知对象" name="recipients">
            <Input />
          </Form.Item>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
