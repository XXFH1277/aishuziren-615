import { Card, Col, List, Row, Space } from 'antd';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { dashboardStats, modelStatus, recentOperations } from '../../mock/dashboard';

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="首页工作台"
        description="集中查看今日直播准备情况、执行端状态、待审核内容和模型服务 Mock 状态。"
      />
      <Row gutter={[16, 16]} className="dashboard-grid">
        {dashboardStats.map((stat) => (
          <Col xs={24} sm={12} xl={6} key={stat.title}>
            <DataCard {...stat} />
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card className="panel-card" title="模型调用状态">
            <List
              dataSource={modelStatus}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item.name} description={item.detail} />
                  <StatusTag status={item.status} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card className="panel-card" title="最近操作记录">
            <List
              dataSource={recentOperations}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item.action} description={`${item.operator} · ${item.time}`} />
                  <Space>
                    <StatusTag status={item.status} />
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
