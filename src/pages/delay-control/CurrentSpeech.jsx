import { PauseCircleOutlined, RedoOutlined, RollbackOutlined, StepForwardOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Descriptions, Empty, Row, Space, Tabs, Timeline, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import StatusTag from '../../components/StatusTag';
import { getCurrentSpeech } from '../../services/delayControlService';

function SpeechSummary({ speech, title }) {
  if (!speech) {
    return null;
  }

  return (
    <Card className="panel-card speech-summary-card" title={title} extra={<SpeechRiskTag level={speech.riskLevel} />}>
      <Typography.Paragraph className="speech-main-text">{speech.text}</Typography.Paragraph>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="来源">{speech.source}</Descriptions.Item>
        <Descriptions.Item label="动作">{speech.action}</Descriptions.Item>
        <Descriptions.Item label="语气">{speech.tone}</Descriptions.Item>
        <Descriptions.Item label="商品">{speech.productName}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export default function CurrentSpeech() {
  const [delayControl, setDelayControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError('');
        const data = await getCurrentSpeech({});

        if (mounted) {
          setDelayControl(data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const currentSpeech = delayControl?.currentSpeech;
  const nextSpeech = delayControl?.nextSpeech;
  const upcomingSpeech = delayControl?.upcomingSpeech || [];
  const riskSummary = delayControl?.riskSummary || {};

  return (
    <>
      <PageHeader
        title="当前播报"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。这里用于查看当前播报、下一句和下两句的播控预览。"
        extra={delayControl ? <Badge status="processing" text={`延迟模式：${delayControl.delayMode}`} /> : null}
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
              title="当前播报区域"
              loading={loading}
              extra={currentSpeech ? <SpeechRiskTag level={currentSpeech.riskLevel} /> : null}
            >
              <Typography.Paragraph className="speech-current-text">{currentSpeech?.text}</Typography.Paragraph>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="来源">{currentSpeech?.source}</Descriptions.Item>
                <Descriptions.Item label="当前动作">{currentSpeech?.action}</Descriptions.Item>
                <Descriptions.Item label="当前语气">{currentSpeech?.tone}</Descriptions.Item>
                <Descriptions.Item label="当前商品">{currentSpeech?.productName}</Descriptions.Item>
                <Descriptions.Item label="剩余时长">{currentSpeech?.remainingSeconds ?? '-'} 秒</Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <SpeechRiskTag level={currentSpeech?.riskLevel} />
                </Descriptions.Item>
              </Descriptions>
              <Space wrap className="delay-action-row">
                <Button icon={<PauseCircleOutlined />} onClick={() => message.info('暂停播报 Mock')}>
                  暂停播报
                </Button>
                <Button icon={<StepForwardOutlined />} onClick={() => message.info('跳过当前句 Mock')}>
                  跳过当前句
                </Button>
                <Button icon={<RedoOutlined />} onClick={() => message.success('重新生成 Mock')}>
                  重新生成
                </Button>
                <Button icon={<RollbackOutlined />} onClick={() => message.success('已切回商品主线 Mock')}>
                  切回商品主线
                </Button>
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
                message="播出前风险审核 Mock"
                description="高风险内容不会真实拦截执行端，本阶段只做本地 API 和前端提示。"
              />
            </Card>
          </div>

          <Tabs
            className="delay-tabs"
            items={[
              {
                key: 'upcoming',
                label: '即将播报',
                children: (
                  <div className="delay-upcoming-grid">
                    <SpeechSummary speech={nextSpeech} title="下一句话" />
                    {upcomingSpeech.map((item, index) => (
                      <SpeechSummary speech={item} title={`下${index + 2}句话`} key={item.id} />
                    ))}
                  </div>
                ),
              },
              {
                key: 'timeline',
                label: '播报时间线',
                children: (
                  <Card className="panel-card">
                    <Timeline
                      items={[
                        { color: 'green', children: `当前：${currentSpeech?.text || '-'}` },
                        { color: 'blue', children: `下一句：${nextSpeech?.text || '-'}` },
                        ...upcomingSpeech.map((item) => ({ color: item.riskLevel === '中' ? 'orange' : 'gray', children: item.text })),
                      ]}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
