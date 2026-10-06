import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthSession,
  AuthUserSummary,
  LoginRequest,
  MeResponse,
  Membership,
  OrganizationSummary,
  OrgRole,
} from './auth.models';

const STORAGE_KEY = 'flowops.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());
  private readonly meSignal = signal<MeResponse | null>(null);
  private readonly bootstrappedSignal = signal(false);

  readonly session = this.sessionSignal.asReadonly();
  readonly me = this.meSignal.asReadonly();
  readonly bootstrapped = this.bootstrappedSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.sessionSignal()?.accessToken);
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly organization = computed(() => this.sessionSignal()?.organization ?? null);
  readonly role = computed(() => this.sessionSignal()?.role ?? null);
  readonly memberships = computed(() => this.meSignal()?.memberships ?? []);

  bootstrap(): Observable<boolean> {
    const session = this.sessionSignal();
    if (!session?.accessToken) {
      this.bootstrappedSignal.set(true);
      return of(false);
    }

    return this.http.get<MeResponse>(`${environment.apiBaseUrl}/auth/me`).pipe(
      tap((me) => {
        this.meSignal.set(me);
        this.ensureOrgSelection(me.memberships);
        this.bootstrappedSignal.set(true);
      }),
      map(() => true),
      catchError(() => {
        const refresh = session.refreshToken;
        if (!refresh) {
          this.clearSession();
          this.bootstrappedSignal.set(true);
          return of(false);
        }
        return this.refreshTokens(refresh).pipe(
          switchMap(() =>
            this.http.get<MeResponse>(`${environment.apiBaseUrl}/auth/me`).pipe(
              tap((me) => {
                this.meSignal.set(me);
                this.ensureOrgSelection(me.memberships);
                this.bootstrappedSignal.set(true);
              }),
              map(() => true),
            ),
          ),
          catchError(() => {
            this.clearSession();
            this.bootstrappedSignal.set(true);
            return of(false);
          }),
        );
      }),
    );
  }

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(
        switchMap((session) => {
          this.persistSession(session);
          return this.http.get<MeResponse>(`${environment.apiBaseUrl}/auth/me`).pipe(
            switchMap((me) => {
              this.meSignal.set(me);
              const first = me.memberships[0];
              if (first && !session.organization) {
                return this.selectOrganization(first.organization.id).pipe(
                  map(() => this.sessionSignal()!),
                );
              }
              this.ensureOrgSelection(me.memberships);
              return of(this.sessionSignal()!);
            }),
          );
        }),
      );
  }

  logout(): Observable<void> {
    const session = this.sessionSignal();
    const finish = () => {
      this.clearSession();
      void this.router.navigateByUrl('/login');
    };

    if (!session?.refreshToken || !session.accessToken) {
      finish();
      return of(void 0);
    }

    return this.http
      .post<{ success: boolean }>(`${environment.apiBaseUrl}/auth/logout`, {
        refreshToken: session.refreshToken,
      })
      .pipe(
        catchError(() => of(null)),
        tap(() => finish()),
        map(() => void 0),
      );
  }

  selectOrganization(orgId: string): Observable<AuthSession> {
    return this.http
      .post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUserSummary;
        organization: OrganizationSummary;
        role: OrgRole;
      }>(`${environment.apiBaseUrl}/orgs/${orgId}/select`, {})
      .pipe(
        tap((res) => {
          this.persistSession({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user,
            organization: res.organization,
            role: res.role,
          });
        }),
        map((res) => ({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          user: res.user,
          organization: res.organization,
          role: res.role,
        })),
      );
  }

  refreshTokens(refreshToken: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${environment.apiBaseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((session) => {
          const current = this.sessionSignal();
          this.persistSession({
            ...session,
            organization: current?.organization ?? null,
            role: current?.role ?? null,
          });
        }),
      );
  }

  accessToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  orgId(): string | null {
    return this.sessionSignal()?.organization?.id ?? null;
  }

  private ensureOrgSelection(memberships: Membership[]) {
    const current = this.sessionSignal();
    if (!current) {
      return;
    }
    if (current.organization) {
      return;
    }
    const first = memberships[0];
    if (!first) {
      return;
    }
    // Soft-set until select is called; X-Org-Id interceptor uses this.
    this.persistSession({
      ...current,
      organization: first.organization,
      role: first.role,
    });
  }

  private persistSession(session: AuthSession) {
    this.sessionSignal.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private clearSession() {
    this.sessionSignal.set(null);
    this.meSignal.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }
}
