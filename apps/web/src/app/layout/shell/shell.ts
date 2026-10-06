import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';
import { FoIconChip } from '../../shared/ui/icon-chip/icon-chip';
import { FoLogo } from '../../shared/ui/logo/logo';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  tip: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StatusBadge, FoLogo, FoIconChip],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellLayout {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);
  /** Keep org-scoped socket alive while shell is mounted. */
  readonly realtime = inject(RealtimeService);

  readonly navOpen = signal(false);
  readonly isCompact = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: '▣', tip: 'Operations overview' },
    { label: 'Deployments', path: '/deployments', icon: '⇢', tip: 'Pipeline list & create' },
    { label: 'Services', path: '/services', icon: '◈', tip: 'Service catalog' },
    { label: 'Environments', path: '/environments', icon: '⧉', tip: 'Dev → Prod' },
    { label: 'Incidents', path: '/incidents', icon: '!', tip: 'Open & resolved' },
    { label: 'Approvals', path: '/approvals', icon: '✓', tip: 'Prod gates inbox' },
    { label: 'Health', path: '/health', icon: '♥', tip: 'Probe board' },
    { label: 'Audit', path: '/audit', icon: '☰', tip: 'Append-only trail' },
    { label: 'Reports', path: '/reports', icon: '▦', tip: 'Charts & Excel' },
    { label: 'Architecture', path: '/architecture', icon: '⬡', tip: 'System map' },
    { label: 'Simulation', path: '/simulation', icon: '⚙', tip: 'Failure knobs' },
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
