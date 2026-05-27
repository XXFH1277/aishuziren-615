import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  PlusCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import StatusTag from '../../components/StatusTag';
import { getDelaySettings as getMockDelaySettings, getSpeechActions, getSpeechTones } from '../../services/delayControlService';
import {
  addQuestionToSpeechQueue,
  generateQuestionReply,
  getAiReplyTemplates,
  getBroadcastModes,
  getTakeoverActions,
  getTakeoverTones,
  ignoreQuestion,
  simulateComment,
} from '../../services/interactionService';
import {
  getControlRoomBroadcast,
  getControlRoomComments,
  getControlRoomQuestions,
  getLiveControlRoomState,
  sendControlRoomManualSpeech,
  updateControlRoomSpeechQueueItem,
} from '../../services/liveControlRoomService';

const commentFilters = [
  { key: 'all', label: '全部' },
  { key: 'questions', label: '仅看问题' },
  { key: 'risk', label: '仅看高风险' },
  { key: 'pending', label: '未处理' },
];

const speechActions = getSpeechActions();
const speechTones = getSpeechTones();
const broadcastModes = getBroadcastModes();
const takeoverActions = getTakeoverActions();
const takeoverTones = getTakeoverTones();
const aiReplyTemplates = getAiReplyTemplates();
const fallbackDelaySettings = getMockDelaySettings();

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function getAiReply(question) {
  return question.aiReply || aiReplyTemplates[question.type] || '这是本地 API Mock 推荐回复，播出前请先做合规审核。';
}

function isHighRisk(level) {
  return ['高', '楂?'].includes(level);
}

function isPendingStatus(status) {
  return !String(status || '').includes('已忽略') && !String(status || '').includes('已加入待播');
}

