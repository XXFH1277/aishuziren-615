import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Descriptions, Input, Modal, Select, Space, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getAiCallLogs, getAiCallStatuses, getAiCallTypes, getModelProviders } from '../../services/aiService';

const { RangePicker } = DatePicker;
const aiCallLogs = getAiCallLogs();
const aiCallStatuses = getAiCallStatuses();
const aiCallTypes = getAiCallTypes();
const modelProviders = getModelProviders();

export default function AiCallLogs() {
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({});

  const filteredLogs = useMemo(
    () =>
      aiCallLogs.filter((item) => {
        const matchKeyword =
          !filters.keyword ||
          item.page.toLowerCase().includes(filters.keyword.toLowerCase()) ||
          item.inputSummary.toLowerCase().includes(filters.keyword.toLowerCase()) ||
          item.outputSummary.toLowerCase().includes(filters.keyword.toLowerCase());
        const matchProvider = !filters.provider || item.provider === filters.provider;
        const matchType = !filters.type || item.type === filters.type;
        const matchStatus = !filters.status || item.status === filters.status;
        return matchKeyword && matchProvider && matchType && matchStatus;
      }),
    [filters],
  );

  const columns = [
    { title: '调用时间', dataIndex: 'time', width: 170 },
    { title: '调用页面', dataIndex: 'page', width: 130 },
    { title: '调用类型', dataIndex: 'type', width: 120, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '模型服务商', dataIndex: 'provider', width: 120 },
    { title: '模型名称', dataIndex: 'modelName', width: 150 },
    { title: '输入摘要', dataIndex: 'inputSummary', width: 220 },
    { title: '输出摘要', dataIndex: 'outputSummary', width: 220 },
    { title: '调用状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={value} /> },
    { title: '耗时', dataIndex: 'duration', width: 90 },
    { title: '估算费用', dataIndex: 'cost', width: 100, render: (value) => `¥${value.toFixed(2)}` },
    {
      title: '操作',
      fixed: 'right',
      width: 110,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedLog(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="调用日志"
        description="查看 AI 调用记录 Mock，用于排查、审计和成本分析。本页不记录真实 API Key，也不代表真实模型调用。"
      />

      <Card className="panel-card">
        <div className="toolbar-row">
          <RangePicker placeholder={['开始时间', '结束时间']} />
          <Input.Search
            allowClear
            placeholder="搜索调用页面、输入或输出摘要"
            onSearch={(keyword) => setFilters((item) => ({ ...item, keyword }))}
            onChange={(event) => setFilters((item) => ({ ...item, keyword: event.target.value }))}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="模型服务商"
            onChange={(provider) => setFilters((item) => ({ ...item, provider }))}
            options={modelProviders.map((item) => ({ label: item.name, value: item.name }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="调用类型"
            onChange={(type) => setFilters((item) => ({ ...item, type }))}
            options={aiCallTypes.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="调用状态"
            onChange={(status) => setFilters((item) => ({ ...item, status }))}
            options={aiCallStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <Select
            allowClear
            placeholder="用户"
            options={['运营管理员', '直播助理', '系统任务'].map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredLogs}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条日志` }}
          scroll={{ x: 1680 }}
        />
      </Card>

      <Modal title="调用详情 Mock" open={Boolean(selectedLog)} onCancel={() => setSelectedLog(null)} footer={null} width={760}>
        {selectedLog ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Prompt 摘要">{selectedLog.inputSummary}</Descriptions.Item>
            <Descriptions.Item label="返回内容摘要">{selectedLog.outputSummary}</Descriptions.Item>
            <Descriptions.Item label="错误信息 Mock">
              {selectedLog.status === '成功' ? '无错误，仅为 Mock 成功记录。' : 'Mock 错误信息：连接未配置或内容被策略拦截。'}
            </Descriptions.Item>
            <Descriptions.Item label="token 数 Mock">{selectedLog.tokens}</Descriptions.Item>
            <Descriptions.Item label="费用 Mock">¥{selectedLog.cost.toFixed(2)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  );
}
