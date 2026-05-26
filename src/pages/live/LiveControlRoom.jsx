import {
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Input,
  List,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { useMemo, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import StatusTag from '../../components/StatusTag';
import { comments } from '../../mock/comments';
import { broadcastModes, manualTakeover, takeoverActions, takeoverTones } from '../../mock/manualTakeover';
import { questions } from '../../mock/questions';
import { liveRooms } from '../../mock/liveRooms';
import { liveTasks } from '../../mock/liveTasks';
import { studioOutput } from '../../mock/studioOutput';

function findCurrentTask() {
  return liveTasks.find((task) => task.status === '直播中') || liveTasks[0];
}

export default function LiveControlRoom() {
  const currentTask = findCurrentTask();
  const currentRoom = liveRooms.find((room) => room.id === currentTask.liveRoomId) || liveRooms[0];
  const [speechText, setSpeechText] = useState('');
  const [tone, setTone] = useState('亲切');
  const [action, setAction] = useState('看评论区');
  const [broadcastMode, setBroadcastMode] = useState('立即插队 Mock');

  const highRiskComments = useMemo(() => comments.filter((item) => item.riskLevel === '高'), []);
  const middleRiskComments = useMemo(() => comments.filter((item) => item.riskLevel !== '低'), []);
  const pendingQuestions = useMemo(() => questions.filter((item) => ['待处理', '已推荐', '高风险待人工'].includes(item.status)).slice(0, 5), []);
  const queuedSpeech = manualTakeover.upcomingSpeech.slice(0, 3);

  const handleBroadcast = (mode = broadcastMode) => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }
    message.success(`${mode} 已触发，仅为 Mock，不调用真实数字人播报`);
  };

  const fillReply = (reply) => {
    setSpeechText(reply);
    message.info('已填入人工输入框');
  };

  const commentColumns = [
    {
      title: '弹幕',
      dataIndex: 'content',
      render: (value, record) => (
        <div className={record.riskLevel === '高' ? 'control-room-risk-row' : undefined}>
          <Space size={6} wrap>
            <Typography.Text strong>{record.nickname}</Typography.Text>
            <CommentTypeTag type={record.type} />
            <RiskTag level={record.riskLevel} />
          </Space>
          <div className="control-room-comment-text">{value}</div>
          <Space size={4} wrap>
            <Button type="link" size="small" onClick={() => message.success('已加入问题队列 Mock')}>
              加入问题队列
            </Button>
            <Button type="link" size="small" onClick={() => message.info('已忽略该弹幕 Mock')}>
              忽略
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="直播中控台"
        description="直播过程中的一站式操作台，聚合直播画面、弹幕、问题队列、人工接管、待播预览、风险提示和输出状态。当前全部为 Mock。"
        extra={
          <Space wrap>
            <Badge status="processing" text="直播中控 Mock" />
            <Button icon={<PauseCircleOutlined />} onClick={() => message.info('暂停直播为 Mock 操作')}>
              暂停 Mock
            </Button>
          </Space>
        }
      />

      <Card className="panel-card live-status-bar">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} xl={6}>
            <div className="status-bar-item">
              <span>当前直播任务</span>
              <strong>{currentTask.taskName}</strong>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <div className="status-bar-item">
              <span>当前直播间</span>
              <strong>{currentRoom.name}</strong>
            </div>
          </Col>
          <Col xs={12} sm={8} xl={3}>
            <div className="status-bar-item">
              <span>平台</span>
              <Tag color="blue">{currentTask.platform}</Tag>
            </div>
          </Col>
          <Col xs={12} sm={8} xl={3}>
            <div className="status-bar-item">
              <span>当前数字人</span>
              <strong>{currentTask.avatarName}</strong>
            </div>
          </Col>
          <Col xs={12} sm={8} xl={3}>
            <div className="status-bar-item">
              <span>商品组</span>
              <strong>{currentTask.productGroupName}</strong>
            </div>
          </Col>
          <Col xs={12} sm={8} xl={2}>
            <div className="status-bar-item">
              <span>执行端</span>
              <StatusTag status={manualTakeover.executorStatus} />
            </div>
          </Col>
          <Col xs={12} sm={8} xl={2}>
            <div className="status-bar-item">
              <span>OBS</span>
              <StatusTag status={studioOutput.obsStatus} />
            </div>
          </Col>
          <Col xs={12} sm={8} xl={1}>
            <div className="status-bar-item">
              <span>风险</span>
              <Tag color={highRiskComments.length ? 'red' : 'green'}>{middleRiskComments.length}</Tag>
            </div>
          </Col>
        </Row>
      </Card>

      <div className="live-control-room-grid">
        <section className="control-room-column">
          <Card title="直播画面预览" className="panel-card control-room-panel">
            <LivePreviewFrame
              ratio="9:16 竖屏"
              backgroundColor="#0ea5e9"
              title={currentRoom.name}
              showAvatar
              showProduct
              showDanmu
              showCoupon
            />
            <Divider />
            <Descriptions column={1} size="small">
              <Descriptions.Item label="当前数字人">{currentTask.avatarName}</Descriptions.Item>
              <Descriptions.Item label="当前商品组">{currentTask.productGroupName}</Descriptions.Item>
              <Descriptions.Item label="当前讲解商品">{comments[0]?.productName || '舟山海鲜礼盒'}</Descriptions.Item>
              <Descriptions.Item label="输出分辨率">
                {studioOutput.resolution} / {studioOutput.fps} FPS
              </Descriptions.Item>
            </Descriptions>
            <Alert
              className="control-room-alert"
              type="warning"
              showIcon
              message="OBS / 输出状态 Mock"
              description={`当前 OBS 状态：${studioOutput.obsStatus}，最后心跳：${studioOutput.lastHeartbeatAt}`}
            />
          </Card>
        </section>

        <section className="control-room-column">
          <Card title="实时弹幕流" className="panel-card control-room-panel">
            <Table
              rowKey="id"
              columns={commentColumns}
              dataSource={comments.slice(0, 8)}
              pagination={false}
              scroll={{ y: 360 }}
              showHeader={false}
            />
          </Card>

          <Card title="当前待处理问题" className="panel-card control-room-panel">
            <List
              dataSource={pendingQuestions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => message.success('已加入待播队列 Mock')} key="queue">
                      加入待播
                    </Button>,
                    <Button type="link" size="small" onClick={() => message.info('已忽略问题 Mock')} key="ignore">
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
                    description={item.aiReply || '待生成 Mock 推荐回复'}
                  />
                </List.Item>
              )}
            />
          </Card>
        </section>

        <section className="control-room-column">
          <Card title="人工接管" className="panel-card control-room-panel">
            <Input.TextArea
              rows={5}
              value={speechText}
              onChange={(event) => setSpeechText(event.target.value)}
              placeholder="输入要让数字人播报的话术"
            />
            <div className="control-room-form-grid">
              <Select value={tone} onChange={setTone} options={takeoverTones.map((item) => ({ label: item, value: item }))} />
              <Select value={action} onChange={setAction} options={takeoverActions.map((item) => ({ label: item, value: item }))} />
              <Select value={broadcastMode} onChange={setBroadcastMode} options={broadcastModes.slice(0, 3).map((item) => ({ label: item, value: item }))} />
            </div>
            <Space wrap>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => handleBroadcast('立即插队 Mock')}>
                立即插队
              </Button>
              <Button icon={<SendOutlined />} onClick={() => handleBroadcast('加入待播队列 Mock')}>
                加入待播队列
              </Button>
            </Space>
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

          <Card title="待播预览" className="panel-card control-room-panel">
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div className="speech-preview-item">
                      <strong>当前播报</strong>
                      <p>{manualTakeover.currentSpeech}</p>
                    </div>
                  ),
                },
                {
                  color: 'blue',
                  children: (
                    <div className="speech-preview-item">
                      <strong>下一句话</strong>
                      <p>{manualTakeover.nextSpeech}</p>
                    </div>
                  ),
                },
                ...queuedSpeech.map((item) => ({
                  color: item.riskLevel === '中' ? 'orange' : 'gray',
                  children: (
                    <div className="speech-preview-item">
                      <Space wrap>
                        <strong>{item.status}</strong>
                        <RiskTag level={item.riskLevel} />
                      </Space>
                      <p>{item.content}</p>
                      <Space size={4} wrap>
                        <Button size="small" icon={<CheckOutlined />} onClick={() => message.success('已通过 Mock')}>
                          通过
                        </Button>
                        <Button size="small" icon={<DeleteOutlined />} onClick={() => message.info('已删除待播 Mock')}>
                          删除待播
                        </Button>
                      </Space>
                    </div>
                  ),
                })),
              ]}
            />
          </Card>

          <Card title="风险提示" className="panel-card control-room-panel">
            <List
              size="small"
              dataSource={manualTakeover.riskWarnings}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<ExclamationCircleOutlined className={item.level === '高' ? 'risk-icon-high' : 'risk-icon-mid'} />}
                    title={
                      <Space wrap>
                        <span>{item.type}</span>
                        <RiskTag level={item.level} />
                      </Space>
                    }
                    description={item.content}
                  />
                </List.Item>
              )}
            />
          </Card>
        </section>
      </div>
    </>
  );
}
