import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, List, Radio, Slider, Space, Switch, Tabs, message } from 'antd';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import { delayModes, delaySettings } from '../../mock/delaySettings';

export default function DelaySettings() {
  const [form] = Form.useForm();

  const handleSave = () => {
    message.success('延迟播控设置已保存 Mock');
  };

  const handleReset = () => {
    form.resetFields();
    message.info('已恢复默认 Mock 设置');
  };

  return (
    <>
      <PageHeader
        title="延迟设置"
        description="配置数字人播报的延迟策略、人工审核策略、队列策略和风险词策略。当前只做前端 Mock。"
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          delayMode: delaySettings.delayMode,
          delaySeconds: delaySettings.delaySeconds,
          ...delaySettings.reviewRules,
          ...delaySettings.queueRules,
        }}
      >
        <Tabs
          className="delay-tabs"
          items={[
            {
              key: 'delay',
              label: '延迟模式',
              children: (
                <Card className="panel-card">
                  <Form.Item label="延迟模式" name="delayMode">
                    <Radio.Group options={delayModes.map((item) => ({ label: item, value: item }))} />
                  </Form.Item>
                  <Form.Item label="自定义延迟秒数" name="delaySeconds">
                    <Slider min={0} max={30} marks={{ 0: '0秒', 5: '5秒', 10: '10秒', 30: '30秒' }} />
                  </Form.Item>
                  <Alert type="info" showIcon message="延迟模式 Mock" description="设置不会下发到真实数字人、TTS 或执行端。" />
                </Card>
              ),
            },
            {
              key: 'review',
              label: '审核策略',
              children: (
                <Card className="panel-card">
                  <div className="settings-switch-grid">
                    <Form.Item label="低风险自动通过" name="lowRiskAutoPass" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="中风险人工确认" name="mediumRiskManualConfirm" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="高风险禁止自动播出" name="highRiskBlockAuto" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="价格相关必须人工确认" name="priceManualConfirm" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="医疗功效词必须拦截" name="medicalTermsBlock" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="平台禁词必须拦截" name="platformForbiddenBlock" valuePropName="checked"><Switch /></Form.Item>
                  </div>
                </Card>
              ),
            },
            {
              key: 'queue',
              label: '队列策略',
              children: (
                <Card className="panel-card">
                  <Form.Item label="每次最多提前生成几句" name="maxAheadSentences">
                    <Slider min={1} max={8} marks={{ 1: '1句', 3: '3句', 5: '5句', 8: '8句' }} />
                  </Form.Item>
                  <div className="settings-switch-grid">
                    <Form.Item label="显示下两句" name="showNextTwo" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="允许人工插队" name="allowManualInsert" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="允许删除待播内容" name="allowDeletePending" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item label="允许自动切回商品主线" name="allowReturnToProductLine" valuePropName="checked"><Switch /></Form.Item>
                  </div>
                </Card>
              ),
            },
            {
              key: 'risk',
              label: '风险词策略',
              children: (
                <Card className="panel-card">
                  <List
                    dataSource={delaySettings.riskRules}
                    renderItem={(item) => (
                      <List.Item actions={[<Switch defaultChecked={item.enabled} key="switch" />]}>
                        <List.Item.Meta
                          title={<Space><span>{item.name}</span><SpeechRiskTag level={item.level} /></Space>}
                          description={item.description}
                        />
                      </List.Item>
                    )}
                  />
                  <Form.Item label="补充风险词备注">
                    <Input.TextArea rows={3} placeholder="例如：活动价格、绝对化表达、平台禁词等，仅为 Mock 备注。" />
                  </Form.Item>
                </Card>
              ),
            },
          ]}
        />
        <div className="sticky-actions">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>恢复默认 Mock</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置 Mock</Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
