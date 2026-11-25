import type { BackendAccountPayload } from '../components/AuthScreens';
import type { TransactionCategory } from '../types/banking';

export interface StepUpResponseFields {
  requiresStepUp?: boolean;
  challengeId?: string;
  maskedEmail?: string;
  reason?: string;
  otpCode?: string;
  locked?: boolean;
  retryAfterSec?: number;
  duplicate?: boolean;
}

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T &
    StepUpResponseFields & {
      ok?: boolean;
      error?: string;
      notRegistered?: boolean;
      alreadyRegistered?: boolean;
    };
}

const ACCOUNTS_KEY = 'opay_fallback_accounts_v1';
const OTPS_KEY = 'opay_fallback_otps_v1';
const SESSION_PHONE_KEY = 'empay_active_session_phone';

// Session Bearer token lives strictly in JS memory (paired with HttpOnly cookie)
let inMemorySessionToken: string | null = null;

export function getInMemorySessionToken(): string | null {
  return inMemorySessionToken;
}

export function setInMemorySessionToken(token: string | null): void {
  inMemorySessionToken = token && token.trim() ? token.trim() : null;
}

export function getSavedSessionPhone(): string | null {
  try {
    return window.localStorage.getItem(SESSION_PHONE_KEY);
  } catch {
    return null;
  }
}

export function setSavedSessionPhone(normalizedPhone: string | null): void {
  try {
    if (normalizedPhone) {
      window.localStorage.setItem(SESSION_PHONE_KEY, normalizedPhone);
    } else {
      window.localStorage.removeItem(SESSION_PHONE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

export function clearAllCachedAccounts(): void {
  inMemorySessionToken = null;
  try {
    window.localStorage.removeItem(ACCOUNTS_KEY);
    window.localStorage.removeItem(OTPS_KEY);
    window.localStorage.removeItem(SESSION_PHONE_KEY);
  } catch {
    // Ignore storage issues
  }
}

export function generateIdempotencyKey(prefix = 'tx'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit
): Promise<{ available: true; result: ApiResult<T> } | { available: false }> {
  const attempt = async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const authHeaders: Record<string, string> = {};
      if (inMemorySessionToken) {
        authHeaders.Authorization = `Bearer ${inMemorySessionToken}`;
      }

      const res = await fetch(url, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'EMPay-App',
          ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
          ...authHeaders,
          ...(options?.headers ?? {}),
        },
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      if (!contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(text) as T & { ok?: boolean; error?: string };
          return {
            available: true as const,
            result: { ok: res.ok, status: res.status, data: parsed },
          };
        } catch {
          return { available: false as const };
        }
      }

      const parsed = (text ? JSON.parse(text) : {}) as T & { ok?: boolean; error?: string };
      return {
        available: true as const,
        result: { ok: res.ok, status: res.status, data: parsed },
      };
    } finally {
      window.clearTimeout(timer);
    }
  };

  try {
    const first = await attempt();
    if (first.available && first.result.status < 502) {
      return first;
    }
  } catch {
    // Retry once on transient network/abort glitch
  }

  await new Promise((r) => window.setTimeout(r, 350));

  try {
    const second = await attempt();
    if (second.available) {
      return second;
    }
  } catch {
    // Fall through to unavailable
  }

  return { available: false };
}

export async function checkSessionApi(): Promise<{
  ok: boolean;
  status: number;
  account: BackendAccountPayload | null;
}> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>('/api/auth/session', { method: 'GET' });

  if (!remote.available) {
    return { ok: false, status: 503, account: null };
  }

  if (remote.result.ok && remote.result.data.account) {
    if (remote.result.data.sessionToken) {
      setInMemorySessionToken(remote.result.data.sessionToken);
    }
    setSavedSessionPhone(remote.result.data.account.normalizedPhone);
    return { ok: true, status: remote.result.status, account: remote.result.data.account };
  }

  return { ok: false, status: remote.result.status, account: null };
}

