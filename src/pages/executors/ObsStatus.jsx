import { ApiOutlined, EyeOutlined, LinkOutlined, ReloadOutlined, SaveOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, List, Modal, Progress, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  getExecutorObsStatus,
  getLocalObsConfig,
  getObsChecklist,
  refreshExecutorObsScenes,
  refreshLocalObsScenes,
  saveLocalObsConfig,
  setLocalObsVirtualCamera,
  testExecutorObsConnection,
  testLocalObsConnection,
  upsertLocalObsBrowserSource,
} from '../../services/executorService';

const defaultObsChecklist = getObsChecklist();
const defaultObsOutputUrl = 'http://127.0.0.1:5173/obs/output';
const defaultPreviewStreamUrl =
  'http://127.0.0.1:8080/players/srs_player.html?autostart=true&schema=http&host=127.0.0.1&port=8080&app=live&stream=dh';
const defaultPreviewIngestUrl = 'rtmp://127.0.0.1/live/dh';
const previewStreamTypeOptions = [
  { label: '网页播放器 / SRS Player', value: 'iframe' },
  { label: '原生 video 地址', value: 'video' },
];
const emptyObs = {
  executorId: '',
  executorName: '暂无执行端',
  obsStatus: '未连接',
  obsVersion: '未知',
  currentScene: '无',
  sourceCount: 0,
  resolution: '未设置',
  fps: 0,
  virtualCameraStatus: '未开启',
  outputStatus: '未输出',
  errorMessage: '无',
  sceneSources: [],
  lastConnectedAt: '无',
};

