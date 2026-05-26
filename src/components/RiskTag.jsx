import { Tag } from 'antd';

const riskColor = {
  低: 'green',
  中: 'orange',
  高: 'red',
};

export default function RiskTag({ level }) {
  return <Tag color={riskColor[level] || 'default'}>{level}风险</Tag>;
}
