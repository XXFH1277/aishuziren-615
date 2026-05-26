export const dashboardStats = [
  { title: '今日直播任务', value: '6', helper: '2 个待确认，4 个已排期', tone: 'blue' },
  { title: '在线执行端', value: '3 / 5', helper: '全部为 Mock 在线状态', tone: 'teal' },
  { title: '待审核话术', value: '18', helper: '等待人工确认后进入队列', tone: 'amber' },
  { title: '模拟弹幕数量', value: '1,248', helper: '来自本地 Mock 数据池', tone: 'rose' },
];

export const modelStatus = [
  { name: 'Kimi', status: '已配置', detail: '仅展示配置状态，不读取真实 Key。' },
  { name: 'Mimo', status: '待测试', detail: 'Phase 0 不发起任何 API 调用。' },
];

export const recentOperations = [
  { id: 1, operator: '运营助手', action: '创建了直播任务占位数据', time: '09:35', status: '成功' },
  { id: 2, operator: '内容审核', action: '标记 6 条话术待复核', time: '09:21', status: '待处理' },
  { id: 3, operator: '系统', action: '刷新执行端 Mock 心跳', time: '09:00', status: '成功' },
];
