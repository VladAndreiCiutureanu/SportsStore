import { ConfirmService } from './confirm.service';
import { LeiPipe } from './lei.pipe';

describe('LeiPipe', () => {
  const pipe = new LeiPipe();
  it('formateaza sumele romaneste, cu 2 zecimale', () => {
    // Intl foloseste spatiu ingust sau punct ca separator de mii, in functie de platforma.
    expect(pipe.transform(1234.5)).toMatch(/^1[.\s  ]?234,50 lei$/);
    expect(pipe.transform(8.5)).toBe('8,50 lei');
    expect(pipe.transform(0)).toBe('0,00 lei');
    expect(pipe.transform(null)).toBe('');
  });
});

describe('ConfirmService', () => {
  it('rezolva cu raspunsul utilizatorului', async () => {
    const service = new ConfirmService();
    const answer = service.ask({ title: 'T', message: 'M' });
    expect(service.pending()?.title).toBe('T');
    service.answer(true);
    await expect(answer).resolves.toBe(true);
    expect(service.pending()).toBeNull();
  });

  it('o intrebare noua o anuleaza pe cea veche', async () => {
    const service = new ConfirmService();
    const first = service.ask({ title: '1', message: '' });
    service.ask({ title: '2', message: '' });
    await expect(first).resolves.toBe(false);
  });
});
