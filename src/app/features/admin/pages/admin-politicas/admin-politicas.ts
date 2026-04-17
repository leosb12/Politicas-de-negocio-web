import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PoliticaService } from '../../services/politica.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { PoliticaNegocio, EstadoPolitica, CreatePoliticaRequest } from '../../models/politica.model';

import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-politicas',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-politicas.html',
  styleUrl: './admin-politicas.css',
})
export class AdminPoliticasPageComponent implements OnInit {
  private readonly svc = inject(PoliticaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  politicas = signal<PoliticaNegocio[]>([]);
  loading = signal(false);
  showModal = signal(false);
  saving = signal(false);
  search = signal('');

  // New policy form
  form = { nombre: '', descripcion: '' };

  filteredPoliticas = computed(() => {
    const q = this.search().toLowerCase();
    return this.politicas().filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q)
    );
  });

  countEstado(estado: EstadoPolitica): number {
    return this.politicas().filter((p) => p.estado === estado).length;
  }

  ngOnInit(): void {
    this.loadPoliticas();
  }

  loadPoliticas(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (data) => {
        this.politicas.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar las políticas');
        this.loading.set(false);
      },
    });
  }

  openModal(): void {
    this.form = { nombre: '', descripcion: '' };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  createPolitica(): void {
    if (!this.form.nombre.trim()) {
      this.toast.error('Validación', 'El nombre es obligatorio');
      return;
    }
    this.saving.set(true);
    const payload: CreatePoliticaRequest = {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion.trim(),
    };
    this.svc.create(payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeModal();
        this.toast.success('¡Creada!', `Política "${created.nombre}" lista para diseñar`);
        this.router.navigate(['/admin/politicas', created.id, 'canvas']);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'No se pudo crear la política');
      },
    });
  }

  openCanvas(id: string): void {
    this.router.navigate(['/admin/politicas', id, 'canvas']);
  }

  getEstadoClass(estado: EstadoPolitica): string {
    const map: Record<EstadoPolitica, string> = {
      BORRADOR: 'estado-borrador',
      ACTIVA: 'estado-activa',
      PAUSADA: 'estado-pausada',
    };
    return map[estado] ?? '';
  }

  getEstadoLabel(estado: EstadoPolitica): string {
    const map: Record<EstadoPolitica, string> = {
      BORRADOR: 'Borrador',
      ACTIVA: 'Activa',
      PAUSADA: 'Pausada',
    };
    return map[estado] ?? estado;
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  trackById(_: number, p: PoliticaNegocio): string {
    return p.id;
  }
}
