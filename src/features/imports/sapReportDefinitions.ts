export type SapReportType = 'bom' | 'supplies' | 'workshop_stock' | 'warehouse_stock' | 'blocked_stock';
export type SapCellType = 'text' | 'number' | 'integer' | 'date' | 'time' | 'auto';

export type SapColumnDefinition = {
  key: string;
  header: string;
  aliases?: string[];
  type: SapCellType;
  required?: boolean;
};

export type SapReportDefinition = {
  type: SapReportType;
  table: string;
  fileNames: string[];
  columns: SapColumnDefinition[];
};

const column = (key: string, header: string, type: SapCellType, required = false, aliases: string[] = []): SapColumnDefinition =>
  ({ key, header, type, required, aliases });

const warehouseColumns: SapColumnDefinition[] = [
  column('restricted_batch', 'Партия ОграничИспольз', 'text'),
  column('warehouse_type', 'Тип склада', 'text', true),
  column('storage_bin', 'Складское место', 'text'),
  column('handling_unit', 'Единица обработки', 'text'),
  column('product', 'Продукт', 'text', true),
  column('consolidation_group', 'Группа консолидации', 'text'),
  column('product_description', 'Краткое описание продукта', 'text'),
  column('quantity', 'Количество', 'number', true),
  column('base_unit', 'Базисная ЕИ', 'text'),
  column('movement_date', 'Дата ПМ', 'date'),
  column('shelf_life', 'Срок хранения/МсГ', 'date'),
  column('batch', 'Партия', 'text'),
  column('stock_type', 'Вид запаса', 'text'),
  column('movement_time', 'Время ПМ', 'time'),
  column('top_handling_unit', 'ЕО верхнего уровня', 'text'),
  column('document', 'Документ', 'text'),
  column('parent_handling_unit', 'Вышестоящая ЕО', 'text'),
  column('resource', 'Ресурс', 'text'),
];

export const SAP_REPORT_DEFINITIONS: SapReportDefinition[] = [
  {
    type: 'bom',
    table: 'bom_rows',
    fileNames: ['разузловка', 'bom'],
    columns: [
      column('level', 'Уровень разузловки', 'integer', true),
      column('position', 'Позиция', 'text'),
      column('material_type', 'Вид материала', 'text'),
      column('component_number', '№ компонента', 'text', true, ['Номер компонента']),
      column('material_text', 'Краткий текст материала', 'text'),
      column('phantom_node', 'Фиктивный узел', 'text'),
      column('alternative_position', 'Альтернативная позиция', 'text'),
      column('ranked_list', 'Ранговый список', 'integer'),
      column('alternative_group', 'ГруппаАльтПоз', 'text'),
      column('main_plu', 'Основное PLU', 'text'),
      column('material_text_1', 'Краткий текст материала_1', 'text'),
      column('node', 'Узел', 'text'),
      column('component_qty', 'Кол-во компон. (БЕИ)', 'number', true),
      column('base_unit', 'БЕИ', 'text'),
    ],
  },
  {
    type: 'supplies',
    table: 'supply_rows',
    fileNames: ['поставки', 'поставка', 'supplies'],
    columns: [
      column('week_or_debt', 'Номер недели/долг', 'text'),
      column('supply_remainder', 'Остаток поставки', 'number', true),
      column('supplier_code', 'Поставщик', 'text'),
      column('supplier_name', 'Наименование поставщика', 'text'),
      column('order_created_at', 'Дата заказа', 'date'),
      column('planned_delivery_at', 'Плановая дата поставки', 'date'),
      column('delivered_at', 'Дата поставлено', 'date'),
      column('order_number', '№ заказа', 'text', true, ['Номер заказа']),
      column('item_code', '№ товара', 'text', true, ['Номер товара']),
      column('item_name', 'Наименование товара', 'text'),
      column('ordered_qty', 'Количество заказано', 'number'),
      column('delivered_qty', 'Количество поставлено', 'number'),
      column('order_type', 'ВидЗаказаНаПоставку', 'text'),
      column('deleted', 'Удалено', 'text'),
      column('return_flag', 'Возврат', 'text'),
      column('order_status', 'Наименование статуса заказа', 'text'),
      column('unit', 'Единица измерения', 'text'),
    ],
  },
  {
    type: 'workshop_stock',
    table: 'workshop_stock',
    fileNames: ['остатки_цех', 'остатки цех', 'остаток цех'],
    columns: [
      column('material_number', 'Номер материала', 'text', true),
      column('plant', 'Завод', 'text'),
      column('batch', 'Партия', 'text'),
      column('warehouse', 'Склад', 'text'),
      column('unit', 'ЕдИзмерения', 'text', false, ['Единица измерения']),
      column('free_stock', 'СвобИспользЗпс', 'number', true),
      column('quality_stock', 'НаКонтрКачества', 'number'),
      column('blocked_stock', 'Блокированный', 'number'),
      column('material_type', 'Вид материала', 'text'),
      column('manufactured_at', 'Д/Изготовления', 'date'),
      column('shelf_life', 'СрокХранен/МсГ', 'date'),
      column('last_movement_at', 'Последнее ПМ', 'date'),
    ],
  },
  { type: 'warehouse_stock', table: 'warehouse_stock', fileNames: ['остатки_склад', 'остатки склад', 'остаток склад'], columns: warehouseColumns },
  { type: 'blocked_stock', table: 'blocked_stock', fileNames: ['запас_в_блоке', 'запас в блоке', 'блок'], columns: warehouseColumns },
];

export const normalizeSapHeader = (value: unknown) => String(value ?? '')
  .trim()
  .toLocaleLowerCase('ru')
  .replace(/ё/g, 'е')
  .replace(/[№#]/g, 'номер')
  .replace(/[^a-zа-я0-9]+/gi, '');

const headerNames = (definition: SapColumnDefinition) =>
  [definition.header, ...(definition.aliases ?? [])].map(normalizeSapHeader);

export const detectSapReport = (fileName: string, headers: unknown[]) => {
  const normalizedFileName = fileName.toLocaleLowerCase('ru').replace(/[-\s]+/g, '_');
  const normalizedHeaders = new Set(headers.map(normalizeSapHeader).filter(Boolean));

  const ranked = SAP_REPORT_DEFINITIONS.map((definition) => {
    const matchedColumns = definition.columns.filter((item) => headerNames(item).some((name) => normalizedHeaders.has(name)));
    const required = definition.columns.filter((item) => item.required);
    const requiredMatches = required.filter((item) => headerNames(item).some((name) => normalizedHeaders.has(name))).length;
    const fileMatch = definition.fileNames.some((name) => normalizedFileName.includes(name.replace(/\s+/g, '_')));
    return { definition, matchedColumns: matchedColumns.length, requiredMatches, requiredCount: required.length, fileMatch };
  }).sort((left, right) =>
    Number(right.requiredMatches === right.requiredCount) - Number(left.requiredMatches === left.requiredCount)
    || right.requiredMatches - left.requiredMatches
    || right.matchedColumns - left.matchedColumns
    || Number(right.fileMatch) - Number(left.fileMatch));

  const best = ranked[0];
  if (!best || best.requiredMatches !== best.requiredCount || best.matchedColumns < 3) return null;
  return best.definition;
};

export const mapSapHeaders = (definition: SapReportDefinition, headers: unknown[]) => {
  const mapping = new Map<number, SapColumnDefinition>();
  headers.forEach((header, index) => {
    const normalized = normalizeSapHeader(header);
    const match = definition.columns.find((item) => headerNames(item).includes(normalized));
    if (match) mapping.set(index, match);
  });
  return mapping;
};
