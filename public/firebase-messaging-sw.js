/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');
importScripts('/runtime-config.js');

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizeValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveTaskState(payload) {
  const data = payload?.data || {};

  return (
    normalizeValue(data.estadoTarea) ||
    normalizeValue(data.taskState) ||
    normalizeValue(data.taskStatus) ||
    normalizeValue(data.estado) ||
    normalizeValue(data.status) ||
    normalizeValue(data.nuevoEstado) ||
    normalizeValue(data.newStatus)
  );
}

function shouldShowNotification(payload) {
  const estado = resolveTaskState(payload);
  if (!estado) {
    return false;
  }

  const normalized = estado.toUpperCase();
  return (
    normalized === 'PENDIENTE' ||
    normalized === 'EN_PROCESO' ||
    normalized === 'COMPLETADA'
  );
}

function resolveFirebaseConfig() {
  const appConfig = self.__APP_CONFIG__ || {};

  const apiKey = normalizeValue(appConfig.firebaseApiKey);
  const authDomain = normalizeValue(appConfig.firebaseAuthDomain);
  const projectId = normalizeValue(appConfig.firebaseProjectId);
  const storageBucket = normalizeValue(appConfig.firebaseStorageBucket);
  const messagingSenderId = normalizeValue(appConfig.firebaseMessagingSenderId);
  const appId = normalizeValue(appConfig.firebaseAppId);
  const measurementId = normalizeValue(appConfig.firebaseMeasurementId);

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
    measurementId: measurementId || undefined,
  };
}

const firebaseConfig = resolveFirebaseConfig();

if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    if (!shouldShowNotification(payload)) {
      return;
    }

    const notificationTitle =
      payload?.notification?.title || payload?.data?.title || 'Nueva notificacion';
    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.body || '',
      data: payload?.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
