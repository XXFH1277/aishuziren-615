import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, List, Radio, Slider, Space, Switch, Tabs, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import { getDelayModes, getDelaySettings, saveDelaySettings } from '../../services/delayControlService';

const delayModes = getDelayModes();

export default function DelaySettings() {
  const [form] = Form.useForm();
  const [settings, setSettings] = useState(null);
  const [riskRules, setRiskRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadSettings() {
    try {
      setLoading(true);
      setError('');
      const data = await getDelaySettings({});
      const nextSettings = data.settings || data;

      setSettings(nextSettings);
      setRiskRules(nextSettings.riskRules || []);
      form.setFieldsValue({
        delayMode: nextSettings.delayMode,
        delaySeconds: nextSettings.delaySeconds,
        ...(nextSettings.reviewRules || {}),
        ...(nextSettings.queueRules || {}),
      });
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = form.getFieldsValue();
      const saved = await saveDelaySettings({
        delayMode: values.delayMode,
        delaySeconds: values.delaySeconds,
        reviewRules: {
          lowRiskAutoPass: values.lowRiskAutoPass,
          mediumRiskManualConfirm: values.mediumRiskManualConfirm,
          highRiskBlockAuto: values.highRiskBlockAuto,
          priceManualConfirm: values.priceManualConfirm,
          medicalTermsBlock: values.medicalTermsBlock,
          platformForbiddenBlock: values.platformForbiddenBlock,
        },
        queueRules: {
          maxAheadSentences: values.maxAheadSentences,
          showNextTwo: values.showNextTwo,
          allowManualInsert: values.allowManualInsert,
          allowDeletePending: values.allowDeletePending,
          allowReturnToProductLine: values.allowReturnToProductLine,
        },
        riskRules,
      });

      setSettings(saved);
      message.success('播控设置已保存到本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!settings) {
      return;
    }

    form.setFieldsValue({
      delayMode: settings.delayMode,
      delaySeconds: settings.delaySeconds,
      ...(settings.reviewRules || {}),
      ...(settings.queueRules || {}),
    });
    setRiskRules(settings.riskRules || []);
    message.info('已恢复当前本地 API 设置');
  };

  const toggleRiskRule = (id, enabled) => {
    setRiskRules((items) => items.map((item) => (item.id === id ? { ...item, enabled } : item)));
  };

  return (
    <>
      <PageHeader
        title="播控设置"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。这里用于配置播控延迟、人工审核、队列和风险词策略。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Form form={form} layout="vertical" disabled={loading}>
        <Tabs
          className="delay-tabs"
          items={[
            {
              key: 'delay',
              label: '延迟模式',
              children: (
                <Card className="panel-card" loading={loading}>
                  <Form.Item label="延迟模式" name="delayMode">
                    <Radio.Group options={delayModes.map((item) => ({ label: item, value: item }))} />
                  </Form.Item>
                  <Form.Item label="自定义延迟秒数" name="delaySeconds">
                    <Slider min={0} max={30} marks={{ 0: '0秒', 5: '5秒', 10: '10秒', 30: '30秒' }} />
                  </Form.Item>
                  <Alert type="info" showIcon message="延迟模式 Mock" description="设置只保存到本地 SQLite，不会下发到真实数字人、TTS 或执行端。" />
                </Card>
              ),
            },
            {
              key: 'review',
              label: '审核策略',
              children: (
                <Card className="panel-card" loading={loading}>
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
                <Card className="panel-card" loading={loading}>
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
                <Card className="panel-card" loading={loading}>
                  <List
                    dataSource={riskRules}
                    renderItem={(item) => (
                      <List.Item actions={[<Switch checked={item.enabled} onChange={(checked) => toggleRiskRule(item.id, checked)} key="switch" />]}>
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
            <Button icon={<ReloadOutlined />} onClick={handleReset}>恢复当前 API 设置</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存设置</Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
