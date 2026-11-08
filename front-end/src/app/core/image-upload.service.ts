import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../environments/environment';

/** Aceleasi limite ca in backend (UploadsController). */
export const IMAGE_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  accept: '.jpg,.jpeg,.png,.webp,.gif',
} as const;

export interface UploadImageResponse {
  url: string; // ex. "/images/products/3f2a....jpg" (relativ: serverul il serveste din wwwroot)
  size: number;
  contentType: string;
}

/** Ce emite upload-ul: progres (0-100) si, la final, raspunsul serverului. */
export type UploadEvent = { kind: 'progress'; percent: number } | { kind: 'done'; result: UploadImageResponse };

/**
 * Trimite imaginea la POST /api/uploads/product-image (doar Admin) ca multipart/form-data.
 * Tokenul il pune interceptorul, ca la orice cerere /api.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly http = inject(HttpClient);

  /** Verificare rapida in browser, inainte de trimitere. Serverul verifica oricum continutul real. */
  validate(file: File): string | null {
    if (!IMAGE_UPLOAD.types.includes(file.type as (typeof IMAGE_UPLOAD.types)[number])) {
      return 'Alege o imagine JPG, PNG, WEBP sau GIF.';
    }
    if (file.size > IMAGE_UPLOAD.maxBytes) {
      return `Imaginea are ${formatBytes(file.size)}. Dimensiunea maxima este ${formatBytes(IMAGE_UPLOAD.maxBytes)}.`;
    }
    if (file.size === 0) return 'Fisierul este gol.';
    return null;
  }

  uploadProductImage(file: File): Observable<UploadEvent> {
    const body = new FormData();
    body.append('file', file, file.name);

    return this.http
      .post<UploadImageResponse>(`${environment.apiUrl}/uploads/product-image`, body, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
        map((e): UploadEvent => {
          if (e.type === HttpEventType.UploadProgress) {
            return { kind: 'progress', percent: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
          }
          return { kind: 'done', result: (e as { body: UploadImageResponse }).body };
        }),
      );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
