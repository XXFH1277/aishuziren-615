export class PrintAdapter {
  constructor() {
    this.initialized = false;
    this.lastSpeechAt = '';
  }

  async init() {
    this.initialized = true;
    return { ok: true, adapter: 'print' };
  }

  async speak({ text, tone = 'natural' }) {
    const startedAt = new Date().toISOString();
    const normalizedText = String(text || '').trim();

    if (!normalizedText) {
      return {
        ok: false,
        startedAt,
        durationMs: 0,
        message: 'Speak text is empty.',
        adapter: 'print',
      };
    }

    this.lastSpeechAt = startedAt;
    const durationMs = Math.max(800, Math.min(15_000, normalizedText.length * 120));
    console.log(`[executor-client][PrintAdapter] speak tone=${tone} text=${normalizedText}`);

    return {
      ok: true,
      startedAt,
      durationMs,
      message: 'PrintAdapter simulated digital human speech successfully.',
      adapter: 'print',
      tone,
      textLength: normalizedText.length,
    };
  }

  async getStatus() {
    return {
      ok: this.initialized,
      adapter: 'print',
      lastSpeechAt: this.lastSpeechAt,
      message: this.initialized ? 'PrintAdapter ready.' : 'PrintAdapter not initialized.',
    };
  }

  async dispose() {
    this.initialized = false;
  }
}
