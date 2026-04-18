import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { LoaderComponent } from '../loader/loader';
import { AppCardComponent } from '../../ui/card/card';
import { AppTableComponent } from '../../ui/table/table';

@Component({
  selector: 'app-data-table',
  imports: [
    CommonModule,
    LoaderComponent,
    EmptyStateComponent,
    AppCardComponent,
    AppTableComponent,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTableComponent {
  readonly columns = input.required<string[]>();
  readonly loading = input(false);
  readonly hasData = input(false);
  readonly loadingMessage = input('Cargando informacion...');
  readonly emptyTitle = input('Sin resultados');
  readonly emptyMessage = input('No hay informacion para mostrar.');
  readonly emptyActionLabel = input<string | null>(null);

  readonly emptyAction = output<void>();

  onEmptyAction(): void {
    this.emptyAction.emit();
  }
}