export async function logoutApi(): Promise<void> {
  try {
    await fetchJsonWithRetry('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAllCachedAccounts();
  }
}

export async function checkRegisteredApi(identifier: string): Promise<
  ApiResult<{
    normalizedPhone?: string;
    displayPhone?: string;
    firstName?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    normalizedPhone?: string;
    displayPhone?: string;
    firstName?: string;
  }>('/api/auth/check-registered', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to reach E&M Pay server. Please check your connection and try again.',
    },
  };
}

export async function checkSignupPhoneApi(phone: string): Promise<
  ApiResult<{
    normalizedPhone?: string;
    e164Phone?: string;
    displayPhone?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    normalizedPhone?: string;
    e164Phone?: string;
    displayPhone?: string;
  }>('/api/auth/check-signup-phone', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to reach E&M Pay server. Please check your connection and try again.',
    },
  };
}

export async function requestOtpApi(payload: {
  identifier: string;
  email: string;
  purpose?: 'signup';
}): Promise<
  ApiResult<{
    normalizedPhone?: string;
    displayPhone?: string;
    maskedEmail?: string;
    deliveredVia?: 'resend' | 'in_app_preview';
    otpCode?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    normalizedPhone?: string;
    displayPhone?: string;
    maskedEmail?: string;
    deliveredVia?: 'resend' | 'in_app_preview';
    otpCode?: string;
  }>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({
      identifier: payload.identifier,
      email: payload.email,
      purpose: payload.purpose ?? 'signup',
    }),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to reach E&M Pay server to send email OTP. Please try again.',
    },
  };
}

export async function verifyOtpApi(payload: {
  normalizedPhone: string;
  email?: string;
  code: string;
}): Promise<
  ApiResult<{
    emailVerificationToken?: string;
    verifiedEmail?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    emailVerificationToken?: string;
    verifiedEmail?: string;
  }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to reach E&M Pay server to verify email OTP. Please try again.',
    },
  };
}

export async function checkEmailVerificationApi(payload: {
  normalizedPhone: string;
  email: string;
}): Promise<
  ApiResult<{
    verified?: boolean;
    emailVerificationToken?: string;
    verifiedEmail?: string;
    message?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    verified?: boolean;
    emailVerificationToken?: string;
    verifiedEmail?: string;
    message?: string;
  }>('/api/auth/check-email-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to check email verification status right now.',
    },
  };
}

export interface DetectedBvnInfo {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maskedPhone?: string;
}

export async function detectBvnApi(payload: {
  bvn: string;
  normalizedPhone?: string;
  emailVerificationToken?: string;
}): Promise<
  ApiResult<{
    detected?: boolean;
    missingApiKey?: boolean;
    message?: string;
    bvnInfo?: DetectedBvnInfo;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    detected?: boolean;
    missingApiKey?: boolean;
    message?: string;
    bvnInfo?: DetectedBvnInfo;
  }>('/api/kyc/detect-bvn', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Unable to reach Flutterwave BVN lookup service right now.',
    },
  };
}

export async function registerAccountApi(payload: {
  normalizedPhone: string;
  emailVerificationToken?: string;
  firebaseIdToken?: string;
  code?: string;
  fullName: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  pin: string;
  confirmPin: string;
  inviteCode?: string;
  idType?: 'bvn' | 'nin';
  idNumber?: string;
  consentAccepted?: boolean;
  firebaseUid?: string;
}): Promise<
  ApiResult<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    if (remote.result.ok && remote.result.data.account) {
      if (remote.result.data.sessionToken) {
        setInMemorySessionToken(remote.result.data.sessionToken);
      }
      setSavedSessionPhone(remote.result.data.account.normalizedPhone);
    }
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: {
      error:
        'Cannot reach E&M Pay server for real BVN and bank account verification. Please check your connection and try again.',
    },
  };
}

