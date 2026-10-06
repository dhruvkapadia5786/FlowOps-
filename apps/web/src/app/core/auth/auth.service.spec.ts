import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('stores session and selects org on login', () => {
    service.login({ email: 'maya@northstar.demo', password: 'FlowOps!demo1' }).subscribe();

    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'maya@northstar.demo', fullName: 'Maya Chen' },
    });

    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      id: 'u1',
      email: 'maya@northstar.demo',
      fullName: 'Maya Chen',
      isActive: true,
      createdAt: new Date().toISOString(),
      memberships: [
        {
          role: 'admin',
          organization: { id: 'o1', name: 'Northstar Commerce', slug: 'northstar' },
        },
      ],
    });

    http.expectOne(`${environment.apiBaseUrl}/orgs/o1/select`).flush({
      accessToken: 'access2',
      refreshToken: 'refresh2',
      user: { id: 'u1', email: 'maya@northstar.demo', fullName: 'Maya Chen' },
      organization: { id: 'o1', name: 'Northstar Commerce', slug: 'northstar' },
      role: 'admin',
    });

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.organization()?.id).toBe('o1');
    expect(service.role()).toBe('admin');
  });

  it('clears session on logout', () => {
    service.login({ email: 'maya@northstar.demo', password: 'x' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', email: 'maya@northstar.demo', fullName: 'Maya Chen' },
      organization: { id: 'o1', name: 'Northstar', slug: 'northstar' },
      role: 'admin',
    });
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      id: 'u1',
      email: 'maya@northstar.demo',
      fullName: 'Maya Chen',
      isActive: true,
      createdAt: new Date().toISOString(),
      memberships: [
        {
          role: 'admin',
          organization: { id: 'o1', name: 'Northstar', slug: 'northstar' },
        },
      ],
    });

    service.logout().subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush({ success: true });
    expect(service.isAuthenticated()).toBeFalse();
  });
});
