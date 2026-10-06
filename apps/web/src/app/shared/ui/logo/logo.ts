import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-logo',
  template: `
    <span class="logo" [class.logo--lg]="size() === 'lg'" [attr.aria-hidden]="decorated() ? null : true">
      <svg
        class="logo__mark"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        [attr.aria-label]="decorated() ? 'FlowOps' : null"
      >
        <defs>
          <linearGradient id="foMarkGrad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
            <stop stop-color="#3ecf8e" />
            <stop offset="0.55" stop-color="#1f8f5f" />
            <stop offset="1" stop-color="#5b9fd4" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="9" fill="url(#foMarkGrad)" />
        <path
          d="M11 27V13h7.2c3.4 0 5.5 1.85 5.5 4.55 0 1.7-.85 3.05-2.35 3.85L26.6 27h-3.55l-4.5-5.2H14.2V27H11zm3.2-8.05h3.85c1.7 0 2.7-.85 2.7-2.2s-1-2.15-2.7-2.15H14.2v4.35z"
          fill="#04120c"
        />
        <circle cx="29.5" cy="12.5" r="2.25" fill="#e8eef7" opacity="0.9" />
      </svg>
      @if (showWordmark()) {
        <span class="logo__word">
          <span class="logo__name">FlowOps</span>
          @if (tagline()) {
            <span class="logo__tag">{{ tagline() }}</span>
          }
        </span>
      }
    </span>
  `,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo__mark {
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      filter: drop-shadow(0 0 12px color-mix(in srgb, var(--color-accent) 35%, transparent));
      animation: fo-logo-in 480ms ease both;
    }

    .logo--lg .logo__mark {
      width: 2.25rem;
      height: 2.25rem;
    }

    .logo__word {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .logo__name {
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .logo--lg .logo__name {
      font-size: 1.125rem;
    }

    .logo__tag {
      color: var(--color-ink-faint);
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      line-height: 1.2;
    }

    @keyframes fo-logo-in {
      from {
        opacity: 0;
        transform: scale(0.86) rotate(-6deg);
      }
      to {
        opacity: 1;
        transform: scale(1) rotate(0);
      }
    }
  `,
})
export class FoLogo {
  readonly size = input<'md' | 'lg'>('md');
  readonly showWordmark = input(true);
  readonly tagline = input<string | null>('Control plane');
  readonly decorated = input(true);
}
