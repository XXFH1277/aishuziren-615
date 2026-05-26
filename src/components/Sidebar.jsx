import {
  AppstoreOutlined,
  BgColorsOutlined,
  CommentOutlined,
  ControlOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Menu } from 'antd';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findMenuItem, findOpenKeys, menuItems } from '../mock/menu';

const iconMap = {
  dashboard: <DashboardOutlined />,
  live: <VideoCameraOutlined />,
  products: <ShoppingCartOutlined />,
  avatar: <UserOutlined />,
  studio: <BgColorsOutlined />,
  interaction: <CommentOutlined />,
  delay: <ControlOutlined />,
  ai: <ExperimentOutlined />,
  executors: <AppstoreOutlined />,
  help: <QuestionCircleOutlined />,
  settings: <SettingOutlined />,
  team: <TeamOutlined />,
};

function toAntMenu(items) {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon ? iconMap[item.icon] : undefined,
    label: item.label,
    children: item.children ? toAntMenu(item.children) : undefined,
  }));
}

export default function Sidebar({ collapsed }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selectedItem = findMenuItem(pathname);
  const menu = useMemo(() => toAntMenu(menuItems), []);
  const defaultOpenKeys = useMemo(() => findOpenKeys(pathname), [pathname]);

  return (
    <>
      <div className="brand-block">
        <div className="brand-mark">DH</div>
        {!collapsed ? (
          <div className="brand-copy">
            <span className="brand-title">Live Console</span>
            <span className="brand-subtitle">Admin Prototype</span>
          </div>
        ) : null}
      </div>
      <Menu
        mode="inline"
        items={menu}
        selectedKeys={[selectedItem?.key || '/dashboard']}
        defaultOpenKeys={defaultOpenKeys}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 0, padding: '8px 0' }}
      />
    </>
  );
}
