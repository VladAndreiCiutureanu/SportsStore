// Configuratia pentru dezvoltare (ng serve).
// '/api' este relativ: cererile pleaca spre localhost:4200/api, iar proxy-ul din
// proxy.conf.json le trimite mai departe la backend (http://localhost:5001).
// Asa browserul vede o singura origine si nu apare problema de CORS.
export const environment = {
  production: false,
  apiUrl: '/api',
};
