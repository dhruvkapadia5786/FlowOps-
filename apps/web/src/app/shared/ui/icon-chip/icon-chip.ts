import { Component, input } from '@angular/core';

export type ChipTone = 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

@Component({
  selector: 'fo-icon-chip',
  template: `
    <span
      class="badge gap-1.5 font-medium tracking-wide"
      [class]="badgeClass()"
      [attr.data-tip]="tooltip() || null"
      [class.tooltip]="!!tooltip()"
      [class.tooltip-bottom]="!!tooltip()"
    >
      @if (icon()) {
        <span class="text-sm leading-none" aria-hidden="true">{{ icon() }}</span>
      }
      <span>{{ label() }}</span>
    </span>
  `,
})
export class FoIconChip {
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly tone = input<ChipTone>('neutral');
  readonly tooltip = input<string | null>(null);
  readonly outline = input(false);

  badgeClass(): string {
    const tone = this.tone();
    const outline = this.outline();
    const map: Record<ChipTone, string> = {
      primary: outline ? 'badge-outline badge-primary' : 'badge-primary',
      secondary: outline ? 'badge-outline badge-secondary' : 'badge-secondary',
      accent: outline ? 'badge-outline badge-accent' : 'badge-accent',
      info: outline ? 'badge-outline badge-info' : 'badge-info',
      success: outline ? 'badge-outline badge-success' : 'badge-success',
      warning: outline ? 'badge-outline badge-warning' : 'badge-warning',
      error: outline ? 'badge-outline badge-error' : 'badge-error',
      neutral: outline ? 'badge-outline' : 'badge-ghost',
    };
    return map[tone];
  }
}
