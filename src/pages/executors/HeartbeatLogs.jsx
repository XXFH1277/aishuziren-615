import { EyeOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Modal, Progress, Select, Space, Table, Tag, Timeline, Typography } from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { executorHeartbeats, heartbeatLevels } from '../../mock/executorHeartbeats';
import { executors } from '../../mock/executors';

const { RangePicker } = DatePicker;

const levelColor = {
  info: 'green',
  warning: 'orange',
  error: 'red',
};

function progressStatus(value) {
  if (value >= 80) return 'exception';
  if (value >= 65) return 'active';
  return 'normal';
}

function parseTime(value) {
  return new Date(value.replace(/-/g, '/')).getTime();
}

export default function HeartbeatLogs() {
  const [keyword, setKeyword] = useState('');
  const [executorId, setExecutorId] = useState();
  const [level, setLevel] = useState();
  const [abnormalOnly, setAbnormalOnly] = useState();
  const [range, setRange] = useState();
  const [detailRecord, setDetailRecord] = useState(null);

  const filteredLogs = useMemo(
    () =>
      executorHeartbeats.filter((item) => {
        const lowerKeyword = keyword.toLowerCase();
        const matchKeyword =
          !keyword ||
          item.executorName.toLowerCase().includes(lowerKeyword) ||
          item.errorMessage.toLowerCase().includes(lowerKeyword) ||
          item.executorId.toLowerCase().includes(lowerKeyword);
        const matchExecutor = !executorId || item.executorId === executorId;
        const matchLevel = !level || item.level === level;
        const isAbnormal = item.level !== 'info' || item.errorMessage !== '无';
        const matchAbnormal = abnormalOnly === undefined || (abnormalOnly ? isAbnormal : !isAbnormal);
        const matchRange =
          !range?.[0] ||
          (parseTime(item.time) >= range[0].startOf('day').valueOf() && parseTime(item.time) <= range[1].endOf('day').valueOf());
        return matchKeyword && matchExecutor && matchLevel && matchAbnormal && matchRange;
      }),
    [abnormalOnly, executorId, keyword, level, range],
  );

  const columns = [
    { title: '时间', dataIndex: 'time', width: 170 },
    {
      title: '执行端名称',
      dataIndex: 'executorName',
      width: 180,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">{record.executorId}</div>
        </div>
      ),
    },
    { title: '在线状态', dataIndex: 'onlineStatus', width: 110, render: (value) => <StatusTag status={value} /> },
    { title: 'OBS状态', dataIndex: 'obsStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '虚拟摄像头', dataIndex: 'virtualCameraStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    {
      title: 'CPU占用 Mock',
      dataIndex: 'cpuUsage',
      width: 150,
      render: (value) => <Progress percent={value} size="small" status={progressStatus(value)} />,
    },
    {
      title: '内存占用 Mock',
      dataIndex: 'memoryUsage',
      width: 150,
      render: (value) => <Progress percent={value} size="small" status={progressStatus(value)} />,
    },
    {
      title: '网络延迟 Mock',
      dataIndex: 'networkLatency',
      width: 130,
      render: (value) => <Tag color={value > 100 ? 'red' : value > 60 ? 'orange' : 'green'}>{value}ms</Tag>,
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      width: 230,
      render: (value) => (value === '无' ? <Tag color="green">无</Tag> : <Typography.Text type="danger">{value}</Typography.Text>),
    },
    { title: '日志等级', dataIndex: 'level', width: 110, render: (value) => <Tag color={levelColor[value]}>{value}</Tag> },
    {
      title: '操作',
      fixed: 'right',
      width: 110,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="心跳日志"
        description="查看本地执行端上报的 Mock 状态日志，用于观察在线状态、OBS、虚拟摄像头、资源占用和异常提示。"
      />

      <Alert
        className="executor-alert"
        type="info"
        showIcon
        message="当前不接真实 WebSocket 心跳"
        description="日志来自前端 Mock 数据，不读取真实设备信息，不接后端，不持久化任何执行端状态。"
      />

      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索执行端、设备ID或错误信息"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <Select
            allowClear
            placeholder="执行端名称"
            value={executorId}
            onChange={setExecutorId}
            options={executors.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 190 }}
          />
          <Select
            allowClear
            placeholder="日志等级"
            value={level}
            onChange={setLevel}
            options={heartbeatLevels.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <RangePicker value={range} onChange={setRange} />
          <Select
            allowClear
            placeholder="是否异常"
            value={abnormalOnly}
            onChange={setAbnormalOnly}
            options={[
              { label: '仅异常', value: true },
              { label: '仅正常', value: false },
            ]}
            style={{ width: 130 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredLogs}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条心跳日志` }}
          scroll={{ x: 1540 }}
          locale={{ emptyText: <Empty description="暂无符合条件的心跳日志" /> }}
        />
      </Card>

      <Modal title="心跳日志详情" open={Boolean(detailRecord)} onCancel={() => setDetailRecord(null)} footer={null} width={760}>
        {detailRecord ? (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="执行端">{detailRecord.executorName}</Descriptions.Item>
              <Descriptions.Item label="设备ID">{detailRecord.executorId}</Descriptions.Item>
              <Descriptions.Item label="上报时间">{detailRecord.time}</Descriptions.Item>
              <Descriptions.Item label="日志等级">
                <Tag color={levelColor[detailRecord.level]}>{detailRecord.level}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="在线状态">
                <StatusTag status={detailRecord.onlineStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="OBS状态">
                <StatusTag status={detailRecord.obsStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="虚拟摄像头">
                <StatusTag status={detailRecord.virtualCameraStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="网络延迟">{detailRecord.networkLatency}ms</Descriptions.Item>
              <Descriptions.Item label="CPU占用">
                <Progress percent={detailRecord.cpuUsage} size="small" status={progressStatus(detailRecord.cpuUsage)} />
              </Descriptions.Item>
              <Descriptions.Item label="内存占用">
                <Progress percent={detailRecord.memoryUsage} size="small" status={progressStatus(detailRecord.memoryUsage)} />
              </Descriptions.Item>
            </Descriptions>

            <Timeline
              className="executor-heartbeat-timeline"
              items={[
                {
                  color: detailRecord.level === 'error' ? 'red' : detailRecord.level === 'warning' ? 'orange' : 'green',
                  children: `状态快照：在线=${detailRecord.onlineStatus}，OBS=${detailRecord.obsStatus}，虚拟摄像头=${detailRecord.virtualCameraStatus}`,
                },
                {
                  color: detailRecord.level === 'info' ? 'green' : 'red',
                  children: `错误描述：${detailRecord.errorMessage}`,
                },
                {
                  color: 'blue',
                  children:
                    detailRecord.level === 'info'
                      ? '建议处理：当前无需处理，继续观察下一次心跳。'
                      : '建议处理：检查本地执行端、OBS 场景来源、虚拟摄像头和网络状态。',
                },
                {
                  color: 'gray',
                  children: `原始日志 Mock：${JSON.stringify(detailRecord)}`,
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </>
  );
}
