import { CopyOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getAvatarCategories, getAvatarStatuses, getAvatars, getVoiceOptions } from '../../services/avatarService';

const avatarCategories = getAvatarCategories();
const avatarStatuses = getAvatarStatuses();
const voiceOptions = getVoiceOptions();

function AvatarPreview({ avatar }) {
  return (
    <div className={`avatar-thumb avatar-thumb-${avatar.avatarImage}`}>
      <span>{avatar.name.slice(0, 2)}</span>
    </div>
  );
}

export default function AvatarList() {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [category, setCategory] = useState();
  const [voice, setVoice] = useState();
  const [testingAvatar, setTestingAvatar] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 6, total: 0 });

  const fetchAvatars = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getAvatars({
        keyword,
        status,
        category,
        voiceName: voice,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setAvatars(data.list || []);
      setPagination((current) => ({
        ...current,
        current: data.page || current.current,
        pageSize: data.pageSize || current.pageSize,
        total: data.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '数字人列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [category, keyword, pagination.current, pagination.pageSize, status, voice]);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleDelete = (avatar) => {
    Modal.confirm({
      title: '删除数字人（Mock）',
      content: `确认删除「${avatar.name}」吗？本阶段不会真实删除数据。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => message.success('已触发 Mock 删除提示，未修改数据'),
    });
  };

  const columns = [
    {
      title: '形象预览',
      dataIndex: 'avatarImage',
      width: 100,
      render: (_, record) => <AvatarPreview avatar={record} />,
    },
    {
      title: '数字人名称',
      dataIndex: 'name',
      width: 180,
      render: (name, record) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <div className="table-subtext">{record.languageStyle}</div>
        </div>
      ),
    },
    {
      title: '人设定位',
      dataIndex: 'persona',
      width: 260,
      ellipsis: true,
    },
    {
      title: '适合品类',
      dataIndex: 'suitableCategories',
      width: 220,
      render: (items) => (
        <Space size={4} wrap>
          {(items || []).map((item) => (
            <Tag color="blue" key={item}>
              {item}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '绑定音色',
      dataIndex: 'voiceName',
      width: 130,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <StatusTag status={value} />,
    },
    {
      title: '已绑定直播间',
      dataIndex: 'boundLiveRooms',
      width: 120,
      render: (value) => `${value} 个`,
      sorter: (a, b) => a.boundLiveRooms - b.boundLiveRooms,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/avatar/${record.id}/edit`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/avatar/${record.id}/edit`)}>
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
          <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => setTestingAvatar(record)}>
            测试
          </Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="数字人列表"
        description="管理数字人资产、形象状态、绑定音色和适合品类，当前通过本地 API 读取 SQLite 数据。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/avatar/create')}>
            新建数字人
          </Button>
        }
      />
      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索数字人名称或人设"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={avatarStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="适合品类筛选"
            value={category}
            onChange={(value) => resetToFirstPage(() => setCategory(value))}
            options={avatarCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="绑定音色筛选"
            value={voice}
            onChange={(value) => resetToFirstPage(() => setVoice(value))}
            options={voiceOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={avatars}
          loading={loading}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无数字人数据'} /> }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个数字人`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1480 }}
        />
      </Card>
      <Modal
        title="数字人测试（Mock）"
        open={Boolean(testingAvatar)}
        onCancel={() => setTestingAvatar(null)}
        okText="开始 Mock 测试"
        cancelText="关闭"
        onOk={() => {
          message.success('已触发 Mock 测试，不调用真实数字人服务');
          setTestingAvatar(null);
        }}
      >
        <p>测试对象：{testingAvatar?.name}</p>
        <p>测试内容：使用绑定音色和默认动作生成一段本地预览提示。</p>
      </Modal>
    </>
  );
}
