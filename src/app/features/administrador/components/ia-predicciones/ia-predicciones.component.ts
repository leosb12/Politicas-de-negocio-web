import { Component, EventEmitter, Input, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../../core/config/api.config';

export interface RichPredictionResponse {
  politicaId: string;
  politicaNombre: string;
  resumenEjecutivo: string;
  mejorRuta: {
    rutaRecomendada: string[];
    explicacion: string;
    confianza: number;
    acciones: string[];
  };
  cuellosBotella: {
    nodo: string;
    riesgo: string;
    probabilidad: number;
    tiempoPromedio: string;
    carga: string;
    motivo: string;
    impacto: string;
    recomendacion: string;
  }[];
  anomalias: {
    tipo: string;
    nodo: string;
    riesgo: string;
    descripcion: string;
    recomendacion: string;
  }[];
  prioridad: {
    valor: string;
    probabilidad: number;
    motivo: string;
    factores: string[];
    prioridadPorNodo?: {
      nodo: string;
      prioridadSugerida: string;
      motivo: string;
    }[];
  };
  recomendaciones: {
    tipo: string;
    titulo: string;
    descripcion: string;
    impactoEsperado: string;
    nodosAfectados: string[];
  }[];
  explicacionModelo: string;
  datosUsados: {
    simulaciones: number;
    tiempoPromedio: string;
    nodoMayorCarga: string;
    porcentajeCarga: string;
  };
}

@Component({
  selector: 'app-ia-predicciones',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-6xl my-auto border border-slate-200/50 flex flex-col max-h-[90vh] overflow-hidden relative">
        
        <!-- Header -->
        <header class="relative px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 flex items-center gap-5 shrink-0">
          <div class="absolute top-0 right-0 p-4">
            <button type="button" class="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors" (click)="close.emit()">
              <lucide-icon name="x" [size]="24"></lucide-icon>
            </button>
          </div>
          <div class="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 text-violet-300 shadow-inner border border-white/20 flex-shrink-0 backdrop-blur-sm">
            <lucide-icon name="brain-circuit" [size]="28" [strokeWidth]="2"></lucide-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Análisis Predictivo Inteligente
              <span class="px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-200 text-xs font-semibold border border-violet-400/30">BETA</span>
            </h2>
            <p class="text-sm text-indigo-200 font-medium mt-1">Evaluación Deep Learning + Análisis Semántico: <span class="text-white font-semibold">{{ policyName }}</span></p>
          </div>
        </header>

        <!-- Content -->
        <div class="overflow-y-auto flex-1 bg-slate-50 relative custom-scrollbar">
          @if (loading()) {
            <div class="flex flex-col items-center justify-center py-24 text-slate-500 space-y-6">
              <div class="relative flex items-center justify-center w-24 h-24">
                <div class="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div class="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin"></div>
                <lucide-icon name="sparkles" [size]="32" class="text-violet-600 animate-pulse"></lucide-icon>
              </div>
              <div class="text-center max-w-md">
                <p class="text-xl font-bold text-slate-800 tracking-tight">Analizando con Deep Learning...</p>
                <p class="text-sm text-slate-500 mt-2 leading-relaxed">Procesando estructura de la política, historial de simulaciones y generando explicaciones lógicas mediante inteligencia artificial.</p>
              </div>
            </div>
          } @else if (result()) {
            <div class="p-6 sm:p-8">
              
              <!-- Resumen Ejecutivo Full Width -->
              <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex gap-6 items-start relative overflow-hidden">
                <div class="absolute -right-10 -top-10 text-violet-50 opacity-50">
                  <lucide-icon name="brain-circuit" [size]="200"></lucide-icon>
                </div>
                <div class="flex-shrink-0 w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center relative z-10">
                  <lucide-icon name="file-text" [size]="24"></lucide-icon>
                </div>
                <div class="relative z-10 flex-1">
                  <h3 class="text-lg font-bold text-slate-800 mb-2">Resumen Ejecutivo</h3>
                  <p class="text-slate-600 leading-relaxed text-sm md:text-base">{{ result()!.resumenEjecutivo }}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <!-- Columna Izquierda (Ruta y Recomendaciones) -->
                <div class="xl:col-span-2 space-y-6">
                  
                  <!-- Mejor Ruta Recomendada -->
                  @if (requestData.predictMejorRuta && result()!.mejorRuta) {
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                          <div class="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><lucide-icon name="route" [size]="20"></lucide-icon></div>
                          <h3 class="font-bold text-slate-800">Mejor Ruta Recomendada</h3>
                        </div>
                        <div class="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200">
                          <lucide-icon name="check-circle" [size]="14"></lucide-icon> Confianza: {{ (result()!.mejorRuta.confianza * 100).toFixed(1) }}%
                        </div>
                      </div>
                      <div class="p-6">
                        <!-- Nodos -->
                        <div class="flex flex-wrap items-center gap-2 mb-6">
                          @for (nodo of result()!.mejorRuta.rutaRecomendada; track nodo; let last = $last) {
                            <div class="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
                              {{ nodo }}
                            </div>
                            @if (!last) {
                              <lucide-icon name="arrow-right" [size]="16" class="text-slate-400"></lucide-icon>
                            }
                          }
                        </div>
                        <p class="text-slate-600 text-sm leading-relaxed mb-4"><strong>Análisis:</strong> {{ result()!.mejorRuta.explicacion }}</p>
                        
                        @if (result()!.mejorRuta.acciones && result()!.mejorRuta.acciones.length > 0) {
                          <div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                            <h4 class="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">Acciones sugeridas sobre la ruta</h4>
                            <ul class="space-y-2">
                              @for (accion of result()!.mejorRuta.acciones; track accion) {
                                <li class="flex items-start gap-2 text-sm text-emerald-700">
                                  <lucide-icon name="check" [size]="16" class="text-emerald-500 flex-shrink-0 mt-0.5"></lucide-icon>
                                  <span>{{ accion }}</span>
                                </li>
                              }
                            </ul>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Cuellos de Botella -->
                  @if (requestData.predictCuellosBotella && result()!.cuellosBotella) {
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-slate-100 bg-amber-50/50 flex items-center gap-3">
                        <div class="bg-amber-100 text-amber-600 p-2 rounded-lg"><lucide-icon name="timer" [size]="20"></lucide-icon></div>
                        <h3 class="font-bold text-slate-800">Cuellos de Botella Detectados</h3>
                      </div>
                      <div class="p-0 divide-y divide-slate-100">
                        @if (result()!.cuellosBotella.length === 0) {
                          <div class="p-6 text-slate-500 text-sm text-center">No se detectaron cuellos de botella significativos.</div>
                        }
                        @for (cb of result()!.cuellosBotella; track cb.nodo) {
                          <div class="p-6 hover:bg-slate-50/50 transition-colors">
                            <div class="flex justify-between items-start mb-3">
                              <h4 class="font-bold text-slate-800 text-lg flex items-center gap-2">
                                {{ cb.nodo }}
                                <span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-200 tracking-wider">Riesgo {{ cb.riesgo }}</span>
                              </h4>
                              <span class="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                                <lucide-icon name="activity" [size]="12"></lucide-icon> Prob: {{ (cb.probabilidad * 100).toFixed(1) }}%
                              </span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4 mb-4">
                              <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <p class="text-xs text-slate-500 font-semibold mb-1 uppercase">Carga Estimada</p>
                                <p class="text-slate-800 font-bold">{{ cb.carga }}</p>
                              </div>
                              <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <p class="text-xs text-slate-500 font-semibold mb-1 uppercase">Tiempo Promedio</p>
                                <p class="text-slate-800 font-bold">{{ cb.tiempoPromedio }}</p>
                              </div>
                            </div>
                            
                            <p class="text-sm text-slate-600 mb-2"><strong>Motivo:</strong> {{ cb.motivo }}</p>
                            <p class="text-sm text-slate-600 mb-3"><strong>Impacto:</strong> {{ cb.impacto }}</p>
                            
                            <div class="bg-amber-50 text-amber-800 text-sm p-3 rounded-lg border border-amber-200 flex items-start gap-2">
                              <lucide-icon name="lightbulb" [size]="18" class="text-amber-600 flex-shrink-0 mt-0.5"></lucide-icon>
                              <p><strong>Recomendación:</strong> {{ cb.recomendacion }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Anomalías -->
                  @if (requestData.predictAnomalias && result()!.anomalias) {
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-slate-100 bg-rose-50/50 flex items-center gap-3">
                        <div class="bg-rose-100 text-rose-600 p-2 rounded-lg"><lucide-icon name="alert-triangle" [size]="20"></lucide-icon></div>
                        <h3 class="font-bold text-slate-800">Anomalías de Proceso</h3>
                      </div>
                      <div class="p-0 divide-y divide-slate-100">
                        @if (result()!.anomalias.length === 0) {
                          <div class="p-6 text-slate-500 text-sm text-center">No se detectaron anomalías lógicas en la política.</div>
                        }
                        @for (ano of result()!.anomalias; track ano.nodo) {
                          <div class="p-6 hover:bg-slate-50/50 transition-colors">
                            <div class="flex items-center gap-2 mb-2">
                              <h4 class="font-bold text-slate-800">{{ ano.nodo }}</h4>
                              <span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">{{ ano.tipo }}</span>
                            </div>
                            <p class="text-sm text-slate-600 mb-3">{{ ano.descripcion }}</p>
                            <div class="bg-rose-50 text-rose-800 text-sm p-3 rounded-lg border border-rose-200 flex items-start gap-2">
                              <lucide-icon name="zap" [size]="18" class="text-rose-600 flex-shrink-0 mt-0.5"></lucide-icon>
                              <p><strong>Sugerencia:</strong> {{ ano.recomendacion }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                </div>

                <!-- Columna Derecha (Prioridad, Recomendaciones Generales, Datos) -->
                <div class="space-y-6">
                  
                  <!-- Prioridad Sugerida -->
                  @if (requestData.predictPrioridad && result()!.prioridad) {
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                          <div class="bg-blue-100 text-blue-600 p-2 rounded-lg"><lucide-icon name="list-ordered" [size]="20"></lucide-icon></div>
                          <h3 class="font-bold text-slate-800">Prioridad Sugerida</h3>
                        </div>
                      </div>
                      <div class="p-6">
                        <div class="flex items-center justify-center mb-6">
                          <div class="text-center">
                            <span class="text-4xl font-black" 
                              [ngClass]="{'text-red-600': result()!.prioridad.valor === 'ALTA' || result()!.prioridad.valor === 'URGENTE', 
                                          'text-amber-500': result()!.prioridad.valor === 'MEDIA',
                                          'text-emerald-500': result()!.prioridad.valor === 'NORMAL' || result()!.prioridad.valor === 'BAJA'}">
                              {{ result()!.prioridad.valor }}
                            </span>
                            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Nivel Recomendado</p>
                          </div>
                        </div>
                        <p class="text-sm text-slate-600 leading-relaxed mb-4">{{ result()!.prioridad.motivo }}</p>
                        
                        @if (result()!.prioridad.factores && result()!.prioridad.factores.length > 0) {
                          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Factores clave</h4>
                          <ul class="space-y-1.5 mb-6">
                            @for (factor of result()!.prioridad.factores; track factor) {
                              <li class="flex items-start gap-2 text-xs text-slate-600 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <lucide-icon name="info" [size]="14" class="text-blue-500 flex-shrink-0 mt-0.5"></lucide-icon>
                                <span>{{ factor }}</span>
                              </li>
                            }
                          </ul>
                        }

                        @if (result()!.prioridad.prioridadPorNodo && result()!.prioridad.prioridadPorNodo!.length > 0) {
                          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-t border-slate-100 pt-4">Prioridad por Actividad (Funcionario)</h4>
                          <div class="space-y-3">
                            @for (pn of result()!.prioridad.prioridadPorNodo; track pn.nodo) {
                              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div class="flex items-center justify-between mb-1.5">
                                  <h5 class="font-bold text-slate-700 text-sm truncate pr-2">{{ pn.nodo }}</h5>
                                  <span class="text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider"
                                    [ngClass]="{'bg-red-100 text-red-700 border-red-200': pn.prioridadSugerida === 'ALTA' || pn.prioridadSugerida === 'URGENTE', 
                                                'bg-amber-100 text-amber-700 border-amber-200': pn.prioridadSugerida === 'MEDIA',
                                                'bg-emerald-100 text-emerald-700 border-emerald-200': pn.prioridadSugerida === 'NORMAL' || pn.prioridadSugerida === 'BAJA'}">
                                    {{ pn.prioridadSugerida }}
                                  </span>
                                </div>
                                <p class="text-xs text-slate-500">{{ pn.motivo }}</p>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Recomendaciones Estratégicas -->
                  @if (result()!.recomendaciones && result()!.recomendaciones.length > 0) {
                    <div class="bg-gradient-to-b from-indigo-50 to-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-indigo-100 flex items-center gap-3">
                        <div class="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><lucide-icon name="lightbulb" [size]="20"></lucide-icon></div>
                        <h3 class="font-bold text-slate-800">Recomendaciones Estratégicas</h3>
                      </div>
                      <div class="p-5 space-y-4">
                        @for (rec of result()!.recomendaciones; track rec.titulo) {
                          <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                            <h4 class="font-bold text-indigo-900 text-sm mb-1">{{ rec.titulo }}</h4>
                            <p class="text-xs text-slate-600 mb-3">{{ rec.descripcion }}</p>
                            <div class="flex flex-wrap gap-2">
                              <span class="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded border border-indigo-100">
                                Impacto: {{ rec.impactoEsperado }}
                              </span>
                              @if (rec.nodosAfectados && rec.nodosAfectados.length > 0) {
                                <span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded border border-slate-200 truncate max-w-[150px]">
                                  Nodos: {{ rec.nodosAfectados.join(', ') }}
                                </span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Datos Usados y Metadatos -->
                  @if (result()!.datosUsados) {
                    <div class="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                        <div class="bg-slate-200 text-slate-600 p-2 rounded-lg"><lucide-icon name="activity" [size]="20"></lucide-icon></div>
                        <h3 class="font-bold text-slate-800 text-sm">Metadatos de Análisis</h3>
                      </div>
                      <div class="p-5 grid grid-cols-2 gap-3">
                        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <p class="text-[10px] font-bold text-slate-400 uppercase">Simulaciones Base</p>
                          <p class="text-sm font-black text-slate-700">{{ result()!.datosUsados.simulaciones || 'N/A' }}</p>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <p class="text-[10px] font-bold text-slate-400 uppercase">T. Promedio Flujo</p>
                          <p class="text-sm font-black text-slate-700">{{ result()!.datosUsados.tiempoPromedio || 'N/A' }}</p>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm col-span-2 flex items-center justify-between">
                          <div>
                            <p class="text-[10px] font-bold text-slate-400 uppercase">Nodo Mayor Carga</p>
                            <p class="text-sm font-bold text-slate-700 truncate max-w-[160px]">{{ result()!.datosUsados.nodoMayorCarga || 'N/A' }}</p>
                          </div>
                          <div class="text-right">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">% Carga</p>
                            <p class="text-sm font-black text-violet-600">{{ result()!.datosUsados.porcentajeCarga || '0%' }}</p>
                          </div>
                        </div>
                      </div>
                      @if (result()!.explicacionModelo) {
                        <div class="px-5 pb-5">
                           <p class="text-xs text-slate-500 italic bg-white p-3 rounded-xl border border-slate-100"><span class="font-bold">Info del modelo:</span> {{ result()!.explicacionModelo }}</p>
                        </div>
                      }
                    </div>
                  }

                </div>
              </div>

            </div>
          } @else {
            <div class="p-8 max-w-3xl mx-auto">
              <div class="text-center mb-8">
                <h3 class="text-2xl font-black text-slate-800 tracking-tight">Configura tu Análisis</h3>
                <p class="text-slate-500 mt-2">Selecciona las dimensiones que deseas evaluar mediante Deep Learning y Procesamiento de Lenguaje Natural.</p>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="group relative flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-violet-50/50 hover:border-violet-200 transition-all" [class.bg-violet-50]="predictMejorRuta" [class.border-violet-500]="predictMejorRuta" [class.shadow-md]="predictMejorRuta" [class.shadow-violet-100]="predictMejorRuta">
                  <div class="flex-shrink-0 mt-0.5">
                    <input type="checkbox" [(ngModel)]="predictMejorRuta" class="w-5 h-5 text-violet-600 rounded border-slate-300 focus:ring-violet-500 transition-all" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <lucide-icon name="route" [size]="18" class="text-slate-400 group-hover:text-violet-600 transition-colors" [class.text-violet-600]="predictMejorRuta"></lucide-icon>
                      <p class="font-bold text-slate-800">Mejor Ruta Óptima</p>
                    </div>
                    <p class="text-xs text-slate-500 leading-relaxed">Descubre el camino más eficiente evaluando la estructura semántica de la política.</p>
                  </div>
                </label>

                <label class="group relative flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-violet-50/50 hover:border-violet-200 transition-all" [class.bg-violet-50]="predictCuellosBotella" [class.border-violet-500]="predictCuellosBotella" [class.shadow-md]="predictCuellosBotella" [class.shadow-violet-100]="predictCuellosBotella">
                  <div class="flex-shrink-0 mt-0.5">
                    <input type="checkbox" [(ngModel)]="predictCuellosBotella" class="w-5 h-5 text-violet-600 rounded border-slate-300 focus:ring-violet-500 transition-all" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <lucide-icon name="timer" [size]="18" class="text-slate-400 group-hover:text-amber-500 transition-colors" [class.text-amber-500]="predictCuellosBotella"></lucide-icon>
                      <p class="font-bold text-slate-800">Riesgos y Cuellos de Botella</p>
                    </div>
                    <p class="text-xs text-slate-500 leading-relaxed">Identifica qué tareas o departamentos estancarán el proceso.</p>
                  </div>
                </label>

                <label class="group relative flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-violet-50/50 hover:border-violet-200 transition-all" [class.bg-violet-50]="predictAnomalias" [class.border-violet-500]="predictAnomalias" [class.shadow-md]="predictAnomalias" [class.shadow-violet-100]="predictAnomalias">
                  <div class="flex-shrink-0 mt-0.5">
                    <input type="checkbox" [(ngModel)]="predictAnomalias" class="w-5 h-5 text-violet-600 rounded border-slate-300 focus:ring-violet-500 transition-all" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <lucide-icon name="activity" [size]="18" class="text-slate-400 group-hover:text-rose-500 transition-colors" [class.text-rose-500]="predictAnomalias"></lucide-icon>
                      <p class="font-bold text-slate-800">Anomalías y Desviaciones</p>
                    </div>
                    <p class="text-xs text-slate-500 leading-relaxed">Detecta comportamientos ilógicos o configuraciones erróneas.</p>
                  </div>
                </label>

                <label class="group relative flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-violet-50/50 hover:border-violet-200 transition-all" [class.bg-violet-50]="predictPrioridad" [class.border-violet-500]="predictPrioridad" [class.shadow-md]="predictPrioridad" [class.shadow-violet-100]="predictPrioridad">
                  <div class="flex-shrink-0 mt-0.5">
                    <input type="checkbox" [(ngModel)]="predictPrioridad" class="w-5 h-5 text-violet-600 rounded border-slate-300 focus:ring-violet-500 transition-all" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <lucide-icon name="list-ordered" [size]="18" class="text-slate-400 group-hover:text-blue-500 transition-colors" [class.text-blue-500]="predictPrioridad"></lucide-icon>
                      <p class="font-bold text-slate-800">Sugerencia de Prioridad</p>
                    </div>
                    <p class="text-xs text-slate-500 leading-relaxed">Asigna un nivel de urgencia inteligente a los trámites futuros.</p>
                  </div>
                </label>
              </div>
              
              @if (errorMsg()) {
                <div class="mt-8 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-start gap-3 font-medium shadow-sm">
                  <lucide-icon name="alert-circle" [size]="20" class="mt-0.5 flex-shrink-0 text-red-500"></lucide-icon>
                  <p class="leading-relaxed">{{ errorMsg() }}</p>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="bg-white px-8 py-5 border-t border-slate-100 flex justify-between items-center shrink-0">
          <div>
             <span class="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5"><lucide-icon name="zap" [size]="14"></lucide-icon> Powered by Keras</span>
          </div>
          <div class="flex items-center gap-3">
            @if (!result()) {
              <button
                type="button"
                class="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all disabled:opacity-50"
                (click)="close.emit()"
                [disabled]="loading()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md shadow-violet-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                (click)="submit()"
                [disabled]="loading() || !hasSelection()"
              >
                @if (loading()) {
                  <lucide-icon name="loader-2" [size]="18" class="animate-spin"></lucide-icon>
                  <span>Procesando...</span>
                } @else {
                  <lucide-icon name="sparkles" [size]="18"></lucide-icon>
                  <span>Generar Informe Predictivo</span>
                }
              </button>
            } @else {
              <button
                type="button"
                class="px-6 py-2.5 text-sm font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-all disabled:opacity-50"
                (click)="resetForm()"
                [disabled]="applyingChanges()"
              >
                Nuevo Análisis
              </button>
              <button
                type="button"
                class="px-6 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
                (click)="close.emit()"
                [disabled]="applyingChanges()"
              >
                Cerrar
              </button>
              <button
                type="button"
                class="px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                (click)="aplicarCambios()"
                [disabled]="applyingChanges()"
              >
                @if (applyingChanges()) {
                  <lucide-icon name="loader-2" [size]="18" class="animate-spin"></lucide-icon>
                  <span>Aplicando...</span>
                } @else {
                  <lucide-icon name="check-circle" [size]="18"></lucide-icon>
                  <span>Aplicar Cambios</span>
                }
              </button>
            }
          </div>
        </div>
        
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent; 
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1; 
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8; 
    }
  `]
})
export class IaPrediccionesComponent {
  @Input({ required: true }) policyId!: string;
  @Input({ required: true }) policyName!: string;
  @Output() close = new EventEmitter<void>();

  private http = inject(HttpClient);

  predictMejorRuta = true;
  predictCuellosBotella = true;
  predictAnomalias = true;
  predictPrioridad = true;

  loading = signal(false);
  applyingChanges = signal(false);
  result = signal<RichPredictionResponse | null>(null);
  errorMsg = signal<string | null>(null);

  // Store what was requested to filter sections
  requestData = {
    predictMejorRuta: true,
    predictCuellosBotella: true,
    predictAnomalias: true,
    predictPrioridad: true
  };

  hasSelection(): boolean {
    return this.predictMejorRuta || this.predictCuellosBotella || this.predictAnomalias || this.predictPrioridad;
  }

  resetForm() {
    this.result.set(null);
    this.errorMsg.set(null);
  }

  submit() {
    if (!this.hasSelection()) {
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    // Save requested preferences
    this.requestData = {
      predictMejorRuta: this.predictMejorRuta,
      predictCuellosBotella: this.predictCuellosBotella,
      predictAnomalias: this.predictAnomalias,
      predictPrioridad: this.predictPrioridad
    };

    const payload = {
      politicaId: this.policyId,
      predictMejorRuta: this.predictMejorRuta,
      predictCuellosBotella: this.predictCuellosBotella,
      predictAnomalias: this.predictAnomalias,
      predictPrioridad: this.predictPrioridad
    };

    this.http.post<RichPredictionResponse>(`${API_BASE_URL}/api/predicciones/policy-analysis`, payload)
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMsg.set('Ocurrió un error al contactar al motor de IA y procesar el análisis. Asegúrate de que el backend y los servicios Python estén en ejecución.');
          this.loading.set(false);
        }
      });
  }

  aplicarCambios() {
    this.applyingChanges.set(true);
    // Simulamos la aplicación de cambios
    setTimeout(() => {
      this.applyingChanges.set(false);
      this.close.emit();
    }, 1200);
  }
}
