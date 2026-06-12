import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from './indexeddb.service';
import { ReporteVisualResponse, BloqueReporte } from '../../features/administrador/services/reportes-dinamicos.service';

@Injectable({
  providedIn: 'root'
})
export class BrowserSimpleOfflineReportService {
  private db = inject(IndexedDbService);

  async generarReporteBrowserSimple(prompt: string): Promise<ReporteVisualResponse> {
    console.log('BROWSER_SIMPLE_FALLBACK_ACTIVATED_AFTER_LOCAL_IA_FAILURE: Activando fallback del navegador después del fallo de la IA local.');
    console.log('BROWSER_SIMPLE_OFFLINE_HTTP_SKIPPED: Omitiendo llamadas HTTP para la generación del reporte local.');

    // 1. Leer IndexedDB
    console.log('BROWSER_SIMPLE_OFFLINE_INDEXEDDB_READ: Leyendo datos de IndexedDB...');
    
    let instancias: any[] = [];
    let tareas: any[] = [];
    let usuarios: any[] = [];
    let politicas: any[] = [];
    let departamentos: any[] = [];

    const offlineSnapshot = await this.db.get<any>('reportesCacheados', 'offline_snapshot');
    if (offlineSnapshot) {
      instancias = offlineSnapshot.instancias_politica || [];
      tareas = offlineSnapshot.tareas_actividad || [];
      usuarios = offlineSnapshot.usuarios || [];
      politicas = offlineSnapshot.politicas_negocio || [];
      departamentos = offlineSnapshot.departamentos || [];
    }

    // Intentar leer individualmente si están vacíos
    if (usuarios.length === 0) {
      usuarios = await this.db.getAll<any>('usuarios') || [];
    }
    if (politicas.length === 0) {
      politicas = await this.db.getAll<any>('politicas') || [];
    }
    if (departamentos.length === 0) {
      departamentos = await this.db.getAll<any>('departamentos') || [];
    }

    // 2. Filtrar por fecha obligatoria (abril 2026, mayo 2026, junio 2026)
    const filterByDate = (fechaStr: string): boolean => {
      if (!fechaStr) return false;
      const prefix = fechaStr.substring(0, 7);
      return prefix === '2026-04' || prefix === '2026-05' || prefix === '2026-06';
    };

    const promptLower = prompt.toLowerCase();
    const isEsteMes = promptLower.includes('este mes');

    const filteredInstancias = instancias.filter(inst => {
      if (!filterByDate(inst.fechaCreacion)) return false;
      if (isEsteMes) {
        return inst.fechaCreacion && inst.fechaCreacion.startsWith('2026-06');
      }
      return true;
    });

    const filteredTareas = tareas.filter(task => {
      if (!filterByDate(task.fechaCreacion)) return false;
      if (isEsteMes) {
        return task.fechaCreacion && task.fechaCreacion.startsWith('2026-06');
      }
      return true;
    });

    // 3. Validar suficiencia de datos
    if (filteredInstancias.length === 0 && filteredTareas.length === 0) {
      throw new Error("No hay datos offline suficientes para generar este reporte simple. Sincroniza datos cuando vuelvas a estar online.");
    }

    // Helpers para nombres
    const getUsuarioNombre = (idOrEmail: string, users: any[]): string => {
      if (!idOrEmail) return 'Sin asignar';
      const u = users.find(x => x.id === idOrEmail || x.correo === idOrEmail || x.nombre === idOrEmail);
      return u ? u.nombre : idOrEmail;
    };

    const getPoliticaNombre = (idOrName: string, pols: any[]): string => {
      if (!idOrName) return 'Sin política';
      const p = pols.find(x => x.id === idOrName || x.nombre === idOrName);
      return p ? p.nombre : idOrName;
    };

    // 4. Seleccionar bloques a generar según prompt
    const blocks: BloqueReporte[] = [];
    let order = 1;

    // Detectar qué bloques generar
    const hasEstado = promptLower.includes('estado');
    const hasMes = promptLower.includes('mes') || promptLower.includes('mensual') || promptLower.includes('tiempo') || promptLower.includes('evolución') || promptLower.includes('evolucion');
    const hasTotal = promptLower.includes('total') || promptLower.includes('cantidad') || promptLower.includes('kpi');
    const hasActivo = promptLower.includes('activo') || promptLower.includes('funcionario') || promptLower.includes('responsable');
    const hasFinalizado = promptLower.includes('finalizado') || promptLower.includes('completado') || promptLower.includes('terminado');
    const hasPolitica = promptLower.includes('tramites por politica') || promptLower.includes('trámites por política') || promptLower.includes('trámite por política') || promptLower.includes('tramite por politica');
    const hasRankingPoliticas = promptLower.includes('utilizada') || promptLower.includes('usada') || promptLower.includes('ranking') || promptLower.includes('políticas más') || promptLower.includes('politicas mas');
    const hasUsuarioIniciador = promptLower.includes('usuario') || promptLower.includes('inicia') || promptLower.includes('creador') || promptLower.includes('iniciador');

    // KPI total de trámites
    const buildTotalBlock = (insts: any[], o: number): BloqueReporte => {
      const total = insts.length;
      return {
        id: `bloque_total_${o}`,
        tipo: 'kpi',
        titulo: 'Total de Trámites',
        orden: o,
        posicion: o,
        datos: {
          labels: ['Total'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Total de Trámites', total]]
        },
        dataset: {
          labels: ['Total'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Total de Trámites', total]]
        },
        configuracion: {
          xKey: 'Total',
          yKey: 'total',
          descripcion: 'Total de trámites registrados en el período'
        }
      };
    };

    // KPI finalizados
    const buildFinalizadosBlock = (insts: any[], o: number): BloqueReporte => {
      const total = insts.filter(inst => {
        const est = (inst.estadoInstancia || inst.estado || '').toUpperCase();
        return est === 'FINALIZADO' || est === 'FINALIZADA' || est === 'COMPLETADO';
      }).length;
      return {
        id: `bloque_finalizados_${o}`,
        tipo: 'kpi',
        titulo: 'Trámites Finalizados',
        orden: o,
        posicion: o,
        datos: {
          labels: ['Finalizados'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Trámites Finalizados', total]]
        },
        dataset: {
          labels: ['Finalizados'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Trámites Finalizados', total]]
        },
        configuracion: {
          xKey: 'Finalizados',
          yKey: 'total',
          descripcion: 'Cantidad de trámites finalizados'
        }
      };
    };

    // KPI pendientes
    const buildPendientesBlock = (insts: any[], o: number): BloqueReporte => {
      const total = insts.filter(inst => {
        const est = (inst.estadoInstancia || inst.estado || '').toUpperCase();
        return est === 'PENDIENTE' || est === 'EN_PROCESO' || est === 'TOMADA' || est === 'ABIERTA' || est === 'ASIGNADA';
      }).length;
      return {
        id: `bloque_pendientes_${o}`,
        tipo: 'kpi',
        titulo: 'Trámites Pendientes / En Curso',
        orden: o,
        posicion: o,
        datos: {
          labels: ['Pendientes/En curso'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Trámites Pendientes', total]]
        },
        dataset: {
          labels: ['Pendientes/En curso'],
          values: [total],
          columns: ['Métrica', 'Valor'],
          rows: [['Trámites Pendientes', total]]
        },
        configuracion: {
          xKey: 'Pendientes',
          yKey: 'total',
          descripcion: 'Trámites pendientes o en curso'
        }
      };
    };

    // Trámites por estado
    const buildEstadoBlock = (insts: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const estado = inst.estadoInstancia || inst.estado || 'DESCONOCIDO';
        counts[estado] = (counts[estado] || 0) + 1;
      });
      const labels = Object.keys(counts);
      const values = Object.values(counts);
      const rows = labels.map(lbl => [lbl, counts[lbl]]);
      return {
        id: `bloque_estado_${o}`,
        tipo: 'doughnut',
        titulo: 'Distribución de Trámites por Estado',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Estado', 'Cantidad'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Estado', 'Cantidad'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Distribución de trámites por estado actual'
        }
      };
    };

    // Trámites por mes
    const buildMesBlock = (insts: any[], o: number): BloqueReporte => {
      const months = [
        { key: '2026-04', label: 'Abril 2026' },
        { key: '2026-05', label: 'Mayo 2026' },
        { key: '2026-06', label: 'Junio 2026' }
      ];
      const counts: { [key: string]: number } = {
        'Abril 2026': 0,
        'Mayo 2026': 0,
        'Junio 2026': 0
      };
      insts.forEach(inst => {
        if (inst.fechaCreacion) {
          const prefix = inst.fechaCreacion.substring(0, 7);
          const match = months.find(m => m.key === prefix);
          if (match) {
            counts[match.label]++;
          }
        }
      });
      const labels = months.map(m => m.label);
      const values = labels.map(lbl => counts[lbl]);
      const rows = labels.map(lbl => [lbl, counts[lbl]]);
      return {
        id: `bloque_mes_${o}`,
        tipo: 'line',
        titulo: 'Evolución Mensual de Trámites',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Mes', 'Trámites'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Mes', 'Trámites'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Evolución mensual de trámites creados'
        }
      };
    };

    // Funcionarios más activos
    const buildFuncionarioActivoBlock = (insts: any[], tsks: any[], usrs: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const func = inst.funcionarioAsignado;
        if (func) {
          const name = getUsuarioNombre(func, usrs);
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      if (Object.keys(counts).length === 0) {
        tsks.forEach(t => {
          const resp = t.responsableId;
          if (resp) {
            const name = getUsuarioNombre(resp, usrs);
            counts[name] = (counts[name] || 0) + 1;
          }
        });
      }
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const labels = sorted.map(x => x[0]);
      const values = sorted.map(x => x[1]);
      const rows = sorted.map(x => [x[0], x[1]]);
      return {
        id: `bloque_func_activo_${o}`,
        tipo: 'bar',
        titulo: 'Funcionarios más Activos',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Funcionario', 'Trámites/Tareas'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Funcionario', 'Trámites/Tareas'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Ranking de funcionarios con mayor actividad asignada'
        }
      };
    };

    // Trámites finalizados por funcionario
    const buildFinalizadosFuncionarioBlock = (insts: any[], usrs: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const est = (inst.estadoInstancia || inst.estado || '').toUpperCase();
        if (est === 'FINALIZADO' || est === 'FINALIZADA' || est === 'COMPLETADO') {
          const func = inst.funcionarioAsignado;
          if (func) {
            const name = getUsuarioNombre(func, usrs);
            counts[name] = (counts[name] || 0) + 1;
          }
        }
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const labels = sorted.map(x => x[0]);
      const values = sorted.map(x => x[1]);
      const rows = sorted.map(x => [x[0], x[1]]);
      return {
        id: `bloque_finalizados_func_${o}`,
        tipo: 'bar',
        titulo: 'Trámites Finalizados por Funcionario',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Funcionario', 'Trámites Finalizados'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Funcionario', 'Trámites Finalizados'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Trámites finalizados agrupados por funcionario'
        }
      };
    };

    // Trámites por política
    const buildPoliticaBlock = (insts: any[], pols: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const pol = inst.politicaNombre || inst.politicaId;
        if (pol) {
          const name = getPoliticaNombre(pol, pols);
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      const labels = Object.keys(counts);
      const values = Object.values(counts);
      const rows = labels.map(lbl => [lbl, counts[lbl]]);
      return {
        id: `bloque_politica_${o}`,
        tipo: 'pie',
        titulo: 'Trámites por Política de Negocio',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Política de Negocio', 'Trámites'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Política de Negocio', 'Trámites'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Distribución de trámites por política de negocio'
        }
      };
    };

    // Políticas más utilizadas
    const buildPoliticaRankingBlock = (insts: any[], pols: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const pol = inst.politicaNombre || inst.politicaId;
        if (pol) {
          const name = getPoliticaNombre(pol, pols);
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const labels = sorted.map(x => x[0]);
      const values = sorted.map(x => x[1]);
      const rows = sorted.map(x => [x[0], x[1]]);
      return {
        id: `bloque_politica_ranking_${o}`,
        tipo: 'bar',
        titulo: 'Políticas de Negocio más Utilizadas',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Política de Negocio', 'Frecuencia'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Política de Negocio', 'Frecuencia'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Ranking de políticas más utilizadas según cantidad de trámites creados'
        }
      };
    };

    // Usuarios creadores
    const buildUsuarioIniciadorBlock = (insts: any[], usrs: any[], o: number): BloqueReporte => {
      const counts: { [key: string]: number } = {};
      insts.forEach(inst => {
        const creador = inst.creadaPor;
        if (creador) {
          const name = getUsuarioNombre(creador, usrs);
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const labels = sorted.map(x => x[0]);
      const values = sorted.map(x => x[1]);
      const rows = sorted.map(x => [x[0], x[1]]);
      return {
        id: `bloque_usuario_iniciador_${o}`,
        tipo: 'bar',
        titulo: 'Usuarios que más Inician Políticas',
        orden: o,
        posicion: o,
        datos: {
          labels,
          values,
          columns: ['Usuario Creador', 'Trámites Iniciados'],
          rows
        },
        dataset: {
          labels,
          values,
          columns: ['Usuario Creador', 'Trámites Iniciados'],
          rows
        },
        configuracion: {
          xKey: 'nombre',
          yKey: 'cantidad',
          descripcion: 'Ranking de usuarios por cantidad de políticas de negocio iniciadas'
        }
      };
    };

    // Generar según keywords
    if (hasEstado) {
      blocks.push(buildEstadoBlock(filteredInstancias, order++));
    }
    if (hasMes) {
      blocks.push(buildMesBlock(filteredInstancias, order++));
    }
    if (hasTotal) {
      blocks.push(buildTotalBlock(filteredInstancias, order++));
    }
    if (hasActivo) {
      blocks.push(buildFuncionarioActivoBlock(filteredInstancias, filteredTareas, usuarios, order++));
    }
    if (hasFinalizado) {
      blocks.push(buildFinalizadosFuncionarioBlock(filteredInstancias, usuarios, order++));
    }
    if (hasPolitica) {
      blocks.push(buildPoliticaBlock(filteredInstancias, politicas, order++));
    } else if (hasRankingPoliticas) {
      blocks.push(buildPoliticaRankingBlock(filteredInstancias, politicas, order++));
    }
    if (hasUsuarioIniciador) {
      blocks.push(buildUsuarioIniciadorBlock(filteredInstancias, usuarios, order++));
    }

    // Resumen general por defecto
    if (blocks.length === 0 || promptLower.includes('resumen') || promptLower.includes('general') || promptLower.includes('dashboard')) {
      blocks.push(buildTotalBlock(filteredInstancias, order++));
      blocks.push(buildFinalizadosBlock(filteredInstancias, order++));
      blocks.push(buildPendientesBlock(filteredInstancias, order++));
      blocks.push(buildEstadoBlock(filteredInstancias, order++));
      blocks.push(buildMesBlock(filteredInstancias, order++));
    }

    const reportTitle = isEsteMes ? 'Resumen de Trámites del Mes (Junio 2026)' : 'Reporte Básico Local Sincronizado';
    const reportDesc = `Reporte generado localmente usando el fallback de última instancia del navegador con datos sincronizados (Período: abril 2026 - junio 2026).`;

    const reporteResponse: ReporteVisualResponse = {
      titulo: reportTitle,
      descripcion: reportDesc,
      promptOriginal: prompt,
      fechaGeneracion: new Date().toISOString(),
      bloques: blocks,
      asistido: false,
      offlineMessage: 'Fallback local: el motor de Deep Learning local no está disponible. Reporte básico generado desde datos sincronizados.'
    };

    console.log('BROWSER_SIMPLE_OFFLINE_REPORT_READY: Reporte básico generado de forma exitosa localmente.');
    return reporteResponse;
  }
}
