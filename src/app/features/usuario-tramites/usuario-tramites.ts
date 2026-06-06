import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CampoFormulario } from '../administrador/models/politica.model';
import { TramiteDisponible, UsuarioTramitesService } from './usuario-tramites.service';

type FieldValue = string | number | boolean | string[] | string[][] | Record<string, unknown> | null;

@Component({
  selector: 'app-usuario-tramites',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-tramites.html',
  styleUrl: './usuario-tramites.css',
})
export class UsuarioTramitesPage implements OnInit {
  private readonly service = inject(UsuarioTramitesService);
  private readonly router = inject(Router);

  tramites = signal<TramiteDisponible[]>([]);
  loading = signal(true);
  starting = signal(false);
  error = signal<string | null>(null);
  modalError = signal<string | null>(null);
  selected = signal<TramiteDisponible | null>(null);
  requisitos = signal<CampoFormulario[]>([]);
  respuestas: Record<string, FieldValue> = {};

  ngOnInit(): void {
    this.service.listarDisponibles().subscribe({
      next: (items) => {
        this.tramites.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los tramites disponibles.');
        this.loading.set(false);
      },
    });
  }

  iniciar(tramite: TramiteDisponible): void {
    this.error.set(null);
    this.modalError.set(null);
    if (!tramite.tieneRequisitosIniciales) {
      this.crearInstancia(tramite, {});
      return;
    }

    this.service.obtenerRequisitosIniciales(tramite.id).subscribe({
      next: (requisitos) => {
        if (!requisitos.length) {
          this.crearInstancia(tramite, {});
          return;
        }
        this.selected.set(tramite);
        this.requisitos.set(requisitos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
        this.respuestas = {};
        for (const requisito of requisitos) {
          this.respuestas[requisito.campo] = this.initialValue(requisito);
        }
      },
      error: () => this.error.set('No se pudieron cargar los requisitos iniciales.'),
    });
  }

  confirmarInicio(): void {
    const tramite = this.selected();
    if (!tramite) {
      return;
    }
    const faltantes = this.requisitos()
      .filter((item) => item.requerido && item.tipo !== 'LABEL' && !this.hasValue(this.respuestas[item.campo]))
      .map((item) => item.etiqueta || item.campo);

    if (faltantes.length) {
      this.modalError.set(`Completa los requisitos obligatorios: ${faltantes.join(', ')}`);
      return;
    }

    this.crearInstancia(tramite, this.respuestas);
  }

  cerrarModal(): void {
    this.selected.set(null);
    this.requisitos.set([]);
    this.respuestas = {};
    this.modalError.set(null);
  }

  onFileSelected(requisito: CampoFormulario, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.respuestas[requisito.campo] = file
      ? {
          nombre: file.name,
          nombreOriginal: file.name,
          tipoMime: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          fechaCarga: new Date().toISOString(),
        }
      : null;
  }

  toggleOption(requisito: CampoFormulario, option: string, checked: boolean): void {
    const current = Array.isArray(this.respuestas[requisito.campo])
      ? (this.respuestas[requisito.campo] as string[])
      : [];
    this.respuestas[requisito.campo] = checked
      ? [...current, option]
      : current.filter((item) => item !== option);
  }

  updateGridCell(requisito: CampoFormulario, rowIndex: number, colIndex: number, value: string): void {
    const grid = this.gridValue(requisito);
    grid[rowIndex][colIndex] = value;
    this.respuestas[requisito.campo] = [...grid];
  }

  gridValue(requisito: CampoFormulario): string[][] {
    const value = this.respuestas[requisito.campo];
    if (Array.isArray(value) && value.every(Array.isArray)) {
      return value as string[][];
    }
    const columns = Math.max(requisito.opciones?.length ?? 1, 1);
    const rows = Math.max(Number(requisito.placeholder ?? 3) || 3, 1);
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
  }

  private crearInstancia(tramite: TramiteDisponible, respuestas: Record<string, unknown>): void {
    this.starting.set(true);
    this.service.iniciarTramite(tramite.id, respuestas).subscribe({
      next: (response) => {
        this.starting.set(false);
        this.cerrarModal();
        if (response.instancia?.id) {
          void this.router.navigate(['/funcionario/instancias', response.instancia.id]);
        }
      },
      error: (err) => {
        this.starting.set(false);
        const message = err?.error?.message || 'No se pudo iniciar el tramite.';
        if (this.selected()) {
          this.modalError.set(message);
        } else {
          this.error.set(message);
        }
      },
    });
  }

  private initialValue(requisito: CampoFormulario): FieldValue {
    if (requisito.tipo === 'CHECKBOX') return [];
    if (requisito.tipo === 'GRID') return this.gridValue(requisito);
    if (requisito.tipo === 'BOOLEANO') return '';
    return '';
  }

  private hasValue(value: FieldValue): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some((item) => this.hasValue(item as FieldValue));
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }
}
