import { HttpErrorResponse } from '@angular/common/http';

/**
 * Transforma orice eroare venita de la API intr-un mesaj afisabil, in romana.
 *
 * Backend-ul raspunde cu erori in mai multe formate:
 *   - text simplu:            "Product not found."
 *   - { error: "..." }        (login gresit)
 *   - { message: "..." }      (409 Conflict: duplicate, resursa folosita)
 *   - { errors: ["...", ...] } (register: reguli ASP.NET Identity)
 *   - ProblemDetails de validare: { title, errors: { Camp: ["..."] } }
 * Daca nu exista mesaj, folosim un text implicit dupa codul HTTP.
 */
export function getErrorMessage(error: unknown): string {
  const messages = getErrorMessages(error);
  return messages.length ? messages.join(' ') : 'A aparut o eroare neasteptata.';
}

/** Ca getErrorMessage, dar pastreaza mesajele separat (util cand vrem sa le punem pe campuri). */
export function getErrorMessages(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return ['A aparut o eroare neasteptata.'];
  }
  // La erori de server (5xx) corpul poate fi un stack trace sau o pagina tehnica:
  // nu il aratam utilizatorului, doar un mesaj prietenos (detaliile raman in consola).
  if (error.status >= 500 && !isFriendlyServerBody(error.error)) {
    console.error('Eroare server', error.status, error.error);
    return [defaultMessage(error.status)];
  }
  const fromBody = readBody(error.error).map(translate);
  return fromBody.length ? fromBody : [defaultMessage(error.status)];
}

/** Un raspuns 5xx e "prietenos" doar daca e JSON cu un mesaj scurt (ex. 503 Stripe neconfigurat). */
function isFriendlyServerBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  const text = obj['message'] ?? obj['error'] ?? obj['title'];
  return typeof text === 'string' && text.length < 300;
}

