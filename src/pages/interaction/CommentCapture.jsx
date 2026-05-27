import { BellOutlined, PlusCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Empty, Input, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import StatusTag from '../../components/StatusTag';
import {
  getCommentConnection,
  getCommentTypes,
  getComments,
  getInteractionLiveRooms,
  getRiskLevels,
  simulateComment,
} from '../../services/interactionService';

const commentConnection = getCommentConnection();
const commentTypes = getCommentTypes();
const interactionLiveRooms = getInteractionLiveRooms();
const riskLevels = getRiskLevels();

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export default function CommentCapture() {
  const [commentList, setCommentList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(interactionLiveRooms[0]?.value);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState();
  const [riskLevel, setRiskLevel] = useState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentRoomInfo = interactionLiveRooms.find((room) => room.value === currentRoom) || interactionLiveRooms[0];

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getComments({
        liveRoomId: currentRoom,
        type,
        riskLevel,
        page: 1,
        pageSize: 100,
      });

      setCommentList(data.list || []);
    } catch (requestError) {
      const messageText = requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [currentRoom, riskLevel, type]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const filteredComments = useMemo(
    () =>
      commentList.filter((item) => {
        const keywordText = keyword.toLowerCase();
        const matchKeyword =
          !keyword ||
          (item.nickname || '').toLowerCase().includes(keywordText) ||
          (item.content || '').toLowerCase().includes(keywordText) ||
          (item.productName || '').toLowerCase().includes(keywordText);
        return matchKeyword;
      }),
    [commentList, keyword],
  );

  const questionCount = commentList.filter((item) => !['闲聊互动', '恶意评论'].includes(item.type)).length;
  const highRiskCount = commentList.filter((item) => item.riskLevel === '高').length;

  const updateReplyStatus = (id, replyStatus) => {
    setCommentList((items) => items.map((item) => (item.id === id ? { ...item, replyStatus } : item)));
  };

  const handleSimulateComment = async () => {
    try {
      const newComment = await simulateComment({
        liveRoomId: currentRoom,
        time: nowTime(),
      });

      setCommentList((items) => [newComment, ...items]);
      message.success('已通过本地 API 追加 1 条 Mock 弹幕，不连接真实 WebSocket');
    } catch (requestError) {
      message.error(requestError.message || 'Mock 弹幕追加失败');
    }
  };

  const columns = [
    {
      title: '用户昵称',
      dataIndex: 'nickname',
      width: 130,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '弹幕内容',
      dataIndex: 'content',
      width: 260,
      render: (value, record) => (
        <div>
          <Typography.Text>{value}</Typography.Text>
          <div className="table-subtext">关联：{record.productName || '未关联商品'}</div>
        </div>
      ),
    },
    { title: '来源平台', dataIndex: 'platform', width: 100 },
    { title: '评论时间', dataIndex: 'time', width: 100 },
    { title: '识别类型', dataIndex: 'type', width: 120, render: (value) => <CommentTypeTag type={value} /> },
    { title: '风险等级', dataIndex: 'riskLevel', width: 110, render: (value) => <RiskTag level={value} /> },
    { title: '回复状态', dataIndex: 'replyStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    {
      title: '操作',
      fixed: 'right',
      width: 230,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            onClick={() => {
              updateReplyStatus(record.id, '已加入队列');
              message.success('已加入问题队列 Mock');
            }}
          >
            加入问题队列
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              updateReplyStatus(record.id, '已忽略');
              message.info('已忽略该弹幕 Mock');
            }}
          >
            忽略
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<StopOutlined />}
            onClick={() =>
              Modal.confirm({
                title: '拉黑用户 Mock',
                content: `确认将“${record.nickname}”加入 Mock 黑名单？当前不会写入任何真实系统。`,
                okText: '确认',
                cancelText: '取消',
                onOk: () => message.warning('已触发拉黑 Mock 提示'),
              })
            }
          >
            拉黑
          </Button>
        </Space>
      ),
    },
  ];

  const renderTable = (dataSource) => (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条弹幕` }}
      scroll={{ x: 1280 }}
      locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的弹幕'} /> }}
    />
  );

  return (
    <>
      <PageHeader
        title="弹幕捕获"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。当前弹幕列表通过本地 API 读取 SQLite，仍不连接真实直播平台或 WebSocket。"
        extra={
          <Space wrap>
            <Select value={currentRoom} onChange={setCurrentRoom} options={interactionLiveRooms} style={{ width: 220 }} />
            <Badge status="success" text={`弹幕连接状态：${commentConnection.status}`} />
          </Space>
        }
      />

      {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}

      <div className="interaction-stat-grid">
        <DataCard title="当前直播间" value={currentRoomInfo?.label || '-'} helper={`来源平台：${currentRoomInfo?.platform || '-'}`} tone="blue" />
        <DataCard title="弹幕连接状态" value={commentConnection.status} helper={`心跳：${commentConnection.lastHeartbeatAt}`} tone="teal" status="已连接" />
        <DataCard title="今日捕获弹幕数" value={commentList.length} helper="来自本地 API + SQLite Mock 数据" tone="amber" />
        <DataCard title="已识别问题数" value={questionCount} helper="价格 / 物流 / 售后 / 优惠等" tone="blue" />
        <DataCard title="高风险评论数" value={highRiskCount} helper="需要人工确认后再处理" tone="rose" />
      </div>

      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索昵称、弹幕内容或关联商品"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <Select
            allowClear
            placeholder="识别类型"
            value={type}
            onChange={setType}
            options={commentTypes.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="风险等级"
            value={riskLevel}
            onChange={setRiskLevel}
            options={riskLevels.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleSimulateComment}>
            模拟新弹幕
          </Button>
        </div>
        <Tabs
          items={[
            { key: 'all', label: '全部弹幕', children: renderTable(filteredComments) },
            {
              key: 'questions',
              label: '问题识别',
              children: renderTable(filteredComments.filter((item) => !['闲聊互动', '恶意评论'].includes(item.type))),
            },
            {
              key: 'risk',
              label: (
                <Space size={6}>
                  <BellOutlined />
                  风险评论
                </Space>
              ),
              children: renderTable(filteredComments.filter((item) => item.riskLevel !== '低')),
            },
          ]}
        />
      </Card>
    </>
  );
}
