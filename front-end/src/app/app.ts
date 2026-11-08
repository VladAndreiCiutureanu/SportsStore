import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { CartStore } from './core/cart.store';
import { WishlistStore } from './core/wishlist.store';
import { initialsOf } from './pages/profile/profile';
import { ConfirmDialog } from './shared/confirm-dialog';
import { SessionExpiry } from './shared/session-expiry';
import { ToastContainer } from './shared/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SessionExpiry, ToastContainer, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  /** Injectat aici ca sa se incarce favoritele imediat dupa login (si numarul din navbar). */
  protected readonly wishlist = inject(WishlistStore);
  /** La fel pentru cos: se incarca la login, iar bulina arata numarul de bucati. */
  protected readonly cart = inject(CartStore);
  protected readonly initials = computed(() => initialsOf(this.auth.username()));
}
