import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, throwError, from } from 'rxjs';
import { API_ENDPOINTS, API_BASE_URL } from '../../../core/config/api.config';
import { IndexedDbService } from '../../../core/offline/indexeddb.service';
import {
  ArchivoMetadataResponseDto,
  CompletarTareaRequestDto,
  InstanciaDetalleResponseDto,
  SubirArchivoRequestDto,
  TareaDetalleResponseDto,
  TareaMiaResponseDto,
} from '../models/funcionario-flujo.dto';

@Injectable({
  providedIn: 'root',
})
export class FuncionarioFlujoApiService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(IndexedDbService);
  private readonly tareasApiUrl = API_ENDPOINTS.tareas;
  private readonly instanciasApiUrl = API_ENDPOINTS.instancias;

  // ===== MÉTODOS OFFLINE EXPLÍCITOS Y AUXILIARES =====

  async getTareasPendientesOffline(): Promise<TareaMiaResponseDto[]> {
    return this.db.getAll<TareaMiaResponseDto>('tareasPendientes');
  }

  async getTareasEnProcesoOffline(): Promise<TareaMiaResponseDto[]> {
    return this.db.getAll<TareaMiaResponseDto>('tareasEnProceso');
  }

  async getTareasCompletadasOffline(): Promise<TareaMiaResponseDto[]> {
    return this.db.getAll<TareaMiaResponseDto>('tareasCompletadas');
  }

  async getTareaDetalleOffline(id: string): Promise<TareaDetalleResponseDto> {
    const detail = await this.db.get<TareaDetalleResponseDto>('tareaDetalles', id);
    if (!detail) throw new Error(`Detalle de tarea no encontrado en caché: ${id}`);
    return detail;
  }

  private async tomarTareaOffline(tareaId: string): Promise<void> {
    const pendingTasks = await this.db.getAll<any>('tareasPendientes');
    const task = pendingTasks.find((t) => t.id === tareaId);
    if (task) {
      task.estadoTarea = 'EN_PROCESO';
      await this.db.put('tareasEnProceso', task);
      await this.db.delete('tareasPendientes', tareaId);
    }
    const detail = await this.db.get<any>('tareaDetalles', tareaId);
    if (detail) {
      detail.estadoTarea = 'EN_PROCESO';
      await this.db.put('tareaDetalles', detail);
    }
  }

  private async completarTareaOffline(tareaId: string, payload: any): Promise<void> {
    const inProcessTasks = await this.db.getAll<any>('tareasEnProceso');
    const task = inProcessTasks.find((t) => t.id === tareaId);
    if (task) {
      task.estadoTarea = 'COMPLETADA';
      await this.db.put('tareasCompletadas', task);
      await this.db.delete('tareasEnProceso', tareaId);
    }
    const detail = await this.db.get<any>('tareaDetalles', tareaId);
    if (detail) {
      detail.estadoTarea = 'COMPLETADA';
      if (payload && payload.formularioRespuesta) {
        detail.formularioRespuesta = payload.formularioRespuesta;
      }
      await this.db.put('tareaDetalles', detail);
    }
  }

  // ====================================================

  getMisTareas(): Observable<TareaMiaResponseDto[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return this.getMisTareasOffline();
    }
    return forkJoin({
      mias: this.getTareasCompat('mias'),
      mis: this.getTareasCompat('mis'),
    }).pipe(
      map(({ mias, mis }) => this.mergeTareasById(mis, mias)),
      catchError((err) => {
        if (err.status === 0) return this.getMisTareasOffline();
        return throwError(() => err);
      })
    );
  }

  private getMisTareasOffline(): Observable<TareaMiaResponseDto[]> {
    return from(
      Promise.all([
        this.getTareasPendientesOffline(),
        this.getTareasEnProcesoOffline(),
        this.getTareasCompletadasOffline(),
      ]).then(([pendientes, enProceso, completadas]) => {
        return [...pendientes, ...enProceso, ...completadas];
      })
    );
  }

  getTareaDetalle(tareaId: string): Observable<TareaDetalleResponseDto> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getTareaDetalleOffline(tareaId));
    }
    return this.http.get<TareaDetalleResponseDto>(`${this.tareasApiUrl}/${tareaId}`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getTareaDetalleOffline(tareaId));
        return throwError(() => err);
      })
    );
  }

  tomarTarea(tareaId: string): Observable<TareaDetalleResponseDto> {
    const url = `${this.tareasApiUrl}/${tareaId}/tomar`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.tomarTareaOffline(tareaId).catch((e) => console.warn(e));
    }
    return this.withMethodFallback<TareaDetalleResponseDto>(url, null).pipe(
      catchError((err) => {
        if (err.status === 0) {
          this.tomarTareaOffline(tareaId).catch((e) => console.warn(e));
          return of({ id: tareaId, estadoTarea: 'EN_PROCESO' } as any);
        }
        return throwError(() => err);
      })
    );
  }

  completarTarea(
    tareaId: string,
    payload: CompletarTareaRequestDto
  ): Observable<TareaDetalleResponseDto> {
    const url = `${this.tareasApiUrl}/${tareaId}/completar`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.completarTareaOffline(tareaId, payload).catch((e) => console.warn(e));
    }
    return this.withMethodFallback<TareaDetalleResponseDto>(url, payload).pipe(
      catchError((err) => {
        if (err.status === 0) {
          this.completarTareaOffline(tareaId, payload).catch((e) => console.warn(e));
          return of({ id: tareaId, estadoTarea: 'COMPLETADA' } as any);
        }
        return throwError(() => err);
      })
    );
  }

  subirArchivo(request: SubirArchivoRequestDto): Observable<ArchivoMetadataResponseDto> {
    if (!request.instanciaId) {
      return throwError(() => new Error(
        'No se puede subir un archivo sin instanciaId. El trámite debe estar asociado.'
      ));
    }

    const formData = new FormData();
    formData.append('archivo', request.archivo);
    this.appendFormDataText(formData, 'instanciaId', request.instanciaId);
    this.appendFormDataText(formData, 'actividadId', request.actividadId);
    this.appendFormDataText(formData, 'tareaId', request.tareaId);
    this.appendFormDataText(formData, 'usuarioId', request.usuarioId);
    this.appendFormDataText(formData, 'campoId', request.campoId);
    this.appendFormDataText(formData, 'tramiteId', request.tramiteId ?? request.instanciaId);
    this.appendFormDataText(formData, 'clienteId', request.clienteId);
    this.appendFormDataText(formData, 'politicaId', request.politicaId);
    this.appendFormDataText(formData, 'nodoId', request.nodoId ?? request.actividadId);
    this.appendFormDataText(formData, 'descripcion', request.descripcion);

    return this.http.post<ArchivoMetadataResponseDto>(API_ENDPOINTS.archivos, formData);
  }

  getTareasPorInstancia(instanciaId: string): Observable<TareaMiaResponseDto[]> {
    return this.http.get<TareaMiaResponseDto[]>(
      `${this.tareasApiUrl}/instancia/${instanciaId}`
    );
  }

  getInstanciaDetalle(instanciaId: string): Observable<InstanciaDetalleResponseDto> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.db.get<any>('documentosMetadata', `instancia-${instanciaId}`).then((d) => d?.instance));
    }
    return this.http.get<InstanciaDetalleResponseDto>(
      `${this.instanciasApiUrl}/${instanciaId}`
    ).pipe(
      catchError((err) => {
        if (err.status === 0) {
          return from(this.db.get<any>('documentosMetadata', `instancia-${instanciaId}`).then((d) => d?.instance));
        }
        return throwError(() => err);
      })
    );
  }

  getArchivosPorInstancia(instanciaId: string): Observable<ArchivoMetadataResponseDto[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.db.getAll<any>('documentosMetadata').then((docs) => {
        return docs.filter((d) => d.instanciaId === instanciaId);
      }));
    }
    return this.http.get<ArchivoMetadataResponseDto[]>(
      `${API_ENDPOINTS.archivos}/by-instancia/${encodeURIComponent(instanciaId)}`
    ).pipe(
      catchError((err) => {
        if (err.status === 0) {
          return from(this.db.getAll<any>('documentosMetadata').then((docs) => {
            return docs.filter((d) => d.instanciaId === instanciaId);
          }));
        }
        return throwError(() => err);
      })
    );
  }

  descargarArchivo(archivoId: string): Observable<Blob> {
    return this.http.get(`${API_ENDPOINTS.archivos}/${encodeURIComponent(archivoId)}/download`, {
      responseType: 'blob',
    });
  }

  verArchivo(archivoId: string): Observable<Blob> {
    return this.http.get(`${API_ENDPOINTS.archivos}/${encodeURIComponent(archivoId)}/view`, {
      responseType: 'blob',
    });
  }

  editarArchivo(
    archivoId: string,
    payload: { nombreOriginal?: string | null; descripcion?: string | null }
  ): Observable<ArchivoMetadataResponseDto> {
    return this.http.patch<ArchivoMetadataResponseDto>(
      `${API_ENDPOINTS.archivos}/${encodeURIComponent(archivoId)}`,
      payload
    );
  }

  reemplazarArchivo(archivoId: string, archivo: File): Observable<ArchivoMetadataResponseDto> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.put<ArchivoMetadataResponseDto>(
      `${API_ENDPOINTS.archivos}/${encodeURIComponent(archivoId)}/replace`,
      formData
    );
  }

  eliminarArchivo(archivoId: string): Observable<void> {
    return this.http.delete<void>(`${API_ENDPOINTS.archivos}/${encodeURIComponent(archivoId)}`);
  }

  private appendFormDataText(
    formData: FormData,
    key: string,
    value: string | null | undefined
  ): void {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }

    formData.append(key, normalized);
  }

  private getTareasCompat(path: 'mias' | 'mis'): Observable<TareaMiaResponseDto[]> {
    return this.http
      .get<TareaMiaResponseDto[]>(`${this.tareasApiUrl}/${path}`)
      .pipe(
        catchError((error: unknown) => {
          if (this.isCompatibilityEndpointMissing(error)) {
            return of([] as TareaMiaResponseDto[]);
          }

          return throwError(() => error);
        })
      );
  }

  private withMethodFallback<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<T>(url, body).pipe(
      catchError((error: unknown) => {
        if (this.isMethodFallbackError(error)) {
          return this.http.patch<T>(url, body);
        }

        return throwError(() => error);
      })
    );
  }

  private mergeTareasById(
    ...taskGroups: ReadonlyArray<TareaMiaResponseDto[]>
  ): TareaMiaResponseDto[] {
    const merged = new Map<string, TareaMiaResponseDto>();

    for (const group of taskGroups) {
      for (const task of group) {
        const existing = merged.get(task.id);
        if (!existing) {
          merged.set(task.id, task);
          continue;
        }

        merged.set(task.id, this.mergeTask(existing, task));
      }
    }

    return Array.from(merged.values());
  }

  private mergeTask(
    base: TareaMiaResponseDto,
    incoming: TareaMiaResponseDto
  ): TareaMiaResponseDto {
    return {
      id: incoming.id ?? base.id,
      nombreActividad: incoming.nombreActividad ?? base.nombreActividad,
      estadoTarea: incoming.estadoTarea ?? base.estadoTarea,
      instanciaId: incoming.instanciaId ?? base.instanciaId,
      politicaId: incoming.politicaId ?? base.politicaId,
      politicaNombre: incoming.politicaNombre ?? base.politicaNombre,
      fechaCreacion: incoming.fechaCreacion ?? base.fechaCreacion,
      fechaInicio: incoming.fechaInicio ?? base.fechaInicio,
      prioridad: incoming.prioridad ?? base.prioridad,
      responsableActual: incoming.responsableActual ?? base.responsableActual,
      responsableTipo: incoming.responsableTipo ?? base.responsableTipo,
      responsableId: incoming.responsableId ?? base.responsableId,
      codigoTramite: incoming.codigoTramite ?? base.codigoTramite,
      estadoInstancia: incoming.estadoInstancia ?? base.estadoInstancia,
      contextoResumen: incoming.contextoResumen ?? base.contextoResumen,
    };
  }

  private isCompatibilityEndpointMissing(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse &&
      (error.status === 403 || error.status === 404 || error.status === 405)
    );
  }

  private isMethodFallbackError(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse &&
      (error.status === 404 || error.status === 405)
    );
  }
}
