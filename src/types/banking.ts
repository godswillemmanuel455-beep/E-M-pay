export type NavTab = 'home' | 'rewards' | 'wealth' | 'cards' | 'me';

export type TransactionType = 'credit' | 'debit';

export type TransactionCategory =
  | 'transfer'
  | 'deposit'
  | 'airtime'
  | 'data'
  | 'tv'
  | 'betting'
  | 'savings'
  | 'loan'
  | 'reward';

export interface Transaction {
  id: string;
  title: string;
  counterparty: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  timestamp: string;
  reference: string;
  status: 'Successful' | 'Pending' | 'Failed' | 'To be paid' | 'Reversed';
  note?: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  isOpay: boolean;
  initials: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  savedAmount: number;
  targetAmount: number;
  interestRate: number;
  maturityDate: string;
  type: 'OWealth' | 'Fixed' | 'Target';
}

export interface BankCard {
  id: string;
  label: string;
  scheme: 'Verve' | 'Mastercard';
  kind: 'Virtual' | 'Physical';
  maskedNumber: string;
  fullNumber: string;
  expiry: string;
  cvv: string;
  holderName: string;
  frozen: boolean;
  dailyLimit: number;
  currency: 'NGN' | 'USD';
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: 'transaction' | 'security' | 'reward';
}

export interface LoanApplicationInfo {
  employmentStatus: string;
  monthlyIncome: string;
  loanPurpose: string;
  emergencyName: string;
  emergencyPhone: string;
  stateOfResidence: string;
  tenureDays: 14 | 30 | 90;
  interestCharge?: number;
  serviceFee?: number;
  adminFee?: number;
  appliedAt: string;
}

export interface LoanState {
  eligibleLimit: number;
  approvedPendingAmount: number;
  activeBalance: number;
  principalAmount?: number;
  totalCharges?: number;
  dueDate: string;
  interestRateMonthly: number;
  unlocked90Days?: boolean;
  application?: LoanApplicationInfo;
}

export interface UserProfile {
  firstName: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  accountNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  tier: string;
  email: string;
  bvnVerified: boolean;
  ninVerified: boolean;
  verificationStatus?: 'not_verified' | 'pending' | 'successful' | 'failed';
  verificationType?: 'bvn' | 'nin' | 'none';
  verificationFailureReason?: string;
  maskedIdNumber?: string;
  consentAccepted?: boolean;
  firebaseUid?: string;
  biometricsEnabled: boolean;
  twoFactorEnabled: boolean;
  dailyTransferLimit: number;
  hasPin?: boolean;
}

export type ModalType =
  | { kind: 'none' }
  | { kind: 'add-money' }
  | { kind: 'verify-kyc'; initialIdType?: 'bvn' | 'nin' }
  | { kind: 'transfer'; mode: 'opay' | 'bank' }
  | { kind: 'bills'; service: 'airtime' | 'data' | 'tv' | 'betting' }
  | { kind: 'transactions'; selectedId?: string }
  | { kind: 'receipt'; transaction: Transaction }
  | { kind: 'loan' }
  | { kind: 'security' }
  | { kind: 'qr' }
  | { kind: 'notifications' }
  | { kind: 'assistant'; topic?: string }
  | { kind: 'email' }
  | { kind: 'invitation' }
  | { kind: 'limits' }
  | { kind: 'profile' }
  | { kind: 'settings' }
  | { kind: 'more-services' }
  | { kind: 'business' }
  | { kind: 'ussd' }
  | { kind: 'ojunior' };
