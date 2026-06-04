import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ArrowUpDown, LucideAngularModule } from 'lucide-angular';

import { DashboardFuncionario } from './dashboard-funcionario';

describe('DashboardFuncionario', () => {
  let component: DashboardFuncionario;
  let fixture: ComponentFixture<DashboardFuncionario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardFuncionario, LucideAngularModule.pick({ ArrowUpDown })],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardFuncionario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
