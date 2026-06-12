import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesDinamicosService, ReporteVisualResponse } from '../../../services/reportes-dinamicos.service';
import { OfflineStatusService } from '../../../../../core/offline/offline-status.service';
import { BrowserSimpleOfflineReportService } from '../../../../../core/offline';
import { BloqueReporteComponent } from './components/bloque-reporte/bloque-reporte.component';
import { AdministradorGuiaContextService } from '../../../services/administrador-guia-context.service';
import { AdministradorAnaliticasService } from '../../../services/administrador-analiticas.service';
import { jsPDF } from 'jspdf';
import * as echarts from 'echarts';
import pptxgen from 'pptxgenjs';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-reportes-inteligentes',
  standalone: true,
  imports: [CommonModule, FormsModule, BloqueReporteComponent],
  templateUrl: './reportes-inteligentes.component.html',
  styleUrls: ['./reportes-inteligentes.component.css']
})
export class ReportesInteligentesComponent implements OnInit, OnDestroy {
  private reportesService = inject(ReportesDinamicosService);
  private analiticasService = inject(AdministradorAnaliticasService);
  private offlineStatusService = inject(OfflineStatusService);
  private browserOfflineReportService = inject(BrowserSimpleOfflineReportService);
  private guideContext = inject(AdministradorGuiaContextService, { optional: true });

  constructor() {
    effect(() => {
      if (this.offlineStatusService.isOnline()) {
        this.isBrowserSimpleFallbackActive.set(false);
      }
    });
  }

  ngOnInit(): void {
    if (this.guideContext) {
      this.guideContext.setScreen('ADMIN_REPORTS');
      this.guideContext.currentPath.set('/admin/reportes-inteligentes');
      this.guideContext.currentModule.set('Reportes Inteligentes');
      this.guideContext.visibleButtons.set(['Generar Reporte', 'Limpiar', 'IA+']);
      this.guideContext.exportFormatsAvailable.set(['pantalla', 'pdf', 'excel', 'word', 'powerpoint']);
      this.guideContext.availableActions.set([
        'GENERAR_REPORTE',
        'LIMPIAR_PROMPT',
        'ACTIVAR_IA_PLUS',
        'SELECCIONAR_FORMATO',
        'EXPORTAR_REPORTE'
      ]);
    }
  }

  ngOnDestroy(): void {
    if (this.guideContext) {
      this.guideContext.clearDesignerContext();
    }
    this.detenerDictado();
  }

  promptText = signal('');
  isDictating = signal(false);
  recognition: any = null;

  isProcessing = signal(false);
  reporte = signal<ReporteVisualResponse | null>(null);
  errorMessage = signal<string | null>(null);
  iaPlus = signal(false);
  showFormatModal = signal(false);
  isOfflineReport = signal(false);

  // Estados para exportación offscreen
  isExporting = signal(false);
  exportReporte = signal<ReporteVisualResponse | null>(null);

  isBrowserSimpleFallbackActive = signal(false);

  sugerencias = [
    "Quiero un gráfico de barras con los funcionarios más activos, abajo una torta con los usuarios que más inician políticas y debajo una tabla con las politicas mas usadas. en pantalla",
    "Hazme un dashboard con un KPI de total de trámites, una línea de trámites por mes y una dona de políticas por estado.",
    "Quiero una matriz de funcionarios y cantidad de trámites finalizados por cada uno.",
    "Genera un dashboard con los funcionarios más activos, las políticas más utilizadas y la distribución de trámites por estado durante este mes, en pantalla."
  ];

  generarReporte() {
    const text = this.promptText().trim();
    if (!text) return;

    // Verificar si el prompt ya incluye alguno de los formatos o extensiones
    const promptLower = text.toLowerCase();
    const keywords = [
      'excel', 'xlsx', 'xls', 'csv', 'planilla', 'hoja de cálculo', 'hoja de calculo',
      'pdf',
      'word', 'docx', 'doc', 'documento',
      'pantalla', 'visor', 'on-screen', 'onscreen',
      'powerpoint', 'power point', 'pptx', 'ppt', 'presentación', 'presentacion'
    ];
    const hasFormat = keywords.some(keyword => promptLower.includes(keyword));

    if (!hasFormat) {
      this.showFormatModal.set(true);
      return;
    }

    this.ejecutarGeneracionReporte();
  }

