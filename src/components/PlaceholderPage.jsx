import { Alert, Col, Row } from 'antd';
import { pageMeta } from '../mock/pages';
import DataCard from './DataCard';
import PageHeader from './PageHeader';

export default function PlaceholderPage({ pageKey }) {
  const meta = pageMeta[pageKey];

  return (
    <>
      <PageHeader title={meta.title} description={meta.description} />
      <Row gutter={[16, 16]} className="module-grid">
        {meta.cards.map((card) => (
          <Col xs={24} md={8} key={card.title}>
            <DataCard {...card} />
          </Col>
        ))}
      </Row>
      <Alert className="placeholder-hint" message="后续功能提示" description={meta.hint} type="info" showIcon />
    </>
  );
}
