import { CopyOutlined, EyeOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getAvatars } from '../../services/avatarService';
import { activateLiveRoom, createLiveRoom, getLivePlatforms, getLiveRoomStatuses, getLiveRooms, updateLiveRoom } from '../../services/liveService';
import { getProductGroups } from '../../services/productService';

const livePlatforms = getLivePlatforms();
const liveRoomStatuses = getLiveRoomStatuses();

function enabledText(enabled) {
  return enabled ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>;
}

export default function LiveRoomList() {
  const navigate = useNavigate();
  const [liveRooms, setLiveRooms] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState();
  const [status, setStatus] = useState();
  const [avatarId, setAvatarId] = useState();
  const [groupId, setGroupId] = useState();
  const [activatingRoomId, setActivatingRoomId] = useState('');
  const [duplicatingRoomId, setDuplicatingRoomId] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 6, total: 0 });

  const fetchLiveRooms = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [roomData, avatarData, groupData] = await Promise.all([
        getLiveRooms({
          keyword,
          platform,
          status,
          avatarId,
          productGroupId: groupId,
          page: pagination.current,
          pageSize: pagination.pageSize,
        }),
        getAvatars({ pageSize: 100 }),
        getProductGroups({ pageSize: 100 }),
      ]);

      setLiveRooms(roomData.list || []);
      setAvatars(avatarData.list || []);
      setProductGroups(groupData.list || []);
      setPagination((current) => ({
        ...current,
        current: roomData.page || current.current,
        pageSize: roomData.pageSize || current.pageSize,
        total: roomData.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '直播间列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [avatarId, groupId, keyword, pagination.current, pagination.pageSize, platform, status]);

  useEffect(() => {
    fetchLiveRooms();
  }, [fetchLiveRooms]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleToggleStatus = async (record) => {
    const nextStatus = record.status === '启用中' ? '停用' : '启用中';

    try {
      await updateLiveRoom(record.id, { ...record, status: nextStatus });
      message.success(`已${nextStatus === '启用中' ? '启用' : '停用'}「${record.name}」`);
      fetchLiveRooms();
    } catch (requestError) {
      message.error(requestError.message || '直播间状态更新失败');
    }
  };

  const handleActivateRoom = async (record) => {
    try {
      setActivatingRoomId(record.id);
      const result = await activateLiveRoom(record.id);
      message.success(result.message || `已启用「${record.name}」`);
      navigate(result.redirectUrl || '/live/control-room');
    } catch (requestError) {
      message.error(requestError.message || '启用直播间失败');
    } finally {
      setActivatingRoomId('');
    }
  };

  const handleDuplicateRoom = async (record) => {
    try {
      setDuplicatingRoomId(record.id);
      const duplicated = await createLiveRoom({
        name: `${record.name} 副本`,
        theme: record.theme,
        notes: record.notes || '',
        platform: record.platform,
        platformAccount: record.platformAccount || '',
        avatarId: record.avatarId,
        avatarName: record.avatarName,
        productGroupId: record.productGroupId,
        productGroupName: record.productGroupName,
        sceneName: record.sceneName,
        layoutType: record.layoutType,
        danmuEnabled: record.danmuEnabled,
        aiReplyEnabled: record.aiReplyEnabled,
        manualTakeoverEnabled: record.manualTakeoverEnabled,
        delayControlEnabled: record.delayControlEnabled,
        delaySeconds: record.delaySeconds,
        status: '草稿',
      });
      message.success(`已创建「${duplicated.name}」`);
      fetchLiveRooms();
    } catch (requestError) {
      message.error(requestError.message || '复制直播间失败');
    } finally {
      setDuplicatingRoomId('');
    }
  };

  const columns = [
    {
      title: '直播间名称',
      dataIndex: 'name',
      width: 220,
      render: (name, record) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <div className="table-subtext">{record.theme}</div>
        </div>
      ),
    },
    { title: '直播平台', dataIndex: 'platform', width: 110, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '绑定数字人', dataIndex: 'avatarName', width: 160 },
    { title: '绑定商品组', dataIndex: 'productGroupName', width: 150 },
    { title: '直播间场景', dataIndex: 'sceneName', width: 150 },
    { title: '弹幕互动', dataIndex: 'danmuEnabled', width: 110, render: enabledText },
    { title: '延迟播控', dataIndex: 'delayControlEnabled', width: 110, render: enabledText },
    { title: '当前状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={value} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type={record.status === '启用中' ? 'primary' : 'link'}
            size="small"
            icon={<PlayCircleOutlined />}
            loading={activatingRoomId === record.id}
            onClick={() => handleActivateRoom(record)}
          >
            {record.status === '启用中' ? '进入中控' : '启用并进入'}
          </Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/live/rooms/${record.id}/edit`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/live/rooms/${record.id}/edit`)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            loading={duplicatingRoomId === record.id}
            onClick={() => handleDuplicateRoom(record)}
          >
            复制
          </Button>
          {record.status === '启用中' ? (
            <Button type="link" size="small" danger onClick={() => handleToggleStatus(record)}>
              停用
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="直播间列表"
        description="本机演示以直播间作为开播入口：同一时间只启用一场直播，点击启用后会自动进入本场直播中控台。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/live/rooms/create')}>
            新建直播间
          </Button>
        }
      />
      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <Alert
          className="placeholder-hint"
          type="info"
          showIcon
          message="当前流程：选择一个直播间，启用后进入直播中控台"
          description="直播任务页后续会更适合作为计划/历史记录；本机版开播入口先统一收敛到直播间列表。"
        />
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索直播间名称或主题"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="直播平台"
            value={platform}
            onChange={(value) => resetToFirstPage(() => setPlatform(value))}
            options={livePlatforms.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="直播间状态"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={liveRoomStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="绑定数字人"
            value={avatarId}
            onChange={(value) => resetToFirstPage(() => setAvatarId(value))}
            options={avatars.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="绑定商品组"
            value={groupId}
            onChange={(value) => resetToFirstPage(() => setGroupId(value))}
            options={productGroups.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 170 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={liveRooms}
          loading={loading}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无直播间数据'} /> }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个直播间`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1600 }}
        />
      </Card>
    </>
  );
}
