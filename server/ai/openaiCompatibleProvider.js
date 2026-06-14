// OpenAI 兼容 provider：用一个客户端按 baseUrl 切换接入 DeepSeek / Kimi / 通义 等。
// 真实密钥由后端在调用前解密并通过 modelConfig.apiKey 传入，本文件不读取 env、不接触存储。

const PROVIDER_PRICE_PER_M = {
  // 粗略估算，单位：元 / 百万 token（input, output），仅用于成本监控展示。
  deepseek: { input: 1, output: 2 },
  kimi: { input: 4, output: 16 },
  moonshot: { input: 4, output: 16 },
  qwen: { input: 1, output: 2 },
  tongyi: { input: 1, output: 2 },
  default: { input: 2, output: 8 },
};

function estimateCost(providerKey, usage = {}) {
  const price = PROVIDER_PRICE_PER_M[providerKey] || PROVIDER_PRICE_PER_M.default;
  const input = Number(usage.inputTokens || 0);
  const output = Number(usage.outputTokens || 0);
  return Number(((input / 1_000_000) * price.input + (output / 1_000_000) * price.output).toFixed(6));
}

function buildMessages({ prompt = '', input = {} }) {
  const product = input.product || {};
  const target = input.target || '';
  const system = prompt
    || '你是直播电商的文案助手，输出真实、合规、可直接口播的中文文案。禁止使用最低价、全网第一、绝对承诺、疗效等违规或不可验证表达。';

  const userParts = [
    `任务：生成「${target}」。`,
    product.name ? `商品名称：${product.name}` : '',
    product.category ? `类目：${product.category}` : '',
    product.brand ? `品牌：${product.brand}` : '',
    Array.isArray(product.sellingPoints) && product.sellingPoints.length ? `卖点：${product.sellingPoints.join('；')}` : '',
    product.description ? `已有描述：${product.description}` : '',
    '要求：自然口语、可直接播报；避免绝对化与不可验证表达；价格库存以页面实时为准。',
  ].filter(Boolean);

  return [
    { role: 'system', content: system },
    { role: 'user', content: userParts.join('\n') },
  ];
}

function buildCommentMessages({ prompt = '', input = {} }) {
  const comment = input.comment || '';
  const productName = input.productName || '';
  return [
    { role: 'system', content: prompt || '你是直播间数字人助手，用一句自然、口语、友好的中文回答观众评论。' },
    { role: 'user', content: productName ? `商品：${productName}\n观众评论：${comment}` : `观众评论：${comment}` },
  ];
}

export function createOpenAiCompatibleProvider() {
  return {
    id: 'openai-compatible',
    name: 'OpenAI Compatible Provider',
    async generate({ scenario = 'product_copy', prompt = '', input = {}, modelConfig = {} } = {}) {
      const baseUrl = String(modelConfig.baseUrl || modelConfig.officialBaseUrl || '').replace(/\/+$/, '');
      const apiKey = String(modelConfig.apiKey || '');
      const model = modelConfig.modelName || modelConfig.defaultModel || '';
      const providerKey = String(modelConfig.providerKey || modelConfig.provider || '').toLowerCase();
      const timeoutMs = Number(modelConfig.requestTimeoutMs || 15000);

      if (!baseUrl || !apiKey || !model) {
        throw new Error('真实模型调用缺少 baseUrl、模型名或密钥（请在模型服务配置页填写并配置凭证）。');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages:
              scenario === 'product_copy'
                ? buildMessages({ prompt, input })
                : scenario === 'comment_reply'
                  ? buildCommentMessages({ prompt, input })
                  : [{ role: 'user', content: prompt || '连接测试：请回复 ok。' }],
            temperature: Number(modelConfig.temperature ?? 0.7),
            max_tokens: Number(modelConfig.maxTokens || 2048),
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`模型服务返回 ${response.status}：${String(text).slice(0, 200)}`);
        }

        const data = await response.json();
        const content = String(data.choices?.[0]?.message?.content || '').trim();
        const usage = {
          inputTokens: Number(data.usage?.prompt_tokens || 0),
          outputTokens: Number(data.usage?.completion_tokens || 0),
          totalTokens: Number(data.usage?.total_tokens || 0),
        };

        return {
          content,
          structured: { target: input.target || '', modelName: model },
          riskTips: [],
          usage,
          cost: estimateCost(providerKey, usage),
          providerRequestId: data.id || '',
          realProviderEnabled: true,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
