import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogApi } from '../../../core/api/catalog.api';
import { DeploymentsApi } from '../../../core/api/deployments.api';
import { EnvironmentRef, ServiceSummary } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-deployment-create-page',
  imports: [PageHeader, ReactiveFormsModule, RouterLink],
  templateUrl: './create.html',
  styleUrl: './create.css',
})
export class DeploymentCreatePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(CatalogApi);
  private readonly api = inject(DeploymentsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly services = signal<ServiceSummary[]>([]);
  readonly environments = signal<EnvironmentRef[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    serviceId: ['', Validators.required],
    environmentId: ['', Validators.required],
    version: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._+-]+$/)]],
    commitSha: [''],
  });

  ngOnInit() {
    forkJoin({
      services: this.catalog.listServices(100),
      environments: this.catalog.listEnvironments(),
    }).subscribe({
      next: ({ services, environments }) => {
        this.services.set(services.data);
        const role = this.auth.role();
        const envs =
          role === 'developer'
            ? environments.filter((e) => !e.requiresApproval && e.slug !== 'prod')
            : environments;
        this.environments.set(envs);
        const firstService = services.data[0];
        const preferredEnv =
          envs.find((e) => e.slug === 'dev' || e.slug === 'qa') ?? envs[0];
        this.form.patchValue({
          serviceId: firstService?.id ?? '',
          environmentId: preferredEnv?.id ?? '',
          version: `0.${new Date().getMinutes()}.${new Date().getSeconds()}`,
          commitSha: Math.random().toString(16).slice(2, 9),
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load services/environments.');
      },
    });
  }

  selectedEnvRequiresApproval(): boolean {
    const id = this.form.controls.environmentId.value;
    return !!this.environments().find((e) => e.id === id)?.requiresApproval;
  }

  submit() {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.api
      .create({
        serviceId: raw.serviceId,
        environmentId: raw.environmentId,
        version: raw.version,
        commitSha: raw.commitSha || undefined,
      })
      .subscribe({
        next: (dep) => {
          this.submitting.set(false);
          void this.router.navigate(['/deployments', dep.id]);
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.submitting.set(false);
          const msg = err?.error?.message;
          this.error.set(
            Array.isArray(msg)
              ? msg.join(', ')
              : typeof msg === 'string'
                ? msg
                : 'Failed to create deployment.',
          );
        },
      });
  }
}
