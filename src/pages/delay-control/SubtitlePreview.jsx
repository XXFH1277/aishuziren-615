import { RedoOutlined, StepForwardOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, List, Select, Slider, Space, Switch, Typography, message } from 'antd';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import { subtitles } from '../../mock/subtitles';

export default function SubtitlePreview() {
  const [style, setStyle] = useState(subtitles.subtitleStyle);
  const [previewSubtitle, setPreviewSubtitle] = useState(subtitles.currentSubtitle);

  const subtitleQueue = [subtitles.currentSubtitle, subtitles.nextSubtitle, ...subtitles.upcomingSubtitles];

  return (
    <>
      <PageHeader title="字幕预览" description="模拟观众端看到的字幕效果，让运营人员提前预览数字人即将说的话。当前只做前端 Mock。" />

      <div className="subtitle-preview-grid">
        <Card title="直播画面字幕预览框" className="panel-card">
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
            <Button icon={<StepForwardOutlined />} onClick={() => { setPreviewSubtitle(subtitles.nextSubtitle); message.success('已预览下一句 Mock'); }}>
              预览下一句
            </Button>
            <Button type="primary" onClick={() => message.success('已应用字幕样式 Mock')}>
              应用样式
            </Button>
            <Button icon={<RedoOutlined />} onClick={() => { setStyle(subtitles.subtitleStyle); setPreviewSubtitle(subtitles.currentSubtitle); message.info('已重置样式 Mock'); }}>
              重置样式
            </Button>
          </Space>
        </Card>

        <Card title="字幕设置" className="panel-card">
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
          <Alert type="info" showIcon message="字幕样式仅为 Mock" description="当前不会写入真实 OBS、执行端或直播画面。" />
        </Card>
      </div>

      <Card title="字幕队列" className="panel-card">
        <List
          dataSource={subtitleQueue}
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
