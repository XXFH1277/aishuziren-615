export const delayControl = {
  currentLiveRoom: '舟山海鲜礼盒晚场',
  currentLiveTask: '舟山海鲜礼盒晚场 0526',
  currentAvatar: '海岛好物推荐官',
  currentProductGroup: '舟山特产组',
  delayMode: '5秒延迟',
  executorStatus: '在线',
  currentSpeech: {
    id: 'DS001',
    text: '家人们现在看到的是这款舟山海鲜礼盒，适合家庭聚餐和节日送礼。',
    source: '脚本',
    action: '指向商品',
    tone: '亲切',
    productName: '舟山海鲜礼盒',
    remainingSeconds: 8,
    riskLevel: '低',
  },
  nextSpeech: {
    id: 'DS002',
    text: '有朋友问发货时间，我统一说一下，具体以订单页提示为准。',
    source: '弹幕',
    action: '看评论区',
    tone: '解释型',
    productName: '舟山海鲜礼盒',
    scheduledInSeconds: 5,
    riskLevel: '低',
  },
  upcomingSpeech: [
    {
      id: 'DS003',
      text: '今天这款更适合送礼和家庭聚餐，规格组合比较完整。',
      source: 'AI推荐',
      action: '微笑回应',
      tone: '亲切',
      productName: '舟山海鲜礼盒',
      scheduledInSeconds: 16,
      riskLevel: '低',
    },
    {
      id: 'DS004',
      text: '具体优惠大家以页面显示为准，先领券再看规格。',
      source: '人工',
      action: '强调价格',
      tone: '促单型',
      productName: '舟山海鲜礼盒',
      scheduledInSeconds: 28,
      riskLevel: '中',
    },
  ],
  riskSummary: {
    low: 8,
    medium: 2,
    high: 1,
    pendingReview: 3,
  },
};

export const speechSources = ['脚本', '弹幕', '人工', 'AI推荐'];

export const speechActions = ['看评论区', '点头', '指向商品', '强调价格', '微笑回应', '回到镜头'];

export const speechTones = ['专业', '亲切', '热情', '解释型', '促单型', '安抚型'];
