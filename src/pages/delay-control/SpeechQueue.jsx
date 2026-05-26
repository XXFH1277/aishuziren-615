import { ArrowUpOutlined, DeleteOutlined, EditOutlined, ExclamationCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import { speechActions, speechTones } from '../../mock/delayControl';
import { reviewStatuses, speechQueue } from '../../mock/speechQueue';

export default function SpeechQueue() {
  const [queue, setQueue] = useState(speechQueue);
  const [editing, setEditing] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftAction, setDraftAction] = useState('回到镜头');
  const [draftTone, setDraftTone] = useState('专业');
  const [statusFilter, setStatusFilter] = useState();
  const [riskFilter, setRiskFilter] = useState();

  const stats = {
    pending: queue.filter((item) => !['已删除'].includes(item.reviewStatus)).length,
    highRisk: queue.filter((item) => item.riskLevel === '高').length,
    review: queue.filter((item) => ['待审核', '高风险待人工'].includes(item.reviewStatus)).length,
    passed: queue.filter((item) => item.reviewStatus === '已通过').length,
  };

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) => {
        const matchStatus = !statusFilter || item.reviewStatus === statusFilter;
        const matchRisk = !riskFilter || item.riskLevel === riskFilter;
        return matchStatus && matchRisk;
      }),
    [queue, riskFilter, statusFilter],
  );

  const updateItem = (id, patch) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const openEdit = (record) => {
    setEditing(record);
    setDraftText(record.text);
    setDraftAction(record.action);
    setDraftTone(record.tone);
  };

  const saveEdit = () => {
    if (!editing) return;
    updateItem(editing.id, { text: draftText, action: draftAction, tone: draftTone, reviewStatus: '已修改' });
    setEditing(null);
    message.success('已保存 Mock 修改');
  };

  const columns = [
    { title: '排序', dataIndex: 'order', width: 70 },
    {
      title: '台词内容',
      dataIndex: 'text',
      width: 340,
      render: (value, record) => (
        <div>
          <Typography.Text strong={record.reviewStatus === '即将播出'}>{value}</Typography.Text>
          <div className="table-subtext">来源：{record.source}</div>
        </div>
      ),
    },
    { title: '关联商品', dataIndex: 'relatedProduct', width: 150 },
    { title: '动作', dataIndex: 'action', width: 120 },
    { title: '语气', dataIndex: 'tone', width: 100 },
    { title: '风险等级', dataIndex: 'riskLevel', width: 110, render: (value) => <SpeechRiskTag level={value} /> },
    { title: '审核状态', dataIndex: 'reviewStatus', width: 130, render: (value) => <SpeechStatusTag status={value} /> },
    { title: '预计播出时间', dataIndex: 'scheduledTime', width: 130 },
    {
      title: '操作',
      fixed: 'right',
      width: 310,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => { updateItem(record.id, { reviewStatus: '已通过' }); message.success('已通过 Mock'); }}>
            通过
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            修改
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => { updateItem(record.id, { reviewStatus: '已删除' }); message.info('已删除 Mock'); }}>
            删除
          </Button>
          <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => { updateItem(record.id, { reviewStatus: '即将播出' }); message.success('已插队 Mock'); }}>
            插队
          </Button>
          <Button type="link" size="small" icon={<ArrowUpOutlined />} onClick={() => message.info('已移到下一句 Mock')}>
            下一句
          </Button>
          <Button type="link" size="small" icon={<ExclamationCircleOutlined />} onClick={() => { updateItem(record.id, { riskLevel: '高', reviewStatus: '高风险待人工' }); message.warning('已标记高风险 Mock'); }}>
            高风险
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="待播队列"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。这里用于管理待播话术、播出前审核、修改、插队和风险标记流程。"
      />

      <div className="delay-stat-grid">
        <Card className="data-card tone-blue"><span>待播数量</span><strong>{stats.pending}</strong><p>未删除的待播内容</p></Card>
        <Card className="data-card tone-rose"><span>高风险数量</span><strong>{stats.highRisk}</strong><p>需要人工确认</p></Card>
        <Card className="data-card tone-amber"><span>人工待审核</span><strong>{stats.review}</strong><p>待审核 / 高风险待人工</p></Card>
        <Card className="data-card tone-teal"><span>已通过数量</span><strong>{stats.passed}</strong><p>可进入播报链路</p></Card>
      </div>

      <Card className="panel-card">
        <div className="toolbar-row">
          <Select
            allowClear
            placeholder="审核状态"
            value={statusFilter}
            onChange={setStatusFilter}
            options={reviewStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="风险等级"
            value={riskFilter}
            onChange={setRiskFilter}
            options={['低', '中', '高'].map((item) => ({ label: `${item}风险`, value: item }))}
            style={{ width: 140 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredQueue}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条待播内容` }}
          scroll={{ x: 1560 }}
          locale={{ emptyText: <Empty description="暂无符合条件的待播内容" /> }}
        />
      </Card>

      <Modal title="修改待播内容" open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={saveEdit} okText="保存 Mock 修改">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea rows={5} value={draftText} onChange={(event) => setDraftText(event.target.value)} />
          <Select value={draftAction} onChange={setDraftAction} options={speechActions.map((item) => ({ label: item, value: item }))} style={{ width: '100%' }} />
          <Select value={draftTone} onChange={setDraftTone} options={speechTones.map((item) => ({ label: item, value: item }))} style={{ width: '100%' }} />
        </Space>
      </Modal>
    </>
  );
}
