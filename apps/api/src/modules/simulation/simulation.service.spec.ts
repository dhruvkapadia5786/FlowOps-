import { SimulationService, SCENARIOS } from './simulation.service';

describe('SimulationService catalog', () => {
  it('exposes payment failure and recovery scenarios', () => {
    expect(SCENARIOS.some((s) => s.key === 'payment_api_failure')).toBe(true);
    expect(
      SCENARIOS.find((s) => s.key === 'payment_api_failure')?.recoverable,
    ).toBe(true);
    expect(SCENARIOS.find((s) => s.key === 'deployment_failure')?.recoverable).toBe(
      false,
    );
  });
});

describe('SimulationService settings', () => {
  it('ensures settings and serializes simulationMode', async () => {
    const prisma = {
      simulationSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 's1',
          organizationId: 'o1',
          simulationMode: true,
          buildFailRate: 0,
          deployFailRate: 0,
          healthFailRate: 0,
          stageDelayMs: 400,
          deterministic: false,
          activeEffects: [],
          updatedAt: new Date(),
        }),
        update: jest.fn(),
      },
    };
    const audit = { log: jest.fn() };
    const health = { runChecks: jest.fn() };
    const incidents = { resolve: jest.fn() };
    const deployments = { create: jest.fn(), transition: jest.fn(), get: jest.fn() };
    const rollbacks = { start: jest.fn() };
    const realtime = { emitToOrg: jest.fn() };

    const service = new SimulationService(
      prisma as never,
      audit as never,
      health as never,
      incidents as never,
      deployments as never,
      rollbacks as never,
      realtime as never,
    );

    const settings = await service.getSettings('o1');
    expect(settings.simulationMode).toBe(true);
    expect(settings.framing).toContain('Local simulation');
    expect(prisma.simulationSettings.create).toHaveBeenCalled();
  });
});
