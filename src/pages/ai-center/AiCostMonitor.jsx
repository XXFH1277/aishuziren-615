import { Alert, Button, Card, Empty, Form, Input, Progress, Space, Spin, Statistic, Switch, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getAiCosts, saveAiBudgetSettings } from '../../services/aiService';

export default function AiCostMonitor() {
  const [form] = Form.useForm();
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadCosts() {
    try {
      setLoading(true);
      setError('');
      const result = await getAiCosts({});
      const nextCosts = result.costs || result;
      setCosts(nextCosts);
      form.setFieldsValue(nextCosts.budgetSettings || {});
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCosts();
  }, []);

  const handleSave = async (values) => {
    try {
      setSaving(true);
      const updated = await saveAiBudgetSettings(values);
      setCosts((current) => ({
        ...(current || {}),
        budgetSettings: updated.budgetSettings || values,
      }));
      message.success('成本预警设置已保存到本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="成本监控"
        description="展示 AI 调用成本、模型费用占比和预算预警 Mock。当前读取本地 SQLite Mock 数据，不连接真实账单系统。"
      />

      {error ? (
        <Alert className="page-alert" type="error" showIcon message={error} />
      ) : null}

      <Spin spinning={loading}>
        {!costs && !loading ? (
          <Card className="panel-card">
            <Empty description="暂无成本监控数据" />
          </Card>
        ) : null}

        {costs ? (
          <>
            <div className="ai-cost-stat-grid">
              <Card className="panel-card"><Statistic title="今日调用次数" value={costs.todayCalls} suffix="次" /></Card>
              <Card className="panel-card"><Statistic title="今日估算费用" value={costs.todayCost} prefix="￥" precision={2} /></Card>
              <Card className="panel-card"><Statistic title="本月估算费用" value={costs.monthCost} prefix="￥" precision={2} /></Card>
              <Card className="panel-card"><Statistic title="平均单次成本" value={costs.averageCost} prefix="￥" precision={2} /></Card>
              <Card className="panel-card"><Statistic title="异常调用次数" value={costs.abnormalCalls} suffix="次" valueStyle={{ color: '#e11d48' }} /></Card>
            </div>

            <div className="ai-center-layout-grid">
              <Card title="模型费用占比" className="panel-card">
                <div className="ai-progress-list">
                  {(costs.providerBreakdown || []).map((item) => (
                    <div key={item.name}>
                      <div className="ai-progress-title">
                        <Space><strong>{item.name}</strong><Tag color="blue">￥{Number(item.cost || 0).toFixed(2)}</Tag></Space>
                        <span>{item.value}%</span>
                      </div>
                      <Progress percent={item.value} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="调用类型占比" className="panel-card">
                <div className="ai-progress-list">
                  {(costs.typeBreakdown || []).map((item) => (
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
                message="预算设置仍为 Mock"
                description="当前只写入本地 SQLite Mock 数据，不触发真实通知，也不调用任何模型服务。"
              />
              <Form
                form={form}
                layout="vertical"
                initialValues={costs.budgetSettings}
                onFinish={handleSave}
              >
                <div className="form-grid">
                  <Form.Item label="单日预算" name="dailyBudget">
                    <Input prefix="￥" />
                  </Form.Item>
                  <Form.Item label="单月预算" name="monthlyBudget">
                    <Input prefix="￥" />
                  </Form.Item>
                  <Form.Item label="超额提醒" name="overBudgetAlert" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="高成本模型提醒" name="highCostModelAlert" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存 Mock 设置
                </Button>
              </Form>
            </Card>
          </>
        ) : null}
      </Spin>
    </>
  );
}
