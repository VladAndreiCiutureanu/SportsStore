import { Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Camp de parola reutilizabil, compatibil cu formControlName:
 * - buton "arata/ascunde parola";
 * - avertisment cand Caps Lock este activ.
 * Mesajele de eroare (<div class="invalid-feedback">) se pun in interiorul tag-ului.
 */
@Component({
  selector: 'app-password-input',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInput), multi: true },
  ],
  template: `
    <div class="input-group has-validation">
      <input
        #field
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        class="form-control"
        [class.is-invalid]="invalid()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-describedby]="describedBy() || null"
        [value]="value()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="onBlur()"
        (keydown)="checkCapsLock($event)"
        (keyup)="checkCapsLock($event)"
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        [disabled]="disabled()"
        [attr.aria-label]="visible() ? 'Ascunde parola' : 'Arata parola'"
        [attr.aria-pressed]="visible()"
        [title]="visible() ? 'Ascunde parola' : 'Arata parola'"
        (click)="toggle()"
      >
        @if (visible()) {
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13.36 11.24 15 12.88l-.7.7L1.7 1 2.4.3l2.2 2.2A7.6 7.6 0 0 1 8 2c4.5 0 7.5 4.6 7.6 4.8l.2.2-.2.3a13 13 0 0 1-2.24 3.94ZM6.06 3.96l1.06 1.06a3 3 0 0 1 3.86 3.86l1.42 1.42A11.6 11.6 0 0 0 14.6 7C13.9 6 11.4 3 8 3c-.7 0-1.34.12-1.94.32ZM.4 6.7l-.2.3.2.3C.4 7.6 3.5 12 8 12c.92 0 1.78-.17 2.56-.45l-.8-.8A6 6 0 0 1 8 11C4.6 11 2.1 8 1.4 7c.37-.5 1.13-1.43 2.2-2.24l-.7-.7A13 13 0 0 0 .4 6.7Zm4.62-.33A3 3 0 0 0 8.63 10l-.83-.83A2 2 0 0 1 5.85 7.2l-.83-.83Z"/>
          </svg>
        } @else {
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 2C3.5 2 .4 6.4.2 6.7L0 7l.2.3C.4 7.6 3.5 12 8 12s7.6-4.4 7.8-4.7L16 7l-.2-.3C15.6 6.4 12.5 2 8 2Zm0 9C4.6 11 2.1 8 1.4 7 2.1 6 4.6 3 8 3s5.9 3 6.6 4c-.7 1-3.2 4-6.6 4Zm0-7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>
          </svg>
        }
      </button>
      <ng-content />
    </div>
    @if (capsLock()) {
      <div class="form-text text-warning-emphasis">
        <strong>Caps Lock</strong> este activ.
      </div>
    }
  `,
})
export class PasswordInput implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly invalid = input(false);
  readonly describedBy = input<string>('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly visible = signal(false);
  protected readonly capsLock = signal(false);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.capsLock.set(false);
    this.onTouched();
  }

  protected toggle(): void {
    this.visible.update((v) => !v);
    this.focus();
  }

  protected checkCapsLock(event: KeyboardEvent): void {
    if (typeof event.getModifierState === 'function') {
      this.capsLock.set(event.getModifierState('CapsLock'));
    }
  }

  // --- ControlValueAccessor: legatura cu formularele Angular ---
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
