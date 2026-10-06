import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateDeploymentRequest,
  DeploymentDetail,
  DeploymentEvent,
  DeploymentSummary,
  ListDeploymentsParams,
  Paginated,
  RollbackRecord,
} from './models';

@Injectable({ providedIn: 'root' })
export class DeploymentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/deployments`;

  list(params: ListDeploymentsParams = {}): Observable<Paginated<DeploymentSummary>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<Paginated<DeploymentSummary>>(this.base, { params: httpParams });
  }

  get(id: string): Observable<DeploymentDetail> {
    return this.http.get<DeploymentDetail>(`${this.base}/${id}`);
  }

  events(id: string): Observable<DeploymentEvent[]> {
    return this.http.get<DeploymentEvent[]>(`${this.base}/${id}/events`);
  }

  create(body: CreateDeploymentRequest): Observable<DeploymentDetail> {
    return this.http.post<DeploymentDetail>(this.base, body);
  }

  getRollback(id: string): Observable<RollbackRecord | null> {
    return this.http.get<RollbackRecord | null>(`${this.base}/${id}/rollback`);
  }

  startRollback(id: string): Observable<RollbackRecord> {
    return this.http.post<RollbackRecord>(`${this.base}/${id}/rollback`, {});
  }
}
