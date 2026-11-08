import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Ruleaza la fiecare cerere HTTP:
 * 1. Daca exista token si cererea merge la API-ul nostru, adauga `Authorization: Bearer <token>`.
 * 2. Daca serverul raspunde 401, sterge sesiunea si trimite utilizatorul la Login.
 *    Exceptie: la login un 401 inseamna doar "parola gresita", deci il lasam pe formular sa-l afiseze.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isLoginRequest = req.url.endsWith('/Auth/login');

  const token = auth.token;
  const request =
    token && isApiRequest
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isLoginRequest
      ) {
        auth.handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
