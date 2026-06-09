import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BloqueReporte } from '../../../../../services/reportes-dinamicos.service';
import * as echarts from 'echarts';

@Component({
  selector: 'app-grafico-dinamico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grafico-dinamico.component.html',
  styleUrls: ['./grafico-dinamico.component.css']
})
export class GraficoDinamicoComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() bloque!: BloqueReporte;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;

  private chartInstance: echarts.ECharts | null = null;
  private resizeListener?: () => void;

  ngAfterViewInit() {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['bloque'] && !changes['bloque'].isFirstChange()) {
      this.updateChart();
    }
  }

  ngOnDestroy() {
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private initChart() {
    if (!this.chartContainer) return;

    // Disponer instancia anterior si existe
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }

    this.chartInstance = echarts.init(this.chartContainer.nativeElement);
    this.updateChart();

    // Responsividad automática al cambiar el tamaño de ventana
    this.resizeListener = () => {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  private updateChart() {
    if (!this.chartInstance || !this.bloque) return;

    const dataset = this.bloque.datos || this.bloque.dataset;
    if (!dataset) return;

    const labels = dataset.labels || [];
    const values = dataset.values || [];

    // Opciones generales para el tema oscuro premium
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: this.bloque.tipo === 'pie' || this.bloque.tipo === 'doughnut' ? 'item' : 'axis',
        formatter: (params: any) => {
          if (Array.isArray(params)) {
            let res = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].name}</div>`;
            params.forEach(p => {
              res += `<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 13px;">
                <span>${p.seriesName || 'Valor'}:</span>
                <span style="font-weight: 600;">${this.formatearTooltipValue(p.value)}</span>
              </div>`;
            });
            return res;
          } else {
            return `<div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 13px;">
              <span>${params.seriesName || 'Valor'}:</span>
              <span style="font-weight: 600;">${this.formatearTooltipValue(params.value)}</span>
            </div>`;
          }
        },
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f8fafc' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      }
    };

    // Estructuras de series según tipo de gráfico
    if (this.bloque.tipo === 'bar') {
      option.xAxis = {
        type: 'category',
        data: labels,
        axisLabel: { color: '#94a3b8', interval: 0, rotate: labels.length > 5 ? 30 : 0 },
        axisLine: { lineStyle: { color: '#334155' } }
      };
      option.yAxis = {
        type: 'value',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } }
      };
      option.series = [{
        name: this.bloque.titulo,
        type: 'bar',
        data: values,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#818cf8' },
            { offset: 1, color: '#4f46e5' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      }];
    } else if (this.bloque.tipo === 'line' || this.bloque.tipo === 'area') {
      option.xAxis = {
        type: 'category',
        data: labels,
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#334155' } }
      };
      option.yAxis = {
        type: 'value',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } }
      };
      option.series = [{
        name: this.bloque.titulo,
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: '#a78bfa' },
        lineStyle: { width: 3, color: '#7c3aed' },
        areaStyle: this.bloque.tipo === 'area' ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(124, 58, 237, 0.4)' },
            { offset: 1, color: 'rgba(124, 58, 237, 0.05)' }
          ])
        } : undefined
      }];
    } else if (this.bloque.tipo === 'pie' || this.bloque.tipo === 'doughnut') {
      const isDoughnut = this.bloque.tipo === 'doughnut';
      option.legend = {
        orient: 'horizontal',
        bottom: '0',
        textStyle: { color: '#94a3b8' }
      };
      option.series = [{
        name: this.bloque.titulo,
        type: 'pie',
        radius: isDoughnut ? ['40%', '70%'] : '65%',
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#1e293b',
          borderWidth: 2
        },
        label: {
          show: true,
          color: '#cbd5e1',
          formatter: '{b}: {c}'
        },
        data: labels.map((l: string, index: number) => ({
          name: l,
          value: values[index] || 0
        }))
      }];
    }

    this.chartInstance.setOption(option);
  }

  private formatearTooltipValue(val: any): string {
    if (typeof val === 'number') {
      if (this.bloque.titulo.toLowerCase().includes('pago') || this.bloque.titulo.toLowerCase().includes('recauda')) {
        return '$' + val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return val.toLocaleString('es-ES');
    }
    return String(val);
  }
}
