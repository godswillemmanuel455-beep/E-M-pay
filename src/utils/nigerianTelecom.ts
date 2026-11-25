export type CarrierId = 'mtn' | 'airtel' | 'glo' | '9mobile' | 'ntel' | 'smile' | 'unknown';

export interface CarrierInfo {
  id: CarrierId;
  name: string;
  shortLabel: string;
  bgHex: string;
  textHex: string;
  accentHex: string;
}

export const CARRIER_DIRECTORY: Record<CarrierId, CarrierInfo> = {
  airtel: {
    id: 'airtel',
    name: 'Airtel Nigeria',
    shortLabel: 'airtel',
    bgHex: '#E60000',
    textHex: '#FFFFFF',
    accentHex: '#FEE2E2',
  },
  mtn: {
    id: 'mtn',
    name: 'MTN Nigeria',
    shortLabel: 'MTN',
    bgHex: '#FFCC00',
    textHex: '#1A1D23',
    accentHex: '#FEF9C3',
  },
  glo: {
    id: 'glo',
    name: 'Globacom (Glo)',
    shortLabel: 'glo',
    bgHex: '#1E293B',
    textHex: '#FFFFFF',
    accentHex: '#FAF7F2',
  },
  '9mobile': {
    id: '9mobile',
    name: '9mobile (T2)',
    shortLabel: '9mobile',
    bgHex: '#BA7E44',
    textHex: '#FFFFFF',
    accentHex: '#F5EBDD',
  },
  ntel: {
    id: 'ntel',
    name: 'ntel Nigeria',
    shortLabel: 'ntel',
    bgHex: '#0369A1',
    textHex: '#FFFFFF',
    accentHex: '#E0F2FE',
  },
  smile: {
    id: 'smile',
    name: 'Smile 4G LTE',
    shortLabel: 'Smile',
    bgHex: '#7C3AED',
    textHex: '#FFFFFF',
    accentHex: '#EDE9FE',
  },
  unknown: {
    id: 'unknown',
    name: 'Nigerian Network',
    shortLabel: 'NG',
    bgHex: '#BA7E44',
    textHex: '#FFFFFF',
    accentHex: '#F5EBDD',
  },
};

const PREFIX_5: Record<string, CarrierId> = {
  '07020': 'smile',
  '07025': 'mtn',
  '07026': 'mtn',
  '07027': 'mtn',
  '07028': 'mtn',
  '07029': 'mtn',
};

const PREFIX_4: Record<string, CarrierId> = {
  // MTN Nigeria
  '0703': 'mtn',
  '0704': 'mtn',
  '0706': 'mtn',
  '0707': 'mtn',
  '0803': 'mtn',
  '0806': 'mtn',
  '0810': 'mtn',
  '0813': 'mtn',
  '0814': 'mtn',
  '0816': 'mtn',
  '0903': 'mtn',
  '0906': 'mtn',
  '0913': 'mtn',
  '0916': 'mtn',

  // Airtel Nigeria
  '0701': 'airtel',
  '0708': 'airtel',
  '0802': 'airtel',
  '0808': 'airtel',
  '0812': 'airtel',
  '0901': 'airtel',
  '0902': 'airtel',
  '0904': 'airtel',
  '0907': 'airtel',
  '0911': 'airtel',
  '0912': 'airtel',

  // Glo
  '0705': 'glo',
  '0805': 'glo',
  '0807': 'glo',
  '0811': 'glo',
  '0815': 'glo',
  '0905': 'glo',
  '0915': 'glo',

  // 9mobile
  '0809': '9mobile',
  '0817': '9mobile',
  '0818': '9mobile',
  '0908': '9mobile',
  '0909': '9mobile',

  // ntel
  '0804': 'ntel',
};

export interface PhoneIdentification {
  rawDigits: string;
  normalized11: string;
  formatted: string;
  prefix: string;
  carrierId: CarrierId;
  carrier: CarrierInfo;
  isValidLength: boolean;
  isRecognizedCarrier: boolean;
}

export function normalizeToNigerian11(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234') && digits.length > 3) {
    return `0${digits.slice(3, 13)}`;
  }
  if (!digits.startsWith('0') && digits.length >= 1 && /^[789]/.test(digits)) {
    return `0${digits.slice(0, 10)}`;
  }
  return digits.slice(0, 11);
}

