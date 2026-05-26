import { ApiOutlined, EyeOutlined, PlayCircleOutlined, ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, List, Modal, Progress, Space, Table, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { executorObsList, obsChecklist } from '../../mock/executorObs';

export default function ObsStatus() {
  const [sourceRecord, setSourceRecord] = useState(null);

  const activeObs = useMemo(
    () => executorObsList.find((item) => item.obsStatus === '已连接') || executorObsList[0],
    [],
  );

  const passedChecklist = obsChecklist.filter((item) => item.checked).length;
  const checklistPercent = Math.round((passedChecklist / obsChecklist.length) * 100);

  const columns = [
    {
      title: '执行端名称',
      dataIndex: 'executorName',
      width: 180,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">最近连接：{record.lastConnectedAt}</div>
        </div>
      ),
    },
    { title: 'OBS状态', dataIndex: 'obsStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '当前场景', dataIndex: 'currentScene', width: 180 },
    { title: '来源数量', dataIndex: 'sourceCount', width: 90 },
    { title: '虚拟摄像头', dataIndex: 'virtualCameraStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '输出状态', dataIndex: 'outputStatus', width: 110, render: (value) => <StatusTag status={value} /> },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      width: 240,
      render: (value) => (value === '无' ? <Tag color="green">无</Tag> : <Typography.Text type="danger">{value}</Typography.Text>),
    },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<ApiOutlined />} onClick={() => message.info(`${record.executorName} 测试连接为 Mock 操作`)}>
            测试连接
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => message.success('刷新场景为 Mock 操作，不连接真实 OBS')}>
            刷新场景
          </Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSourceRecord(record)}>
            查看来源
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="OBS连接状态"
        description="查看本地执行端与 OBS 的 Mock 连接状态、场景来源和输出检查结果；当前不连接真实 OBS，也不调用 OBS WebSocket。"
        extra={
          <Space wrap>
            <Button icon={<ApiOutlined />} onClick={() => message.info('测试连接为 Mock 操作，不会访问本地 OBS')}>
              测试连接 Mock
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => message.success('刷新场景为 Mock 操作')}>
              刷新场景 Mock
            </Button>
            <Button icon={<VideoCameraOutlined />} onClick={() => message.info('打开虚拟摄像头为 Mock 操作')}>
              打开虚拟摄像头 Mock
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => message.warning('重启 OBS 连接为 Mock 操作')}>
              重启 OBS 连接 Mock
            </Button>
          </Space>
        }
      />

      <Alert
        className="executor-alert"
        type="warning"
        showIcon
        message="当前全部为 Mock，不连接真实 OBS"
        description="这里仅模拟执行端上报的 OBS 版本、场景、来源、分辨率和虚拟摄像头状态，不会访问本机端口或任何 OBS WebSocket 服务。"
      />

      <div className="executor-stat-grid">
        <DataCard title="OBS连接状态" value={activeObs.obsStatus} helper={`执行端：${activeObs.executorName}`} tone="teal" status={activeObs.obsStatus} />
        <DataCard title="OBS版本" value={activeObs.obsVersion} helper={`当前场景：${activeObs.currentScene}`} tone="blue" />
        <DataCard title="当前来源数量" value={activeObs.sourceCount} helper={`${activeObs.resolution} / ${activeObs.fps}fps`} tone="amber" />
        <DataCard title="最后连接时间" value={activeObs.lastConnectedAt} helper={`输出状态：${activeObs.outputStatus}`} tone="rose" status={activeObs.outputStatus} />
      </div>

      <div className="executor-obs-grid">
        <Card title="执行端 OBS 列表" className="panel-card">
          <Table
            rowKey="executorId"
            columns={columns}
            dataSource={executorObsList}
            pagination={{ pageSize: 6, showTotal: (total) => `共 ${total} 条 OBS 状态` }}
            scroll={{ x: 1320 }}
            locale={{ emptyText: <Empty description="暂无 OBS 状态" /> }}
          />
        </Card>

        <Card title="OBS输出检查清单" className="panel-card executor-checklist-card">
          <Progress percent={checklistPercent} status={checklistPercent === 100 ? 'success' : 'exception'} />
          <List
            className="executor-checklist-list"
            dataSource={obsChecklist}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  <StatusTag status={item.checked ? '已通过' : '缺失'} />
                  <span>{item.label}</span>
                </Space>
              </List.Item>
            )}
          />
          <Alert
            className="executor-modal-alert"
            type={checklistPercent === 100 ? 'success' : 'warning'}
            showIcon
            message="检查结果为 Mock"
            description="真实执行端上线后，该清单应由本地执行端上报 OBS 场景、来源和输出状态。"
          />
        </Card>
      </div>

      <Modal title={sourceRecord ? `${sourceRecord.executorName} 场景来源 Mock` : '场景来源 Mock'} open={Boolean(sourceRecord)} onCancel={() => setSourceRecord(null)} footer={null}>
        {sourceRecord ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="当前场景">{sourceRecord.currentScene}</Descriptions.Item>
              <Descriptions.Item label="来源数量">{sourceRecord.sourceCount}</Descriptions.Item>
              <Descriptions.Item label="错误信息">{sourceRecord.errorMessage}</Descriptions.Item>
            </Descriptions>
            <List
              className="executor-source-list"
              dataSource={sourceRecord.sceneSources}
              locale={{ emptyText: <Empty description="暂无场景来源" /> }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item.name} description={item.type} />
                  <StatusTag status={item.status} />
                </List.Item>
              )}
            />
          </>
        ) : null}
      </Modal>
    </>
  );
}