  ejecutarGeneracionReporte() {
    const promptVal = this.promptText().trim();
    if (!promptVal) return;

    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.reporte.set(null);

    // Detectar el formato objetivo del prompt
    const promptLower = promptVal.toLowerCase();
    let targetFormat = 'pantalla';
    if (
      promptLower.includes('excel') ||
      promptLower.includes('xlsx') ||
      promptLower.includes('xls') ||
      promptLower.includes('csv') ||
      promptLower.includes('planilla') ||
      promptLower.includes('cálculo') ||
      promptLower.includes('calculo')
    ) {
      targetFormat = 'excel';
    } else if (promptLower.includes('pdf')) {
      targetFormat = 'pdf';
    } else if (
      promptLower.includes('word') ||
      promptLower.includes('docx') ||
      promptLower.includes('doc') ||
      promptLower.includes('documento')
    ) {
      targetFormat = 'word';
    } else if (
      promptLower.includes('powerpoint') ||
      promptLower.includes('power point') ||
      promptLower.includes('pptx') ||
      promptLower.includes('ppt') ||
      promptLower.includes('presentación') ||
      promptLower.includes('presentacion')
    ) {
      targetFormat = 'powerpoint';
    }

    const isOffline = this.offlineStatusService.isOffline();

    const requestObservable = isOffline
      ? this.reportesService.generarReporteVisualOffline({ prompt: promptVal, iaPlus: this.iaPlus() })
      : this.reportesService.generarReporteVisual({ prompt: promptVal, iaPlus: this.iaPlus() });

    requestObservable.subscribe({
      next: (res: ReporteVisualResponse) => {
        this.isOfflineReport.set(isOffline);
        this.isBrowserSimpleFallbackActive.set(false);
        
        let finalReport = res;
        if (isOffline) {
          finalReport = {
            ...res,
            offlineMessage: 'Reporte generado en modo offline usando ia-deep-learning local.'
          };
        }

        if (targetFormat === 'pantalla') {
          this.reporte.set(finalReport);
          this.isProcessing.set(false);
          this.analiticasService.logSystemAudit('GENERACION_REPORTE', 'Generó reporte inteligente en formato Pantalla').subscribe();
        } else {
          // Iniciar proceso de exportación oculta
          this.exportReporte.set(finalReport);
          this.isExporting.set(true);

          // Esperar renderizado de ECharts
          setTimeout(() => {
            this.procesarExportacion(finalReport, targetFormat);
          }, 1200);
        }
      },
      error: (err: any) => {
        console.error('Error capturado en generarReporteVisual:', err);
        console.log('error.status:', err?.status);
        console.log('error.message:', err?.message);
        console.log('error.error:', err?.error);
        console.log('error.url:', err?.url);

        const usarFallback = this.debeUsarFallbackNavegador(err, isOffline ? 'offline-reportes' : 'online-reportes');
        console.log('¿Entrando a fallback navegador?', usarFallback);
        
        if (usarFallback) {
          console.warn('FALLBACK_NAVEGADOR_ACTIVADO: El backend o ia-deep-learning fallaron. Iniciando generador local.');
          this.isBrowserSimpleFallbackActive.set(true);
          this.ejecutarGeneracionFallbackLocal(promptVal, targetFormat);
        } else {
          let msg = "Ocurrió un error al generar el reporte visual inteligente. Por favor, intente de nuevo.";
          if (err && err.error && err.error.message) {
            msg = err.error.message;
          } else if (err && err.message) {
            msg = err.message;
          }
          this.errorMessage.set(msg);
          this.isProcessing.set(false);
        }
      }
    });
  }

  private debeUsarFallbackNavegador(error: any, contexto?: 'offline-reportes' | 'online-reportes'): boolean {
    const status = error?.status;
    const url = String(error?.url || '');
    const message = String(error?.message || '');
    const code = error?.error?.code || error?.error?.codigo || error?.error?.errorCode;
    
    let bodyText = '';
    if (error?.error) {
      bodyText = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
    }

    const esEndpointOfflineReportes =
      url.includes('/api/admin/reportes-visuales/generar-offline')
      || contexto === 'offline-reportes';

    return status === 0
        || status === 503
        || code === 'LOCAL_IA_UNAVAILABLE'
        || code === 'IA_DEEP_LEARNING_UNAVAILABLE'
        || code === 'SERVICE_UNAVAILABLE'
        || message.includes('Unknown Error')
        || message.includes('Network Error')
        || bodyText.includes('LOCAL_IA_UNAVAILABLE')
        || bodyText.includes('IA_DEEP_LEARNING_UNAVAILABLE')
        || bodyText.includes('SERVICE_UNAVAILABLE')
        || (esEndpointOfflineReportes && status === 500);
  }

