import { DuixAdapter } from './DuixAdapter.js';
import { PrintAdapter } from './PrintAdapter.js';
import { SiyuAdapter } from './SiyuAdapter.js';

export function createDigitalHumanAdapter(config = {}) {
  const adapterName = String(config.dhAdapter || 'print').trim().toLowerCase();

  if (adapterName === 'duix') {
    return new DuixAdapter(config.duix || {});
  }

  if (adapterName === 'siyu') {
    return new SiyuAdapter(config.siyu || {});
  }

  return new PrintAdapter(config.print || {});
}
