import { Button, Layout, Result } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { canAccessPath, getFirstAccessiblePath } from '../mock/menu';

const { Content, Sider } = Layout;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { menuPermissions } = useAuth();
  const canAccess = canAccessPath(pathname, menuPermissions);

  return (
    <Layout className="admin-shell">
      <Sider
        className="admin-sider"
        width={252}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <Layout className="layout-main">
        <Header />
        <div className="breadcrumb-bar">
          <Breadcrumb />
        </div>
        <Content className="content-wrap">
          {canAccess ? (
            <Outlet />
          ) : (
            <Result
              status="403"
              title="无权限访问"
              subTitle="当前角色没有该页面权限。"
              extra={
                <Button type="primary" onClick={() => navigate(getFirstAccessiblePath(menuPermissions), { replace: true })}>
                  返回可访问页面
                </Button>
              }
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
