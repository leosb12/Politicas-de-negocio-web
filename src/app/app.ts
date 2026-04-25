import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastComponent } from './shared/ui/ui-toast/ui-toast';
import { AdminGuideBotComponent } from './features/admin/components/admin-guide-bot/admin-guide-bot';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastComponent, AdminGuideBotComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('politicas-negocio-web');
}
