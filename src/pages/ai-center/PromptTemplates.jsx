import { CopyOutlined, EditOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  copyPromptTemplate,
  getPromptCategories,
  getPromptTemplateStatuses,
  getPromptTemplates,
  getPromptVariables,
  updatePromptTemplate,
} from '../../services/aiService';

const promptCategories = getPromptCategories();
const promptTemplateStatuses = getPromptTemplateStatuses();
const promptVariables = getPromptVariables();

export default function PromptTemplates() {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [previewResult, setPreviewResult] = useState('');
  const [form] = Form.useForm();

  async function loadTemplates() {
    try {
      setLoading(true);
      setError('');
      const data = await getPromptTemplates({ page: 1, pageSize: 100 });
      setTemplates(data.list || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const dataSource = useMemo(
    () => (activeCategory === '全部' ? templates : templates.filter((item) => item.category === activeCategory)),
    [activeCategory, templates],
  );

  const openEdit = (record) => {
    setEditing(record);
    setPreviewResult('');
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      status: record.status,
      templateContent: record.templateContent,
      variables: record.variables.join('\n'),
      previewInput: '商品：舟山海鲜礼盒；卖点：海岛特色、适合送礼；价格：以页面为准。',
    });
  };

  const saveTemplate = async () => {
    if (!editing) return;

    try {
      setSaving(true);
      const values = form.getFieldsValue();
      const updated = await updatePromptTemplate(editing.id, {
        name: values.name,
        category: values.category,
        status: values.status,
        templateContent: values.templateContent,
        variables: String(values.variables || '')
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setTemplates((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      message.success('Prompt 模板已保存到本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (record) => {
    try {
      await copyPromptTemplate(record.id);
      message.success('已复制 Prompt 模板到本地 API Mock');
      await loadTemplates();
    } catch (requestError) {
      message.error(requestError.message || '复制失败');
    }
  };

  const handleDisable = async (record) => {
    try {
      const updated = await updatePromptTemplate(record.id, { status: '停用' });
      setTemplates((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      message.info('已停用模板 Mock');
    } catch (requestError) {
      message.error(requestError.message || '停用失败');
    }
  };

  const columns = [
    { title: '模板名称', dataIndex: 'name', width: 180 },
    { title: '模板分类', dataIndex: 'category', width: 140, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '适用页面', dataIndex: 'targetPage', width: 170 },
    { title: '默认模型', dataIndex: 'defaultModel', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
    {
      title: '操作',
      fixed: 'right',
      width: 240,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openEdit(record)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)}>复制</Button>
          <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleDisable(record)}>停用</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Prompt模板管理"
        description="统一管理商品文案、直播口播、弹幕回复、合规改写和技术排查等系统内置 Prompt 模板。当前全部为本地 API Mock。"
      />

      <Alert
        className="studio-alert"
        type="info"
        showIcon
        message="模板变量示例"
        description={promptVariables.join('、')}
      />
      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Card className="panel-card">
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={['全部', ...promptCategories].map((item) => ({
            key: item,
            label: item,
            children: (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={dataSource}
                loading={loading}
                pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 个模板` }}
                scroll={{ x: 1180 }}
                locale={{ emptyText: <Empty description="暂无 Prompt 模板" /> }}
              />
            ),
          }))}
        />
      </Card>

      <Modal
        title={editing ? `编辑模板：${editing.name}` : '编辑模板'}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveTemplate}
        confirmLoading={saving}
        okText="保存 Mock 模板"
        width={820}
      >
        <Form form={form} layout="vertical">
          <div className="form-grid">
            <Form.Item label="模板名称" name="name">
              <Input />
            </Form.Item>
            <Form.Item label="模板分类" name="category">
              <Select options={promptCategories.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item label="模板状态" name="status">
              <Select options={promptTemplateStatuses.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
          </div>
          <Form.Item label="模板内容" name="templateContent">
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item label="变量说明" name="variables">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="预览输入" name="previewInput">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button
            type="primary"
            onClick={() => setPreviewResult('这是根据当前模板和预览输入生成的 Mock 结果，不调用真实模型。')}
          >
            Mock 生成结果
          </Button>
          {previewResult ? (
            <Typography.Paragraph className="mock-preview-result ai-template-preview">{previewResult}</Typography.Paragraph>
          ) : null}
        </Form>
      </Modal>
    </>
  );
}
