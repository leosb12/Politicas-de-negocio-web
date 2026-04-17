import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.html',
  styleUrl: './loader.css',
})
export class LoaderComponent {
  readonly message = input('Cargando...');
}