export default function ObsStatus() {
  const [obsForm] = Form.useForm();
  const [executorObsList, setExecutorObsList] = useState([]);
  const [obsChecklist, setObsChecklist] = useState(defaultObsChecklist);
  const [loading, setLoading] = useState(false);
  const [localObsLoading, setLocalObsLoading] = useState(false);
  const [localObsConfig, setLocalObsConfig] = useState(null);
  const [localObsStatus, setLocalObsStatus] = useState(null);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [error, setError] = useState('');
  const [sourceRecord, setSourceRecord] = useState(null);

  const fetchObsStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getExecutorObsStatus({ page: 1, pageSize: 100 });
      setExecutorObsList(data.list || []);
      setObsChecklist(data.checklist?.length ? data.checklist : defaultObsChecklist);
    } catch (requestError) {
      const messageText = requestError.message || 'OBS 状态加载失败';
      setExecutorObsList([]);
      setObsChecklist(defaultObsChecklist);
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObsStatus();
  }, [fetchObsStatus]);

  const fetchLocalObsConfig = useCallback(async () => {
    try {
      const data = await getLocalObsConfig();
      const config = data.config || {};
      setLocalObsConfig(config);
      setEncryptionConfigured(Boolean(data.encryptionConfigured));
      setLocalObsStatus(config.lastStatus || null);
      obsForm.setFieldsValue({
        obsUrl: config.obsUrl || 'ws://127.0.0.1:4455',
        password: '',
        obsTimeoutMs: config.obsTimeoutMs || 5000,
        sceneName: config.sceneName || '',
        browserSourceName: config.browserSourceName || '数字人直播画面',
        browserSourceUrl: config.browserSourceUrl || defaultObsOutputUrl,
        browserSourceWidth: config.browserSourceWidth || 1080,
        browserSourceHeight: config.browserSourceHeight || 1920,
        previewStreamEnabled: config.previewStreamEnabled !== false,
        previewStreamType: config.previewStreamType || 'iframe',
        previewStreamUrl: config.previewStreamUrl || defaultPreviewStreamUrl,
        previewIngestUrl: config.previewIngestUrl || defaultPreviewIngestUrl,
      });
    } catch (requestError) {
      message.warning(requestError.message || '本机 OBS 配置加载失败');
    }
  }, [obsForm]);

  useEffect(() => {
    fetchLocalObsConfig();
  }, [fetchLocalObsConfig]);

  const activeObs = useMemo(
    () => executorObsList.find((item) => item.obsStatus === '已连接') || executorObsList[0] || emptyObs,
    [executorObsList],
  );

  const displayObs = useMemo(
    () =>
      localObsStatus?.obsStatus
        ? {
            ...emptyObs,
            executorId: 'LOCAL_OBS',
            executorName: '本机 OBS WebSocket',
            obsStatus: localObsStatus.obsStatus,
            obsVersion: localObsStatus.obsVersion || '未知',
            currentScene: localObsStatus.currentScene || '无',
            sourceCount: Number(localObsStatus.sourceCount || localObsStatus.sceneSources?.length || 0),
            resolution: localObsStatus.resolution || '未设置',
            fps: Number(localObsStatus.fps || 0),
            virtualCameraStatus: localObsStatus.virtualCameraStatus || '未开启',
            outputStatus: localObsStatus.outputStatus || '预览中',
            errorMessage: localObsStatus.errorMessage || '无',
            sceneSources: localObsStatus.sceneSources || [],
            lastConnectedAt: localObsStatus.checkedAt || localObsStatus.updatedAt || '无',
          }
        : activeObs,
    [activeObs, localObsStatus],
  );

  const passedChecklist = obsChecklist.filter((item) => item.checked).length;
  const checklistPercent = obsChecklist.length ? Math.round((passedChecklist / obsChecklist.length) * 100) : 0;

  const handleObsTest = async (executorId) => {
    if (!executorId) {
      message.info('暂无可测试的执行端');
      return;
    }

    try {
      const data = await testExecutorObsConnection(executorId);
      message.success(data.message || 'OBS 测试连接指令已下发，请等待本地执行端回执');
      fetchObsStatus();
    } catch (requestError) {
      message.error(requestError.message || 'OBS 测试连接失败');
    }
  };

  const handleRefreshScenes = async (executorId) => {
    if (!executorId) {
      message.info('暂无可刷新的执行端');
      return;
    }

    try {
      const data = await refreshExecutorObsScenes(executorId);
      message.success(data.message || 'OBS 刷新场景指令已下发，请等待本地执行端回执');
      fetchObsStatus();
    } catch (requestError) {
      message.error(requestError.message || '刷新场景失败');
    }
  };

  const readObsFormValues = async () => {
    const values = await obsForm.validateFields();
    return {
      ...values,
      password: values.password || '',
    };
  };

  const handleSaveLocalObs = async () => {
    try {
      const values = await readObsFormValues();
      setLocalObsLoading(true);
      const data = await saveLocalObsConfig(values);
      setLocalObsConfig(data.config || null);
      setEncryptionConfigured(Boolean(data.encryptionConfigured));
      obsForm.setFieldsValue({ password: '' });

      if (data.passwordSaveWarning) {
        message.warning(data.passwordSaveWarning);
      } else {
        message.success('本机 OBS 配置已保存');
      }
    } catch (requestError) {
      message.error(requestError.message || '保存 OBS 配置失败');
    } finally {
      setLocalObsLoading(false);
    }
  };

  const handleLocalObsAction = async (action, successText) => {
    try {
      const values = await readObsFormValues();
      setLocalObsLoading(true);
      const data = await action(values);
      setLocalObsStatus(data.status || data.obsStatus || null);
      message.success(successText);
      await fetchObsStatus();
    } catch (requestError) {
      message.error(requestError.message || 'OBS 操作失败');
    } finally {
      setLocalObsLoading(false);
    }
  };

  const handleLocalObsTest = () => {
    handleLocalObsAction(testLocalObsConnection, '本机 OBS 连接测试完成');
  };

  const handleLocalObsRefresh = () => {
    handleLocalObsAction(refreshLocalObsScenes, '已读取本机 OBS 场景和来源');
  };

  const handleLocalObsBrowserSource = () => {
    handleLocalObsAction(upsertLocalObsBrowserSource, '已创建或更新数字人浏览器源');
  };

  const handleLocalObsVirtualCamera = () => {
    handleLocalObsAction((values) => setLocalObsVirtualCamera({ ...values, action: 'start' }), '已请求开启 OBS 虚拟摄像头');
  };

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
          <Button type="link" size="small" icon={<ApiOutlined />} onClick={() => handleObsTest(record.executorId)}>
            测试连接
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRefreshScenes(record.executorId)}>
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
        description="连接本机 OBS WebSocket，读取真实版本、当前场景、来源列表，并可创建数字人浏览器源。"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchObsStatus} loading={loading}>
              刷新状态
            </Button>
            <Button type="primary" icon={<ApiOutlined />} onClick={handleLocalObsTest} loading={localObsLoading}>
              测试本机 OBS
            </Button>
          </Space>
        }
      />

      <Alert
        className="executor-alert"
        type="info"
        showIcon
        message="OBS 接入 MVP：先连接本机 OBS，再把纯数字人输出页作为浏览器源放进 OBS。"
        description="请先在 OBS 的 工具 / WebSocket 服务器设置 中启用 WebSocket 服务。数字人画面 URL 应使用 5173/obs/output；不要使用 8010/index.html，那是 LiveTalking 调试台。竖屏带货建议把 OBS 基础画布和输出分辨率设为 1080x1920。"
      />

      <Card title="本机 OBS WebSocket MVP" className="panel-card obs-mvp-card">
        <Form form={obsForm} layout="vertical">
          <div className="obs-mvp-grid">
            <Form.Item name="obsUrl" label="OBS WebSocket 地址" rules={[{ required: true, message: '请输入 OBS WebSocket 地址' }]}>
              <Input placeholder="ws://127.0.0.1:4455" />
            </Form.Item>
            <Form.Item
              name="password"
              label={encryptionConfigured ? 'OBS 密码（可保存加密）' : 'OBS 密码（本次临时使用）'}
              extra={localObsConfig?.passwordConfigured ? `已有密码来源：${localObsConfig.passwordSource}` : 'OBS 未设置密码可留空'}
            >
              <Input.Password placeholder="未设置密码可留空" autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="obsTimeoutMs" label="连接超时">
              <InputNumber min={1000} max={30000} step={1000} addonAfter="ms" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sceneName" label="目标场景">
              <Input placeholder="留空则使用 OBS 当前场景" />
            </Form.Item>
            <Form.Item name="browserSourceName" label="浏览器源名称">
              <Input placeholder="数字人直播画面" />
            </Form.Item>
            <Form.Item
              name="browserSourceUrl"
              label="数字人画面 URL"
              extra="OBS 应该抓这个纯输出页；如需指定形象可追加 ?avatar=你的LiveTalkingAvatarId"
            >
              <Input placeholder={defaultObsOutputUrl} />
            </Form.Item>
            <Form.Item name="browserSourceWidth" label="源宽度">
              <InputNumber min={320} max={3840} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="browserSourceHeight" label="源高度">
              <InputNumber min={320} max={3840} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="previewStreamEnabled"
              label="中控台实时预览"
              valuePropName="checked"
              extra="开启后，中控台会优先播放 OBS 推到本机流媒体服务后的画面。"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name="previewStreamType" label="预览播放方式">
              <Select options={previewStreamTypeOptions} />
            </Form.Item>
            <Form.Item
              name="previewIngestUrl"
              label="OBS 本地推流地址"
              extra="在 OBS 直播设置中把服务器/串流密钥指向这里对应的本机服务，例如 SRS 的 rtmp://127.0.0.1/live/dh。"
            >
              <Input placeholder={defaultPreviewIngestUrl} />
            </Form.Item>
            <Form.Item
              name="previewStreamUrl"
              label="中控台播放地址"
              extra="中控台会播放这个地址。默认是本机 SRS 播放器；如果换成 HLS/WebRTC，也可以填对应 URL。"
            >
              <Input placeholder={defaultPreviewStreamUrl} />
            </Form.Item>
          </div>
        </Form>

        <Space wrap className="obs-mvp-actions">
          <Button icon={<SaveOutlined />} onClick={handleSaveLocalObs} loading={localObsLoading}>
            保存配置
          </Button>
          <Button icon={<ApiOutlined />} onClick={handleLocalObsTest} loading={localObsLoading}>
            测试连接
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleLocalObsRefresh} loading={localObsLoading}>
            刷新场景来源
          </Button>
          <Button icon={<LinkOutlined />} onClick={handleLocalObsBrowserSource} loading={localObsLoading}>
            创建/更新浏览器源
          </Button>
          <Button
            onClick={() => {
              obsForm.setFieldValue('browserSourceUrl', defaultObsOutputUrl);
              message.info('已切换为 OBS 纯输出页 URL');
            }}
          >
            使用纯输出页
          </Button>
          <Button icon={<VideoCameraOutlined />} onClick={handleLocalObsVirtualCamera} loading={localObsLoading}>
            开启虚拟摄像头
          </Button>
        </Space>

        <Descriptions bordered size="small" column={4} className="obs-mvp-status">
          <Descriptions.Item label="连接状态">
            <StatusTag status={displayObs.obsStatus} />
          </Descriptions.Item>
          <Descriptions.Item label="OBS版本">{displayObs.obsVersion}</Descriptions.Item>
          <Descriptions.Item label="当前场景">{displayObs.currentScene}</Descriptions.Item>
          <Descriptions.Item label="来源数量">{displayObs.sourceCount}</Descriptions.Item>
          <Descriptions.Item label="输出规格">{displayObs.resolution}</Descriptions.Item>
          <Descriptions.Item label="帧率">{displayObs.fps} FPS</Descriptions.Item>
          <Descriptions.Item label="虚拟摄像头">
            <StatusTag status={displayObs.virtualCameraStatus} />
          </Descriptions.Item>
          <Descriptions.Item label="最近检查">{displayObs.lastConnectedAt}</Descriptions.Item>
        </Descriptions>
      </Card>

      <div className="executor-stat-grid">
        <DataCard title="OBS连接状态" value={displayObs.obsStatus} helper={`来源：${displayObs.executorName}`} tone="teal" status={displayObs.obsStatus} />
        <DataCard title="OBS版本" value={displayObs.obsVersion} helper={`当前场景：${displayObs.currentScene}`} tone="blue" />
        <DataCard title="当前来源数量" value={displayObs.sourceCount} helper={`${displayObs.resolution} / ${displayObs.fps}fps`} tone="amber" />
        <DataCard title="最后连接时间" value={displayObs.lastConnectedAt} helper={`输出状态：${displayObs.outputStatus}`} tone="rose" status={displayObs.outputStatus} />
      </div>

      <div className="executor-obs-grid">
        <Card title="执行端 OBS 列表" className="panel-card">
          {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
          <Table
            rowKey="executorId"
            columns={columns}
            dataSource={executorObsList}
            loading={loading}
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
            message="检查结果来自 SQLite"
            description="已配置 executor-client + OBS WebSocket 时，刷新场景命令会写入真实场景来源；未配置时仍显示 seed 或最近一次回执状态。"
          />
        </Card>
      </div>

      <Modal title={sourceRecord ? `${sourceRecord.executorName} 场景来源` : '场景来源'} open={Boolean(sourceRecord)} onCancel={() => setSourceRecord(null)} footer={null}>
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
                  <List.Item.Meta title={item.name} description={`${item.sceneName ? `场景：${item.sceneName} / ` : ''}${item.type || '未知来源类型'}`} />
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
