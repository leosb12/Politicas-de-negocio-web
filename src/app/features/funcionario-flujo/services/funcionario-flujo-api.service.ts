import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { API_ENDPOINTS, API_BASE_URL } from '../../../core/config/api.config';
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
  private readonly tareasApiUrl = API_ENDPOINTS.tareas;
  private readonly instanciasApiUrl = API_ENDPOINTS.instancias;

  getMisTareas(): Observable<TareaMiaResponseDto[]> {
    return forkJoin({
      mias: this.getTareasCompat('mias'),
      mis: this.getTareasCompat('mis'),
    }).pipe(
      // Prefer the richer /mias contract, but keep /mis as compatibility source.
      map(({ mias, mis }) => this.mergeTareasById(mis, mias))
    );
  }

  getTareaDetalle(tareaId: string): Observable<TareaDetalleResponseDto> {
    return this.http.get<TareaDetalleResponseDto>(`${this.tareasApiUrl}/${tareaId}`);
  }

  tomarTarea(tareaId: string): Observable<TareaDetalleResponseDto> {
    const url = `${this.tareasApiUrl}/${tareaId}/tomar`;
    return this.withMethodFallback(url, null);
  }

  completarTarea(
    tareaId: string,
    payload: CompletarTareaRequestDto
  ): Observable<TareaDetalleResponseDto> {
    const url = `${this.tareasApiUrl}/${tareaId}/completar`;
    return this.withMethodFallback(url, payload);
  }

  subirArchivo(request: SubirArchivoRequestDto): Observable<ArchivoMetadataResponseDto> {
    if (!request.instanciaId) {
      return throwError(() => new Error(
        'No se puede subir un archivo sin instanciaId. El trámite debe estar asociado.'
      ));
    }

    const formData = new FormData();
    formData.append('file', request.archivo);
    formData.append('origenCarga', 'WEB');

    const url = `${API_BASE_URL}/api/documentos/tramites/${request.instanciaId}/archivos`;
    return this.http.post<any>(url, formData).pipe(
      map((res) => ({
        id: res.archivoId || res.id,
        nombreOriginal: res.nombreArchivoOriginal || res.nombreOriginal,
        nombreGuardado: res.nombreArchivoSanitizado || res.nombreGuardado,
        contentType: res.tipoArchivo || res.contentType,
        tamanoBytes: res.tamanoBytes,
        fechaSubida: res.fechaSubida,
        rutaOKey: res.s3Key || res.rutaOKey,
        storageType: 's3',
        urlAcceso: res.s3Url || res.urlAcceso,
        bucket: res.s3Bucket || res.bucket,
        clienteId: res.clienteId,
      } as ArchivoMetadataResponseDto))
    );
  }

  getTareasPorInstancia(instanciaId: string): Observable<TareaMiaResponseDto[]> {
    return this.http.get<TareaMiaResponseDto[]>(
      `${this.tareasApiUrl}/instancia/${instanciaId}`
    );
  }

  getInstanciaDetalle(instanciaId: string): Observable<InstanciaDetalleResponseDto> {
    return this.http.get<InstanciaDetalleResponseDto>(
      `${this.instanciasApiUrl}/${instanciaId}`
    );
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
