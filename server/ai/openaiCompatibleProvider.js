export function createOpenAiCompatibleProvider() {
  return {
    id: 'openai-compatible',
    name: 'OpenAI Compatible Provider',
    async generate() {
      return {
        content: '当前阶段未开启真实模型调用。',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        cost: 0,
        providerRequestId: '',
        realProviderEnabled: false,
      };
    },
  };
}
