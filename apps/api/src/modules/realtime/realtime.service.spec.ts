import { REALTIME_EVENTS } from './realtime.events';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('emits to org room when server is attached', () => {
    const service = new RealtimeService();
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const emit = jest.fn();
    to.mockReturnValue({ emit });
    service.attach({ to } as never);

    service.emitToOrg('org-1', REALTIME_EVENTS.DEPLOYMENT_UPDATED, {
      id: 'd1',
      status: 'success',
    });

    expect(to).toHaveBeenCalledWith('org:org-1');
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.DEPLOYMENT_UPDATED,
      expect.objectContaining({ id: 'd1' }),
    );
  });

  it('does not throw when server is not attached', () => {
    const service = new RealtimeService();
    expect(() =>
      service.emitToOrg('org-1', REALTIME_EVENTS.INCIDENT_CREATED, {}),
    ).not.toThrow();
  });
});
