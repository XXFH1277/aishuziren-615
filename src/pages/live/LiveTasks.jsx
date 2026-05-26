import { DatePicker, Alert, Button, Card, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { createLiveTask, getExecutorOptions, getLiveRooms, getLiveTasks, getLiveTaskStatuses, updateLiveTaskStatus } from '../../services/liveService';

const { RangePicker } = DatePicker;
const liveTaskStatuses = getLiveTaskStatuses();
const executorOptions = getExecutorOptions();

const taskStatusActionMap = {
  启动: '直播中',
  暂停: '已暂停',
  结束: '已结束',
};

export default function LiveTasks() {
  const [liveTasks, setLiveTasks] = useState([]);
  const [liveRooms, setLiveRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [roomId, setRoomId] = useState();
  const [executor, setExecutor] = useState();
  const [timeRange, setTimeRange] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });
  const [form] = Form.useForm();

  const fetchLiveTasks = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [taskData, roomData] = await Promise.all([
        getLiveTasks({
          keyword,
          status,
          liveRoomId: roomId,
          executorName: executor,
          startTime: timeRange?.[0]?.format?.('YYYY-MM-DD HH:mm:ss'),
          endTime: timeRange?.[1]?.format?.('YYYY-MM-DD HH:mm:ss'),
          page: pagination.current,
          pageSize: pagination.pageSize,
        }),
        getLiveRooms({ pageSize: 100 }),
      ]);

      setLiveTasks(taskData.list || []);
      setLiveRooms(roomData.list || []);
      setPagination((current) => ({
        ...current,
        current: taskData.page || current.current,
        pageSize: taskData.pageSize || current.pageSize,
        total: taskData.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '直播任务加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [executor, keyword, pagination.current, pagination.pageSize, roomId, status, timeRange]);

  useEffect(() => {
    fetchLiveTasks();
  }, [fetchLiveTasks]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleCreateTask = async () => {
    try {
      const values = await form.validateFields();
      const selectedRoom = liveRooms.find((room) => room.id === values.liveRoomId);

      await createLiveTask({
        taskName: values.taskName,
        liveRoomId: values.liveRoomId,
        liveRoomName: selectedRoom?.name || '',
        platform: selectedRoom?.platform || '',
        avatarId: selectedRoom?.avatarId || '',
        avatarName: selectedRoom?.avatarName || '',
        productGroupId: selectedRoom?.productGroupId || '',
        productGroupName: selectedRoom?.productGroupName || '',
        executorName: values.executorName || '',
        scheduledStartTime: values.scheduledStartTime?.format?.('YYYY-MM-DD HH:mm:ss') || '',
        status: '草稿',
        notes: values.notes || '',
      });

      message.success('直播任务已创建并写入本地 SQLite');
      form.resetFields();
      setOpen(false);
      fetchLiveTasks();
    } catch (requestError) {
      if (!requestError.errorFields) {
        message.error(requestError.message || '直播任务创建失败');
      }
    }
  };

  const handleTaskAction = async (action, record) => {
    if (!taskStatusActionMap[action]) {
      message.info(`${action}「${record.taskName}」为 Mock 操作，不连接真实执行端`);
      return;
    }

    try {
      await updateLiveTaskStatus(record.id, taskStatusActionMap[action]);
      message.success(`已将「${record.taskName}」更新为${taskStatusActionMap[action]}`);
      fetchLiveTasks();
    } catch (requestError) {
      message.error(requestError.message || '直播任务状态更新失败');
    }
  };

  const columns = [
    { title: '任务名称', dataIndex: 'taskName', width: 220 },
    { title: '绑定直播间', dataIndex: 'liveRoomName', width: 170 },
    { title: '直播平台', dataIndex: 'platform', width: 110, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '绑定数字人', dataIndex: 'avatarName', width: 150 },
    { title: '绑定商品组', dataIndex: 'productGroupName', width: 150 },
    { title: '绑定执行端', dataIndex: 'executorName', width: 150 },
    { title: '计划开播时间', dataIndex: 'scheduledStartTime', width: 170 },
    { title: '当前状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={value} /> },
    {
      title: '操作',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size={4} wrap>
          {['查看', '编辑', '启动', '暂停', '结束', '复盘'].map((action) => (
            <Button
              type="link"
              size="small"
              danger={action === '结束'}
              key={action}
              onClick={() => handleTaskAction(action, record)}
            >
              {action}
            </Button>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="直播任务"
        description="管理具体直播执行任务：在某个时间使用某个直播间配置执行一场直播，当前通过本地 API 读取 SQLite 数据。"
        extra={<Button type="primary" onClick={() => setOpen(true)}>新建任务</Button>}
      />
      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索任务名称"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 260 }}
          />
          <Select
            allowClear
            placeholder="任务状态"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={liveTaskStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 140 }}
          />
          <Select
            allowClear
            placeholder="绑定直播间"
            value={roomId}
            onChange={(value) => resetToFirstPage(() => setRoomId(value))}
            options={liveRooms.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 190 }}
          />
          <Select
            allowClear
            placeholder="绑定执行端"
            value={executor}
            onChange={(value) => resetToFirstPage(() => setExecutor(value))}
            options={executorOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
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
          dataSource={liveTasks}
          loading={loading}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无直播任务数据'} /> }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个任务`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1500 }}
        />
      </Card>
      <Modal title="新建直播任务" open={open} onCancel={() => setOpen(false)} onOk={handleCreateTask} okText="创建任务" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="liveRoomId" label="绑定直播间" rules={[{ required: true, message: '请选择直播间' }]}>
            <Select options={liveRooms.map((item) => ({ label: item.name, value: item.id }))} placeholder="请选择直播间" />
          </Form.Item>
          <Form.Item name="executorName" label="绑定执行端">
            <Select options={executorOptions.map((item) => ({ label: item, value: item }))} placeholder="请选择执行端" />
          </Form.Item>
          <Form.Item name="scheduledStartTime" label="计划开播时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="填写任务备注" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
