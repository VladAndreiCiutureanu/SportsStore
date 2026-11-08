import { Component, Injectable, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getErrorMessage } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { PasswordInput } from './password-input';

/** Permite oricarei pagini sa deschida fereastra "Prelungeste sesiunea". */
@Injectable({ providedIn: 'root' })
export class ReauthPrompt {
  readonly requested = signal(0);
  open(): void {
    this.requested.update((n) => n + 1);
  }
}

/**
 * Cu 5 minute inainte de expirarea tokenului afiseaza o bara de avertizare cu numaratoare inversa
 * si ofera "Raman conectat". Backend-ul nu are refresh token, asa ca prelungirea inseamna
 * reintroducerea parolei (un login nou care aduce un token nou, valabil inca o ora).
 */
@Component({
  selector: 'app-session-expiry',
  imports: [ReactiveFormsModule, PasswordInput],
  template: `
    @if (auth.expiresSoon() && !dismissed()) {
      <div class="alert alert-warning rounded-0 mb-0 py-2 border-0 border-bottom" role="alert">
        <div class="container d-flex flex-wrap align-items-center gap-2">
          <span class="me-auto">
            Sesiunea ta expira in <strong class="font-monospace">{{ countdown() }}</strong>.
            Dupa aceea va trebui sa te autentifici din nou.
          </span>
          <button type="button" class="btn btn-sm btn-dark" (click)="open()">Raman conectat</button>
          <button type="button" class="btn btn-sm btn-link text-reset" (click)="dismissed.set(true)">Ascunde</button>
        </div>
      </div>
    }

    @if (modalOpen()) {
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="reauthTitle"
           (keydown.escape)="close()">
        <div class="modal-dialog modal-dialog-centered">
          <form class="modal-content" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="modal-header">
              <h2 class="modal-title h5" id="reauthTitle">Confirma ca esti tu</h2>
              <button type="button" class="btn-close" aria-label="Inchide" (click)="close()"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">
                Pentru siguranta, reintrodu parola contului <strong>{{ auth.username() }}</strong>.
                Sesiunea va fi prelungita cu inca o ora.
              </p>
              @if (error(); as message) {
                <div class="alert alert-danger py-2" role="alert">{{ message }}</div>
              }
              <label for="reauthPassword" class="form-label">Parola</label>
              <app-password-input
                inputId="reauthPassword"
                formControlName="password"
                autocomplete="current-password"
                [invalid]="form.controls.password.invalid && form.controls.password.touched"
              >
                <div class="invalid-feedback">Introdu parola (minim 8 caractere).</div>
              </app-password-input>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="logout()">Iesire din cont</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting()">
                @if (submitting()) {
                  <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                }
                Prelungeste sesiunea
              </button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }
  `,
})
export class SessionExpiry {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly dismissed = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly passwordField = viewChild(PasswordInput);

  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly countdown = computed(() => {
    const s = this.auth.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    const prompt = inject(ReauthPrompt);
    let seen = prompt.requested();
    effect(() => {
      const n = prompt.requested();
      if (n !== seen) {
        seen = n;
        this.open();
      }
    });

    // Cand sesiunea se termina (logout/expirare) inchidem tot si resetam starea.
    effect(() => {
      if (!this.auth.isLoggedIn()) {
        this.modalOpen.set(false);
        this.dismissed.set(false);
      }
    });
  }

  protected open(): void {
    this.form.reset();
    this.error.set(null);
    this.modalOpen.set(true);
    setTimeout(() => this.passwordField()?.focus());
  }

  protected close(): void {
    this.modalOpen.set(false);
  }

  protected logout(): void {
    this.modalOpen.set(false);
    this.auth.logout();
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.auth.reauthenticate(this.form.getRawValue().password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.modalOpen.set(false);
        this.dismissed.set(false);
        this.toast.success('Sesiunea a fost prelungita cu inca o ora.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(getErrorMessage(err));
        this.form.reset();
        setTimeout(() => this.passwordField()?.focus());
      },
    });
  }
}
