import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Afiseaza intrebarea curenta din ConfirmService. Esc sau click in afara = anulare. */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (confirm.pending(); as q) {
      <div class="modal d-block" tabindex="-1" role="alertdialog" aria-modal="true"
           aria-labelledby="confirmTitle" aria-describedby="confirmMessage"
           (click)="confirm.answer(false)" (keydown.escape)="confirm.answer(false)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h5" id="confirmTitle">{{ q.title }}</h2>
              <button type="button" class="btn-close" aria-label="Inchide" (click)="confirm.answer(false)"></button>
            </div>
            <div class="modal-body">
              <p id="confirmMessage" class="mb-0">{{ q.message }}</p>
              @if (q.details) {
                <p class="small text-body-secondary mt-2 mb-0">{{ q.details }}</p>
              }
            </div>
            <div class="modal-footer">
              <button #cancelButton type="button" class="btn btn-outline-secondary" (click)="confirm.answer(false)">
                {{ q.cancelText ?? 'Renunta' }}
              </button>
              <button type="button" class="btn" [class.btn-danger]="q.danger" [class.btn-primary]="!q.danger"
                      (click)="confirm.answer(true)">
                {{ q.confirmText ?? 'Confirma' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    // Focus implicit pe "Renunta": un Enter apasat din greseala nu sterge nimic.
    effect(() => {
      if (this.confirm.pending()) setTimeout(() => this.cancelButton()?.nativeElement.focus());
    });
  }
}
