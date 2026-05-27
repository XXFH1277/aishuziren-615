import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Descriptions, Empty, Modal, Space, Table, Tag, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getSystemStatus } from '../../services/helpService';

export default function SystemStatus() {
  const [systemStatusList, setSystemStatusList] = useState([]);
  const [summary, setSummary] = useState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getSystemStatus();
      setSystemStatusList(data.list || []);
      setSummary(data.summary);
    } catch (requestError) {
      const messageText = requestError.message || '系统状态加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const stats = useMemo(
    () =>
      summary || {
        normal: systemStatusList.filter((item) => ['正常', 'Mock运行中'].includes(item.status)).length,
        abnormal: systemStatusList.filter((item) => ['异常', '部分异常'].includes(item.status)).length,
        reserved: systemStatusList.filter((item) => ['预留', '未配置'].includes(item.status)).length,
        totalAbnormal: systemStatusList.reduce((sum, item) => sum + item.abnormalCount, 0),
      },
    [summary, systemStatusList],
  );

  const columns = [
    { title: '服务名称', dataIndex: 'name', width: 180 },
    { title: '当前状态', dataIndex: 'status', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '最近检查时间', dataIndex: 'checkedAt', width: 160 },
    {
      title: '今日异常次数',
      dataIndex: 'abnormalCount',
      width: 120,
      render: (value) => <Badge count={value} showZero color={value ? '#f97316' : '#16a34a'} />,
    },
    { title: '说明', dataIndex: 'description' },
    {
      title: '操作',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="系统状态"
        description="查看关键模块状态，当前通过本地 API 读取 SQLite 中的 Mock 状态，不探测真实外部服务。"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchStatus} loading={loading}>
            刷新状态
          </Button>
        }
      />

      <Alert
        className="help-alert"
        type="info"
        showIcon
        message="系统状态说明"
        description="状态数据来自本地 SQLite，用于帮助理解系统模块边界，不代表真实可用性监控。"
      />

      {error ? <Alert className="help-alert" type="error" showIcon message={error} /> : null}

      <div className="help-status-grid">
        <DataCard title="正常 / Mock运行中" value={stats.normal} helper="无需立即处理的模块" tone="teal" />
        <DataCard title="部分异常" value={stats.abnormal} helper="需要排查的 Mock 模块" tone="rose" />
        <DataCard title="预留 / 未配置" value={stats.reserved} helper="后续阶段接入的能力" tone="blue" />
        <DataCard title="今日异常次数" value={stats.totalAbnormal} helper="来自 Mock 状态统计" tone="amber" />
      </div>

      <Card className="panel-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={systemStatusList}
          loading={loading}
          pagination={false}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无系统状态'} /> }}
        />
      </Card>

      <Modal title="状态详情 Mock" open={Boolean(detail)} onCancel={() => setDetail(null)} footer={null}>
        {detail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="服务名称">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <StatusTag status={detail.status} />
            </Descriptions.Item>
            <Descriptions.Item label="最近检查时间">{detail.checkedAt}</Descriptions.Item>
            <Descriptions.Item label="今日异常次数">{detail.abnormalCount}</Descriptions.Item>
            <Descriptions.Item label="说明">{detail.description}</Descriptions.Item>
            <Descriptions.Item label="操作提示">
              <Space wrap>
                <Tag>查看详情 Mock</Tag>
                <Tag>不连接真实服务</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  );
}
