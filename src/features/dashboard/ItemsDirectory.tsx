import { useEffect, useMemo, useState } from 'react';
import { useDraggableModal } from '../../components/ui/useDraggableModal';
import { DEFAULT_SLEEVE_CLIENTS, DEFAULT_SLEEVE_FORMATS, detectSleeveClient, detectSleeveFormat, normalizeSleeveFormat } from './sleeveCatalog';

export type DirectoryPosition = {
  id: string;
  category: string;
  plu: string;
  name: string;
  supplier: string;
  supplierSapCode: string;
  contractNumber: string;
  basketNumber: string;
  piecesPerPallet: number;
  showInAnalysis: boolean;
  sleeveFormat?: string;
  sleeveClient?: string;
  sleevePrintRun?: number;
};

type SupplierProfile = {
  name: string;
  supplierSapCode: string;
  contractNumber: string;
  basketNumber: string;
  piecesPerPallet: number;
  showInAnalysis: boolean;
};

type ItemsDirectoryProps = {
  initialRows: DirectoryPosition[];
  onRowsChange?: (rows: DirectoryPosition[]) => void;
};

const SLEEVE_FORMATS_KEY = 'analiz-rum:sleeve-formats';
const SLEEVE_RUNS_KEY = 'analiz-rum:sleeve-print-runs';
const sleeveRunKey = (supplier: string, format: string) => `${supplier.trim()}::${format.trim()}`;

const categoryRules: Array<[RegExp, string]> = [
  [/обечайк/i, 'Обечайки'],
  [/этикетк/i, 'Этикетки'],
  [/(лоток|лотки)/i, 'Лотки'],
  [/(пленка|плёнка)/i, 'Плёнки'],
  [/(гофра|гофро|короб)/i, 'Гофра и короба'],
  [/упаковк/i, 'Упаковка'],
  [/(форма|коррекс|корекс|крышка|стакан|сэндвич|контейнер)/i, 'Индивидуальная упаковка'],
];

const detectCategory = (name: string) =>
  categoryRules.find(([pattern]) => pattern.test(name))?.[1] ?? 'Прочее';

const loadRows = (initialRows: DirectoryPosition[]) => initialRows.map((row) => {
  const isSleeve = /обечайк/i.test(row.name) || /обечайк/i.test(row.category);
  return {
    ...row,
    category: isSleeve ? 'Обечайки' : row.category.trim(),
    sleeveClient: isSleeve ? (row.sleeveClient || detectSleeveClient(row.name)) : row.sleeveClient,
    sleeveFormat: isSleeve ? (row.sleeveFormat || detectSleeveFormat(row.name, DEFAULT_SLEEVE_FORMATS)) : row.sleeveFormat,
  };
});

const emptySupplier: SupplierProfile = {
  name: '',
  supplierSapCode: '',
  contractNumber: '',
  basketNumber: '',
  piecesPerPallet: 0,
  showInAnalysis: true,
};

const positionWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'позицию' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'позиции' : 'позиций';

