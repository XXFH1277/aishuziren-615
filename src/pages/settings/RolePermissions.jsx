import { CopyOutlined, EditOutlined, EyeOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Descriptions, Empty, Modal, Select, Space, Table, Tree, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getPermissionTree, getRoles, getSettingsOptions, updateRoleMock } from '../../services/settingsService';

const permissionTree = getPermissionTree();
const settingsOptions = getSettingsOptions();

export default function RolePermissions() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentRole, setCurrentRole] = useState(null);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [dataScope, setDataScope] = useState('所属团队');
  const [operationPermissions, setOperationPermissions] = useState([]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getRoles({ pageSize: 100 });
      setRoles(data.list || []);
    } catch (requestError) {
      const messageText = requestError.message || '角色列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openRoleModal = (record) => {
    setCurrentRole(record);
    setCheckedKeys(record.menuPermissions);
    setDataScope(record.dataScope);
    setOperationPermissions(record.operationPermissions);
  };

  const handleSaveRole = () => {
    const response = updateRoleMock(currentRole.id, {
      menuPermissions: checkedKeys,
      dataScope,
      operationPermissions,
    });
    if (response.success) {
      setRoles((prevRoles) =>
        prevRoles.map((item) =>
          item.id === currentRole.id
            ? {
                ...item,
                menuPermissions: response.data.menuPermissions,
                dataScope: response.data.dataScope,
                operationPermissions: response.data.operationPermissions,
                updatedAt: '2026-05-26 23:20',
              }
            : item,
        ),
      );
      message.success('角色权限已保存 Mock，不写入真实 RBAC 系统');
      setCurrentRole(null);
    }
  };

  const toggleRoleStatus = (record) => {
    const nextStatus = record.status === '禁用' ? '启用' : '禁用';
    setRoles((prevRoles) => prevRoles.map((item) => (item.id === record.id ? { ...item, status: nextStatus } : item)));
    message.info(`角色「${record.name}」已切换为${nextStatus} Mock`);
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 150,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">{record.description}</div>
        </div>
      ),
    },
    { title: '用户数量', dataIndex: 'userCount', width: 100 },
    { title: '权限范围', dataIndex: 'permissionScope', width: 160 },
    { title: '数据权限', dataIndex: 'dataScope', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openRoleModal(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openRoleModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => message.success(`已复制「${record.name}」角色配置 Mock`)}>
            复制
          </Button>
          <Button type="link" size="small" danger={record.status !== '禁用'} icon={<StopOutlined />} onClick={() => toggleRoleStatus(record)}>
            {record.status === '禁用' ? '启用' : '停用'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="角色权限"
        description="角色列表通过本地 API 读取 SQLite；权限编辑仍为 Mock，不接真实登录系统、真实权限系统或后端鉴权逻辑。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新增角色为 Mock 入口，暂不创建真实角色')}>
            新增角色 Mock
          </Button>
        }
      />

      <Alert
        className="settings-alert"
        type="info"
        showIcon
        message="权限配置说明"
        description="本页只展示权限管理原型，不接真实登录系统、真实权限系统或后端鉴权逻辑。"
      />

      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={roles}
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 个角色` }}
          scroll={{ x: 1240 }}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无角色权限配置'} /> }}
        />
      </Card>

      <Modal
        title={currentRole ? `权限配置 Mock：${currentRole.name}` : '权限配置 Mock'}
        open={Boolean(currentRole)}
        onOk={handleSaveRole}
        onCancel={() => setCurrentRole(null)}
        okText="保存 Mock"
        cancelText="取消"
        width={920}
      >
        {currentRole ? (
          <div className="settings-permission-layout">
            <Card size="small" title="角色信息">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="角色说明">{currentRole.description}</Descriptions.Item>
                <Descriptions.Item label="用户数量">{currentRole.userCount}</Descriptions.Item>
                <Descriptions.Item label="权限范围">{currentRole.permissionScope}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <StatusTag status={currentRole.status} />
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Card size="small" title="菜单权限">
              <Tree
                checkable
                defaultExpandAll
                checkedKeys={checkedKeys}
                treeData={permissionTree}
                onCheck={(keys) => setCheckedKeys(Array.isArray(keys) ? keys : keys.checked)}
              />
            </Card>
            <Card size="small" title="数据权限">
              <Select
                value={dataScope}
                onChange={setDataScope}
                options={settingsOptions.dataScopes.map((item) => ({ label: item, value: item }))}
                style={{ width: '100%' }}
              />
            </Card>
            <Card size="small" title="操作权限">
              <Checkbox.Group
                className="settings-checkbox-grid"
                value={operationPermissions}
                options={settingsOptions.operationPermissions}
                onChange={setOperationPermissions}
              />
            </Card>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