export function formatNigerianPhoneDisplay(digits11: string): string {
  const clean = digits11.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 11)}`;
}

export function identifyNigerianPhone(input: string): PhoneIdentification {
  const normalized11 = normalizeToNigerian11(input);
  const formatted = formatNigerianPhoneDisplay(normalized11);

  let carrierId: CarrierId = 'unknown';
  let prefix = '';

  if (normalized11.length >= 5) {
    const p5 = normalized11.slice(0, 5);
    if (PREFIX_5[p5]) {
      carrierId = PREFIX_5[p5];
      prefix = p5;
    }
  }
  if (carrierId === 'unknown' && normalized11.length >= 4) {
    const p4 = normalized11.slice(0, 4);
    if (PREFIX_4[p4]) {
      carrierId = PREFIX_4[p4];
      prefix = p4;
    }
  }

  return {
    rawDigits: input.replace(/\D/g, ''),
    normalized11,
    formatted,
    prefix,
    carrierId,
    carrier: CARRIER_DIRECTORY[carrierId],
    isValidLength: normalized11.length === 11 && normalized11.startsWith('0'),
    isRecognizedCarrier: carrierId !== 'unknown',
  };
}

export interface DataPlanOption {
  id: string;
  size: string;
  validity: string;
  price: number;
  payAmount: number;
  cashback: number;
  category: 'Hot' | 'Daily' | 'Weekly' | 'Monthly' | 'Mega';
  billerCode?: string;
  itemCode?: string;
  billType?: string;
}

export function getDataPlansForCarrier(carrierId: CarrierId): DataPlanOption[] {
  const prefixLabel =
    carrierId === 'mtn'
      ? 'mtn'
      : carrierId === 'airtel'
      ? 'airtel'
      : carrierId === 'glo'
      ? 'glo'
      : carrierId === '9mobile'
      ? '9mob'
      : 'ng';

  return [
    // Hot
    { id: `${prefixLabel}_hot_1`, size: '1GB', validity: '1 Day', price: 350, payAmount: 345, cashback: 3.5, category: 'Hot' },
    { id: `${prefixLabel}_hot_2`, size: '1.5GB', validity: '7 Days', price: 600, payAmount: 590, cashback: 6.0, category: 'Hot' },
    { id: `${prefixLabel}_hot_3`, size: '2GB', validity: '30 Days', price: 1200, payAmount: 1180, cashback: 12.0, category: 'Hot' },
    { id: `${prefixLabel}_hot_4`, size: '3.2GB', validity: '30 Days', price: 1500, payAmount: 1475, cashback: 15.0, category: 'Hot' },
    { id: `${prefixLabel}_hot_5`, size: '6GB', validity: '7 Days', price: 1500, payAmount: 1475, cashback: 15.0, category: 'Hot' },
    { id: `${prefixLabel}_hot_6`, size: '10GB', validity: '30 Days', price: 3500, payAmount: 3450, cashback: 35.0, category: 'Hot' },

    // Daily
    { id: `${prefixLabel}_day_1`, size: '110MB', validity: '1 Day', price: 100, payAmount: 100, cashback: 1.0, category: 'Daily' },
    { id: `${prefixLabel}_day_2`, size: '230MB', validity: '1 Day', price: 200, payAmount: 200, cashback: 2.0, category: 'Daily' },
    { id: `${prefixLabel}_day_3`, size: '1GB', validity: '1 Day', price: 350, payAmount: 345, cashback: 3.5, category: 'Daily' },
    { id: `${prefixLabel}_day_4`, size: '2.5GB', validity: '2 Days', price: 600, payAmount: 590, cashback: 6.0, category: 'Daily' },
    { id: `${prefixLabel}_day_5`, size: '3.2GB', validity: '2 Days', price: 750, payAmount: 740, cashback: 7.5, category: 'Daily' },
    { id: `${prefixLabel}_day_6`, size: '5GB', validity: '2 Days', price: 1000, payAmount: 990, cashback: 9.0, category: 'Daily' },

    // Weekly
    { id: `${prefixLabel}_wk_1`, size: '1GB', validity: '7 Days', price: 500, payAmount: 490, cashback: 4.5, category: 'Weekly' },
    { id: `${prefixLabel}_wk_2`, size: '1.5GB', validity: '7 Days', price: 600, payAmount: 590, cashback: 6.0, category: 'Weekly' },
    { id: `${prefixLabel}_wk_3`, size: '3.5GB', validity: '7 Days', price: 1000, payAmount: 990, cashback: 9.0, category: 'Weekly' },
    { id: `${prefixLabel}_wk_4`, size: '6GB', validity: '7 Days', price: 1500, payAmount: 1475, cashback: 15.0, category: 'Weekly' },
    { id: `${prefixLabel}_wk_5`, size: '11GB', validity: '7 Days', price: 2500, payAmount: 2460, cashback: 25.0, category: 'Weekly' },
    { id: `${prefixLabel}_wk_6`, size: '20GB', validity: '7 Days', price: 3500, payAmount: 3450, cashback: 35.0, category: 'Weekly' },

    // Monthly
    { id: `${prefixLabel}_mo_1`, size: '2GB', validity: '30 Days', price: 1200, payAmount: 1180, cashback: 12.0, category: 'Monthly' },
    { id: `${prefixLabel}_mo_2`, size: '3.5GB', validity: '30 Days', price: 1500, payAmount: 1475, cashback: 15.0, category: 'Monthly' },
    { id: `${prefixLabel}_mo_3`, size: '7GB', validity: '30 Days', price: 2500, payAmount: 2460, cashback: 25.0, category: 'Monthly' },
    { id: `${prefixLabel}_mo_4`, size: '10GB', validity: '30 Days', price: 3500, payAmount: 3450, cashback: 35.0, category: 'Monthly' },
    { id: `${prefixLabel}_mo_5`, size: '16.5GB', validity: '30 Days', price: 5000, payAmount: 4925, cashback: 50.0, category: 'Monthly' },
    { id: `${prefixLabel}_mo_6`, size: '25GB', validity: '30 Days', price: 7500, payAmount: 7400, cashback: 75.0, category: 'Monthly' },

    // Mega
    { id: `${prefixLabel}_mg_1`, size: '40GB', validity: '30 Days', price: 10000, payAmount: 9850, cashback: 100.0, category: 'Mega' },
    { id: `${prefixLabel}_mg_2`, size: '75GB', validity: '30 Days', price: 15000, payAmount: 14750, cashback: 150.0, category: 'Mega' },
    { id: `${prefixLabel}_mg_3`, size: '120GB', validity: '30 Days', price: 20000, payAmount: 19700, cashback: 200.0, category: 'Mega' },
    { id: `${prefixLabel}_mg_4`, size: '200GB', validity: '60 Days', price: 30000, payAmount: 29550, cashback: 300.0, category: 'Mega' },
    { id: `${prefixLabel}_mg_5`, size: '400GB', validity: '90 Days', price: 50000, payAmount: 49250, cashback: 500.0, category: 'Mega' },
    { id: `${prefixLabel}_mg_6`, size: '800GB', validity: '365 Days', price: 90000, payAmount: 88650, cashback: 900.0, category: 'Mega' },
  ];
}
