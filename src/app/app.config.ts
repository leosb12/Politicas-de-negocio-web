import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { adminUserHeaderInterceptor } from './core/interceptors/admin-user-header.interceptor';
import { adminAuthErrorInterceptor } from './core/interceptors/admin-auth-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([adminUserHeaderInterceptor, adminAuthErrorInterceptor])
    ),
  ]
};