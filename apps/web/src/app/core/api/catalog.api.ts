import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalListItem,
  ApprovalStatus,
  EnvironmentRef,
  HealthSnapshot,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  Paginated,
  ServiceSummary,
} from './models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  listServices(pageSize = 100): Observable<Paginated<ServiceSummary>> {
    const params = new HttpParams()
      .set('page', '1')
      .set('pageSize', String(pageSize))
      .set('isActive', 'true');
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

  listApprovals(status?: ApprovalStatus, pageSize = 20): Observable<Paginated<ApprovalListItem>> {
    let params = new HttpParams().set('page', '1').set('pageSize', String(pageSize));
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Paginated<ApprovalListItem>>(`${this.api}/approvals`, { params });
  }

  listIncidents(opts: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    pageSize?: number;
  } = {}): Observable<Paginated<IncidentSummary>> {
    let params = new HttpParams()
      .set('page', '1')
      .set('pageSize', String(opts.pageSize ?? 20));
    if (opts.status) {
      params = params.set('status', opts.status);
    }
    if (opts.severity) {
      params = params.set('severity', opts.severity);
    }
    return this.http.get<Paginated<IncidentSummary>>(`${this.api}/incidents`, { params });
  }

  listHealth(): Observable<HealthSnapshot[]> {
    return this.http.get<HealthSnapshot[]>(`${this.api}/service-health`);
  }

  getHealth(serviceId: string, environmentId: string): Observable<HealthSnapshot> {
    return this.http.get<HealthSnapshot>(
      `${this.api}/service-health/${serviceId}/${environmentId}`,
    );
  }
}
