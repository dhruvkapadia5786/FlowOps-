import { Component, OnInit, inject, signal } from '@angular/core';
import { CatalogApi } from '../../../core/api/catalog.api';
import { ServiceSummary } from '../../../core/api/models';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

@Component({
  selector: 'app-services-page',
  imports: [PageHeader, StatusBadge],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class ServicesPage implements OnInit {
  private readonly catalog = inject(CatalogApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ServiceSummary[]>([]);

  ngOnInit() {
    this.catalog.listServices(100, false).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load services.');
      },
    });
  }
}
