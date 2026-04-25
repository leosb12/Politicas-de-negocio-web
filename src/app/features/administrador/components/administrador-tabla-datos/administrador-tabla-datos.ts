import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-administrador-tabla-datos',
  imports: [CommonModule],
  templateUrl: './administrador-tabla-datos.html',
  styleUrl: './administrador-tabla-datos.css',
})
export class AdministradorTablaDatosComponent {
  readonly columns = input.required<string[]>();
  readonly loading = input(false);
  readonly hasData = input(false);
  readonly emptyTitle = input('Sin resultados');
  readonly emptyMessage = input('No hay informacion para mostrar.');
}