export async function loginAccountApi(payload: {
  identifier: string;
  pin: string;
}): Promise<
  ApiResult<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    if (remote.result.ok && remote.result.data.account) {
      if (remote.result.data.sessionToken) {
        setInMemorySessionToken(remote.result.data.sessionToken);
      }
      setSavedSessionPhone(remote.result.data.account.normalizedPhone);
    }
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to reach E&M Pay server to log in. Please try again.' },
  };
}

export async function verifyPinApi(pin: string): Promise<ApiResult> {
  const remote = await fetchJsonWithRetry<Record<string, unknown>>('/api/auth/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to verify PIN right now.' },
  };
}

export async function changePinApi(payload: {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}): Promise<
  ApiResult<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>('/api/auth/change-pin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    if (remote.result.ok && remote.result.data.sessionToken) {
      setInMemorySessionToken(remote.result.data.sessionToken);
    }
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to update PIN right now.' },
  };
}

export async function forgotPinRequestApi(payload: {
  phone: string;
  email: string;
}): Promise<
  ApiResult<{
    normalizedPhone?: string;
    maskedEmail?: string;
    deliveredVia?: 'resend' | 'in_app_preview';
    otpCode?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    normalizedPhone?: string;
    maskedEmail?: string;
    deliveredVia?: 'resend' | 'in_app_preview';
    otpCode?: string;
  }>('/api/auth/forgot-pin/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to reach E&M Pay server for PIN recovery.' },
  };
}

export async function forgotPinVerifyApi(payload: {
  normalizedPhone: string;
  code: string;
}): Promise<ApiResult<{ resetToken?: string }>> {
  const remote = await fetchJsonWithRetry<{ resetToken?: string }>(
    '/api/auth/forgot-pin/verify',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to verify recovery code right now.' },
  };
}

export async function forgotPinResetApi(payload: {
  normalizedPhone: string;
  resetToken: string;
  newPin: string;
  confirmPin: string;
}): Promise<
  ApiResult<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    sessionToken?: string;
  }>('/api/auth/forgot-pin/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    if (remote.result.ok && remote.result.data.account) {
      if (remote.result.data.sessionToken) {
        setInMemorySessionToken(remote.result.data.sessionToken);
      }
      setSavedSessionPhone(remote.result.data.account.normalizedPhone);
    }
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to reset your PIN right now.' },
  };
}

export async function fetchAccountSnapshotApi(
  normalizedPhone: string
): Promise<BackendAccountPayload | null> {
  const remote = await fetchJsonWithRetry<{ account?: BackendAccountPayload }>(
    `/api/account/${encodeURIComponent(normalizedPhone)}`
  );
  if (remote.available && remote.result.ok && remote.result.data.account) {
    return remote.result.data.account;
  }
  return null;
}

export async function saveAccountSnapshotApi(
  normalizedPhone: string,
  accountState: unknown
): Promise<void> {
  await fetchJsonWithRetry(`/api/account/${encodeURIComponent(normalizedPhone)}`, {
    method: 'PUT',
    body: JSON.stringify(accountState),
  });
}

export async function lookupEmPayAccountApi(identifier: string): Promise<
  ApiResult<{
    normalizedPhone?: string;
    accountNumber?: string;
    fullName?: string;
    firstName?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    normalizedPhone?: string;
    accountNumber?: string;
    fullName?: string;
    firstName?: string;
  }>('/api/accounts/lookup', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });

  if (remote.available) return remote.result;

  return {
    ok: false,
    status: 503,
    data: { error: 'Unable to look up E&M Pay account right now.' },
  };
}

export async function transferToEmPayAccountApi(payload: {
  senderNormalizedPhone: string;
  recipientIdentifier: string;
  amount: number;
  note?: string;
  pin: string;
  idempotencyKey?: string;
  stepUpChallengeId?: string;
  stepUpOtpCode?: string;
}): Promise<ApiResult<{ senderAccount?: BackendAccountPayload; transaction?: unknown }>> {
  const remote = await fetchJsonWithRetry<{
    senderAccount?: BackendAccountPayload;
    transaction?: unknown;
  }>('/api/transfer/em-pay', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to complete this transfer.' },
  };
}

