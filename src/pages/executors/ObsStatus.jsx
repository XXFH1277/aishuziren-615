import { ApiOutlined, EyeOutlined, PlayCircleOutlined, ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, List, Modal, Progress, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataCard from '../../components/DataCard';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getExecutorObsStatus, getObsChecklist, refreshExecutorObsScenes, testExecutorObsConnection } from '../../services/executorService';

const defaultObsChecklist = getObsChecklist();
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
  const [executorObsList, setExecutorObsList] = useState([]);
  const [obsChecklist, setObsChecklist] = useState(defaultObsChecklist);
  const [loading, setLoading] = useState(false);
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

  const activeObs = useMemo(
    () => executorObsList.find((item) => item.obsStatus === '已连接') || executorObsList[0] || emptyObs,
    [executorObsList],
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
      message.success(data.message || 'Mock OBS 测试连接指令已记录');
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
      message.success(data.message || 'Mock 刷新场景指令已记录');
      fetchObsStatus();
    } catch (requestError) {
      message.error(requestError.message || '刷新场景失败');
    }
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
        description="通过本地 API 读取 SQLite 中的 OBS 连接状态、场景来源和输出检查结果。"
        extra={
          <Space wrap>
            <Button icon={<ApiOutlined />} onClick={() => handleObsTest(activeObs.executorId)}>
              测试连接 Mock
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => handleRefreshScenes(activeObs.executorId)}>
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
        message="当前不连接真实 OBS"
        description="OBS 状态来自本地 SQLite；测试连接、刷新场景、重启连接等操作只记录或提示 Mock 指令，不访问本机端口或任何 OBS WebSocket 服务。"
      />

      <div className="executor-stat-grid">
        <DataCard title="OBS连接状态" value={activeObs.obsStatus} helper={`执行端：${activeObs.executorName}`} tone="teal" status={activeObs.obsStatus} />
        <DataCard title="OBS版本" value={activeObs.obsVersion} helper={`当前场景：${activeObs.currentScene}`} tone="blue" />
        <DataCard title="当前来源数量" value={activeObs.sourceCount} helper={`${activeObs.resolution} / ${activeObs.fps}fps`} tone="amber" />
        <DataCard title="最后连接时间" value={activeObs.lastConnectedAt} helper={`输出状态：${activeObs.outputStatus}`} tone="rose" status={activeObs.outputStatus} />
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
