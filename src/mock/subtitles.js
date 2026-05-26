export const subtitles = {
  currentSubtitle: {
    id: 'SUB001',
    text: '家人们现在看到的是这款舟山海鲜礼盒。',
    speaker: '海岛好物推荐官',
    status: '当前',
    riskLevel: '低',
  },
  nextSubtitle: {
    id: 'SUB002',
    text: '有朋友问发货时间，我统一说一下。',
    speaker: '海岛好物推荐官',
    status: '待播',
    riskLevel: '低',
  },
  upcomingSubtitles: [
    {
      id: 'SUB003',
      text: '今天这款更适合送礼和家庭聚餐。',
      speaker: '海岛好物推荐官',
      status: '待播',
      riskLevel: '低',
    },
    {
      id: 'SUB004',
      text: '具体优惠大家以页面显示为准。',
      speaker: '海岛好物推荐官',
      status: '已通过',
      riskLevel: '中',
    },
    {
      id: 'SUB005',
      text: '这个价格不要说全网最低，只能说今天比较划算。',
      speaker: '海岛好物推荐官',
      status: '高风险',
      riskLevel: '高',
    },
  ],
  subtitleStyle: {
    fontSize: 28,
    position: '底部',
    backgroundOpacity: 68,
    showSpeakerName: true,
    showRiskHint: true,
  },
};
