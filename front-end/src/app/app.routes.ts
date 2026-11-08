import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guards';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { AdminLayout } from './pages/admin/admin-layout';
import { AdminCategories } from './pages/admin/categories/admin-categories';
import { AdminDelivery } from './pages/admin/delivery/admin-delivery';
import { AdminProducts } from './pages/admin/products/admin-products';
import { ProductForm } from './pages/admin/products/product-form';
import { Cart } from './pages/cart/cart';
import { Catalog } from './pages/catalog/catalog';
import { Login } from './pages/login/login';
import { ProductDetail } from './pages/product-detail/product-detail';
import { Profile } from './pages/profile/profile';
import { Register } from './pages/register/register';
import { Wishlist } from './pages/wishlist/wishlist';

// `data.auth` marcheaza paginile care cer autentificare; AuthService il foloseste
// ca sa te scoata de pe ele cand te deloghezi din alt tab.
export const routes: Routes = [
  // Magazinul (public): catalogul e pagina de start; filtrele stau in query string (?category=2&q=...).
  { path: '', component: Catalog, title: 'SportsStore - Articole sportive' },
  { path: 'products/:id', component: ProductDetail, title: 'Produs - SportsStore' },
  { path: 'login', component: Login, canActivate: [guestGuard], title: 'Autentificare - SportsStore' },
  { path: 'register', component: Register, canActivate: [guestGuard], title: 'Creeaza cont - SportsStore' },
  {
    path: 'cart',
    component: Cart,
    canActivate: [authGuard],
    data: { auth: 'user' },
    title: 'Cosul meu - SportsStore',
  },
  {
    path: 'wishlist',
    component: Wishlist,
    canActivate: [authGuard],
    data: { auth: 'user' },
    title: 'Favorite - SportsStore',
  },
  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard],
    data: { auth: 'user' },
    title: 'Contul meu - SportsStore',
  },
  {
    // Panoul de administrare: adminGuard pazeste toate paginile de mai jos.
    path: 'admin',
    component: AdminLayout,
    canActivate: [adminGuard],
    data: { auth: 'admin' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'products' },
      { path: 'products', component: AdminProducts, title: 'Produse - Administrare' },
      {
        path: 'products/new',
        component: ProductForm,
        canDeactivate: [unsavedChangesGuard],
        title: 'Produs nou - Administrare',
      },
      {
        path: 'products/:id/edit',
        component: ProductForm,
        canDeactivate: [unsavedChangesGuard],
        title: 'Editare produs - Administrare',
      },
      { path: 'categories', component: AdminCategories, title: 'Categorii - Administrare' },
      { path: 'delivery', component: AdminDelivery, title: 'Metode de livrare - Administrare' },
    ],
  },
  { path: '**', redirectTo: '' },
];
