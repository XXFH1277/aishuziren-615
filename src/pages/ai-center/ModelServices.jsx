import { ApiOutlined, ExperimentOutlined } from '@ant-design/icons';
import { Alert, Card, Col, Row } from 'antd';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

const models = [
  {
    name: 'Kimi',
    status: '已配置',
    scene: '直播话术、商品卖点、互动回复',
    note: '仅展示环境变量占位状态，不读取真实 API Key。',
    icon: <ExperimentOutlined />,
  },
  {
    name: 'Mimo',
    status: '待测试',
    scene: '短文本改写、运营辅助建议',
    note: '当前阶段不发起请求，不保存密钥，不连接模型服务。',
    icon: <ApiOutlined />,
  },
];

export default function ModelServices() {
  return (
    <>
      <PageHeader
        title="模型服务配置"
        description="展示 Kimi 和 Mimo 的模型配置占位卡片，状态全部来自 Mock 数据。"
      />
      <Row gutter={[16, 16]} className="module-grid">
        {models.map((model) => (
          <Col xs={24} md={12} key={model.name}>
            <Card className="model-card">
              <div className="model-card-title">
                <h3>
                  {model.icon} {model.name}
                </h3>
                <StatusTag status={model.status} />
              </div>
              <div className="model-meta">
                <div>适用场景：{model.scene}</div>
                <div>{model.note}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Alert
        className="placeholder-hint"
        message="安全边界"
        description="Phase 0 不读取 .env.local，不调用 Kimi / Mimo API，不把任何 API Key 写进代码或 Mock 数据。"
        type="warning"
        showIcon
      />
    </>
  );
}
