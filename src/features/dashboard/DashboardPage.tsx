import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  applySupplyView,
  clearAnalysisFilters,
  clearSupplyFilters,
  moveAnalysisColumn,
  moveSupplyColumn,
  resetAnalysisColumns,
  resetSupplyColumns,
  saveCurrentSupplyView,
  setAnalysisAdvancedFilters,
  setAnalysisSearch,
  setSupplyAdvancedFilters,
  setSupplySearch,
  toggleAnalysisColumn,
  toggleSupplyColumn,
  toggleSupplyFilterValue,
  type AnalysisColumnKey,
  type SupplyColumnKey,
  type SupplyReportRow,
} from '../../store/workspaceSlice';
import './DashboardPage.css';

type FilterRow = {
  id: number;
  field: string;
  operator: string;
  value: string;
};

type FilterInputName = Exclude<keyof FilterRow, 'id'>;

type StockStatus = 'critical' | 'low' | 'blocked' | 'normal' | 'check';
type WorkspaceSection = 'analysis' | 'supply-report' | 'bom' | 'items-directory';

type PackagingItem = {
  code: string;
  name: string;
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
  status: StockStatus;
};

type Supplier = {
  id: string;
  name: string;
  contract: string;
  agreement: string;
  category: string;
  items: PackagingItem[];
};

type SupplyColumn = {
  key: SupplyColumnKey;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
};

type AnalysisColumn = {
  key: AnalysisColumnKey;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
};

type SupplierView = Supplier & {
  visibleItems: PackagingItem[];
};

const suppliers: Supplier[] = [
  {
    id: 'milk-pack',
    name: 'МолПак Сервис',
    contract: 'Д-4421',
    agreement: 'СГ-104',
    category: 'Пленка',
    items: [
      {
        code: 'PK-100245',
        name: 'Пленка термоусадочная 40 мкм',
        dailyForecast: 4260,
        stockDays: 2.8,
        stockProductionDays: 5.6,
        blocked: 0,
        warehouse: 100000,
        production: 20000,
        totalStock: 120000,
        supplyRemainder: 85000,
        plannedDeliveryQty: 180000,
        deliveryDate: '28.05.2026',
        stockDaysOnDelivery: 1.1,
        futureStockDays: 43.4,
        status: 'critical',
      },
      {
        code: 'PK-100318',
        name: 'Пленка групповая прозрачная 60 мкм',
        dailyForecast: 8600,
        stockDays: 6.4,
        stockProductionDays: 9.2,
        blocked: 8000,
        warehouse: 62000,
        production: 17000,
        totalStock: 79000,
        supplyRemainder: 50000,
        plannedDeliveryQty: 120000,
        deliveryDate: '30.05.2026',
        stockDaysOnDelivery: 3.9,
        futureStockDays: 17.8,
        status: 'blocked',
      },
      {
        code: 'PK-100602',
        name: 'Пленка паллетная машинная',
        dailyForecast: 10300,
        stockDays: 11.5,
        stockProductionDays: 16.8,
        blocked: 0,
        warehouse: 145000,
        production: 28000,
        totalStock: 173000,
        supplyRemainder: 0,
        plannedDeliveryQty: 0,
        deliveryDate: '',
        stockDaysOnDelivery: null,
        futureStockDays: null,
        status: 'normal',
      },
    ],
  },
  {
    id: 'gofro-line',
    name: 'ГофроЛайн Север',
    contract: 'Д-3987',
    agreement: 'СГ-087',
    category: 'Гофра',
    items: [
      {
        code: 'GF-220014',
        name: 'Гофролист бурый 1200x800',
        dailyForecast: 7200,
        stockDays: 4.1,
        stockProductionDays: 7.3,
        blocked: 1200,
        warehouse: 45000,
        production: 8000,
        totalStock: 53000,
        supplyRemainder: 44000,
        plannedDeliveryQty: 90000,
        deliveryDate: '24.05.2026',
        stockDaysOnDelivery: 2.4,
        futureStockDays: 14.9,
        status: 'low',
      },
      {
        code: 'GF-220077',
        name: 'Прокладка гофрокартонная 3 слоя',
        dailyForecast: 7550,
        stockDays: 8.9,
        stockProductionDays: 13.1,
        blocked: 0,
        warehouse: 88000,
        production: 11000,
        totalStock: 99000,
        supplyRemainder: 0,
        plannedDeliveryQty: 0,
        deliveryDate: '',
        stockDaysOnDelivery: null,
        futureStockDays: null,
        status: 'normal',
      },
    ],
  },
  {
    id: 'box-format',
    name: 'Формат Короб',
    contract: 'Д-4512',
    agreement: 'СГ-116',
    category: 'Короба',
    items: [
      {
        code: 'BX-340071',
        name: 'Короб транспортный 12 бутылок',
        dailyForecast: 7050,
        stockDays: 1.6,
        stockProductionDays: 3.4,
        blocked: 0,
        warehouse: 18000,
        production: 6000,
        totalStock: 24000,
        supplyRemainder: 30000,
        plannedDeliveryQty: 160000,
        deliveryDate: '23.05.2026',
        stockDaysOnDelivery: 0.2,
        futureStockDays: 22.9,
        status: 'critical',
      },
      {
        code: 'BX-340144',
        name: 'Короб шоу-бокс молочная линейка',
        dailyForecast: 2400,
        stockDays: null,
        stockProductionDays: 4.8,
        blocked: 0,
        warehouse: 9000,
        production: 2500,
        totalStock: 11500,
        supplyRemainder: 12000,
        plannedDeliveryQty: 40000,
        deliveryDate: '27.05.2026',
        stockDaysOnDelivery: null,
        futureStockDays: 21.5,
        status: 'check',
      },
      {
        code: 'BX-340188',
        name: 'Короб архивный для промонаборов',
        dailyForecast: 4450,
        stockDays: 7.2,
        stockProductionDays: 10.5,
        blocked: 4000,
        warehouse: 32000,
        production: 0,
        totalStock: 32000,
        supplyRemainder: 0,
        plannedDeliveryQty: 0,
        deliveryDate: '',
        stockDaysOnDelivery: null,
        futureStockDays: null,
        status: 'blocked',
      },
    ],
  },
  {
    id: 'lotok-pro',
    name: 'ЛотокПро',
    contract: 'Д-4105',
    agreement: 'СГ-092',
    category: 'Лотки',
    items: [
      {
        code: 'LT-510022',
        name: 'Лоток картонный 6 ячеек',
        dailyForecast: 4650,
        stockDays: 9.8,
        stockProductionDays: 14.4,
        blocked: 0,
        warehouse: 54000,
        production: 13000,
        totalStock: 67000,
        supplyRemainder: 0,
        plannedDeliveryQty: 0,
        deliveryDate: '',
        stockDaysOnDelivery: null,
        futureStockDays: null,
        status: 'normal',
      },
      {
        code: 'LT-510039',
        name: 'Лоток усиленный под стакан',
        dailyForecast: 5350,
        stockDays: 5.1,
        stockProductionDays: 6.7,
        blocked: 0,
        warehouse: 27000,
        production: 9000,
        totalStock: 36000,
        supplyRemainder: 28000,
        plannedDeliveryQty: 75000,
        deliveryDate: '29.05.2026',
        stockDaysOnDelivery: 2.1,
        futureStockDays: 16.1,
        status: 'low',
      },
    ],
  },
];

