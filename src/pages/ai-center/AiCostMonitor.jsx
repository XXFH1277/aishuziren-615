import { Alert, Button, Card, Form, Input, Progress, Space, Statistic, Switch, Tag, message } from 'antd';
import PageHeader from '../../components/PageHeader';
import { aiCosts } from '../../mock/aiCosts';

export default function AiCostMonitor() {
  const [form] = Form.useForm();

  return (
    <>
      <PageHeader
        title="成本监控"
        description="展示 AI 调用成本、模型费用占比和预算预警 Mock。当前不连接真实账单系统。"
      />

      <div className="ai-cost-stat-grid">
        <Card className="panel-card"><Statistic title="今日调用次数" value={aiCosts.todayCalls} suffix="次" /></Card>
        <Card className="panel-card"><Statistic title="今日估算费用" value={aiCosts.todayCost} prefix="¥" precision={2} /></Card>
        <Card className="panel-card"><Statistic title="本月估算费用" value={aiCosts.monthCost} prefix="¥" precision={2} /></Card>
        <Card className="panel-card"><Statistic title="平均单次成本" value={aiCosts.averageCost} prefix="¥" precision={2} /></Card>
        <Card className="panel-card"><Statistic title="异常调用次数" value={aiCosts.abnormalCalls} suffix="次" valueStyle={{ color: '#e11d48' }} /></Card>
      </div>

      <div className="ai-center-layout-grid">
        <Card title="模型费用占比" className="panel-card">
          <div className="ai-progress-list">
            {aiCosts.providerBreakdown.map((item) => (
              <div key={item.name}>
                <div className="ai-progress-title">
                  <Space><strong>{item.name}</strong><Tag color="blue">¥{item.cost.toFixed(2)}</Tag></Space>
                  <span>{item.value}%</span>
                </div>
                <Progress percent={item.value} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="调用类型占比" className="panel-card">
          <div className="ai-progress-list">
            {aiCosts.typeBreakdown.map((item) => (
              <div key={item.name}>
                <div className="ai-progress-title">
                  <strong>{item.name}</strong>
                  <span>{item.value}%</span>
                </div>
                <Progress percent={item.value} strokeColor={item.value >= 25 ? '#2563eb' : '#14b8a6'} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="成本预警设置" className="panel-card">
        <Alert
          className="ai-modal-alert"
          type="info"
          showIcon
          message="预算设置仅为 Mock"
          description="当前不会写入数据库，也不会触发真实通知。"
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={aiCosts.budgetSettings}
          onFinish={() => message.success('成本预警设置已 Mock 保存')}
        >
          <div className="form-grid">
            <Form.Item label="单日预算" name="dailyBudget">
              <Input prefix="¥" />
            </Form.Item>
            <Form.Item label="单月预算" name="monthlyBudget">
              <Input prefix="¥" />
            </Form.Item>
            <Form.Item label="超额提醒" name="overBudgetAlert" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="高成本模型提醒" name="highCostModelAlert" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit">
            保存 Mock 设置
          </Button>
        </Form>
      </Card>
    </>
  );
}
