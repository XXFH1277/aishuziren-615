export const studioOutput = {
  obsStatus: '未连接',
  virtualCameraStatus: '未开启',
  windowCaptureStatus: '待配置',
  obsVersion: 'OBS Studio 30.x Mock',
  currentScene: '数字人直播间预览场景',
  currentSource: 'Studio Preview Browser Source',
  resolution: '1080x1920',
  fps: 30,
  lastHeartbeatAt: '2026-05-26 19:55:00',
  sceneMappings: [
    { id: 'SM001', studioLayer: '直播间背景', obsSource: 'OBS背景源', sourceType: '图片源', status: '已配置' },
    { id: 'SM002', studioLayer: '数字人画面', obsSource: 'OBS视频源', sourceType: '视频源', status: '待确认' },
    { id: 'SM003', studioLayer: '商品贴图', obsSource: 'OBS图片源', sourceType: '图片源', status: '已配置' },
    { id: 'SM004', studioLayer: '字幕文本', obsSource: 'OBS文本源', sourceType: '文本源', status: '已配置' },
    { id: 'SM005', studioLayer: '弹幕区域', obsSource: 'OBS浏览器源', sourceType: '浏览器源', status: '待配置' },
  ],
  checklist: [
    { id: 'OC001', label: '背景已选择', checked: true },
    { id: 'OC002', label: '数字人已绑定', checked: true },
    { id: 'OC003', label: '商品组已绑定', checked: true },
    { id: 'OC004', label: '字幕区已配置', checked: true },
    { id: 'OC005', label: '分辨率已设置', checked: true },
    { id: 'OC006', label: '执行端在线', checked: false },
    { id: 'OC007', label: 'OBS连接正常', checked: false },
  ],
};

export const outputMethods = [
  {
    id: 'OM001',
    name: 'OBS WebSocket',
    status: '未连接',
    description: '预留通过 OBS WebSocket 控制场景和来源，本阶段仅展示状态。',
  },
  {
    id: 'OM002',
    name: '虚拟摄像头',
    status: '未开启',
    description: '预留将直播间画面输出为虚拟摄像头，本阶段不接真实设备。',
  },
  {
    id: 'OM003',
    name: '窗口捕获',
    status: '待配置',
    description: '预留用 OBS 或直播伴侣捕获浏览器窗口画面。',
  },
  {
    id: 'OM004',
    name: '直播伴侣画面捕获',
    status: '预留',
    description: '预留抖音、快手、视频号等直播伴侣的画面接入说明。',
  },
  {
    id: 'OM005',
    name: '云端推流预留',
    status: '预留',
    description: '预留后续云端渲染与推流架构入口，当前只做信息占位。',
  },
];