function readBody(body: unknown): string[] {
  if (!body) return [];

  if (typeof body === 'string') {
    // Unele raspunsuri text vin intre ghilimele JSON: "\"mesaj\""
    const text = body.trim().replace(/^"(.*)"$/s, '$1');
    return text ? [text] : [];
  }

  if (typeof body !== 'object') return [];
  const obj = body as Record<string, unknown>;

  if (typeof obj['error'] === 'string') return [obj['error']];
  if (typeof obj['message'] === 'string') return [obj['message']];

  const errors = obj['errors'];
  if (Array.isArray(errors)) return errors.map(String);
  if (errors && typeof errors === 'object') {
    // { Camp: ["mesaj1", "mesaj2"], ... }
    return Object.values(errors as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .map(String);
  }

  if (typeof obj['title'] === 'string') return [obj['title']];
  return [];
}

/**
 * Traduce mesajele cunoscute ale backend-ului (ASP.NET Identity si controllere).
 * Mesajele necunoscute raman asa cum au venit.
 */
const TRANSLATIONS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Invalid username\/email or password\.?$/i, () => 'Numele de utilizator/emailul sau parola sunt incorecte.'],
  [/^Username '(.*)' is already taken\.?$/i, (m) => `Numele de utilizator „${m[1]}” este deja folosit.`],
  [/^Email '(.*)' is already taken\.?$/i, (m) => `Adresa de email „${m[1]}” are deja un cont.`],
  [/^Username '(.*)' is invalid.*$/i, () => 'Numele poate contine doar litere fara diacritice, cifre si - . _ @ +'],
  [/^Email '(.*)' is invalid\.?$/i, () => 'Adresa de email nu este valida.'],
  [/^Passwords must be at least (\d+) characters\.?$/i, (m) => `Parola trebuie sa aiba cel putin ${m[1]} caractere.`],
  [/^Passwords must have at least one digit.*$/i, () => 'Parola trebuie sa contina cel putin o cifra.'],
  [/^Passwords must have at least one uppercase.*$/i, () => 'Parola trebuie sa contina cel putin o litera mare.'],
  [/^Passwords must have at least one lowercase.*$/i, () => 'Parola trebuie sa contina cel putin o litera mica.'],
  [/^Passwords must have at least one non alphanumeric.*$/i, () => 'Parola trebuie sa contina cel putin un caracter special.'],
  [/^Passwords must use at least (\d+) different characters\.?$/i, (m) => `Parola trebuie sa contina cel putin ${m[1]} caractere diferite.`],
  // Catalog (categorii, livrare, produse)
  [/^Category with name '(.*)' already exists\.?$/i, (m) => `Exista deja o categorie cu numele „${m[1]}”.`],
  [/^Cannot delete category with associated products\.?$/i, () => 'Categoria are produse. Muta sau sterge mai intai produsele din ea.'],
  [/^Delivery method with name '(.*)' already exists\.?$/i, (m) => `Exista deja o metoda de livrare cu numele „${m[1]}”.`],
  [/^Cannot delete a delivery method assigned to products\.?$/i, () => 'Metoda de livrare este folosita de produse. Scoate-o mai intai de pe produse.'],
  [/^Category with ID (\d+) does not exist\.?$/i, () => 'Categoria aleasa nu mai exista. Reincarca pagina si alege alta.'],
  [/^One or more delivery method IDs are invalid\.?$/i, () => 'Una dintre metodele de livrare alese nu mai exista. Reincarca pagina.'],
  [/^Duplicate delivery method IDs are not allowed\.?$/i, () => 'Aceeasi metoda de livrare a fost aleasa de doua ori.'],
  [/^Product not found\.?$/i, () => 'Produsul nu a fost gasit.'],
  // Filtre catalog (400)
  [/^Minimum price cannot be greater than maximum price\.?$/i, () => 'Pretul minim nu poate fi mai mare decat pretul maxim.'],
  [/^(Minimum|Maximum) price cannot be negative\.?$/i, () => 'Pretul nu poate fi negativ.'],
  [/^Minimum stock cannot be greater than maximum stock\.?$/i, () => 'Stocul minim nu poate fi mai mare decat stocul maxim.'],
  [/^(Minimum|Maximum) stock cannot be negative\.?$/i, () => 'Stocul nu poate fi negativ.'],
  // Upload imagini
  [/^No image file was provided\.?$/i, () => 'Nu a fost trimisa nicio imagine.'],
  [/^The image is too large\. Maximum size is (\d+) MB\.?$/i, (m) => `Imaginea este prea mare. Dimensiunea maxima este ${m[1]} MB.`],
  [/^Only JPG, PNG, WEBP or GIF images are allowed\.?$/i, () => 'Sunt acceptate doar imagini JPG, PNG, WEBP sau GIF.'],
  // Cos
  [/^Only (\d+) item\(s\) are currently in stock\.?$/i, (m) =>
    m[1] === '0'
      ? 'Produsul nu mai este in stoc.'
      : `Stoc insuficient: mai sunt doar ${m[1]} ${m[1] === '1' ? 'bucata' : 'bucati'} disponibile (inclusiv ce ai deja in cos).`],
  [/^Product is not in the cart\.?$/i, () => 'Produsul nu mai este in cos.'],
  [/^The selected delivery method is not available for every product in the cart\.?$/i, () => 'Metoda de livrare aleasa nu este disponibila pentru toate produsele din cos.'],
  [/^Delivery method not found\.?$/i, () => 'Metoda de livrare nu mai exista.'],
  // Favorite
  [/^Favorite product not found\.?$/i, () => 'Produsul nu mai este la favorite.'],
];

function translate(message: string): string {
  for (const [pattern, toRo] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return toRo(match);
  }
  return message;
}

function defaultMessage(status: number): string {
  switch (status) {
    case 0:
      return 'Serverul nu raspunde. Verifica daca backend-ul ruleaza.';
    case 400:
      return 'Datele trimise nu sunt valide.';
    case 401:
      return 'Trebuie sa te autentifici.';
    case 403:
      return 'Nu ai drepturi pentru aceasta operatie.';
    case 404:
      return 'Resursa nu a fost gasita.';
    case 409:
      return 'Operatia intra in conflict cu datele existente.';
    case 413:
      return 'Fisierul trimis este prea mare.';
    case 502:
    case 503:
      return 'Serviciul de plata nu este disponibil momentan.';
    default:
      return status >= 500 ? 'Eroare pe server. Incearca din nou peste putin timp.' : `Eroare (${status}).`;
  }
}
