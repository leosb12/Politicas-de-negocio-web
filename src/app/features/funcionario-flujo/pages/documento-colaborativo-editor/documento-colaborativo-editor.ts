import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  DocumentoColaborativoAuditAction,
  DocumentoVersion,
  DocumentoColaborativoService,
} from '../../services/documento-colaborativo.service';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: unknown) => { destroyEditor?: () => void };
    };
    requirejs?: {
      undef?: (moduleName: string) => void;
    };
  }
}

@Component({
  selector: 'app-documento-colaborativo-editor-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documento-colaborativo-editor.html',
  styleUrl: './documento-colaborativo-editor.css',
})
export class DocumentoColaborativoEditorPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly collabDocService = inject(DocumentoColaborativoService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly nombreDocumento = signal('Cargando...');
  readonly puedeDescargar = signal(false);
  readonly puedeImprimir = signal(false);
  readonly descargandoPdf = signal(false);
  readonly descargandoOriginal = signal(false);
  readonly imprimiendo = signal(false);
  readonly etiquetaDescargaOriginal = signal('Documento');
  readonly controlVersionesHabilitado = signal(false);
  readonly versionActual = signal(0);
  readonly versiones = signal<DocumentoVersion[]>([]);
  readonly versionesLoading = signal(false);
  readonly versionesError = signal<string | null>(null);
  readonly descargandoVersion = signal<number | null>(null);

  private editorInstance: { destroyEditor?: () => void } | null = null;
  private documentoId: string | null = null;
  private extensionOriginal = 'docx';
  private documentServerOrigin: string | null = null;
  private readonly auditCooldown = new Map<DocumentoColaborativoAuditAction, number>();
  private readonly onlyOfficeScriptId = 'onlyoffice-docs-api-script';
  private readonly onlyOfficeMessageHandler = (event: MessageEvent<unknown>) => {
    this.procesarMensajeOnlyOffice(event);
  };

  ngOnInit(): void {
    this.documentoId = this.route.snapshot.paramMap.get('id');
    console.log('documentoId recibido por ruta:', this.documentoId);
    window.addEventListener('message', this.onlyOfficeMessageHandler);

    if (!this.documentoId) {
      this.error.set('No se especifico ningun ID de documento.');
      this.loading.set(false);
      return;
    }

    this.cargarEditor();
  }

  cargarEditor(): void {
    if (!this.documentoId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.collabDocService.obtenerEditorConfig(this.documentoId).subscribe({
      next: (res) => {
        console.log('respuesta editor-config:', res);
        console.log('documentServerUrl:', res.documentServerUrl);
        this.documentServerOrigin = this.obtenerOrigin(res.documentServerUrl);

        const docName = res.config?.document?.title || 'Documento';
        this.nombreDocumento.set(docName);
        this.puedeDescargar.set(res.config?.document?.permissions?.download === true);
        this.puedeImprimir.set(res.config?.document?.permissions?.print === true);
        this.extensionOriginal = this.normalizarExtensionOriginal(res.config?.document?.fileType);
        this.etiquetaDescargaOriginal.set(this.etiquetaPorExtension(this.extensionOriginal));
        this.controlVersionesHabilitado.set(res.controlVersionesHabilitado === true);
        this.versionActual.set(typeof res.versionActual === 'number' ? res.versionActual : 0);
        if (res.controlVersionesHabilitado === true) {
          this.cargarVersiones();
        } else {
          this.versiones.set([]);
          this.versionesError.set(null);
        }

        const apiScriptUrl = `${res.documentServerUrl}/web-apps/apps/api/documents/api.js`;
        this.cargarScriptOnlyOffice(apiScriptUrl)
          .then(() => this.inicializarEditor(res.config))
          .catch((err) => {
            console.error('error carga script:', err);
            this.error.set('No se pudo conectar con OnlyOffice Document Server.');
            this.loading.set(false);
          });
      },
      error: (err) => {
        console.error('Error al obtener configuracion del editor:', err);
        const detail = err.error?.message || 'No tiene permisos o el documento no esta disponible.';
        this.error.set(detail);
        this.loading.set(false);
      },
    });
  }

  private cargarScriptOnlyOffice(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.limpiarRuntimeOnlyOffice();

      const script = document.createElement('script');
      script.id = this.onlyOfficeScriptId;
      script.src = url;
      script.type = 'text/javascript';
      script.onload = () => resolve();
      script.onerror = (event) => reject(event);
      document.head.appendChild(script);
    });
  }

  private inicializarEditor(config: unknown): void {
    this.destruirEditor();

    window.setTimeout(() => {
      if (!window.DocsAPI) {
        this.error.set('La API de OnlyOffice no esta disponible.');
        this.loading.set(false);
        return;
      }

      try {
        const editorConfig = this.prepararConfigEditor(config);
        this.editorInstance = new window.DocsAPI.DocEditor('onlyoffice-editor', editorConfig);
        console.log('editor inicializado');
      } catch (err) {
        console.error('Error al inicializar DocEditor:', err);
        this.error.set('No se pudo inicializar la interfaz del editor.');
        this.loading.set(false);
      }
    }, 100);
  }

  private prepararConfigEditor(config: unknown): Record<string, unknown> {
    const baseConfig = this.esObjetoPlano(config) ? { ...config } : {};
    const currentEvents = this.esObjetoPlano(baseConfig['events']) ? baseConfig['events'] : {};

    return {
      ...baseConfig,
      width: '100%',
      height: '100%',
      events: {
        ...currentEvents,
        onAppReady: () => {
          console.log('OnlyOffice app lista');
          this.loading.set(false);
        },
        onDocumentReady: () => {
          console.log('OnlyOffice documento listo');
          this.loading.set(false);
        },
        onError: (event: unknown) => {
          console.error('OnlyOffice reporto error:', event);
          this.loading.set(false);
          this.invocarEventoOnlyOffice(currentEvents, 'onError', event);
        },
        onDownloadAs: (event: unknown) => {
          this.auditarAccionDocumento('DESCARGAR', 'Documento descargado desde OnlyOffice');
          this.invocarEventoOnlyOffice(currentEvents, 'onDownloadAs', event);
        },
        onRequestSaveAs: (event: unknown) => {
          this.auditarAccionDocumento('DESCARGAR', 'Documento descargado como copia desde OnlyOffice');
          this.invocarEventoOnlyOffice(currentEvents, 'onRequestSaveAs', event);
          this.descargarDesdeEventoOnlyOffice(event);
        },
        onRequestPrint: (event: unknown) => {
          this.auditarAccionDocumento('IMPRIMIR', 'Documento enviado a impresion desde OnlyOffice');
          this.invocarEventoOnlyOffice(currentEvents, 'onRequestPrint', event);
        },
      },
    };
  }

  private procesarMensajeOnlyOffice(event: MessageEvent<unknown>): void {
    if (this.documentServerOrigin && event.origin !== this.documentServerOrigin) {
      return;
    }

    const texto = this.serializarMensajeOnlyOffice(event.data);
    if (!texto) {
      return;
    }

    const normalizado = texto.toLowerCase();
    if (this.esMensajeDescargaOnlyOffice(normalizado)) {
      this.auditarAccionDocumento('DESCARGAR', 'Documento descargado desde menu nativo de OnlyOffice');
      return;
    }

    if (this.esMensajeImpresionOnlyOffice(normalizado)) {
      this.auditarAccionDocumento('IMPRIMIR', 'Documento enviado a impresion desde menu nativo de OnlyOffice');
    }
  }

  private auditarAccionDocumento(
    accion: DocumentoColaborativoAuditAction,
    detalle: string
  ): void {
    if (!this.documentoId) {
      return;
    }

    if (!this.puedeAuditarAccion(accion)) {
      return;
    }

    this.collabDocService.registrarEventoEditor(this.documentoId, accion, detalle).subscribe({
      error: (err) => console.warn(`No se pudo auditar accion ${accion}:`, err),
    });
  }

  private puedeAuditarAccion(accion: DocumentoColaborativoAuditAction): boolean {
    const now = Date.now();
    const last = this.auditCooldown.get(accion) ?? 0;
    if (now - last < 1800) {
      return false;
    }
    this.auditCooldown.set(accion, now);
    return true;
  }

  private invocarEventoOnlyOffice(
    events: Record<string, unknown>,
    eventName: string,
    event: unknown
  ): void {
    const handler = events[eventName];
    if (typeof handler !== 'function') {
      return;
    }

    try {
      handler(event);
    } catch (err) {
      console.warn(`Error ejecutando handler OnlyOffice ${eventName}:`, err);
    }
  }

  private descargarDesdeEventoOnlyOffice(event: unknown): void {
    const data = this.esObjetoPlano(event) && this.esObjetoPlano(event['data'])
      ? event['data']
      : null;
    const url = typeof data?.['url'] === 'string' ? data['url'] : null;
    if (!url) {
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private esMensajeDescargaOnlyOffice(value: string): boolean {
    return (
      value.includes('downloadas') ||
      value.includes('download as') ||
      value.includes('download_as') ||
      value.includes('"download"') ||
      value.includes("'download'") ||
      value.includes('savecopy') ||
      value.includes('save copy') ||
      value.includes('saveas') ||
      value.includes('save as')
    );
  }

  private esMensajeImpresionOnlyOffice(value: string): boolean {
    return (
      value.includes('requestprint') ||
      value.includes('print') ||
      value.includes('imprimir')
    );
  }

  private serializarMensajeOnlyOffice(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return null;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private obtenerOrigin(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  private esObjetoPlano(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private destruirEditor(): void {
    if (!this.editorInstance) {
      return;
    }

    try {
      this.editorInstance.destroyEditor?.();
    } catch (err) {
      console.warn('Error al destruir instancia del editor:', err);
    }
    this.editorInstance = null;
  }

  private limpiarRuntimeOnlyOffice(): void {
    const previousScript = document.getElementById(this.onlyOfficeScriptId);
    previousScript?.parentNode?.removeChild(previousScript);

    try {
      window.requirejs?.undef?.('allfonts');
      window.requirejs?.undef?.('sdkjs/common/AllFonts');
    } catch (err) {
      console.warn('No se pudo limpiar cache requirejs de OnlyOffice:', err);
    }

    try {
      delete window.DocsAPI;
    } catch {
      window.DocsAPI = undefined;
    }
  }

  volver(): void {
    this.location.back();
  }

  descargarPdfAuditado(): void {
    if (!this.documentoId || !this.puedeDescargar() || this.descargandoPdf()) {
      return;
    }

    this.descargandoPdf.set(true);
    this.collabDocService.descargarAuditado(this.documentoId, 'pdf').subscribe({
      next: (blob) => {
        this.guardarBlob(blob, this.nombreDocumento().replace(/\.[^.]+$/, '') + '.pdf');
        this.descargandoPdf.set(false);
      },
      error: (err) => {
        console.error('No se pudo descargar PDF auditado:', err);
        this.error.set(err?.error?.message ?? 'No se pudo descargar el documento en PDF.');
        this.descargandoPdf.set(false);
      },
    });
  }

  descargarOriginalAuditado(): void {
    if (!this.documentoId || !this.puedeDescargar() || this.descargandoOriginal()) {
      return;
    }

    this.descargandoOriginal.set(true);
    this.collabDocService.descargarAuditado(this.documentoId, 'original').subscribe({
      next: (blob) => {
        this.guardarBlob(
          blob,
          this.nombreDocumento().replace(/\.[^.]+$/, '') + '.' + this.extensionOriginal
        );
        this.descargandoOriginal.set(false);
      },
      error: (err) => {
        console.error('No se pudo descargar documento auditado:', err);
        this.error.set(err?.error?.message ?? 'No se pudo descargar el documento.');
        this.descargandoOriginal.set(false);
      },
    });
  }

  cargarVersiones(): void {
    if (!this.documentoId || !this.controlVersionesHabilitado()) {
      return;
    }

    this.versionesLoading.set(true);
    this.versionesError.set(null);
    this.collabDocService.listarVersiones(this.documentoId).subscribe({
      next: (versiones) => {
        this.versiones.set([...(versiones ?? [])].sort((a, b) => b.numeroVersion - a.numeroVersion));
        this.versionesLoading.set(false);
      },
      error: (err) => {
        console.error('No se pudo cargar historial de versiones:', err);
        this.versionesError.set(err?.error?.message ?? 'No se pudo cargar el historial de versiones.');
        this.versionesLoading.set(false);
      },
    });
  }

  descargarVersionAuditada(version: DocumentoVersion): void {
    if (!this.documentoId || !this.puedeDescargar() || this.descargandoVersion()) {
      return;
    }

    this.descargandoVersion.set(version.numeroVersion);
    this.collabDocService.descargarVersion(this.documentoId, version.numeroVersion).subscribe({
      next: (blob) => {
        this.guardarBlob(blob, version.nombreArchivo || `version-${version.numeroVersion}.${this.extensionOriginal}`);
        this.descargandoVersion.set(null);
      },
      error: (err) => {
        console.error('No se pudo descargar version:', err);
        this.error.set(err?.error?.message ?? 'No se pudo descargar la version seleccionada.');
        this.descargandoVersion.set(null);
      },
    });
  }

  etiquetaAccionVersion(accion: string | null | undefined): string {
    const value = (accion ?? '').toUpperCase();
    if (value === 'CREACION') {
      return 'Creacion';
    }
    if (value === 'RESTAURACION') {
      return 'Restauracion';
    }
    if (value === 'REEMPLAZO') {
      return 'Reemplazo';
    }
    return 'Guardado';
  }

  imprimirAuditado(): void {
    if (!this.documentoId || !this.puedeImprimir() || this.imprimiendo()) {
      return;
    }

    this.imprimiendo.set(true);
    this.collabDocService
      .registrarEventoEditor(this.documentoId, 'IMPRIMIR', 'Documento enviado a impresion desde boton auditado')
      .subscribe({
        next: () => {
          this.imprimiendo.set(false);
          window.print();
        },
        error: (err) => {
          console.error('No se pudo auditar impresion:', err);
          this.error.set(err?.error?.message ?? 'No se pudo registrar la impresion del documento.');
          this.imprimiendo.set(false);
        },
      });
  }

  private guardarBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'documento.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private normalizarExtensionOriginal(fileType: unknown): string {
    const value = typeof fileType === 'string' ? fileType.toLowerCase() : '';
    if (value === 'xlsx' || value === 'xls') {
      return 'xlsx';
    }
    if (value === 'pptx' || value === 'ppt') {
      return 'pptx';
    }
    return 'docx';
  }

  private etiquetaPorExtension(extension: string): string {
    if (extension === 'xlsx') {
      return 'Excel';
    }
    if (extension === 'pptx') {
      return 'PowerPoint';
    }
    return 'Word';
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onlyOfficeMessageHandler);
    this.destruirEditor();
    this.limpiarRuntimeOnlyOffice();
  }
}
