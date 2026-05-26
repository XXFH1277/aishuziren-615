import { Tag } from 'antd';

const statusColor = {
  成功: 'success',
  已配置: 'success',
  在线: 'success',
  待处理: 'warning',
  待测试: 'warning',
  未连接: 'default',
  离线: 'default',
  异常: 'error',
};

export default function StatusTag({ status }) {
  return <Tag color={statusColor[status] || 'processing'}>{status}</Tag>;
}
