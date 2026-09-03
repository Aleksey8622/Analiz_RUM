import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  hydrateWorkspaceSettings,
  setAnalysisAdvancedFilters,
  setAnalysisSearch,
  setSupplyAdvancedFilters,
  setSupplySearch,
  setSelectedReportDate,
  setWorkspaceSection,
  toggleAnalysisColumn,
  toggleSupplyColumn,
  toggleSupplyFilterValue,
  type AnalysisColumnKey,
  type SupplyColumnKey,
  type SupplyReportRow,
} from '../../store/workspaceSlice';
import { SourceReport, type SourceReportColumn, type SourceReportRow } from './SourceReport';
import { ItemsDirectory, type DirectoryPosition } from './ItemsDirectory';
import { BomSearch } from './BomSearch';
import { SleeveAnalysis } from './SleeveAnalysis';
import { useDraggableModal } from '../../components/ui/useDraggableModal';
import { DashboardSkeleton, DelektoLoader } from '../../components/ui/DelektoLoader';
import { exportAnalysisWorkbook, exportSupplyWorkbook } from './exportWorkbook';
import type { DataState } from '../../types/desktop';
import './DashboardPage.css';

type FilterRow = {
  id: number;
  field: string;
  operator: string;
  value: string;
};

type FilterInputName = Exclude<keyof FilterRow, 'id'>;

type StockStatus = 'critical' | 'low' | 'blocked' | 'normal' | 'check';
type WorkspaceSection = 'analysis' | 'sleeves' | 'supply-plan' | 'bom' | 'supply-report' | 'items-directory';

type PackagingItem = {
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

type SelectedPackagingItem = {
  item: PackagingItem;
  supplier: Supplier;
};

type SupplierPlanRow = {
  quantity: number;
  date: string;
};

type SavedSupplyPlan = SupplierPlanRow & {
  supplierId: string;
  itemCode: string;
};

type PackagingCategoryGroup = {
  id: string;
  title: string;
  description: string;
  suppliers: SupplierView[];
  itemCount: number;
};

const suppliers: Supplier[] = [];

const analysisFilterFields = ['Код позиции', 'Название позиции', 'Поставщик'];
const analysisFilterFieldSet = new Set(analysisFilterFields);
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
  'Название позиции': 'name',
  Позиция: 'name',
};

const statusLabels: Record<StockStatus, string> = {
  critical: 'Критично',
  low: 'Низкий запас',
  blocked: 'Есть блок',
  normal: 'Норма',
  check: 'Проверить',
};

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value);

const formatDays = (value: number | null) => (value === null ? 'Нет данных' : `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} дн.`);

const getDaysUntil = (value: string) => {
  const [day, month, year] = value.split('.').map(Number);

  if (!day || !month || !year) return 0;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(year, month - 1, day);

  if (Number.isNaN(target.getTime())) return 0;

  return Math.max(0, Math.ceil((target.getTime() - start.getTime()) / 86_400_000));
};

const calculatePlannedStock = (item: PackagingItem, plan: SupplierPlanRow) => {
  const daysUntilDelivery = getDaysUntil(plan.date);
  const stockOnDelivery = Math.max(0, item.totalStock - item.dailyForecast * daysUntilDelivery);
  const futureStock = stockOnDelivery + plan.quantity;

  return {
    currentDays: item.totalStock / Math.max(item.dailyForecast, 1),
    stockOnDelivery,
    futureStock,
    futureDays: futureStock / Math.max(item.dailyForecast, 1),
  };
};

const loadSavedSupplyPlans = (): SavedSupplyPlan[] => {
  try {
    const saved = window.localStorage.getItem('analiz-rum:supply-plans');
    return saved ? JSON.parse(saved) as SavedSupplyPlan[] : [];
  } catch {
    return [];
  }
};

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
    'Название позиции': 'Название или часть названия; можно вставить список',
    'Дата заказа': 'Дата формирования заказа',
    'Номер заказа': 'Номер заказа или список заказов',
    'Код товара': 'Код товара или список кодов',
  };

  return placeholders[field] ?? 'Введите значение или список значений';
};

const analysisColumns: AnalysisColumn[] = [
  { key: 'code', label: 'Код', width: 108 },
  { key: 'name', label: 'Наименование позиции', width: 300 },
  { key: 'dailyForecast', label: 'Прогноз/день', width: 112, align: 'right' },
  { key: 'stockDays', label: 'ТЗ склад, дн.', width: 112, align: 'right' },
  { key: 'stockProductionDays', label: 'ТЗ склад+пр-во, дн.', width: 142, align: 'right' },
  { key: 'blocked', label: 'Запас в блоке', width: 112, align: 'right' },
  { key: 'warehouse', label: 'Остаток склада, шт.', width: 150, align: 'right' },
  { key: 'production', label: 'Остаток производства, шт.', width: 175, align: 'right' },
  { key: 'totalStock', label: 'Общий остаток, шт.', width: 150, align: 'right' },
  { key: 'supplyRemainder', label: 'Остаток поставки', width: 135, align: 'right' },
  { key: 'status', label: 'Статус', width: 100, align: 'center' },
];

const supplyPlanColumns: SourceReportColumn[] = [
  { key: 'itemCode', label: 'Код', width: 115 },
  { key: 'itemName', label: 'Наименование позиции', width: 280 },
  { key: 'supplier', label: 'Поставщик', width: 190 },
  { key: 'currentStock', label: 'Текущий остаток', width: 145, align: 'right' },
  { key: 'currentDays', label: 'Текущий ТЗ', width: 115, align: 'right' },
  { key: 'quantity', label: 'План поставки', width: 145, align: 'right' },
  { key: 'date', label: 'Дата поставки', width: 135, align: 'center' },
  { key: 'futureStock', label: 'Будущий остаток', width: 155, align: 'right' },
  { key: 'futureDays', label: 'Будущий ТЗ', width: 120, align: 'right' },
];