export interface BankDirectoryItem {
  code: string;
  name: string;
}

export async function fetchNigerianBanksApi(): Promise<{
  ok: boolean;
  source?: string;
  requiresApiKey?: boolean;
  banks: BankDirectoryItem[];
}> {
  const remote = await fetchJsonWithRetry<{
    source?: string;
    requiresApiKey?: boolean;
    banks?: BankDirectoryItem[];
  }>('/api/banks', { method: 'GET' });

  if (remote.available && remote.result.ok && Array.isArray(remote.result.data.banks)) {
    return {
      ok: true,
      source: remote.result.data.source,
      requiresApiKey: remote.result.data.requiresApiKey,
      banks: remote.result.data.banks,
    };
  }

  return {
    ok: false,
    source: 'offline',
    requiresApiKey: true,
    banks: [
      { code: '044', name: 'Access Bank' },
      { code: '058', name: 'Guaranty Trust Bank' },
      { code: '057', name: 'Zenith bank PLC' },
      { code: '011', name: 'First Bank PLC' },
      { code: '033', name: 'United Bank for Africa' },
      { code: '090267', name: 'Kuda' },
      { code: '090405', name: 'Moniepoint Microfinance Bank' },
      { code: '120003', name: 'Momo Psb' },
      { code: '100033', name: 'PALMPAY' },
      { code: '100004', name: 'Opay' },
      { code: '070', name: 'Fidelity Bank' },
      { code: '032', name: 'Union Bank PLC' },
      { code: '232', name: 'Sterling Bank' },
      { code: '035', name: 'Wema Bank PLC' },
      { code: '221', name: 'Stanbic IBTC Bank' },
      { code: '214', name: 'FCMB' },
      { code: '076', name: 'Polaris Bank' },
      { code: '050', name: 'Ecobank Nigeria' },
    ],
  };
}

export async function resolveOtherBankAccountApi(payload: {
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
}): Promise<
  ApiResult<{
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    source?: string;
    missingApiKey?: boolean;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    source?: string;
    missingApiKey?: boolean;
  }>('/api/banks/resolve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: {
      missingApiKey: true,
      error: 'Bank lookup service is unavailable offline.',
    },
  };
}

export interface BankAccountMatch {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  fromRecents?: boolean;
}

export async function lookupAccountAcrossBanksApi(
  accountNumber: string
): Promise<
  ApiResult<{
    matches?: BankAccountMatch[];
    scannedCount?: number;
    source?: string;
    missingApiKey?: boolean;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    matches?: BankAccountMatch[];
    scannedCount?: number;
    source?: string;
    missingApiKey?: boolean;
  }>('/api/banks/lookup-multi', {
    method: 'POST',
    body: JSON.stringify({ accountNumber }),
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: {
      missingApiKey: true,
      matches: [],
      error: 'Bank lookup service is unavailable offline.',
    },
  };
}

export interface VirtualAccountInfo {
  accountNumber: string;
  bankName: string;
  accountName: string;
  orderRef: string;
  flwRef?: string;
  createdAt: string;
}

export interface FlwDepositRecord {
  txRef: string;
  normalizedPhone: string;
  expectedAmount: number;
  transferAmount?: number;
  method: 'bank_transfer' | 'checkout';
  status: 'pending' | 'credited' | 'failed';
  transferAccount?: string;
  transferBank?: string;
  transferNote?: string;
  accountExpiration?: string;
  checkoutLink?: string;
  createdAt: string;
}

