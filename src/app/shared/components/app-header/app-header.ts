import { CommonModule } from '@angular/common';
import { DestroyRef, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';
import { LucideAngularModule, Settings2 } from 'lucide-angular';
import { Usuario } from '../../../core/auth/models/usuario.model';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = signal<Usuario | null>(this.authService.obtenerSesion());

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.session.set(this.authService.obtenerSesion());
      });
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    this.session.set(null);
    void this.router.navigate(['/login']);
  }
}
