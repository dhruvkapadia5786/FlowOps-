import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.bootstrapped()) {
    if (auth.isAuthenticated()) {
      return true;
    }
    return router.createUrlTree(['/login']);
  }

  return auth.bootstrap().pipe(
    map((ok) => (ok ? true : router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.bootstrapped()) {
    if (!auth.isAuthenticated()) {
      return true;
    }
    return router.createUrlTree(['/']);
  }

  return auth.bootstrap().pipe(
    map((ok) => (ok ? router.createUrlTree(['/']) : true)),
  );
};
