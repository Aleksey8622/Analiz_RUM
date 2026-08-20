export type ImportedReport = { report_type: string; source_name: string; row_count: number; imported_at: string };
export type StockTotal = { materialNumber: string; warehouse: number; production: number; blocked: number };
export type SupplyTotal = { materialNumber: string; supplyRemainder: number };
export type DataState = { databasePath: string; selectedDate: string | null; dates: string[]; imports: ImportedReport[]; stockTotals: StockTotal[]; supplyTotals: SupplyTotal[]; imported?: Array<{ type: string; file: string; rows: number }> };

declare global {
  interface Window {
    analizRum?: {
      getDataState: () => Promise<DataState>;
      updateData: (date: string) => Promise<DataState>;
      getSnapshot: (date: string) => Promise<DataState>;
    };
  }
}

export {};
