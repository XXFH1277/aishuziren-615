import { DatePicker, Button, Card, Input, Select, Space, Table, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { executorOptions, liveTaskStatuses, liveTasks } from '../../mock/liveTasks';
import { liveRooms } from '../../mock/liveRooms';

const { RangePicker } = DatePicker;

export default function LiveTasks() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [roomId, setRoomId] = useState();
  const [executor, setExecutor] = useState();

  const filteredTasks = useMemo(
    () =>
      liveTasks.filter((task) => {
        const matchKeyword = !keyword || task.taskName.toLowerCase().includes(keyword.toLowerCase());
        const matchStatus = !status || task.status === status;
        const matchRoom = !roomId || task.liveRoomId === roomId;
        const matchExecutor = !executor || task.executorName === executor;
        return matchKeyword && matchStatus && matchRoom && matchExecutor;
      }),
    [executor, keyword, roomId, status],
  );

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
              onClick={() => message.info(`${action}「${record.taskName}」为 Mock 操作，不连接真实执行端`)}
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
        description="管理具体直播执行任务：在某个时间使用某个直播间配置执行一场直播。"
        extra={<Button type="primary" onClick={() => message.info('新建任务为 Mock 入口，暂不创建真实任务')}>新建任务</Button>}
      />
      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索任务名称"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 260 }}
          />
          <Select
            allowClear
            placeholder="任务状态"
            value={status}
            onChange={setStatus}
            options={liveTaskStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 140 }}
          />
          <Select
            allowClear
            placeholder="绑定直播间"
            value={roomId}
            onChange={setRoomId}
            options={liveRooms.map((item) => ({ label: item.name, value: item.id }))}
            style={{ width: 190 }}
          />
          <Select
            allowClear
            placeholder="绑定执行端"
            value={executor}
            onChange={setExecutor}
            options={executorOptions.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
          <RangePicker showTime style={{ width: 320 }} />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredTasks}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 个任务` }}
          scroll={{ x: 1500 }}
        />
      </Card>
    </>
  );
}
