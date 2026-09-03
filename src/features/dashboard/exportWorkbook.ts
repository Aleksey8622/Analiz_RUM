import * as XLSX from 'xlsx-js-style';

type ExportItem = {
  missingData?: string[];
  code: string;
  name: string;
  comment?: string;
  palletMultiple?: number;
  dailyForecast: number;
  stockDays: number | null;
  stockProductionDays: number | null;
  blocked: number;
  warehouse: number;
  production: number;
  totalStock: number;
  supplyRemainder: number;
  plannedDeliveryQty: number;
  deliveryDate: string;
  stockDaysOnDelivery: number | null;
  futureStockDays: number | null;
  status: 'critical' | 'low' | 'blocked' | 'normal' | 'check';
};

type ExportSupplier = {
  name: string;
  contract: string;
  agreement: string;
  visibleItems: ExportItem[];
};

type ExportCategory = {
  title: string;
  suppliers: ExportSupplier[];
};

type ExportColumn = {
  key: string;
  label: string;
  width: number;
};

const thinBorder = {
  top: { style: 'thin', color: { rgb: '7D8581' } },
  bottom: { style: 'thin', color: { rgb: '7D8581' } },
  left: { style: 'thin', color: { rgb: '7D8581' } },
  right: { style: 'thin', color: { rgb: '7D8581' } },
};

const statusLabels: Record<ExportItem['status'], string> = {
  critical: 'Критично',
  low: 'Низкий запас',
  blocked: 'Блок',
  normal: 'Норма',
  check: 'Проверить',
};

const formatDateForFileName = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU').format(date).replace(/\./g, '-');

const getWeekNumber = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - firstDay.getTime()) / 86_400_000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
};

