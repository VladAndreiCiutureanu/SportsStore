import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: parametrii din URL (ex. ?returnUrl=) ajung direct in input-urile componentelor.
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient + interceptorul care pune tokenul si trateaza 401.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
