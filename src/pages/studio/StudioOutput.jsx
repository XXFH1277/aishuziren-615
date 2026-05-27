import {
  ApiOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DesktopOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, List, Modal, Space, Steps, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getOutputMethods, getStudioOutputStatus } from '../../services/studioService';

const outputMethods = getOutputMethods();

function getMethodIcon(name) {
  if (name.includes('OBS')) {
    return <ApiOutlined />;
  }

  if (name.includes('摄像')) {
    return <CameraOutlined />;
  }

  if (name.includes('云端')) {
    return <CloudUploadOutlined />;
  }

  return <DesktopOutlined />;
}

export default function StudioOutput() {
  const [outputStatus, setOutputStatus] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOutputStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getStudioOutputStatus();
      setOutputStatus(data);
    } catch (err) {
      setError(err.message || '本地 API 服务未连接，请先运行 npm run server:dev');
      message.error(err.message || '输出状态加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutputStatus();
  }, []);

  const mockAction = (label) => {
    message.info(`${label}为 Mock 操作，当前不连接真实 OBS、直播伴侣或执行端`);
  };

  const checklist = outputStatus?.checklist || [];
  const sceneMappings = outputStatus?.sceneMappings || [];
  const finishedCount = checklist.filter((item) => item.checked).length;

  return (
    <>
      <PageHeader
        title="OBS输出预留"
        description="预留直播间画面输出到 OBS / 直播伴侣的配置入口。当前输出状态来自本地 API + SQLite，不连接真实 OBS。"
      />

      <Alert
        className="studio-alert"
        type="warning"
        showIcon
        message="当前不连接真实 OBS"
        description="测试连接、刷新场景、发送预览画面、虚拟摄像头和配置说明均为 Mock，不访问 OBS WebSocket、直播伴侣或本地执行端。"
      />

      {error ? <Alert className="studio-alert" type="error" showIcon message={error} /> : null}

      <div className="studio-card-grid output-method-grid">
        {outputMethods.map((method) => (
          <Card key={method.id} className="studio-output-method panel-card">
            <Space align="start">
              <div className="studio-method-icon">{getMethodIcon(method.name)}</div>
              <div>
                <div className="studio-card-title">
                  <strong>{method.name}</strong>
                  <StatusTag status={method.status} />
                </div>
                <p className="studio-card-desc">{method.description}</p>
              </div>
            </Space>
          </Card>
        ))}
      </div>

      <div className="studio-output-grid">
        <Card title="OBS状态 Mock" className="panel-card" loading={loading}>
          {outputStatus ? (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="连接状态">
                  <StatusTag status={outputStatus.obsStatus} />
                </Descriptions.Item>
                <Descriptions.Item label="OBS版本">{outputStatus.obsVersion}</Descriptions.Item>
                <Descriptions.Item label="当前场景">{outputStatus.currentScene}</Descriptions.Item>
                <Descriptions.Item label="当前来源">{outputStatus.currentSource}</Descriptions.Item>
                <Descriptions.Item label="输出分辨率">{outputStatus.resolution}</Descriptions.Item>
                <Descriptions.Item label="帧率">{outputStatus.fps} FPS</Descriptions.Item>
                <Descriptions.Item label="最后心跳时间">{outputStatus.lastHeartbeatAt}</Descriptions.Item>
              </Descriptions>
              <Space wrap className="studio-output-actions">
                <Button icon={<ApiOutlined />} onClick={() => mockAction('测试连接')}>
                  测试连接 Mock
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => mockAction('刷新场景')}>
                  刷新场景 Mock
                </Button>
                <Button icon={<SendOutlined />} onClick={() => mockAction('发送预览画面')}>
                  发送预览画面 Mock
                </Button>
                <Button icon={<CameraOutlined />} onClick={() => mockAction('打开虚拟摄像头')}>
                  打开虚拟摄像头 Mock
                </Button>
                <Button icon={<FileTextOutlined />} onClick={() => setConfigOpen(true)}>
                  生成 OBS 配置说明 Mock
                </Button>
              </Space>
            </>
          ) : (
            <Empty description="暂无输出状态，请先运行 npm run server:seed 或检查本地 API 服务" />
          )}
        </Card>

        <Card title="输出预览" className="panel-card">
          <LivePreviewFrame ratio="9:16 竖屏" backgroundColor="#2563eb" title="OBS 预览画面" showAvatar showProduct showDanmu showCoupon />
        </Card>
      </div>

      <div className="studio-output-grid">
        <Card title="场景映射 Mock" className="panel-card" loading={loading}>
          {sceneMappings.length ? (
            <List
              dataSource={sceneMappings}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.studioLayer}</span>
                        <span>→</span>
                        <strong>{item.obsSource}</strong>
                      </Space>
                    }
                    description={<Tag>{item.sourceType}</Tag>}
                  />
                  <StatusTag status={item.status} />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无场景映射" />
          )}
        </Card>

        <Card title="输出检查清单" className="panel-card" loading={loading}>
          {checklist.length ? (
            <Steps
              direction="vertical"
              size="small"
              current={Math.max(finishedCount - 1, 0)}
              items={checklist.map((item) => ({
                title: item.label,
                status: item.checked ? 'finish' : 'wait',
                icon: item.checked ? <CheckCircleOutlined /> : undefined,
                description: item.checked ? '已通过 Mock 检查' : '待后续接入真实执行端后确认',
              }))}
            />
          ) : (
            <Empty description="暂无输出检查项" />
          )}
        </Card>
      </div>

      <Modal title="OBS 配置说明 Mock" open={configOpen} onCancel={() => setConfigOpen(false)} footer={null}>
        <p>1. 在 OBS 中创建浏览器源或窗口捕获源。</p>
        <p>
          2. 设置输出分辨率为 {outputStatus?.resolution || '1080x1920'}，帧率为 {outputStatus?.fps || 30} FPS。
        </p>
        <p>3. 将背景、数字人、商品贴图、字幕和弹幕区域按场景映射进行命名。</p>
        <p>4. 本说明仅为 Mock，不包含真实连接地址、密钥或推流信息。</p>
      </Modal>
    </>
  );
}
