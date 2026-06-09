import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexedDbService } from './indexeddb.service';
import { API_ENDPOINTS } from '../config/api.config';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type SyncState = 'IDLE' | 'SYNCING' | 'READY' | 'WARNING';

@Injectable({
  providedIn: 'root',
})
export class OfflineInitialSyncService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(IndexedDbService);

  readonly state = signal<SyncState>('IDLE');
  readonly message = signal<string>('');
  readonly failedModules = signal<string[]>([]);
  readonly lastSyncTime = signal<string | null>(null);

  constructor() {
    this.loadLastSyncTime();
  }

  private async loadLastSyncTime() {
    try {
      const adminTime = await this.db.get<{ timestamp: string }>('adminSnapshot', 'lastSync');
      if (adminTime) {
        this.lastSyncTime.set(adminTime.timestamp);
        return;
      }
      const funcTime = await this.db.get<{ timestamp: string }>('funcionarioSnapshot', 'lastSync');
      if (funcTime) {
        this.lastSyncTime.set(funcTime.timestamp);
      }
    } catch {
      // Ignore
    }
  }

  async syncAll(userId: string, rol: string): Promise<boolean> {
    this.state.set('SYNCING');
    this.failedModules.set([]);
    this.message.set('Preparando modo offline...');

    const isAdm = rol === 'ADMIN' || rol === 'ADMINISTRADOR';

    try {
      if (isAdm) {
        await this.syncAdmin(userId);
      } else {
        await this.syncFuncionario(userId);
      }

      if (this.failedModules().length > 0) {
        this.state.set('WARNING');
        this.message.set('Modo offline listo con advertencias');
        return false;
      } else {
        this.state.set('READY');
        this.message.set('Modo offline listo');
        const now = new Date().toLocaleString();
        this.lastSyncTime.set(now);
        return true;
      }
    } catch (err) {
      console.error('[InitialSync] Error general de sync:', err);
      this.state.set('WARNING');
      this.message.set('La sincronización inicial falló parcialmente');
      return false;
    }
  }

  private async syncAdmin(userId: string): Promise<void> {
    // 1. Sincronizar Políticas de negocio
    this.message.set('Sincronizando políticas...');
    let politicas: any[] = [];
    try {
      politicas = await firstValueFrom(this.http.get<any[]>(API_ENDPOINTS.politicas));
      await this.db.clear('politicas');
      for (const p of politicas) {
        await this.db.put('politicas', p);
      }
    } catch (err) {
      console.error('Error al sincronizar politicas:', err);
      this.failedModules.update((m) => [...m, 'Políticas']);
    }

    // 2. Sincronizar detalle de cada política (detalles, flujos, requisitos, auditoría)
    if (politicas.length > 0) {
      this.message.set(`Sincronizando detalles de ${politicas.length} políticas...`);
      for (const p of politicas) {
        // Detalle y flujo
        try {
          const detail = await firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.politicas}/${p.id}`));
          await this.db.put('politicaDetalles', detail);
          // El flujo está dentro del detalle
          if (detail.nodos || detail.conexiones) {
            await this.db.put('politicaFlujos', {
              id: p.id,
              nodos: detail.nodos || [],
              conexiones: detail.conexiones || [],
              laneOrientation: detail.laneOrientation,
              laneWidth: detail.laneWidth,
              laneHeight: detail.laneHeight,
            });
          }
        } catch (err) {
          console.error(`Error al sincronizar detalle de política ${p.id}:`, err);
          this.failedModules.update((m) => [...m, `Detalle de Política: ${p.nombre}`]);
        }

        // Requisitos iniciales
        try {
          const reqs = await firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.politicas}/${p.id}/requisitos-iniciales`));
          await this.db.put('formDrafts', { id: `requisitos-${p.id}`, campos: reqs });
        } catch {
          // No todos tienen requisitos iniciales o puede fallar, registrar advertencia leve
        }

        // Auditoría general de política
        try {
          const generalAudit = await firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.politicas}/${p.id}/auditoria/general`));
          if (generalAudit) {
            generalAudit.id = p.id;
            await this.db.put('politicaAuditoria', generalAudit);
          }
        } catch (err) {
          console.error(`Error al sincronizar auditoría general de política ${p.id}:`, err);
        }

        // Auditoría documental
        try {
          const docAudit = await firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.politicas}/${p.id}/auditoria/documental`));
          if (docAudit) {
            docAudit.id = p.id;
            await this.db.put('auditoriaDocumental', docAudit);
            // Cachear metadatos de documentos asociados
            if (docAudit.tareas) {
              for (const tarea of docAudit.tareas) {
                if (tarea.documentos) {
                  for (const doc of tarea.documentos) {
                    await this.db.put('documentosMetadata', doc);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error al sincronizar auditoría documental de política ${p.id}:`, err);
        }
      }
    }

    // 3. Sincronizar usuarios, roles, departamentos
    this.message.set('Sincronizando catálogos del sistema...');
    try {
      const usuarios = await firstValueFrom(this.http.get<any[]>(API_ENDPOINTS.adminUsers));
      await this.db.clear('usuarios');
      for (const u of usuarios) {
        await this.db.put('usuarios', u);
      }
    } catch (err) {
      console.error('Error al sincronizar usuarios:', err);
      this.failedModules.update((m) => [...m, 'Usuarios']);
    }

    try {
      const roles = await firstValueFrom(this.http.get<any[]>(API_ENDPOINTS.adminRoles));
      await this.db.clear('roles');
      for (const r of roles) {
        await this.db.put('roles', r);
      }
    } catch (err) {
      console.error('Error al sincronizar roles:', err);
      this.failedModules.update((m) => [...m, 'Roles']);
    }

    try {
      const departamentos = await firstValueFrom(this.http.get<any[]>(API_ENDPOINTS.adminDepartments));
      await this.db.clear('departamentos');
      for (const d of departamentos) {
        await this.db.put('departamentos', d);
      }
    } catch (err) {
      console.error('Error al sincronizar departamentos:', err);
      this.failedModules.update((m) => [...m, 'Departamentos']);
    }

    // 4. Auditorías y Analíticas del sistema
    this.message.set('Sincronizando auditorías y analíticas...');
    try {
      const systemAudit = await firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.analytics}/system-audit`));
      await this.db.put('auditoriaSistema', { id: 'general', logs: systemAudit });
    } catch (err) {
      console.error('Error al sincronizar auditoria del sistema:', err);
      this.failedModules.update((m) => [...m, 'Auditoría del Sistema']);
    }

    try {
      const [summary, bottlenecks, redistribution] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.analytics}/dashboard-summary`).pipe(catchError(() => of(null)))),
        firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.analytics}/bottlenecks`).pipe(catchError(() => of(null)))),
        firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.analytics}/task-redistribution`).pipe(catchError(() => of(null)))),
      ]);

      await this.db.put('analiticaSistema', {
        id: 'dashboard',
        summary,
        bottlenecks,
        redistribution,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error al sincronizar analíticas:', err);
      this.failedModules.update((m) => [...m, 'Analíticas']);
    }

    // 5. Reportes recientes y catálogos
    try {
      const [historial, catalogo] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.adminReportes}/historial`).pipe(catchError(() => of([])))),
        firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.adminReportes}/catalogo`).pipe(catchError(() => of(null)))),
      ]);
      await this.db.put('reportesCacheados', {
        id: 'recent',
        historial,
        catalogo,
      });
    } catch {
      // Ignorar leve
    }

    // Guardar snapshot timestamp
    const nowStr = new Date().toLocaleString();
    await this.db.put('adminSnapshot', { id: 'lastSync', timestamp: nowStr, userId });
  }

  private async syncFuncionario(userId: string): Promise<void> {
    this.message.set('Sincronizando tareas...');

    let mias: any[] = [];
    let mis: any[] = [];

    try {
      mias = await firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.tareas}/mias`).pipe(catchError(() => of([]))));
      mis = await firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.tareas}/mis`).pipe(catchError(() => of([]))));
    } catch (err) {
      console.error('Error al sincronizar tareas mías/mis:', err);
      this.failedModules.update((m) => [...m, 'Tareas']);
    }

    // Clasificar y guardar tareas
    const allTasks = [...mias, ...mis];
    const uniqueTasksMap = new Map<string, any>();
    for (const t of allTasks) {
      if (t && t.id) uniqueTasksMap.set(t.id, t);
    }
    const uniqueTasks = Array.from(uniqueTasksMap.values());

    await this.db.clear('tareasPendientes');
    await this.db.clear('tareasEnProceso');
    await this.db.clear('tareasCompletadas');

    const pendientes = uniqueTasks.filter(t => ['PENDIENTE', 'ABIERTA', 'ASIGNADA'].includes(t.estadoTarea));
    const enProceso = uniqueTasks.filter(t => ['EN_PROCESO', 'TOMADA'].includes(t.estadoTarea));
    const completadas = uniqueTasks.filter(t => ['COMPLETADA', 'FINALIZADA'].includes(t.estadoTarea));

    for (const t of pendientes) {
      await this.db.put('tareasPendientes', t);
    }
    for (const t of enProceso) {
      await this.db.put('tareasEnProceso', t);
    }
    for (const t of completadas) {
      await this.db.put('tareasCompletadas', t);
    }

    // Sincronizar detalle de cada tarea activa
    const activeTasks = [...pendientes, ...enProceso];
    if (activeTasks.length > 0) {
      this.message.set(`Sincronizando detalles de ${activeTasks.length} tareas...`);
      for (const t of activeTasks) {
        try {
          const detail = await firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.tareas}/${t.id}`));
          await this.db.put('tareaDetalles', detail);

          // Cargar instancia detalle
          if (detail.instanciaId) {
            const instance = await firstValueFrom(this.http.get<any>(`${API_ENDPOINTS.instancias}/${detail.instanciaId}`));
            await this.db.put('documentosMetadata', { id: `instancia-${detail.instanciaId}`, instance });

            // Cargar archivos de la instancia
            const archivos = await firstValueFrom(this.http.get<any[]>(`${API_ENDPOINTS.archivos}/by-instancia/${detail.instanciaId}`).pipe(catchError(() => of([]))));
            for (const arch of archivos) {
              await this.db.put('documentosMetadata', arch);
            }
          }
        } catch (err) {
          console.error(`Error al cargar detalle de tarea ${t.id}:`, err);
        }
      }
    }

    // Guardar snapshot timestamp
    const nowStr = new Date().toLocaleString();
    await this.db.put('funcionarioSnapshot', { id: 'lastSync', timestamp: nowStr, userId });
  }
}
