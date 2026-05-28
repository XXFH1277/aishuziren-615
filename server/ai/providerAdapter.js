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
    const result = await provider.generate({ scenario, prompt, input, modelConfig });

    return {
      ...result,
      providerId: provider.id,
      providerName: provider.name,
      skipped: true,
      status: '真实调用未开启',
      message: '当前阶段未开启真实模型调用。',
    };
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