  private ejecutarGeneracionFallbackLocal(promptVal: string, targetFormat: string) {
    this.browserOfflineReportService.generarReporteBrowserSimple(promptVal)
      .then((res: ReporteVisualResponse) => {
        res.offlineMessage = 'ia-deep-learning no está disponible. Reporte generado localmente con datos cacheados.';
        this.isOfflineReport.set(true);
        this.errorMessage.set(null); // Limpiar error rojo anterior si existía
        if (targetFormat === 'pantalla') {
          this.reporte.set(res);
          this.isProcessing.set(false);
          this.analiticasService.logSystemAudit('GENERACION_REPORTE', 'Generó reporte inteligente local de fallback en formato Pantalla').subscribe({
            error: () => { }
          });
        } else {
          this.exportReporte.set(res);
          this.isExporting.set(true);
          setTimeout(() => {
            this.procesarExportacion(res, targetFormat);
          }, 1200);
        }
      })
      .catch((fallbackErr: any) => {
        console.error(fallbackErr);
        this.errorMessage.set(fallbackErr.message || "No hay datos offline suficientes para generar este reporte simple.");
        this.isProcessing.set(false);
      });
  }

  procesarExportacion(reporte: ReporteVisualResponse, formato: string) {
    try {
      // Capturar imágenes de gráficos ECharts en el contenedor offscreen
      const chartContainers = document.querySelectorAll('#offscreen-export-container .chart-element');
      const chartImages: { [blockId: string]: string } = {};

      chartContainers.forEach((el) => {
        const blockWrapper = el.closest('.block-wrapper');
        if (blockWrapper) {
          const idAttr = blockWrapper.getAttribute('id') || '';
          const blockId = idAttr.replace('export-block-', '');
          const chartInstance = echarts.getInstanceByDom(el as HTMLDivElement);
          if (chartInstance) {
            const imgUrl = chartInstance.getDataURL({
              type: 'png',
              pixelRatio: 2,
              backgroundColor: '#1e293b'
            });
            chartImages[blockId] = imgUrl;
          }
        }
      });

      if (formato === 'pdf') {
        this.exportarAPdf(reporte, chartImages);
      } else if (formato === 'excel') {
        this.exportarAExcel(reporte, chartImages);
      } else if (formato === 'word') {
        this.exportarAWord(reporte, chartImages);
      } else if (formato === 'powerpoint') {
        this.exportarAPowerPoint(reporte, chartImages);
      }

      this.analiticasService.logSystemAudit('DESCARGA_REPORTE', `Descargó reporte inteligente en formato ${formato.toUpperCase()}`).subscribe();
    } catch (err) {
      console.error('Error durante la exportación:', err);
      this.errorMessage.set("Ocurrió un error al exportar el reporte. Por favor, intente de nuevo.");
    } finally {
      this.exportReporte.set(null);
      this.isExporting.set(false);
      this.isProcessing.set(false);
    }
  }

