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
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useMemo, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import StatusTag from '../../components/StatusTag';
import { comments } from '../../mock/comments';
import { delayControl, speechActions, speechTones } from '../../mock/delayControl';
import { delaySettings } from '../../mock/delaySettings';
import { broadcastModes, manualTakeover, takeoverActions, takeoverTones } from '../../mock/manualTakeover';
import { aiReplyTemplates, questions } from '../../mock/questions';
import { speechQueue } from '../../mock/speechQueue';
import { liveRooms } from '../../mock/liveRooms';
import { liveTasks } from '../../mock/liveTasks';
import { studioOutput } from '../../mock/studioOutput';
import { subtitles } from '../../mock/subtitles';

const commentFilters = [
  { key: 'all', label: '全部' },
  { key: 'questions', label: '仅看问题' },
  { key: 'risk', label: '仅看高风险' },
  { key: 'pending', label: '未处理' },
];

function findCurrentTask() {
  return liveTasks.find((task) => task.status === '直播中') || liveTasks[0];
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function getAiReply(question) {
  return question.aiReply || aiReplyTemplates[question.type] || '这是 Mock 推荐回复，后续可接入真实 AI 服务前置审核。';
}

export default function LiveControlRoom() {
  const currentTask = findCurrentTask();
  const currentRoom = liveRooms.find((room) => room.id === currentTask.liveRoomId) || liveRooms[0];

  const [commentList, setCommentList] = useState(comments);
  const [commentFilter, setCommentFilter] = useState('all');
  const [questionList, setQuestionList] = useState(questions);
  const [queue, setQueue] = useState(speechQueue);
  const [speechText, setSpeechText] = useState('');
  const [tone, setTone] = useState('亲切');
  const [action, setAction] = useState('看评论区');
  const [broadcastMode, setBroadcastMode] = useState('立即插队 Mock');
  const [suggestion, setSuggestion] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingReply, setEditingReply] = useState('');
  const [editingSpeech, setEditingSpeech] = useState(null);
  const [speechDraft, setSpeechDraft] = useState({ text: '', action: '回到镜头', tone: '专业' });

  const unhandledComments = useMemo(
    () => commentList.filter((item) => ['待处理', '待人工'].includes(item.replyStatus)),
    [commentList],
  );
  const highRiskComments = useMemo(() => commentList.filter((item) => item.riskLevel === '高'), [commentList]);
  const pendingQuestions = useMemo(
    () => questionList.filter((item) => ['待处理', '已推荐', '已编辑', '高风险待人工'].includes(item.status)),
    [questionList],
  );
  const activeQueue = useMemo(
    () => queue.filter((item) => item.reviewStatus !== '已删除').sort((a, b) => a.order - b.order),
    [queue],
  );
  const pendingReviewSpeech = useMemo(
    () => activeQueue.filter((item) => ['待审核', '高风险待人工', '已修改'].includes(item.reviewStatus)),
    [activeQueue],
  );

  const filteredComments = useMemo(
    () =>
      commentList.filter((item) => {
        if (commentFilter === 'questions') {
          return !['闲聊互动', '恶意评论'].includes(item.type);
        }
        if (commentFilter === 'risk') {
          return item.riskLevel !== '低';
        }
        if (commentFilter === 'pending') {
          return ['待处理', '待人工'].includes(item.replyStatus);
        }
        return true;
      }),
    [commentFilter, commentList],
  );

  const liveStatusItems = [
    { label: '当前直播任务', value: currentTask.taskName, wide: true },
    { label: '当前直播间', value: currentRoom.name, wide: true },
    { label: '平台', node: <Tag color="blue">{currentTask.platform}</Tag> },
    { label: '当前数字人', value: currentTask.avatarName, wide: true },
    { label: '当前商品组', value: currentTask.productGroupName, wide: true },
    { label: '执行端', node: <StatusTag status={delayControl.executorStatus} /> },
    { label: 'OBS', node: <StatusTag status={studioOutput.obsStatus} /> },
    { label: '延迟模式', node: <Tag color="geekblue">{delayControl.delayMode}</Tag> },
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

  const handleSimulateComment = () => {
    const source = comments[commentList.length % comments.length];
    const newComment = {
      ...source,
      id: `SIM${Date.now()}`,
      nickname: `${source.nickname}-模拟`,
      time: nowTime(),
      replyStatus: '待处理',
    };
    setCommentList((items) => [newComment, ...items]);
    message.success('已追加一条 Mock 弹幕，不连接真实 WebSocket');
  };

  const handleOpenQuestionEdit = (question) => {
    setEditingQuestion(question);
    setEditingReply(getAiReply(question));
  };

  const handleSaveQuestionEdit = () => {
    if (!editingQuestion) return;
    updateQuestion(editingQuestion.id, { aiReply: editingReply, status: '已编辑' });
    setEditingQuestion(null);
    setEditingReply('');
    message.success('已保存 Mock 推荐回复');
  };

  const handleBroadcast = (mode = broadcastMode) => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }
    if (mode === '仅生成建议 Mock') {
      setSuggestion(`建议话术：${speechText}。播出前请确认价格、售后和绝对化表述风险。`);
      message.success('已生成 Mock 建议，不调用真实 AI');
      return;
    }
    setSuggestion('');
    message.success(`${mode} 已触发，仅为 Mock，不调用真实数字人播报`);
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

  const handleSaveSpeechEdit = () => {
    if (!editingSpeech) return;
    updateSpeech(editingSpeech.id, { ...speechDraft, reviewStatus: '已修改' });
    setEditingSpeech(null);
    message.success('已保存待播内容 Mock 修改');
  };

  return (
    <>
      <PageHeader
        title="直播中控台"
        description="直播中控台用于直播进行中的一屏操作，聚合直播预览、弹幕、问题、人工接管、待播队列和风险提示。当前全部为 Mock。"
        extra={
          <Space wrap>
            <Badge status="processing" text="直播中控 v2 Mock" />
            <Button icon={<PauseCircleOutlined />} onClick={() => message.info('暂停直播为 Mock 操作')}>
              暂停 Mock
            </Button>
          </Space>
        }
      />

      <Card className="panel-card live-status-bar control-room-status-card">
        <div className="control-room-status-grid">
          {liveStatusItems.map((item) => (
            <div className={`control-room-status-item ${item.wide ? 'is-wide' : ''}`} key={item.label}>
              <span>{item.label}</span>
              {item.node || <strong>{item.value}</strong>}
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
                title={currentRoom.name}
                showAvatar
                showProduct
                showDanmu
                showCoupon
              />
              <div className="control-room-live-subtitle">
                <strong>{subtitles.currentSubtitle.speaker}：</strong>
                {subtitles.currentSubtitle.text}
              </div>
            </div>
            <Descriptions column={1} size="small" className="control-room-compact-desc">
              <Descriptions.Item label="当前数字人">{currentTask.avatarName}</Descriptions.Item>
              <Descriptions.Item label="当前商品组">{currentTask.productGroupName}</Descriptions.Item>
              <Descriptions.Item label="输出分辨率">
                {studioOutput.resolution} / {studioOutput.fps} FPS
              </Descriptions.Item>
            </Descriptions>
            <Alert
              className="control-room-alert"
              type="warning"
              showIcon
              message="输出状态 Mock"
              description={`OBS：${studioOutput.obsStatus}；执行端：${delayControl.executorStatus}；最后心跳：${studioOutput.lastHeartbeatAt}`}
            />
          </Card>

          <Card
            title="当前播报"
            className="panel-card control-room-panel"
            extra={<SpeechRiskTag level={delayControl.currentSpeech.riskLevel} />}
          >
            <Typography.Paragraph className="control-room-current-speech">
              {delayControl.currentSpeech.text}
            </Typography.Paragraph>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="来源">{delayControl.currentSpeech.source}</Descriptions.Item>
              <Descriptions.Item label="动作">{delayControl.currentSpeech.action}</Descriptions.Item>
              <Descriptions.Item label="语气">{delayControl.currentSpeech.tone}</Descriptions.Item>
              <Descriptions.Item label="商品">{delayControl.currentSpeech.productName}</Descriptions.Item>
              <Descriptions.Item label="剩余">{delayControl.currentSpeech.remainingSeconds} 秒</Descriptions.Item>
              <Descriptions.Item label="风险">
                <SpeechRiskTag level={delayControl.currentSpeech.riskLevel} />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title="下一句字幕小预览"
            className="panel-card control-room-panel"
            extra={<SpeechRiskTag level={delayControl.nextSpeech.riskLevel} />}
          >
            <div className="control-room-next-subtitle">
              <span>下一句</span>
              <strong>{subtitles.nextSubtitle.text}</strong>
              <Space wrap size={6}>
                <Tag color="blue">{delayControl.nextSpeech.source}</Tag>
                <SpeechStatusTag status={subtitles.nextSubtitle.status} />
              </Space>
            </div>
          </Card>
        </section>

        <section className="control-room-column">
          <Card
            title="实时弹幕流"
            className="panel-card control-room-panel"
            extra={
              <Button icon={<PlusCircleOutlined />} onClick={handleSimulateComment}>
                模拟新弹幕
              </Button>
            }
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
                  <div
                    className={`control-room-comment-card ${item.riskLevel === '高' ? 'is-risk' : ''}`}
                    key={item.id}
                  >
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
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          updateCommentStatus(item.id, '已加入队列');
                          message.success('已加入问题队列 Mock');
                        }}
                      >
                        加入问题队列
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          updateCommentStatus(item.id, '已忽略');
                          message.info('已忽略该弹幕 Mock');
                        }}
                      >
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
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenQuestionEdit(item)} key="edit">
                      编辑回复
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        updateQuestion(item.id, { status: '已加入待播' });
                        message.success('已加入待播队列 Mock，不写入后端');
                      }}
                      key="queue"
                    >
                      加入待播
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        fillReply(getAiReply(item));
                        message.info('已转入人工接管输入框');
                      }}
                      key="manual"
                    >
                      转人工
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        updateQuestion(item.id, { status: '已忽略' });
                        message.info('已忽略问题 Mock');
                      }}
                      key="ignore"
                    >
                      忽略
                    </Button>,
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
                        <div className="table-subtext">来源用户：{item.nickname}；关联商品：{item.relatedProduct}</div>
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
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => handleBroadcast('立即插队 Mock')}>
                立即插队
              </Button>
              <Button onClick={() => handleBroadcast('当前句结束后播报 Mock')}>句后播报</Button>
              <Button icon={<SendOutlined />} onClick={() => handleBroadcast('加入待播队列 Mock')}>
                加入待播
              </Button>
              <Button onClick={() => handleBroadcast('仅生成建议 Mock')}>仅生成建议</Button>
            </Space>
            {suggestion ? <Alert className="control-room-alert" type="info" showIcon message={suggestion} /> : null}
            <Divider />
            <List
              size="small"
              header="推荐回复一键填入"
              dataSource={manualTakeover.recommendedReplies}
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
                        <SpeechRiskTag level={delayControl.currentSpeech.riskLevel} />
                      </Space>
                      <p>{delayControl.currentSpeech.text}</p>
                    </div>
                  ),
                },
                ...activeQueue.slice(1, 6).map((item, index) => ({
                  color: item.riskLevel === '高' ? 'red' : item.riskLevel === '中' ? 'orange' : 'blue',
                  children: (
                    <div className="control-room-queue-item">
                      <Space wrap size={6}>
                        <strong>{index === 0 ? '下一句' : `后续第 ${index + 1} 句`}</strong>
                        <SpeechStatusTag status={item.reviewStatus} />
                        <SpeechRiskTag level={item.riskLevel} />
                      </Space>
                      <p>{item.text}</p>
                      <Space size={4} wrap>
                        <Tooltip title="仅更新前端 Mock 状态">
                          <Button size="small" icon={<CheckOutlined />} onClick={() => { updateSpeech(item.id, { reviewStatus: '已通过' }); message.success('已通过 Mock'); }}>
                            通过
                          </Button>
                        </Tooltip>
                        <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenSpeechEdit(item)}>
                          修改
                        </Button>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { updateSpeech(item.id, { reviewStatus: '已删除' }); message.info('已删除待播 Mock'); }}>
                          删除
                        </Button>
                        <Button size="small" icon={<ThunderboltOutlined />} onClick={() => { updateSpeech(item.id, { reviewStatus: '即将播出' }); message.success('已插队 Mock'); }}>
                          插队
                        </Button>
                        <Button size="small" icon={<WarningOutlined />} onClick={() => { updateSpeech(item.id, { riskLevel: '高', reviewStatus: '高风险待人工' }); message.warning('已标记高风险 Mock'); }}>
                          高风险
                        </Button>
                      </Space>
                    </div>
                  ),
                })),
              ]}
            />
          </Card>

          <Card title="字幕小预览" className="panel-card control-room-panel">
            <div className={`control-room-mini-subtitle subtitle-position-${subtitles.subtitleStyle.position}`}>
              <div className="mini-subtitle-current">{subtitles.currentSubtitle.text}</div>
              <div className="mini-subtitle-next">{subtitles.nextSubtitle.text}</div>
            </div>
            <Space wrap size={6} className="control-room-mini-meta">
              <Tag color="blue">位置：{subtitles.subtitleStyle.position}</Tag>
              <SpeechRiskTag level={subtitles.nextSubtitle.riskLevel} />
              <SpeechStatusTag status={subtitles.nextSubtitle.status} />
            </Space>
          </Card>

          <Card title="风险提示" className="panel-card control-room-panel">
            <List
              size="small"
              dataSource={[...delaySettings.riskRules, ...manualTakeover.riskWarnings]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<ExclamationCircleOutlined className={item.level === '高' ? 'risk-icon-high' : 'risk-icon-mid'} />}
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