export function ItemsDirectory({ initialRows, onRowsChange }: ItemsDirectoryProps) {
  const [rows, setRows] = useState<DirectoryPosition[]>(() => loadRows(initialRows));
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [supplierMode, setSupplierMode] = useState<'existing' | 'new'>('existing');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierDraft, setSupplierDraft] = useState<SupplierProfile>(emptySupplier);
  const [bulkText, setBulkText] = useState('');
  const [bulkPiecesPerPallet, setBulkPiecesPerPallet] = useState('');
  const [categoryOverride, setCategoryOverride] = useState('');
  const [error, setError] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<DirectoryPosition | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditSupplier, setBulkEditSupplier] = useState('');
  const [bulkEditRows, setBulkEditRows] = useState<DirectoryPosition[]>([]);
  const [bulkEditSearch, setBulkEditSearch] = useState('');
  const [selectedBulkEditRowIds, setSelectedBulkEditRowIds] = useState<string[]>([]);
  const [bulkField, setBulkField] = useState('sleevePrintRun');
  const [bulkFieldValue, setBulkFieldValue] = useState('');
  const [bulkSupplierMode, setBulkSupplierMode] = useState<'existing' | 'new'>('existing');
  const [bulkSupplierDraft, setBulkSupplierDraft] = useState<SupplierProfile>(emptySupplier);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [sleeveClient, setSleeveClient] = useState(DEFAULT_SLEEVE_CLIENTS[0]);
  const [newSleeveClient, setNewSleeveClient] = useState('');
  const [addedSleeveClients, setAddedSleeveClients] = useState<string[]>([]);
  const [previewClientTarget, setPreviewClientTarget] = useState(DEFAULT_SLEEVE_CLIENTS[0]);
  const [selectedPreviewRows, setSelectedPreviewRows] = useState<number[]>([]);
  const [sleeveClientOverrides, setSleeveClientOverrides] = useState<Record<number, string>>({});
  const [sleeveFormats, setSleeveFormats] = useState<string[]>(() => {
    try { return [...new Set([...DEFAULT_SLEEVE_FORMATS, ...(JSON.parse(localStorage.getItem(SLEEVE_FORMATS_KEY) ?? '[]') as string[])])]; }
    catch { return DEFAULT_SLEEVE_FORMATS; }
  });
  const [newSleeveFormat, setNewSleeveFormat] = useState('');
  const [sleeveFormatOverrides, setSleeveFormatOverrides] = useState<Record<number, string>>({});
  const [sleevePrintRuns, setSleevePrintRuns] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(SLEEVE_RUNS_KEY) ?? '{}') as Record<string, number>; }
    catch { return {}; }
  });
  const addModalDrag = useDraggableModal(isAddOpen);
  const editModalDrag = useDraggableModal(Boolean(editingRow));
  const bulkEditDrag = useDraggableModal(isBulkEditOpen);

  const suppliers = useMemo(() => {
    const profiles = new Map<string, SupplierProfile>();
    rows.forEach((row) => {
      if (!profiles.has(row.supplier)) {
        profiles.set(row.supplier, {
          name: row.supplier,
          supplierSapCode: row.supplierSapCode,
          contractNumber: row.contractNumber,
          basketNumber: row.basketNumber,
          piecesPerPallet: row.piecesPerPallet,
          showInAnalysis: row.showInAnalysis,
        });
      }
    });
    return [...profiles.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    if (!query) return rows;
    const codeQueries = query.split(/[\s,;]+/).filter(Boolean);
    const isMultiCodeSearch = codeQueries.length > 1 && codeQueries.every((value) => /^\d+$/.test(value));
    return rows.filter((row) => {
      const values = Object.values(row).map((value) => String(value).toLocaleLowerCase('ru'));
      return isMultiCodeSearch
        ? codeQueries.some((code) => values.some((value) => value.includes(code)))
        : values.some((value) => value.includes(query));
    });
  }, [rows, search]);

  const parsedBulkLines = useMemo(() => bulkText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const delimitedParts = line.split(/\t|;/).map((value) => value.trim()).filter(Boolean);
    const whitespaceMatch = line.match(/^(\S+)\s+(.+)$/);
    const [plu = '', name = '', pallet = ''] = delimitedParts.length >= 2 ? delimitedParts : [whitespaceMatch?.[1] ?? '', whitespaceMatch?.[2] ?? '', ''];
    return { plu, name, pallet };
  }), [bulkText]);

  const sleeveClients = useMemo(() => [...new Set([...DEFAULT_SLEEVE_CLIENTS, ...addedSleeveClients, ...rows.map((row) => row.sleeveClient).filter((value): value is string => Boolean(value))])], [addedSleeveClients, rows]);
  const filteredBulkEditRows = useMemo(() => {
    const query = bulkEditSearch.trim().toLocaleLowerCase('ru');
    if (!query) return bulkEditRows;
    return bulkEditRows.filter((row) => [
      row.plu, row.name, row.category, row.sleeveFormat, row.sleeveClient,
      row.supplier, row.supplierSapCode, row.contractNumber, row.basketNumber,
    ].some((value) => String(value ?? '').toLocaleLowerCase('ru').includes(query)));
  }, [bulkEditRows, bulkEditSearch]);
  const filteredBulkIds = useMemo(() => filteredBulkEditRows.map((row) => row.id), [filteredBulkEditRows]);
  const areAllFilteredBulkRowsSelected = filteredBulkIds.length > 0
    && filteredBulkIds.every((id) => selectedBulkEditRowIds.includes(id));
  const currentDraftSupplierName = supplierMode === 'existing' ? selectedSupplier : supplierDraft.name;

  const saveSleevePrintRun = (supplier: string, format: string, value: number) => {
    if (!supplier.trim() || !format) return;
    const next = { ...sleevePrintRuns, [sleeveRunKey(supplier, format)]: value };
    setSleevePrintRuns(next);
    localStorage.setItem(SLEEVE_RUNS_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    setRows(loadRows(initialRows));
  }, [initialRows]);

  const persistRows = (nextRows: DirectoryPosition[]) => {
    setRows(nextRows);
    onRowsChange?.(nextRows);
  };

  const refreshRowsFromDatabase = async (fallbackRows: DirectoryPosition[]) => {
    if (!window.analizRum) {
      persistRows(fallbackRows);
      return;
    }
    const state = await window.analizRum.getDataState();
    persistRows(loadRows(state.directoryRows.map((row) => ({
      ...row,
      showInAnalysis: Boolean(row.showInAnalysis),
    })) as DirectoryPosition[]));
  };

  const closeAdd = () => {
    setIsAddOpen(false);
    setBulkText('');
    setBulkPiecesPerPallet('');
    setCategoryOverride('');
    setError('');
    setSupplierDraft(emptySupplier);
    setSleeveFormatOverrides({});
    setSleeveClientOverrides({});
    setSelectedPreviewRows([]);
    setNewSleeveClient('');
  };

  const addPositions = async () => {
    const supplier = supplierMode === 'existing'
      ? suppliers.find((item) => item.name === selectedSupplier)
      : supplierDraft;

    if (!supplier?.name.trim()) {
      setError('Выберите или добавьте поставщика.');
      return;
    }

    const isSleeve = categoryOverride === 'Обечайки';
    if (isSleeve && !sleeveClient) {
      setError('Выберите существующего клиента или добавьте нового.');
      return;
    }

    const parsed = parsedBulkLines
      .map(({ plu, name, pallet }, index) => {
        if (!plu || !name) return null;
        const category = categoryOverride || detectCategory(name);
        const sleeveFormat = isSleeve ? (sleeveFormatOverrides[index] || detectSleeveFormat(name, sleeveFormats)) : undefined;
        if (isSleeve && !sleeveFormat) return null;
        const sleevePrintRun = isSleeve && sleeveFormat ? sleevePrintRuns[sleeveRunKey(supplier.name, sleeveFormat)] ?? 0 : undefined;
        if (isSleeve && !sleevePrintRun) return null;

        return {
          id: `${plu}::${supplier.name}::${Date.now()}-${index}`,
          category,
          plu,
          name,
          supplier: supplier.name,
          supplierSapCode: supplier.supplierSapCode,
          contractNumber: supplier.contractNumber,
          basketNumber: supplier.basketNumber,
          piecesPerPallet: Number((pallet || bulkPiecesPerPallet).replace(/\s/g, '')) || 0,
          showInAnalysis: supplier.showInAnalysis && !['Этикетки', 'Обечайки'].includes(category),
          sleeveFormat,
          sleeveClient: isSleeve ? (detectSleeveClient(name) || sleeveClientOverrides[index] || sleeveClient) : undefined,
          sleevePrintRun,
        } satisfies DirectoryPosition;
      })
      .filter((row) => row !== null) as DirectoryPosition[];

    if (isSleeve && parsed.length !== parsedBulkLines.length) {
      setError('Для каждой обечайки нужно определить формат и тираж в предварительной проверке.');
      return;
    }
    if (parsed.length === 0) {
      setError('В каждой строке сначала укажите PLU, затем через пробел — наименование.');
      return;
    }

    const positionKey = (row: DirectoryPosition) => `${String(row.plu).trim().replace(/^0+(?=\d)/, '')}::${row.supplier.trim().toLocaleLowerCase('ru')}`;
    const existingKeys = new Set(rows.map(positionKey));
    const batchKeys = new Set<string>();
    const duplicate = parsed.find((row) => {
      const rowKey = positionKey(row);
      if (existingKeys.has(rowKey) || batchKeys.has(rowKey)) return true;
      batchKeys.add(rowKey);
      return false;
    });
    if (duplicate) {
      setError(`Позиция ${duplicate.plu} у поставщика ${duplicate.supplier} уже есть в справочнике.`);
      return;
    }

    setError('');
    setIsBulkSaving(true);
    try {
      const saved = window.analizRum?.saveDirectoryPositions
        ? await window.analizRum.saveDirectoryPositions(parsed) as DirectoryPosition[]
        : parsed;
      await refreshRowsFromDatabase([...rows, ...saved]);
      closeAdd();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось добавить позиции.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const deletePosition = async (row: DirectoryPosition) => {
    if (window.confirm(`Удалить ${row.plu} у поставщика ${row.supplier}?`)) {
      try {
        await window.analizRum?.deleteDirectoryPositions?.([row.id]);
        await refreshRowsFromDatabase(rows.filter((item) => item.id !== row.id));
      } catch (deleteError) {
        window.alert(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить позицию.');
      }
    }
  };

  const deleteSelectedPositions = async () => {
    if (!selectedRowIds.length) return;
    if (window.confirm(`Удалить выбранные позиции (${selectedRowIds.length})? Это действие удалит их из справочника.`)) {
      try {
        await window.analizRum?.deleteDirectoryPositions?.(selectedRowIds);
        await refreshRowsFromDatabase(rows.filter((row) => !selectedRowIds.includes(row.id)));
        setSelectedRowIds([]);
      } catch (deleteError) {
        window.alert(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить выбранные позиции.');
      }
    }
  };

  const startEditing = () => {
    const row = rows.find((item) => item.id === selectedRowIds[0]);
    if (selectedRowIds.length === 1 && row) {
      const isSleeve = row.category === 'Обечайки' || /обечайк/i.test(row.name);
      const sleeveFormat = isSleeve
        ? (row.sleeveFormat || detectSleeveFormat(row.name, sleeveFormats))
        : row.sleeveFormat;
      setError('');
      setEditingRow({
        ...row,
        category: isSleeve ? 'Обечайки' : row.category,
        sleeveFormat,
        sleeveClient: isSleeve ? (row.sleeveClient || detectSleeveClient(row.name)) : row.sleeveClient,
        sleevePrintRun: isSleeve && sleeveFormat
          ? (row.sleevePrintRun || sleevePrintRuns[sleeveRunKey(row.supplier, sleeveFormat)] || 0)
          : row.sleevePrintRun,
      });
    }
  };

  const changeEditingSupplier = (supplierName: string) => {
    const supplier = suppliers.find((item) => item.name === supplierName);
    if (!editingRow || !supplier) return;
    setEditingRow({
      ...editingRow,
      supplier: supplier.name,
      supplierSapCode: supplier.supplierSapCode,
      contractNumber: supplier.contractNumber,
      basketNumber: supplier.basketNumber,
      sleevePrintRun: editingRow.category === 'Обечайки' && editingRow.sleeveFormat
        ? sleevePrintRuns[sleeveRunKey(supplier.name, editingRow.sleeveFormat)] ?? 0
        : editingRow.sleevePrintRun,
    });
  };

  const saveEditing = async () => {
    if (!editingRow?.plu.trim() || !editingRow.name.trim() || !editingRow.supplier.trim()) return;
    if (editingRow.category === 'Обечайки' && !editingRow.sleeveFormat) {
      setError('Укажите формат обечайки. Пустое значение больше не подменяется первым пунктом списка.');
      return;
    }
    if (editingRow.category === 'Обечайки' && !editingRow.sleeveClient) {
      setError('Укажите клиента обечайки.');
      return;
    }
    if (editingRow.category === 'Обечайки' && !editingRow.sleevePrintRun) {
      setError('Укажите тираж обечайки.');
      return;
    }
    setError('');
    setIsBulkSaving(true);
    try {
      if (editingRow.category === 'Обечайки' && editingRow.sleeveFormat && editingRow.sleevePrintRun) saveSleevePrintRun(editingRow.supplier, editingRow.sleeveFormat, editingRow.sleevePrintRun);
      const savedRow = window.analizRum?.saveDirectoryPosition
        ? await window.analizRum.saveDirectoryPosition(editingRow) as DirectoryPosition
        : editingRow;
      await refreshRowsFromDatabase(rows.map((row) => row.id === savedRow.id ? savedRow : row));
      setEditingRow(null);
      setSelectedRowIds([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить позицию.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const openBulkEditing = () => {
    if (!selectedRowIds.length) return;
    const discoveredFormats = new Set(sleeveFormats);
    const selected = rows.filter((row) => selectedRowIds.includes(row.id)).map((row) => {
      const isSleeve = row.category === 'Обечайки' || /обечайк/i.test(row.name);
      if (!isSleeve) return { ...row };
      const sleeveFormat = row.sleeveFormat || detectSleeveFormat(row.name, sleeveFormats);
      if (sleeveFormat) discoveredFormats.add(sleeveFormat);
      return {
        ...row,
        category: 'Обечайки',
        sleeveFormat,
        sleeveClient: row.sleeveClient || detectSleeveClient(row.name),
        showInAnalysis: false,
      };
    });
    if (discoveredFormats.size !== sleeveFormats.length) {
      const nextFormats = [...discoveredFormats];
      setSleeveFormats(nextFormats);
      localStorage.setItem(SLEEVE_FORMATS_KEY, JSON.stringify(nextFormats));
    }
    setBulkEditRows(selected);
    setBulkEditSearch('');
    setError('');
    setSelectedBulkEditRowIds(selected.map((row) => row.id));
    setBulkField('sleevePrintRun');
    setBulkFieldValue('');
    setBulkEditSupplier(selected[0]?.supplier ?? suppliers[0]?.name ?? '');
    setBulkSupplierMode('existing');
    setBulkSupplierDraft(emptySupplier);
    setIsBulkEditOpen(true);
  };

  const saveBulkEditing = async () => {
    if (bulkEditRows.some((row) => !row.plu.trim() || !row.name.trim() || !row.supplier.trim())) {
      setError('Для сохранения нужны PLU, наименование и поставщик.');
      return;
    }
    if (bulkEditRows.some((row) => row.category === 'Обечайки' && (!row.sleeveFormat || !row.sleevePrintRun))) {
      setError('Для каждой обечайки укажите формат и тираж. Можно найти группу поиском, выбрать её и назначить общее значение.');
      return;
    }
    setError('');
    setIsBulkSaving(true);
    try {
      const saveDirectoryPositions = window.analizRum?.saveDirectoryPositions;
      const savedRows = saveDirectoryPositions
        ? await saveDirectoryPositions(bulkEditRows) as DirectoryPosition[]
        : bulkEditRows;
    const nextRuns = { ...sleevePrintRuns };
      savedRows.filter((row) => row.category === 'Обечайки' && row.sleeveFormat && row.sleevePrintRun).forEach((row) => { nextRuns[sleeveRunKey(row.supplier, row.sleeveFormat ?? '')] = row.sleevePrintRun ?? 0; });
    setSleevePrintRuns(nextRuns);
    localStorage.setItem(SLEEVE_RUNS_KEY, JSON.stringify(nextRuns));
      const edits = new Map(savedRows.map((row) => [row.id, row]));
    await refreshRowsFromDatabase(rows.map((row) => edits.get(row.id) ?? row));
    setSelectedRowIds([]);
    setIsBulkEditOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить массовые изменения.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const applySupplierToBulkRows = () => {
    const supplier = bulkSupplierMode === 'existing' ? suppliers.find((item) => item.name === bulkEditSupplier) : bulkSupplierDraft;
    if (!supplier?.name.trim()) return;
    setBulkEditRows((current) => current.map((row) => selectedBulkEditRowIds.includes(row.id) ? {
      ...row,
      supplier: supplier.name,
      supplierSapCode: supplier.supplierSapCode,
      contractNumber: supplier.contractNumber,
      basketNumber: supplier.basketNumber,
      sleevePrintRun: row.category === 'Обечайки' && row.sleeveFormat
        ? sleevePrintRuns[sleeveRunKey(supplier.name, row.sleeveFormat)] ?? 0
        : row.sleevePrintRun,
    } : row));
  };

  const applyFieldToSelectedBulkRows = () => {
    if (!selectedBulkEditRowIds.length || !bulkFieldValue.trim()) return;
    setBulkEditRows((current) => current.map((row) => {
      if (!selectedBulkEditRowIds.includes(row.id)) return row;
      if (bulkField === 'supplier') {
        const supplier = suppliers.find((item) => item.name === bulkFieldValue);
        if (!supplier) return row;
        return {
          ...row,
          supplier: supplier.name,
          supplierSapCode: supplier.supplierSapCode,
          contractNumber: supplier.contractNumber,
          basketNumber: supplier.basketNumber,
          sleevePrintRun: row.category === 'Обечайки' && row.sleeveFormat
            ? sleevePrintRuns[sleeveRunKey(supplier.name, row.sleeveFormat)] ?? 0
            : row.sleevePrintRun,
        };
      }
      if (bulkField === 'sleeveFormat') {
        return row.category === 'Обечайки' ? { ...row, sleeveFormat: bulkFieldValue, sleevePrintRun: sleevePrintRuns[sleeveRunKey(row.supplier, bulkFieldValue)] ?? 0 } : row;
      }
      if (bulkField === 'sleeveClient') return { ...row, sleeveClient: bulkFieldValue };
      if (bulkField === 'sleevePrintRun') return row.category === 'Обечайки' ? { ...row, sleevePrintRun: Number(bulkFieldValue) || 0 } : row;
      if (bulkField === 'piecesPerPallet') return { ...row, piecesPerPallet: Number(bulkFieldValue) || 0 };
      return { ...row, [bulkField]: bulkFieldValue };
    }));
  };

  const bulkFieldOptions = [
    ['sleevePrintRun', 'Тираж'], ['sleeveFormat', 'Формат обечайки'], ['sleeveClient', 'Клиент'],
    ['category', 'Категория'], ['supplier', 'Поставщик'], ['supplierSapCode', 'SAP-код'],
    ['contractNumber', 'Номер договора'], ['basketNumber', 'Номер корзины'], ['piecesPerPallet', 'Штук на паллете'],
    ['plu', 'PLU'], ['name', 'Наименование PLU'],
  ];

  const bulkValueOptions = bulkField === 'supplier' ? suppliers.map((supplier) => supplier.name)
    : bulkField === 'sleeveFormat' ? sleeveFormats
      : bulkField === 'sleeveClient' ? sleeveClients
        : bulkField === 'category' ? ['Лотки', 'Плёнки', 'Гофра и короба', 'Обечайки', 'Этикетки', 'Упаковка', 'Индивидуальная упаковка', 'Прочее']
          : null;

  const updateBulkRow = (id: string, changes: Partial<DirectoryPosition>) => setBulkEditRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));

  return (
    <div className="items-directory">
<datalist id="sleeve-client-options">{sleeveClients.map((client) => <option key={client} value={client} />)}</datalist>
      <div className="items-directory__toolbar">
        <label className="items-directory__search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти PLU, наименование, поставщика или значение…" />
        </label>
        <span className="items-directory__count">Позиций: <strong>{filteredRows.length}</strong></span>
        <button className="dashboard-button dashboard-button--primary" type="button" disabled={selectedRowIds.length === 0} onClick={selectedRowIds.length === 1 ? startEditing : openBulkEditing}>{selectedRowIds.length > 1 ? `Корректировать позиции (${selectedRowIds.length})` : 'Корректировать позицию'}</button>
        <button className="dashboard-button items-directory__bulk-delete" type="button" disabled={selectedRowIds.length === 0} onClick={deleteSelectedPositions}>Удалить выбранные{selectedRowIds.length ? ` (${selectedRowIds.length})` : ''}</button>
        <button className="dashboard-button dashboard-button--primary" type="button" onClick={() => {
          setSelectedSupplier(suppliers[0]?.name ?? '');
          setIsAddOpen(true);
        }}>Добавить позиции</button>
      </div>

      <div className="items-directory__table">
        <table>
          <thead><tr><th className="items-directory__select-column"><input type="checkbox" checked={filteredRows.length > 0 && filteredRows.every((row) => selectedRowIds.includes(row.id))} onChange={(event) => setSelectedRowIds((current) => event.target.checked ? [...new Set([...current, ...filteredRows.map((row) => row.id)])] : current.filter((id) => !filteredRows.some((row) => row.id === id)))} aria-label="Выбрать все отфильтрованные позиции" /></th><th>Категория</th><th>PLU</th><th>Наименование PLU</th><th>Поставщик</th><th>SAP-код</th><th>Номер договора</th><th>Ном корзины</th><th>Штук на паллете</th><th>Действие</th></tr></thead>
          <tbody>{filteredRows.map((row) => (
            <tr key={row.id}>
              <td className="items-directory__select-column"><input type="checkbox" checked={selectedRowIds.includes(row.id)} onChange={(event) => setSelectedRowIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} aria-label={`Выбрать ${row.plu}`} /></td>
              <td>{row.category}</td><td>{row.plu}</td><td>{row.name}</td><td>{row.supplier}</td><td>{row.supplierSapCode || '—'}</td><td>{row.contractNumber || '—'}</td><td>{row.basketNumber || '—'}</td><td className="is-right">{row.piecesPerPallet || '—'}</td>
              <td><button className="items-directory__delete" type="button" onClick={() => deletePosition(row)}>Удалить</button></td>
            </tr>
          ))}</tbody>
        </table>
        {filteredRows.length === 0 && <div className="items-directory__empty">Позиции не найдены</div>}
      </div>

      {isAddOpen && <>
        <button className="dashboard-details-backdrop" type="button" aria-label="Закрыть добавление" onClick={closeAdd} />
        <aside className="items-directory__modal draggable-modal" style={addModalDrag.dragStyle} aria-label="Массовое добавление позиций">
          <header className="draggable-modal__handle" {...addModalDrag.dragHandleProps}><div><span>Справочник</span><h2>Добавить позиции массово</h2></div><button type="button" onClick={closeAdd}>×</button></header>
          <div className={`items-directory__modal-body ${categoryOverride === 'Обечайки' ? 'items-directory__modal-body--sleeves' : ''}`}>
            <div className="items-directory__mode"><button className={supplierMode === 'existing' ? 'is-active' : ''} type="button" onClick={() => setSupplierMode('existing')}>Существующий поставщик</button><button className={supplierMode === 'new' ? 'is-active' : ''} type="button" onClick={() => setSupplierMode('new')}>Новый поставщик</button></div>
            {supplierMode === 'existing' ? <label><span>Поставщик</span><select value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.name}>{supplier.name}</option>)}</select></label> : <div className="items-directory__supplier-grid">
              <label><span>Название поставщика</span><input value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} /></label>
              <label><span>SAP-код поставщика</span><input value={supplierDraft.supplierSapCode} onChange={(event) => setSupplierDraft({ ...supplierDraft, supplierSapCode: event.target.value })} /></label>
              <label><span>Номер договора</span><input value={supplierDraft.contractNumber} onChange={(event) => setSupplierDraft({ ...supplierDraft, contractNumber: event.target.value })} /></label>
              <label><span>Номер корзины</span><input value={supplierDraft.basketNumber} onChange={(event) => setSupplierDraft({ ...supplierDraft, basketNumber: event.target.value })} /></label>
              <label><span>Штук на паллете</span><input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={supplierDraft.piecesPerPallet} onChange={(event) => setSupplierDraft({ ...supplierDraft, piecesPerPallet: Number(event.target.value) })} /></label>
              <label className="items-directory__checkbox"><input type="checkbox" checked={supplierDraft.showInAnalysis} onChange={(event) => setSupplierDraft({ ...supplierDraft, showInAnalysis: event.target.checked })} /><span>Отображать в анализе</span></label>
            </div>}
            <label><span>Категория</span><select value={categoryOverride} onChange={(event) => setCategoryOverride(event.target.value)}><option value="">Определять по наименованию</option>{['Лотки', 'Плёнки', 'Гофра и короба', 'Обечайки', 'Этикетки', 'Упаковка', 'Индивидуальная упаковка', 'Прочее'].map((category) => <option key={category}>{category}</option>)}</select></label>
            {categoryOverride === 'Обечайки' && <div className="items-directory__sleeve-settings">
              <label><span>Основной клиент для всей партии</span><select value={sleeveClient} onChange={(event) => setSleeveClient(event.target.value)}>{sleeveClients.map((client) => <option key={client}>{client}</option>)}</select></label>
              <label><span>Добавить новый формат</span><div className="items-directory__inline-add"><input value={newSleeveFormat} onChange={(event) => setNewSleeveFormat(event.target.value)} placeholder="Например, 150 × 420" /><button type="button" onClick={() => { const value = normalizeSleeveFormat(newSleeveFormat); if (value && !sleeveFormats.includes(value)) { const next = [...sleeveFormats, value]; setSleeveFormats(next); localStorage.setItem(SLEEVE_FORMATS_KEY, JSON.stringify(next)); } setNewSleeveFormat(''); }}>Добавить</button></div></label>
            </div>}
            <label><span>Позиции — PLU и наименование, каждая с новой строки</span><textarea rows={categoryOverride === 'Обечайки' ? 5 : 9} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={'PLU Наименование PLU\nET-10001 Этикетка верхняя\nET-10002     Этикетка нижняя'} /></label>
            {categoryOverride === 'Обечайки' && parsedBulkLines.length > 0 && <div className="items-directory__sleeve-preview">
              <strong>Предварительная проверка форматов и клиентов</strong>
              <div className="items-directory__preview-actions">
                <select value={previewClientTarget} onChange={(event) => setPreviewClientTarget(event.target.value)}>{sleeveClients.map((client) => <option key={client}>{client}</option>)}</select>
                <button type="button" disabled={!selectedPreviewRows.length} onClick={() => setSleeveClientOverrides((current) => ({ ...current, ...Object.fromEntries(selectedPreviewRows.map((index) => [index, previewClientTarget])) }))}>Назначить выбранным</button>
                <input value={newSleeveClient} onChange={(event) => setNewSleeveClient(event.target.value)} placeholder="Новый клиент, например Около" />
                <button type="button" disabled={!selectedPreviewRows.length || !newSleeveClient.trim()} onClick={() => { const client = newSleeveClient.trim(); setAddedSleeveClients((current) => current.includes(client) ? current : [...current, client]); setSleeveClientOverrides((current) => ({ ...current, ...Object.fromEntries(selectedPreviewRows.map((index) => [index, client])) })); setPreviewClientTarget(client); setNewSleeveClient(''); }}>Добавить и назначить</button>
              </div>
              <table><thead><tr><th><input type="checkbox" checked={selectedPreviewRows.length === parsedBulkLines.length} onChange={(event) => setSelectedPreviewRows(event.target.checked ? parsedBulkLines.map((_, index) => index) : [])} aria-label="Выбрать все обечайки в проверке" /></th><th>PLU</th><th>Наименование</th><th>Клиент</th><th>Формат</th><th>Тираж</th></tr></thead><tbody>{parsedBulkLines.map((item, index) => { const detected = sleeveFormatOverrides[index] || detectSleeveFormat(item.name, sleeveFormats); const printRun = detected && currentDraftSupplierName ? sleevePrintRuns[sleeveRunKey(currentDraftSupplierName, detected)] ?? 0 : 0; return <tr key={`${item.plu}-${index}`}><td><input type="checkbox" checked={selectedPreviewRows.includes(index)} onChange={(event) => setSelectedPreviewRows((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index))} aria-label={`Выбрать ${item.plu}`} /></td><td>{item.plu || '—'}</td><td>{item.name || '—'}</td><td><select value={sleeveClientOverrides[index] || sleeveClient} onChange={(event) => setSleeveClientOverrides({ ...sleeveClientOverrides, [index]: event.target.value })}>{sleeveClients.map((client) => <option key={client}>{client}</option>)}</select></td><td><select className={detected ? '' : 'is-error'} value={detected} onChange={(event) => setSleeveFormatOverrides({ ...sleeveFormatOverrides, [index]: event.target.value })}><option value="">Формат не определён</option>{sleeveFormats.map((format) => <option key={format}>{format}</option>)}</select></td><td><input className={printRun ? '' : 'is-error'} type="text" inputMode="numeric" pattern="[0-9]*" min="1" value={printRun || ''} disabled={!detected || !currentDraftSupplierName} onChange={(event) => saveSleevePrintRun(currentDraftSupplierName, detected, Number(event.target.value) || 0)} placeholder="Укажите тираж" /></td></tr>; })}</tbody></table>
            </div>}
            <label className="items-directory__pallet-field"><span>Штук на паллете — необязательно</span><input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={bulkPiecesPerPallet} onChange={(event) => setBulkPiecesPerPallet(event.target.value)} placeholder="Оставьте пустым для этикеток и обечаек" /></label>
            <p className="items-directory__hint">SAP-код, договор и корзина подставятся из выбранного поставщика. Для этикеток и обечаек поле паллеты можно оставить пустым.</p>
            {error && <p className="items-directory__error">{error}</p>}
          </div>
          <footer><button type="button" disabled={isBulkSaving} onClick={closeAdd}>Отменить</button><button className="dashboard-button dashboard-button--primary" type="button" disabled={isBulkSaving} onClick={addPositions}>{isBulkSaving ? 'Сохраняю…' : 'Добавить в справочник'}</button></footer>
        </aside>
      </>}

      {editingRow && <>
        <button className="dashboard-details-backdrop" type="button" aria-label="Закрыть редактирование" onClick={() => setEditingRow(null)} />
        <aside className="items-directory__modal items-directory__modal--edit draggable-modal" style={editModalDrag.dragStyle} aria-label="Корректировка позиции">
          <header className="draggable-modal__handle" {...editModalDrag.dragHandleProps}><div><span>Справочник</span><h2>Корректировать позицию</h2></div><button type="button" onClick={() => setEditingRow(null)}>×</button></header>
          <div className="items-directory__modal-body items-directory__edit-grid">
            <label><span>Категория</span><select value={editingRow.category} onChange={(event) => setEditingRow({ ...editingRow, category: event.target.value })}>{['Лотки', 'Плёнки', 'Гофра и короба', 'Обечайки', 'Этикетки', 'Упаковка', 'Индивидуальная упаковка', 'Прочее'].map((category) => <option key={category}>{category}</option>)}</select></label>
            <label><span>PLU</span><input value={editingRow.plu} onChange={(event) => setEditingRow({ ...editingRow, plu: event.target.value })} /></label>
            <label className="items-directory__edit-name"><span>Наименование PLU</span><input value={editingRow.name} onChange={(event) => setEditingRow({ ...editingRow, name: event.target.value })} /></label>
            <label><span>Поставщик</span><select value={editingRow.supplier} onChange={(event) => changeEditingSupplier(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.name}>{supplier.name}</option>)}</select></label>
            <label><span>SAP-код</span><input value={editingRow.supplierSapCode} onChange={(event) => setEditingRow({ ...editingRow, supplierSapCode: event.target.value })} /></label>
            <label><span>Номер договора</span><input value={editingRow.contractNumber} onChange={(event) => setEditingRow({ ...editingRow, contractNumber: event.target.value })} /></label>
            <label><span>Номер корзины</span><input value={editingRow.basketNumber} onChange={(event) => setEditingRow({ ...editingRow, basketNumber: event.target.value })} /></label>
            <label><span>Штук на паллете</span><input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={editingRow.piecesPerPallet || ''} onChange={(event) => setEditingRow({ ...editingRow, piecesPerPallet: Number(event.target.value) || 0 })} /></label>
            {editingRow.category === 'Обечайки' && <><label><span>Формат обечайки</span><select value={editingRow.sleeveFormat ?? ''} onChange={(event) => setEditingRow({ ...editingRow, sleeveFormat: event.target.value, sleevePrintRun: sleevePrintRuns[sleeveRunKey(editingRow.supplier, event.target.value)] ?? 0 })}><option value="">Формат не указан</option>{sleeveFormats.map((format) => <option key={format}>{format}</option>)}</select></label><label><span>Клиент</span><input list="sleeve-client-options" value={editingRow.sleeveClient ?? ''} onChange={(event) => setEditingRow({ ...editingRow, sleeveClient: event.target.value })} placeholder="Выберите или введите нового клиента" /></label><label><span>Тираж</span><input type="text" inputMode="numeric" pattern="[0-9]*" min="1" value={editingRow.sleevePrintRun || ''} onChange={(event) => setEditingRow({ ...editingRow, sleevePrintRun: Number(event.target.value) || 0 })} placeholder="Укажите тираж" /></label></>}
            <label className="items-directory__checkbox"><input type="checkbox" checked={editingRow.showInAnalysis} onChange={(event) => setEditingRow({ ...editingRow, showInAnalysis: event.target.checked })} /><span>Отображать в анализе</span></label>
            {error && <p className="items-directory__error">{error}</p>}
          </div>
          <footer><button type="button" disabled={isBulkSaving} onClick={() => setEditingRow(null)}>Отменить</button><button className="dashboard-button dashboard-button--primary" type="button" disabled={isBulkSaving} onClick={saveEditing}>{isBulkSaving ? 'Сохраняю…' : 'Сохранить изменения'}</button></footer>
        </aside>
      </>}

      {isBulkEditOpen && <>
        <button className="dashboard-details-backdrop" type="button" aria-label="Закрыть массовую корректировку" onClick={() => setIsBulkEditOpen(false)} />
        <aside className="items-directory__modal items-directory__modal--bulk draggable-modal" style={bulkEditDrag.dragStyle} aria-label="Массовая корректировка позиций">
          <header className="draggable-modal__handle" {...bulkEditDrag.dragHandleProps}><div><span>Справочник</span><h2>Корректировать {selectedRowIds.length} {positionWord(selectedRowIds.length)}</h2></div><button type="button" onClick={() => setIsBulkEditOpen(false)}>×</button></header>
          <div className="items-directory__bulk-editor">
            <section className="items-directory__bulk-search">
              <label>
                <span>Поиск внутри выбранных позиций</span>
                <input value={bulkEditSearch} onChange={(event) => setBulkEditSearch(event.target.value)} placeholder="Формат, PLU, наименование, клиент или поставщик…" />
              </label>
              <span>Найдено: <strong>{filteredBulkEditRows.length}</strong></span>
              <button type="button" disabled={!filteredBulkEditRows.length} onClick={() => setSelectedBulkEditRowIds((current) => [...new Set([...current, ...filteredBulkIds])])}>Выбрать найденные</button>
              <button type="button" disabled={!filteredBulkEditRows.length} onClick={() => setSelectedBulkEditRowIds((current) => current.filter((id) => !filteredBulkIds.includes(id)))}>Снять выбор</button>
            </section>
            <section className="items-directory__bulk-supplier">
              <div className="items-directory__mode"><button className={bulkSupplierMode === 'existing' ? 'is-active' : ''} type="button" onClick={() => setBulkSupplierMode('existing')}>Существующий поставщик</button><button className={bulkSupplierMode === 'new' ? 'is-active' : ''} type="button" onClick={() => setBulkSupplierMode('new')}>Новый поставщик</button></div>
              {bulkSupplierMode === 'existing' ? <label><span>Поставщик для всей группы</span><select value={bulkEditSupplier} onChange={(event) => setBulkEditSupplier(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.name}>{supplier.name}</option>)}</select></label> : <div className="items-directory__bulk-new-supplier"><label><span>Название</span><input value={bulkSupplierDraft.name} onChange={(event) => setBulkSupplierDraft({ ...bulkSupplierDraft, name: event.target.value })} /></label><label><span>SAP-код</span><input value={bulkSupplierDraft.supplierSapCode} onChange={(event) => setBulkSupplierDraft({ ...bulkSupplierDraft, supplierSapCode: event.target.value })} /></label><label><span>Договор</span><input value={bulkSupplierDraft.contractNumber} onChange={(event) => setBulkSupplierDraft({ ...bulkSupplierDraft, contractNumber: event.target.value })} /></label><label><span>Корзина</span><input value={bulkSupplierDraft.basketNumber} onChange={(event) => setBulkSupplierDraft({ ...bulkSupplierDraft, basketNumber: event.target.value })} /></label></div>}
              <button className="dashboard-button dashboard-button--primary" type="button" disabled={!selectedBulkEditRowIds.length} onClick={applySupplierToBulkRows}>Применить поставщика к выбранным</button>
            </section>
            <section className="items-directory__bulk-apply">
              <strong>Изменить выбранные позиции</strong>
              <span>Выбрано: {selectedBulkEditRowIds.length}</span>
              <select value={bulkField} onChange={(event) => { setBulkField(event.target.value); setBulkFieldValue(''); }}>{bulkFieldOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              {bulkField === 'sleeveClient' ? <input list="sleeve-client-options" value={bulkFieldValue} onChange={(event) => setBulkFieldValue(event.target.value)} placeholder="Выберите или введите нового клиента" /> : bulkValueOptions ? <select value={bulkFieldValue} onChange={(event) => setBulkFieldValue(event.target.value)}><option value="">Выберите значение</option>{bulkValueOptions.map((value) => <option key={value}>{value}</option>)}</select> : <input type={bulkField === 'sleevePrintRun' || bulkField === 'piecesPerPallet' ? 'number' : 'text'} min="0" value={bulkFieldValue} onChange={(event) => setBulkFieldValue(event.target.value)} placeholder="Общее значение" />}
              <button className="dashboard-button dashboard-button--primary" type="button" disabled={!selectedBulkEditRowIds.length || !bulkFieldValue.trim()} onClick={applyFieldToSelectedBulkRows}>Применить к выбранным</button>
            </section>
            <div className="items-directory__bulk-table"><table><thead><tr><th><input type="checkbox" checked={areAllFilteredBulkRowsSelected} onChange={(event) => setSelectedBulkEditRowIds((current) => event.target.checked ? [...new Set([...current, ...filteredBulkIds])] : current.filter((id) => !filteredBulkIds.includes(id)))} aria-label="Выбрать все найденные позиции" /></th><th>Категория</th><th>Формат</th><th>Клиент</th><th>Тираж</th><th>PLU</th><th>Наименование PLU</th><th>Поставщик</th><th>SAP-код</th><th>Договор</th><th>Корзина</th><th>Штук на паллете</th></tr></thead><tbody>{filteredBulkEditRows.map((row) => <tr key={row.id}>
              <td><input type="checkbox" checked={selectedBulkEditRowIds.includes(row.id)} onChange={(event) => setSelectedBulkEditRowIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} aria-label={`Выбрать ${row.plu}`} /></td>
              <td><select value={row.category} onChange={(event) => updateBulkRow(row.id, { category: event.target.value })}>{['Лотки', 'Плёнки', 'Гофра и короба', 'Обечайки', 'Этикетки', 'Упаковка', 'Индивидуальная упаковка', 'Прочее'].map((category) => <option key={category}>{category}</option>)}</select></td>
              <td>{row.category === 'Обечайки' ? <select value={row.sleeveFormat ?? ''} onChange={(event) => updateBulkRow(row.id, { sleeveFormat: event.target.value, sleevePrintRun: sleevePrintRuns[sleeveRunKey(row.supplier, event.target.value)] ?? 0 })}>{sleeveFormats.map((format) => <option key={format}>{format}</option>)}</select> : '—'}</td>
              <td>{row.category === 'Обечайки' ? <input list="sleeve-client-options" value={row.sleeveClient ?? ''} onChange={(event) => updateBulkRow(row.id, { sleeveClient: event.target.value })} placeholder="Выберите или введите нового клиента" /> : '—'}</td>
              <td>{row.category === 'Обечайки' ? <input type="text" inputMode="numeric" pattern="[0-9]*" min="1" value={row.sleevePrintRun || ''} onChange={(event) => updateBulkRow(row.id, { sleevePrintRun: Number(event.target.value) || 0 })} placeholder="Тираж" /> : '—'}</td>
              <td><input value={row.plu} onChange={(event) => updateBulkRow(row.id, { plu: event.target.value })} /></td>
              <td><input value={row.name} onChange={(event) => updateBulkRow(row.id, { name: event.target.value })} /></td>
              <td><select value={row.supplier} onChange={(event) => { const supplier = suppliers.find((item) => item.name === event.target.value); updateBulkRow(row.id, supplier ? { supplier: supplier.name, supplierSapCode: supplier.supplierSapCode, contractNumber: supplier.contractNumber, basketNumber: supplier.basketNumber, sleevePrintRun: row.category === 'Обечайки' && row.sleeveFormat ? sleevePrintRuns[sleeveRunKey(supplier.name, row.sleeveFormat)] ?? 0 : row.sleevePrintRun } : { supplier: event.target.value }); }}>{[...new Set([row.supplier, ...suppliers.map((supplier) => supplier.name)])].map((name) => <option key={name}>{name}</option>)}</select></td>
              <td><input value={row.supplierSapCode} onChange={(event) => updateBulkRow(row.id, { supplierSapCode: event.target.value })} /></td>
              <td><input value={row.contractNumber} onChange={(event) => updateBulkRow(row.id, { contractNumber: event.target.value })} /></td>
              <td><input value={row.basketNumber} onChange={(event) => updateBulkRow(row.id, { basketNumber: event.target.value })} /></td>
              <td><input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={row.piecesPerPallet || ''} onChange={(event) => updateBulkRow(row.id, { piecesPerPallet: Number(event.target.value) || 0 })} /></td>
            </tr>)}</tbody></table>{filteredBulkEditRows.length === 0 && <div className="items-directory__empty">По заданному поиску позиции не найдены</div>}</div>
          </div>
          {error && <p className="items-directory__bulk-error">{error}</p>}
          <footer><button type="button" disabled={isBulkSaving} onClick={() => setIsBulkEditOpen(false)}>Отменить</button><button className="dashboard-button dashboard-button--primary" type="button" disabled={isBulkSaving} onClick={saveBulkEditing}>{isBulkSaving ? 'Сохраняю…' : 'Сохранить все изменения'}</button></footer>
        </aside>
      </>}
    </div>
  );
}
