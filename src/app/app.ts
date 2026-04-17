import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastComponent } from './shared/components/ui-toast/ui-toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('politicas-negocio-web');
}
