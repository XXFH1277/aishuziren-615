import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getOperationLogs, getSettingsOptions } from '../../services/settingsService';

const { RangePicker } = DatePicker;
const settingsOptions = getSettingsOptions();

export default function OperationLogs() {
  const [operationLogs, setOperationLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [module, setModule] = useState();
  const [actionType, setActionType] = useState();
  const [result, setResult] = useState();
  const [timeRange, setTimeRange] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });

  const fetchOperationLogs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getOperationLogs({
        module,
        actionType,
        result,
        startTime: timeRange?.[0]?.format?.('YYYY-MM-DD HH:mm:ss'),
        endTime: timeRange?.[1]?.format?.('YYYY-MM-DD HH:mm:ss'),
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setOperationLogs(data.list || []);
      setPagination((current) => ({
        ...current,
        current: data.page || current.current,
        pageSize: data.pageSize || current.pageSize,
        total: data.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '操作日志加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [actionType, module, pagination.current, pagination.pageSize, result, timeRange]);

  useEffect(() => {
    fetchOperationLogs();
  }, [fetchOperationLogs]);

  const filteredLogs = useMemo(
    () =>
      operationLogs.filter((item) => {
        const lowerKeyword = keyword.toLowerCase();
        const matchKeyword =
          !keyword ||
          item.operator.toLowerCase().includes(lowerKeyword) ||
          item.target.toLowerCase().includes(lowerKeyword) ||
          item.description.toLowerCase().includes(lowerKeyword);
        const matchModule = !module || item.module === module;
        const matchAction = !actionType || item.actionType === actionType;
        const matchResult = !result || item.result === result;
        return matchKeyword && matchModule && matchAction && matchResult;
      }),
    [actionType, keyword, module, operationLogs, result],
  );

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const columns = [
    { title: '操作时间', dataIndex: 'time', width: 170 },
    { title: '操作用户', dataIndex: 'operator', width: 130 },
    { title: '所属模块', dataIndex: 'module', width: 130, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '操作类型', dataIndex: 'actionType', width: 120 },
    { title: '操作对象', dataIndex: 'target', width: 180 },
    { title: '操作结果', dataIndex: 'result', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: 'IP地址 Mock', dataIndex: 'ip', width: 150 },
    { title: '设备 Mock', dataIndex: 'device', width: 170 },
    { title: '操作说明', dataIndex: 'description', width: 230 },
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
        title="操作日志"
        description="查看后台用户的登录、创建、编辑、任务操作、人工接管、模型配置和工单提交记录，当前通过本地 API 读取 SQLite。"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchOperationLogs} loading={loading}>
            刷新
          </Button>
        }
      />

      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索用户、对象或说明"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 280 }}
          />
          <Select
            allowClear
            placeholder="所属模块"
            value={module}
            onChange={(value) => resetToFirstPage(() => setModule(value))}
            options={settingsOptions.operationModules.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="操作类型"
            value={actionType}
            onChange={(value) => resetToFirstPage(() => setActionType(value))}
            options={settingsOptions.operationTypes.map((item) => ({ label: item, value: item }))}
            style={{ width: 140 }}
          />
          <Select
            allowClear
            placeholder="操作结果"
            value={result}
            onChange={(value) => resetToFirstPage(() => setResult(value))}
            options={settingsOptions.operationResults.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <RangePicker
            showTime
            value={timeRange.length ? timeRange : null}
            onChange={(value) => resetToFirstPage(() => setTimeRange(value || []))}
            style={{ width: 320 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredLogs}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: keyword ? filteredLogs.length : pagination.total,
            showTotal: (total) => `共 ${total} 条操作日志`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1640 }}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的操作日志'} /> }}
        />
      </Card>

      <Modal title="操作日志详情 Mock" open={Boolean(detailRecord)} onCancel={() => setDetailRecord(null)} footer={null} width={760}>
        {detailRecord ? (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="操作时间">{detailRecord.time}</Descriptions.Item>
            <Descriptions.Item label="操作用户">{detailRecord.operator}</Descriptions.Item>
            <Descriptions.Item label="所属模块">{detailRecord.module}</Descriptions.Item>
            <Descriptions.Item label="操作类型">{detailRecord.actionType}</Descriptions.Item>
            <Descriptions.Item label="操作对象">{detailRecord.target}</Descriptions.Item>
            <Descriptions.Item label="操作结果">
              <StatusTag status={detailRecord.result} />
            </Descriptions.Item>
            <Descriptions.Item label="IP地址 Mock">{detailRecord.ip}</Descriptions.Item>
            <Descriptions.Item label="设备 Mock">{detailRecord.device}</Descriptions.Item>
            <Descriptions.Item label="操作前数据摘要 Mock" span={2}>
              {detailRecord.beforeSummary}
            </Descriptions.Item>
            <Descriptions.Item label="操作后数据摘要 Mock" span={2}>
              {detailRecord.afterSummary}
            </Descriptions.Item>
            <Descriptions.Item label="错误信息 Mock" span={2}>
              {detailRecord.errorMessage}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  );
}
