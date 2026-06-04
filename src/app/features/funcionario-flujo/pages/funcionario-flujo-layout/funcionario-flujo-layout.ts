import { Component, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-funcionario-flujo-layout',
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './funcionario-flujo-layout.html',
  styleUrl: './funcionario-flujo-layout.css',
})
export class FuncionarioFlujoLayoutComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly routerSubscription: Subscription;

  readonly isEditorLayout = signal(this.isEditorUrl(this.router.url));

  constructor() {
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isEditorLayout.set(this.isEditorUrl(event.urlAfterRedirects));
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }

  private isEditorUrl(url: string): boolean {
    return url.includes('/documentos-colaborativos/') && url.includes('/editar');
  }
}
