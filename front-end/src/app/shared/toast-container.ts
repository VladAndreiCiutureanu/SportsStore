import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

/** Afiseaza notificarile din ToastService in coltul din dreapta-jos. */
@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="toast show align-items-center border-0"
          [class]="'text-bg-' + toast.kind"
          role="status"
        >
          <div class="d-flex">
            <div class="toast-body">{{ toast.text }}</div>
            <button
              type="button"
              class="btn-close me-2 m-auto"
              [class.btn-close-white]="toast.kind !== 'warning'"
              aria-label="Inchide"
              (click)="toasts.dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly toasts = inject(ToastService);
}
