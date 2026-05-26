export const troubleshootingList = [
  {
    id: 'TS001',
    title: '数字人不说话',
    category: '数字人问题',
    description: '用于排查数字人没有播报当前话术或待播内容的问题。',
    steps: [
      { id: 'TS001-1', title: '检查待播队列是否有内容', status: '正常', suggestion: '如为空，请从问题队列或人工接管加入待播内容。' },
      { id: 'TS001-2', title: '检查播控设置是否需要人工确认', status: '待检查', suggestion: '确认高风险和价格类话术是否被拦截。' },
      { id: 'TS001-3', title: '检查执行端是否在线', status: '异常', suggestion: '进入执行端列表查看心跳日志，必要时重启本地执行端 Mock。' },
    ],
  },
  {
    id: 'TS002',
    title: '弹幕无法捕获',
    category: '弹幕互动问题',
    description: '用于排查弹幕列表没有新增评论或识别失败的问题。',
    steps: [
      { id: 'TS002-1', title: '确认直播间开启弹幕捕获', status: '待检查', suggestion: '进入直播间编辑页查看互动设置。' },
      { id: 'TS002-2', title: '清空弹幕页筛选条件', status: '正常', suggestion: '避免只看高风险或未处理导致列表为空。' },
      { id: 'TS002-3', title: '使用模拟新弹幕验证前端流程', status: '正常', suggestion: '当前不接真实平台弹幕接口。' },
    ],
  },
  {
    id: 'TS003',
    title: 'OBS无画面',
    category: 'OBS问题',
    description: '用于排查 OBS 画面源缺失或输出异常。',
    steps: [
      { id: 'TS003-1', title: '检查执行端 OBS 连接状态', status: '异常', suggestion: '进入 OBS连接状态页查看当前场景和来源数量。' },
      { id: 'TS003-2', title: '确认背景、数字人、商品层映射', status: '待检查', suggestion: '查看直播间搭建 / OBS输出预留中的场景映射。' },
      { id: 'TS003-3', title: '刷新场景来源 Mock', status: '待检查', suggestion: '点击刷新场景，仅触发前端 Mock 提示。' },
    ],
  },
  {
    id: 'TS004',
    title: '直播伴侣无信号',
    category: '直播连接问题',
    description: '用于排查直播伴侣无法捕获画面的问题。',
    steps: [
      { id: 'TS004-1', title: '确认输出方式选择是否正确', status: '待检查', suggestion: '当前仅预留窗口捕获和直播伴侣捕获说明。' },
      { id: 'TS004-2', title: '检查虚拟摄像头状态', status: '异常', suggestion: '进入执行端 OBS 状态查看虚拟摄像头是否开启。' },
      { id: 'TS004-3', title: '确认分辨率和画面比例', status: '正常', suggestion: '竖屏直播建议使用 1080x1920。' },
    ],
  },
  {
    id: 'TS005',
    title: 'AI生成失败',
    category: '模型与接口问题',
    description: '用于排查 AI 文案、推荐回复、背景提示词生成失败。',
    steps: [
      { id: 'TS005-1', title: '确认当前阶段是否为 Mock', status: '正常', suggestion: '前端阶段不调用真实 Kimi / Mimo。' },
      { id: 'TS005-2', title: '检查模型服务配置状态', status: '待检查', suggestion: '模型服务配置只显示 Mock 状态，不保存真实 Key。' },
      { id: 'TS005-3', title: '查看 AI 调用日志 Mock', status: '待检查', suggestion: '进入调用日志页查看失败或超时记录。' },
    ],
  },
  {
    id: 'TS006',
    title: '口型不同步',
    category: '数字人问题',
    description: '用于排查数字人口型与声音不同步的问题。',
    steps: [
      { id: 'TS006-1', title: '确认当前未接真实口型同步', status: '正常', suggestion: '本阶段仅做前端 Mock 展示。' },
      { id: 'TS006-2', title: '检查延迟设置', status: '待检查', suggestion: '确认延迟秒数和人工确认策略是否合理。' },
      { id: 'TS006-3', title: '记录问题并提交工单', status: '待检查', suggestion: '真实口型同步接入后再排查具体引擎参数。' },
    ],
  },
  {
    id: 'TS007',
    title: '声音延迟',
    category: '播控问题',
    description: '用于排查声音播出比字幕或画面更慢的问题。',
    steps: [
      { id: 'TS007-1', title: '检查延迟模式', status: '待检查', suggestion: '确认当前是 3 秒、5 秒还是人工确认后播出。' },
      { id: 'TS007-2', title: '查看当前播报剩余时长', status: '正常', suggestion: '进入当前播报页查看下一句和下两句。' },
      { id: 'TS007-3', title: '检查执行端状态', status: '待检查', suggestion: '如执行端异常，声音输出可能中断。' },
    ],
  },
  {
    id: 'TS008',
    title: '执行端离线',
    category: '执行端问题',
    description: '用于排查本地直播电脑执行端未在线。',
    steps: [
      { id: 'TS008-1', title: '查看最后心跳时间', status: '异常', suggestion: '进入心跳日志筛选对应执行端。' },
      { id: 'TS008-2', title: '确认本地程序是否启动', status: '待检查', suggestion: '真实执行端后续由本地 Agent 负责。' },
      { id: 'TS008-3', title: '确认网络和版本状态', status: '待检查', suggestion: '查看是否处于更新中或网络延迟异常。' },
    ],
  },
  {
    id: 'TS009',
    title: '待播队列不播报',
    category: '播控问题',
    description: '用于排查待播内容一直停留在待审核或即将播出状态。',
    steps: [
      { id: 'TS009-1', title: '检查审核状态', status: '异常', suggestion: '高风险待人工内容必须人工处理。' },
      { id: 'TS009-2', title: '检查是否开启人工确认后播出', status: '待检查', suggestion: '进入播控设置查看审核策略。' },
      { id: 'TS009-3', title: '检查当前播报是否暂停', status: '待检查', suggestion: '进入当前播报页确认是否被跳过或暂停。' },
    ],
  },
];