  exportarAPdf(reporte: ReporteVisualResponse, chartImages: { [key: string]: string }) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 20;

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }
    };

    // Diseño de cabecera / fondo oscuro premium para la primera página
    doc.setFillColor(30, 41, 59); // #1e293b
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Decoración de cabecera
    doc.setFillColor(79, 70, 229); // #4f46e5
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("REPORTES INTELIGENTES VISUALES", 20, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(224, 231, 255);
    doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 32);

    currentY = 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    const titleLines = doc.splitTextToSize(reporte.titulo || 'Reporte Inteligente Personalizado', pageWidth - 40);
    doc.text(titleLines, 20, currentY);
    currentY += titleLines.length * 8 + 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184); // #94a3b8
    const descLines = doc.splitTextToSize(reporte.descripcion || 'Reporte generado según instrucción natural.', pageWidth - 40);
    doc.text(descLines, 20, currentY);
    currentY += descLines.length * 6 + 15;

    reporte.bloques.forEach((bloque) => {
      const isChart = ['bar', 'pie', 'doughnut', 'line', 'area'].includes(bloque.tipo);
      const isTable = ['table', 'matrix'].includes(bloque.tipo);
      const isKpi = bloque.tipo === 'kpi';

      if (isKpi) {
        checkPageBreak(35);

        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(20, currentY, pageWidth - 40, 28, 'F');
        doc.setDrawColor(71, 85, 105);
        doc.rect(20, currentY, pageWidth - 40, 28, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(bloque.titulo.toUpperCase(), 25, currentY + 8);

        const data = bloque.datos || bloque.dataset;
        const valStr = data && data.values && data.values.length > 0 ? String(data.values[0]) : '0';
        const labelStr = data && data.labels && data.labels.length > 0 ? String(data.labels[0]) : 'Total';

        doc.setFontSize(16);
        doc.setTextColor(99, 102, 241);
        doc.text(`${labelStr}: ${valStr}`, 25, currentY + 18);

        currentY += 35;
      } else if (isChart) {
        checkPageBreak(115);

        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(20, currentY, pageWidth - 40, 105, 'F');
        doc.setDrawColor(71, 85, 105);
        doc.rect(20, currentY, pageWidth - 40, 105, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(bloque.titulo, 25, currentY + 8);

        const imgData = chartImages[bloque.id];
        if (imgData) {
          doc.addImage(imgData, 'PNG', 25, currentY + 12, pageWidth - 50, 85);
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(148, 163, 184);
          doc.text("[Gráfico no disponible en la exportación]", 30, currentY + 50);
        }

        currentY += 115;
      } else if (isTable) {
        const dataset = bloque.datos || bloque.dataset;
        if (dataset && dataset.columns && dataset.rows) {
          const rowCount = dataset.rows.length;
          const tableHeight = 15 + rowCount * 8 + 12;
          checkPageBreak(tableHeight);

          doc.setFillColor(15, 23, 42); // #0f172a
          doc.rect(20, currentY, pageWidth - 40, tableHeight - 5, 'F');
          doc.setDrawColor(71, 85, 105);
          doc.rect(20, currentY, pageWidth - 40, tableHeight - 5, 'D');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(255, 255, 255);
          doc.text(bloque.titulo, 25, currentY + 8);

          const cols = dataset.columns;
          const rows = dataset.rows;
          const colWidth = (pageWidth - 50) / cols.length;
          let tableY = currentY + 15;

          doc.setFontSize(9);
          doc.setTextColor(129, 140, 248);
          cols.forEach((col, idx) => {
            doc.text(col, 25 + idx * colWidth, tableY);
          });

          doc.setDrawColor(51, 65, 85);
          doc.line(25, tableY + 2, pageWidth - 25, tableY + 2);
          tableY += 8;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(241, 245, 249);
          rows.forEach((row) => {
            row.forEach((cell, idx) => {
              doc.text(String(cell), 25 + idx * colWidth, tableY);
            });
            tableY += 7;
          });

          currentY += tableHeight;
        }
      }
    });

    doc.save(`reporte_visual_${new Date().getTime()}.pdf`);
  }

  async exportarAExcel(reporte: ReporteVisualResponse, chartImages: { [key: string]: string }) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    // Estilos generales
    const fontTitle = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF4F46E5' } };
    const fontDesc = { name: 'Arial', size: 11, color: { argb: 'FF64748B' } };
    const fontSection = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    const fontBold = { name: 'Arial', size: 10, bold: true };
    const fontNormal = { name: 'Arial', size: 10 };

    // Título principal
    const rowTitle = worksheet.addRow([reporte.titulo]);
    rowTitle.getCell(1).font = fontTitle;

    const rowDesc = worksheet.addRow([reporte.descripcion]);
    rowDesc.getCell(1).font = fontDesc;

    const rowDate = worksheet.addRow([`Generado el: ${new Date().toLocaleString('es-ES')}`]);
    rowDate.getCell(1).font = fontDesc;

    worksheet.addRow([]); // Fila vacía
    worksheet.addRow([]); // Fila vacía

    let currentRow = 6;

    // Procesar bloques
    for (const bloque of reporte.bloques) {
      const isChart = ['bar', 'pie', 'doughnut', 'line', 'area'].includes(bloque.tipo);
      const isTable = ['table', 'matrix'].includes(bloque.tipo);
      const isKpi = bloque.tipo === 'kpi';

      // Título de la sección
      const sectionRow = worksheet.addRow([bloque.titulo]);
      sectionRow.getCell(1).font = fontSection;

      // Aplicar color de fondo gris claro al título de sección
      sectionRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };

      currentRow++;
      worksheet.addRow([]); // Espacio vacío
      currentRow++;

      if (isKpi) {
        const data = bloque.datos || bloque.dataset;
        const valStr = data && data.values && data.values.length > 0 ? String(data.values[0]) : '0';
        const labelStr = data && data.labels && data.labels.length > 0 ? String(data.labels[0]) : 'Total';

        const rowKpiLabel = worksheet.addRow([labelStr.toUpperCase(), valStr]);
        rowKpiLabel.getCell(1).font = fontBold;
        rowKpiLabel.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF6366F1' } };

        currentRow++;
        worksheet.addRow([]); // Espacio vacío
        currentRow++;
      } else if (isChart) {
        const imgData = chartImages[bloque.id];
        if (imgData) {
          // Extraer los datos base64 quitando el prefijo
          const base64Data = imgData.split(',')[1];
          try {
            const imageId = workbook.addImage({
              base64: base64Data,
              extension: 'png'
            });

            // Añadir la imagen abarcando de la columna A a la columna G
            // y desde la fila actual hasta 14 filas más abajo
            worksheet.addImage(imageId, `A${currentRow}:G${currentRow + 13}`);

            // Avanzar el contador de filas de la planilla
            currentRow += 15;
            // Insertar filas vacías para empujar el cursor de la hoja de cálculo
            for (let i = 0; i < 15; i++) {
              worksheet.addRow([]);
            }
          } catch (e) {
            console.error('Error al insertar imagen en excel:', e);
            const rowErr = worksheet.addRow(['[No se pudo renderizar la imagen del gráfico]']);
            rowErr.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' } };
            currentRow++;
          }
        }

        // Renderizar la tabla de datos del gráfico abajo
        const dataset = bloque.datos || bloque.dataset;
        if (dataset && dataset.labels && dataset.values) {
          const headerRow = worksheet.addRow(['Categoría', 'Valor']);
          headerRow.getCell(1).font = fontBold;
          headerRow.getCell(2).font = fontBold;

          headerRow.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
          };
          headerRow.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
          };

          currentRow++;

          dataset.labels.forEach((label, idx) => {
            const val = dataset.values[idx] || 0;
            const dataRow = worksheet.addRow([label, val]);
            dataRow.getCell(1).font = fontNormal;
            dataRow.getCell(2).font = fontNormal;
            currentRow++;
          });
        }

        worksheet.addRow([]);
        currentRow++;
      } else if (isTable) {
        const dataset = bloque.datos || bloque.dataset;
        if (dataset && dataset.columns && dataset.rows) {
          const headerRow = worksheet.addRow(dataset.columns);
          headerRow.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF4F46E5' } // Color violeta de la marca
            };
          });
          currentRow++;

          dataset.rows.forEach((row) => {
            const dataRow = worksheet.addRow(row.map(cell => String(cell)));
            dataRow.eachCell((cell) => {
              cell.font = fontNormal;
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
              };
            });
            currentRow++;
          });
        }
        worksheet.addRow([]);
        currentRow++;
      }
    }

    // Autoajustar anchos de columnas
    worksheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.((cell) => {
        const columnLength = cell.value ? String(cell.value).length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength + 2;
    });

    // Escribir el buffer del workbook y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    this.descargarArchivo(blob, `reporte_excel_${new Date().getTime()}.xlsx`);
  }

  exportarAWord(reporte: ReporteVisualResponse, chartImages: { [key: string]: string }) {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${reporte.titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #333333; line-height: 1.6; }
          h1 { font-size: 24pt; color: #4f46e5; margin-bottom: 5px; }
          .desc { font-size: 11pt; color: #64748b; margin-bottom: 25px; }
          .date { font-size: 9pt; color: #94a3b8; margin-bottom: 40px; }
          .section-card { border: 1pt solid #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 30px; background-color: #f8fafc; }
          .section-title { font-size: 14pt; font-weight: bold; color: #1e293b; border-bottom: 2pt solid #6366f1; padding-bottom: 5px; margin-top: 25px; margin-bottom: 15px; }
          .kpi-label { font-size: 10pt; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 20pt; font-weight: bold; color: #4f46e5; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
          th { background-color: #f1f5f9; color: #475569; font-weight: bold; text-align: left; padding: 8px; border: 1pt solid #cbd5e1; }
          td { padding: 8px; border: 1pt solid #cbd5e1; font-size: 10pt; }
          .chart-image { text-align: center; margin-top: 15px; }
          .chart-image img { max-width: 100%; height: auto; border: 1pt solid #e2e8f0; }
        </style>
      </head>
      <body>
        <h1>${reporte.titulo}</h1>
         <p class="desc">${reporte.descripcion}</p>
         <p class="date">Generado el: ${new Date().toLocaleString('es-ES')}</p>
    `;

    reporte.bloques.forEach((bloque) => {
      const isChart = ['bar', 'pie', 'doughnut', 'line', 'area'].includes(bloque.tipo);
      const isTable = ['table', 'matrix'].includes(bloque.tipo);
      const isKpi = bloque.tipo === 'kpi';

      html += `<div class="section-title">${bloque.titulo}</div>`;

      if (isKpi) {
        const data = bloque.datos || bloque.dataset;
        const valStr = data && data.values && data.values.length > 0 ? String(data.values[0]) : '0';
        const labelStr = data && data.labels && data.labels.length > 0 ? String(data.labels[0]) : 'Total';
        html += `
          <div class="section-card">
            <div class="kpi-label">${labelStr}</div>
            <div class="kpi-val">${valStr}</div>
          </div>
        `;
      } else if (isChart) {
        const imgData = chartImages[bloque.id];
        if (imgData) {
          html += `
            <div class="chart-image">
              <img src="${imgData}" width="650" alt="${bloque.titulo}">
            </div>
          `;
        } else {
          html += `<p style="font-style: italic; color: #94a3b8;">[Imagen de gráfico no disponible]</p>`;
        }
      } else if (isTable) {
        const dataset = bloque.datos || bloque.dataset;
        if (dataset && dataset.columns && dataset.rows) {
          html += '<table><thead><tr>';
          dataset.columns.forEach((col) => {
            html += `<th>${col}</th>`;
          });
          html += '</tr></thead><tbody>';

          dataset.rows.forEach((row) => {
            html += '<tr>';
            row.forEach((cell) => {
              html += `<td>${cell}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }
    });

    html += `
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    this.descargarArchivo(blob, `reporte_word_${new Date().getTime()}.doc`);
  }

  exportarAPowerPoint(reporte: ReporteVisualResponse, chartImages: { [key: string]: string }) {
    const PptxGen = (pptxgen as any).default || pptxgen;
    const pptx = new PptxGen();
    pptx.layout = 'LAYOUT_16x9';

    const bgDark = '1e293b';
    const bgNavy = '0f172a';
    const textWhite = 'ffffff';
    const textMuted = '94a3b8';
    const brandColor = '6366f1';

    // Slide 1: Cover Slide
    const slideCover = pptx.addSlide();
    slideCover.background = { fill: bgDark };

    slideCover.addText(reporte.titulo || 'Reporte Inteligente Personalizado', {
      x: 0.5,
      y: 1.5,
      w: 9.0,
      h: 1.2,
      fontSize: 28,
      bold: true,
      color: textWhite,
      fontFace: 'Arial'
    });

    slideCover.addText(reporte.descripcion || 'Reporte generado según instrucción natural.', {
      x: 0.5,
      y: 2.8,
      w: 9.0,
      h: 1.2,
      fontSize: 13,
      color: textMuted,
      fontFace: 'Arial'
    });

    slideCover.addText(`Generado el: ${new Date().toLocaleString('es-ES')}`, {
      x: 0.5,
      y: 4.5,
      w: 6.0,
      h: 0.4,
      fontSize: 10,
      color: textMuted,
      fontFace: 'Arial'
    });

    // Slides per block
    reporte.bloques.forEach((bloque) => {
      const isChart = ['bar', 'pie', 'doughnut', 'line', 'area'].includes(bloque.tipo);
      const isTable = ['table', 'matrix'].includes(bloque.tipo);
      const isKpi = bloque.tipo === 'kpi';

      const slide = pptx.addSlide();
      slide.background = { fill: bgDark };

      // Header title
      slide.addText(bloque.titulo, {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.6,
        fontSize: 18,
        bold: true,
        color: textWhite,
        fontFace: 'Arial'
      });

      if (isKpi) {
        const data = bloque.datos || bloque.dataset;
        const valStr = data && data.values && data.values.length > 0 ? String(data.values[0]) : '0';
        const labelStr = data && data.labels && data.labels.length > 0 ? String(data.labels[0]) : 'Total';

        slide.addText(labelStr.toUpperCase(), {
          x: 0.5,
          y: 1.8,
          w: 9.0,
          h: 0.5,
          fontSize: 14,
          color: textMuted,
          bold: true,
          align: 'center',
          fontFace: 'Arial'
        });

        slide.addText(valStr, {
          x: 0.5,
          y: 2.5,
          w: 9.0,
          h: 1.5,
          fontSize: 50,
          color: brandColor,
          bold: true,
          align: 'center',
          fontFace: 'Arial'
        });
      } else if (isChart) {
        const imgData = chartImages[bloque.id];
        if (imgData) {
          slide.addImage({
            data: imgData,
            x: 0.5,
            y: 1.1,
            w: 9.0,
            h: 4.0
          });
        } else {
          slide.addText("[Imagen de gráfico no disponible]", {
            x: 0.5,
            y: 2.5,
            w: 9.0,
            h: 0.8,
            fontSize: 14,
            color: textMuted,
            italic: true,
            align: 'center'
          });
        }
      } else if (isTable) {
        const dataset = bloque.datos || bloque.dataset;
        if (dataset && dataset.columns && dataset.rows) {
          const tableRows: any[] = [];

          const headerRow = dataset.columns.map((col) => ({
            text: col,
            options: { fill: { color: brandColor }, color: textWhite, bold: true, fontSize: 10, align: 'left' }
          }));
          tableRows.push(headerRow);

          dataset.rows.forEach((row) => {
            const dataRow = row.map((cell) => ({
              text: String(cell),
              options: { color: textWhite, fontSize: 9, fill: { color: bgNavy } }
            }));
            tableRows.push(dataRow);
          });

          slide.addTable(tableRows, {
            x: 0.5,
            y: 1.2,
            w: 9.0,
            rowH: 0.3,
            border: { type: 'solid', color: '475569', pt: 1 }
          });
        }
      }
    });

    pptx.writeFile({ fileName: `reporte_presentacion_${new Date().getTime()}.pptx` });
  }

  descargarArchivo(blob: Blob, nombreArchivo: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  seleccionarFormato(formato: string) {
    const currentText = this.promptText().trim();
    let textWithFormat = currentText;

    if (formato === 'pantalla') {
      textWithFormat += ' en pantalla';
    } else {
      textWithFormat += ` en formato ${formato}`;
    }

    this.promptText.set(textWithFormat);
    this.showFormatModal.set(false);
    this.ejecutarGeneracionReporte();
  }

  cancelarSeleccionFormato() {
    this.showFormatModal.set(false);
  }

  seleccionarSugerencia(sugerencia: string) {
    this.promptText.set(sugerencia);
    this.generarReporte();
  }

  limpiar() {
    this.promptText.set('');
    this.reporte.set(null);
    this.errorMessage.set(null);
    this.showFormatModal.set(false);
    this.isExporting.set(false);
    this.exportReporte.set(null);
    this.isOfflineReport.set(false);
    this.isBrowserSimpleFallbackActive.set(false);
  }

  toggleDictado() {
    if (this.isDictating()) {
      this.detenerDictado();
    } else {
      this.iniciarDictado();
    }
  }

  private iniciarDictado() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = true;

    this.isDictating.set(true);

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this.promptText.set(transcript);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Error de reconocimiento de voz:', event.error);
      this.isDictating.set(false);
    };

    this.recognition.onend = () => {
      this.isDictating.set(false);
      if (this.promptText().trim()) {
        this.generarReporte();
      }
    };

    this.recognition.start();
  }

  private detenerDictado() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error al detener reconocimiento de voz:', e);
      }
    }
    this.isDictating.set(false);
  }
}

