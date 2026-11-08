import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ReauthPrompt } from '../../shared/session-expiry';

/** Pagina "Contul meu": datele din sesiune, timpul ramas si iesirea din cont. */
@Component({
  selector: 'app-profile',
  imports: [DatePipe],
  templateUrl: './profile.html',
})
export class Profile {
  protected readonly auth = inject(AuthService);
  protected readonly reauth = inject(ReauthPrompt);

  protected readonly initials = computed(() => initialsOf(this.auth.username()));
  protected readonly timeLeft = computed(() => {
    const s = this.auth.secondsLeft();
    const m = Math.floor(s / 60);
    return m >= 1 ? `${m} min` : `${s} s`;
  });
}

export function initialsOf(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(/[\s._\-@+]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
