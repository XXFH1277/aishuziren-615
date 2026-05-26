export const aiCosts = {
  todayCalls: 286,
  todayCost: 46.82,
  monthCost: 1386.5,
  averageCost: 0.16,
  abnormalCalls: 5,
  providerBreakdown: [
    { name: 'Kimi', value: 38, cost: 17.8 },
    { name: 'Mimo', value: 22, cost: 7.6 },
    { name: 'DeepSeek', value: 12, cost: 3.2 },
    { name: 'OpenAI', value: 18, cost: 14.7 },
    { name: '本地模型', value: 10, cost: 0 },
  ],
  typeBreakdown: [
    { name: '商品文案', value: 28 },
    { name: '直播话术', value: 26 },
    { name: '弹幕回复', value: 21 },
    { name: '合规审核', value: 15 },
    { name: '背景提示词', value: 6 },
    { name: '技术排查', value: 4 },
  ],
  budgetSettings: {
    dailyBudget: 120,
    monthlyBudget: 3000,
    overBudgetAlert: true,
    highCostModelAlert: true,
  },
};
