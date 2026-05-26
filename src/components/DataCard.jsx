import { Card } from 'antd';
import StatusTag from './StatusTag';

export default function DataCard({ title, value, helper, tone = 'blue', status }) {
  return (
    <Card className={`data-card tone-${tone}`}>
      <div className="data-card-label">
        <span>{title}</span>
        {status ? <StatusTag status={status} /> : null}
      </div>
      <div className="data-card-value">{value}</div>
      <div className="data-card-helper">{helper}</div>
    </Card>
  );
}
