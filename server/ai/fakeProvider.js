const productCopyTargetLabels = {
  description: '商品简介',
  selling_points: '核心卖点',
  live_script: '直播口播',
  faq: 'FAQ问答',
  compliance_rewrite: '合规改写',
};

function getProductName(input = {}) {
  return input.product?.name || input.draftProduct?.name || '当前商品';
}

function buildProductCopy({ target, input = {}, modelName }) {
  const productName = getProductName(input);
  const sellingPoints = input.product?.sellingPoints || input.draftProduct?.sellingPoints || [];
  const primaryPoint = sellingPoints[0] || '真实卖点';
  const riskTips = [
    {
      level: 'medium',
      type: 'compliance_reminder',
      message: '避免使用最低价、全网第一、治疗功效、虚构销量等绝对化或不可验证表达。',
    },
  ];

  const contentMap = {
    description: `${productName}主打${primaryPoint}，适合直播间商品卡、详情页和运营素材使用。文案采用清晰、克制的表达，具体价格、库存和优惠请以页面实时展示为准。`,
    selling_points: [
      `1. ${productName}信息清晰，便于直播间快速讲解。`,
      `2. 突出${primaryPoint}，但不做绝对化承诺。`,
      '3. 价格、发货和售后以商品页与平台规则为准。',
    ].join('\n'),
    live_script: `家人们，现在看到的是${productName}。它的重点是${primaryPoint}，适合想要省心了解商品亮点的朋友。具体优惠和库存大家看商品页实时信息，喜欢可以先加入购物车慢慢对比。`,
    faq: [
      `Q：${productName}适合哪些场景？`,
      `A：建议结合商品详情页信息选择，直播间会围绕${primaryPoint}做重点说明。`,
      'Q：价格和优惠怎么确认？',
      'A：以商品页实时展示为准，主播口播只做辅助说明。',
    ].join('\n'),
    compliance_rewrite: `${productName}推荐使用真实、可验证的描述。请将“最低价、全网第一、效果保证、治疗功效”等说法改为“直播间福利参考页面展示”“适合相关需求人群”“体验因人而异”等更稳妥表达。`,
  };

  return {
    content: contentMap[target] || contentMap.description,
    structured: {
      target,
      targetLabel: productCopyTargetLabels[target] || '商品文案',
      modelName,
    },
    riskTips,
  };
}

export const fakeProvider = {
  id: 'fake',
  name: 'Fake Provider',
  async generate({ scenario = 'model_connection_test', prompt = '', input = {}, modelConfig = {} } = {}) {
    const providerRequestId = `fake_${Date.now()}`;
    const modelName = modelConfig.defaultModel || modelConfig.modelName || 'fake-model';
    const target = input.target || modelConfig.target || 'description';
    const productCopy = scenario === 'product_copy' ? buildProductCopy({ target, input, modelName }) : null;

    return {
      content: productCopy?.content || `Fake provider response for ${scenario}. Model ${modelName} is reachable in local test mode.`,
      structured: productCopy?.structured || {},
      riskTips: productCopy?.riskTips || [],
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      },
      cost: 0,
      providerRequestId,
      meta: {
        scenario,
        promptLength: String(prompt || '').length,
        inputKeys: Object.keys(input || {}),
      },
    };
  },
};
