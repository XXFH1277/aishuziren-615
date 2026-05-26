import { CheckOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Descriptions, Empty, Form, Input, List, Select, Space, Timeline, Typography, message } from 'antd';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import StatusTag from '../../components/StatusTag';
import { broadcastModes, manualTakeover, takeoverActions, takeoverTones } from '../../mock/manualTakeover';

export default function ManualTakeover() {
  const [form] = Form.useForm();
  const [suggestion, setSuggestion] = useState('');

  const handleSubmit = ({ speechText, broadcastMode }) => {
    if (!speechText?.trim()) {
      message.warning('请先输入要让数字人播报的话术');
      return;
    }
    if (broadcastMode === '仅生成建议 Mock') {
      setSuggestion(`建议话术：${speechText}。请先确认价格、售后和绝对化表述风险。`);
      message.success('已生成 Mock 建议，不调用真实 AI');
      return;
    }
    message.success(`${broadcastMode} 已触发，仅为前端 Mock，不调用数字人播报`);
  };

  const fillReply = (reply) => {
    form.setFieldValue('speechText', reply);
    setSuggestion('');
    message.info('已填入人工输入框');
  };

  return (
    <>
      <PageHeader
        title="人工接管台"
        description="运营人员可手动输入一句话，选择语气和动作后模拟数字人播报流程。当前不调用真实数字人或执行端。"
        extra={<Badge status="processing" text="人工接管 Mock 已就绪" />}
      />

      <div className="manual-console-grid">
        <div className="takeover-card-stack">
          <Card title="当前直播状态" className="panel-card">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="当前直播间">{manualTakeover.currentLiveRoom}</Descriptions.Item>
              <Descriptions.Item label="当前直播任务">{manualTakeover.currentLiveTask}</Descriptions.Item>
              <Descriptions.Item label="当前数字人">{manualTakeover.currentAvatar}</Descriptions.Item>
              <Descriptions.Item label="当前商品组">{manualTakeover.currentProductGroup}</Descriptions.Item>
              <Descriptions.Item label="当前播报状态">
                <StatusTag status={manualTakeover.speechStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="执行端状态">
                <StatusTag status={manualTakeover.executorStatus} />
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Alert
            type="info"
            showIcon
            className="interaction-alert"
            message="当前为 Mock 控制台"
            description="插队、待播、建议生成和通过操作都只更新前端反馈，不会写入延迟播控模块。"
          />
        </div>

        <Card title="人工输入与控制" className="panel-card takeover-control-card">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              tone: '亲切',
              action: '看评论区',
              broadcastMode: '立即插队 Mock',
            }}
            onFinish={handleSubmit}
          >
            <Form.Item label="输入要让数字人说的话" name="speechText">
              <Input.TextArea rows={7} placeholder="输入人工接管话术，例如：这款礼盒适合送礼，发货以订单页提示为准。" />
            </Form.Item>
            <div className="form-grid">
              <Form.Item label="选择语气" name="tone">
                <Select options={takeoverTones.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="选择动作" name="action">
                <Select options={takeoverActions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="播报方式" name="broadcastMode">
                <Select options={broadcastModes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </div>
            <Space wrap>
              <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />}>
                执行 Mock 操作
              </Button>
              <Button onClick={() => form.setFieldValue('broadcastMode', '加入待播队列 Mock')}>加入待播队列</Button>
              <Button onClick={() => form.setFieldValue('broadcastMode', '仅生成建议 Mock')}>仅生成建议</Button>
              <Button onClick={() => form.resetFields()}>清空</Button>
            </Space>
          </Form>
          {suggestion ? <div className="mock-preview-result takeover-suggestion">{suggestion}</div> : null}
        </Card>

        <div className="takeover-card-stack">
          <Card title="推荐回复区" className="panel-card">
            <List
              dataSource={manualTakeover.recommendedReplies}
              renderItem={(item) => (
                <List.Item actions={[<Button type="link" onClick={() => fillReply(item)} key="fill">填入</Button>]}>
                  <Typography.Text>{item}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>

          <Card title="待播预览" className="panel-card">
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div className="speech-preview-item">
                      <strong>当前播报</strong>
                      <p>{manualTakeover.currentSpeech}</p>
                    </div>
                  ),
                },
                {
                  color: 'blue',
                  children: (
                    <div className="speech-preview-item">
                      <strong>下一句话</strong>
                      <p>{manualTakeover.nextSpeech}</p>
                    </div>
                  ),
                },
                ...manualTakeover.upcomingSpeech.map((item) => ({
                  color: item.riskLevel === '中' ? 'orange' : 'gray',
                  children: (
                    <div className="speech-preview-item">
                      <Space>
                        <strong>{item.status}</strong>
                        <RiskTag level={item.riskLevel} />
                      </Space>
                      <p>{item.content}</p>
                      <Space size={4} wrap>
                        <Button size="small" icon={<EditOutlined />} onClick={() => message.info('编辑为 Mock 操作')}>
                          编辑
                        </Button>
                        <Button size="small" icon={<DeleteOutlined />} onClick={() => message.info('删除为 Mock 操作')}>
                          删除
                        </Button>
                        <Button size="small" icon={<CheckOutlined />} onClick={() => message.success('已通过 Mock 审核')}>
                          通过
                        </Button>
                      </Space>
                    </div>
                  ),
                })),
              ]}
            />
          </Card>

          <Card title="风险提示" className="panel-card">
            {manualTakeover.riskWarnings.length ? (
              <List
                dataSource={manualTakeover.riskWarnings}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={<Space><span>{item.type}</span><RiskTag level={item.level} /></Space>} description={item.content} />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无风险提示" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
