import { CopyOutlined, EyeOutlined, PlusOutlined, ScheduleOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getAvatars } from '../../services/avatarService';
import { getLivePlatforms, getLiveRoomStatuses, getLiveRooms } from '../../services/liveService';
import { getMockProductGroups } from '../../services/productService';

const liveRooms = getLiveRooms();
const livePlatforms = getLivePlatforms();
const liveRoomStatuses = getLiveRoomStatuses();
const avatars = getAvatars();
const productGroups = getMockProductGroups();

function enabledText(enabled) {
  return enabled ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>;
}

export default function LiveRoomList() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState();
  const [status, setStatus] = useState();
  const [avatarId, setAvatarId] = useState();
  const [groupId, setGroupId] = useState();

  const filteredRooms = useMemo(
    () =>
      liveRooms.filter((room) => {
        const matchKeyword =
          !keyword || room.name.toLowerCase().includes(keyword.toLowerCase()) || room.theme.toLowerCase().includes(keyword.toLowerCase());
        const matchPlatform = !platform || room.platform === platform;
        const matchStatus = !status || room.status === status;
        const matchAvatar = !avatarId || room.avatarId === avatarId;
        const matchGroup = !groupId || room.productGroupId === groupId;
        return matchKeyword && matchPlatform && matchStatus && matchAvatar && matchGroup;
      }),
    [avatarId, groupId, keyword, platform, status],
  );

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
      width: 280,
      render: (_, record) => (
        <Space size={4} wrap>
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
            onClick={() => message.success(`已复制「${record.name}」的 Mock 配置`)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ScheduleOutlined />}
            onClick={() => message.info('创建任务为 Mock 入口，可在直播任务页继续管理')}
          >
            创建任务
          </Button>
          <Button type="link" size="small" danger={record.status === '启用中'} onClick={() => message.info('仅演示启用 / 停用状态动作')}>
            {record.status === '启用中' ? '停用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="直播间列表"
        description="管理直播间配置，串联平台账号、数字人、商品组、互动能力和延迟播控设置。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/live/rooms/create')}>
            新建直播间
          </Button>
        }
      />
      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索直播间名称或主题"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="直播平台"
            value={platform}
            onChange={setPlatform}
            options={livePlatforms.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="直播间状态"
            value={status}
            onChange={setStatus}
            options={liveRoomStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="绑定数字人"
            value={avatarId}
            onChange={setAvatarId}
            options={avatars.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="绑定商品组"
            value={groupId}
            onChange={setGroupId}
            options={productGroups.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 170 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRooms}
          pagination={{ pageSize: 6, showTotal: (total) => `共 ${total} 个直播间` }}
          scroll={{ x: 1600 }}
        />
      </Card>
    </>
  );
}