const getAnalysisColumnGroup = (columnKey: AnalysisColumnKey) => {
  if (columnKey === 'code' || columnKey === 'name') return 'position';
  if (['dailyForecast', 'stockDays', 'stockProductionDays'].includes(columnKey)) return 'coverage';
  if (['blocked', 'warehouse', 'production', 'totalStock'].includes(columnKey)) return 'stock';
  if (['supplyRemainder', 'plannedDeliveryQty', 'deliveryDate'].includes(columnKey)) return 'delivery';
  return 'result';
};

const getAnalysisCellValue = (item: PackagingItem, columnKey: AnalysisColumnKey) => {
  if (item.missingData?.includes(columnKey)) return 'Нет данных';
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
  { key: 'weekOrDebt', label: 'Номер недели/долг', width: 135 },
  { key: 'supplyRemainder', label: 'Остаток поставки', width: 140, align: 'right' },
  { key: 'supplierCode', label: 'Поставщик', width: 130 },
  { key: 'supplierName', label: 'Наименование поставщика', width: 220 },
  { key: 'orderCreatedAt', label: 'Дата заказа', width: 125 },
  { key: 'plannedDeliveryAt', label: 'Плановая дата поставки', width: 160 },
  { key: 'deliveredAt', label: 'Дата поставлено', width: 130 },
  { key: 'orderNumber', label: '№ заказа', width: 130 },
  { key: 'itemCode', label: '№ товара', width: 115 },
  { key: 'itemName', label: 'Наименование товара', width: 260 },
  { key: 'orderedQty', label: 'Количество заказано', width: 150, align: 'right' },
  { key: 'deliveredQty', label: 'Количество поставлено', width: 155, align: 'right' },
  { key: 'orderType', label: 'ВидЗаказаНаПоставку', width: 165, align: 'center' },
  { key: 'deleted', label: 'Удалено', width: 95, align: 'center' },
  { key: 'returnFlag', label: 'Возврат', width: 95, align: 'center' },
  { key: 'orderStatus', label: 'Наименование статуса заказа', width: 195 },
  { key: 'unit', label: 'Единица измерения', width: 130, align: 'center' },
];

const supplyRows: SupplyReportRow[] = [];



const initialDirectoryRows: DirectoryPosition[] = [];

function DashboardPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const workspaceSettings = useAppSelector((state) => state.workspace);
  const {
    activeSupplyView,
    analysisFilters,
    savedSupplyViews,
    supplyFilters,
    visibleAnalysisColumns,
    visibleSupplyColumns,
    settingsHydrated,
  } = workspaceSettings;
  const [activeSection, setActiveSectionLocal] = useState<WorkspaceSection>('analysis');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterRow[]>([]);
  const [expandedSuppliers, setExpandedSuppliers] = useState<string[]>([]);
  const [expandedPackagingSections, setExpandedPackagingSections] = useState<string[]>([]);
  const [selectedPackagingItem, setSelectedPackagingItem] = useState<SelectedPackagingItem | null>(null);
  const [selectedSupplierPlan, setSelectedSupplierPlan] = useState<Supplier | null>(null);
  const [supplierPlanRows, setSupplierPlanRows] = useState<Record<string, SupplierPlanRow>>({});
  const [savedSupplyPlans, setSavedSupplyPlans] = useState<SavedSupplyPlan[]>(loadSavedSupplyPlans);
  const [planningQuantity, setPlanningQuantity] = useState(0);
  const [planningDate, setPlanningDate] = useState('');
  const [dataState, setDataState] = useState<DataState | null>(null);
  const [dataMessage, setDataMessage] = useState('');
  const [isUpdatingData, setIsUpdatingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [visibleSupplyLimit, setVisibleSupplyLimit] = useState(500);
  const todayDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const [updateDate, setUpdateDateLocal] = useState(todayDate);
  const setActiveSection = (section: WorkspaceSection) => { setActiveSectionLocal(section); dispatch(setWorkspaceSection(section)); };
  const setUpdateDate = (date: string) => { setUpdateDateLocal(date); dispatch(setSelectedReportDate(date)); };
  const dateLoadBusy = useRef(false);
  const [directoryPositions, setDirectoryPositions] = useState<DirectoryPosition[]>(initialDirectoryRows);
  const filterModalDrag = useDraggableModal(isFilterPanelOpen);
  const supplierPlanModalDrag = useDraggableModal(Boolean(selectedSupplierPlan));
  const itemDetailsModalDrag = useDraggableModal(Boolean(selectedPackagingItem));
  const sidebarRef = useRef<HTMLElement>(null);
  const filterAreaRef = useRef<HTMLDivElement>(null);
  const columnAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.analizRum?.getDataState().then((next) => { setDataState(next); if (next.selectedDate) setUpdateDate(next.selectedDate); }).catch((error: unknown) =>
      setDataMessage(error instanceof Error ? error.message : 'Не удалось открыть базу данных'));
    // Initial database hydration intentionally runs once on desktop startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataState) return;
    setDirectoryPositions(dataState.directoryRows.map((row) => ({ ...row, showInAnalysis: Boolean(row.showInAnalysis) })));
  }, [dataState]);

  // AR-ARCHIVE-V1: calendar reads saved history, Update explicitly rereads files.
  useEffect(() => {
    if (!window.analizRum?.getWorkspaceSettings) { dispatch(hydrateWorkspaceSettings({})); return; }
    window.analizRum.getWorkspaceSettings().then((settings) => {
      dispatch(hydrateWorkspaceSettings(settings));
      if (typeof settings.activeSection === 'string') setActiveSectionLocal(settings.activeSection as WorkspaceSection);
      if (typeof settings.selectedReportDate === 'string') setUpdateDateLocal(settings.selectedReportDate);
    }).catch(() => dispatch(hydrateWorkspaceSettings({})));
  }, [dispatch]);

  useEffect(() => {
    if (!settingsHydrated || !window.analizRum?.saveWorkspaceSettings) return;
    const persistedSettings = { ...workspaceSettings, settingsHydrated: undefined };
    const timer = window.setTimeout(() => { window.analizRum?.saveWorkspaceSettings(persistedSettings).catch(() => undefined); }, 200);
    return () => window.clearTimeout(timer);
  }, [settingsHydrated, workspaceSettings]);

  const loadSelectedDate = async (date: string, refresh: boolean) => {
    if (!date || dateLoadBusy.current) return;
    if (!window.analizRum) { setDataMessage('Обновление SQLite доступно в desktop-версии приложения.'); return; }
    dateLoadBusy.current = true;
    setUpdateDate(date);
    setIsUpdatingData(true); setDataMessage(date < todayDate() ? `Открываю архив за ${date}…` : 'Открываю данные…');
    try {
      const next = refresh ? await window.analizRum.updateData(date) : await window.analizRum.getSnapshot(date);
      setDataState(next);
      setDataMessage(next.imported?.length ? `Отчёты за ${next.selectedDate} загружены и сохранены` : next.imports.length ? `Показаны сохранённые данные за ${next.selectedDate}` : `За ${date} данных пока нет. Нажмите «Обновить данные».`);
    } catch (error) {
      if (dataState?.selectedDate) setUpdateDate(dataState.selectedDate);
      setDataMessage(error instanceof Error ? error.message : 'Ошибка загрузки данных');
    }
    finally { dateLoadBusy.current = false; setIsUpdatingData(false); }
  };
  const updateDatabase = () => loadSelectedDate(updateDate, true);

  const analysisSuppliers = useMemo<Supplier[]>(() => {
    const forecasts = new Map((dataState?.forecastTotals ?? []).map(row => [row.materialNumber, row.dailyForecast]));
    const stockByMaterial = new Map((dataState?.stockTotals ?? []).map((row) => [String(row.materialNumber).replace(/^0+(?=\d)/, ''), row]));
    const supplyByMaterial = new Map((dataState?.supplyTotals ?? []).map((row) => [String(row.materialNumber).replace(/^0+(?=\d)/, ''), row.supplyRemainder]));
    const nextSuppliers = (dataState ? [] : suppliers).map((supplier) => ({
      ...supplier,
      items: supplier.items.map((item) => {
        const key = item.code.replace(/^0+(?=\d)/, '');
        const stock = stockByMaterial.get(key);
        if (!stock && !supplyByMaterial.has(key)) return item;
        const warehouse = Number(stock?.warehouse ?? 0);
        const production = Number(stock?.production ?? 0);
        const totalStock = warehouse + production;
        return { ...item, warehouse, production, blocked: Number(stock?.blocked ?? 0), totalStock, supplyRemainder: Number(supplyByMaterial.get(key) ?? 0), stockDays: item.dailyForecast > 0 ? (warehouse / item.dailyForecast) : null, stockProductionDays: item.dailyForecast > 0 ? (totalStock / item.dailyForecast) : null };
      }),
    }));

    const isAnalysisExcludedCategory = (category: string) => /обечайк|этикетк/i.test(category);
    directoryPositions
      .filter((row) => row.showInAnalysis && !isAnalysisExcludedCategory(row.category))
      .forEach((row) => {
      const analysisCategory = row.category.trim() || 'Без категории';
      let supplier = nextSuppliers.find((candidate) =>
        candidate.name === row.supplier && candidate.category === analysisCategory,
      );

      if (!supplier) {
        supplier = {
          id: `directory-${row.supplier.toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9]+/gi, '-')}-${analysisCategory.toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9]+/gi, '-')}`,
          name: row.supplier,
          contract: row.contractNumber,
          agreement: row.basketNumber,
          category: analysisCategory,
          items: [],
        };
        nextSuppliers.push(supplier);
      }

      if (!supplier.items.some((item) => item.code === row.plu)) {
        supplier.items.push({
          code: row.plu,
          name: row.name,
          palletMultiple: row.piecesPerPallet,
          dailyForecast: 0,
          stockDays: null,
          stockProductionDays: null,
          blocked: 0,
          warehouse: 0,
          production: 0,
          totalStock: 0,
          supplyRemainder: 0,
          plannedDeliveryQty: 0,
          deliveryDate: '',
          stockDaysOnDelivery: null,
          futureStockDays: null,
          status: 'check',
        });
      }
    });

    // AR-CURRENT-DIRECTORY-V2: join reports after constructing the current list.
    return dataState ? nextSuppliers.map((supplier) => ({ ...supplier, items: supplier.items.map((item) => {
      const key = item.code.trim().replace(/^0+(?=\d)/, '');
      const stock = stockByMaterial.get(key);
      const warehouse = Number(stock?.warehouse ?? 0);
      const production = Number(stock?.production ?? 0);
      const dailyForecast = forecasts.get(key.toUpperCase()) ?? 0;
      return { ...item, dailyForecast, stockDays: dailyForecast > 0 ? (warehouse / dailyForecast) : null, stockProductionDays: dailyForecast > 0 ? ((warehouse + production) / dailyForecast) : null, warehouse, production, totalStock: warehouse + production,
        blocked: Number(stock?.blocked ?? 0), supplyRemainder: Number(supplyByMaterial.get(key) ?? 0),
        missingData: [...(!stock ? ['warehouse', 'production', 'totalStock', 'blocked'] : []), ...(!supplyByMaterial.has(key) ? ['supplyRemainder'] : [])],
      };
    }) })) : nextSuppliers;
  }, [dataState, directoryPositions]);

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
      (filter) => analysisFilterFieldSet.has(filter.field) && filter.operator && filter.value,
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

    return analysisSuppliers.flatMap((supplier) => {
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

      const itemsAfterSearch = supplierMatchesSearch ? supplier.items : matchingItemsBySearch;
      const visibleItems = itemsAfterSearch.filter((item) => {
        const passesAdvancedFilters = activeAdvancedFilters
          .filter((filter) => !analysisSupplierFields.has(filter.field))
          .every((filter) => {
            const fieldKey = analysisItemFieldMap[filter.field];

            if (!fieldKey) {
              return true;
            }

            const value = fieldKey === 'statusLabel' ? statusLabels[item.status] : item[fieldKey];
            return matchValue(value as string | number | null, filter.operator, filter.value);
          });

        return passesAdvancedFilters;
      });

      if (!supplierMatchesSearch && matchingItemsBySearch.length === 0) {
        return [];
      }

      if ((hasSearch || hasItemFilters) && visibleItems.length === 0) {
        return [];
      }

      return [{ ...supplier, visibleItems }];
    });
  }, [analysisFilters, analysisSuppliers]);

  const visibleAnalysisItemCount = useMemo(
    () => filteredSuppliers.reduce((total, supplier) => total + supplier.visibleItems.length, 0),
    [filteredSuppliers],
  );

  const pageStats = useMemo(() => {
    const items = filteredSuppliers.flatMap((supplier) => supplier.visibleItems);

    return {
      suppliers: filteredSuppliers.length,
      items: items.length,
      critical: items.filter((item) => item.status === 'critical').length,
      blocked: items.filter((item) => item.blocked > 0).length,
    };
  }, [filteredSuppliers]);

  const calculationDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dataState?.selectedDate ? new Date(dataState.selectedDate + 'T12:00:00') : new Date()).replace(' г.', '');

  const supplyPlanRows = useMemo<SourceReportRow[]>(() =>
    savedSupplyPlans.flatMap((plan) => {
      const supplier = analysisSuppliers.find((candidate) => candidate.id === plan.supplierId);
      const item = supplier?.items.find((candidate) => candidate.code === plan.itemCode);

      if (!supplier || !item) return [];

      const calculated = calculatePlannedStock(item, plan);

      return [{
        id: `${plan.supplierId}-${plan.itemCode}`,
        itemCode: item.code,
        itemName: item.name,
        supplier: supplier.name,
        currentStock: formatNumber(item.totalStock),
        currentDays: formatDays(calculated.currentDays),
        quantity: formatNumber(plan.quantity),
        date: plan.date || '—',
        futureStock: formatNumber(calculated.futureStock),
        futureDays: formatDays(calculated.futureDays),
      }];
    }),
  [analysisSuppliers, savedSupplyPlans]);

  const groupedFilteredSuppliers = useMemo<PackagingCategoryGroup[]>(() => {
    return [...new Set(filteredSuppliers.map((supplier) => supplier.category.trim()).filter(Boolean))]
      .map((category) => {
        const sectionSuppliers = filteredSuppliers.filter((supplier) => supplier.category === category);

        return {
          id: `category-${category.toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9]+/gi, '-')}`,
          title: `${category} · ФК Долгопрудный`,
          description: `Категория из справочника: ${category}`,
          suppliers: sectionSuppliers,
          itemCount: sectionSuppliers.reduce((total, supplier) => total + supplier.visibleItems.length, 0),
        };
      })
      .filter((section) => section.suppliers.length > 0);
  }, [filteredSuppliers]);

  const orderedVisibleSupplyColumns = useMemo(
    () =>
      visibleSupplyColumns
        .map((columnKey) => supplyColumns.find((column) => column.key === columnKey))
        .filter((column): column is SupplyColumn => Boolean(column)),
    [visibleSupplyColumns],
  );

  const currentSupplyRows = (dataState?.supplyRows ?? supplyRows) as SupplyReportRow[];

  const filteredSupplyRows = useMemo(() => {
    const matchesText = (source: string | number, search: string) =>
      String(source).toLowerCase().includes(search.toLowerCase());

    return currentSupplyRows.filter((row) => {
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
  }, [currentSupplyRows, supplyFilters]);

  useEffect(() => setVisibleSupplyLimit(500), [currentSupplyRows, supplyFilters]);

  const visibleSupplyRows = useMemo(
    () => filteredSupplyRows.slice(0, visibleSupplyLimit),
    [filteredSupplyRows, visibleSupplyLimit],
  );

  const filteredSupplyStats = useMemo(
    () => ({
      orders: new Set(filteredSupplyRows.map((row) => row.orderNumber)).size,
      open: filteredSupplyRows.filter((row) => row.orderStatus !== 'Закрыт').length,
      debt: filteredSupplyRows.filter((row) => row.weekOrDebt === 'Долг').length,
      remainder: filteredSupplyRows.reduce((sum, row) => sum + Number(row.supplyRemainder), 0),
    }),
    [filteredSupplyRows],
  );

  useEffect(() => {
    window.localStorage.setItem('analiz-rum:supply-plans', JSON.stringify(savedSupplyPlans));
  }, [savedSupplyPlans]);

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

    setDraftFilters(
      activeSection === 'supply-report'
        ? supplyFilters.advanced
        : analysisFilters.advanced.filter((filter) => analysisFilterFieldSet.has(filter.field)),
    );
  }, [activeSection, analysisFilters.advanced, isFilterPanelOpen, supplyFilters.advanced]);

  useEffect(() => {
    const hasAnalysisFilter = analysisFilters.advanced.some(
      (filter) => analysisFilterFieldSet.has(filter.field) && filter.value.trim(),
    );

    if (!hasAnalysisFilter) {
      return;
    }

    setExpandedSuppliers(filteredSuppliers.map((supplier) => supplier.id));
    setExpandedPackagingSections(groupedFilteredSuppliers.map((section) => section.id));
  }, [analysisFilters.advanced, filteredSuppliers, groupedFilteredSuppliers]);

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

    return filters.filter(
      (filter) =>
        (activeSection === 'supply-report' || analysisFilterFieldSet.has(filter.field)) &&
        (filter.field || filter.operator || filter.value),
    );
  }, [activeSection, analysisFilters.advanced, supplyFilters.advanced]);

  const currentFilterFields =
    activeSection === 'supply-report'
      ? supplyFilterFields
      : analysisFilterFields;

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
      .filter(
        (filter) =>
          (activeSection === 'supply-report' || analysisFilterFieldSet.has(filter.field)) &&
          filter.field &&
          filter.value.trim(),
      );

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

  const exportCurrentSection = async () => {
    setIsExporting(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
    try {
      if (activeSection === 'supply-report') {
        exportSupplyWorkbook(filteredSupplyRows, orderedVisibleSupplyColumns);
        return;
      }

      exportAnalysisWorkbook(groupedFilteredSuppliers);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers((current) =>
      current.includes(supplierId)
        ? current.filter((expandedSupplierId) => expandedSupplierId !== supplierId)
        : [...current, supplierId],
    );
  };

  const togglePackagingSection = (sectionId: string) => {
    setExpandedPackagingSections((current) =>
      current.includes(sectionId)
        ? current.filter((expandedSectionId) => expandedSectionId !== sectionId)
        : [...current, sectionId],
    );
  };

  const areAllSuppliersExpanded = analysisSuppliers.every((supplier) => expandedSuppliers.includes(supplier.id));

  const toggleAllSuppliers = () => {
    setExpandedSuppliers(areAllSuppliersExpanded ? [] : analysisSuppliers.map((supplier) => supplier.id));
  };

  const openPackagingItem = (item: PackagingItem, supplier: Supplier) => {
    setSelectedSupplierPlan(null);
    setSelectedPackagingItem({ item, supplier });
    setPlanningQuantity(item.plannedDeliveryQty);
    setPlanningDate(item.deliveryDate);
  };

  const openSupplierPlan = (supplier: Supplier) => {
    setSelectedPackagingItem(null);
    setSupplierPlanRows(Object.fromEntries(supplier.items.map((item) => [
      item.code,
      { quantity: item.plannedDeliveryQty, date: item.deliveryDate },
    ])));
    setSelectedSupplierPlan(supplier);
  };

  const updateSupplierPlan = (code: string, field: keyof SupplierPlanRow, value: string) => {
    setSupplierPlanRows((current) => ({
      ...current,
      [code]: {
        ...(current[code] ?? { quantity: 0, date: '' }),
        [field]: field === 'quantity' ? Number(value) : value,
      },
    }));
  };

  const saveSupplierPlan = () => {
    if (!selectedSupplierPlan) return;

    const nextSupplierPlans = selectedSupplierPlan.items.flatMap((item) => {
      const plan = supplierPlanRows[item.code] ?? { quantity: 0, date: '' };

      return plan.quantity > 0
        ? [{ supplierId: selectedSupplierPlan.id, itemCode: item.code, ...plan }]
        : [];
    });

    setSavedSupplyPlans((current) => [
      ...current.filter((plan) => plan.supplierId !== selectedSupplierPlan.id),
      ...nextSupplierPlans,
    ]);
    setSelectedSupplierPlan(null);
    setActiveSection('supply-plan');
  };

  const saveSingleItemPlan = () => {
    if (!selectedPackagingItem || planningQuantity <= 0) return;

    const nextPlan: SavedSupplyPlan = {
      supplierId: selectedPackagingItem.supplier.id,
      itemCode: selectedPackagingItem.item.code,
      quantity: planningQuantity,
      date: planningDate,
    };

    setSavedSupplyPlans((current) => [
      ...current.filter((plan) =>
        plan.supplierId !== nextPlan.supplierId || plan.itemCode !== nextPlan.itemCode,
      ),
      nextPlan,
    ]);
    setSelectedPackagingItem(null);
    setActiveSection('supply-plan');
  };

  const plannedPallets = selectedPackagingItem
    ? Math.ceil(planningQuantity / Math.max(selectedPackagingItem.item.palletMultiple ?? 1, 1))
    : 0;
  const selectedItemPlanCalculation = selectedPackagingItem
    ? calculatePlannedStock(selectedPackagingItem.item, { quantity: planningQuantity, date: planningDate })
    : null;

  const sectionTitles: Record<WorkspaceSection, { title: string; description: string }> = {
    analysis: { title: 'Анализ запасов упаковки', description: 'Поставщики, покрытие в днях и фактический остаток по позициям' },
    sleeves: { title: 'Анализ запасов обечаек', description: 'Остатки, недельные поставки, форматы и планирование общего заказа' },
    'supply-plan': { title: 'План поставки', description: 'Сохранённые позиции, текущий остаток и будущий ТЗ' },
    'supply-report': { title: 'Отчёт поставки', description: 'SAP-заказы, остаток поставки, плановые даты и статус отгрузки' },
    bom: { title: 'Разузловка упаковки', description: 'Состав упаковочных позиций и расход материалов по данным SAP' },
    'items-directory': { title: 'Справочник позиций', description: 'Единый перечень упаковки, поставщиков и паллетной кратности' },
  };

  const openSection = (section: WorkspaceSection) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
    setIsFilterPanelOpen(false);
    setIsColumnPanelOpen(false);
  };

  return (
    <main className="dashboard-page">
      {(isUpdatingData || isExporting) && (
        <DelektoLoader overlay label={isUpdatingData ? 'Обновляю данные и базу…' : 'Формирую файл экспорта…'} />
      )}
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
        <div className="dashboard-sidebar__brand" aria-hidden={!isSidebarOpen}>
          <span>AR</span>
          <strong>Analiz_RUM</strong>
        </div>
        <nav className="dashboard-sidebar__nav">
          <button
            className={activeSection === 'analysis' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('analysis')}
          >
            Анализ
          </button>
          <button
            className={activeSection === 'sleeves' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('sleeves')}
          >
            Обечайки
          </button>
          <button
            className={activeSection === 'supply-plan' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('supply-plan')}
          >
            План поставки
          </button>
          <button
            className={activeSection === 'supply-report' ? 'is-active' : ''}
            type="button"
            onClick={() => openSection('supply-report')}
          >
            Поставки
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
        <button
          className="dashboard-sidebar__logout"
          type="button"
          onClick={() => navigate('/')}
          aria-label="Выход"
        >
          <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 6H6v12h4M13 8l4 4-4 4M8 12h9" />
          </svg>
          <span>Выйти</span>
        </button>
      </aside>

      <section className="dashboard-workspace">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-header__label">DELEKTO · АНАЛИЗ</span>
            <h1>{sectionTitles[activeSection].title}</h1>
            <p>{sectionTitles[activeSection].description}</p>
            {activeSection === 'analysis' && (
              <div className="dashboard-header__context">
                <span>Расчёт на {calculationDate}</span>
              </div>
            )}
          </div>
          <div className={`dashboard-header__actions ${activeSection === 'analysis' || activeSection === 'supply-report' ? '' : 'is-hidden'}`}>
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
            <button type="button" className="dashboard-button dashboard-button--secondary" disabled={isExporting} onClick={exportCurrentSection}>
              {isExporting ? 'Экспорт…' : 'Экспорт'}
            </button>
            {activeSection === 'analysis' && <input className="dashboard-update-date" type="date" value={updateDate} max={todayDate()} disabled={isUpdatingData} onChange={(event) => void loadSelectedDate(event.target.value, false)} aria-label="Дата отчётов" />}
            {activeSection === 'analysis' && <button type="button" className="dashboard-button dashboard-button--primary" disabled={isUpdatingData} onClick={updateDatabase}>{isUpdatingData ? 'Обновление…' : updateDate < todayDate() ? 'Перечитать из архива' : 'Обновить данные'}</button>}
          </div>
        </header>
        {activeSection === 'analysis' && dataMessage && <div className="dashboard-update-message">{dataMessage}</div>}

        {activeSection === 'analysis' ? (
          <section className="dashboard-summary dashboard-summary--analysis" aria-label="Сводка по упаковке">
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
              <span>Позиций в блоке</span>
              <strong>{pageStats.blocked}</strong>
            </article>
          </section>
        ) : activeSection === 'supply-report' ? (
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
        ) : null}

        {activeSection === 'analysis' && (
          <div className="dashboard-viewbar dashboard-viewbar--compact">
            <div className="dashboard-viewbar__result">
              <span>{visibleAnalysisItemCount} позиций</span>
              <button type="button" onClick={toggleAllSuppliers} aria-label={areAllSuppliersExpanded ? 'Свернуть группы' : 'Раскрыть все группы'} title={areAllSuppliersExpanded ? 'Свернуть группы' : 'Раскрыть все группы'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: areAllSuppliersExpanded ? 'rotate(-90deg)' : 'rotate(90deg)' }}><path d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </div>
        )}

        <div className={`dashboard-toolbar ${activeSection === 'analysis' ? 'dashboard-toolbar--analysis' : ''} ${activeSection === 'analysis' || activeSection === 'supply-report' ? '' : 'is-hidden'}`}>
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
          {activeSection === 'supply-report' ? (
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
          ) : null}
        </div>

        <div className={`dashboard-filters ${activeSection === 'analysis' || activeSection === 'supply-report' ? '' : 'is-hidden'}`} ref={filterAreaRef} aria-label="Фильтры анализа">
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
              <aside className="dashboard-filter-panel draggable-modal" style={filterModalDrag.dragStyle} aria-label="Коллектор фильтров">
                <div className="dashboard-filter-panel__header draggable-modal__handle" {...filterModalDrag.dragHandleProps}>
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
          {!dataState && !dataMessage ? (
            <DashboardSkeleton />
          ) : activeSection === 'supply-plan' ? (
            supplyPlanRows.length > 0 ? (
              <SourceReport
                caption="План поставки"
                columns={supplyPlanColumns}
                rows={supplyPlanRows}
                onDeleteRow={(row) => setSavedSupplyPlans((current) =>
                  current.filter((plan) => plan.itemCode !== String(row.itemCode)),
                )}
              />
            ) : (
              <div className="dashboard-empty-state dashboard-empty-state--plan">
                <strong>План поставки пока пуст</strong>
                <span>Откройте раздел «Анализ», нажмите «Заказать» у позиции и сохраните план.</span>
              </div>
            )
          ) : activeSection === 'sleeves' ? (
            <SleeveAnalysis directoryPositions={directoryPositions} stockTotals={dataState?.stockTotals} forecastTotals={dataState?.forecastTotals} />
          ) : activeSection === 'supply-report' ? (
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
                    {visibleSupplyRows.map((row) => (
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
              {visibleSupplyRows.length < filteredSupplyRows.length && (
                <button className="source-report__load-more" type="button" onClick={() => setVisibleSupplyLimit((current) => current + 500)}>
                  Показать ещё 500 · осталось {filteredSupplyRows.length - visibleSupplyRows.length}
                </button>
              )}
            </div>
          ) : activeSection === 'bom' ? (
            <BomSearch state={dataState} onChange={setDataState} />
          ) : activeSection === 'items-directory' ? (
            <ItemsDirectory key={dataState?.selectedDate ?? 'empty'} initialRows={directoryPositions} onRowsChange={setDirectoryPositions} />
          ) : (
            <div className="dashboard-supplier-shell">
            {groupedFilteredSuppliers.map((categoryGroup) => (
              <section className="dashboard-category-group" key={categoryGroup.id}>
                <button
                  className="dashboard-category-header"
                  type="button"
                  aria-expanded={expandedPackagingSections.includes(categoryGroup.id)}
                  onClick={() => togglePackagingSection(categoryGroup.id)}
                >
                  <span className="dashboard-category-header__name">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                    <span>
                      <strong>{categoryGroup.title}</strong>
                      <small>{categoryGroup.description}</small>
                    </span>
                  </span>
                  <span className="dashboard-category-header__meta">
                    <span>Количество поставщиков: {categoryGroup.suppliers.length}</span>
                    <strong>Количество позиций: {categoryGroup.itemCount}</strong>
                  </span>
                </button>
                {expandedPackagingSections.includes(categoryGroup.id) && (
                  <div className="dashboard-category-suppliers">
                    {categoryGroup.suppliers.map((supplier) => {
                      const isExpanded = expandedSuppliers.includes(supplier.id);

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
                        <span className="dashboard-supplier-summary-field">
                          <small>Поставщик</small>
                          <strong>{supplier.name}</strong>
                        </span>
                      </span>
                      <span className="dashboard-supplier-summary-field">
                        <small>Соглашение</small>
                        <strong>{supplier.agreement || '—'}</strong>
                      </span>
                      <span className="dashboard-supplier-summary-field dashboard-supplier-summary-field--positions">
                        <small>Позиции</small>
                        <strong>{supplier.visibleItems.length}</strong>
                      </span>
                    </button>

                  {isExpanded && (
                    <div className="dashboard-items-table">
                      <table>
                        <colgroup>
                          {visibleAnalysisColumnsConfig.map((column) => (
                            <col key={column.key} style={{ width: `${column.width}px` }} />
                          ))}
                          <col style={{ width: '110px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            {visibleAnalysisColumnsConfig.map((column) => (
                              <th
                                className={[
                                  column.align ? `is-${column.align}` : '',
                                  `is-group-${getAnalysisColumnGroup(column.key)}`,
                                  column.key === 'code' || column.key === 'name' ? `is-sticky-${column.key}` : '',
                                ].filter(Boolean).join(' ')}
                                key={column.key}
                              >
                                {column.label}
                              </th>
                            ))}
                            <th className="is-group-result dashboard-items-table__plan-header">
                              Планировать поставку
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplier.visibleItems.map((item) => (
                              <tr
                                className={selectedPackagingItem?.item.code === item.code ? 'is-selected' : ''}
                                key={item.code}
                                onClick={() => openPackagingItem(item, supplier)}
                              >
                                {visibleAnalysisColumnsConfig.map((column) => (
                                  <td
                                    className={[
                                      column.align ? `is-${column.align}` : '',
                                      column.key === 'code' || column.key === 'name' ? `is-sticky-${column.key}` : '',
                                    ].filter(Boolean).join(' ')}
                                    key={column.key}
                                  >
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
                                <td className="dashboard-items-table__plan-cell">
                                  <button
                                    className="dashboard-item-plan-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openSupplierPlan(supplier);
                                    }}
                                  >
                                    Заказать
                                  </button>
                                </td>
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
              </section>
            ))}
            {filteredSuppliers.length === 0 && (
              <div className="dashboard-empty-state">
                <strong>По выбранным условиям ничего не найдено</strong>
                <span>Измените строку поиска или условия фильтра.</span>
              </div>
            )}
          </div>
          )}
        </div>
      </section>

      {selectedSupplierPlan && (
        <>
          <button
            className="dashboard-details-backdrop"
            type="button"
            aria-label="Закрыть планирование поставщика"
            onClick={() => setSelectedSupplierPlan(null)}
          />
          <aside className="supplier-planning draggable-modal" style={supplierPlanModalDrag.dragStyle} aria-label="Планирование поставщика">
            <header className="supplier-planning__header draggable-modal__handle" {...supplierPlanModalDrag.dragHandleProps}>
              <div>
                <span>Групповое планирование</span>
                <h2>{selectedSupplierPlan.name}</h2>
                <p>{selectedSupplierPlan.contract} · {selectedSupplierPlan.items.length} позиций</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setSelectedSupplierPlan(null)}>×</button>
            </header>
            <div className="supplier-planning__body">
              <div className="supplier-planning__notice">
                Введите количество и дату по каждой PLU. Текущий и будущий ТЗ считаются отдельно для каждой позиции.
              </div>
              <div className="supplier-planning__table">
                <table>
                  <thead><tr><th>PLU / позиция</th><th>Текущий остаток</th><th>Остаток по заказам</th><th>Текущий ТЗ</th><th>Количество</th><th>Дата поставки</th><th>Будущий остаток</th><th>Будущий ТЗ</th></tr></thead>
                  <tbody>{selectedSupplierPlan.items.map((item) => {
                    const plan = supplierPlanRows[item.code] ?? { quantity: 0, date: '' };
                    const calculated = calculatePlannedStock(item, plan);
                    return (
                      <tr key={item.code}>
                        <td><strong>{item.code}</strong><span>{item.name}</span></td>
                        <td className="is-right">{formatNumber(item.totalStock)}</td>
                        <td className="is-right">{formatNumber(item.supplyRemainder)}</td>
                        <td className="is-right">{formatDays(calculated.currentDays)}</td>
                        <td><input type="number" min="0" step={item.palletMultiple ?? 1} value={plan.quantity} onChange={(event) => updateSupplierPlan(item.code, 'quantity', event.target.value)} /></td>
                        <td><input type="text" placeholder="дд.мм.гггг" value={plan.date} onChange={(event) => updateSupplierPlan(item.code, 'date', event.target.value)} /></td>
                        <td className="is-right">{formatNumber(calculated.futureStock)}</td>
                        <td className="is-right"><strong>{formatDays(calculated.futureDays)}</strong></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <footer className="supplier-planning__footer">
                <span>Изменено позиций: {Object.values(supplierPlanRows).filter((row) => row.quantity > 0).length}</span>
                <div>
                  <button type="button" onClick={() => setSelectedSupplierPlan(null)}>Отменить</button>
                  <button className="dashboard-button dashboard-button--primary" type="button" onClick={saveSupplierPlan}>Сохранить план поставщика</button>
                </div>
              </footer>
            </div>
          </aside>
        </>
      )}

      {selectedPackagingItem && (
        <>
          <button
            className="dashboard-details-backdrop"
            type="button"
            aria-label="Закрыть карточку позиции"
            onClick={() => setSelectedPackagingItem(null)}
          />
          <aside className="dashboard-details draggable-modal" style={itemDetailsModalDrag.dragStyle} aria-label="Карточка позиции">
            <div className="dashboard-details__header draggable-modal__handle" {...itemDetailsModalDrag.dragHandleProps}>
              <div>
                <span>Карточка позиции</span>
                <strong>{selectedPackagingItem.item.code}</strong>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setSelectedPackagingItem(null)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
              </button>
            </div>
            <div className="dashboard-details__body">
              <div className="dashboard-details__title">
                <h2>{selectedPackagingItem.item.name}</h2>
                <span className={`dashboard-status dashboard-status--${selectedPackagingItem.item.status}`}>
                  {statusLabels[selectedPackagingItem.item.status]}
                </span>
              </div>
              <dl className="dashboard-details__supplier">
                <div><dt>Поставщик</dt><dd>{selectedPackagingItem.supplier.name}</dd></div>
                <div><dt>Категория</dt><dd>{selectedPackagingItem.supplier.category}</dd></div>
                <div><dt>Договор</dt><dd>{selectedPackagingItem.supplier.contract}</dd></div>
              </dl>
              <section className="dashboard-details__metrics">
                <article><span>Прогноз / день</span><strong>{formatNumber(selectedPackagingItem.item.dailyForecast)}</strong></article>
                <article><span>ТЗ на складе</span><strong>{formatDays(selectedPackagingItem.item.stockDays)}</strong></article>
                <article><span>Общий остаток, шт.</span><strong>{formatNumber(selectedPackagingItem.item.totalStock)}</strong></article>
                <article><span>Остаток поставки</span><strong>{formatNumber(selectedPackagingItem.item.supplyRemainder)}</strong></article>
              </section>
              {selectedPackagingItem.item.comment && (
                <section className="dashboard-details__comment">
                  <span>Комментарий</span>
                  <p>{selectedPackagingItem.item.comment}</p>
                </section>
              )}
              <section className="dashboard-planning-form">
                <div className="dashboard-planning-form__heading">
                  <div>
                    <span>Планирование заказа</span>
                    <strong>Кратность паллеты: {formatNumber(selectedPackagingItem.item.palletMultiple ?? 0)}</strong>
                  </div>
                  <span>{plannedPallets} пал.</span>
                </div>
                <label>
                  <span>Количество к заказу</span>
                  <input
                    type="number"
                    min="0"
                    step={selectedPackagingItem.item.palletMultiple ?? 1}
                    value={planningQuantity}
                    onChange={(event) => setPlanningQuantity(Math.max(0, Number(event.target.value)))}
                  />
                </label>
                <div className="dashboard-planning-form__steps">
                  <button
                    type="button"
                    onClick={() => setPlanningQuantity((current) => Math.max(0, current - (selectedPackagingItem.item.palletMultiple ?? 1)))}
                  >
                    − 1 паллета
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanningQuantity((current) => current + (selectedPackagingItem.item.palletMultiple ?? 1))}
                  >
                    + 1 паллета
                  </button>
                </div>
                <label>
                  <span>Дата поставки</span>
                  <input type="text" placeholder="дд.мм.гггг" value={planningDate} onChange={(event) => setPlanningDate(event.target.value)} />
                </label>
                <div className="dashboard-planning-form__result">
                  <div><span>Текущий ТЗ</span><strong>{formatDays(selectedItemPlanCalculation?.currentDays ?? 0)}</strong></div>
                  <div><span>Будущий остаток</span><strong>{formatNumber(selectedItemPlanCalculation?.futureStock ?? 0)}</strong></div>
                  <div><span>Будущий ТЗ</span><strong>{formatDays(selectedItemPlanCalculation?.futureDays ?? 0)}</strong></div>
                </div>
              </section>
              <button className="dashboard-button dashboard-button--primary dashboard-details__action" type="button" onClick={saveSingleItemPlan}>
                Сохранить план поставки
              </button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

export default DashboardPage;
