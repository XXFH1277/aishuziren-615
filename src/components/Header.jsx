import { Badge, Button, Dropdown, Space } from 'antd';
import { BellOutlined, LogoutOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import StatusTag from './StatusTag';

export default function Header() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <h2 className="app-header-title">数字人直播带货中控系统</h2>
        <span className="app-header-subtitle">本地 API · Auth / RBAC MVP</span>
      </div>
      <div className="app-header-actions">
        <StatusTag status="已登录" />
        <Space size={8}>
          <Button icon={<SafetyCertificateOutlined />}>安全模式</Button>
          <Badge count={3} size="small">
            <Button icon={<BellOutlined />} />
          </Badge>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  label: '退出登录',
                  icon: <LogoutOutlined />,
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Button icon={<UserOutlined />}>{user?.nickname || user?.username || '当前用户'}</Button>
          </Dropdown>
        </Space>
      </div>
    </header>
  );
}
