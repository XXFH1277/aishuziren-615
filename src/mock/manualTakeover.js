export const takeoverTones = ['专业', '亲切', '热情', '解释型', '促单型', '安抚型'];

export const takeoverActions = ['看评论区', '点头', '指向商品', '强调价格', '微笑回应', '回到镜头'];

export const broadcastModes = ['立即插队 Mock', '当前句结束后播报 Mock', '加入待播队列 Mock', '仅生成建议 Mock'];

export const manualTakeover = {
  currentLiveRoom: '舟山海鲜礼盒晚场',
  currentLiveTask: '晚场海鲜礼盒福利讲解',
  currentAvatar: '海岛好物推荐官',
  currentProductGroup: '舟山特产组',
  speechStatus: '直播中',
  executorStatus: '在线',
  currentSpeech: '大家现在看到的是舟山特色海鲜礼盒，适合家庭聚餐和节日送礼。',
  nextSpeech: '等一下我会重点讲一下规格、发货方式和直播间福利。',
  upcomingSpeech: [
    {
      id: 'UP001',
      content: '这款礼盒今天有直播间专属福利，大家可以先看一下页面上的券。',
      riskLevel: '低',
      status: '待播',
    },
    {
      id: 'UP002',
      content: '关于发货，生鲜类商品会按照订单页提示安排，注意查看收货地址。',
      riskLevel: '低',
      status: '待播',
    },
    {
      id: 'UP003',
      content: '如果大家担心售后，可以通过平台订单联系店铺客服处理。',
      riskLevel: '中',
      status: '待确认',
    },
  ],
  recommendedReplies: [
    '这款今天直播间有福利，建议先领券再看规格，合适的话再下单。',
    '关于发货时间，以订单页提示为准，我们会按平台规则安排。',
    '这款更适合家庭囤货和送礼，规格组合比较完整。',
    '如果对价格有疑问，可以对比规格、产地和配送方式一起看。',
  ],
  riskWarnings: [
    { id: 'RW001', type: '敏感词提醒 Mock', level: '中', content: '避免使用“最低价”“全网第一”等绝对化表达。' },
    { id: 'RW002', type: '价格错误提醒 Mock', level: '中', content: '口播价格需提示以页面实时价格为准。' },
    { id: 'RW003', type: '夸大宣传提醒 Mock', level: '高', content: '不要承诺无法验证的效果或销量。' },
    { id: 'RW004', type: '平台禁词提醒 Mock', level: '中', content: '涉及售后、发货、优惠时按平台规则表达。' },
  ],
};
