import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentoColaborativoService } from '../../services/documento-colaborativo.service';

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

  private editorInstance: { destroyEditor?: () => void } | null = null;
  private documentoId: string | null = null;
  private readonly onlyOfficeScriptId = 'onlyoffice-docs-api-script';

  ngOnInit(): void {
    this.documentoId = this.route.snapshot.paramMap.get('id');
    console.log('documentoId recibido por ruta:', this.documentoId);

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

        const docName = res.config?.document?.title || 'Documento';
        this.nombreDocumento.set(docName);

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
        },
      },
    };
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

  ngOnDestroy(): void {
    this.destruirEditor();
    this.limpiarRuntimeOnlyOffice();
  }
}
