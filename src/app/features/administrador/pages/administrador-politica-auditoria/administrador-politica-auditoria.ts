import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuditoriaDocumentalPoliticaResponse,
  DocumentAuditEventResponse,
  DocumentoAuditoriaResponse,
  DocumentoVersionResponse,
  PoliticaService,
  TareaDocumentoAuditoriaResponse,
} from '../../services/politica.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type AuditoriaTab = 'general' | 'documental';

@Component({
  selector: 'app-administrador-politica-auditoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './administrador-politica-auditoria.html',
  styleUrl: './administrador-politica-auditoria.css',
})
export class AdministradorPoliticaAuditoriaPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly politicaService = inject(PoliticaService);

  readonly politicaId = this.route.snapshot.paramMap.get('id');
  readonly activeTab = signal<AuditoriaTab>('general');
  readonly documentalLoading = signal(false);
  readonly documentalError = signal<string | null>(null);
  readonly auditoriaDocumental = signal<AuditoriaDocumentalPoliticaResponse | null>(null);
  readonly selectedAuditDocument = signal<DocumentoAuditoriaResponse | null>(null);
  readonly selectedAuditTask = signal<TareaDocumentoAuditoriaResponse | null>(null);
  readonly documentAuditEvents = signal<DocumentAuditEventResponse[]>([]);
  readonly documentAuditLoading = signal(false);
  readonly documentAuditError = signal<string | null>(null);
  readonly selectedVersionsDocument = signal<DocumentoAuditoriaResponse | null>(null);
  readonly selectedVersionsTask = signal<TareaDocumentoAuditoriaResponse | null>(null);
  readonly documentVersions = signal<DocumentoVersionResponse[]>([]);
  readonly documentVersionsLoading = signal(false);
  readonly documentVersionsError = signal<string | null>(null);
  readonly openingVersion = signal<number | null>(null);

  abrirDocumentoColaborativo(id: string | null | undefined): void {
    if (id) {
      this.router.navigate(['/admin/documentos-colaborativos', id, 'editar']);
    }
  }

  setActiveTab(tab: AuditoriaTab): void {
    this.activeTab.set(tab);
    if (tab === 'documental') {
      this.loadAuditoriaDocumental();
    }
  }

  loadAuditoriaDocumental(force = false): void {
    const id = this.politicaId;
    if (!id) {
      this.documentalError.set('No se encontro la politica para consultar la auditoria documental.');
      return;
    }

    if (!force && this.auditoriaDocumental()) {
      return;
    }

    this.documentalLoading.set(true);
    this.documentalError.set(null);

    this.politicaService.getAuditoriaDocumental(id).subscribe({
      next: (response) => {
        this.auditoriaDocumental.set(response);
        this.documentalLoading.set(false);
      },
      error: (error: unknown) => {
        this.documentalError.set(
          getApiErrorMessage(error, 'No se pudo cargar la auditoria documental')
        );
        this.documentalLoading.set(false);
      },
    });
  }

  refreshAuditoriaDocumental(): void {
    this.loadAuditoriaDocumental(true);
  }

  formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) {
      return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getDocumentoTipoLabel(documento: DocumentoAuditoriaResponse): string {
    return documento.tipoOrigen === 'DOCUMENTO_COLABORATIVO'
      ? 'Colaborativo'
      : 'Adjunto';
  }

  getDocumentoTipoClass(documento: DocumentoAuditoriaResponse): string {
    return documento.tipoOrigen === 'DOCUMENTO_COLABORATIVO'
      ? 'documento-type--collab'
      : 'documento-type--file';
  }

  openDocumentAuditModal(
    documento: DocumentoAuditoriaResponse,
    tarea: TareaDocumentoAuditoriaResponse
  ): void {
    this.selectedAuditDocument.set(documento);
    this.selectedAuditTask.set(tarea);
    this.documentAuditEvents.set([]);
    this.documentAuditError.set(null);
    this.documentAuditLoading.set(true);

    forkJoin({
      byDocument: this.politicaService.getDocumentAuditEvents(documento.id).pipe(catchError(() => of([]))),
      byTramite: this.politicaService.getTramiteDocumentAuditEvents(tarea.instanciaId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ byDocument, byTramite }) => {
        const events = this.mergeAuditEvents([...byDocument, ...byTramite], documento, tarea);
        this.documentAuditEvents.set(events);
        this.documentAuditLoading.set(false);
      },
      error: (error: unknown) => {
        this.documentAuditError.set(
          getApiErrorMessage(error, 'No se pudo cargar la auditoria del documento')
        );
        this.documentAuditLoading.set(false);
      },
    });
  }

  closeDocumentAuditModal(): void {
    this.selectedAuditDocument.set(null);
    this.selectedAuditTask.set(null);
    this.documentAuditEvents.set([]);
    this.documentAuditError.set(null);
    this.documentAuditLoading.set(false);
  }

  openDocumentVersionsModal(
    documento: DocumentoAuditoriaResponse,
    tarea: TareaDocumentoAuditoriaResponse
  ): void {
    const politicaId = this.politicaId;
    if (!politicaId) {
      this.documentVersionsError.set('No se encontro la politica para consultar versiones.');
      return;
    }

    this.selectedVersionsDocument.set(documento);
    this.selectedVersionsTask.set(tarea);
    this.documentVersions.set([]);
    this.documentVersionsError.set(null);
    this.documentVersionsLoading.set(true);

    this.politicaService.getDocumentoVersionesAuditoria(politicaId, documento.id).subscribe({
      next: (versions) => {
        this.documentVersions.set(
          [...(versions ?? [])].sort((a, b) => (b.numeroVersion ?? 0) - (a.numeroVersion ?? 0))
        );
        this.documentVersionsLoading.set(false);
      },
      error: (error: unknown) => {
        this.documentVersionsError.set(
          getApiErrorMessage(error, 'No se pudo cargar el historial de versiones')
        );
        this.documentVersionsLoading.set(false);
      },
    });
  }

  closeDocumentVersionsModal(): void {
    this.selectedVersionsDocument.set(null);
    this.selectedVersionsTask.set(null);
    this.documentVersions.set([]);
    this.documentVersionsError.set(null);
    this.documentVersionsLoading.set(false);
    this.openingVersion.set(null);
  }

  openVersion(version: DocumentoVersionResponse): void {
    const documento = this.selectedVersionsDocument();
    if (!documento || !version.numeroVersion || this.openingVersion()) {
      return;
    }

    this.openingVersion.set(version.numeroVersion);
    this.documentVersionsError.set(null);
    this.politicaService.descargarVersionDocumento(documento.id, version.numeroVersion).subscribe({
      next: (blob) => {
        this.openBlob(blob);
        this.openingVersion.set(null);
      },
      error: (error: unknown) => {
        this.documentVersionsError.set(
          getApiErrorMessage(error, 'No tiene permisos para abrir esta version')
        );
        this.openingVersion.set(null);
      },
    });
  }

  versionActionLabel(action: string | null | undefined): string {
    const map: Record<string, string> = {
      GUARDADO_ONLYOFFICE: 'Guardado en OnlyOffice',
      GUARDADO: 'Guardado',
      CREACION: 'Creacion',
      REEMPLAZO: 'Reemplazo',
      RESTAURACION: 'Restauracion',
    };
    return map[action ?? ''] ?? (action ?? 'Version');
  }

  actionLabel(action: string | null | undefined): string {
    const map: Record<string, string> = {
      VISUALIZAR: 'Vio el documento',
      DESCARGAR: 'Descargo el documento',
      SUBIR: 'Subio el documento',
      EDITAR: 'Edito el documento',
      REEMPLAZAR: 'Reemplazo el documento',
      ELIMINAR: 'Elimino el documento',
      CAMBIAR_PERMISOS: 'Modifico permisos',
      INICIAR_COLABORACION: 'Inicio colaboracion',
      SALIR_COLABORACION: 'Salio de colaboracion',
      IMPRIMIR: 'Imprimio el documento',
    };
    return map[action ?? ''] ?? (action ?? 'Evento');
  }

  actionClass(action: string | null | undefined): string {
    const normalized = action ?? '';
    if (normalized === 'ELIMINAR') return 'audit-action--danger';
    if (normalized === 'CAMBIAR_PERMISOS') return 'audit-action--permission';
    if (normalized === 'VISUALIZAR') return 'audit-action--view';
    if (normalized === 'DESCARGAR') return 'audit-action--download';
    if (normalized === 'IMPRIMIR') return 'audit-action--print';
    if (normalized === 'EDITAR' || normalized === 'REEMPLAZAR' || normalized === 'SUBIR') return 'audit-action--edit';
    return 'audit-action--neutral';
  }

  actorLabel(event: DocumentAuditEventResponse): string {
    return event.usuarioNombre || event.usuarioId || 'Usuario no identificado';
  }

  private mergeAuditEvents(
    events: DocumentAuditEventResponse[],
    documento: DocumentoAuditoriaResponse,
    tarea: TareaDocumentoAuditoriaResponse
  ): DocumentAuditEventResponse[] {
    const seen = new Set<string>();
    return events
      .filter((event) => this.eventMatchesDocument(event, documento, tarea))
      .filter((event) => {
        const key = event.id || `${event.accion}-${event.documentoId}-${event.campoId}-${event.fechaHora}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.fechaHora ?? 0).getTime() - new Date(a.fechaHora ?? 0).getTime());
  }

  private eventMatchesDocument(
    event: DocumentAuditEventResponse,
    documento: DocumentoAuditoriaResponse,
    tarea: TareaDocumentoAuditoriaResponse
  ): boolean {
    const sameDocument = event.documentoId === documento.id;
    const sameField = !!documento.campoId && event.campoId === documento.campoId;
    const sameTaskContext = !event.tramiteId || event.tramiteId === tarea.instanciaId;
    return sameDocument || (sameField && sameTaskContext);
  }

  trackTarea(_: number, tarea: TareaDocumentoAuditoriaResponse): string {
    return tarea.tareaId;
  }

  trackDocumento(_: number, documento: DocumentoAuditoriaResponse): string {
    return `${documento.tipoOrigen}-${documento.id}`;
  }

  trackAuditEvent(_: number, event: DocumentAuditEventResponse): string {
    return event.id || `${event.accion}-${event.fechaHora}`;
  }

  trackVersion(_: number, version: DocumentoVersionResponse): string {
    return `${version.documentoId}-${version.numeroVersion}`;
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
