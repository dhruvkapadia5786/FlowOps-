import { toneForStatus } from './status-badge';

describe('toneForStatus', () => {
  it('maps success-like statuses', () => {
    expect(toneForStatus('SUCCESS')).toBe('success');
    expect(toneForStatus('healthy')).toBe('success');
  });

  it('maps failure statuses', () => {
    expect(toneForStatus('failed')).toBe('danger');
    expect(toneForStatus('unhealthy')).toBe('danger');
  });

  it('maps in-progress and gate statuses', () => {
    expect(toneForStatus('WAITING_FOR_APPROVAL')).toBe('warning');
    expect(toneForStatus('deploying')).toBe('warning');
  });
});