const analysisSupplierFilterFields = ['Поставщик', 'Код позиции', 'Позиция'];
const analysisPositionFilterFields = ['Код позиции', 'Позиция', 'Статус', 'Дата поставки', 'ТЗ склад', 'Прогноз/день'];
const supplyFilterFields = [
  'Поставщик',
  'Дата заказа',
  'Номер заказа',
  'Код товара',
];
const filterOperators = ['Содержит', 'Равно', 'Не равно', 'Больше', 'Меньше'];
const supplyFieldMap: Record<string, SupplyColumnKey> = {
  'Неделя/долг': 'weekOrDebt',
  Поставщик: 'supplierName',
  'Дата заказа': 'orderCreatedAt',
  'Плановая дата поставки': 'plannedDeliveryAt',
  'Номер заказа': 'orderNumber',
  'Код товара': 'itemCode',
  'Вид заказа': 'orderType',
  'Статус заказа': 'orderStatus',
  ЕИ: 'unit',
};
const analysisSupplierFields = new Set(['Поставщик']);
const analysisItemFieldMap: Record<string, keyof PackagingItem | 'statusLabel'> = {
  'Код позиции': 'code',
  Позиция: 'name',
  Статус: 'statusLabel',
  'ТЗ склад': 'stockDays',
  'Прогноз/день': 'dailyForecast',
  'Кол-во поставки': 'plannedDeliveryQty',
  'Дата поставки': 'deliveryDate',
};

const statusLabels: Record<StockStatus, string> = {
  critical: 'Критично',
  low: 'Низкий запас',
  blocked: 'Есть блок',
  normal: 'Норма',
  check: 'Проверить',
};

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value);

const formatDays = (value: number | null) => (value === null ? 'Нет данных' : `${value.toFixed(1)} дн.`);

