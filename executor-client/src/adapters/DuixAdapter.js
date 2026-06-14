export class DuixAdapter {
  constructor() {
    this.initialized = false;
  }

  async init() {
    // TODO(DUIX-1): Verify how to start or connect to the local DUIX runtime/service.
    // TODO(DUIX-5): Verify GPU, driver, model asset, and permission prerequisites before real startup.
    this.initialized = true;
    return {
      ok: false,
      adapter: 'duix',
      message: 'DUIX adapter placeholder only. Verified DUIX SDK/API details are required before implementation.',
    };
  }

  async speak() {
    // TODO(DUIX-2): Verify the DUIX text/audio input API before feeding text or audio.
    // TODO(DUIX-3): Verify how DUIX maps tone/action to lip sync, expression, and body motion.
    // TODO(DUIX-4): Verify output to virtual camera, OBS source, RTMP, or another real-time stream target.
    return {
      ok: false,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      adapter: 'duix',
      message:
        'DUIX adapter is not configured. TODO: verify DUIX service startup, text/audio input, avatar driving, and virtual camera or RTMP output APIs.',
      todos: [
        'Verify how to start and supervise the local DUIX runtime/service.',
        'Verify the text or audio input API used to trigger speech.',
        'Verify how DUIX drives lip sync, expression, and body motion for one utterance.',
        'Verify how DUIX outputs to virtual camera, OBS source, or RTMP.',
      ],
    };
  }

  async getStatus() {
    // TODO(DUIX-6): Verify health/status APIs and latency metrics for continuous live sessions.
    return {
      ok: false,
      adapter: 'duix',
      initialized: this.initialized,
      message: 'DUIX adapter placeholder. Real DUIX runtime status is not available yet.',
    };
  }

  async dispose() {
    this.initialized = false;
  }
}
