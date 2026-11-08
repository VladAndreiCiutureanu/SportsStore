import { Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PasswordInput } from '../../shared/password-input';

/** Backend-ul (ASP.NET Identity, valori implicite) blocheaza contul 5 minute dupa 5 parole gresite. */
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordInput],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Parametri din URL (?returnUrl=...&expired=1&registered=nume), primiti prin withComponentInputBinding.
  readonly returnUrl = input<string>();
  readonly expired = input<string>();
  readonly registered = input<string>();

  private readonly passwordField = viewChild.required(PasswordInput);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Parole gresite consecutive pentru acelasi utilizator, numarate in pagina curenta. */
  protected readonly failedAttempts = signal(0);
  private lastIdentifier = '';

  protected readonly lockoutAttempts = LOCKOUT_ATTEMPTS;
  protected readonly lockoutMinutes = LOCKOUT_MINUTES;
  protected readonly attemptsLeft = computed(() => Math.max(0, LOCKOUT_ATTEMPTS - this.failedAttempts()));

  protected readonly info = computed(() => {
    if (this.registered()) return `Contul „${this.registered()}” a fost creat. Te poti autentifica.`;
    if (this.expired()) return 'Sesiunea a expirat. Autentifica-te din nou ca sa continui.';
    if (this.returnUrl()) return 'Trebuie sa te autentifici pentru a continua.';
    return null;
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    usernameOrEmail: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [false],
  });

  ngOnInit(): void {
    // Dupa inregistrare completam automat numele de utilizator si mutam cursorul pe parola.
    const name = this.registered();
    if (name) {
      this.form.controls.usernameOrEmail.setValue(name);
      queueMicrotask(() => this.passwordField().focus());
    }
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const { usernameOrEmail, password, remember } = this.form.getRawValue();
    const identifier = usernameOrEmail.trim();
    if (identifier.toLowerCase() !== this.lastIdentifier) {
      this.lastIdentifier = identifier.toLowerCase();
      this.failedAttempts.set(0);
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login({ usernameOrEmail: identifier, password }, remember).subscribe({
      next: (response) => {
        this.toast.success(`Bine ai venit, ${response.username}!`);
        this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
      },
      error: (err) => {
        if (err?.status === 401) this.failedAttempts.update((n) => n + 1);
        this.error.set(getErrorMessage(err));
        this.form.controls.password.reset();
        this.submitting.set(false);
        queueMicrotask(() => this.passwordField().focus());
      },
    });
  }

  protected invalid(name: 'usernameOrEmail' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }
}

/** Acceptam doar adrese interne (ex. "/cart"), nu "https://alt-site" sau "//alt-site". */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/';
}
