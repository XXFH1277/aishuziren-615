import {
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import {
  approveSpeechItem,
  deleteSpeechItem,
  dispatchNextSpeechItem,
  dispatchSpeechItem,
  getSpeechActions,
  getSpeechQueue,
  getSpeechTones,
  insertSpeechItem,
  rejectSpeechItem,
  updateSpeechQueueItem,
} from '../../services/delayControlService';

const speechActions = getSpeechActions();
const speechTones = getSpeechTones();
const reviewStatuses = ['待审核', '已通过', '已修改', '即将播出', '高风险待人工', '已驳回', '已删除'];
const approvedStatuses = ['已通过', '已审核', '即将播出'];

function includesText(value, text) {
  return String(value || '').includes(text);
}

function canDispatch(record) {
  return approvedStatuses.includes(record.reviewStatus) && (!record.broadcastStatus || ['待下发', '失败'].includes(record.broadcastStatus));
}

export default function SpeechQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatchingId, setDispatchingId] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftAction, setDraftAction] = useState(speechActions[0]);
  const [draftTone, setDraftTone] = useState(speechTones[0]);
  const [statusFilter, setStatusFilter] = useState();
  const [riskFilter, setRiskFilter] = useState();
  const [broadcastFilter, setBroadcastFilter] = useState();

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
    pending: queue.filter((item) => item.broadcastStatus !== '已播报' && item.broadcastStatus !== '不播报').length,
    dispatchable: queue.filter(canDispatch).length,
    dispatching: queue.filter((item) => item.broadcastStatus === '下发中').length,
    broadcasted: queue.filter((item) => item.broadcastStatus === '已播报').length,
    failed: queue.filter((item) => item.broadcastStatus === '失败').length,
    highRisk: queue.filter((item) => includesText(item.riskLevel, '高')).length,
  };

  const riskOptions = useMemo(() => {
    const values = Array.from(new Set(queue.map((item) => item.riskLevel).filter(Boolean)));
    return values.length ? values : ['低', '中', '高'];
  }, [queue]);

  const broadcastOptions = useMemo(() => {
    const values = Array.from(new Set(queue.map((item) => item.broadcastStatus).filter(Boolean)));
    return values.length ? values : ['未审核', '待下发', '下发中', '已播报', '失败', '不播报'];
  }, [queue]);

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) => {
        const matchStatus = !statusFilter || item.reviewStatus === statusFilter;
        const matchRisk = !riskFilter || item.riskLevel === riskFilter;
        const matchBroadcast = !broadcastFilter || item.broadcastStatus === broadcastFilter;
        return matchStatus && matchRisk && matchBroadcast;
      }),
    [broadcastFilter, queue, riskFilter, statusFilter],
  );

  const updateItem = (id, patch) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const upsertItem = (speechItem) => {
    if (!speechItem?.id) {
      return;
    }
    updateItem(speechItem.id, speechItem);
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
      message.success('已保存待播内容修改');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (record) => {
    try {
      const result = await approveSpeechItem(record.id);
      upsertItem(result.speechItem || { ...record, reviewStatus: result.reviewStatus, broadcastStatus: result.broadcastStatus });
      message.success('已审核通过，等待下发播报');
    } catch (requestError) {
      message.error(requestError.message || '操作失败');
    }
  };

  const handleDelete = async (record) => {
    try {
      await deleteSpeechItem(record.id, { reason: 'operator delete' });
      setQueue((items) => items.filter((item) => item.id !== record.id));
      message.info('已删除待播内容');
    } catch (requestError) {
      message.error(requestError.message || '删除失败');
    }
  };

  const handleReject = async (record) => {
    try {
      const result = await rejectSpeechItem(record.id, { reason: 'operator reject' });
      upsertItem(result.speechItem || { ...record, reviewStatus: result.reviewStatus, broadcastStatus: result.broadcastStatus });
      message.warning('已驳回待播内容');
    } catch (requestError) {
      message.error(requestError.message || '驳回失败');
    }
  };

  const handleInsert = async (record) => {
    try {
      const result = await insertSpeechItem(record.id, { position: 1 });
      upsertItem(result.speechItem || { ...record, reviewStatus: result.reviewStatus, broadcastStatus: result.broadcastStatus, scheduledTime: '下一句' });
      message.success('已插队到下一句，等待下发');
    } catch (requestError) {
      message.error(requestError.message || '插队失败');
    }
  };

  const handleHighRisk = async (record) => {
    try {
      const updated = await updateSpeechQueueItem(record.id, { riskLevel: '高', reviewStatus: '高风险待人工', broadcastStatus: '未审核' });
      updateItem(record.id, updated);
      message.warning('已标记高风险，需人工审核');
    } catch (requestError) {
      message.error(requestError.message || '标记失败');
    }
  };

  const handleDispatch = async (record) => {
    try {
      setDispatchingId(record.id);
      const result = await dispatchSpeechItem(record.id);
      upsertItem(result.speechItem);
      message.success(result.message || `已下发播报命令：${result.commandId}`);
    } catch (requestError) {
      message.error(requestError.message || '下发播报失败');
    } finally {
      setDispatchingId('');
    }
  };

  const handleDispatchNext = async () => {
    try {
      setDispatchingId('__next__');
      const result = await dispatchNextSpeechItem({ liveTaskId: queue[0]?.liveTaskId });
      upsertItem(result.speechItem);
      message.success(result.message || `已下发下一条播报命令：${result.commandId}`);
    } catch (requestError) {
      message.error(requestError.message || '下发下一条失败');
    } finally {
      setDispatchingId('');
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
          <Typography.Text strong={record.broadcastStatus === '下发中'}>{value}</Typography.Text>
          <div className="table-subtext">来源：{record.source}</div>
        </div>
      ),
    },
    { title: '关联商品', dataIndex: 'relatedProduct', width: 150 },
    { title: '动作', dataIndex: 'action', width: 120 },
    { title: '语气', dataIndex: 'tone', width: 100 },
    { title: '风险等级', dataIndex: 'riskLevel', width: 110, render: (value) => <SpeechRiskTag level={value} /> },
    { title: '审核状态', dataIndex: 'reviewStatus', width: 120, render: (value) => <SpeechStatusTag status={value} /> },
    { title: '播报状态', dataIndex: 'broadcastStatus', width: 120, render: (value) => <SpeechStatusTag status={value || '未审核'} /> },
    {
      title: '执行端命令',
      dataIndex: 'executorCommandId',
      width: 130,
      render: (value, record) => value || record.broadcastErrorMessage || '-',
    },
    { title: '预计播出时间', dataIndex: 'scheduledTime', width: 130 },
    {
      title: '操作',
      fixed: 'right',
      width: 430,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button type="link" size="small" onClick={() => handleReject(record)}>
            驳回
          </Button>
          <Button type="link" size="small" icon={<SendOutlined />} loading={dispatchingId === record.id} disabled={!canDispatch(record)} onClick={() => handleDispatch(record)}>
            下发播报
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
          <Button type="link" size="small" icon={<ArrowUpOutlined />} onClick={() => handleInsert(record)}>
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
        description="本页用于管理已审核话术的真实下发链路：审核通过后进入待下发，后台将话术下发为 speak 命令，由本地执行端 PrintAdapter 回执后更新为已播报或失败。"
        extra={
          <Button type="primary" icon={<SendOutlined />} loading={dispatchingId === '__next__'} disabled={!stats.dispatchable} onClick={handleDispatchNext}>
            下发下一条
          </Button>
        }
      />

      <Alert
        className="page-alert"
        type="info"
        showIcon
        message="当前只编排中控队列到执行端播报链路"
        description="执行端默认使用 PrintAdapter 打印话术并模拟成功；本阶段不接真实 DUIX、TTS、口型同步、推流、OBS 控制或直播平台。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <div className="delay-stat-grid">
        <Card className="data-card tone-blue" loading={loading}>
          <span>待处理数量</span>
          <strong>{stats.pending}</strong>
          <p>未完成播报闭环的内容</p>
        </Card>
        <Card className="data-card tone-amber" loading={loading}>
          <span>可下发数量</span>
          <strong>{stats.dispatchable}</strong>
          <p>已审核且等待下发</p>
        </Card>
        <Card className="data-card tone-teal" loading={loading}>
          <span>已播报数量</span>
          <strong>{stats.broadcasted}</strong>
          <p>执行端已回执成功</p>
        </Card>
        <Card className="data-card tone-rose" loading={loading}>
          <span>失败 / 高风险</span>
          <strong>{stats.failed} / {stats.highRisk}</strong>
          <p>需人工排查或重新审核</p>
        </Card>
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
            placeholder="播报状态"
            value={broadcastFilter}
            onChange={setBroadcastFilter}
            options={broadcastOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
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
          scroll={{ x: 1760 }}
          locale={{ emptyText: <Empty description="暂无符合条件的待播内容" /> }}
        />
      </Card>

      <Modal
        title="修改待播内容"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        confirmLoading={saving}
        okText="保存修改"
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
