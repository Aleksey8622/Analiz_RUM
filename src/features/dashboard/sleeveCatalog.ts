export const DEFAULT_SLEEVE_FORMATS = [
  '100 × 385', '100 × 465,5', '105 × 392,5', '115 × 411', '224 × 290,3',
  '224 × 315,5', '275 × 75', '290 × 75', '75 × 346', '80 × 443,5',
  '324 × 55', 'Лоток трапеция', '358 × 70', '425 × 80', '406 × 80',
  '345 × 70', '441,5 × 80', '364 × 65', '328 × 75', '426 × 100',
];

export const DEFAULT_SLEEVE_CLIENTS = ['Пятёрочка', 'Перекрёсток', 'Ozon', 'Лента'];

export const normalizeSleeveFormat = (value: string) => value
  .trim()
  .replace(/\./g, ',')
  .replace(/\s*(?:x|х|×|\*)\s*/i, ' × ')
  .replace(/\s*мм\.?$/i, '')
  .trim();

export const detectSleeveFormat = (name: string, formats: string[]) => {
  if (/лоток\s+трапеци/i.test(name)) return formats.find((format) => format === 'Лоток трапеция') ?? '';
  const matches = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:x|х|×|\*)\s*(\d+(?:[.,]\d+)?)/gi)];
  const detected = matches[matches.length - 1];
  if (!detected) return '';
  const normalized = normalizeSleeveFormat(`${detected[1]} × ${detected[2]}`);
  const direct = formats.find((format) => normalizeSleeveFormat(format) === normalized);
  if (direct) return direct;
  const reversed = normalizeSleeveFormat(`${detected[2]} × ${detected[1]}`);
  return formats.find((format) => normalizeSleeveFormat(format) === reversed) ?? normalized;
};

export const detectSleeveClient = (name: string) => /(^|[^a-zа-я0-9])sel([^a-zа-я0-9]|$)/i.test(name)
  ? 'Перекрёсток'
  : /(^|[^a-zа-я0-9])5[kк]([^a-zа-я0-9]|$)/i.test(name) ? 'Пятёрочка' : '';
