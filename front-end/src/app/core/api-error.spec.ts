import { HttpErrorResponse } from '@angular/common/http';
import { getErrorMessage, getErrorMessages } from './api-error';

const err = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('getErrorMessage', () => {
  it('traduce login gresit', () => {
    expect(getErrorMessage(err(401, { error: 'Invalid username/email or password.' }))).toBe(
      'Numele de utilizator/emailul sau parola sunt incorecte.',
    );
  });

  it('pastreaza separat si traduce erorile Identity de la register', () => {
    const messages = getErrorMessages(
      err(400, { errors: ["Username 'ana' is already taken.", "Email 'a@b.ro' is already taken."] }),
    );
    expect(messages).toEqual([
      'Numele de utilizator „ana” este deja folosit.',
      'Adresa de email „a@b.ro” are deja un cont.',
    ]);
  });

  it('citeste text simplu si {message}; textele necunoscute raman neschimbate', () => {
    expect(getErrorMessage(err(404, 'Product not found.'))).toBe('Produsul nu a fost gasit.');
    expect(getErrorMessage(err(400, 'Ceva necunoscut.'))).toBe('Ceva necunoscut.');
    expect(getErrorMessage(err(409, { message: 'Duplicat' }))).toBe('Duplicat');
  });

  it('traduce conflictele din catalog (409)', () => {
    expect(getErrorMessage(err(409, { message: 'Cannot delete category with associated products.' }))).toContain(
      'Categoria are produse',
    );
    expect(getErrorMessage(err(409, { message: "Category with name 'Alergare' already exists." }))).toBe(
      'Exista deja o categorie cu numele „Alergare”.',
    );
  });

  it('nu arata stack trace-uri la erori 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const trace = 'System.ArgumentException: 0.00 is not a valid value for Decimal.\n   at System.Number...';
    expect(getErrorMessage(err(500, trace))).toBe('Eroare pe server. Incearca din nou peste putin timp.');
  });

  it('foloseste un mesaj implicit dupa cod cand nu exista body', () => {
    expect(getErrorMessage(err(0, null))).toContain('Serverul nu raspunde');
    expect(getErrorMessage(err(403, null))).toBe('Nu ai drepturi pentru aceasta operatie.');
  });
});
