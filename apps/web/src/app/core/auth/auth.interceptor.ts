import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(environment.apiBaseUrl);
  if (!isApi) {
    return next(req);
  }

  const token = auth.accessToken();
  const orgId = auth.orgId();
  const headers: Record<string, string> = {};
  if (token && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (orgId && !req.headers.has('X-Org-Id')) {
    headers['X-Org-Id'] = orgId;
  }

  const authedReq = Object.keys(headers).length
    ? req.clone({ setHeaders: headers })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      const url = req.url;
      if (
        url.includes('/auth/login') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/register')
      ) {
        return throwError(() => err);
      }

      const refresh = auth.session()?.refreshToken;
      if (!refresh) {
        return throwError(() => err);
      }

      return auth.refreshTokens(refresh).pipe(
        switchMap((session) => {
          const retryHeaders: Record<string, string> = {
            Authorization: `Bearer ${session.accessToken}`,
          };
          const nextOrg = auth.orgId();
          if (nextOrg) {
            retryHeaders['X-Org-Id'] = nextOrg;
          }
          return next(req.clone({ setHeaders: retryHeaders }));
        }),
        catchError((refreshErr) => throwError(() => refreshErr)),
      );
    }),
  );
};
