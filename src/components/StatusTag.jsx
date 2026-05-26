import { Tag } from 'antd';

const statusColor = {
  成功: 'success',
  已配置: 'success',
  在线: 'success',
  启用中: 'success',
  已授权: 'success',
  已确认: 'success',
  待处理: 'warning',
  待测试: 'warning',
  待训练: 'warning',
  测试中: 'processing',
  草稿: 'default',
  待确认: 'warning',
  未连接: 'default',
  离线: 'default',
  停用: 'default',
  未授权: 'error',
  未确认: 'warning',
  异常: 'error',
};

export default function StatusTag({ status }) {
  return <Tag color={statusColor[status] || 'processing'}>{status}</Tag>;
}
