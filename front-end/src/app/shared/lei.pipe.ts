import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formateaza o suma in lei, ca in magazinele romanesti: 1234.5 -> "1.234,50 lei". */
@Pipe({ name: 'lei' })
export class LeiPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : `${formatter.format(value)} lei`;
  }
}
