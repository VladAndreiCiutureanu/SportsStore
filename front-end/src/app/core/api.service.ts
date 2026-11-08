import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/// Valorile acceptate in query
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

/**
 * Punctul unic prin care frontend-ul vorbeste cu SportsStore.API.
 *
 * - Adresa de baza vine din environment (nu scriem URL-uri in componente).
 * - HttpClient trimite automat `Content-Type: application/json` cand body-ul este un obiect.
 * - Raspunsurile 204 No Content ajung ca `null`; nu incercam sa le citim ca JSON.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(query) });
  }

  post<T = void>(path: string, body: unknown = null): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  put<T = void>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  /** 'Product/45' -> '/api/Product/45' */
  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  //filtrare url(se elimina valorile)
  private toParams(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    if (!query) return params;

    for (const [key, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        params = params.append(key, String(value));
      }
    }
    return params;
  }
}