const downloadWorkbook = (workbook: XLSX.WorkBook, fileName: string) => {
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const analysisHeaders = [
  'Код основной',
  'Код',
  'PLU',
  'Поставщик основной',
  '№ договора',
  'Day cover\nТотал склад',
  'Day cover\nТотал пр-во',
  'Day cover\nТотал склад+пр-во',
  'Комментарий 2',
  'LT',
  'Блок до выяснения',
  'Свободный запас\nСклад, шт.',
  'Свободный запас\nПр-во, шт.',
  'Свободный запас\nОбщий запас, шт.',
  'Прогноз / день',
  'Потребность\n(прогноз день)',
  'Штук на паллете',
  'Паллет (шт.)',
  'Дни',
  'Поставщик',
  'Дата поставки',
  'Будущий ТЗ',
  'Остаток поставки',
  'Статус',
];

const analysisColumnWidths = [13, 13, 38, 27, 15, 14, 14, 18, 38, 8, 16, 15, 15, 16, 15, 17, 15, 13, 10, 25, 15, 13, 17, 15];

const headerFills = [
  'BFC3C1', 'BFC3C1', 'BFC3C1', 'BFC3C1', 'BFC3C1',
  'BFC3C1', 'BFC3C1', 'BFC3C1', 'BFC3C1', 'BFC3C1',
  'D6DFDA', 'D6DFDA', 'D6DFDA', 'D6DFDA', 'D6DFDA',
  '00A23B', '00A23B', '00A23B', '00A23B', '00A23B', '00A23B', '00A23B',
  '00A7C7', '00A7C7',
];

export const exportAnalysisWorkbook = (categories: ExportCategory[]) => {
  const now = new Date();
  const rows: Array<Array<string | number | null>> = [
    ['День', new Intl.DateTimeFormat('ru-RU').format(now), '', '', 'На деблок'],
    ['Дней до конца недели', Math.max(0, 7 - now.getDay()), '', '', 'Отправить поставку'],
    ['Неделя', getWeekNumber(now)],
    [],
    analysisHeaders,
  ];
  const categoryRows: number[] = [];

  categories.forEach((category) => {
    categoryRows.push(rows.length);
    rows.push([category.title]);

    category.suppliers.forEach((supplier) => {
      supplier.visibleItems.forEach((item) => {
        const totalCover = item.dailyForecast > 0 ? item.totalStock / item.dailyForecast : null;
        const pallets = item.palletMultiple && item.plannedDeliveryQty
          ? item.plannedDeliveryQty / item.palletMultiple
          : null;

        rows.push([
          item.code,
          item.code,
          item.name,
          supplier.name,
          supplier.contract,
          item.stockDays,
          item.stockProductionDays,
          totalCover,
          item.comment ?? '',
          14,
          item.missingData?.includes('blocked') ? null : item.blocked,
          item.missingData?.includes('warehouse') ? null : item.warehouse,
          item.missingData?.includes('production') ? null : item.production,
          item.missingData?.includes('totalStock') ? null : item.totalStock,
          item.dailyForecast,
          item.dailyForecast,
          item.palletMultiple ?? null,
          pallets,
          item.stockDaysOnDelivery,
          item.plannedDeliveryQty > 0 ? supplier.name : '',
          item.deliveryDate,
          item.futureStockDays,
          item.missingData?.includes('supplyRemainder') ? null : item.supplyRemainder,
          statusLabels[item.status],
        ]);
      });
    });
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumn = analysisHeaders.length - 1;
  const lastRow = rows.length - 1;

  sheet['!cols'] = analysisColumnWidths.map((wch) => ({ wch }));
  sheet['!rows'] = rows.map((_, index) => ({ hpt: index === 4 ? 38 : categoryRows.includes(index) ? 23 : 19 }));
  sheet['!merges'] = categoryRows.map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: lastColumn } }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: lastRow, c: lastColumn } }) };
  (sheet as XLSX.WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 3, ySplit: 5, topLeftCell: 'D6', activePane: 'bottomRight' };

  for (let row = 0; row <= lastRow; row += 1) {
    for (let column = 0; column <= lastColumn; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[address];

      if (!cell) continue;

      cell.s = {
        font: { name: 'Arial', sz: row === 4 ? 8 : 9, bold: row <= 4 },
        alignment: { vertical: 'center', horizontal: column >= 5 && column !== 8 ? 'right' : 'left', wrapText: row === 4 },
        border: row >= 4 ? thinBorder : undefined,
      };

      if (row <= 2) {
        cell.s.fill = { patternType: 'solid', fgColor: { rgb: column === 4 ? 'DDE9E2' : 'E8EBE9' } };
      }

      if (row === 4) {
        cell.s.fill = { patternType: 'solid', fgColor: { rgb: headerFills[column] } };
        cell.s.font = { name: 'Arial', sz: 8, bold: true, color: { rgb: column >= 15 ? 'FFFFFF' : '1F2924' } };
        cell.s.alignment = { vertical: 'center', horizontal: 'center', wrapText: true };
      }

      if (categoryRows.includes(row)) {
        cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'BFC3C1' } };
        cell.s.font = { name: 'Arial', sz: 12, bold: true, color: { rgb: '111814' } };
        cell.s.alignment = { vertical: 'center', horizontal: 'left' };
      }

      if (row > 4 && !categoryRows.includes(row) && column >= 5 && column <= 18 && typeof cell.v === 'number') {
        cell.z = column === 5 || column === 6 || column === 7 || column === 17 || column === 18 ? '0.0' : '#,##0';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Анализ упаковки',
    Subject: 'Планирование поставок упаковки',
    Author: 'Analiz_RUM',
    CreatedDate: now,
  };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Анализ');
  downloadWorkbook(workbook, `Анализ_упаковки_${formatDateForFileName(now)}.xlsx`);
};

export const exportSupplyWorkbook = (
  rows: Array<Record<string, string | number>>,
  columns: ExportColumn[],
) => {
  const data = [columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => row[column.key] ?? ''))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = columns.map((column) => ({ wch: Math.max(12, Math.round(column.width / 7)) }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: columns.length - 1 } }) };

  columns.forEach((_, column) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    cell.s = {
      font: { name: 'Arial', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '00A7C7' } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: thinBorder,
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Поставки');
  downloadWorkbook(workbook, `Поставки_${formatDateForFileName(new Date())}.xlsx`);
};
