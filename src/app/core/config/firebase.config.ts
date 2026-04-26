import { FirebaseOptions } from 'firebase/app';

type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function normalizeValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function resolveRuntimeConfig(): FirebaseRuntimeConfig | null {
  if (typeof window === 'undefined' || !window.__APP_CONFIG__) {
    return null;
  }

  const apiKey = normalizeValue(window.__APP_CONFIG__.firebaseApiKey);
  const authDomain = normalizeValue(window.__APP_CONFIG__.firebaseAuthDomain);
  const projectId = normalizeValue(window.__APP_CONFIG__.firebaseProjectId);
  const storageBucket = normalizeValue(window.__APP_CONFIG__.firebaseStorageBucket);
  const messagingSenderId = normalizeValue(window.__APP_CONFIG__.firebaseMessagingSenderId);
  const appId = normalizeValue(window.__APP_CONFIG__.firebaseAppId);
  const measurementId = normalizeValue(window.__APP_CONFIG__.firebaseMeasurementId) ?? undefined;

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}

export function resolveFirebaseWebConfig(): FirebaseOptions | null {
  const config = resolveRuntimeConfig();
  if (!config) {
    return null;
  }

  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  };
}

export function resolveFirebaseWebVapidKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return normalizeValue(window.__APP_CONFIG__?.firebaseVapidKey);
}
