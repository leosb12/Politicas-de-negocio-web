import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CampoFormulario, TipoCampo } from '../../models/politica.model';

/** Palette entry shown in the left sidebar */
export interface PaletteFieldItem {
  tipo: TipoCampo;
  label: string;
  icon: string;
  color: string;
  bgClass: string;
}

/** Internal editable field (copy of CampoFormulario + ui id) */
export interface BuilderField extends CampoFormulario {
  _uid: string;
}

@Component({
  selector: 'app-dynamic-form-builder-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './dynamic-form-builder-modal.component.html',
  styleUrl: './dynamic-form-builder-modal.component.css',
})
export class DynamicFormBuilderModalComponent implements OnInit, OnChanges {
  /** The node's current fields — component works on a deep copy */
  @Input({ required: true }) fields: CampoFormulario[] = [];
  /** All supported field types */
  @Input({ required: true }) tipoCampoOptions: TipoCampo[] = [];
  /** Node id — passed back in the save event for convenience */
  @Input({ required: true }) nodeId!: string;
  /** Disable editing when canvas is read-only */
  @Input() readonly = false;

  /** Emits the final field array when user confirms */
  @Output() save = new EventEmitter<CampoFormulario[]>();
  /** Emits when user cancels */
  @Output() cancel = new EventEmitter<void>();
  /** Emits when user wants to edit advanced configuration for ARCHIVO/DOCUMENTO_COLABORATIVO */
  @Output() editAdvancedConfig = new EventEmitter<{ fields: CampoFormulario[]; index: number; type: TipoCampo }>();

  // ── Palette definition ──────────────────────────────────────────
  readonly palette: PaletteFieldItem[] = [
    { tipo: 'TEXTO',                  label: 'Texto',                  icon: 'type',               color: '#818cf8', bgClass: 'pal-indigo'  },
    { tipo: 'NUMERO',                 label: 'Número',                 icon: 'hash',               color: '#34d399', bgClass: 'pal-emerald' },
    { tipo: 'FECHA',                  label: 'Fecha',                  icon: 'calendar',            color: '#fbbf24', bgClass: 'pal-amber'   },
    { tipo: 'BOOLEANO',               label: 'Booleano',               icon: 'toggle-left',         color: '#60a5fa', bgClass: 'pal-blue'    },
    { tipo: 'SELECCION',              label: 'Selección',              icon: 'circle-chevron-down', color: '#a78bfa', bgClass: 'pal-violet'  },
    { tipo: 'CHECKBOX',               label: 'Checkbox',               icon: 'square-check-big',    color: '#fb923c', bgClass: 'pal-orange'  },
    { tipo: 'GRID',                   label: 'Grid / Tabla',           icon: 'grid-2x2',            color: '#22d3ee', bgClass: 'pal-cyan'    },
    { tipo: 'LABEL',                  label: 'Etiqueta',               icon: 'tag',                 color: '#94a3b8', bgClass: 'pal-slate'   },
    { tipo: 'ARCHIVO',                label: 'Archivo',                icon: 'paperclip',           color: '#f472b6', bgClass: 'pal-pink'    },
    { tipo: 'DOCUMENTO_COLABORATIVO', label: 'Doc. Colaborativo',      icon: 'file-pen',            color: '#4ade80', bgClass: 'pal-green'   },
  ];

  // ── Builder state ──────────────────────────────────────────────
  builderFields = signal<BuilderField[]>([]);

  /** Index of the field whose inline editor is open, or null */
  editingIdx = signal<number | null>(null);

  /** Error message shown at the bottom */
  validationError = signal<string | null>(null);

