import type {
  BankCard,
  Beneficiary,
  LoanState,
  NotificationItem,
  SavingsGoal,
  Transaction,
  UserProfile,
} from '../types/banking';

export const NIGERIAN_BANKS: string[] = [
  'FastDL Bank Digital Services',
  'GTBank (Guaranty Trust Bank)',
  'Access Bank',
  'Zenith Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Kuda Microfinance Bank',
  'Moniepoint Microfinance Bank',
  'MoMo Payment Service Bank',
  'PalmPay',
  'Fidelity Bank',
  'Union Bank',
  'Sterling Bank',
  'Wema Bank (ALAT)',
  'Stanbic IBTC Bank',
  'First City Monument Bank (FCMB)',
  'Polaris Bank',
  'Ecobank Nigeria',
];

export const INITIAL_PROFILE: UserProfile = {
  firstName: 'USER',
  fullName: 'FASTDL BANK USER',
  phone: '',
  normalizedPhone: '',
  accountNumber: '0000000000',
  address: '',
  dateOfBirth: '',
  gender: 'Not specified',
  tier: 'Tier 1',
  email: '',
  bvnVerified: false,
  ninVerified: false,
  biometricsEnabled: true,
  twoFactorEnabled: true,
  dailyTransferLimit: 50000,
  hasPin: false,
};

export const INITIAL_BENEFICIARIES: Beneficiary[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_SAVINGS_GOALS: SavingsGoal[] = [];
export const INITIAL_CARDS: BankCard[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_LOAN: LoanState = {
  eligibleLimit: 30000,
  approvedPendingAmount: 0,
  activeBalance: 0,
  principalAmount: 0,
  totalCharges: 0,
  dueDate: '30 days from disbursement',
  interestRateMonthly: 3.0,
  unlocked90Days: false,
};

export function formatNaira(amount: number, showDecimals = true): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString('en-NG', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${safe < 0 ? '-' : ''}₦${formatted}`;
}
