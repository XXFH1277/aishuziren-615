import { Alert, Button, Card, Empty, List, Space, Steps, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getTroubleshootingList } from '../../services/helpService';

const stepStatusMap = {
  正常: 'finish',
  异常: 'error',
  待检查: 'process',
};

export default function Troubleshooting() {
  const [troubleshootingList, setTroubleshootingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState();

  const fetchTroubleshooting = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getTroubleshootingList({ page: 1, pageSize: 100 });
      const list = data.list || [];

      setTroubleshootingList(list);
      setSelectedId((current) => current || list[0]?.id);
    } catch (requestError) {
      const messageText = requestError.message || '快速排查加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTroubleshooting();
  }, [fetchTroubleshooting]);

  const selectedItem = useMemo(
    () => troubleshootingList.find((item) => item.id === selectedId) || troubleshootingList[0],
    [selectedId, troubleshootingList],
  );

  return (
    <>
      <PageHeader
        title="快速排查"
        description="通过步骤清单排查常见直播故障，当前通过本地 API 读取 SQLite 数据。"
        extra={
          <Button type="primary" onClick={() => message.success('提交技术工单为 Mock 入口，请到技术工单页继续填写')}>
            提交技术工单 Mock
          </Button>
        }
      />

      <Alert
        className="help-alert"
        type="warning"
        showIcon
        message="排查结果说明"
        description="排查项来自本地 SQLite；当前不读取真实日志、不连接 OBS、不访问直播平台，也不会向任何外部工单系统发送信息。"
      />

      {error ? <Alert className="help-alert" type="error" showIcon message={error} /> : null}

      <div className="help-troubleshooting-grid">
        <Card title="问题类型" className="panel-card" loading={loading}>
          <List
            dataSource={troubleshootingList}
            locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无排查项'} /> }}
            renderItem={(item) => (
              <List.Item
                className={item.id === selectedItem?.id ? 'help-list-item-active' : ''}
                onClick={() => setSelectedId(item.id)}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <span>{item.title}</span>
                      <Tag color="blue">{item.category}</Tag>
                    </Space>
                  }
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </Card>

        <Card
          title={selectedItem?.title || '排查步骤'}
          className="panel-card"
          loading={loading}
          extra={selectedItem ? <Tag color="blue">{selectedItem.category}</Tag> : null}
        >
          {selectedItem ? (
            <>
              <Typography.Paragraph type="secondary">{selectedItem.description}</Typography.Paragraph>
              <Steps
                direction="vertical"
                current={Math.max(selectedItem.steps.findIndex((item) => item.status !== '正常'), 0)}
                items={selectedItem.steps.map((step) => ({
                  title: (
                    <Space wrap>
                      <span>{step.title}</span>
                      <StatusTag status={step.status} />
                    </Space>
                  ),
                  description: step.status === '异常' ? <Typography.Text type="danger">{step.suggestion}</Typography.Text> : step.suggestion,
                  status: stepStatusMap[step.status],
                }))}
              />
              <Space className="help-panel-actions">
                <Button onClick={() => message.info('重新检测为 Mock 操作')}>重新检测 Mock</Button>
                <Button type="primary" onClick={() => message.success('已生成技术工单草稿 Mock')}>
                  提交技术工单
                </Button>
              </Space>
            </>
          ) : (
            <Empty description="请选择问题类型" />
          )}
        </Card>
      </div>
    </>
  );
}
