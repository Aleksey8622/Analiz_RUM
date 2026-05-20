import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SupplyColumnKey =
  | 'id'
  | 'weekOrDebt'
  | 'supplyRemainder'
  | 'supplierCode'
  | 'supplierName'
  | 'orderCreatedAt'
  | 'plannedDeliveryAt'
  | 'deliveredAt'
  | 'orderNumber'
  | 'itemCode'
  | 'itemName'
  | 'orderedQty'
  | 'deliveredQty'
  | 'orderType'
  | 'deleted'
  | 'returnFlag'
  | 'orderStatus'
  | 'unit';

export type AnalysisColumnKey =
  | 'code'
  | 'name'
  | 'dailyForecast'
  | 'stockDays'
  | 'stockProductionDays'
  | 'blocked'
  | 'warehouse'
  | 'production'
  | 'totalStock'
  | 'supplyRemainder'
  | 'plannedDeliveryQty'
  | 'deliveryDate'
  | 'stockDaysOnDelivery'
  | 'futureStockDays'
  | 'status';

export type SupplyReportRow = Record<SupplyColumnKey, string | number>;

export type SupplyFilters = {
  search: string;
  weekOrDebt: string[];
  supplierName: string[];
  orderStatus: string[];
  unit: string[];
  orderType: string[];
  advanced: Array<{
    id: number;
    field: string;
    operator: string;
    value: string;
  }>;
};

export type AnalysisFilters = {
  search: string;
  advanced: SupplyFilters['advanced'];
};

export type SavedSupplyView = {
  name: string;
  filters: SupplyFilters;
  visibleColumns: SupplyColumnKey[];
};

type WorkspaceState = {
  analysisFilters: AnalysisFilters;
  visibleAnalysisColumns: AnalysisColumnKey[];
  supplyFilters: SupplyFilters;
  visibleSupplyColumns: SupplyColumnKey[];
  savedSupplyViews: SavedSupplyView[];
  activeSupplyView: string;
};

const defaultAnalysisFilters: AnalysisFilters = {
  search: '',
  advanced: [],
};

export const defaultAnalysisColumns: AnalysisColumnKey[] = [
  'code',
  'name',
  'dailyForecast',
  'stockDays',
  'stockProductionDays',
  'blocked',
  'warehouse',
  'production',
  'totalStock',
  'supplyRemainder',
  'plannedDeliveryQty',
  'deliveryDate',
  'stockDaysOnDelivery',
  'futureStockDays',
  'status',
];

const defaultSupplyFilters: SupplyFilters = {
  search: '',
  weekOrDebt: [],
  supplierName: [],
  orderStatus: [],
  unit: [],
  orderType: [],
  advanced: [],
};

export const defaultSupplyColumns: SupplyColumnKey[] = [
  'weekOrDebt',
  'supplyRemainder',
  'supplierCode',
  'supplierName',
  'orderCreatedAt',
  'plannedDeliveryAt',
  'deliveredAt',
  'orderNumber',
  'itemCode',
  'itemName',
  'orderedQty',
  'deliveredQty',
  'orderType',
  'deleted',
  'returnFlag',
  'orderStatus',
  'unit',
];