export default function LiveControlRoom() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [commentList, setCommentList] = useState([]);
  const [commentFilter, setCommentFilter] = useState('all');
  const [questionList, setQuestionList] = useState([]);
  const [queue, setQueue] = useState([]);
  const [broadcastState, setBroadcastState] = useState(null);
  const [speechText, setSpeechText] = useState('');
  const [tone, setTone] = useState(takeoverTones[0] || '亲切');
  const [action, setAction] = useState(takeoverActions[0] || '看评论区');
  const [broadcastMode, setBroadcastMode] = useState(broadcastModes[0] || '立即插队 Mock');
  const [suggestion, setSuggestion] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingReply, setEditingReply] = useState('');
  const [editingSpeech, setEditingSpeech] = useState(null);
  const [speechDraft, setSpeechDraft] = useState({ text: '', action: speechActions[0] || '回到镜头', tone: speechTones[0] || '专业' });

  async function loadControlRoom() {
    try {
      setLoading(true);
      setError('');
      const overviewResult = await getLiveControlRoomState();
      const taskId = overviewResult.task?.id;
      const [commentsResult, questionsResult, broadcastResult] = await Promise.all([
        getControlRoomComments({ taskId, limit: 30 }),
        getControlRoomQuestions({ taskId }),
        getControlRoomBroadcast(taskId),
      ]);

      setOverview(overviewResult);
      setCommentList(commentsResult.list || []);
      setQuestionList(questionsResult.list || []);
      setBroadcastState(broadcastResult);
      setQueue(broadcastResult.speechQueue || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadControlRoom();
  }, []);

  const currentTask = overview?.task || {};
  const currentRoom = overview?.room || {};
  const studioOutput = overview?.outputStatus || {};
  const delayControl = broadcastState?.delayControl || overview?.delayControl || {};
  const manualTakeover = overview?.manualTakeover || {};
  const subtitles = broadcastState?.subtitles || {};
  const delaySettings = broadcastState?.delaySettings || fallbackDelaySettings;
  const currentSpeech = delayControl.currentSpeech || {};
  const nextSpeech = delayControl.nextSpeech || {};
  const currentSubtitle = subtitles.currentSubtitle || {};
  const nextSubtitle = subtitles.nextSubtitle || {};
  const subtitleStyle = subtitles.subtitleStyle || {};

  const unhandledComments = useMemo(
    () => commentList.filter((item) => !String(item.replyStatus || '').includes('已忽略')),
    [commentList],
  );
  const highRiskComments = useMemo(() => commentList.filter((item) => isHighRisk(item.riskLevel)), [commentList]);
  const pendingQuestions = useMemo(() => questionList.filter((item) => isPendingStatus(item.status)), [questionList]);
  const activeQueue = useMemo(
    () => queue.filter((item) => !String(item.reviewStatus || '').includes('已删除')).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [queue],
  );
  const pendingReviewSpeech = useMemo(
    () => activeQueue.filter((item) => !String(item.reviewStatus || '').includes('已通过')),
    [activeQueue],
  );

  const filteredComments = useMemo(
    () =>
      commentList.filter((item) => {
        if (commentFilter === 'questions') {
          return !['闲聊互动', '恶意评论'].includes(item.type);
        }
        if (commentFilter === 'risk') {
          return isHighRisk(item.riskLevel);
        }
        if (commentFilter === 'pending') {
          return unhandledComments.some((comment) => comment.id === item.id);
        }
        return true;
      }),
    [commentFilter, commentList, unhandledComments],
  );

  const statusBar = overview?.statusBar || {};
  const liveStatusItems = [
    { label: '当前直播任务', value: statusBar.currentLiveTask || currentTask.taskName, wide: true },
    { label: '当前直播间', value: statusBar.currentLiveRoom || currentRoom.name, wide: true },
    { label: '平台', node: <Tag color="blue">{statusBar.platform || currentTask.platform || 'Mock'}</Tag> },
    { label: '当前数字人', value: statusBar.currentAvatar || currentTask.avatarName, wide: true },
    { label: '当前商品组', value: statusBar.currentProductGroup || currentTask.productGroupName, wide: true },
    { label: '执行端', node: <StatusTag status={statusBar.executorStatus || delayControl.executorStatus} /> },
    { label: 'OBS', node: <StatusTag status={statusBar.obsStatus || studioOutput.obsStatus} /> },
    { label: '延迟模式', node: <Tag color="geekblue">{statusBar.delayMode || delayControl.delayMode || 'Mock'}</Tag> },
    { label: '未处理弹幕', node: <Badge count={unhandledComments.length} overflowCount={99} /> },
    { label: '待处理问题', node: <Badge count={pendingQuestions.length} color="#f59e0b" /> },
    { label: '高风险评论', node: <Badge count={highRiskComments.length} color="#e11d48" /> },
    { label: '待审核播报', node: <Badge count={pendingReviewSpeech.length} color="#7c3aed" /> },
  ];

  const updateCommentStatus = (id, replyStatus) => {
    setCommentList((items) => items.map((item) => (item.id === id ? { ...item, replyStatus } : item)));
  };

  const updateQuestion = (id, patch) => {
    setQuestionList((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateSpeech = (id, patch) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSimulateComment = async () => {
    try {
      const newComment = await simulateComment({
        liveTaskId: currentTask.id,
        liveRoomId: currentRoom.id,
        content: '中控台模拟新弹幕：这款今天有优惠吗？',
        time: nowTime(),
        productName: currentTask.productGroupName || 'Mock 商品',
      });
      setCommentList((items) => [newComment, ...items]);
      message.success('已追加一条本地 API Mock 弹幕，不连接真实 WebSocket');
    } catch (requestError) {
      message.error(requestError.message || '模拟弹幕失败');
    }
  };

  const handleOpenQuestionEdit = (question) => {
    setEditingQuestion(question);
    setEditingReply(getAiReply(question));
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion) return;

    try {
      const updated = await generateQuestionReply(editingQuestion.id, { replyText: editingReply });
      updateQuestion(editingQuestion.id, updated);
      setEditingQuestion(null);
      setEditingReply('');
      message.success('已通过本地 API 保存 Mock 推荐回复');
    } catch (requestError) {
      message.error(requestError.message || '保存回复失败');
    }
  };

  const handleAddQuestionToQueue = async (question) => {
    try {
      const updated = await addQuestionToSpeechQueue(question.id, { source: 'live-control-room' });
      updateQuestion(question.id, updated);
      message.success('已加入待播队列 Mock，不触发真实数字人播报');
    } catch (requestError) {
      message.error(requestError.message || '加入待播失败');
    }
  };

  const handleIgnoreQuestion = async (question) => {
    try {
      const updated = await ignoreQuestion(question.id);
      updateQuestion(question.id, updated);
      message.info('已忽略问题 Mock');
    } catch (requestError) {
      message.error(requestError.message || '忽略失败');
    }
  };

  const handleBroadcast = async (mode = broadcastMode) => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }

    try {
      const result = await sendControlRoomManualSpeech({
        taskId: currentTask.id,
        text: speechText,
        tone,
        action,
        broadcastMode: mode,
      });
      setSuggestion(result.suggestion || '');
      message.success(`${mode} 已通过本地 API Mock 接收，不调用真实数字人播报`);
    } catch (requestError) {
      message.error(requestError.message || '人工播报失败');
    }
  };

  const fillReply = (reply) => {
    setSpeechText(reply);
    setSuggestion('');
    message.info('已填入人工输入框');
  };

  const handleOpenSpeechEdit = (record) => {
    setEditingSpeech(record);
    setSpeechDraft({ text: record.text, action: record.action, tone: record.tone });
  };

  const handleSaveSpeechEdit = async () => {
    if (!editingSpeech) return;

    try {
      const updated = await updateControlRoomSpeechQueueItem(editingSpeech.id, {
        operation: 'update',
        ...speechDraft,
        reviewStatus: '已修改',
      });
      updateSpeech(editingSpeech.id, updated);
      setEditingSpeech(null);
      message.success('已通过本地 API 保存待播内容 Mock 修改');
    } catch (requestError) {
      message.error(requestError.message || '保存待播内容失败');
    }
  };

  const handleSpeechOperation = async (item, operation, patch = {}) => {
    try {
      const updated = await updateControlRoomSpeechQueueItem(item.id, { operation, ...patch });
      updateSpeech(item.id, updated);
      message.success('播控操作已写入本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '播控操作失败');
    }
  };

  return (
    <>
      <PageHeader
        title="直播中控台"
        description="直播中控台用于直播进行中的一屏操作，聚合直播预览、弹幕、问题、人工接管、待播队列和风险提示。当前数据来自本地 API + SQLite Mock。"
        extra={
          <Space wrap>
            <Badge status="processing" text="直播中控 v2 API Mock" />
            <Button icon={<PauseCircleOutlined />} onClick={() => message.info('暂停直播为 Mock 操作')}>
              暂停 Mock
            </Button>
          </Space>
        }
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {!overview && !loading ? (
          <Card className="panel-card">
            <Empty description="暂无直播中控台数据" />
          </Card>
        ) : null}

        {overview ? (
          <>
            <Card className="panel-card live-status-bar control-room-status-card">
              <div className="control-room-status-grid">
                {liveStatusItems.map((item) => (
                  <div className={`control-room-status-item ${item.wide ? 'is-wide' : ''}`} key={item.label}>
                    <span>{item.label}</span>
                    {item.node || <strong>{item.value || '-'}</strong>}
                  </div>
                ))}
              </div>
            </Card>

            <div className="live-control-room-grid control-room-v2-grid">
              <section className="control-room-column">
                <Card title="直播画面与字幕" className="panel-card control-room-panel">
                  <div className="control-room-preview-shell">
                    <LivePreviewFrame
                      ratio="9:16 竖屏"
                      backgroundColor="#0ea5e9"
                      title={currentRoom.name || 'Mock 直播间'}
                      showAvatar
                      showProduct
                      showDanmu
                      showCoupon
                    />
                    <div className="control-room-live-subtitle">
                      <strong>{currentSubtitle.speaker || '数字人'}：</strong>
                      {currentSubtitle.text || currentSpeech.text || '等待字幕内容'}
                    </div>
                  </div>
                  <Descriptions column={1} size="small" className="control-room-compact-desc">
                    <Descriptions.Item label="当前数字人">{currentTask.avatarName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="当前商品组">{currentTask.productGroupName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="输出分辨率">
                      {studioOutput.resolution || '-'} / {studioOutput.fps || 0} FPS
                    </Descriptions.Item>
                  </Descriptions>
                  <Alert
                    className="control-room-alert"
                    type="warning"
                    showIcon
                    message="输出状态 Mock"
                    description={`OBS：${studioOutput.obsStatus || '-'}；执行端：${delayControl.executorStatus || '-'}；最后心跳：${studioOutput.lastHeartbeatAt || '-'}`}
                  />
                </Card>

                <Card title="当前播报" className="panel-card control-room-panel" extra={<SpeechRiskTag level={currentSpeech.riskLevel} />}>
                  <Typography.Paragraph className="control-room-current-speech">
                    {currentSpeech.text || '暂无当前播报'}
                  </Typography.Paragraph>
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="来源">{currentSpeech.source || '-'}</Descriptions.Item>
                    <Descriptions.Item label="动作">{currentSpeech.action || '-'}</Descriptions.Item>
                    <Descriptions.Item label="语气">{currentSpeech.tone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="商品">{currentSpeech.productName || currentSpeech.relatedProduct || '-'}</Descriptions.Item>
                    <Descriptions.Item label="剩余">{currentSpeech.remainingSeconds || 0} 秒</Descriptions.Item>
                    <Descriptions.Item label="风险"><SpeechRiskTag level={currentSpeech.riskLevel} /></Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="下一句字幕小预览" className="panel-card control-room-panel" extra={<SpeechRiskTag level={nextSpeech.riskLevel || nextSubtitle.riskLevel} />}>
                  <div className="control-room-next-subtitle">
                    <span>下一句</span>
                    <strong>{nextSubtitle.text || nextSpeech.text || '暂无下一句'}</strong>
                    <Space wrap size={6}>
                      <Tag color="blue">{nextSpeech.source || 'Mock'}</Tag>
                      <SpeechStatusTag status={nextSubtitle.status || nextSpeech.reviewStatus} />
                    </Space>
                  </div>
                </Card>
              </section>

              <section className="control-room-column">
                <Card
                  title="实时弹幕流"
                  className="panel-card control-room-panel"
                  extra={<Button icon={<PlusCircleOutlined />} onClick={handleSimulateComment}>模拟新弹幕</Button>}
                >
                  <Space wrap size={8} className="control-room-filter-row">
                    {commentFilters.map((item) => (
                      <Button
                        size="small"
                        type={commentFilter === item.key ? 'primary' : 'default'}
                        onClick={() => setCommentFilter(item.key)}
                        key={item.key}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Space>
                  <div className="control-room-comment-stream">
                    {filteredComments.length ? (
                      filteredComments.map((item) => (
                        <div className={`control-room-comment-card ${isHighRisk(item.riskLevel) ? 'is-risk' : ''}`} key={item.id}>
                          <div className="control-room-comment-head">
                            <Space size={6} wrap>
                              <Typography.Text strong>{item.nickname}</Typography.Text>
                              <Tag color="blue">{item.platform}</Tag>
                              <CommentTypeTag type={item.type} />
                              <RiskTag level={item.riskLevel} />
                            </Space>
                            <span>{item.time}</span>
                          </div>
                          <p>{item.content}</p>
                          <Space size={4} wrap>
                            <Button type="link" size="small" onClick={() => { updateCommentStatus(item.id, '已加入队列'); message.success('已加入问题队列 Mock'); }}>
                              加入问题队列
                            </Button>
                            <Button type="link" size="small" onClick={() => { updateCommentStatus(item.id, '已忽略'); message.info('已忽略该弹幕 Mock'); }}>
                              忽略
                            </Button>
                          </Space>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无符合条件的弹幕" />
                    )}
                  </div>
                </Card>

                <Card title="问题处理" className="panel-card control-room-panel">
                  <List
                    className="control-room-question-list"
                    dataSource={pendingQuestions}
                    locale={{ emptyText: <Empty description="暂无待处理问题" /> }}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenQuestionEdit(item)} key="edit">编辑回复</Button>,
                          <Button type="link" size="small" onClick={() => handleAddQuestionToQueue(item)} key="queue">加入待播</Button>,
                          <Button type="link" size="small" onClick={() => fillReply(getAiReply(item))} key="manual">转人工</Button>,
                          <Button type="link" size="small" onClick={() => handleIgnoreQuestion(item)} key="ignore">忽略</Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap size={6}>
                              <span>{item.question}</span>
                              <CommentTypeTag type={item.type} />
                              <RiskTag level={item.riskLevel} />
                            </Space>
                          }
                          description={
                            <div>
                              <div className="table-subtext">来源用户：{item.nickname}；关联商品：{item.relatedProduct || item.productName}</div>
                              <div className="control-room-ai-reply">{getAiReply(item)}</div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </section>

              <section className="control-room-column control-room-right-sticky">
                <Card title="人工接管" className="panel-card control-room-panel">
                  <Input.TextArea
                    rows={4}
                    value={speechText}
                    onChange={(event) => setSpeechText(event.target.value)}
                    placeholder="输入要让数字人播报的话术"
                  />
                  <div className="control-room-form-grid">
                    <Select value={tone} onChange={setTone} options={takeoverTones.map((item) => ({ label: item, value: item }))} />
                    <Select value={action} onChange={setAction} options={takeoverActions.map((item) => ({ label: item, value: item }))} />
                    <Select value={broadcastMode} onChange={setBroadcastMode} options={broadcastModes.map((item) => ({ label: item, value: item }))} />
                  </div>
                  <Space wrap>
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => handleBroadcast('立即插队 Mock')}>立即插队</Button>
                    <Button onClick={() => handleBroadcast('当前句结束后播报 Mock')}>句后播报</Button>
                    <Button icon={<SendOutlined />} onClick={() => handleBroadcast('加入待播队列 Mock')}>加入待播</Button>
                    <Button onClick={() => handleBroadcast('仅生成建议 Mock')}>仅生成建议</Button>
                  </Space>
                  {suggestion ? <Alert className="control-room-alert" type="info" showIcon message={suggestion} /> : null}
                  <Divider />
                  <List
                    size="small"
                    header="推荐回复一键填入"
                    dataSource={manualTakeover.recommendedReplies || []}
                    locale={{ emptyText: <Empty description="暂无推荐回复" /> }}
                    renderItem={(item) => (
                      <List.Item actions={[<Button type="link" size="small" onClick={() => fillReply(item)} key="fill">填入</Button>]}>
                        <Typography.Text>{item}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </Card>

                <Card title="固定播控区" className="panel-card control-room-panel">
                  <Timeline
                    className="control-room-speech-timeline"
                    items={[
                      {
                        color: 'green',
                        children: (
                          <div className="control-room-queue-item is-current">
                            <Space wrap>
                              <strong>当前播报</strong>
                              <SpeechRiskTag level={currentSpeech.riskLevel} />
                            </Space>
                            <p>{currentSpeech.text || '暂无当前播报'}</p>
                          </div>
                        ),
                      },
                      ...activeQueue.slice(0, 5).map((item, index) => ({
                        color: isHighRisk(item.riskLevel) ? 'red' : 'blue',
                        children: (
                          <div className="control-room-queue-item">
                            <Space wrap size={6}>
                              <strong>{index === 0 ? '下一句' : `后续第 ${index + 1} 句`}</strong>
                              <SpeechStatusTag status={item.reviewStatus} />
                              <SpeechRiskTag level={item.riskLevel} />
                            </Space>
                            <p>{item.text}</p>
                            <Space size={4} wrap>
                              <Tooltip title="写入本地 API Mock 状态">
                                <Button size="small" icon={<CheckOutlined />} onClick={() => handleSpeechOperation(item, 'approve')}>通过</Button>
                              </Tooltip>
                              <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenSpeechEdit(item)}>修改</Button>
                              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleSpeechOperation(item, 'delete')}>删除</Button>
                              <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleSpeechOperation(item, 'insert')}>插队</Button>
                              <Button size="small" icon={<WarningOutlined />} onClick={() => handleSpeechOperation(item, 'markRisk')}>高风险</Button>
                            </Space>
                          </div>
                        ),
                      })),
                    ]}
                  />
                </Card>

                <Card title="字幕小预览" className="panel-card control-room-panel">
                  <div className={`control-room-mini-subtitle subtitle-position-${subtitleStyle.position || 'bottom'}`}>
                    <div className="mini-subtitle-current">{currentSubtitle.text || currentSpeech.text || '当前字幕'}</div>
                    <div className="mini-subtitle-next">{nextSubtitle.text || nextSpeech.text || '下一句字幕'}</div>
                  </div>
                  <Space wrap size={6} className="control-room-mini-meta">
                    <Tag color="blue">位置：{subtitleStyle.position || '-'}</Tag>
                    <SpeechRiskTag level={nextSubtitle.riskLevel || nextSpeech.riskLevel} />
                    <SpeechStatusTag status={nextSubtitle.status || nextSpeech.reviewStatus} />
                  </Space>
                </Card>

                <Card title="风险提示" className="panel-card control-room-panel">
                  <List
                    size="small"
                    dataSource={[...(delaySettings.riskRules || []), ...(manualTakeover.riskWarnings || [])]}
                    locale={{ emptyText: <Empty description="暂无风险提示" /> }}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<ExclamationCircleOutlined className={isHighRisk(item.level) ? 'risk-icon-high' : 'risk-icon-mid'} />}
                          title={
                            <Space wrap>
                              <span>{item.name || item.type}</span>
                              <RiskTag level={item.level} />
                            </Space>
                          }
                          description={item.description || item.content}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </section>
            </div>
          </>
        ) : null}
      </Spin>

      <Modal
        title="编辑 AI 推荐回复"
        open={Boolean(editingQuestion)}
        onCancel={() => setEditingQuestion(null)}
        onOk={handleSaveQuestionEdit}
        okText="保存 Mock 回复"
      >
        <Input.TextArea rows={6} value={editingReply} onChange={(event) => setEditingReply(event.target.value)} />
      </Modal>

      <Modal
        title="修改待播话术"
        open={Boolean(editingSpeech)}
        onCancel={() => setEditingSpeech(null)}
        onOk={handleSaveSpeechEdit}
        okText="保存 Mock 修改"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            rows={5}
            value={speechDraft.text}
            onChange={(event) => setSpeechDraft((item) => ({ ...item, text: event.target.value }))}
          />
          <Select
            value={speechDraft.action}
            onChange={(value) => setSpeechDraft((item) => ({ ...item, action: value }))}
            options={speechActions.map((item) => ({ label: item, value: item }))}
            style={{ width: '100%' }}
          />
          <Select
            value={speechDraft.tone}
            onChange={(value) => setSpeechDraft((item) => ({ ...item, tone: value }))}
            options={speechTones.map((item) => ({ label: item, value: item }))}
            style={{ width: '100%' }}
          />
        </Space>
      </Modal>
    </>
  );
}
