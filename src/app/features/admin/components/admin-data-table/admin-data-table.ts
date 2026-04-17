import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-admin-data-table',
  imports: [CommonModule],
  templateUrl: './admin-data-table.html',
  styleUrl: './admin-data-table.css',
})
export class AdminDataTableComponent {
  readonly columns = input.required<string[]>();
  readonly loading = input(false);
  readonly hasData = input(false);
  readonly emptyTitle = input('Sin resultados');
  readonly emptyMessage = input('No hay informacion para mostrar.');
}
