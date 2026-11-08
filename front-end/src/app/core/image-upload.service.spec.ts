import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImageUploadService, UploadEvent, formatBytes } from './image-upload.service';

const file = (type: string, size: number, name = 'poza.jpg') =>
  new File([new Uint8Array(size)], name, { type });

describe('ImageUploadService', () => {
  let service: ImageUploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImageUploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('accepta imaginile valide si refuza alte tipuri, fisiere goale sau prea mari', () => {
    expect(service.validate(file('image/png', 1000))).toBeNull();
    expect(service.validate(file('application/pdf', 1000, 'cv.pdf'))).toContain('JPG, PNG, WEBP sau GIF');
    expect(service.validate(file('image/jpeg', 0))).toBe('Fisierul este gol.');
    expect(service.validate(file('image/jpeg', 6 * 1024 * 1024))).toContain('Dimensiunea maxima este 5,0 MB');
  });

  it('trimite multipart la /api/uploads/product-image si raporteaza progresul', () => {
    const events: UploadEvent[] = [];
    service.uploadProductImage(file('image/jpeg', 10)).subscribe((e) => events.push(e));

    const req = http.expectOne('/api/uploads/product-image');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);

    req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    req.flush({ url: '/images/products/abc.jpg', size: 10, contentType: 'image/jpeg' });

    expect(events).toEqual([
      { kind: 'progress', percent: 50 },
      { kind: 'done', result: { url: '/images/products/abc.jpg', size: 10, contentType: 'image/jpeg' } },
    ]);
  });

  it('formateaza dimensiunile', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB');
  });
});
