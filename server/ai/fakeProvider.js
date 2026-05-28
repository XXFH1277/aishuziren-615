export const fakeProvider = {
  id: 'fake',
  name: 'Fake Provider',
  async generate({ scenario = 'model_connection_test', prompt = '', input = {}, modelConfig = {} } = {}) {
    const providerRequestId = `fake_${Date.now()}`;
    const modelName = modelConfig.defaultModel || modelConfig.modelName || 'fake-model';

    return {
      content: `Fake provider response for ${scenario}. Model ${modelName} is reachable in local test mode.`,
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
