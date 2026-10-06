export const REALTIME_EVENTS = {
  DEPLOYMENT_UPDATED: 'deployment.updated',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_RESOLVED: 'approval.resolved',
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  HEALTH_UPDATED: 'health.updated',
  ROLLBACK_STARTED: 'rollback.started',
  ROLLBACK_COMPLETED: 'rollback.completed',
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
