import { DisconnectOutlined, EyeOutlined, FileTextOutlined, LinkOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getBindingDeviceMock, getExecutorStatusOptions, getExecutors } from '../../services/executorService';

const executors = getExecutors();
const executorStatusOptions = getExecutorStatusOptions();
const bindingDeviceMock = getBindingDeviceMock();

const onlineStatuses = ['在线', '直播中', '更新中'];

export default function ExecutorList() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [bindingOpen, setBindingOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const filteredExecutors = useMemo(
    () =>
      executors.filter((item) => {
        const lowerKeyword = keyword.toLowerCase();
        const matchKeyword =
          !keyword ||
          item.name.toLowerCase().includes(lowerKeyword) ||
          item.deviceId.toLowerCase().includes(lowerKeyword) ||
          item.boundAccount.toLowerCase().includes(lowerKeyword) ||
          item.deviceName.toLowerCase().includes(lowerKeyword);
        const matchStatus = !status || item.status === status;
        return matchKeyword && matchStatus;
      }),
    [keyword, status],
  );

  const stats = useMemo(
    () => ({
      online: executors.filter((item) => onlineStatuses.includes(item.status)).length,
      offline: executors.filter((item) => item.status === '离线').length,
      abnormal: executors.filter((item) => item.status === '异常').length,
      live: executors.filter((item) => item.status === '直播中').length,
    }),
    [],
  );

  const columns = [
    {
      title: '执行端名称',
      dataIndex: 'name',
      width: 190,
      render: (value, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">{record.notes}</div>
        </div>
      ),
    },
    { title: '设备ID', dataIndex: 'deviceId', width: 150 },
    { title: '绑定账号', dataIndex: 'boundAccount', width: 140 },
    { title: '所在设备', dataIndex: 'deviceName', width: 150 },
    { title: '系统类型', dataIndex: 'os', width: 110 },
    { title: '当前状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={value} /> },
    {
      title: '当前直播任务',
      dataIndex: 'currentLiveTask',
      width: 190,
      render: (value) => (value === '无' ? <Tag>无任务</Tag> : value),
    },
    { title: 'OBS状态', dataIndex: 'obsStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '虚拟摄像头', dataIndex: 'virtualCameraStatus', width: 120, render: (value) => <StatusTag status={value} /> },
    { title: '执行端版本', dataIndex: 'version', width: 150 },
    { title: '最后心跳时间', dataIndex: 'lastHeartbeatAt', width: 170 },
    {
      title: '操作',
      fixed: 'right',
      width: 250,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => message.info(`${record.name} 重启指令为 Mock，不会触达真实设备`)}>
            重启
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DisconnectOutlined />}
            onClick={() =>
              Modal.confirm({
                title: '解绑执行端 Mock',
                content: `确认解绑「${record.name}」？当前仅展示确认流程，不会写入后台或影响真实设备。`,
                okText: '确认解绑',
                cancelText: '取消',
                onOk: () => message.warning('解绑操作已触发 Mock 提示'),
              })
            }
          >
            解绑
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => message.info('查看日志为 Mock 入口，请在心跳日志页面筛选该执行端')}>
            查看日志
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="执行端列表"
        description="管理绑定到云端后台的本地直播执行端，当前仅展示本地直播电脑、OBS、虚拟摄像头和心跳状态的 Mock 数据。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setBindingOpen(true)}>
            绑定新设备 Mock
          </Button>
        }
      />

      <Alert
        className="executor-alert"
        type="info"
        showIcon
        message="执行端是未来安装在直播电脑上的本地程序"
        description="本阶段不新增 Electron / Tauri / Python 客户端，不连接真实 OBS、虚拟摄像头、直播伴侣或 WebSocket 心跳；所有状态和操作均为前端 Mock。"
      />

      <div className="executor-stat-grid">
        <DataCard title="在线执行端数量" value={stats.online} helper="包含在线、直播中、更新中状态" tone="teal" />
        <DataCard title="离线执行端数量" value={stats.offline} helper="最后心跳已停止的 Mock 设备" tone="blue" />
        <DataCard title="异常执行端数量" value={stats.abnormal} helper="需要运营或技术人员排查" tone="rose" />
        <DataCard title="正在直播执行端" value={stats.live} helper="当前绑定直播任务的本地执行端" tone="amber" />
      </div>

      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索执行端名称、设备ID、账号或设备"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 340 }}
          />
          <Select
            allowClear
            placeholder="当前状态"
            value={status}
            onChange={setStatus}
            options={executorStatusOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredExecutors}
          pagination={{ pageSize: 6, showTotal: (total) => `共 ${total} 个执行端` }}
          scroll={{ x: 1700 }}
          locale={{ emptyText: <Empty description="暂无符合条件的执行端" /> }}
        />
      </Card>

      <Modal
        title="绑定新设备 Mock"
        open={bindingOpen}
        onCancel={() => setBindingOpen(false)}
        footer={[
          <Button key="copy" icon={<LinkOutlined />} onClick={() => message.success('绑定链接已复制 Mock')}>
            复制绑定链接 Mock
          </Button>,
          <Button key="close" type="primary" onClick={() => setBindingOpen(false)}>
            知道了
          </Button>,
        ]}
      >
        <Alert
          className="executor-modal-alert"
          type="warning"
          showIcon
          message="真实绑定功能后续由本地执行端登录或扫码完成"
          description="当前只展示绑定码、二维码占位和有效期，不写入数据库，也不会注册真实设备。"
        />
        <div className="executor-binding-panel">
          <div className="executor-binding-code">{bindingDeviceMock.code}</div>
          <div className="executor-qr-placeholder">QR Mock</div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="绑定有效期">{bindingDeviceMock.expiresIn}</Descriptions.Item>
          <Descriptions.Item label="绑定链接">
            <Tooltip title="仅为虚构 Mock 链接">
              <Typography.Text copyable={false}>{bindingDeviceMock.link}</Typography.Text>
            </Tooltip>
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal title="执行端详情" open={Boolean(detailRecord)} onCancel={() => setDetailRecord(null)} footer={null} width={760}>
        {detailRecord ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="执行端名称">{detailRecord.name}</Descriptions.Item>
            <Descriptions.Item label="设备ID">{detailRecord.deviceId}</Descriptions.Item>
            <Descriptions.Item label="绑定账号">{detailRecord.boundAccount}</Descriptions.Item>
            <Descriptions.Item label="所在设备">{detailRecord.deviceName}</Descriptions.Item>
            <Descriptions.Item label="系统类型">{detailRecord.os}</Descriptions.Item>
            <Descriptions.Item label="执行端版本">{detailRecord.version}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <StatusTag status={detailRecord.status} />
            </Descriptions.Item>
            <Descriptions.Item label="当前直播任务">{detailRecord.currentLiveTask}</Descriptions.Item>
            <Descriptions.Item label="OBS状态">
              <StatusTag status={detailRecord.obsStatus} />
            </Descriptions.Item>
            <Descriptions.Item label="虚拟摄像头">
              <StatusTag status={detailRecord.virtualCameraStatus} />
            </Descriptions.Item>
            <Descriptions.Item label="最近心跳">{detailRecord.lastHeartbeatAt}</Descriptions.Item>
            <Descriptions.Item label="错误信息 / 备注">{detailRecord.notes}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  );
}
