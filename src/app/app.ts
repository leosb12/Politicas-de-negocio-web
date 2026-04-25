import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastComponent } from './shared/ui/ui-toast/ui-toast';
import { AdministradorGuiaBotComponent } from './features/administrador/components/administrador-guia-bot/administrador-guia-bot';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastComponent, AdministradorGuiaBotComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('politicas-negocio-web');
}
