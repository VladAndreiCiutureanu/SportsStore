import { Component, computed, input } from '@angular/core';
import { PASSWORD_RULES, passwordStrength } from './password-rules';

const LEVELS = [
  { label: '', css: 'bg-secondary' },
  { label: 'Foarte slaba', css: 'bg-danger' },
  { label: 'Slaba', css: 'bg-warning' },
  { label: 'Buna', css: 'bg-info' },
  { label: 'Puternica', css: 'bg-success' },
];

/** Bara de putere + lista regulilor care se bifeaza pe masura ce scrii parola. */
@Component({
  selector: 'app-password-strength',
  template: `
    <div class="mt-2" [attr.id]="id()">
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="progress flex-grow-1" style="height: 6px" role="progressbar"
             aria-label="Puterea parolei" [attr.aria-valuenow]="score()" aria-valuemin="0" aria-valuemax="4">
          <div class="progress-bar" [class]="level().css" [style.width.%]="score() * 25"></div>
        </div>
        <small class="text-body-secondary" style="min-width: 6.5rem">{{ level().label }}</small>
      </div>
      <ul class="list-unstyled small mb-0 row row-cols-1 row-cols-sm-2 g-0">
        @for (rule of rules(); track rule.key) {
          <li class="col" [class.text-success]="rule.ok" [class.text-body-secondary]="!rule.ok">
            <span aria-hidden="true">{{ rule.ok ? '✓' : '○' }}</span>
            {{ rule.label }}
            <span class="visually-hidden">{{ rule.ok ? '(indeplinit)' : '(neindeplinit)' }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class PasswordStrength {
  readonly password = input('');
  readonly id = input<string>('');

  protected readonly score = computed(() => passwordStrength(this.password()));
  protected readonly level = computed(() => LEVELS[this.score()]);
  protected readonly rules = computed(() =>
    PASSWORD_RULES.map((r) => ({ key: r.key, label: r.label, ok: r.test(this.password()) })),
  );
}
