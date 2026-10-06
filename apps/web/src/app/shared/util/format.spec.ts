import { formatStatus, shortSha } from './format';

describe('format helpers', () => {
  it('formats underscored statuses', () => {
    expect(formatStatus('waiting_for_approval')).toBe('waiting for approval');
  });

  it('shortens commit shas', () => {
    expect(shortSha('abcdef1234567890')).toBe('abcdef1');
    expect(shortSha(null)).toBe('—');
  });
});
