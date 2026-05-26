import { Badge, Button, Space } from 'antd';
import { BellOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import StatusTag from './StatusTag';

export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <h2 className="app-header-title">数字人直播带货中控系统</h2>
        <span className="app-header-subtitle">Phase 0 · 前端后台骨架 · Mock 环境</span>
      </div>
      <div className="app-header-actions">
        <StatusTag status="未连接" />
        <Space size={8}>
          <Button icon={<SafetyCertificateOutlined />}>安全模式</Button>
          <Badge count={3} size="small">
            <Button icon={<BellOutlined />} />
          </Badge>
        </Space>
      </div>
    </header>
  );
}