export async function getFundingOverviewApi(normalizedPhone: string): Promise<{
  deposit: FlwDepositRecord | null;
  virtualAccount: VirtualAccountInfo | null;
}> {
  const remote = await fetchJsonWithRetry<{
    deposit?: FlwDepositRecord | null;
    virtualAccount?: VirtualAccountInfo | null;
  }>(`/api/add-money/pending/${encodeURIComponent(normalizedPhone)}`, { method: 'GET' });
  if (remote.available && remote.result.ok) {
    return {
      deposit: remote.result.data.deposit ?? null,
      virtualAccount: remote.result.data.virtualAccount ?? null,
    };
  }
  return { deposit: null, virtualAccount: null };
}

export async function getPendingFlwDepositApi(
  normalizedPhone: string
): Promise<FlwDepositRecord | null> {
  const overview = await getFundingOverviewApi(normalizedPhone);
  return overview.deposit;
}

export async function verifyKycAndGenerateVirtualAccountApi(payload: {
  normalizedPhone: string;
  idType: 'bvn' | 'nin';
  idNumber: string;
  consentAccepted: boolean;
  firebaseUid?: string;
}): Promise<
  ApiResult<{
    status?: 'successful' | 'failed' | 'pending';
    virtualAccount?: VirtualAccountInfo;
    account?: BackendAccountPayload;
    profile?: BackendAccountPayload['profile'];
    missingApiKey?: boolean;
    message?: string;
    error?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    status?: 'successful' | 'failed' | 'pending';
    virtualAccount?: VirtualAccountInfo;
    account?: BackendAccountPayload;
    profile?: BackendAccountPayload['profile'];
    missingApiKey?: boolean;
    message?: string;
    error?: string;
  }>('/api/kyc/verify-and-generate-va', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: {
      error: 'Cannot connect to E&M Pay server for identity verification.',
      status: 'failed',
    },
  };
}

export async function createPermanentVirtualAccountApi(payload: {
  normalizedPhone: string;
  bvn?: string;
  idType?: 'bvn' | 'nin';
  idNumber?: string;
  consentAccepted?: boolean;
  firebaseUid?: string;
}): Promise<
  ApiResult<{
    virtualAccount?: VirtualAccountInfo;
    account?: BackendAccountPayload;
    missingApiKey?: boolean;
    error?: string;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    virtualAccount?: VirtualAccountInfo;
    account?: BackendAccountPayload;
    missingApiKey?: boolean;
    error?: string;
  }>('/api/add-money/virtual-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) {
    return remote.result;
  }
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to generate permanent bank account.' },
  };
}

export async function createFlwBankTransferDepositApi(payload: {
  normalizedPhone: string;
  amount: number;
}): Promise<ApiResult<{ deposit?: FlwDepositRecord; missingApiKey?: boolean }>> {
  const remote = await fetchJsonWithRetry<{
    deposit?: FlwDepositRecord;
    missingApiKey?: boolean;
  }>('/api/add-money/bank-transfer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to create bank transfer deposit.' },
  };
}

export async function createFlwCheckoutDepositApi(payload: {
  normalizedPhone: string;
  amount: number;
  redirectUrl?: string;
}): Promise<ApiResult<{ deposit?: FlwDepositRecord; missingApiKey?: boolean }>> {
  const remote = await fetchJsonWithRetry<{
    deposit?: FlwDepositRecord;
    missingApiKey?: boolean;
  }>('/api/add-money/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to create checkout link.' },
  };
}

export async function verifyFlwDepositApi(payload: {
  normalizedPhone: string;
  txRef: string;
  transactionId?: string;
}): Promise<
  ApiResult<{
    status?: 'pending' | 'credited' | 'failed';
    alreadyCredited?: boolean;
    message?: string;
    account?: BackendAccountPayload;
    transaction?: unknown;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    status?: 'pending' | 'credited' | 'failed';
    alreadyCredited?: boolean;
    message?: string;
    account?: BackendAccountPayload;
    transaction?: unknown;
  }>('/api/add-money/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) return remote.result;
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to verify deposit.' },
  };
}

