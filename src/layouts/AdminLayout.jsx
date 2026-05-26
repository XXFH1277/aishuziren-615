import { Layout } from 'antd';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const { Content, Sider } = Layout;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