const parseFilterValues = (value: string) =>
  value
    .split(/[\n\r\t,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const includesAnyFilterValue = (source: string | number | null, filterValue: string) => {
  const sourceText = String(source ?? '').toLowerCase();
  const values = parseFilterValues(filterValue);

  if (values.length === 0) {
    return true;
  }

  return values.some((value) => sourceText.includes(value.toLowerCase()));
};

const getFilterValuePlaceholder = (field: string) => {
  const placeholders: Record<string, string> = {
    Поставщик: 'Название поставщика или список поставщиков',
    'Код позиции': 'Коды позиций, каждый с новой строки',
    Позиция: 'Наименование позиции или часть наименования',
    Статус: 'Статус позиции',
    'Дата поставки': 'Дата поставки или список дат',
    'ТЗ склад': 'Значение ТЗ на складе',
    'Прогноз/день': 'Средний суточный прогноз',
    'Дата заказа': 'Дата формирования заказа',
    'Номер заказа': 'Номер заказа или список заказов',
    'Код товара': 'Код товара или список кодов',
  };

  return placeholders[field] ?? 'Введите значение или список значений';
};

const analysisColumns: AnalysisColumn[] = [
  { key: 'code', label: 'Код', width: 108 },
  { key: 'name', label: 'Позиция', width: 300 },
  { key: 'dailyForecast', label: 'Прогноз/день', width: 112, align: 'right' },
  { key: 'stockDays', label: 'ТЗ склад, дн.', width: 112, align: 'right' },
  { key: 'stockProductionDays', label: 'ТЗ склад+пр-во, дн.', width: 142, align: 'right' },
  { key: 'blocked', label: 'Блок', width: 90, align: 'right' },
  { key: 'warehouse', label: 'Склад', width: 122, align: 'right' },
  { key: 'production', label: 'Производство', width: 122, align: 'right' },
  { key: 'totalStock', label: 'Общий остаток', width: 122, align: 'right' },
  { key: 'supplyRemainder', label: 'Остаток поставки', width: 132, align: 'right' },
  { key: 'plannedDeliveryQty', label: 'Кол-во поставки', width: 132, align: 'right' },
  { key: 'deliveryDate', label: 'Дата поставки', width: 118, align: 'center' },
  { key: 'stockDaysOnDelivery', label: 'ТЗ на дату', width: 112, align: 'right' },
  { key: 'futureStockDays', label: 'Будущий ТЗ', width: 112, align: 'right' },
  { key: 'status', label: 'Статус', width: 100, align: 'center' },
];

const getAnalysisCellValue = (item: PackagingItem, columnKey: AnalysisColumnKey) => {
  if (columnKey === 'stockDays' || columnKey === 'stockProductionDays' || columnKey === 'stockDaysOnDelivery' || columnKey === 'futureStockDays') {
    return formatDays(item[columnKey]);
  }

  if (
    columnKey === 'dailyForecast' ||
    columnKey === 'blocked' ||
    columnKey === 'warehouse' ||
    columnKey === 'production' ||
    columnKey === 'totalStock' ||
    columnKey === 'supplyRemainder'
  ) {
    return formatNumber(item[columnKey]);
  }

  if (columnKey === 'status') {
    return statusLabels[item.status];
  }

  return item[columnKey];
};

const supplyColumns: SupplyColumn[] = [
  { key: 'weekOrDebt', label: 'Неделя/долг', width: 110 },
  { key: 'supplyRemainder', label: 'Остаток поставки', width: 140, align: 'right' },
  { key: 'supplierCode', label: 'Код поставщика', width: 130 },
  { key: 'supplierName', label: 'Наименование поставщика', width: 220 },
  { key: 'orderCreatedAt', label: 'Дата формирования заказа', width: 170 },
  { key: 'plannedDeliveryAt', label: 'Плановая дата поставки', width: 160 },
  { key: 'deliveredAt', label: 'Дата поставлена', width: 130 },
  { key: 'orderNumber', label: 'Номер заказа', width: 130 },
  { key: 'itemCode', label: 'Код товара', width: 115 },
  { key: 'itemName', label: 'Наименование товара', width: 260 },
  { key: 'orderedQty', label: 'Заказано', width: 120, align: 'right' },
  { key: 'deliveredQty', label: 'Поставлено', width: 120, align: 'right' },
  { key: 'orderType', label: 'Вид заказа', width: 105, align: 'center' },
  { key: 'deleted', label: 'Удалена', width: 95, align: 'center' },
  { key: 'returnFlag', label: 'Возврат', width: 95, align: 'center' },
  { key: 'orderStatus', label: 'Статус заказа', width: 150 },
  { key: 'unit', label: 'ЕИ', width: 80, align: 'center' },
];

const supplyRows: SupplyReportRow[] = [
  {
    id: 's-001',
    weekOrDebt: '21 неделя',
    supplyRemainder: 85000,
    supplierCode: '100452',
    supplierName: 'МолПак Сервис',
    orderCreatedAt: '16.05.2026',
    plannedDeliveryAt: '28.05.2026',
    deliveredAt: '',
    orderNumber: '4500128841',
    itemCode: 'PK-100245',
    itemName: 'Пленка термоусадочная 40 мкм',
    orderedQty: 180000,
    deliveredQty: 95000,
    orderType: 'ZFKR',
    deleted: 'Нет',
    returnFlag: 'Нет',
    orderStatus: 'Открыт',
    unit: 'шт',
  },
  {
    id: 's-002',
    weekOrDebt: 'Долг',
    supplyRemainder: 30000,
    supplierCode: '100817',
    supplierName: 'Формат Короб',
    orderCreatedAt: '07.05.2026',
    plannedDeliveryAt: '17.05.2026',
    deliveredAt: '',
    orderNumber: '4500127410',
    itemCode: 'BX-340071',
    itemName: 'Короб транспортный 12 бутылок',
    orderedQty: 160000,
    deliveredQty: 130000,
    orderType: 'ZFKR',
    deleted: 'Нет',
    returnFlag: 'Нет',
    orderStatus: 'Просрочен',
    unit: 'шт',
  },
  {
    id: 's-003',
    weekOrDebt: '22 неделя',
    supplyRemainder: 44000,
    supplierCode: '100623',
    supplierName: 'ГофроЛайн Север',
    orderCreatedAt: '18.05.2026',
    plannedDeliveryAt: '29.05.2026',
    deliveredAt: '',
    orderNumber: '4500129035',
    itemCode: 'GF-220014',
    itemName: 'Гофролист бурый 1200x800',
    orderedQty: 90000,
    deliveredQty: 46000,
    orderType: 'ZFKR',
    deleted: 'Нет',
    returnFlag: 'Нет',
    orderStatus: 'Частично поставлен',
    unit: 'кг',
  },
  {
    id: 's-004',
    weekOrDebt: '21 неделя',
    supplyRemainder: 0,
    supplierCode: '100452',
    supplierName: 'МолПак Сервис',
    orderCreatedAt: '10.05.2026',
    plannedDeliveryAt: '20.05.2026',
    deliveredAt: '19.05.2026',
    orderNumber: '4500127908',
    itemCode: 'PK-100602',
    itemName: 'Пленка паллетная машинная',
    orderedQty: 140000,
    deliveredQty: 140000,
    orderType: 'ZFKR',
    deleted: 'Нет',
    returnFlag: 'Нет',
    orderStatus: 'Закрыт',
    unit: 'шт',
  },
  {
    id: 's-005',
    weekOrDebt: '23 неделя',
    supplyRemainder: 28000,
    supplierCode: '101204',
    supplierName: 'ЛотокПро',
    orderCreatedAt: '19.05.2026',
    plannedDeliveryAt: '03.06.2026',
    deliveredAt: '',
    orderNumber: '4500129182',
    itemCode: 'LT-510039',
    itemName: 'Лоток усиленный под стакан',
    orderedQty: 75000,
    deliveredQty: 47000,
    orderType: 'ZFKR',
    deleted: 'Нет',
    returnFlag: 'Нет',
    orderStatus: 'Открыт',
    unit: 'шт',
  },
];

function DashboardPage() {
  const dispatch = useAppDispatch();
  const {
    activeSupplyView,
    analysisFilters,
    savedSupplyViews,
    supplyFilters,
    visibleAnalysisColumns,
    visibleSupplyColumns,
  } = useAppSelector((state) => state.workspace);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('analysis');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterRow[]>([]);
  const [expandedSuppliers, setExpandedSuppliers] = useState<string[]>([]);
  const sidebarRef = useRef<HTMLElement>(null);
  const filterAreaRef = useRef<HTMLDivElement>(null);
  const columnAreaRef = useRef<HTMLDivElement>(null);

  const pageStats = useMemo(() => {
    const items = suppliers.flatMap((supplier) => supplier.items);

    return {
      suppliers: suppliers.length,
      items: items.length,
      critical: items.filter((item) => item.status === 'critical').length,
      blocked: items.filter((item) => item.blocked > 0).length,
      totalStock: items.reduce((sum, item) => sum + item.totalStock, 0),
    };
  }, []);

  const visibleAnalysisColumnsConfig = useMemo(
    () =>
      visibleAnalysisColumns
        .map((columnKey) => analysisColumns.find((column) => column.key === columnKey))
        .filter((column): column is AnalysisColumn => Boolean(column)),
    [visibleAnalysisColumns],
  );

  const filteredSuppliers = useMemo<SupplierView[]>(() => {
    const matchesText = (source: string | number | null, search: string) =>
      String(source ?? '').toLowerCase().includes(search.toLowerCase());
    const hasSearch = Boolean(analysisFilters.search.trim());
    const activeAdvancedFilters = analysisFilters.advanced.filter(
      (filter) => filter.field && filter.operator && filter.value,
    );
    const hasItemFilters = activeAdvancedFilters.some((filter) => !analysisSupplierFields.has(filter.field));

    const matchValue = (value: string | number | null, operator: string, rawFilterValue: string) => {
      const filterValue = rawFilterValue.trim();
      const valueText = String(value ?? '').toLowerCase();
      const filterText = filterValue.toLowerCase();
      const numericValue = Number(value);
      const numericFilterValue = Number(filterValue.replace(/\s/g, ''));

      if (operator === 'Содержит') {
        return includesAnyFilterValue(value, rawFilterValue);
      }

      if (operator === 'Равно') {
        return valueText === filterText;
      }

      if (operator === 'Не равно') {
        return valueText !== filterText;
      }

      if (operator === 'Больше') {
        return Number.isFinite(numericValue) && numericValue > numericFilterValue;
      }

      if (operator === 'Меньше') {
        return Number.isFinite(numericValue) && numericValue < numericFilterValue;
      }

      return true;
    };

    return suppliers.flatMap((supplier) => {
      const search = analysisFilters.search.trim();
      const supplierMatchesSearch =
        !search || [supplier.name, supplier.contract, supplier.agreement, supplier.category].some((value) => matchesText(value, search));
      const matchingItemsBySearch = !search
        ? supplier.items
        : supplier.items.filter((item) =>
            [item.code, item.name, statusLabels[item.status], item.deliveryDate].some((value) => matchesText(value, search)),
          );

      const supplierPassesAdvanced = activeAdvancedFilters
        .filter((filter) => analysisSupplierFields.has(filter.field))
        .every((filter) => {
          const valuesByField: Record<string, string> = {
            Поставщик: supplier.name,
          };

          return matchValue(valuesByField[filter.field], filter.operator, filter.value);
        });

      if (!supplierPassesAdvanced) {
        return [];
      }

      const isSupplierOpened = expandedSuppliers.includes(supplier.id);
      const shouldFilterInsideOpenedSupplier = isSupplierOpened && !supplierMatchesSearch;
      const itemsAfterSearch = supplierMatchesSearch && !shouldFilterInsideOpenedSupplier ? supplier.items : matchingItemsBySearch;
      const visibleItems = itemsAfterSearch.filter((item) => {
        return activeAdvancedFilters
          .filter((filter) => !analysisSupplierFields.has(filter.field))
          .every((filter) => {
            const fieldKey = analysisItemFieldMap[filter.field];

            if (!fieldKey) {
              return true;
            }

            const value = fieldKey === 'statusLabel' ? statusLabels[item.status] : item[fieldKey];
            return matchValue(value as string | number | null, filter.operator, filter.value);
          });
      });

      if (!supplierMatchesSearch && matchingItemsBySearch.length === 0) {
        return [];
      }

      if ((hasSearch || hasItemFilters) && visibleItems.length === 0) {
        return [];
      }

      if (expandedSuppliers.length > 0 && !isSupplierOpened && (hasItemFilters || hasSearch)) {
        return [];
      }

      return [{ ...supplier, visibleItems }];
    });
  }, [analysisFilters, expandedSuppliers]);

  const orderedVisibleSupplyColumns = useMemo(
    () =>
      visibleSupplyColumns
        .map((columnKey) => supplyColumns.find((column) => column.key === columnKey))
        .filter((column): column is SupplyColumn => Boolean(column)),
    [visibleSupplyColumns],
  );

  const filteredSupplyRows = useMemo(() => {
    const matchesText = (source: string | number, search: string) =>
      String(source).toLowerCase().includes(search.toLowerCase());

    return supplyRows.filter((row) => {
      const search = supplyFilters.search.trim();

      if (
        search &&
        ![
          row.orderNumber,
          row.supplierCode,
          row.supplierName,
          row.itemCode,
          row.itemName,
          row.orderStatus,
          row.weekOrDebt,
        ].some((value) => matchesText(value, search))
      ) {
        return false;
      }

      if (supplyFilters.weekOrDebt.length > 0 && !supplyFilters.weekOrDebt.includes(String(row.weekOrDebt))) {
        return false;
      }

      if (supplyFilters.supplierName.length > 0 && !supplyFilters.supplierName.includes(String(row.supplierName))) {
        return false;
      }

      if (supplyFilters.orderStatus.length > 0 && !supplyFilters.orderStatus.includes(String(row.orderStatus))) {
        return false;
      }

      if (supplyFilters.unit.length > 0 && !supplyFilters.unit.includes(String(row.unit))) {
        return false;
      }

      if (supplyFilters.orderType.length > 0 && !supplyFilters.orderType.includes(String(row.orderType))) {
        return false;
      }

      return supplyFilters.advanced.every((filter) => {
        if (!filter.field || !filter.operator || !filter.value) {
          return true;
        }

        const columnKey = supplyFieldMap[filter.field];

        if (!columnKey) {
          return true;
        }

        const rowValue = row[columnKey];
        const filterValue = filter.value.trim();
        const rowText = String(rowValue).toLowerCase();
        const filterText = filterValue.toLowerCase();
        const numericRowValue = Number(rowValue);
        const numericFilterValue = Number(filterValue.replace(/\s/g, ''));

        if (filter.operator === 'Содержит') {
          return includesAnyFilterValue(rowValue, filter.value);
        }

        if (filter.operator === 'Равно') {
          return rowText === filterText;
        }

        if (filter.operator === 'Не равно') {
          return rowText !== filterText;
        }

        if (filter.operator === 'Больше') {
          return Number.isFinite(numericRowValue) && numericRowValue > numericFilterValue;
        }

        if (filter.operator === 'Меньше') {
          return Number.isFinite(numericRowValue) && numericRowValue < numericFilterValue;
        }

        return true;
      });
    });
  }, [supplyFilters]);

  const filteredSupplyStats = useMemo(
    () => ({
      orders: new Set(filteredSupplyRows.map((row) => row.orderNumber)).size,
      open: filteredSupplyRows.filter((row) => row.orderStatus !== 'Закрыт').length,
      debt: filteredSupplyRows.filter((row) => row.weekOrDebt === 'Долг').length,
      remainder: filteredSupplyRows.reduce((sum, row) => sum + Number(row.supplyRemainder), 0),
    }),
    [filteredSupplyRows],
  );

  const hasActiveAnalysisFilters = Boolean(analysisFilters.search.trim() || analysisFilters.advanced.length > 0);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!sidebarRef.current || sidebarRef.current.contains(event.target as Node)) {
        return;
      }

      setIsSidebarOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      return;
    }

    setDraftFilters(activeSection === 'supply-report' ? supplyFilters.advanced : analysisFilters.advanced);
  }, [activeSection, analysisFilters.advanced, isFilterPanelOpen, supplyFilters.advanced]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!columnAreaRef.current || columnAreaRef.current.contains(event.target as Node)) {
        return;
      }

      setIsColumnPanelOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!filterAreaRef.current || filterAreaRef.current.contains(event.target as Node)) {
        return;
      }

      setIsFilterPanelOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const visibleFilters = useMemo(() => {
    const filters = activeSection === 'supply-report' ? supplyFilters.advanced : analysisFilters.advanced;

    return filters.filter((filter) => filter.field || filter.operator || filter.value);
  }, [activeSection, analysisFilters.advanced, supplyFilters.advanced]);

  const currentFilterFields =
    activeSection === 'supply-report'
      ? supplyFilterFields
      : expandedSuppliers.length > 0
        ? analysisPositionFilterFields
        : analysisSupplierFilterFields;

  const handleFilterChange = (id: number, field: FilterInputName, value: string) => {
    setDraftFilters((current) =>
      current.map((filter) => {
        if (filter.id !== id) {
          return filter;
        }

        const nextFilter = { ...filter, [field]: value };

        nextFilter.operator = 'Содержит';

        return nextFilter;
      }),
    );
  };

  const addFilter = () => {
    setDraftFilters((current) => [
      ...current,
      {
        id: Date.now(),
        field: '',
        operator: 'Содержит',
        value: '',
      },
    ]);
  };

  const removeFilter = (id: number) => {
    setDraftFilters((current) => current.filter((filter) => filter.id !== id));
  };

  const removeAppliedFilter = (id: number) => {
    const nextFilters = visibleFilters.filter((filter) => filter.id !== id);

    if (activeSection === 'supply-report') {
      dispatch(setSupplyAdvancedFilters(nextFilters));
    } else {
      dispatch(setAnalysisAdvancedFilters(nextFilters));
    }
  };

  const applyFilters = () => {
    const nextFilters = draftFilters
      .map((filter) => ({ ...filter, operator: 'Содержит' }))
      .filter((filter) => filter.field || filter.operator || filter.value);

    if (activeSection === 'supply-report') {
      dispatch(setSupplyAdvancedFilters(nextFilters));
    } else {
      dispatch(setAnalysisAdvancedFilters(nextFilters));
    }

    setIsFilterPanelOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters([]);
    if (activeSection === 'supply-report') {
      dispatch(clearSupplyFilters());
    } else {
      dispatch(clearAnalysisFilters());
    }
    setIsFilterPanelOpen(false);
  };

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers((current) =>
      current.includes(supplierId)
        ? current.filter((expandedSupplierId) => expandedSupplierId !== supplierId)
        : [...current, supplierId],
    );
  };

  const openSection = (section: WorkspaceSection) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
    setIsFilterPanelOpen(false);
    setIsColumnPanelOpen(false);
  };

  return (
    <main className="dashboard-page">
      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar ${isSidebarOpen ? 'is-open' : ''}`}
        aria-label="Основная навигация"
      >
        <button
          className="dashboard-sidebar__toggle"
          type="button"
          aria-label={isSidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((current) => !current)}
        >
          <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span>Меню</span>
        </button>
        <nav className="dashboard-sidebar__nav">
          <button
            className={activeSection === 'analysis' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('analysis')}
          >
            Анализ
          </button>
          <button
            className={activeSection === 'supply-report' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('supply-report')}
          >
            Отчет поставки
          </button>
          <button
            className={activeSection === 'bom' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('bom')}
          >
            Разузловка
          </button>
          <button
            className={activeSection === 'items-directory' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('items-directory')}
          >
            Справочник позиций
          </button>
        </nav>
        <a className="dashboard-sidebar__logout" href="/" aria-label="Выход">
          <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 6H6v12h4M13 8l4 4-4 4M8 12h9" />
          </svg>
          <span>Выйти</span>
        </a>
      </aside>

      <section className="dashboard-workspace">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-header__label">DELEKTO Workspace</span>
            <h1>{activeSection === 'supply-report' ? 'Отчет поставки' : 'Анализ запасов упаковки'}</h1>
            <p>
              {activeSection === 'supply-report'
                ? 'SAP-заказы, остаток поставки, плановые даты и статус отгрузки'
                : 'Поставщики, покрытие в днях и фактический остаток по позициям'}
            </p>
          </div>
          <div className="dashboard-header__actions">
            <div className="dashboard-column-tools" ref={columnAreaRef}>
              <button
                type="button"
                className="dashboard-icon-button"
                aria-label="Настройки колонок"
                aria-expanded={isColumnPanelOpen}
                onClick={() => setIsColumnPanelOpen((current) => !current)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
              </button>

              {isColumnPanelOpen && (
                <aside className="dashboard-column-panel" aria-label="Настройки колонок">
                  <div className="dashboard-column-panel__header">
                    <strong>{activeSection === 'supply-report' ? 'Колонки отчета' : 'Колонки позиций'}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        activeSection === 'supply-report'
                          ? dispatch(resetSupplyColumns())
                          : dispatch(resetAnalysisColumns())
                      }
                    >
                      Все
                    </button>
                  </div>
                  <div className="dashboard-column-panel__body">
                    {(activeSection === 'supply-report' ? supplyColumns : analysisColumns).map((column) => {
                      const isSupplyColumn = activeSection === 'supply-report';
                      const isVisible = isSupplyColumn
                        ? visibleSupplyColumns.includes(column.key as SupplyColumnKey)
                        : visibleAnalysisColumns.includes(column.key as AnalysisColumnKey);
                      const isLocked =
                        (isSupplyColumn && column.key === 'orderStatus') ||
                        (!isSupplyColumn && (column.key === 'code' || column.key === 'name'));

                      return (
                        <div className="dashboard-column-row" key={column.key}>
                          <label>
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={isVisible}
                              onChange={() =>
                                isSupplyColumn
                                  ? dispatch(toggleSupplyColumn(column.key as SupplyColumnKey))
                                  : dispatch(toggleAnalysisColumn(column.key as AnalysisColumnKey))
                              }
                            />
                            <span>{column.label}</span>
                          </label>
                          <div>
                            <button
                              type="button"
                              disabled={!isVisible}
                              onClick={() =>
                                isSupplyColumn
                                  ? dispatch(moveSupplyColumn({ column: column.key as SupplyColumnKey, direction: 'up' }))
                                  : dispatch(moveAnalysisColumn({ column: column.key as AnalysisColumnKey, direction: 'up' }))
                              }
                            >
                              Вверх
                            </button>
                            <button
                              type="button"
                              disabled={!isVisible}
                              onClick={() =>
                                isSupplyColumn
                                  ? dispatch(moveSupplyColumn({ column: column.key as SupplyColumnKey, direction: 'down' }))
                                  : dispatch(moveAnalysisColumn({ column: column.key as AnalysisColumnKey, direction: 'down' }))
                              }
                            >
                              Вниз
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}
            </div>
            <button type="button" className="dashboard-button dashboard-button--secondary">
              Экспорт
            </button>
            <button type="button" className="dashboard-button dashboard-button--secondary">
              Пересчитать
            </button>
            <button type="button" className="dashboard-button dashboard-button--primary">
              Импорт Excel
            </button>
          </div>
        </header>

        {activeSection === 'analysis' ? (
          <section className="dashboard-summary" aria-label="Сводка по упаковке">
            <article className="dashboard-summary__item">
              <span>Поставщиков</span>
              <strong>{pageStats.suppliers}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>Позиций</span>
              <strong>{pageStats.items}</strong>
            </article>
            <article className="dashboard-summary__item dashboard-summary__item--critical">
              <span>Критичных</span>
              <strong>{pageStats.critical}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>С блоком</span>
              <strong>{pageStats.blocked}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>Общий остаток</span>
              <strong>{formatNumber(pageStats.totalStock)}</strong>
            </article>
          </section>
        ) : (
          <section className="dashboard-summary" aria-label="Сводка по поставкам">
            <article className="dashboard-summary__item">
              <span>Заказов</span>
              <strong>{filteredSupplyStats.orders}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>Открытых строк</span>
              <strong>{filteredSupplyStats.open}</strong>
            </article>
            <article className="dashboard-summary__item dashboard-summary__item--critical">
              <span>Долг</span>
              <strong>{filteredSupplyStats.debt}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>Остаток поставки</span>
              <strong>{formatNumber(filteredSupplyStats.remainder)}</strong>
            </article>
            <article className="dashboard-summary__item">
              <span>Сохраненный вид</span>
              <strong>{activeSupplyView}</strong>
            </article>
          </section>
        )}

        <div className="dashboard-toolbar">
          <label className="dashboard-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.5 18a7.5 7.5 0 1 1 5.3-12.8 7.5 7.5 0 0 1-5.3 12.8ZM16 16l4 4" />
            </svg>
            <input
              type="search"
              value={activeSection === 'supply-report' ? supplyFilters.search : analysisFilters.search}
              placeholder={
                activeSection === 'supply-report'
                  ? 'Поиск по заказу, поставщику, товару или статусу'
                  : 'Поиск по поставщику, договору или позиции'
              }
              onChange={(event) => {
                if (activeSection === 'supply-report') {
                  dispatch(setSupplySearch(event.target.value));
                } else {
                  dispatch(setAnalysisSearch(event.target.value));
                }
              }}
            />
          </label>
          {activeSection === 'supply-report' && (
            <div className="dashboard-quick-filters" aria-label="Быстрые фильтры">
              <button
                type="button"
                className={
                  supplyFilters.search ||
                  supplyFilters.weekOrDebt.length ||
                  supplyFilters.orderStatus.length ||
                  supplyFilters.supplierName.length ||
                  supplyFilters.unit.length ||
                  supplyFilters.orderType.length ||
                  supplyFilters.advanced.length
                    ? ''
                    : 'is-active'
                }
                onClick={() => dispatch(clearSupplyFilters())}
              >
                Все
              </button>
              <>
                <button
                  className={supplyFilters.weekOrDebt.includes('Долг') ? 'is-active' : ''}
                  type="button"
                  onClick={() => dispatch(toggleSupplyFilterValue({ name: 'weekOrDebt', value: 'Долг' }))}
                >
                  Долг
                </button>
                <button
                  className={supplyFilters.orderStatus.includes('Открыт') ? 'is-active' : ''}
                  type="button"
                  onClick={() => dispatch(toggleSupplyFilterValue({ name: 'orderStatus', value: 'Открыт' }))}
                >
                  Открыт
                </button>
                <button
                  className={supplyFilters.orderStatus.includes('Частично поставлен') ? 'is-active' : ''}
                  type="button"
                  onClick={() =>
                    dispatch(toggleSupplyFilterValue({ name: 'orderStatus', value: 'Частично поставлен' }))
                  }
                >
                  Частично поставлен
                </button>
                <button type="button" onClick={() => dispatch(saveCurrentSupplyView())}>
                  Сохранить вид
                </button>
              </>
            </div>
          )}
        </div>

        <div className="dashboard-filters" ref={filterAreaRef} aria-label="Фильтры анализа">
          <button
            className="dashboard-filter-icon"
            type="button"
            aria-label="Открыть фильтры"
            aria-expanded={isFilterPanelOpen}
            onClick={() => setIsFilterPanelOpen((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
            </svg>
          </button>

          <div className="dashboard-filter-tags" aria-label="Активные фильтры">
            {visibleFilters.length === 0 && <span className="dashboard-filter-empty">Фильтры не выбраны</span>}
            {visibleFilters.map((filter) => (
              <span className="dashboard-filter-tag" key={filter.id}>
                <span>{[filter.field, filter.operator, filter.value].filter(Boolean).join(' ')}</span>
                <button type="button" aria-label="Удалить фильтр" onClick={() => removeAppliedFilter(filter.id)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          <button className="dashboard-clear-button" type="button" onClick={clearFilters}>
            Очистить
          </button>

          {isFilterPanelOpen && (
            <>
              <button
                className="dashboard-filter-backdrop"
                type="button"
                aria-label="Закрыть фильтры"
                onClick={() => setIsFilterPanelOpen(false)}
              />
              <aside className="dashboard-filter-panel" aria-label="Коллектор фильтров">
                <div className="dashboard-filter-panel__header">
                  <h2>Коллектор фильтров</h2>
                  <button
                    className="dashboard-filter-close"
                    type="button"
                    aria-label="Закрыть фильтры"
                    onClick={() => setIsFilterPanelOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7l10 10M17 7L7 17" />
                    </svg>
                  </button>
                </div>

                <div className="dashboard-filter-panel__body">
                  {draftFilters.map((filter) => (
                    <div className="dashboard-filter-row" key={filter.id}>
                      <select
                        value={filter.field}
                        aria-label="Поле фильтра"
                        onChange={(event) => handleFilterChange(filter.id, 'field', event.target.value)}
                      >
                        <option value="">Поле</option>
                        {currentFilterFields.map((field) => (
                          <option value={field} key={field}>
                            {field}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filter.operator}
                        aria-label="Условие фильтра"
                        className="is-hidden"
                        onChange={(event) => handleFilterChange(filter.id, 'operator', event.target.value)}
                      >
                        <option value="">Условие</option>
                        {filterOperators.map((operator) => (
                          <option value={operator} key={operator}>
                            {operator}
                          </option>
                        ))}
                      </select>

                      <textarea
                        value={filter.value}
                        aria-label="Значение фильтра"
                        placeholder={getFilterValuePlaceholder(filter.field)}
                        onChange={(event) => handleFilterChange(filter.id, 'value', event.target.value)}
                      />

                      <button
                        className="dashboard-filter-remove"
                        type="button"
                        aria-label="Удалить фильтр"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 7l10 10M17 7L7 17" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button className="dashboard-add-filter" type="button" onClick={addFilter}>
                  Добавить фильтр
                </button>

                <div className="dashboard-filter-panel__actions">
                  <button className="dashboard-button dashboard-button--primary" type="button" onClick={applyFilters}>
                    Применить
                  </button>
                  <button className="dashboard-filter-cancel" type="button" onClick={() => setIsFilterPanelOpen(false)}>
                    Отменить
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>

        <div className="dashboard-workbench">
          {activeSection === 'supply-report' ? (
            <div className="dashboard-report-shell">
              <div className="dashboard-saved-views" aria-label="Сохраненные фильтры">
                {savedSupplyViews.map((view) => (
                  <button
                    className={activeSupplyView === view.name ? 'is-active' : ''}
                    type="button"
                    key={view.name}
                    onClick={() => dispatch(applySupplyView(view.name))}
                  >
                    {view.name}
                  </button>
                ))}
              </div>
              <div className="dashboard-report-table">
                <table>
                  <colgroup>
                    {orderedVisibleSupplyColumns.map((column) => (
                      <col key={column.key} style={{ width: `${column.width}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {orderedVisibleSupplyColumns.map((column) => (
                        <th className={column.align ? `is-${column.align}` : undefined} key={column.key}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplyRows.map((row) => (
                      <tr key={row.id}>
                        {orderedVisibleSupplyColumns.map((column) => {
                          const value = row[column.key];
                          const isNumeric = typeof value === 'number';

                          return (
                            <td className={column.align ? `is-${column.align}` : undefined} key={column.key}>
                              {isNumeric ? formatNumber(value) : value || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="dashboard-supplier-shell">
            <div className="dashboard-supplier-header" role="row">
              <span>Поставщик</span>
              <span>Договор</span>
              <span>Соглашение</span>
              <span>Позиций</span>
            </div>

            {filteredSuppliers.map((supplier) => {
              const isExpanded = hasActiveAnalysisFilters || expandedSuppliers.includes(supplier.id);

              return (
                <section className="dashboard-supplier-group" key={supplier.id}>
                  <button
                    className="dashboard-supplier-row"
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleSupplier(supplier.id)}
                  >
                    <span className="dashboard-supplier-row__name">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                      <span>
                        <strong>{supplier.name}</strong>
                        <small>{supplier.category}</small>
                      </span>
                    </span>
                    <span>{supplier.contract}</span>
                    <span>{supplier.agreement}</span>
                    <span>{supplier.visibleItems.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="dashboard-items-table">
                      <table>
                        <colgroup>
                          {visibleAnalysisColumnsConfig.map((column) => (
                            <col key={column.key} style={{ width: `${column.width}px` }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr>
                            {visibleAnalysisColumnsConfig.map((column) => (
                              <th className={column.align ? `is-${column.align}` : undefined} key={column.key}>
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {supplier.visibleItems.map((item) => (
                              <tr key={item.code}>
                                {visibleAnalysisColumnsConfig.map((column) => (
                                  <td className={column.align ? `is-${column.align}` : undefined} key={column.key}>
                                    {column.key === 'plannedDeliveryQty' ? (
                                      <input
                                        aria-label={`Количество поставки ${item.code}`}
                                        className="dashboard-table-input"
                                        inputMode="numeric"
                                        value={item.plannedDeliveryQty ? formatNumber(item.plannedDeliveryQty) : ''}
                                        readOnly
                                      />
                                    ) : column.key === 'deliveryDate' ? (
                                      <input
                                        aria-label={`Дата поставки ${item.code}`}
                                        className="dashboard-table-input dashboard-table-input--date"
                                        value={item.deliveryDate}
                                        readOnly
                                      />
                                    ) : column.key === 'status' ? (
                                      <span className={`dashboard-status dashboard-status--${item.status}`}>
                                        {statusLabels[item.status]}
                                      </span>
                                    ) : (
                                      getAnalysisCellValue(item, column.key) || '—'
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
