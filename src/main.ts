import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const globalRef = globalThis as typeof globalThis & {
  global?: typeof globalThis;
};

if (!globalRef.global) {
  globalRef.global = globalThis;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