export async function transferToOtherBankApi(payload: {
  senderNormalizedPhone: string;
  accountNumber: string;
  bankCode?: string;
  bankName: string;
  recipientName: string;
  amount: number;
  note?: string;
  pin: string;
  idempotencyKey?: string;
  stepUpChallengeId?: string;
  stepUpOtpCode?: string;
}): Promise<
  ApiResult<{
    senderAccount?: BackendAccountPayload;
    transaction?: unknown;
    missingApiKey?: boolean;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    senderAccount?: BackendAccountPayload;
    transaction?: unknown;
    missingApiKey?: boolean;
  }>('/api/transfer/bank', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) {
    return remote.result;
  }
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to process bank transfer.' },
  };
}

export async function verifyBankTransferStatusApi(payload: {
  normalizedPhone: string;
  reference: string;
}): Promise<
  ApiResult<{
    status?: 'Pending' | 'Successful' | 'Reversed';
    senderAccount?: BackendAccountPayload;
    transaction?: unknown;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    status?: 'Pending' | 'Successful' | 'Reversed';
    senderAccount?: BackendAccountPayload;
    transaction?: unknown;
  }>('/api/transfer/bank/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (remote.available) {
    return remote.result;
  }
  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to verify transfer status.' },
  };
}

export interface LiveDataPlanItem {
  id: string;
  billerCode: string;
  itemCode: string;
  billType: string;
  size: string;
  validity: string;
  price: number;
  payAmount: number;
  cashback: number;
  category: 'Hot' | 'Daily' | 'Weekly' | 'Monthly' | 'Mega';
}

export async function fetchLiveDataPlansApi(
  carrier: string
): Promise<{ source: string; plans: LiveDataPlanItem[] }> {
  const remote = await fetchJsonWithRetry<{
    source?: string;
    plans?: LiveDataPlanItem[];
  }>(`/api/bills/data-plans/${encodeURIComponent(carrier)}`, {
    method: 'GET',
  });
  if (remote.available && remote.result.ok && Array.isArray(remote.result.data.plans)) {
    return {
      source: remote.result.data.source || 'flutterwave',
      plans: remote.result.data.plans,
    };
  }
  return { source: 'fallback', plans: [] };
}

export async function payBillApi(payload: {
  normalizedPhone: string;
  pin: string;
  amount: number;
  faceAmount?: number;
  category: TransactionCategory;
  recipientPhone: string;
  carrier: string;
  title: string;
  counterparty: string;
  billerCode?: string;
  itemCode?: string;
  billType?: string;
  cashbackEarned?: number;
  idempotencyKey?: string;
  stepUpChallengeId?: string;
  stepUpOtpCode?: string;
}): Promise<
  ApiResult<{
    account?: BackendAccountPayload;
    transaction?: unknown;
    cashbackEarned?: number;
  }>
> {
  const remote = await fetchJsonWithRetry<{
    account?: BackendAccountPayload;
    transaction?: unknown;
    cashbackEarned?: number;
  }>('/api/bills/pay', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: false,
    status: 503,
    data: { error: 'Cannot reach E&M Pay server to complete this bill payment.' },
  };
}

export async function autoCheckDepositApi(
  normalizedPhone: string,
  force = false
): Promise<
  ApiResult<{
    credited: boolean;
    amount?: number;
    creditedCount?: number;
    account?: BackendAccountPayload;
    transaction?: unknown;
    pendingCount?: number;
  }>
> {
  const qs = force ? '?force=1' : '';
  const remote = await fetchJsonWithRetry<{
    credited: boolean;
    amount?: number;
    creditedCount?: number;
    account?: BackendAccountPayload;
    transaction?: unknown;
    pendingCount?: number;
  }>(`/api/add-money/auto-check/${encodeURIComponent(normalizedPhone)}${qs}`, {
    method: 'GET',
  });

  if (remote.available) {
    return remote.result;
  }

  return {
    ok: true,
    status: 200,
    data: { credited: false, pendingCount: 0 },
  };
}
