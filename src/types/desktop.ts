export type ImportedReport = { report_type: string; source_name: string; row_count: number; imported_at: string };
export type ForecastTotal = { materialNumber: string; weekly: number; dailyForecast: number; manual: boolean };
export type StockTotal = { materialNumber: string; warehouse: number; production: number; blocked: number };
export type SupplyTotal = { materialNumber: string; supplyRemainder: number };
export type DirectoryDataRow = { id: string; category: string; plu: string; name: string; supplier: string; supplierSapCode: string; contractNumber: string; basketNumber: string; piecesPerPallet: number; showInAnalysis: number | boolean; sleeveFormat?: string; sleeveClient?: string; sleevePrintRun?: number };
export type DatabaseReportRow = Record<string, string | number> & { id: string };
export type DataState = { forecastTotals?: ForecastTotal[]; databasePath: string; selectedDate: string | null; dates: string[]; imports: ImportedReport[]; stockTotals: StockTotal[]; supplyTotals: SupplyTotal[]; directoryRows: DirectoryDataRow[]; supplyRows: DatabaseReportRow[]; bomRows: DatabaseReportRow[]; imported?: Array<{ type: string; file: string; rows: number }> };

declare global {
  interface Window {
    analizRum?: {
      searchBom: (date: string | null, query: string) => Promise<DatabaseReportRow[]>;
      saveForecast: (code: string, value: number | null, date: string | null) => Promise<DataState>;
      getDataState: () => Promise<DataState>;
      updateData: (date: string) => Promise<DataState>;
      getSnapshot: (date: string) => Promise<DataState>;
      getWorkspaceSettings: () => Promise<Record<string, unknown>>;
      saveWorkspaceSettings: (settings: Record<string, unknown>) => Promise<boolean>;
      saveDirectoryPosition: (position: DirectoryDataRow) => Promise<DirectoryDataRow>;
      saveDirectoryPositions: (positions: DirectoryDataRow[]) => Promise<DirectoryDataRow[]>;
      deleteDirectoryPositions: (ids: string[]) => Promise<string[]>;
    };
  }
}

export {};