const initialState: WorkspaceState = {
  analysisFilters: defaultAnalysisFilters,
  visibleAnalysisColumns: defaultAnalysisColumns,
  supplyFilters: defaultSupplyFilters,
  visibleSupplyColumns: defaultSupplyColumns,
  savedSupplyViews: [
    {
      name: 'Основной',
      filters: defaultSupplyFilters,
      visibleColumns: defaultSupplyColumns,
    },
    {
      name: 'Долги',
      filters: {
        ...defaultSupplyFilters,
        weekOrDebt: ['Долг'],
      },
      visibleColumns: defaultSupplyColumns,
    },
    {
      name: 'Открытые поставки',
      filters: {
        ...defaultSupplyFilters,
        orderStatus: ['Открыт', 'Частично поставлен', 'Просрочен'],
      },
      visibleColumns: defaultSupplyColumns,
    },
  ],
  activeSupplyView: 'Основной',
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setAnalysisSearch: (state, action: PayloadAction<string>) => {
      state.analysisFilters.search = action.payload;
    },
    setAnalysisAdvancedFilters: (state, action: PayloadAction<AnalysisFilters['advanced']>) => {
      state.analysisFilters.advanced = action.payload;
    },
    clearAnalysisFilters: (state) => {
      state.analysisFilters = defaultAnalysisFilters;
    },
    toggleAnalysisColumn: (state, action: PayloadAction<AnalysisColumnKey>) => {
      if (action.payload === 'code' || action.payload === 'name') {
        return;
      }

      if (state.visibleAnalysisColumns.includes(action.payload)) {
        state.visibleAnalysisColumns = state.visibleAnalysisColumns.filter((column) => column !== action.payload);
      } else {
        state.visibleAnalysisColumns.push(action.payload);
      }
    },
    moveAnalysisColumn: (state, action: PayloadAction<{ column: AnalysisColumnKey; direction: 'up' | 'down' }>) => {
      const currentIndex = state.visibleAnalysisColumns.indexOf(action.payload.column);
      const nextIndex = action.payload.direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.visibleAnalysisColumns.length) {
        return;
      }

      const [column] = state.visibleAnalysisColumns.splice(currentIndex, 1);
      state.visibleAnalysisColumns.splice(nextIndex, 0, column);
    },
    resetAnalysisColumns: (state) => {
      state.visibleAnalysisColumns = defaultAnalysisColumns;
    },
    setSupplySearch: (state, action: PayloadAction<string>) => {
      state.supplyFilters.search = action.payload;
      state.activeSupplyView = 'Текущий';
    },
    toggleSupplyFilterValue: (
      state,
      action: PayloadAction<{
        name: keyof Pick<SupplyFilters, 'weekOrDebt' | 'supplierName' | 'orderStatus' | 'unit' | 'orderType'>;
        value: string;
      }>,
    ) => {
      const currentValues = state.supplyFilters[action.payload.name];

      if (currentValues.includes(action.payload.value)) {
        state.supplyFilters[action.payload.name] = currentValues.filter((value) => value !== action.payload.value);
      } else {
        state.supplyFilters[action.payload.name].push(action.payload.value);
      }

      state.activeSupplyView = 'Текущий';
    },
    setSupplyAdvancedFilters: (state, action: PayloadAction<SupplyFilters['advanced']>) => {
      state.supplyFilters.advanced = action.payload;
      state.activeSupplyView = 'Текущий';
    },
    clearSupplyFilters: (state) => {
      state.supplyFilters = defaultSupplyFilters;
      state.activeSupplyView = 'Основной';
    },
    toggleSupplyColumn: (state, action: PayloadAction<SupplyColumnKey>) => {
      if (action.payload === 'orderStatus') {
        return;
      }

      if (state.visibleSupplyColumns.includes(action.payload)) {
        state.visibleSupplyColumns = state.visibleSupplyColumns.filter((column) => column !== action.payload);
      } else {
        state.visibleSupplyColumns.push(action.payload);
      }
    },
    moveSupplyColumn: (state, action: PayloadAction<{ column: SupplyColumnKey; direction: 'up' | 'down' }>) => {
      const currentIndex = state.visibleSupplyColumns.indexOf(action.payload.column);
      const nextIndex = action.payload.direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.visibleSupplyColumns.length) {
        return;
      }

      const [column] = state.visibleSupplyColumns.splice(currentIndex, 1);
      state.visibleSupplyColumns.splice(nextIndex, 0, column);
    },
    resetSupplyColumns: (state) => {
      state.visibleSupplyColumns = defaultSupplyColumns;
    },
    applySupplyView: (state, action: PayloadAction<string>) => {
      const view = state.savedSupplyViews.find((savedView) => savedView.name === action.payload);

      if (!view) {
        return;
      }

      state.supplyFilters = view.filters;
      state.visibleSupplyColumns = view.visibleColumns;
      state.activeSupplyView = view.name;
    },
    saveCurrentSupplyView: (state) => {
      const viewName = 'Текущий';
      const existingView = state.savedSupplyViews.find((view) => view.name === viewName);

      if (existingView) {
        existingView.filters = state.supplyFilters;
        existingView.visibleColumns = state.visibleSupplyColumns;
      } else {
        state.savedSupplyViews.push({
          name: viewName,
          filters: state.supplyFilters,
          visibleColumns: state.visibleSupplyColumns,
        });
      }

      state.activeSupplyView = viewName;
    },
  },
});

export const {
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
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
