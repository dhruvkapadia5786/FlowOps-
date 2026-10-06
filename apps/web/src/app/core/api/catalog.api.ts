import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalListItem,
  ApprovalStatus,
  AuditFacets,
  AuditLogRow,
  EnvironmentRef,
  HealthSnapshot,
  IncidentDetail,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  ListAuditParams,
  ListIncidentsParams,
  Paginated,
  ServiceSummary,
  SimulationEffect,
  SimulationScenario,
  SimulationSettings,
} from './models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  listServices(pageSize = 100, activeOnly = true): Observable<Paginated<ServiceSummary>> {
    let params = new HttpParams().set('page', '1').set('pageSize', String(pageSize));
    if (activeOnly) {
      params = params.set('isActive', 'true');
    }
    return this.http.get<Paginated<ServiceSummary>>(`${this.api}/services`, { params });
  }

  listEnvironments(): Observable<EnvironmentRef[]> {
    return this.http.get<EnvironmentRef[]>(`${this.api}/environments`);
  }
}

@Injectable({ providedIn: 'root' })
export class OpsApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  listApprovals(
    status?: ApprovalStatus | '',
    page = 1,
    pageSize = 20,
  ): Observable<Paginated<ApprovalListItem>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Paginated<ApprovalListItem>>(`${this.api}/approvals`, { params });
  }

  decideApproval(
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Observable<ApprovalListItem> {
    return this.http.post<ApprovalListItem>(`${this.api}/approvals/${id}/decide`, {
      decision,
      comment,
    });
  }

  listIncidents(opts: ListIncidentsParams = {}): Observable<Paginated<IncidentSummary>> {
    let params = new HttpParams();
    Object.entries(opts).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    if (!params.has('page')) {
      params = params.set('page', '1');
    }
    if (!params.has('pageSize')) {
      params = params.set('pageSize', '25');
    }
    return this.http.get<Paginated<IncidentSummary>>(`${this.api}/incidents`, { params });
  }

  getIncident(id: string): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.api}/incidents/${id}`);
  }

  updateIncident(
    id: string,
    body: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      description?: string;
      note?: string;
    },
  ): Observable<IncidentDetail> {
    return this.http.patch<IncidentDetail>(`${this.api}/incidents/${id}`, body);
  }

  resolveIncident(id: string, note?: string): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(`${this.api}/incidents/${id}/resolve`, { note });
  }

  listHealth(): Observable<HealthSnapshot[]> {
    return this.http.get<HealthSnapshot[]>(`${this.api}/service-health`);
  }

  getHealth(serviceId: string, environmentId: string): Observable<HealthSnapshot> {
    return this.http.get<HealthSnapshot>(
      `${this.api}/service-health/${serviceId}/${environmentId}`,
    );
  }

  listAuditLogs(opts: ListAuditParams = {}): Observable<Paginated<AuditLogRow>> {
    let params = new HttpParams();
    Object.entries(opts).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    if (!params.has('page')) {
      params = params.set('page', '1');
    }
    if (!params.has('pageSize')) {
      params = params.set('pageSize', '25');
    }
    return this.http.get<Paginated<AuditLogRow>>(`${this.api}/audit-logs`, { params });
  }

  auditFacets(): Observable<AuditFacets> {
    return this.http.get<AuditFacets>(`${this.api}/audit-logs/facets`);
  }

  getSimulationSettings(): Observable<SimulationSettings> {
    return this.http.get<SimulationSettings>(`${this.api}/simulation/settings`);
  }

  updateSimulationSettings(
    body: Partial<{
      buildFailRate: number;
      deployFailRate: number;
      healthFailRate: number;
      stageDelayMs: number;
      deterministic: boolean;
    }>,
  ): Observable<SimulationSettings> {
    return this.http.put<SimulationSettings>(`${this.api}/simulation/settings`, body);
  }

  listSimulationScenarios(): Observable<{
    simulationMode: boolean;
    framing: string;
    scenarios: SimulationScenario[];
  }> {
    return this.http.get<{
      simulationMode: boolean;
      framing: string;
      scenarios: SimulationScenario[];
    }>(`${this.api}/simulation/scenarios`);
  }

  runSimulationScenario(
    key: string,
    body: { serviceId?: string; environmentId?: string } = {},
  ): Observable<{
    effect: SimulationEffect;
    settings: SimulationSettings;
    framing: string;
    incident?: { id: string } | null;
    deployment?: { id: string } | null;
  }> {
    return this.http.post<{
      effect: SimulationEffect;
      settings: SimulationSettings;
      framing: string;
      incident?: { id: string } | null;
      deployment?: { id: string } | null;
    }>(`${this.api}/simulation/scenarios/${key}/run`, body);
  }

  recoverSimulationScenario(
    key: string,
    effectId?: string,
  ): Observable<{ recovered: SimulationEffect; settings: SimulationSettings }> {
    let params = new HttpParams();
    if (effectId) {
      params = params.set('effectId', effectId);
    }
    return this.http.post<{ recovered: SimulationEffect; settings: SimulationSettings }>(
      `${this.api}/simulation/scenarios/${key}/recover`,
      {},
      { params },
    );
  }

  runChaosBurst(count = 5): Observable<{ created: { id: string; service: string; version: string }[] }> {
    return this.http.post<{ created: { id: string; service: string; version: string }[] }>(
      `${this.api}/simulation/run-chaos-burst`,
      { count },
    );
  }
}
