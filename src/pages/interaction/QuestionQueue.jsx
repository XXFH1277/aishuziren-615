import { EditOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import StatusTag from '../../components/StatusTag';
import {
  addQuestionToSpeechQueue,
  generateQuestionReply,
  getAiReplyTemplates,
  getCommentTypes,
  getInteractionLiveRooms,
  getQuestionStatuses,
  getQuestions,
  getRiskLevels,
  ignoreQuestion,
} from '../../services/interactionService';

const commentTypes = getCommentTypes();
const interactionLiveRooms = getInteractionLiveRooms();
const riskLevels = getRiskLevels();
const questionStatuses = getQuestionStatuses();
const aiReplyTemplates = getAiReplyTemplates();

export default function QuestionQueue() {
  const [questionList, setQuestionList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(interactionLiveRooms[0]?.value);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [riskLevel, setRiskLevel] = useState();
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingReply, setEditingReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getQuestions({
        liveRoomId: currentRoom,
        status,
        riskLevel,
        page: 1,
        pageSize: 100,
      });

      setQuestionList(data.list || []);
    } catch (requestError) {
      const messageText = requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [currentRoom, riskLevel, status]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = useMemo(
    () =>
      questionList.filter((item) => {
        const keywordText = keyword.toLowerCase();
        return (
          !keyword ||
          (item.question || '').toLowerCase().includes(keywordText) ||
          (item.nickname || '').toLowerCase().includes(keywordText) ||
          (item.relatedProduct || item.productName || '').toLowerCase().includes(keywordText)
        );
      }),
    [keyword, questionList],
  );

  const updateQuestion = (id, patch) => {
    setQuestionList((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleGenerateReply = async (record) => {
    try {
      const question = await generateQuestionReply(record.id, {
        aiReply: aiReplyTemplates[record.type],
      });
      updateQuestion(record.id, question);
      message.success('已通过本地 API 生成 Mock 推荐回复，不调用 Kimi / Mimo');
    } catch (requestError) {
      message.error(requestError.message || 'Mock 回复生成失败');
    }
  };

  const handleOpenEdit = (record) => {
    setEditingQuestion(record);
    setEditingReply(record.aiReply || aiReplyTemplates[record.type] || '');
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;

    try {
      const question = await generateQuestionReply(editingQuestion.id, { replyText: editingReply });
      updateQuestion(editingQuestion.id, question);
      setEditingQuestion(null);
      setEditingReply('');
      message.success('已通过本地 API 保存 Mock 回复内容');
    } catch (requestError) {
      message.error(requestError.message || '回复保存失败');
    }
  };

  const handleAddToQueue = async (record) => {
    try {
      const result = await addQuestionToSpeechQueue(record.id);
      updateQuestion(record.id, result.question);
      message.success(result.message || '已加入真实待播队列');
    } catch (requestError) {
      message.error(requestError.message || '加入待播队列失败');
    }
  };

  const handleIgnore = async (record) => {
    try {
      const question = await ignoreQuestion(record.id);
      updateQuestion(record.id, question);
      message.info('已通过本地 API 标记忽略 Mock');
    } catch (requestError) {
      message.error(requestError.message || '忽略问题失败');
    }
  };

  const stats = {
    pending: questionList.filter((item) => item.status === '待处理').length,
    recommended: questionList.filter((item) => ['已推荐', '已编辑'].includes(item.status)).length,
    queued: questionList.filter((item) => item.status === '已加入待播').length,
    ignored: questionList.filter((item) => item.status === '已忽略').length,
    highRisk: questionList.filter((item) => item.status === '高风险待人工' || item.riskLevel === '高').length,
  };

  const columns = [
    {
      title: '问题内容',
      dataIndex: 'question',
      width: 260,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">来源用户：{record.nickname}</div>
        </div>
      ),
    },
    { title: '问题类型', dataIndex: 'type', width: 120, render: (value) => <CommentTypeTag type={value} /> },
    { title: '关联商品', dataIndex: 'relatedProduct', width: 150 },
    { title: '风险等级', dataIndex: 'riskLevel', width: 110, render: (value) => <RiskTag level={value} /> },
    {
      title: 'AI推荐回复',
      dataIndex: 'aiReply',
      width: 320,
      render: (value) => (value ? <span className="ai-reply-text">{value}</span> : <Typography.Text type="secondary">待生成</Typography.Text>),
    },
    { title: '处理状态', dataIndex: 'status', width: 130, render: (value) => <StatusTag status={value} /> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作',
      fixed: 'right',
      width: 300,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<RobotOutlined />} onClick={() => handleGenerateReply(record)}>
            生成回复
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            编辑回复
          </Button>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleAddToQueue(record)}>
            加入待播队列
          </Button>
          <Button type="link" size="small" onClick={() => handleIgnore(record)}>
            忽略
          </Button>
        </Space>
      ),
    },
  ];

  const renderQuestionTable = (dataSource) => (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={{ pageSize: 6, showTotal: (total) => `共 ${total} 个问题` }}
      scroll={{ x: 1600 }}
      locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的问题'} /> }}
    />
  );

  return (
    <>
      <PageHeader
        title="问题队列"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。当前问题队列通过本地 API 读取 SQLite，AI 回复仍为 Mock。"
        extra={<Select value={currentRoom} onChange={setCurrentRoom} options={interactionLiveRooms} style={{ width: 220 }} />}
      />

      {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}

      <div className="interaction-stat-grid">
        <DataCard title="待处理问题" value={stats.pending} helper="等待生成或人工处理" tone="amber" />
        <DataCard title="AI已推荐回复" value={stats.recommended} helper="仅为 Mock 文案" tone="blue" />
        <DataCard title="已加入待播队列" value={stats.queued} helper="不写入延迟播控模块" tone="teal" />
        <DataCard title="已忽略问题" value={stats.ignored} helper="本地 API Mock 状态变更" tone="blue" />
        <DataCard title="高风险待人工处理" value={stats.highRisk} helper="需人工确认后再播报" tone="rose" />
      </div>

      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索问题、用户或商品"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="处理状态"
            value={status}
            onChange={setStatus}
            options={questionStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="风险等级"
            value={riskLevel}
            onChange={setRiskLevel}
            options={riskLevels.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
        </div>
        <Tabs
          items={[
            { key: 'all', label: '全部问题', children: renderQuestionTable(filteredQuestions) },
            {
              key: 'risk',
              label: '高风险处理',
              children: renderQuestionTable(filteredQuestions.filter((item) => item.status === '高风险待人工' || item.riskLevel !== '低')),
            },
            {
              key: 'queued',
              label: '已加入待播',
              children: renderQuestionTable(filteredQuestions.filter((item) => item.status === '已加入待播')),
            },
          ]}
        />
      </Card>

      <Modal title="编辑推荐回复" open={Boolean(editingQuestion)} onCancel={() => setEditingQuestion(null)} onOk={handleSaveEdit} okText="保存 Mock 回复">
        <Input.TextArea rows={6} value={editingReply} onChange={(event) => setEditingReply(event.target.value)} />
      </Modal>
    </>
  );
}
