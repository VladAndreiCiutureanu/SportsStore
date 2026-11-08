import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Cadrul panoului de administrare: meniu lateral + pagina curenta. Accesul e pazit de adminGuard. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="row g-4">
      <aside class="col-12 col-lg-3 col-xl-2">
        <div class="small text-uppercase text-body-secondary fw-semibold mb-2 px-lg-2">Administrare</div>
        <nav class="nav nav-pills flex-row flex-lg-column gap-1" aria-label="Sectiuni administrare">
          <a class="nav-link" routerLink="products" routerLinkActive="active">Produse</a>
          <a class="nav-link" routerLink="categories" routerLinkActive="active">Categorii</a>
          <a class="nav-link" routerLink="delivery" routerLinkActive="active">Metode de livrare</a>
          <span class="nav-link disabled" aria-disabled="true">
            Cupoane <span class="badge text-bg-light border ms-1">in curand</span>
          </span>
        </nav>
      </aside>
      <section class="col-12 col-lg-9 col-xl-10">
        <router-outlet />
      </section>
    </div>
  `,
})
export class AdminLayout {}
