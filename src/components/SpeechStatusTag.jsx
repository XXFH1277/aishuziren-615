import { Tag } from 'antd';

const statusColor = {
  当前: 'processing',
  待播: 'warning',
  待审核: 'warning',
  已通过: 'success',
  已审核: 'success',
  已修改: 'blue',
  即将播出: 'processing',
  待下发: 'warning',
  下发中: 'processing',
  已播报: 'success',
  失败: 'error',
  未审核: 'default',
  不播报: 'default',
  高风险: 'error',
  高风险待人工: 'error',
  已删除: 'default',
  已驳回: 'default',
};

export default function SpeechStatusTag({ status }) {
  return <Tag color={statusColor[status] || 'default'}>{status || '未知'}</Tag>;
}
