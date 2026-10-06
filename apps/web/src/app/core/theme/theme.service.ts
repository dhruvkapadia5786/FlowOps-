import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'flowops.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.readStored());
  readonly resolved = signal<ResolvedTheme>('dark');

  private media: MediaQueryList | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.media = window.matchMedia('(prefers-color-scheme: light)');
      this.media.addEventListener('change', () => this.apply());
    }
    this.apply();
  }

  setPreference(pref: ThemePreference) {
    this.preference.set(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore quota / private mode */
    }
    this.apply();
  }

  cycle() {
    const order: ThemePreference[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(this.preference()) + 1) % order.length];
    this.setPreference(next);
  }

  label(): string {
    const p = this.preference();
    if (p === 'system') {
      return `System (${this.resolved()})`;
    }
    return p === 'dark' ? 'Dark' : 'Light';
  }

  /** DaisyUI theme attribute value */
  daisyTheme(): string {
    return this.resolved() === 'light' ? 'flowops-light' : 'flowops';
  }

  private apply() {
    const pref = this.preference();
    const resolved: ResolvedTheme =
      pref === 'system' ? (this.media?.matches ? 'light' : 'dark') : pref;
    this.resolved.set(resolved);
    if (typeof document !== 'undefined') {
      const daisy = resolved === 'light' ? 'flowops-light' : 'flowops';
      document.documentElement.dataset['theme'] = daisy;
      document.documentElement.style.colorScheme = resolved;
    }
  }

  private readStored(): ThemePreference {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'dark' || v === 'light' || v === 'system') {
        return v;
      }
    } catch {
      /* ignore */
    }
    return 'dark';
  }
}
