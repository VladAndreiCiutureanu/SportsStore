import { Component, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { getErrorMessages } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PasswordInput } from '../../shared/password-input';
import { passwordRulesValidator } from '../../shared/password-rules';
import { PasswordStrength } from '../../shared/password-strength';

/** ASP.NET Identity accepta implicit doar aceste caractere in numele de utilizator. */
const USERNAME_PATTERN = /^[a-zA-Z0-9\-._@+]+$/;

/** Cele doua parole introduse trebuie sa fie identice. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

type Field = 'username' | 'email' | 'password' | 'confirmPassword';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, PasswordInput, PasswordStrength],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(255), Validators.pattern(USERNAME_PATTERN)],
      ],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, passwordRulesValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  /** Parola curenta, pentru indicatorul de putere care se actualizeaza la fiecare tasta. */
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    const { username, email, password } = this.form.getRawValue();
    const request = { username: username.trim(), email: email.trim(), password };

    // Ca in aplicatiile reale: dupa creare te logam direct, fara sa mai scrii parola o data.
    this.auth
      .register(request)
      .pipe(
        switchMap((created) =>
          this.auth.login({ usernameOrEmail: created.username, password }, false).pipe(
            catchError(() => of(null)), // contul exista; daca login-ul automat esueaza, mergem la Login
          ),
        ),
      )
      .subscribe({
        next: (session) => {
          if (session) {
            this.toast.success(`Cont creat. Bine ai venit, ${session.username}!`);
            this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
          } else {
            this.router.navigate(['/login'], { queryParams: { registered: request.username } });
          }
        },
        error: (err) => {
          this.showServerErrors(getErrorMessages(err));
          this.submitting.set(false);
        },
      });
  }

  /** Pune fiecare eroare de la server sub campul la care se refera; restul apar sus. */
  private showServerErrors(messages: string[]): void {
    const general: string[] = [];
    for (const message of messages) {
      const field = fieldFor(message);
      if (field) {
        const control = this.form.controls[field];
        control.setErrors({ ...(control.errors ?? {}), server: message });
        control.markAsTouched();
      } else {
        general.push(message);
      }
    }
    this.error.set(general.length ? general.join(' ') : null);
  }

  protected invalid(name: Field): boolean {
    const control = this.form.controls[name];
    if (name === 'confirmPassword') {
      return control.touched && (control.invalid || this.form.hasError('mismatch'));
    }
    return control.invalid && control.touched;
  }

  protected has(name: Field, error: string): boolean {
    return this.form.controls[name].hasError(error);
  }

  protected serverError(name: Field): string | null {
    return this.form.controls[name].getError('server') ?? null;
  }
}

/** Mesajele traduse din api-error.ts incep cu numele campului. */
function fieldFor(message: string): Field | null {
  if (message.startsWith('Numele')) return 'username';
  if (/email/i.test(message)) return 'email';
  if (message.startsWith('Parola')) return 'password';
  return null;
}

function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/';
}
