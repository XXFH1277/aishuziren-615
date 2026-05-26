export const delaySettings = {
  delayMode: '5秒延迟',
  delaySeconds: 5,
  reviewRules: {
    lowRiskAutoPass: true,
    mediumRiskManualConfirm: true,
    highRiskBlockAuto: true,
    priceManualConfirm: true,
    medicalTermsBlock: true,
    platformForbiddenBlock: true,
  },
  queueRules: {
    maxAheadSentences: 3,
    showNextTwo: true,
    allowManualInsert: true,
    allowDeletePending: true,
    allowReturnToProductLine: true,
  },
  riskRules: [
    { id: 'RR001', name: '敏感词提醒 Mock', enabled: true, level: '中', description: '发现绝对化、诱导性或平台敏感表达时提醒运营确认。' },
    { id: 'RR002', name: '价格错误提醒 Mock', enabled: true, level: '中', description: '涉及价格、优惠、券后价时必须提示以页面实时展示为准。' },
    { id: 'RR003', name: '夸大宣传提醒 Mock', enabled: true, level: '高', description: '拦截无法验证的效果、销量、排名和承诺。' },
    { id: 'RR004', name: '平台禁词提醒 Mock', enabled: true, level: '高', description: '命中平台禁词时禁止自动播出，转人工审核。' },
  ],
};

export const delayModes = ['无延迟', '3秒延迟', '5秒延迟', '10秒延迟', '自定义延迟', '人工确认后播出'];
