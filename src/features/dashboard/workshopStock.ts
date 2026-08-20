export type WorkshopStockRow = {
  id: string;
  materialNumber: string;
  plant: string;
  batch: string;
  warehouse: string;
  unit: string;
  freeStock: number;
  qualityStock: number;
  blocked: number;
  materialType: string;
  madeAt: string;
  shelfLife: string;
  lastMovement: string;
};

export const normalizeMaterialNumber = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/\.0+$/, '')
  .replace(/^0+(?=\d)/, '');

export const parseRussianNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const source = String(value ?? '').trim().replace(/\s/g, '');
  if (!source) return 0;

  const normalized = source.includes(',')
    ? source.replace(/\./g, '').replace(',', '.')
    : source;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const aggregateProductionByMaterial = (rows: Pick<WorkshopStockRow, 'materialNumber' | 'freeStock'>[]) =>
  rows.reduce<Record<string, number>>((totals, row) => {
    const materialNumber = normalizeMaterialNumber(row.materialNumber);
    if (!materialNumber) return totals;
    totals[materialNumber] = (totals[materialNumber] ?? 0) + parseRussianNumber(row.freeStock);
    return totals;
  }, {});

export const getProductionForMaterial = (materialNumber: unknown, productionByMaterial: Record<string, number>) =>
  productionByMaterial[normalizeMaterialNumber(materialNumber)] ?? 0;
