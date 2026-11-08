// Configuratia pentru build-ul de productie (ng build).
// Presupune ca frontend-ul si API-ul sunt servite de pe acelasi domeniu.
// Daca API-ul ajunge pe alt domeniu, pune aici adresa completa, de ex. 'https://api.exemplu.ro/api'.
export const environment = {
  production: true,
  apiUrl: '/api',
};
