import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Descriptions, Empty, Modal, Space, Table, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getSystemStatus } from '../../services/helpService';

const systemStatusList = getSystemStatus();

export default function SystemStatus() {
  const [detail, setDetail] = useState(null);

  const stats = useMemo(
    () => ({
      normal: systemStatusList.filter((item) => ['正常', 'Mock运行中'].includes(item.status)).length,
      abnormal: systemStatusList.filter((item) => ['异常', '部分异常'].includes(item.status)).length,
      reserved: systemStatusList.filter((item) => ['预留', '未配置'].includes(item.status)).length,
      totalAbnormal: systemStatusList.reduce((sum, item) => sum + item.abnormalCount, 0),
    }),
    [],
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
        description="查看关键模块状态。当前全部为 Mock，不探测真实服务，不连接数据库、模型服务、OBS 或执行端。"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => message.success('刷新系统状态为 Mock 操作')}>
            刷新状态 Mock
          </Button>
        }
      />

      <Alert
        className="help-alert"
        type="info"
        showIcon
        message="系统状态仅为前端 Mock"
        description="状态数据用于帮助理解系统模块边界，不代表真实可用性监控。"
      />

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
          pagination={false}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description="暂无系统状态" /> }}
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
