import { EditOutlined, FileTextOutlined, LockOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getRoles, getSettingsOptions, getUsers, updateUserMock } from '../../services/settingsService';

const settingsOptions = getSettingsOptions();

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [role, setRole] = useState();
  const [editingUser, setEditingUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [userData, roleData] = await Promise.all([
        getUsers({
          keyword,
          role,
          status,
          page: pagination.current,
          pageSize: pagination.pageSize,
        }),
        getRoles({ pageSize: 100 }),
      ]);

      setUsers(userData.list || []);
      setRoles(roleData.list || []);
      setPagination((current) => ({
        ...current,
        current: userData.page || current.current,
        pageSize: userData.pageSize || current.pageSize,
        total: userData.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '用户列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [keyword, pagination.current, pagination.pageSize, role, status]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const stats = useMemo(
    () => ({
      total: users.length,
      enabled: users.filter((item) => item.status === '启用').length,
      disabled: users.filter((item) => item.status === '禁用').length,
      locked: users.filter((item) => item.status === '锁定').length,
      recent: users.filter((item) => item.recentLogin).length,
    }),
    [users],
  );

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const openUserModal = (record) => {
    setEditingUser(record || {});
    form.setFieldsValue(
      record || {
        status: '启用',
        role: roles[1]?.name,
      },
    );
  };

  const handleSaveUser = () => {
    const values = form.getFieldsValue();
    const response = updateUserMock(editingUser?.id || 'new-user', values);
    if (editingUser?.id) {
      setUsers((prevUsers) => prevUsers.map((item) => (item.id === editingUser.id ? { ...item, ...response.data } : item)));
      message.success('用户信息已保存 Mock，不写入真实用户系统');
    } else {
      const nextUser = {
        ...response.data,
        id: `U${String(users.length + 1).padStart(3, '0')}`,
        lastLoginAt: '未登录',
        createdAt: '2026-05-26 23:10',
        recentLogin: false,
        notes: response.data.notes || '新增 Mock 用户',
      };
      setUsers((prevUsers) => [nextUser, ...prevUsers]);
      message.success('新增用户已完成 Mock，不创建真实账号');
    }
    setEditingUser(null);
    form.resetFields();
  };

  const handleDisable = (record) => {
    const nextStatus = record.status === '禁用' ? '启用' : '禁用';
    setUsers((prevUsers) => prevUsers.map((item) => (item.id === record.id ? { ...item, status: nextStatus } : item)));
    message.info(`${record.nickname} 已切换为「${nextStatus}」Mock`);
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">{record.notes}</div>
        </div>
      ),
    },
    { title: '昵称', dataIndex: 'nickname', width: 120 },
    { title: '邮箱', dataIndex: 'email', width: 190 },
    { title: '手机号', dataIndex: 'phone', width: 150 },
    { title: '角色', dataIndex: 'role', width: 130 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: '最后登录时间', dataIndex: 'lastLoginAt', width: 160 },
    { title: '创建时间', dataIndex: 'createdAt', width: 160 },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openUserModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger={record.status !== '禁用'} icon={<StopOutlined />} onClick={() => handleDisable(record)}>
            {record.status === '禁用' ? '启用' : '禁用'}
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => message.success('重置密码为 Mock 操作，不发送真实通知')}>
            重置密码
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => setDetailUser(record)}>
            查看日志
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="用户管理"
        description="用户列表通过本地 API 读取 SQLite；新增、编辑、重置密码仍为 Mock，不接真实登录、权限或通知系统。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal()}>
            新增用户 Mock
          </Button>
        }
      />

      <div className="settings-stat-grid">
        <DataCard title="总用户数" value={stats.total} helper="后台账号总数" tone="blue" />
        <DataCard title="启用用户" value={stats.enabled} helper="可登录 Mock 后台" tone="teal" />
        <DataCard title="禁用用户" value={stats.disabled} helper="已停用账号" tone="amber" />
        <DataCard title="锁定用户" value={stats.locked} helper="需管理员解锁" tone="rose" />
        <DataCard title="最近登录用户数" value={stats.recent} helper="近期有登录记录" tone="blue" />
      </div>

      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索用户名、昵称或邮箱"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="角色"
            value={role}
            onChange={(value) => resetToFirstPage(() => setRole(value))}
            options={roles.map((item) => ({ label: item.name, value: item.name }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="账号状态"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={settingsOptions.userStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1420 }}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的用户'} /> }}
        />
      </Card>

      <Modal
        title={editingUser?.id ? '编辑用户 Mock' : '新增用户 Mock'}
        open={Boolean(editingUser)}
        onOk={handleSaveUser}
        onCancel={() => setEditingUser(null)}
        okText="保存 Mock"
        cancelText="取消"
        width={680}
      >
        <Form form={form} layout="vertical" className="settings-modal-form">
          <Form.Item label="用户名" name="username">
            <Input placeholder="例如 live_operator" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item label="昵称" name="nickname">
            <Input placeholder="例如 直播运营A" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="operator@example.com" />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="000-0000-0000 Mock" />
          </Form.Item>
          <Form.Item label="角色" name="role">
            <Select options={roles.map((item) => ({ label: item.name, value: item.name }))} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select options={settingsOptions.userStatuses.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} placeholder="账号用途、权限边界或交接说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="用户相关操作日志 Mock" open={Boolean(detailUser)} onCancel={() => setDetailUser(null)} footer={null} width={720}>
        {detailUser ? (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="用户名">{detailUser.username}</Descriptions.Item>
            <Descriptions.Item label="昵称">{detailUser.nickname}</Descriptions.Item>
            <Descriptions.Item label="角色">{detailUser.role}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag status={detailUser.status} />
            </Descriptions.Item>
            <Descriptions.Item label="最近登录">{detailUser.lastLoginAt}</Descriptions.Item>
            <Descriptions.Item label="日志入口">请前往“系统设置 / 操作日志”筛选该用户，当前只展示 Mock 详情。</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  );
}
