import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class VozIaService {
  private readonly STORAGE_KEY = 'iaVoiceEnabled';

  readonly isSupported = signal(false);
  readonly isEnabled = signal(false);

  private synthesis: SpeechSynthesis | null = null;

  constructor() {
    this.checkSupport();
    this.loadPreference();

    // Persist preference when changed and stop if disabled
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, String(this.isEnabled()));
      }

      if (!this.isEnabled()) {
        this.stop();
      }
    });
  }

  toggle(): void {
    if (!this.isSupported()) return;
    this.isEnabled.update((val) => !val);
  }

  read(text: string): void {
    if (!this.isSupported() || !this.isEnabled() || !this.synthesis || !text) {
      return;
    }

    // Cancel previous reading if any
    this.stop();

    const cleanText = this.cleanMarkdown(text);
    if (!cleanText.trim()) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-419'; // Prefer Latin American Spanish
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to explicitly set a Spanish voice if available
    const voices = this.synthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang === 'es-419' || v.lang === 'es-MX' || v.lang === 'es-AR') ||
      voices.find((v) => v.lang.startsWith('es'));
      
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    } else {
       // fallback to general es-ES if strictly needed or just leave default
       utterance.lang = 'es-ES';
    }

    this.synthesis.speak(utterance);
  }

  stop(): void {
    if (this.isSupported() && this.synthesis) {
      this.synthesis.cancel();
    }
  }

  private checkSupport(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.isSupported.set(true);

      // Safari/Chrome need to pre-load voices
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.synthesis?.getVoices();
      }
    }
  }

  private loadPreference(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        this.isEnabled.set(stored === 'true');
      }
    }
  }

  private cleanMarkdown(text: string): string {
    return text
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/#/g, '') // Remove headings
      .replace(/`/g, '') // Remove code ticks
      .replace(/-/g, '') // Remove list dashes
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Extract text from links
      .replace(/\n+/g, '. ') // Replace newlines with dots for better pauses
      .trim();
  }
}
