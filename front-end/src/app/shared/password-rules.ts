import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Regulile de parola ale backend-ului (ASP.NET Identity configurat in Program.cs + valorile implicite):
 * minim 8 caractere, o cifra, o litera mare, o litera mica si un caracter special.
 */
export interface PasswordRule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'Minim 8 caractere', test: (v) => v.length >= 8 },
  { key: 'uppercase', label: 'O litera mare (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', label: 'O litera mica (a-z)', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'O cifra (0-9)', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'Un caracter special (ex. ! . - # @)', test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

/** Validator pentru formulare: eroarea `passwordRules` contine cheile regulilor neindeplinite. */
export function passwordRulesValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null; // "required" se ocupa de campul gol
  const failed = PASSWORD_RULES.filter((r) => !r.test(value)).map((r) => r.key);
  return failed.length ? { passwordRules: failed } : null;
}

/**
 * Puterea parolei, 0-4, doar ca indicatie vizuala. O parola care respecta regulile
 * backend-ului e "acceptabila"; lungimea si varietatea o fac mai puternica.
 */
export function passwordStrength(value: string): number {
  if (!value) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
  if (passed < PASSWORD_RULES.length) return passed <= 2 ? 1 : 2;
  let score = 3;
  if (value.length >= 12 && new Set(value).size >= 8) score = 4;
  return score;
}
