import { fakeProvider } from './fakeProvider.js';
import { createOpenAiCompatibleProvider } from './openaiCompatibleProvider.js';

export async function runProviderGenerate({
  realProvider = false,
  scenario = 'model_connection_test',
  prompt = '',
  input = {},
  modelConfig = {},
} = {}) {
  if (realProvider) {
    const provider = createOpenAiCompatibleProvider();

    try {
      const result = await provider.generate({ scenario, prompt, input, modelConfig });

      return {
        ...result,
        providerId: provider.id,
        providerName: provider.name,
        skipped: false,
        status: '成功',
        message: '真实模型调用成功。',
      };
    } catch (error) {
      return {
        content: '',
        structured: {},
        riskTips: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: 0,
        providerRequestId: '',
        providerId: provider.id,
        providerName: provider.name,
        skipped: false,
        error: true,
        status: '调用失败',
        message: error.message || '真实模型调用失败。',
      };
    }
  }

  const result = await fakeProvider.generate({ scenario, prompt, input, modelConfig });

  return {
    ...result,
    providerId: fakeProvider.id,
    providerName: fakeProvider.name,
    skipped: false,
    status: '成功',
    message: '当前默认使用 fake provider，不会调用真实模型。',
  };
}
