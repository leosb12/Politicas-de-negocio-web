import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import {
  VoiceRecognitionAvailability,
  VoiceRecognitionEvent,
} from '../models/formulario-inteligente.model';

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult:
    | ((event: BrowserSpeechRecognitionResultEvent) => void)
    | null;
  onerror:
    | ((event: BrowserSpeechRecognitionErrorEvent) => void)
    | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  item(index: number): BrowserSpeechRecognitionAlternative;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResultLike>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechWindow extends Window {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

@Injectable({
  providedIn: 'root',
})
export class FormularioInteligenteVoiceService {
  private readonly platformId = inject(PLATFORM_ID);
  private activeRecognition: BrowserSpeechRecognition | null = null;

  getAvailability(): VoiceRecognitionAvailability {
    return this.getRecognitionConstructor() ? 'supported' : 'unsupported';
  }

  startListening(language = 'es-ES'): Observable<VoiceRecognitionEvent> {
    return new Observable<VoiceRecognitionEvent>((subscriber) => {
      const Recognition = this.getRecognitionConstructor();

      if (!Recognition) {
        subscriber.next({
          type: 'error',
          error: {
            code: 'unsupported',
            message: 'Tu navegador no soporta reconocimiento de voz.',
          },
        });
        subscriber.complete();
        return undefined;
      }

      if (this.activeRecognition) {
        this.stopListening();
      }

      const recognition = new Recognition();
      this.activeRecognition = recognition;
      recognition.lang = language;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        subscriber.next({ type: 'start' });
      };

      recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alternative = result[0] ?? result.item(0);
          transcript += alternative?.transcript ?? '';
          isFinal = isFinal || result.isFinal;
        }

        subscriber.next({
          type: 'result',
          transcript: transcript.trim(),
          isFinal,
        });
      };

      recognition.onerror = (event) => {
        subscriber.next({
          type: 'error',
          error: {
            code: event.error,
            message: this.mapErrorMessage(event.error),
          },
        });
      };

      recognition.onend = () => {
        if (this.activeRecognition === recognition) {
          this.activeRecognition = null;
        }

        subscriber.next({ type: 'end' });
        subscriber.complete();
      };

      recognition.start();

      return () => {
        if (this.activeRecognition === recognition) {
          this.clearHandlers(recognition);
          try {
            recognition.stop();
          } catch {
            recognition.abort();
          }
          this.activeRecognition = null;
        }
      };
    });
  }

  stopListening(): void {
    if (!this.activeRecognition) {
      return;
    }

    const recognition = this.activeRecognition;
    this.activeRecognition = null;

    try {
      recognition.stop();
    } catch {
      recognition.abort();
    }
  }

  private getRecognitionConstructor():
    | BrowserSpeechRecognitionConstructor
    | null {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return null;
    }

    const browserWindow = window as BrowserSpeechWindow;
    return (
      browserWindow.SpeechRecognition ??
      browserWindow.webkitSpeechRecognition ??
      null
    );
  }

  private clearHandlers(recognition: BrowserSpeechRecognition): void {
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  }

  private mapErrorMessage(errorCode: string): string {
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
      return 'No se concedio permiso para usar el microfono.';
    }

    if (errorCode === 'audio-capture') {
      return 'No se detecto un microfono disponible.';
    }

    if (errorCode === 'network') {
      return 'Se perdio la conexion mientras se procesaba la voz.';
    }

    if (errorCode === 'no-speech') {
      return 'No se detecto voz. Intenta nuevamente.';
    }

    if (errorCode === 'aborted') {
      return 'La grabacion se detuvo antes de completarse.';
    }

    return 'No fue posible transcribir la voz en este momento.';
  }
}
