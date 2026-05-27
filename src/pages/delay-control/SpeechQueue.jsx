import { ArrowUpOutlined, DeleteOutlined, EditOutlined, ExclamationCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import {
  approveSpeechItem,
  deleteSpeechItem,
  getReviewStatuses,
  getSpeechActions,
  getSpeechQueue,
  getSpeechTones,
  insertSpeechItem,
  rejectSpeechItem,
  updateSpeechQueueItem,
} from '../../services/delayControlService';

const speechActions = getSpeechActions();
const speechTones = getSpeechTones();
const reviewStatuses = getReviewStatuses();

function includesText(value, text) {
  return String(value || '').includes(text);
}

export default function SpeechQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftAction, setDraftAction] = useState(speechActions[0]);
  const [draftTone, setDraftTone] = useState(speechTones[0]);
  const [statusFilter, setStatusFilter] = useState();
  const [riskFilter, setRiskFilter] = useState();

  async function loadQueue() {
    try {
      setLoading(true);
      setError('');
      const data = await getSpeechQueue({ page: 1, pageSize: 100 });
      setQueue(data.list || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const stats = {
    pending: queue.filter((item) => !includesText(item.reviewStatus, '删除')).length,
    highRisk: queue.filter((item) => includesText(item.riskLevel, '高')).length,
    review: queue.filter((item) => includesText(item.reviewStatus, '审核') || includesText(item.reviewStatus, '人工')).length,
    passed: queue.filter((item) => includesText(item.reviewStatus, '通过')).length,
  };

  const riskOptions = useMemo(() => {
    const values = Array.from(new Set(queue.map((item) => item.riskLevel).filter(Boolean)));
    return values.length ? values : ['低', '中', '高'];
  }, [queue]);

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

  const saveEdit = async () => {
    if (!editing) return;

    try {
      setSaving(true);
      const updated = await updateSpeechQueueItem(editing.id, {
        text: draftText,
        action: draftAction,
        tone: draftTone,
        reviewStatus: '已修改',
      });
      updateItem(editing.id, updated);
      setEditing(null);
      message.success('已保存本地 API Mock 修改');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (record) => {
    try {
      const result = await approveSpeechItem(record.id);
      updateItem(record.id, { reviewStatus: result.reviewStatus, approvedBy: result.approvedBy, approvedAt: result.approvedAt });
      message.success('已通过本地 API Mock 审核');
    } catch (requestError) {
      message.error(requestError.message || '操作失败');
    }
  };

  const handleDelete = async (record) => {
    try {
      await deleteSpeechItem(record.id, { reason: 'operator mock delete' });
      setQueue((items) => items.filter((item) => item.id !== record.id));
      message.info('已删除本地 API Mock 待播内容');
    } catch (requestError) {
      message.error(requestError.message || '删除失败');
    }
  };

  const handleReject = async (record) => {
    try {
      const result = await rejectSpeechItem(record.id, { reason: 'operator mock reject' });
      updateItem(record.id, { reviewStatus: result.reviewStatus });
      message.warning('已驳回本地 API Mock 待播内容');
    } catch (requestError) {
      message.error(requestError.message || '驳回失败');
    }
  };

  const handleInsert = async (record) => {
    try {
      const result = await insertSpeechItem(record.id, { position: 1 });
      updateItem(record.id, { reviewStatus: result.reviewStatus, scheduledTime: '下一句' });
      message.success('已插队本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '插队失败');
    }
  };

  const handleHighRisk = async (record) => {
    try {
      const updated = await updateSpeechQueueItem(record.id, { riskLevel: '高', reviewStatus: '高风险待人工' });
      updateItem(record.id, updated);
      message.warning('已标记高风险本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '标记失败');
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'order', width: 70 },
    {
      title: '台词内容',
      dataIndex: 'text',
      width: 340,
      render: (value, record) => (
        <div>
          <Typography.Text strong={includesText(record.reviewStatus, '即将')}>{value}</Typography.Text>
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
      width: 350,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button type="link" size="small" onClick={() => handleReject(record)}>
            驳回
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            修改
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
          <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => handleInsert(record)}>
            插队
          </Button>
          <Button type="link" size="small" icon={<ArrowUpOutlined />} onClick={() => message.info('移到下一句 Mock')}>
            下一句
          </Button>
          <Button type="link" size="small" icon={<ExclamationCircleOutlined />} onClick={() => handleHighRisk(record)}>
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

      <Alert
        className="page-alert"
        type="info"
        showIcon
        message="当前为本地 Mock 占位，未接真实服务。"
        description="通过、驳回、修改、删除、插队等操作只写入本地 API / SQLite 或返回 Mock 成功，不触发真实数字人播报、TTS、OBS 或执行端。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <div className="delay-stat-grid">
        <Card className="data-card tone-blue" loading={loading}><span>待播数量</span><strong>{stats.pending}</strong><p>未删除的待播内容</p></Card>
        <Card className="data-card tone-rose" loading={loading}><span>高风险数量</span><strong>{stats.highRisk}</strong><p>需要人工确认</p></Card>
        <Card className="data-card tone-amber" loading={loading}><span>人工待审核</span><strong>{stats.review}</strong><p>待审核 / 高风险待人工</p></Card>
        <Card className="data-card tone-teal" loading={loading}><span>已通过数量</span><strong>{stats.passed}</strong><p>可进入播报链路</p></Card>
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
            options={riskOptions.map((item) => ({ label: `${item}风险`, value: item }))}
            style={{ width: 140 }}
          />
          <Button onClick={loadQueue}>刷新</Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredQueue}
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条待播内容` }}
          scroll={{ x: 1560 }}
          locale={{ emptyText: <Empty description="暂无符合条件的待播内容" /> }}
        />
      </Card>

      <Modal
        title="修改待播内容"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        confirmLoading={saving}
        okText="保存本地 API Mock 修改"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea rows={5} value={draftText} onChange={(event) => setDraftText(event.target.value)} />
          <Select value={draftAction} onChange={setDraftAction} options={speechActions.map((item) => ({ label: item, value: item }))} style={{ width: '100%' }} />
          <Select value={draftTone} onChange={setDraftTone} options={speechTones.map((item) => ({ label: item, value: item }))} style={{ width: '100%' }} />
        </Space>
      </Modal>
    </>
  );
}
