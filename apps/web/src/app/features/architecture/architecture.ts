import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { FoPipeline } from '../../shared/ui/pipeline/pipeline';

@Component({
  selector: 'app-architecture-page',
  imports: [PageHeader, FoPipeline, RouterLink],
  templateUrl: './architecture.html',
  styleUrl: './architecture.css',
})
export class ArchitecturePage {
  readonly sampleStatus = 'deploying' as const;
}
