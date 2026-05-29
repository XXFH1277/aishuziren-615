import { EditOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import {
  checkComplianceText,
  createComplianceKeyword,
  getComplianceKeywords,
  updateComplianceKeyword,
} from '../../services/aiService';

const riskOptions = ['低', '中', '高'];
const actionOptions = [
  { label: '提醒', value: 'warn' },
  { label: '建议改写', value: 'rewrite' },
  { label: '拦截', value: 'block' },
];
const matchTypeOptions = [
  { label: '包含匹配', value: 'contains' },
  { label: '精确匹配', value: 'exact' },
];
const actionColor = {
  warn: 'gold',
  rewrite: 'blue',
  block: 'red',
};
const riskColor = {
  低: 'green',
  中: 'gold',
  高: 'red',
};

export default function ComplianceCenter() {
  const [keywords, setKeywords] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [form] = Form.useForm();
  const [checkForm] = Form.useForm();

  async function loadKeywords(nextFilters = filters) {
    try {
      setLoading(true);
      setError('');
      const data = await getComplianceKeywords({ page: 1, pageSize: 100, ...nextFilters });
      setKeywords(data.list || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeywords({});
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(keywords.map((item) => item.category).filter(Boolean))),
    [keywords],
  );

  const openCreate = () => {
    setEditing({ id: '' });
    form.setFieldsValue({
      text: '',
      category: '通用',
      riskLevel: '中',
      action: 'warn',
      matchType: 'contains',
      enabled: true,
      description: '',
    });
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
  };

  const saveKeyword = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const payload = {
        ...values,
        enabled: values.enabled !== false,
      };

      if (editing?.id) {
        await updateComplianceKeyword(editing.id, payload);
        message.success('合规词条已更新');
      } else {
        await createComplianceKeyword(payload);
        message.success('合规词条已新增');
      }

      setEditing(null);
      await loadKeywords();
    } catch (requestError) {
      if (requestError?.errorFields) {
        return;
      }
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateFilters = (patch) => {
    const nextFilters = { ...filters, ...patch };
    setFilters(nextFilters);
    loadKeywords(nextFilters);
  };

  const runCheck = async () => {
    try {
      setChecking(true);
      const values = await checkForm.validateFields();
      const data = await checkComplianceText({
        text: values.text,
        sourcePage: '合规词库',
        scenario: 'manual_check',
        target: 'manual_text',
      });
      setCheckResult(data.result);
      message.success('合规检查完成');
    } catch (requestError) {
      if (requestError?.errorFields) {
        return;
      }
      message.error(requestError.message || '检查失败');
    } finally {
      setChecking(false);
    }
  };

  const columns = [
    { title: '词条', dataIndex: 'text', width: 180 },
    { title: '分类', dataIndex: 'category', width: 130, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '风险', dataIndex: 'riskLevel', width: 90, render: (value) => <Tag color={riskColor[value]}>{value}</Tag> },
    { title: '动作', dataIndex: 'actionLabel', width: 110, render: (value, record) => <Tag color={actionColor[record.action]}>{value}</Tag> },
    { title: '匹配', dataIndex: 'matchType', width: 110, render: (value) => (value === 'exact' ? '精确' : '包含') },
    { title: '状态', dataIndex: 'enabled', width: 90, render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag> },
    { title: '说明', dataIndex: 'description', width: 260 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="合规词库"
        description="维护全局敏感词、禁用表达和建议改写规则。当前用于商品文案 fake provider 输出后的本地合规检查。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增词条
          </Button>
        }
      />

      <Alert
        className="page-alert"
        type="info"
        showIcon
        message="当前为本地合规 MVP"
        description="本页不调用真实 AI，不上传外部服务；检查结果只写入脱敏摘要，不记录完整原文。"
      />
      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索词条或说明"
            onSearch={(keyword) => updateFilters({ keyword })}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="分类"
            value={filters.category}
            onChange={(category) => updateFilters({ category })}
            options={categories.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="风险等级"
            value={filters.riskLevel}
            onChange={(riskLevel) => updateFilters({ riskLevel })}
            options={riskOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <Select
            allowClear
            placeholder="处理动作"
            value={filters.action}
            onChange={(action) => updateFilters({ action })}
            options={actionOptions}
            style={{ width: 140 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={keywords}
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条词库规则` }}
          scroll={{ x: 1220 }}
          locale={{ emptyText: <Empty description="暂无合规词条" /> }}
        />
      </Card>

      <Card className="panel-card">
        <Form form={checkForm} layout="vertical">
          <Form.Item
            name="text"
            label="手动检查文本"
            rules={[{ required: true, message: '请输入要检查的文本' }]}
          >
            <Input.TextArea rows={4} placeholder="输入商品文案、直播口播或待播话术进行本地合规检查" />
          </Form.Item>
          <Button type="primary" icon={<SafetyCertificateOutlined />} loading={checking} onClick={runCheck}>
            检查文本
          </Button>
        </Form>
        {checkResult ? (
          <div className="mock-preview-result ai-template-preview">
            <Space direction="vertical" size={8}>
              <Space wrap>
                <Tag color={checkResult.passed ? 'green' : 'red'}>{checkResult.passed ? '可继续复核' : '建议拦截'}</Tag>
                <Tag color={riskColor[checkResult.riskLevel]}>{checkResult.riskLevel}风险</Tag>
                <Tag color={actionColor[checkResult.action]}>{checkResult.actionLabel}</Tag>
              </Space>
              <Typography.Text>{checkResult.suggestion}</Typography.Text>
              {checkResult.matches?.length ? (
                <Space wrap>
                  {checkResult.matches.map((item) => (
                    <Tag key={item.id} color={riskColor[item.riskLevel]}>
                      {item.text}
                    </Tag>
                  ))}
                </Space>
              ) : null}
            </Space>
          </div>
        ) : null}
      </Card>

      <Modal
        title={editing?.id ? '编辑合规词条' : '新增合规词条'}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveKeyword}
        confirmLoading={saving}
        okText="保存"
        width={720}
      >
        <Form form={form} layout="vertical">
          <div className="form-grid">
            <Form.Item name="text" label="词条" rules={[{ required: true, message: '请输入敏感词或禁用表达' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="riskLevel" label="风险等级">
              <Select options={riskOptions.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item name="action" label="处理动作">
              <Select options={actionOptions} />
            </Form.Item>
            <Form.Item name="matchType" label="匹配方式">
              <Select options={matchTypeOptions} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
