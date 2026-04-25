import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

type AnaliticasKpiTono =
  | 'slate'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'violet';

@Component({
  selector: 'app-analiticas-kpi-tarjeta',
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analiticas-kpi-tarjeta.html',
  styleUrl: './analiticas-kpi-tarjeta.css',
})
export class AnaliticasKpiTarjetaComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly icon = input<string>('circle-dot');
  readonly tone = input<AnaliticasKpiTono>('slate');
  readonly chip = input<string | null>(null);
  readonly progress = input<number | null>(null);

  readonly toneClasses = computed(() => {
    const classes: Record<AnaliticasKpiTono, string> = {
      slate: 'analiticas-kpi-tarjeta--slate',
      emerald: 'analiticas-kpi-tarjeta--emerald',
      sky: 'analiticas-kpi-tarjeta--sky',
      amber: 'analiticas-kpi-tarjeta--amber',
      rose: 'analiticas-kpi-tarjeta--rose',
      violet: 'analiticas-kpi-tarjeta--violet',
    };

    return classes[this.tone()];
  });
}
