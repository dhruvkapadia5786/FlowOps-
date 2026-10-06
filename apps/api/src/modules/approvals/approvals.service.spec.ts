jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

import { ApprovalStatus, DeploymentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalDecision } from './dto/approvals.dto';

describe('ApprovalsService.decide', () => {
  const prisma = {
    approval: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  };
  const audit = { log: jest.fn(async () => ({})) };
  const deployments = { transition: jest.fn(async () => ({})) };
  const queue = { add: jest.fn(async () => ({})) };
  const realtime = { emitToOrg: jest.fn(), emitToDeployment: jest.fn() };
  const notifications = {
    notifyUsers: jest.fn(async () => []),
    notifyOrgRoles: jest.fn(async () => []),
  };

  let service: ApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.approval.findMany.mockResolvedValue([]);
    service = new ApprovalsService(
      prisma as never,
      audit as never,
      deployments as never,
      queue as never,
      realtime as never,
      notifications as never,
    );
  });

  const pendingApproval = {
    id: 'a1',
    status: ApprovalStatus.pending,
    expiresAt: new Date(Date.now() + 60_000),
    deploymentId: 'd1',
    comment: null,
    deployment: {
      id: 'd1',
      status: DeploymentStatus.waiting_for_approval,
      organizationId: 'o1',
      triggeredById: 'u-trigger',
    },
  };

  it('approves and enqueues continue-pipeline', async () => {
    prisma.approval.findFirst
      .mockResolvedValueOnce(pendingApproval)
      .mockResolvedValueOnce({
        ...pendingApproval,
        status: ApprovalStatus.approved,
        deployment: { ...pendingApproval.deployment, events: [] },
        decidedBy: null,
      });
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.approval.update.mockResolvedValue({});

    await service.decide('o1', 'a1', 'u1', {
      decision: ApprovalDecision.approved,
      comment: 'Change window cleared',
    });

    expect(deployments.transition).toHaveBeenCalledWith(
      'd1',
      DeploymentStatus.deploying,
      expect.stringContaining('Approved'),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'continue-pipeline',
      { deploymentId: 'd1' },
      expect.any(Object),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'approval.decided',
        metadata: expect.objectContaining({ decision: 'approved' }),
      }),
    );
  });

  it('rejects and marks deployment failed', async () => {
    prisma.approval.findFirst
      .mockResolvedValueOnce(pendingApproval)
      .mockResolvedValueOnce({
        ...pendingApproval,
        status: ApprovalStatus.rejected,
        deployment: { ...pendingApproval.deployment, events: [] },
        decidedBy: null,
      });
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.approval.update.mockResolvedValue({});

    await service.decide('o1', 'a1', 'u1', {
      decision: ApprovalDecision.rejected,
      comment: 'Too risky',
    });

    expect(deployments.transition).toHaveBeenCalledWith(
      'd1',
      DeploymentStatus.failed,
      expect.stringContaining('Rejected'),
      'Too risky',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('expires and rejects decide when approval window passed', async () => {
    const expired = {
      ...pendingApproval,
      expiresAt: new Date(Date.now() - 1000),
    };
    prisma.approval.findFirst.mockResolvedValue(expired);
    prisma.approval.findUnique.mockResolvedValue({
      ...expired,
      status: ApprovalStatus.pending,
      deployment: pendingApproval.deployment,
    });
    prisma.approval.update.mockResolvedValue({});

    await expect(
      service.decide('o1', 'a1', 'u1', {
        decision: ApprovalDecision.approved,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(deployments.transition).toHaveBeenCalledWith(
      'd1',
      DeploymentStatus.failed,
      'Approval expired',
      'Approval expired before a decision was made',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval.expired' }),
    );
  });
});
