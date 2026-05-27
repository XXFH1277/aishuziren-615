import { useEffect, useState } from 'react';
import { Alert, Card, Col, Empty, List, Row, Space, Spin } from 'antd';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getDashboardOverview } from '../../services/dashboardService';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadOverview() {
      setLoading(true);
      setError('');

      try {
        const data = await getDashboardOverview();
        if (!ignore) {
          setOverview(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || '首页工作台数据加载失败');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      ignore = true;
    };
  }, []);

  const dashboardStats = overview?.stats || [];
  const modelStatus = overview?.aiCallStatus || [];
  const recentOperations = overview?.recentOperations || [];

  return (
    <>
      <PageHeader
        title="首页工作台"
        description="集中查看今日直播准备情况、执行端状态、待审核内容和模型服务 Mock 状态。数据来自本地 API / SQLite。"
      />

      {error ? <Alert className="section-alert" type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {!loading && !error && !overview ? (
          <Card className="panel-card">
            <Empty description="暂无首页工作台数据" />
          </Card>
        ) : (
          <>
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
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型状态" /> }}
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
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" /> }}
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
        )}
      </Spin>
    </>
  );
}
