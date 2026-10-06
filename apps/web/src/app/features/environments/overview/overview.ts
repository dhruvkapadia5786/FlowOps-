import { Component, OnInit, inject, signal } from '@angular/core';
import { CatalogApi } from '../../../core/api/catalog.api';
import { EnvironmentRef } from '../../../core/api/models';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

@Component({
  selector: 'app-environments-page',
  imports: [PageHeader, StatusBadge],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class EnvironmentsPage implements OnInit {
  private readonly catalog = inject(CatalogApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<EnvironmentRef[]>([]);

  ngOnInit() {
    this.catalog.listEnvironments().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load environments.');
      },
    });
  }
}
