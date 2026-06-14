import { ApiOutlined, DisconnectOutlined, EyeOutlined, FileTextOutlined, LinkOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  generateExecutorBindCode,
  getBindingDeviceMock,
  getExecutorStatusOptions,
  getExecutors,
  refreshExecutorObsScenes,
  restartExecutor,
  sendExecutorSpeak,
  testExecutorObsConnection,
  unbindExecutor,
} from '../../services/executorService';

const executorStatusOptions = getExecutorStatusOptions();
const defaultBindingDeviceMock = getBindingDeviceMock();

const onlineStatuses = ['在线', '直播中', '更新中'];
const defaultStats = {
  online: 0,
  offline: 0,
  abnormal: 0,
  live: 0,
};

const commandStatusLabels = {
  pending: '待执行',
  queued: '待执行',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  timeout: '超时',
};

const commandStatusColors = {
  pending: 'gold',
  queued: 'gold',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  timeout: 'orange',
};

function buildStats(list) {
  return {
    online: list.filter((item) => onlineStatuses.includes(item.status)).length,
    offline: list.filter((item) => item.status === '离线').length,
    abnormal: list.filter((item) => item.status === '异常').length,
    live: list.filter((item) => item.status === '直播中').length,
  };
}

export default function ExecutorList() {
  const [executors, setExecutors] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 6, total: 0 });
  const [loading, setLoading] = useState(false);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [bindingOpen, setBindingOpen] = useState(false);
  const [bindingDevice, setBindingDevice] = useState(defaultBindingDeviceMock);
  const [detailRecord, setDetailRecord] = useState(null);
  const [speakRecord, setSpeakRecord] = useState(null);
  const [speakText, setSpeakText] = useState('');
  const [speakTone, setSpeakTone] = useState('natural');
  const [speakLoading, setSpeakLoading] = useState(false);

  const fetchExecutors = useCallback(
    async (page = 1, pageSize = pagination.pageSize) => {
      setLoading(true);
      setError('');

      try {
        const data = await getExecutors({
          keyword,
          status,
          page,
          pageSize,
        });
        const list = data.list || [];

        setExecutors(list);
        setStats(data.stats || buildStats(list));
        setPagination((current) => ({
          ...current,
          current: data.page || page,
          pageSize: data.pageSize || pageSize,
          total: data.total || 0,
        }));
      } catch (requestError) {
        const messageText = requestError.message || '执行端列表加载失败';
        setExecutors([]);
        setStats(defaultStats);
        setError(messageText);
        message.error(messageText);
      } finally {
        setLoading(false);
      }
    },
    [keyword, pagination.pageSize, status],
  );

  useEffect(() => {
    fetchExecutors(1, pagination.pageSize);
  }, [fetchExecutors, pagination.pageSize]);

  const handleOpenBinding = async () => {
    setBindingLoading(true);

    try {
      const data = await generateExecutorBindCode({ expiresInMinutes: 10 });
      setBindingDevice({
        code: data.bindCode,
        expiresIn: data.expiresAt,
        link: data.bindCodeId,
      });
      setBindingOpen(true);
    } catch (requestError) {
      message.error(requestError.message || '绑定码生成失败');
    } finally {
      setBindingLoading(false);
    }
  };

  const handleRestart = async (record) => {
    try {
      const data = await restartExecutor(record.id);
      message.success(data.message || `${record.name} Mock 重启指令已记录`);
      fetchExecutors(pagination.current, pagination.pageSize);
    } catch (requestError) {
      message.error(requestError.message || '重启指令记录失败');
    }
  };

  const handleObsTest = async (record) => {
    try {
      const data = await testExecutorObsConnection(record.id);
      message.success(data.message || 'OBS 测试连接指令已下发');
      fetchExecutors(pagination.current, pagination.pageSize);
    } catch (requestError) {
      message.error(requestError.message || 'OBS 测试连接指令下发失败');
    }
  };

  const handleRefreshObsScenes = async (record) => {
    try {
      const data = await refreshExecutorObsScenes(record.id);
      message.success(data.message || 'OBS 刷新场景指令已下发');
      fetchExecutors(pagination.current, pagination.pageSize);
    } catch (requestError) {
      message.error(requestError.message || 'OBS 刷新场景指令下发失败');
    }
  };

  const handleOpenSpeak = (record) => {
    setSpeakRecord(record);
    setSpeakTone('natural');
    setSpeakText('家人们，现在为大家测试一段数字人播报链路。');
  };

  const handleSubmitSpeak = async () => {
    const text = speakText.trim();

    if (!speakRecord || !text) {
      message.warning('请输入要下发的测试播报话术');
      return;
    }

    setSpeakLoading(true);

    try {
      const data = await sendExecutorSpeak(speakRecord.id, {
        text,
        tone: speakTone,
        source: 'executor_list_test',
      });
      message.success(data.message || '测试播报命令已下发');
      setSpeakRecord(null);
      setSpeakText('');
      fetchExecutors(pagination.current, pagination.pageSize);
    } catch (requestError) {
      message.error(requestError.message || '测试播报命令下发失败');
    } finally {
      setSpeakLoading(false);
    }
  };

  const handleUnbind = (record) => {
    Modal.confirm({
      title: '解绑执行端 Mock',
      content: `确认解绑「${record.name}」？当前仅记录 Mock 指令，不会影响真实设备。`,
      okText: '确认解绑',
      cancelText: '取消',
      onOk: async () => {
        try {
          const data = await unbindExecutor(record.id);
          message.success(data.message || 'Mock 解绑指令已记录');
          fetchExecutors(pagination.current, pagination.pageSize);
        } catch (requestError) {
          message.error(requestError.message || '解绑指令记录失败');
        }
      },
    });
  };

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
      title: '最近命令',
      dataIndex: 'latestCommand',
      width: 150,
      render: (value) =>
        value ? (
          <Space direction="vertical" size={2}>
            <Typography.Text>{value.commandType}</Typography.Text>
            <Tag color={commandStatusColors[value.status] || 'default'}>{commandStatusLabels[value.status] || value.status}</Tag>
          </Space>
        ) : (
          <Tag>暂无命令</Tag>
        ),
    },
    {
      title: '操作',
      fixed: 'right',
      width: 430,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRestart(record)}>
            重启
          </Button>
          <Button type="link" size="small" icon={<ApiOutlined />} onClick={() => handleObsTest(record)}>
            OBS测试
          </Button>
          <Button type="link" size="small" icon={<VideoCameraOutlined />} onClick={() => handleRefreshObsScenes(record)}>
            刷新场景
          </Button>
          <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleOpenSpeak(record)}>
            测试播报
          </Button>
          <Button type="link" danger size="small" icon={<DisconnectOutlined />} onClick={() => handleUnbind(record)}>
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
        description="管理绑定到云端后台的本地直播执行端，列表状态通过本地 API 读取 SQLite。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} loading={bindingLoading} onClick={handleOpenBinding}>
            生成绑定码
          </Button>
        }
      />

      <Alert
        className="executor-alert"
        type="info"
        showIcon
        message="当前为本地 Mock 占位，未接真实执行端。"
        description="执行端是未来安装在直播电脑上的本地程序；本阶段只验证本地 API 与 SQLite 链路，不新增 Electron / Tauri / Python 客户端，不连接真实 OBS、虚拟摄像头、直播伴侣或 WebSocket 心跳。"
      />

      <div className="executor-stat-grid">
        <DataCard title="在线执行端数量" value={stats.online} helper="包含在线、直播中、更新中状态" tone="teal" />
        <DataCard title="离线执行端数量" value={stats.offline} helper="最后心跳已停止的 Mock 设备" tone="blue" />
        <DataCard title="异常执行端数量" value={stats.abnormal} helper="需要运营或技术人员排查" tone="rose" />
        <DataCard title="正在直播执行端" value={stats.live} helper="当前绑定直播任务的本地执行端" tone="amber" />
      </div>

      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
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
            onChange={(value) => setStatus(value)}
            options={executorStatusOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={executors}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个执行端`,
          }}
          onChange={(nextPagination) => fetchExecutors(nextPagination.current, nextPagination.pageSize)}
          scroll={{ x: 1920 }}
          locale={{ emptyText: <Empty description="暂无符合条件的执行端" /> }}
        />
      </Card>

      <Modal
        title="生成执行端绑定码"
        open={bindingOpen}
        onCancel={() => setBindingOpen(false)}
        footer={[
          <Button
            key="copy"
            icon={<LinkOutlined />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(bindingDevice.code || '');
                message.success('绑定码已复制');
              } catch {
                message.info('当前浏览器不支持自动复制，请手动复制绑定码');
              }
            }}
          >
            复制绑定码
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
          message="绑定码仅显示一次"
          description="请在本地 executor-client 中设置 BIND_CODE 或 config.local.json，并在过期前启动客户端完成注册。device token 只会保存在本地客户端。"
        />
        <div className="executor-binding-panel">
          <div className="executor-binding-code">{bindingDevice.code}</div>
          <div className="executor-qr-placeholder">QR Mock</div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="过期时间">{bindingDevice.expiresIn}</Descriptions.Item>
          <Descriptions.Item label="绑定码ID">
            <Tooltip title="绑定码明文只在当前弹窗显示一次">
              <Typography.Text copyable={false}>{bindingDevice.link}</Typography.Text>
            </Tooltip>
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        title={speakRecord ? `测试播报 - ${speakRecord.name}` : '测试播报'}
        open={Boolean(speakRecord)}
        onCancel={() => setSpeakRecord(null)}
        onOk={handleSubmitSpeak}
        confirmLoading={speakLoading}
        okText="下发播报"
        cancelText="取消"
      >
        <Alert
          className="executor-modal-alert"
          type="info"
          showIcon
          message="当前只下发 speak 命令"
          description="真实播报由本地执行端的数字人适配器处理。默认 PrintAdapter 只打印话术并模拟成功，不接真实 DUIX、TTS 或推流。"
        />
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            value={speakTone}
            onChange={setSpeakTone}
            style={{ width: '100%' }}
            options={[
              { label: '自然', value: 'natural' },
              { label: '亲切', value: 'friendly' },
              { label: '热情', value: 'energetic' },
              { label: '专业', value: 'professional' },
            ]}
          />
          <Input.TextArea
            rows={4}
            maxLength={300}
            showCount
            value={speakText}
            onChange={(event) => setSpeakText(event.target.value)}
            placeholder="输入要让执行端数字人播报的测试话术"
          />
        </Space>
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
