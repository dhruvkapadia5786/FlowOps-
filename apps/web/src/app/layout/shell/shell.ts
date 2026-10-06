import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StatusBadge],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellLayout {
  readonly auth = inject(AuthService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);

  readonly navOpen = signal(false);
  readonly isCompact = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/' },
    { label: 'Deployments', path: '/deployments' },
    { label: 'Services', path: '/services' },
    { label: 'Environments', path: '/environments' },
    { label: 'Incidents', path: '/incidents' },
    { label: 'Approvals', path: '/approvals' },
    { label: 'Health', path: '/health' },
    { label: 'Audit', path: '/audit' },
  ];

  constructor() {
    this.breakpoints
      .observe('(max-width: 900px)')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isCompact.set(state.matches);
        if (!state.matches) {
          this.navOpen.set(false);
        }
      });
  }

  toggleNav() {
    this.navOpen.update((v) => !v);
  }

  closeNav() {
    this.navOpen.set(false);
  }

  onOrgChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const orgId = select.value;
    if (!orgId || orgId === this.auth.organization()?.id) {
      return;
    }
    this.auth.selectOrganization(orgId).subscribe();
  }

  logout() {
    this.confirm
      .open({
        title: 'Sign out?',
        body: 'You will need to authenticate again to access FlowOps.',
        confirmLabel: 'Sign out',
      })
      .subscribe((ok) => {
        if (ok) {
          this.auth.logout().subscribe();
        }
      });
  }
}
