import { RedoOutlined, SendOutlined, StepForwardOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Descriptions, Empty, Row, Space, Table, Timeline, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import StatusTag from '../../components/StatusTag';
import { dispatchNextSpeechItem, dispatchSpeechItem, getCurrentSpeech } from '../../services/delayControlService';

function SpeechSummary({ speech, title }) {
  if (!speech) {
    return (
      <Card className="panel-card speech-summary-card" title={title}>
        <Empty description="暂无队列内容" />
      </Card>
    );
  }

  return (
    <Card
      className="panel-card speech-summary-card"
      title={title}
      extra={
        <Space>
          <SpeechStatusTag status={speech.broadcastStatus || speech.reviewStatus} />
          <SpeechRiskTag level={speech.riskLevel} />
        </Space>
      }
    >
      <Typography.Paragraph className="speech-main-text">{speech.text}</Typography.Paragraph>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="来源">{speech.source}</Descriptions.Item>
        <Descriptions.Item label="动作">{speech.action}</Descriptions.Item>
        <Descriptions.Item label="语气">{speech.tone}</Descriptions.Item>
        <Descriptions.Item label="商品">{speech.productName || speech.relatedProduct || '-'}</Descriptions.Item>
        <Descriptions.Item label="队列ID">{speech.id}</Descriptions.Item>
        <Descriptions.Item label="执行端命令">{speech.executorCommandId || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export default function CurrentSpeech() {
  const [delayControl, setDelayControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dispatching, setDispatching] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const data = await getCurrentSpeech({});
      setDelayControl(data);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const currentSpeech = delayControl?.currentSpeech;
  const nextSpeech = delayControl?.nextSpeech;
  const queueStatus = delayControl?.queueStatus || {};
  const broadcasted = queueStatus.broadcasted || [];
  const riskSummary = delayControl?.riskSummary || {};
  const activeLiveTaskId = delayControl?.liveTaskId || currentSpeech?.liveTaskId || nextSpeech?.liveTaskId || '';

  async function handleDispatchCurrentSpeech() {
    if (!currentSpeech?.id) {
      message.warning('当前没有可补发的队列项');
      return;
    }

    try {
      setDispatching(currentSpeech.id);
      const result = await dispatchSpeechItem(currentSpeech.id, { liveTaskId: activeLiveTaskId });
      message.success(result.message || '当前队列项已下发到执行端');
      await loadData();
    } catch (requestError) {
      message.error(requestError.message || '补发当前队列项失败');
    } finally {
      setDispatching('');
    }
  }

  async function handleDispatchNextSpeech() {
    try {
      setDispatching('__next__');
      const result = await dispatchNextSpeechItem({ liveTaskId: activeLiveTaskId });
      message.success(result.message || '下一条待播话术已下发到执行端');
      await loadData();
    } catch (requestError) {
      message.error(requestError.message || '下发下一条失败');
    } finally {
      setDispatching('');
    }
  }

  const broadcastColumns = [
    { title: '队列ID', dataIndex: 'id', width: 90 },
    { title: '台词', dataIndex: 'text' },
    { title: '来源', dataIndex: 'source', width: 110 },
    { title: '播报状态', dataIndex: 'broadcastStatus', width: 110, render: (value) => <SpeechStatusTag status={value} /> },
    { title: '完成时间', dataIndex: 'broadcastFinishedAt', width: 180 },
  ];

  return (
    <>
      <PageHeader
        title="当前播报"
        description="本页展示延迟播控输出侧的真实队列状态：当前下发中、下一条待下发、最近已播报。真实数字人播报仍由执行端适配器负责，本阶段默认 PrintAdapter。"
        extra={delayControl ? <Badge status="processing" text={`延迟模式：${delayControl.delayMode}`} /> : null}
      />

      <Alert
        className="page-alert"
        type="info"
        showIcon
        message="当前只展示中控队列到执行端的播报编排状态"
        description="本阶段不接真实 DUIX、TTS、口型同步、推流或直播平台。执行端回执成功后，队列项会更新为已播报。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Row gutter={[16, 16]} className="delay-status-row">
        {[
          ['当前直播间', delayControl?.currentLiveRoom],
          ['当前直播任务', delayControl?.currentLiveTask],
          ['当前数字人', delayControl?.currentAvatar],
          ['当前商品组', delayControl?.currentProductGroup],
          ['执行端状态', delayControl?.executorStatus],
        ].map(([label, value]) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={label}>
            <Card className="data-card delay-mini-card" loading={loading}>
              <span>{label}</span>
              {label === '执行端状态' ? <StatusTag status={value || '未知'} /> : <strong>{value || '-'}</strong>}
            </Card>
          </Col>
        ))}
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="data-card delay-mini-card" loading={loading}>
            <span>最近已播报</span>
            <strong>{broadcasted.length}</strong>
          </Card>
        </Col>
      </Row>

      {!loading && !delayControl ? (
        <Card className="panel-card">
          <Empty description="暂无当前播报数据" />
        </Card>
      ) : null}

      {delayControl ? (
        <>
          <div className="delay-current-grid">
            <Card
              className="panel-card delay-current-card"
              title="当前下发中 / 当前播报"
              loading={loading}
              extra={currentSpeech ? <SpeechRiskTag level={currentSpeech.riskLevel} /> : null}
            >
              <Typography.Paragraph className="speech-current-text">{currentSpeech?.text || '暂无下发中的待播话术'}</Typography.Paragraph>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="来源">{currentSpeech?.source || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前动作">{currentSpeech?.action || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前语气">{currentSpeech?.tone || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前商品">{currentSpeech?.productName || currentSpeech?.relatedProduct || '-'}</Descriptions.Item>
                <Descriptions.Item label="队列状态">
                  <SpeechStatusTag status={currentSpeech?.broadcastStatus || currentSpeech?.reviewStatus || '未知'} />
                </Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <SpeechRiskTag level={currentSpeech?.riskLevel} />
                </Descriptions.Item>
              </Descriptions>
              <Space wrap className="delay-action-row">
                <Button
                  icon={<SendOutlined />}
                  loading={dispatching === currentSpeech?.id}
                  disabled={!currentSpeech?.id}
                  onClick={handleDispatchCurrentSpeech}
                >
                  补发当前
                </Button>
                <Button
                  type="primary"
                  icon={<StepForwardOutlined />}
                  loading={dispatching === '__next__'}
                  disabled={!activeLiveTaskId}
                  onClick={handleDispatchNextSpeech}
                >
                  下发下一条
                </Button>
                <Button icon={<RedoOutlined />} onClick={loadData} loading={loading}>刷新状态</Button>
              </Space>
            </Card>

            <Card className="panel-card" title="风险概览" loading={loading}>
              <div className="risk-summary-grid">
                <div><span>低风险</span><strong>{riskSummary.low ?? 0}</strong></div>
                <div><span>中风险</span><strong>{riskSummary.medium ?? 0}</strong></div>
                <div><span>高风险</span><strong>{riskSummary.high ?? 0}</strong></div>
                <div><span>待人工</span><strong>{riskSummary.pendingReview ?? 0}</strong></div>
              </div>
              <Alert
                className="delay-alert"
                type="warning"
                showIcon
                message="真实拦截仍未接入执行端"
                description="当前风险提示只展示本地队列状态，不会调用真实数字人、TTS、OBS 或直播平台。"
              />
            </Card>
          </div>

          <div className="delay-upcoming-grid">
            <SpeechSummary speech={nextSpeech} title="下一条待下发" />
            <Card className="panel-card" title="最近已播报">
              <Table
                rowKey="id"
                size="small"
                columns={broadcastColumns}
                dataSource={broadcasted}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无已播报回执" /> }}
              />
            </Card>
          </div>

          <Card className="panel-card" title="播报时间线">
            <Timeline
              items={[
                { color: currentSpeech ? 'blue' : 'gray', children: `当前：${currentSpeech?.text || '暂无下发中内容'}` },
                { color: nextSpeech ? 'green' : 'gray', children: `下一条：${nextSpeech?.text || '暂无待下发内容'}` },
                ...broadcasted.map((item) => ({ color: 'green', children: `已播报：${item.text}` })),
              ]}
            />
          </Card>
        </>
      ) : null}
    </>
  );
}
