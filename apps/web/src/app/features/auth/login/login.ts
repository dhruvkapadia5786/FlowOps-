import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['maya.chen@northstar.io', [Validators.required, Validators.email]],
    password: ['FlowOps!demo1', [Validators.required]],
  });

  submit() {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.submitting.set(false);
        const msg = err?.error?.message;
        this.error.set(
          Array.isArray(msg)
            ? msg.join(', ')
            : typeof msg === 'string'
              ? msg
              : 'Unable to sign in. Check credentials and API availability.',
        );
      },
    });
  }
}
