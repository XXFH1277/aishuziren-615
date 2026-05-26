import { Tag } from 'antd';

const statusColor = {
  当前: 'processing',
  待播: 'warning',
  待审核: 'warning',
  已通过: 'success',
  已修改: 'blue',
  即将播出: 'processing',
  高风险: 'error',
  高风险待人工: 'error',
  已删除: 'default',
};

export default function SpeechStatusTag({ status }) {
  return <Tag color={statusColor[status] || 'default'}>{status}</Tag>;
}