  // ── Drag state ─────────────────────────────────────────────────
  /** 'palette' = dragging from palette, 'canvas' = reordering */
  private dragSource: 'palette' | 'canvas' | null = null;
  private dragPaletteType: TipoCampo | null = null;
  private dragCanvasIdx: number | null = null;
  isDragOverCanvas = signal(false);
  dragOverIdx = signal<number | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    this.initFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields'] && !changes['fields'].firstChange) {
      this.initFields();
    }
  }

  private initFields(): void {
    const copy = (this.fields ?? []).map((f, i) => ({
      ...f,
      _uid: `field-${i}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    this.builderFields.set(copy);
    this.editingIdx.set(null);
    this.validationError.set(null);
  }

  // ── Helpers ────────────────────────────────────────────────────
  getPaletteItem(tipo: TipoCampo): PaletteFieldItem {
    return this.palette.find((p) => p.tipo === tipo) ?? {
      tipo,
      label: tipo,
      icon: 'circle',
      color: '#94a3b8',
      bgClass: 'pal-slate',
    };
  }

  getFieldColor(tipo: TipoCampo): string {
    return this.getPaletteItem(tipo).color;
  }

  getFieldBgClass(tipo: TipoCampo): string {
    return this.getPaletteItem(tipo).bgClass;
  }

  getFieldLabel(tipo: TipoCampo): string {
    return this.getPaletteItem(tipo).label;
  }

  getFieldIcon(tipo: TipoCampo): string {
    return this.getPaletteItem(tipo).icon;
  }

  hasOptions(tipo: TipoCampo): boolean {
    return tipo === 'SELECCION' || tipo === 'CHECKBOX' || tipo === 'GRID';
  }

  hasPlaceholder(tipo: TipoCampo): boolean {
    return tipo !== 'LABEL' && tipo !== 'GRID' && tipo !== 'CHECKBOX';
  }

  isGridType(tipo: TipoCampo): boolean {
    return tipo === 'GRID';
  }

  isSpecialType(tipo: TipoCampo): boolean {
    return tipo === 'ARCHIVO' || tipo === 'DOCUMENTO_COLABORATIVO';
  }

  // ── Palette drag-start ─────────────────────────────────────────
  onPaletteDragStart(event: DragEvent, tipo: TipoCampo): void {
    if (this.readonly) {
      event.preventDefault();
      return;
    }
    this.dragSource = 'palette';
    this.dragPaletteType = tipo;
    event.dataTransfer?.setData('text/plain', tipo);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  // ── Canvas drag-start (reorder) ────────────────────────────────
  onCanvasDragStart(event: DragEvent, idx: number): void {
    if (this.readonly) {
      event.preventDefault();
      return;
    }
    this.dragSource = 'canvas';
    this.dragCanvasIdx = idx;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  // ── Canvas dragover ────────────────────────────────────────────
  onCanvasDragOver(event: DragEvent, idx?: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = this.dragSource === 'palette' ? 'copy' : 'move';
    this.isDragOverCanvas.set(true);
    this.dragOverIdx.set(idx ?? null);
  }

  onCanvasDragLeave(event: DragEvent): void {
    // Only clear when leaving the canvas container itself
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !(event.currentTarget as HTMLElement).contains(relatedTarget)) {
      this.isDragOverCanvas.set(false);
      this.dragOverIdx.set(null);
    }
  }

  // ── Canvas drop ────────────────────────────────────────────────
  onCanvasDrop(event: DragEvent, insertAtIdx?: number): void {
    event.preventDefault();
    this.isDragOverCanvas.set(false);
    this.dragOverIdx.set(null);

    if (this.dragSource === 'palette' && this.dragPaletteType) {
      this.addFieldFromPalette(this.dragPaletteType, insertAtIdx);
    } else if (this.dragSource === 'canvas' && this.dragCanvasIdx !== null) {
      const target = insertAtIdx ?? this.builderFields().length - 1;
      if (target !== this.dragCanvasIdx) {
        this.reorderField(this.dragCanvasIdx, target);
      }
    }

    this.dragSource = null;
    this.dragPaletteType = null;
    this.dragCanvasIdx = null;
  }

  // ── Field management ───────────────────────────────────────────
  private addFieldFromPalette(tipo: TipoCampo, insertAtIdx?: number): void {
    const uid = `field-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newField: BuilderField = {
      _uid: uid,
      campo: '',
      tipo,
      etiqueta: null,
      requerido: false,
      placeholder: null,
      ayuda: null,
      orden: null,
      opciones: null,
      validaciones: null,
      configuracionDocumento: null,
    };

    this.builderFields.update((fields) => {
      const copy = [...fields];
      if (insertAtIdx !== undefined && insertAtIdx >= 0 && insertAtIdx <= copy.length) {
        copy.splice(insertAtIdx, 0, newField);
      } else {
        copy.push(newField);
      }
      return copy;
    });

    // Auto-open the new field for editing
    const newIdx = insertAtIdx !== undefined ? insertAtIdx : this.builderFields().length - 1;
    this.editingIdx.set(newIdx);
    this.validationError.set(null);
  }

  removeField(idx: number): void {
    if (this.readonly) return;
    this.builderFields.update((fields) => fields.filter((_, i) => i !== idx));
    if (this.editingIdx() === idx) {
      this.editingIdx.set(null);
    } else if (this.editingIdx() !== null && (this.editingIdx() as number) > idx) {
      this.editingIdx.update((v) => (v as number) - 1);
    }
    this.validationError.set(null);
  }

  private reorderField(fromIdx: number, toIdx: number): void {
    this.builderFields.update((fields) => {
      const copy = [...fields];
      const [moved] = copy.splice(fromIdx, 1);
      const targetIdx = toIdx > fromIdx ? toIdx - 1 : toIdx;
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  }

  moveFieldUp(idx: number): void {
    if (this.readonly || idx === 0) return;
    this.reorderField(idx, idx - 1);
    if (this.editingIdx() === idx) this.editingIdx.set(idx - 1);
  }

  moveFieldDown(idx: number): void {
    if (this.readonly || idx >= this.builderFields().length - 1) return;
    this.reorderField(idx, idx + 2);
    if (this.editingIdx() === idx) this.editingIdx.set(idx + 1);
  }

  onEditAdvancedConfig(idx: number, field: BuilderField): void {
    if (this.readonly) return;
    
    // Build the list of CampoFormulario from builderFields (omitting _uid)
    const fieldsToSave: CampoFormulario[] = this.builderFields().map((f, i) => {
      const { _uid, ...rest } = f;
      return { ...rest, orden: i };
    });

    this.editAdvancedConfig.emit({
      fields: fieldsToSave,
      index: idx,
      type: field.tipo,
    });
  }

  openEdit(idx: number): void {
    if (this.readonly) return;
    this.editingIdx.set(this.editingIdx() === idx ? null : idx);
    this.validationError.set(null);
  }

  updateField(idx: number, patch: Partial<BuilderField>): void {
    this.builderFields.update((fields) =>
      fields.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
    this.validationError.set(null);
  }

  updateFieldOpciones(idx: number, raw: string): void {
    const opciones = raw
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
    this.updateField(idx, { opciones });
  }

  getOpcionesString(idx: number): string {
    return (this.builderFields()[idx]?.opciones ?? []).join(', ');
  }

  // ── Validation ─────────────────────────────────────────────────
  private validate(): string | null {
    const fields = this.builderFields();

    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].campo.trim()) {
        return `El campo #${i + 1} no tiene nombre técnico. Asigna un nombre antes de guardar.`;
      }
    }

    const names = fields.map((f) => f.campo.trim().toLowerCase());
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) {
        return `Hay campos con el mismo nombre "${name}". Los nombres deben ser únicos.`;
      }
      seen.add(name);
    }

    return null;
  }

  // ── Save / Cancel ──────────────────────────────────────────────
  onSave(): void {
    if (this.readonly) return;

    const error = this.validate();
    if (error) {
      this.validationError.set(error);
      return;
    }

    const output: CampoFormulario[] = this.builderFields().map((f, i) => {
      const { _uid, ...rest } = f;
      return { ...rest, orden: i };
    });

    this.save.emit(output);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // ── Track by ──────────────────────────────────────────────────
  trackByUid(_: number, field: BuilderField): string {
    return field._uid;
  }
}
