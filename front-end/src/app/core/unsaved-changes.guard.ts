import { CanDeactivateFn } from '@angular/router';

/** O pagina cu formular care poate refuza plecarea (ex. modificari nesalvate). */
export interface LeaveConfirmable {
  canLeave(): boolean | Promise<boolean>;
}

/** Intreaba "Renunti la modificari?" inainte sa parasesti un formular nesalvat. */
export const unsavedChangesGuard: CanDeactivateFn<LeaveConfirmable> = (component) => component.canLeave();
