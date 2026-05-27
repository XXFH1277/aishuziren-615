import { RedoOutlined, StepForwardOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Form, List, Select, Slider, Space, Switch, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import { getSubtitles, saveSubtitleSettings } from '../../services/delayControlService';

const defaultSubtitleStyle = {
  fontSize: 28,
  position: '底部',
  backgroundOpacity: 68,
  showSpeakerName: true,
  showRiskHint: true,
};

export default function SubtitlePreview() {
  const [subtitles, setSubtitles] = useState(null);
  const [style, setStyle] = useState(defaultSubtitleStyle);
  const [previewSubtitle, setPreviewSubtitle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadSubtitles() {
    try {
      setLoading(true);
      setError('');
      const data = await getSubtitles({});
      const nextSubtitles = data.subtitles || data;

      setSubtitles(nextSubtitles);
      setStyle(nextSubtitles?.subtitleStyle || defaultSubtitleStyle);
      setPreviewSubtitle(nextSubtitles?.currentSubtitle || null);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubtitles();
  }, []);

  const subtitleQueue = useMemo(() => {
    if (!subtitles) {
      return [];
    }

    return [subtitles.currentSubtitle, subtitles.nextSubtitle, ...(subtitles.upcomingSubtitles || [])].filter(Boolean);
  }, [subtitles]);

  const handleSaveStyle = async () => {
    try {
      setSaving(true);
      const saved = await saveSubtitleSettings({ subtitleStyle: style });
      setSubtitles(saved);
      message.success('已保存字幕样式到本地 API Mock');
    } catch (requestError) {
      message.error(requestError.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStyle(subtitles?.subtitleStyle || defaultSubtitleStyle);
    setPreviewSubtitle(subtitles?.currentSubtitle || null);
    message.info('已恢复当前本地 API 字幕样式');
  };

  return (
    <>
      <PageHeader
        title="字幕预览"
        description="本页用于互动播控能力的管理、调试、记录和复盘；直播进行中请优先使用直播管理 / 直播中控台。这里用于单独预览字幕样式、字幕位置和待播字幕效果。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      {!loading && !subtitles ? (
        <Card className="panel-card">
          <Empty description="暂无字幕预览数据" />
        </Card>
      ) : null}

      <div className="subtitle-preview-grid">
        <Card title="直播画面字幕预览框" className="panel-card" loading={loading}>
          {previewSubtitle ? (
            <>
              <div className={`subtitle-stage subtitle-position-${style.position}`}>
                <div className="subtitle-stage-top">舟山海鲜礼盒晚场 · Mock 预览</div>
                <div
                  className="subtitle-overlay"
                  style={{
                    fontSize: style.fontSize,
                    backgroundColor: `rgb(15 23 42 / ${style.backgroundOpacity / 100})`,
                  }}
                >
                  {style.showSpeakerName ? <strong>{previewSubtitle.speaker}：</strong> : null}
                  {previewSubtitle.text}
                </div>
                {style.showRiskHint ? (
                  <div className="subtitle-risk-hint">
                    <SpeechRiskTag level={previewSubtitle.riskLevel} />
                  </div>
                ) : null}
              </div>
              <Space wrap className="delay-action-row">
                <Button
                  icon={<StepForwardOutlined />}
                  onClick={() => {
                    setPreviewSubtitle(subtitles?.nextSubtitle || previewSubtitle);
                    message.success('已预览下一句 Mock');
                  }}
                >
                  预览下一句
                </Button>
                <Button type="primary" loading={saving} onClick={handleSaveStyle}>
                  应用样式
                </Button>
                <Button icon={<RedoOutlined />} onClick={handleReset}>
                  重置样式
                </Button>
              </Space>
            </>
          ) : (
            <Empty description="暂无可预览字幕" />
          )}
        </Card>

        <Card title="字幕设置" className="panel-card" loading={loading}>
          <Form layout="vertical">
            <Form.Item label={`字体大小：${style.fontSize}px`}>
              <Slider min={18} max={42} value={style.fontSize} onChange={(value) => setStyle((item) => ({ ...item, fontSize: value }))} />
            </Form.Item>
            <Form.Item label="字幕位置">
              <Select
                value={style.position}
                onChange={(value) => setStyle((item) => ({ ...item, position: value }))}
                options={['底部', '中下', '中间'].map((item) => ({ label: item, value: item }))}
              />
            </Form.Item>
            <Form.Item label={`背景透明度：${style.backgroundOpacity}%`}>
              <Slider min={20} max={90} value={style.backgroundOpacity} onChange={(value) => setStyle((item) => ({ ...item, backgroundOpacity: value }))} />
            </Form.Item>
            <Form.Item label="是否显示说话人名称">
              <Switch checked={style.showSpeakerName} onChange={(checked) => setStyle((item) => ({ ...item, showSpeakerName: checked }))} />
            </Form.Item>
            <Form.Item label="是否显示风险提示">
              <Switch checked={style.showRiskHint} onChange={(checked) => setStyle((item) => ({ ...item, showRiskHint: checked }))} />
            </Form.Item>
          </Form>
          <Alert type="info" showIcon message="字幕样式仅为 Mock" description="当前只保存到本地 SQLite，不会写入真实 OBS、执行端或直播画面。" />
        </Card>
      </div>

      <Card title="字幕队列" className="panel-card" loading={loading}>
        <List
          dataSource={subtitleQueue}
          locale={{ emptyText: <Empty description="暂无字幕队列" /> }}
          renderItem={(item) => (
            <List.Item actions={[<Button type="link" onClick={() => setPreviewSubtitle(item)} key="preview">预览</Button>]}>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text>{item.text}</Typography.Text>
                    <SpeechStatusTag status={item.status} />
                    <SpeechRiskTag level={item.riskLevel} />
                  </Space>
                }
                description={item.speaker}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );
}
