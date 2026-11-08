# SportsStore - Frontend (Angular 21 + Bootstrap 5)

## Pornire

```powershell
npm install
npm start          # http://localhost:4200 (backend-ul trebuie sa ruleze pe http://localhost:5001)
```

`proxy.conf.json` trimite `/api` si `/images` la backend. Proxy-ul se citeste doar la pornire:
dupa ce il modifici, reporneste `npm start`.

## Comenzi

```powershell
npm start                          # server de dezvoltare cu reincarcare automata
npx ng build                       # build de productie in dist/
npx ng test --watch=false          # testele unitare (Vitest)
```

## Structura `src/app`

| Folder | Continut |
|---|---|
| `core/` | servicii si stare: `api.service` (toate cererile HTTP), `auth.*` (login, token, roluri, guard-uri, interceptor), `catalog.*`, `category.store`, `cart.*`, `wishlist.store`, `image-upload.service`, `api-error` (traducerea erorilor) |
| `shared/` | componente refolosibile: card produs, buton favorite, camp parola, dialog de confirmare, notificari, pipe `lei` |
| `pages/` | ecranele: catalog, detalii produs, cos, favorite, login, register, contul meu, `admin/` (produse, categorii, livrare) |

## Reguli importante

- Rolul (Admin/User) se citeste din tokenul JWT doar pentru afisare; serverul verifica oricum fiecare cerere.
- La editarea unui produs se trimite **mereu produsul complet** (backend-ul nu are PATCH).
- Sumele din cos (subtotal, livrare, total) vin de la server; dupa orice schimbare se reface `GET /api/Cart`.
