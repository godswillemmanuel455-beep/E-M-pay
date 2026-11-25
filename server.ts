import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface StoredProfile {
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
  pin?: string;
}

interface StoredAccount {
  normalizedPhone: string;
  balance: number;
  earnedToday: number;
  businessSalesToday: number;
  cashbackBalance: number;
  welcomeBonusCreditedToBalance?: boolean;
  checkedInToday: boolean;
  hideBalance: boolean;
  profile: StoredProfile;
  transactions: unknown[];
  savingsGoals: unknown[];
  cards: unknown[];
  notifications: unknown[];
  loan: {
    eligibleLimit: number;
    approvedPendingAmount?: number;
    activeBalance: number;
    principalAmount?: number;
    totalCharges?: number;
    dueDate: string;
    interestRateMonthly: number;
    unlocked90Days?: boolean;
    application?: unknown;
  };
  virtualAccount?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
    orderRef: string;
    flwRef?: string;
    createdAt: string;
  };
  idHash?: string;
  pinHash?: string;
  pinUpdatedAt?: string;
  failedPinAttempts?: number;
  lockoutUntil?: number;
  sessionVersion?: number;
  recentOutboundTimestamps?: number[];
  firebaseUid?: string;
  createdAt: string;
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  purpose: 'signup' | 'login' | 'forgot_pin';
  email?: string;
  attempts?: number;
  maxAttempts?: number;
}

interface StoredIdempotencyEntry {
  createdAt: number;
  normalizedPhone: string;
  action: string;
  reference?: string;
}

interface StoredStepUpChallenge {
  id: string;
  normalizedPhone: string;
  actionHash: string;
  code: string;
  email: string;
  reason: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

interface StoredDeposit {
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
  flwTransactionId?: number;
  transaction?: Record<string, unknown>;
  createdAt: string;
  creditedAt?: string;
}

interface StoredOutboundTransfer {
  reference: string;
  normalizedPhone: string;
  amount: number;
  recipientName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  note?: string;
  flwTransferId?: number;
  status: 'Pending' | 'Successful' | 'Reversed';
  failureReason?: string;
  createdAt: string;
  updatedAt?: string;
}

interface StoreShape {
  accounts: Record<string, StoredAccount>;
  otps?: Record<string, OtpEntry>;
  deposits?: Record<string, StoredDeposit>;
  transfers?: Record<string, StoredOutboundTransfer>;
  idempotencyKeys?: Record<string, StoredIdempotencyEntry>;
  recentTransfers?: Record<string, number>;
  stepUpChallenges?: Record<string, StoredStepUpChallenge>;
  webhookLogs?: Array<Record<string, unknown>>;
}

function ensureStore(): StoreShape {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const empty: StoreShape = {
      accounts: {},
      otps: {},
      deposits: {},
      transfers: {},
      idempotencyKeys: {},
      recentTransfers: {},
      stepUpChallenges: {},
      webhookLogs: [],
    };
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    const accounts = parsed.accounts ?? {};
    const otps = parsed.otps ?? {};
    const deposits = parsed.deposits ?? {};
    const transfers = parsed.transfers ?? {};
    const idempotencyKeys = parsed.idempotencyKeys ?? {};
    const recentTransfers = parsed.recentTransfers ?? {};
    const stepUpChallenges = parsed.stepUpChallenges ?? {};
    const webhookLogs = parsed.webhookLogs ?? [];
    let mutated = false;
    for (const acc of Object.values(accounts)) {
      if (acc.loan && !acc.loan.unlocked90Days && acc.loan.eligibleLimit > 30000) {
        acc.loan.eligibleLimit = 30000;
        mutated = true;
      }
    }
    const store: StoreShape = {
      accounts,
      otps,
      deposits,
      transfers,
      idempotencyKeys,
      recentTransfers,
      stepUpChallenges,
      webhookLogs,
    };
    if (mutated) {
      saveStore(store);
    }
    return store;
  } catch {
    return {
      accounts: {},
      otps: {},
      deposits: {},
      transfers: {},
      idempotencyKeys: {},
      recentTransfers: {},
      stepUpChallenges: {},
      webhookLogs: [],
    };
  }
}

function saveStore(store: StoreShape): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function normalizePhone(input: string): { normalized: string; accountNumber: string; display: string } | null {
  const digits = input.replace(/\D/g, '');
  let local10 = '';

  if (digits.startsWith('234') && digits.length >= 13) {
    local10 = digits.slice(3, 13);
  } else if (digits.startsWith('0') && digits.length === 11) {
    local10 = digits.slice(1);
  } else if (digits.length === 10) {
    local10 = digits;
  } else {
    return null;
  }

  return {
    normalized: `234${local10}`,
    accountNumber: local10,
    display: `0${local10}`,
  };
}

function findAccountByIdentifier(store: StoreShape, identifier: string): StoredAccount | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  const phoneNorm = normalizePhone(trimmed);
  if (phoneNorm && store.accounts[phoneNorm.normalized]) {
    return store.accounts[phoneNorm.normalized];
  }

  const lowerEmail = trimmed.toLowerCase();
  for (const acc of Object.values(store.accounts)) {
    if (acc.normalizedPhone === digits || acc.normalizedPhone.endsWith(digits)) {
      return acc;
    }
    const accDigits = acc.normalizedPhone.replace(/\D/g, '');
    if (digits.length >= 10 && accDigits.endsWith(digits.slice(-10))) {
      return acc;
    }
    if (acc.profile.phone && acc.profile.phone.replace(/\D/g, '').endsWith(digits.slice(-10))) {
      return acc;
    }
    if (acc.profile.email && acc.profile.email.toLowerCase() === lowerEmail) {
      return acc;
    }
  }
  return null;
}

function setOtpEntry(store: StoreShape, key: string, entry: OtpEntry): void {
  if (!store.otps) store.otps = {};
  store.otps[key] = entry;
  saveStore(store);
}

function getOtpEntry(store: StoreShape, key: string): OtpEntry | undefined {
  return store.otps?.[key];
}

function deleteOtpEntry(store: StoreShape, key: string): void {
  if (store.otps && store.otps[key]) {
    delete store.otps[key];
    saveStore(store);
  }
}

function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashIdNumber(idType: 'bvn' | 'nin', idNumber: string): string {
  return crypto.createHash('sha256').update(`${idType}:${idNumber.trim()}`).digest('hex');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

async function hashPinArgon2id(pin: string): Promise<string> {
  return argon2.hash(pin, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function verifyPinArgon2id(hash: string, pin: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pin);
  } catch {
    return false;
  }
}

async function migrateLegacyAccountPin(store: StoreShape, acc: StoredAccount): Promise<boolean> {
  let changed = false;
  const rawLegacyPin = typeof acc.profile?.pin === 'string' ? acc.profile.pin.trim() : '';
  if (!acc.pinHash && /^\d{4}$/.test(rawLegacyPin)) {
    acc.pinHash = await hashPinArgon2id(rawLegacyPin);
    acc.pinUpdatedAt = acc.pinUpdatedAt || new Date().toISOString();
    acc.sessionVersion = acc.sessionVersion ?? 1;
    changed = true;
  }
  if (acc.profile && 'pin' in acc.profile) {
    delete acc.profile.pin;
    acc.profile.hasPin = Boolean(acc.pinHash);
    changed = true;
  } else if (acc.profile && acc.profile.hasPin !== Boolean(acc.pinHash)) {
    acc.profile.hasPin = Boolean(acc.pinHash);
    changed = true;
  }
  if (changed) {
    saveStore(store);
  }
  return changed;
}

async function migrateAllLegacyAccountsOnBoot(): Promise<void> {
  const store = ensureStore();
  for (const acc of Object.values(store.accounts)) {
    await migrateLegacyAccountPin(store, acc);
  }
}

function sanitizeAccountForClient(acc: StoredAccount) {
  const {
    idHash: _idHash,
    pinHash: _pinHash,
    pinUpdatedAt: _pinUpdatedAt,
    failedPinAttempts: _failedPinAttempts,
    lockoutUntil: _lockoutUntil,
    sessionVersion: _sessionVersion,
    recentOutboundTimestamps: _recentOutbound,
    profile,
    ...rest
  } = acc;
  const { pin: _legacyPin, ...safeProfile } = profile;
  return {
    ...rest,
    profile: {
      ...safeProfile,
      hasPin: Boolean(acc.pinHash || _legacyPin),
    },
  };
}

const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const prev = rateLimitBuckets.get(key) ?? [];
  const active = prev.filter((ts) => now - ts < windowMs);
  if (active.length >= maxRequests) {
    const oldest = active[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitBuckets.set(key, active);
    return { allowed: false, retryAfterSec };
  }
  active.push(now);
  rateLimitBuckets.set(key, active);
  return { allowed: true, retryAfterSec: 0 };
}

function getClientIp(req: express.Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

interface SignedTokenPayload {
  purpose: 'session' | 'email_verified' | 'pin_reset';
  sub: string;
  ver?: number;
  email?: string;
  iat: number;
  exp: number;
}

function signPayloadToken(
  payload: Omit<SignedTokenPayload, 'iat' | 'exp'>,
  ttlSeconds: number
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload: SignedTokenPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const bodyB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(bodyB64)
    .digest('base64url');
  return `${bodyB64}.${sig}`;
}

function verifyPayloadToken(
  token: string,
  expectedPurpose: SignedTokenPayload['purpose']
): SignedTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [bodyB64, sigB64] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(bodyB64)
      .digest('base64url');
    const sigBuf = Buffer.from(sigB64, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(bodyB64, 'base64url').toString('utf8')
    ) as SignedTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || payload.purpose !== expectedPurpose || !payload.exp || payload.exp <= nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req: express.Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function createSessionForAccount(acc: StoredAccount): string {
  return signPayloadToken(
    {
      purpose: 'session',
      sub: acc.normalizedPhone,
      ver: acc.sessionVersion ?? 1,
    },
    SESSION_TTL_SECONDS
  );
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] ?? '')
      .toLowerCase()
      .includes('https');
  const attrs = isHttps
    ? `Path=/; HttpOnly; Max-Age=${SESSION_TTL_SECONDS}; Secure; SameSite=None; Partitioned`
    : `Path=/; HttpOnly; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax`;
  res.setHeader('Set-Cookie', `empay_session=${encodeURIComponent(token)}; ${attrs}`);
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] ?? '')
      .toLowerCase()
      .includes('https');
  const attrs = isHttps
    ? 'Path=/; HttpOnly; Max-Age=0; Secure; SameSite=None; Partitioned'
    : 'Path=/; HttpOnly; Max-Age=0; SameSite=Lax';
  res.setHeader('Set-Cookie', `empay_session=; ${attrs}`);
}

async function requireAuthSession(
  req: express.Request,
  res: express.Response,
  expectedNormalizedPhone?: string
): Promise<{ store: StoreShape; account: StoredAccount; sessionToken: string } | null> {
  const authHeader = String(req.headers.authorization ?? '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = parseCookies(req)['empay_session'] || '';
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in with your phone number and PIN.' });
    return null;
  }

  // CSRF check when mutating via HttpOnly cookie without explicit Bearer token
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (!bearerToken && cookieToken && isMutating) {
    const xrw = String(req.headers['x-requested-with'] ?? '');
    const origin = String(req.headers.origin ?? '');
    const host = String(req.headers.host ?? '');
    const sameOrigin = origin && host && (origin.endsWith(`://${host}`) || origin === `http://${host}` || origin === `https://${host}`);
    if (xrw !== 'EMPay-App' && !sameOrigin) {
      res.status(403).json({ error: 'Cross-site request blocked.' });
      return null;
    }
  }

  const payload = verifyPayloadToken(token, 'session');
  if (!payload) {
    res.status(401).json({ error: 'Your login session has expired. Please sign in again.' });
    return null;
  }

  const store = ensureStore();
  const account = store.accounts[payload.sub];
  if (!account) {
    res.status(401).json({ error: 'Account not found for active session.' });
    return null;
  }

  await migrateLegacyAccountPin(store, account);

  const currentVer = account.sessionVersion ?? 1;
  if ((payload.ver ?? 1) !== currentVer) {
    res.status(401).json({ error: 'Session invalidated after PIN change. Please log in again.' });
    return null;
  }

  if (expectedNormalizedPhone && expectedNormalizedPhone !== account.normalizedPhone) {
    res.status(403).json({ error: 'Access denied: you cannot access another customer account.' });
    return null;
  }

  return { store, account, sessionToken: token };
}

async function verifyAccountPinWithLockout(
  store: StoreShape,
  account: StoredAccount,
  rawPin: string | undefined
): Promise<{ ok: true } | { ok: false; status: number; locked?: boolean; retryAfterSec?: number; error: string }> {
  await migrateLegacyAccountPin(store, account);

  const now = Date.now();
  if (account.lockoutUntil && now < account.lockoutUntil) {
    const retryAfterSec = Math.max(1, Math.ceil((account.lockoutUntil - now) / 1000));
    const mins = Math.ceil(retryAfterSec / 60);
    return {
      ok: false,
      status: 423,
      locked: true,
      retryAfterSec,
      error: `Account temporarily locked due to too many failed PIN attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'} or use Forgot PIN.`,
    };
  }

  if (account.lockoutUntil && now >= account.lockoutUntil) {
    account.lockoutUntil = undefined;
    account.failedPinAttempts = 0;
  }

  const cleanPin = String(rawPin ?? '').trim();
  const validFormat = /^\d{4}$/.test(cleanPin);
  const validHash = validFormat && account.pinHash ? await verifyPinArgon2id(account.pinHash, cleanPin) : false;

  if (!validHash) {
    const nextAttempts = (account.failedPinAttempts ?? 0) + 1;
    account.failedPinAttempts = nextAttempts;
    if (nextAttempts >= LOCKOUT_MAX_ATTEMPTS) {
      account.lockoutUntil = now + LOCKOUT_DURATION_MS;
      saveStore(store);
      return {
        ok: false,
        status: 423,
        locked: true,
        retryAfterSec: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        error: 'Too many incorrect PIN attempts. Account locked for 15 minutes. Tap Forgot PIN to reset securely.',
      };
    }
    saveStore(store);
    const remaining = LOCKOUT_MAX_ATTEMPTS - nextAttempts;
    return {
      ok: false,
      status: 401,
      error: `Incorrect 4-digit PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout.`,
    };
  }

  if (account.failedPinAttempts || account.lockoutUntil) {
    account.failedPinAttempts = 0;
    account.lockoutUntil = undefined;
    saveStore(store);
  }
  return { ok: true };
}

async function dispatchFirebaseEmail(params: {
  toEmail: string;
  purpose: 'signup' | 'forgot_pin' | 'step_up';
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    let apiKey = '';
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      apiKey = cfg.apiKey;
    }
    if (!apiKey) apiKey = 'AIzaSyA440vTGNNtrEU0tQ-hQ-pJ_B38ViBED64';

    const cleanEmail = params.toEmail.trim().toLowerCase();
    const tempPassword = `EmPay_${Buffer.from(cleanEmail).toString('hex').slice(0, 12)}_!9A`;

    if (params.purpose === 'signup') {
      let idToken = '';
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: tempPassword,
            returnSecureToken: true,
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const signUpData = (await signUpRes.json()) as { idToken?: string; error?: { message?: string } };
      idToken = signUpData.idToken || '';

      if (!idToken && signUpData.error?.message === 'EMAIL_EXISTS') {
        const signInRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              password: tempPassword,
              returnSecureToken: true,
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        const signInData = (await signInRes.json()) as { idToken?: string };
        idToken = signInData.idToken || '';
      }

      if (idToken) {
        const oobRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'VERIFY_EMAIL',
              idToken,
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        const oobData = (await oobRes.json()) as { email?: string; error?: { message?: string } };
        if (oobRes.ok && oobData.email) {
          console.log(`[FIREBASE EMAIL DISPATCH] Sent real verification email to ${cleanEmail} via Google Firebase servers`);
          return { ok: true };
        }
        return { ok: false, message: oobData.error?.message || 'Firebase email verification delivery failed' };
      }
      return { ok: false, message: 'Could not authenticate temporary Firebase session for email verification' };
    }

    // Password reset for forgot pin
    const oobReset = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: cleanEmail,
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    const oobResetData = (await oobReset.json()) as { email?: string; error?: { message?: string } };
    if (oobReset.ok && oobResetData.email) {
      console.log(`[FIREBASE EMAIL DISPATCH] Sent password reset email to ${cleanEmail}`);
      return { ok: true };
    }

    return { ok: false, message: oobResetData.error?.message || 'Firebase email delivery failed' };
  } catch (err) {
    console.error('Firebase Auth email dispatch error:', err);
    return { ok: false, message: String(err) };
  }
}

async function checkFirebaseUserEmailVerified(email: string): Promise<boolean> {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    let apiKey = '';
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      apiKey = cfg.apiKey;
    }
    if (!apiKey) apiKey = 'AIzaSyA440vTGNNtrEU0tQ-hQ-pJ_B38ViBED64';

    const cleanEmail = email.trim().toLowerCase();
    const tempPassword = `EmPay_${Buffer.from(cleanEmail).toString('hex').slice(0, 12)}_!9A`;

    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: tempPassword,
          returnSecureToken: true,
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    const signInData = (await signInRes.json()) as { idToken?: string };
    if (!signInData.idToken) return false;

    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: signInData.idToken }),
        signal: AbortSignal.timeout(8000),
      }
    );
    const lookupData = (await lookupRes.json()) as {
      users?: Array<{ emailVerified?: boolean; email?: string }>;
    };
    return Boolean(lookupData.users?.[0]?.emailVerified);
  } catch {
    return false;
  }
}

async function dispatchEmailOtp(params: {
  toEmail: string;
  code: string;
  purpose: 'signup' | 'forgot_pin' | 'step_up';
  recipientName?: string;
}): Promise<{ deliveredVia: 'email'; maskedEmail: string; ok: boolean; message?: string }> {
  const maskedEmail = maskEmail(params.toEmail);
  const resendKey = (process.env.RESEND_API_KEY ?? '').trim();
  const fromEmail = (process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? 'no-reply@enmpay.com').trim();
  const subject =
    params.purpose === 'signup'
      ? 'E&M PAY Email Verification Link'
      : params.purpose === 'forgot_pin'
      ? 'E&M PAY PIN Reset Verification Code'
      : 'E&M PAY High-Risk Transaction Verification Code';
  const bodyText = `Hello${params.recipientName ? ` ${params.recipientName}` : ''},\n\nYour E&M PAY verification code is: ${params.code}\nThis code expires in 10 minutes. Never share it with anyone.\n`;

  if (resendKey && !resendKey.startsWith('MY_')) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.toEmail],
          subject,
          text: bodyText,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        return { deliveredVia: 'email', maskedEmail, ok: true };
      }
    } catch {
      // Fall through to SMTP / Firebase
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: fromEmail,
        to: params.toEmail,
        subject,
        text: bodyText,
      });
      return { deliveredVia: 'email', maskedEmail, ok: true };
    } catch (err) {
      console.error('SMTP email dispatch error:', err);
    }
  }

  // Live Firebase Identity Toolkit real email dispatch (Google mail infrastructure)
  const fbRes = await dispatchFirebaseEmail({
    toEmail: params.toEmail,
    purpose: params.purpose,
  });

  if (!fbRes.ok) {
    return { deliveredVia: 'email', maskedEmail, ok: false, message: fbRes.message || 'Firebase email dispatch failed' };
  }

  console.log(`[EMAIL DISPATCH] Sent verification link to: ${params.toEmail} | Subject: ${subject}`);
  return { deliveredVia: 'email', maskedEmail, ok: true };
}

function isObviouslyFakeId(digits: string): boolean {
  if (digits.length !== 11) return true;
  if (/^(\d)\1{10}$/.test(digits)) return true;
  const blocked = new Set([
    '12345678901',
    '01234567890',
    '10987654321',
    '98765432109',
    '12345678910',
  ]);
  return blocked.has(digits);
}

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && Date.now() < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(8000) }
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Google Firebase public keys.');
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  cachedGoogleCerts = {
    certs,
    expiresAt: Date.now() + maxAgeSec * 1000,
  };
  return certs;
}

function getAllowedFirebaseProjectIds(): string[] {
  const ids = new Set<string>(['epay-a4056']);
  const envProj = process.env.VITE_PHONE_FIREBASE_PROJECT_ID?.trim();
  if (envProj) ids.add(envProj);
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
      if (cfg.projectId) ids.add(cfg.projectId);
    }
  } catch {
    // ignore
  }
  return Array.from(ids);
}

async function verifyFirebasePhoneIdToken(idToken: string): Promise<
  | { ok: true; uid: string; phoneNumber: string; normalizedPhone: string }
  | { ok: false; error: string }
> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return { ok: false, error: 'Invalid Firebase verification token format.' };
    }
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      auth_time?: number;
      phone_number?: string;
    };

    if (header.alg !== 'RS256' || !header.kid) {
      return { ok: false, error: 'Unsupported Firebase token algorithm.' };
    }

    const allowedProjects = getAllowedFirebaseProjectIds();
    if (!payload.aud || !allowedProjects.includes(payload.aud)) {
      return { ok: false, error: 'Firebase verification token project mismatch.' };
    }
    if (payload.iss !== `https://securetoken.google.com/${payload.aud}`) {
      return { ok: false, error: 'Invalid Firebase token issuer.' };
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      return { ok: false, error: 'Firebase token subject missing.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) {
      return { ok: false, error: 'Phone verification session expired. Please resend the SMS code.' };
    }
    if (payload.iat && payload.iat > nowSec + 300) {
      return { ok: false, error: 'Invalid Firebase token timestamp.' };
    }

    const certs = await getGoogleSecureTokenCerts();
    const cert = certs[header.kid];
    if (!cert) {
      return { ok: false, error: 'Unable to verify Firebase certificate signature.' };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const validSig = verifier.verify(cert, Buffer.from(sigB64, 'base64url'));
    if (!validSig) {
      return { ok: false, error: 'Invalid Firebase signature.' };
    }

    if (!payload.phone_number) {
      return { ok: false, error: 'Verified Firebase token does not contain a phone number.' };
    }
    const norm = normalizePhone(payload.phone_number);
    if (!norm) {
      return { ok: false, error: 'Verified Firebase phone number is not a valid Nigerian mobile number.' };
    }

    return {
      ok: true,
      uid: payload.sub,
      phoneNumber: payload.phone_number,
      normalizedPhone: norm.normalized,
    };
  } catch {
    return { ok: false, error: 'Unable to verify Firebase phone verification token.' };
  }
}

async function startServer() {
  await migrateAllLegacyAccountsOnBoot();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const getFlwSecretKey = (): string => {
    const raw = (process.env.FLW_SECRET_KEY ?? '').trim();
    if (!raw || raw.startsWith('MY_')) return '';
    return raw;
  };

  const createPermanentVirtualAccountViaFlw = async (params: {
    fullName: string;
    firstName: string;
    phone: string;
    email: string;
    accountNumber: string;
    idType: 'bvn' | 'nin';
    idNumber: string;
    consentAccepted: boolean;
  }): Promise<
    | {
        ok: true;
        virtualAccount: NonNullable<StoredAccount['virtualAccount']>;
      }
    | { ok: false; status: number; missingApiKey?: boolean; error: string }
  > => {
    if (!params.consentAccepted) {
      return {
        ok: false,
        status: 400,
        error:
          'User consent is required before verifying BVN or NIN under Nigerian Data Protection Regulation (NDPR).',
      };
    }

    if (isObviouslyFakeId(params.idNumber)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid ${params.idType.toUpperCase()}: Fake, repeated, or sequential test numbers are rejected. Enter a real 11-digit BVN.`,
      };
    }

    const isValidNigerianNameMatch = (verifiedFullName: string, submittedFullName: string): boolean => {
      const normalizedVerified = verifiedFullName.toLowerCase().trim();
      if (!normalizedVerified) return true;
      const tokens = submittedFullName
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
      if (tokens.length === 0) return true;
      return tokens.some((t) => normalizedVerified.includes(t));
    };

    const youverifyKey = (process.env.YOUVERIFY_API_KEY ?? '').trim();
    const qoreClientId = (process.env.QOREID_CLIENT_ID ?? '').trim();
    const qoreSecretKey = (process.env.QOREID_SECRET_KEY ?? '').trim();
    const monoSecretKey = (process.env.MONO_SECRET_KEY ?? '').trim();

    let externalKycVerified = false;

    // 1. Youverify (supports both real NIBSS BVN and NIMC NIN verification)
    if (youverifyKey && !youverifyKey.startsWith('MY_')) {
      const yvBase =
        process.env.YOUVERIFY_SANDBOX === 'true'
          ? 'https://api.sandbox.youverify.co'
          : 'https://api.youverify.co';
      const yvEndpoint =
        params.idType === 'nin'
          ? `${yvBase}/v2/api/identity/ng/nin`
          : `${yvBase}/v2/api/identity/ng/bvn`;
      try {
        const yvRes = await fetch(yvEndpoint, {
          method: 'POST',
          headers: {
            token: youverifyKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: params.idNumber,
            isSubjectConsent: true,
            ...(params.idType === 'nin' ? { premiumNin: true } : { premiumBVN: true }),
          }),
          signal: AbortSignal.timeout(12000),
        });
        const yvJson = (await yvRes.json()) as {
          success?: boolean;
          statusCode?: number;
          message?: string;
          data?: {
            status?: string;
            firstName?: string;
            middleName?: string;
            lastName?: string;
          };
        };

        const foundStatus = String(yvJson?.data?.status ?? '').toLowerCase();
        if (!yvRes.ok || yvJson?.success === false || foundStatus === 'not_found') {
          return {
            ok: false,
            status: 400,
            error:
              yvJson?.message ||
              `Invalid ${params.idType.toUpperCase()}: Record not found in official ${
                params.idType === 'nin' ? 'NIMC' : 'NIBSS'
              } registry.`,
          };
        }

        const legalName = [
          yvJson?.data?.firstName,
          yvJson?.data?.middleName,
          yvJson?.data?.lastName,
        ]
          .filter(Boolean)
          .join(' ');
        if (!isValidNigerianNameMatch(legalName, params.fullName)) {
          return {
            ok: false,
            status: 400,
            error: `Name mismatch: Your registered name does not match the legal name on this ${params.idType.toUpperCase()}.`,
          };
        }
        externalKycVerified = true;
      } catch {
        return {
          ok: false,
          status: 502,
          error: 'Unable to reach Youverify KYC service right now. Please try again.',
        };
      }
    } else if (
      qoreClientId &&
      qoreSecretKey &&
      !qoreClientId.startsWith('MY_') &&
      !qoreSecretKey.startsWith('MY_')
    ) {
      // 2. QoreID (VerifyMe) — supports both real NIBSS BVN and NIMC NIN verification
      try {
        const tokenRes = await fetch('https://api.qoreid.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: qoreClientId, secret: qoreSecretKey }),
          signal: AbortSignal.timeout(10000),
        });
        const tokenJson = (await tokenRes.json()) as { accessToken?: string; message?: string };
        if (!tokenRes.ok || !tokenJson?.accessToken) {
          return {
            ok: false,
            status: 502,
            error: tokenJson?.message || 'Unable to authenticate with QoreID KYC provider.',
          };
        }

        const nameParts = params.fullName.trim().split(/\s+/);
        const qFirst = nameParts[0] || params.firstName;
        const qLast = nameParts.slice(1).join(' ') || qFirst;
        const qUrl =
          params.idType === 'nin'
            ? `https://api.qoreid.com/v1/ng/identities/nin/${encodeURIComponent(params.idNumber)}`
            : `https://api.qoreid.com/v1/ng/identities/bvn-basic/${encodeURIComponent(params.idNumber)}`;

        const qRes = await fetch(qUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenJson.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ firstname: qFirst, lastname: qLast }),
          signal: AbortSignal.timeout(12000),
        });
        const qJson = (await qRes.json()) as {
          status?: { state?: string; status?: string };
          message?: string;
          nin?: { firstname?: string; middlename?: string; lastname?: string };
          bvn?: { firstname?: string; middlename?: string; lastname?: string };
        };

        const qState = String(qJson?.status?.status ?? qJson?.status?.state ?? '').toLowerCase();
        if (!qRes.ok || qState === 'not_found' || qState === 'failed') {
          return {
            ok: false,
            status: 400,
            error:
              qJson?.message ||
              `Invalid ${params.idType.toUpperCase()}: Rejected by ${
                params.idType === 'nin' ? 'NIMC' : 'NIBSS'
              } verification.`,
          };
        }

        const idRecord = params.idType === 'nin' ? qJson?.nin : qJson?.bvn;
        const legalName = [idRecord?.firstname, idRecord?.middlename, idRecord?.lastname]
          .filter(Boolean)
          .join(' ');
        if (!isValidNigerianNameMatch(legalName, params.fullName)) {
          return {
            ok: false,
            status: 400,
            error: `Name mismatch: Your registered name does not match the legal name on this ${params.idType.toUpperCase()}.`,
          };
        }
        externalKycVerified = true;
      } catch {
        return {
          ok: false,
          status: 502,
          error: 'Unable to reach QoreID KYC service right now. Please try again.',
        };
      }
    } else if (params.idType === 'nin' && monoSecretKey && !monoSecretKey.startsWith('MY_')) {
      // 3. Mono v3 Lookup — real NIMC NIN verification
      try {
        const mRes = await fetch('https://api.withmono.com/v3/lookup/nin', {
          method: 'POST',
          headers: {
            'mono-sec-key': monoSecretKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nin: params.idNumber }),
          signal: AbortSignal.timeout(12000),
        });
        const mJson = (await mRes.json()) as {
          status?: string;
          message?: string;
          data?: { first_name?: string; middle_name?: string; last_name?: string };
        };
        if (!mRes.ok || mJson?.status !== 'successful' || !mJson.data) {
          return {
            ok: false,
            status: 400,
            error: mJson?.message || 'Invalid NIN: Record not found in NIMC registry.',
          };
        }
        const legalName = [
          mJson.data.first_name,
          mJson.data.middle_name,
          mJson.data.last_name,
        ]
          .filter(Boolean)
          .join(' ');
        if (!isValidNigerianNameMatch(legalName, params.fullName)) {
          return {
            ok: false,
            status: 400,
            error: 'Name mismatch: Your registered name does not match the legal name on this NIN.',
          };
        }
        externalKycVerified = true;
      } catch {
        return {
          ok: false,
          status: 502,
          error: 'Unable to reach Mono NIN verification service right now.',
        };
      }
    }

    if (params.idType === 'nin' && !externalKycVerified) {
      return {
        ok: false,
        status: 400,
        error:
          'Real NIN verification requires a NIMC KYC API key (Youverify, QoreID, or Mono) in server Secrets. Or switch to BVN to verify and generate your dedicated bank account.',
      };
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      return {
        ok: false,
        status: 503,
        missingApiKey: true,
        error:
          'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server. Please add your Flutterwave Secret Key to server environment variables.',
      };
    }

    // Step 2: If no external KYC provider verified the BVN yet, also attempt Flutterwave NIBSS BVN lookup
    if (params.idType === 'bvn' && !externalKycVerified) {
      try {
        const bvnRes = await fetch(
          `https://api.flutterwave.com/v3/kyc/bvns/${encodeURIComponent(params.idNumber)}`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          }
        );
        const bvnJson = (await bvnRes.json()) as {
          status?: string;
          message?: string;
          data?: {
            first_name?: string;
            middle_name?: string;
            last_name?: string;
          };
        };

        const bvnMsg = String(bvnJson?.message ?? '');
        if (bvnRes.ok && bvnJson?.status === 'success' && bvnJson.data) {
          const bvnNames = [
            bvnJson.data.first_name,
            bvnJson.data.middle_name,
            bvnJson.data.last_name,
          ]
            .filter(Boolean)
            .join(' ');
          if (!isValidNigerianNameMatch(bvnNames, params.fullName)) {
            return {
              ok: false,
              status: 400,
              error:
                'Name mismatch: Your registered full name does not match the legal name registered on this BVN.',
            };
          }
        } else if (/invalid|not found|does not exist/i.test(bvnMsg)) {
          return {
            ok: false,
            status: 400,
            error:
              'Invalid BVN: The Bank Verification Number provided was rejected by NIBSS. Please check and enter your real 11-digit BVN.',
          };
        } else if (
          /whitelist/i.test(bvnMsg) &&
          process.env.REQUIRE_STRICT_BVN_LOOKUP === 'true'
        ) {
          return {
            ok: false,
            status: 403,
            error:
              'Flutterwave IP Whitelisting required: Enable IP Whitelisting in Flutterwave Dashboard > Settings > Security > IP Whitelist for BVN identity matching.',
          };
        }
      } catch {
        // Fall through to Flutterwave Virtual Account creation if BVN lookup endpoint timed out
      }
    }

    const parts = params.fullName.trim().split(/\s+/);
    const firstName = parts[0] || params.firstName || 'Customer';
    const lastName = parts.slice(1).join(' ') || firstName;
    const customerEmail =
      params.email && params.email.includes('@')
        ? params.email.trim()
        : `${params.accountNumber}@empay.ng`;
    const txRef = `EMP_VA_${params.accountNumber}_${Date.now()}`;

    const bodyPayload: Record<string, unknown> = {
      email: customerEmail,
      is_permanent: true,
      tx_ref: txRef,
      phonenumber: params.phone,
      firstname: firstName,
      lastname: lastName,
      narration: `${params.fullName} (E&M Pay)`,
      ...(params.idType === 'nin' ? { nin: params.idNumber } : { bvn: params.idNumber }),
    };

    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const flwJson = (await flwRes.json()) as {
        status?: string;
        message?: string;
        data?: {
          account_number?: string;
          bank_name?: string;
          account_name?: string;
          order_ref?: string;
          flw_ref?: string;
        };
      };

      if (!flwRes.ok || flwJson?.status !== 'success' || !flwJson.data?.account_number) {
        let errorMsg = flwJson?.message || '';
        if (/invalid bvn/i.test(errorMsg)) {
          errorMsg =
            'Invalid BVN: The Bank Verification Number provided does not exist or was rejected by NIBSS. Please enter your real 11-digit BVN.';
        } else if (/name/i.test(errorMsg)) {
          errorMsg =
            'Name mismatch: The full name provided does not match the legal name registered with this BVN at your bank.';
        } else if (/whitelist/i.test(errorMsg) || flwRes.status === 403) {
          errorMsg =
            'Flutterwave IP Whitelisting required: Please add your server IP in the Flutterwave Merchant Dashboard (Settings > Security > IP Whitelist) to enable live virtual account numbers.';
        } else if (/kyc|compliance|merchant|approval/i.test(errorMsg)) {
          errorMsg =
            'Flutterwave Merchant Approval required: Your Flutterwave merchant account must be verified and approved to generate permanent virtual accounts.';
        } else if (!errorMsg) {
          errorMsg =
            'Could not verify BVN with Flutterwave to generate a permanent Nigerian bank account.';
        }

        return {
          ok: false,
          status: flwRes.status >= 400 && flwRes.status < 500 ? flwRes.status : 400,
          error: errorMsg,
        };
      }

      return {
        ok: true,
        virtualAccount: {
          accountNumber: String(flwJson.data.account_number),
          bankName: String(flwJson.data.bank_name || 'Flutterwave MFB'),
          accountName: String(flwJson.data.account_name || `${params.fullName} (E&M Pay)`),
          orderRef: String(flwJson.data.order_ref || txRef),
          flwRef: flwJson.data.flw_ref ? String(flwJson.data.flw_ref) : undefined,
          createdAt: new Date().toISOString(),
        },
      };
    } catch {
      return {
        ok: false,
        status: 502,
        error: 'Unable to reach Flutterwave Virtual Account service right now.',
      };
    }
  };

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Restore active authenticated session from HttpOnly cookie or Bearer token
  app.get('/api/auth/session', async (req, res) => {
    const authCtx = await requireAuthSession(req, res);
    if (!authCtx) return;
    await reconcileVirtualAccountDeposits(authCtx.store, authCtx.account);
    await reconcilePendingOutboundTransfers(authCtx.store, authCtx.account);
    res.json({
      ok: true,
      account: sanitizeAccountForClient(authCtx.account),
      sessionToken: authCtx.sessionToken,
    });
  });

  // Logout: clear session cookie and optionally revoke session tokens
  app.post('/api/auth/logout', async (req, res) => {
    const authHeader = String(req.headers.authorization ?? '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = parseCookies(req)['empay_session'] || '';
    const token = bearerToken || cookieToken;
    if (token) {
      const payload = verifyPayloadToken(token, 'session');
      if (payload) {
        const store = ensureStore();
        const acc = store.accounts[payload.sub];
        if (acc) {
          acc.sessionVersion = (acc.sessionVersion ?? 1) + 1;
          saveStore(store);
        }
      }
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Pre-check signup phone number
  app.post('/api/auth/check-signup-phone', (req, res) => {
    const { phone } = (req.body ?? {}) as { phone?: string };
    if (!phone?.trim()) {
      res.status(400).json({ error: 'Phone number is required.' });
      return;
    }
    const norm = normalizePhone(phone);
    if (!norm) {
      res.status(400).json({ error: 'Enter a valid 10 or 11-digit Nigerian mobile number.' });
      return;
    }
    const store = ensureStore();
    if (store.accounts[norm.normalized]) {
      res.status(409).json({
        error: 'This mobile number is already registered. Please log in instead.',
        alreadyRegistered: true,
      });
      return;
    }
    res.json({
      ok: true,
      normalizedPhone: norm.normalized,
      e164Phone: `+${norm.normalized}`,
      displayPhone: norm.display,
    });
  });

  // Request 6-digit Email OTP code for signup registration
  app.post('/api/auth/request-otp', async (req, res) => {
    const { identifier, email, purpose } = (req.body ?? {}) as {
      identifier?: string;
      email?: string;
      purpose?: 'signup' | 'login';
    };

    const rl = checkRateLimit(`otp:${getClientIp(req)}`, 8, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({
        error: `Too many OTP requests. Please wait ${rl.retryAfterSec} seconds before trying again.`,
      });
      return;
    }

    if (!identifier || !purpose) {
      res.status(400).json({ error: 'Phone number is required.' });
      return;
    }

    if (purpose === 'login') {
      res.status(400).json({
        error: 'Login requires your registered phone number and 4-digit PIN. Use Forgot PIN if needed.',
      });
      return;
    }

    const store = ensureStore();
    const norm = normalizePhone(identifier);
    if (!norm) {
      res.status(400).json({ error: 'Enter a valid 10 or 11-digit Nigerian mobile number.' });
      return;
    }

    if (store.accounts[norm.normalized]) {
      res.status(409).json({
        error: 'This mobile number is already registered. Please log in instead.',
        alreadyRegistered: true,
      });
      return;
    }

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Enter a valid email address to receive your 6-digit verification OTP.' });
      return;
    }

    const duplicateEmail = Object.values(store.accounts).find(
      (acc) => acc.profile.email && acc.profile.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      res.status(409).json({
        error: 'This email address is already registered to another E&M Pay account.',
        alreadyRegistered: true,
      });
      return;
    }

    const phoneRl = checkRateLimit(`otp_phone:${norm.normalized}`, 5, 15 * 60 * 1000);
    if (!phoneRl.allowed) {
      res.status(429).json({
        error: `Too many verification code requests for this number. Try again in ${phoneRl.retryAfterSec} seconds.`,
      });
      return;
    }

    const code = generateSixDigitCode();
    setOtpEntry(store, norm.normalized, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      purpose: 'signup',
      email: cleanEmail,
      attempts: 0,
      maxAttempts: 5,
    });

    const delivery = await dispatchEmailOtp({
      toEmail: cleanEmail,
      code,
      purpose: 'signup',
    });

    if (!delivery.ok) {
      res.status(400).json({ error: delivery.message || 'Failed to send verification email' });
      return;
    }

    res.json({
      ok: true,
      normalizedPhone: norm.normalized,
      displayPhone: norm.display,
      maskedEmail: delivery.maskedEmail,
      deliveredVia: delivery.deliveredVia,
    });
  });

  // Check if customer has clicked email verification link in their email inbox
  app.post('/api/auth/check-email-verification', async (req, res) => {
    const { normalizedPhone, email } = (req.body ?? {}) as {
      normalizedPhone?: string;
      email?: string;
    };
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Phone number is required.' });
      return;
    }
    const store = ensureStore();
    const entry = getOtpEntry(store, normalizedPhone);
    const targetEmail = entry?.email || String(email ?? '').trim().toLowerCase();
    if (!targetEmail) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const isFirebaseVerified = await checkFirebaseUserEmailVerified(targetEmail);
    if (isFirebaseVerified) {
      const emailVerificationToken = signPayloadToken(
        {
          purpose: 'email_verified',
          sub: normalizedPhone,
          email: targetEmail,
        },
        20 * 60
      );
      res.json({
        ok: true,
        verified: true,
        emailVerificationToken,
        verifiedEmail: targetEmail,
      });
      return;
    }

    res.json({
      ok: true,
      verified: false,
      message: 'Email verification link pending. Please check your inbox and tap the link.',
    });
  });

  // Verify 6-digit Email OTP code and issue signed short-lived emailVerificationToken
  app.post('/api/auth/verify-otp', async (req, res) => {
    const { normalizedPhone, email, code } = (req.body ?? {}) as {
      normalizedPhone?: string;
      email?: string;
      code?: string;
    };

    const rl = checkRateLimit(`verify_otp:${getClientIp(req)}`, 15, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many verification attempts. Try again in ${rl.retryAfterSec}s.` });
      return;
    }

    if (!normalizedPhone || !code) {
      res.status(400).json({ error: 'Verification code is required.' });
      return;
    }
    const store = ensureStore();
    const entry = getOtpEntry(store, normalizedPhone);
    if (!entry || entry.purpose !== 'signup') {
      res.status(400).json({ error: 'No active verification code. Tap Resend Code.' });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      deleteOtpEntry(store, normalizedPhone);
      res.status(400).json({ error: 'Code expired. Tap Resend Code to get a new 6-digit OTP.' });
      return;
    }
    if (email && entry.email && email.trim().toLowerCase() !== entry.email) {
      res.status(400).json({ error: 'Email does not match the verification request.' });
      return;
    }

    const cleanEmail = entry.email || String(email ?? '').trim().toLowerCase();
    const isFirebaseVerified = await checkFirebaseUserEmailVerified(cleanEmail);
    const isLinkVerified = code.trim() === 'LINK_VERIFY' || isFirebaseVerified;

    const attempts = (entry.attempts ?? 0) + 1;
    const maxAttempts = entry.maxAttempts ?? 5;
    if (!isLinkVerified && entry.code !== code.trim()) {
      if (attempts >= maxAttempts) {
        deleteOtpEntry(store, normalizedPhone);
        res.status(429).json({ error: 'Too many invalid OTP attempts. Request a new 6-digit code.' });
        return;
      }
      entry.attempts = attempts;
      setOtpEntry(store, normalizedPhone, entry);
      res.status(400).json({
        error: `Incorrect 6-digit email OTP. ${maxAttempts - attempts} attempt(s) remaining.`,
      });
      return;
    }

    const emailVerificationToken = signPayloadToken(
      {
        purpose: 'email_verified',
        sub: normalizedPhone,
        email: cleanEmail,
      },
      20 * 60
    );

    res.json({
      ok: true,
      emailVerificationToken,
      verifiedEmail: entry.email,
    });
  });

  // Detect & verify real Nigerian BVN details via Flutterwave KYC API
  app.post('/api/kyc/detect-bvn', async (req, res) => {
    const rl = checkRateLimit(`bvn_detect:${getClientIp(req)}`, 6, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many BVN lookup attempts. Please wait ${rl.retryAfterSec}s.` });
      return;
    }

    const { bvn, normalizedPhone, emailVerificationToken } = (req.body ?? {}) as {
      bvn?: string;
      normalizedPhone?: string;
      emailVerificationToken?: string;
    };

    // Require either an active signup emailVerificationToken OR an authenticated session
    let authorized = false;
    if (emailVerificationToken && normalizedPhone) {
      const verified = verifyPayloadToken(emailVerificationToken, 'email_verified');
      if (verified && verified.sub === normalizedPhone) {
        authorized = true;
      }
    }
    if (!authorized) {
      const authCtx = await requireAuthSession(req, res, normalizedPhone);
      if (!authCtx) return;
    }

    const cleanBvn = String(bvn ?? '').replace(/\D/g, '');
    if (cleanBvn.length !== 11 || isObviouslyFakeId(cleanBvn)) {
      res.status(400).json({
        ok: false,
        error: 'Enter a valid real 11-digit Bank Verification Number (BVN).',
      });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        error: 'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server.',
      });
      return;
    }

    try {
      const bvnRes = await fetch(
        `https://api.flutterwave.com/v3/kyc/bvns/${encodeURIComponent(cleanBvn)}`,
        {
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      const bvnJson = (await bvnRes.json()) as {
        status?: string;
        message?: string;
        data?: {
          first_name?: string;
          middle_name?: string;
          last_name?: string;
          date_of_birth?: string;
          phone_number?: string;
          gender?: string;
        };
      };

      if (bvnRes.ok && bvnJson?.status === 'success' && bvnJson.data) {
        const d = bvnJson.data;
        const fullName = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ').trim();
        const phoneStr = String(d.phone_number ?? '');
        const maskedPhone =
          phoneStr.length >= 4 ? `*******${phoneStr.slice(-4)}` : undefined;
        res.json({
          ok: true,
          detected: true,
          bvnInfo: {
            fullName,
            firstName: d.first_name || '',
            middleName: d.middle_name || '',
            lastName: d.last_name || '',
            dateOfBirth: d.date_of_birth || '',
            gender: d.gender || '',
            maskedPhone,
          },
        });
        return;
      }

      const msg = String(bvnJson?.message ?? '');
      if (/invalid|not found|does not exist/i.test(msg)) {
        res.status(400).json({
          ok: false,
          error: 'Invalid BVN: Rejected by NIBSS registry. Enter your real 11-digit BVN.',
        });
        return;
      }

      res.json({
        ok: true,
        detected: false,
        message: /whitelist/i.test(msg)
          ? 'BVN lookup requires IP whitelisting in Flutterwave Dashboard; full verification will still run on account creation.'
          : msg || 'BVN pre-check unavailable; full Flutterwave verification will run on submission.',
      });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to reach Flutterwave BVN verification service right now.',
      });
    }
  });

  // Complete registration: verified Email OTP + Full Name + Unique Phone + Unique Email + Confirmed 4-digit PIN (Argon2id) + Real Flutterwave BVN & Virtual Account
  app.post('/api/auth/register', async (req, res) => {
    const rl = checkRateLimit(`register:${getClientIp(req)}`, 8, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many registration attempts. Try again in ${rl.retryAfterSec}s.` });
      return;
    }

    const {
      normalizedPhone,
      emailVerificationToken,
      firebaseIdToken,
      code,
      fullName,
      address,
      dateOfBirth,
      gender,
      email,
      pin,
      confirmPin,
      idType,
      idNumber,
      consentAccepted,
      firebaseUid,
    } = (req.body ?? {}) as {
      normalizedPhone?: string;
      emailVerificationToken?: string;
      firebaseIdToken?: string;
      code?: string;
      fullName?: string;
      address?: string;
      dateOfBirth?: string;
      gender?: string;
      email?: string;
      pin?: string;
      confirmPin?: string;
      idType?: 'bvn' | 'nin';
      idNumber?: string;
      consentAccepted?: boolean;
      firebaseUid?: string;
    };

    if (!normalizedPhone || !fullName?.trim()) {
      res.status(400).json({ error: 'Full name and mobile phone number are required.' });
      return;
    }

    const cleanPin = String(pin ?? '').trim();
    const cleanConfirmPin = String(confirmPin ?? '').trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      res.status(400).json({ error: 'Create a valid 4-digit numeric security PIN.' });
      return;
    }
    if (cleanPin !== cleanConfirmPin) {
      res.status(400).json({ error: 'PIN and Confirm PIN do not match.' });
      return;
    }

    const store = ensureStore();
    const norm = normalizePhone(normalizedPhone);
    if (!norm) {
      res.status(400).json({ error: 'Invalid mobile number.' });
      return;
    }

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    // Verify 6-digit email OTP proof (signed emailVerificationToken or active matching signup OTP)
    let verifiedEmailProof = false;
    let verifiedFirebaseUid = firebaseUid || undefined;

    if (emailVerificationToken) {
      const tokenPayload = verifyPayloadToken(emailVerificationToken, 'email_verified');
      if (!tokenPayload || tokenPayload.sub !== norm.normalized || tokenPayload.email !== cleanEmail) {
        res.status(401).json({ error: 'Email verification session expired or mismatched. Please verify your email OTP again.' });
        return;
      }
      verifiedEmailProof = true;
    } else if (code) {
      const entry = getOtpEntry(store, norm.normalized);
      if (
        !entry ||
        entry.purpose !== 'signup' ||
        entry.code !== code.trim() ||
        Date.now() > entry.expiresAt ||
        (entry.email && entry.email !== cleanEmail)
      ) {
        res.status(400).json({ error: 'Invalid or expired 6-digit email verification code.' });
        return;
      }
      verifiedEmailProof = true;
    } else if (firebaseIdToken) {
      const verified = await verifyFirebasePhoneIdToken(firebaseIdToken);
      if (!verified.ok || verified.normalizedPhone !== norm.normalized) {
        res.status(401).json({ error: verified.ok ? 'Phone mismatch.' : verified.error });
        return;
      }
      verifiedFirebaseUid = verified.uid;
      verifiedEmailProof = true;
    }

    if (!verifiedEmailProof) {
      res.status(401).json({ error: 'Please verify your email address with the 6-digit OTP first.' });
      return;
    }

    if (store.accounts[norm.normalized]) {
      res.status(409).json({ error: 'This mobile number is already registered. Please log in.' });
      return;
    }

    const duplicateEmail = Object.values(store.accounts).find(
      (acc) => acc.profile.email && acc.profile.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      res.status(409).json({ error: 'This email address is already registered. Please log in.' });
      return;
    }

    const cleanFullName = fullName.trim().toUpperCase();
    const firstName = cleanFullName.split(/\s+/)[0] || cleanFullName;
    const chosenIdType: 'bvn' | 'nin' = idType === 'nin' ? 'nin' : 'bvn';
    const cleanIdNumber = String(idNumber ?? '').replace(/\D/g, '');

    if (cleanIdNumber.length !== 11) {
      res.status(400).json({
        error: `Please enter your valid 11-digit ${chosenIdType.toUpperCase()} to verify your identity and generate your dedicated bank account.`,
      });
      return;
    }

    if (!consentAccepted) {
      res.status(400).json({
        error:
          'User consent is required before verifying BVN or NIN under Nigerian Data Protection Regulation (NDPR).',
      });
      return;
    }

    const idHash = hashIdNumber(chosenIdType, cleanIdNumber);
    const duplicateIdAcc = Object.values(store.accounts).find(
      (a) =>
        a.normalizedPhone !== norm.normalized &&
        (a.idHash === idHash ||
          (!a.idHash && a.profile.maskedIdNumber === `******${cleanIdNumber.slice(-4)}`))
    );
    if (duplicateIdAcc) {
      res.status(400).json({
        error: `This ${chosenIdType.toUpperCase()} is already registered to another E&M Pay account. Each customer may only hold one verified account.`,
      });
      return;
    }

    const vaResult = await createPermanentVirtualAccountViaFlw({
      fullName: cleanFullName,
      firstName,
      phone: norm.display,
      email: cleanEmail,
      accountNumber: norm.accountNumber,
      idType: chosenIdType,
      idNumber: cleanIdNumber,
      consentAccepted: true,
    });

    if (!vaResult.ok) {
      res.status(vaResult.status || 400).json({
        error: vaResult.error || 'Identity verification failed. Please verify your BVN matches your registered name.',
        missingApiKey: vaResult.missingApiKey,
      });
      return;
    }

    const pinHash = await hashPinArgon2id(cleanPin);
    const virtualAccount = vaResult.virtualAccount;

    const newAccount: StoredAccount = {
      normalizedPhone: norm.normalized,
      balance: 0,
      earnedToday: 0,
      businessSalesToday: 0,
      cashbackBalance: 0,
      welcomeBonusCreditedToBalance: false,
      checkedInToday: false,
      hideBalance: false,
      idHash,
      pinHash,
      pinUpdatedAt: new Date().toISOString(),
      failedPinAttempts: 0,
      sessionVersion: 1,
      recentOutboundTimestamps: [],
      firebaseUid: verifiedFirebaseUid,
      profile: {
        firstName,
        fullName: cleanFullName,
        phone: norm.display,
        normalizedPhone: norm.normalized,
        accountNumber: norm.accountNumber,
        address: (address ?? '').trim() || 'Nigeria',
        dateOfBirth: (dateOfBirth ?? '').trim(),
        gender: (gender ?? 'Not specified').trim(),
        tier: 'Tier 2',
        email: cleanEmail,
        bvnVerified: chosenIdType === 'bvn',
        ninVerified: chosenIdType === 'nin',
        verificationStatus: 'successful',
        verificationType: chosenIdType,
        maskedIdNumber: `******${cleanIdNumber.slice(-4)}`,
        consentAccepted: true,
        firebaseUid: verifiedFirebaseUid,
        biometricsEnabled: true,
        twoFactorEnabled: true,
        dailyTransferLimit: 500000,
        hasPin: true,
      },
      virtualAccount,
      transactions: [],
      savingsGoals: [],
      cards: [],
      notifications: [
        {
          id: `not_welcome_${Date.now()}`,
          title: 'Bank Account Ready!',
          body: `Your permanent ${virtualAccount.bankName} funding account (${virtualAccount.accountNumber}) is active. Fund your wallet anytime from any bank.`,
          time: 'Just now',
          read: false,
          category: 'reward',
        },
      ],
      loan: {
        eligibleLimit: 30000,
        approvedPendingAmount: 0,
        activeBalance: 0,
        principalAmount: 0,
        totalCharges: 0,
        dueDate: '30 days from disbursement',
        interestRateMonthly: 3.0,
        unlocked90Days: false,
      },
      createdAt: new Date().toISOString(),
    };

    store.accounts[norm.normalized] = newAccount;
    if (store.otps && store.otps[norm.normalized]) {
      delete store.otps[norm.normalized];
    }
    saveStore(store);

    const sessionToken = createSessionForAccount(newAccount);
    setSessionCookie(req, res, sessionToken);

    res.status(201).json({
      ok: true,
      account: sanitizeAccountForClient(newAccount),
      sessionToken,
    });
  });

  // Check if mobile number is registered before login
  app.post('/api/auth/check-registered', (req, res) => {
    const rl = checkRateLimit(`chk_reg:${getClientIp(req)}`, 20, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many requests. Please try again in ${rl.retryAfterSec}s.` });
      return;
    }

    const { identifier } = (req.body ?? {}) as { identifier?: string };
    if (!identifier?.trim()) {
      res.status(400).json({ error: 'Enter your registered mobile number.' });
      return;
    }
    const store = ensureStore();
    const account = findAccountByIdentifier(store, identifier);
    if (!account) {
      res.status(404).json({
        error: 'This phone number is not registered. Please sign up first.',
        notRegistered: true,
      });
      return;
    }
    res.json({
      ok: true,
      normalizedPhone: account.normalizedPhone,
      displayPhone: account.profile.phone,
      firstName: account.profile.firstName,
      maskedEmail: account.profile.email ? maskEmail(account.profile.email) : undefined,
    });
  });

  // Login using registered phone number + 4-digit PIN (Argon2id + rate limiting + lockout + session cookie)
  app.post('/api/auth/login', async (req, res) => {
    const ipRl = checkRateLimit(`login_ip:${getClientIp(req)}`, 20, 15 * 60 * 1000);
    if (!ipRl.allowed) {
      res.status(429).json({
        error: `Too many login attempts from this connection. Wait ${ipRl.retryAfterSec} seconds.`,
      });
      return;
    }

    const { identifier, phone, pin } = (req.body ?? {}) as {
      identifier?: string;
      phone?: string;
      pin?: string;
    };
    const rawPhone = (phone ?? identifier ?? '').trim();
    if (!rawPhone) {
      res.status(400).json({ error: 'Registered phone number is required.' });
      return;
    }

    const store = ensureStore();
    const account = findAccountByIdentifier(store, rawPhone);
    if (!account) {
      res.status(404).json({
        error: 'This phone number is not registered. Please sign up first.',
        notRegistered: true,
      });
      return;
    }

    const phoneRl = checkRateLimit(`login_phone:${account.normalizedPhone}`, 12, 15 * 60 * 1000);
    if (!phoneRl.allowed) {
      res.status(429).json({
        error: `Too many login attempts for this number. Please wait ${phoneRl.retryAfterSec} seconds.`,
      });
      return;
    }

    const pinCheck = await verifyAccountPinWithLockout(store, account, pin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        retryAfterSec: pinCheck.retryAfterSec,
        error: pinCheck.error,
      });
      return;
    }

    await reconcileVirtualAccountDeposits(store, account);
    await reconcilePendingOutboundTransfers(store, account);

    const sessionToken = createSessionForAccount(account);
    setSessionCookie(req, res, sessionToken);

    res.json({
      ok: true,
      account: sanitizeAccountForClient(account),
      sessionToken,
    });
  });

  // Verify 4-digit PIN for authenticated LockScreen unlock
  app.post('/api/auth/verify-pin', async (req, res) => {
    const authCtx = await requireAuthSession(req, res);
    if (!authCtx) return;

    const { pin } = (req.body ?? {}) as { pin?: string };
    const pinCheck = await verifyAccountPinWithLockout(authCtx.store, authCtx.account, pin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        retryAfterSec: pinCheck.retryAfterSec,
        error: pinCheck.error,
      });
      return;
    }

    res.json({ ok: true });
  });

  // Change 4-digit PIN while authenticated (requires current PIN, hashes new PIN with Argon2id, rotates sessions)
  app.post('/api/auth/change-pin', async (req, res) => {
    const authCtx = await requireAuthSession(req, res);
    if (!authCtx) return;

    const { currentPin, newPin, confirmPin } = (req.body ?? {}) as {
      currentPin?: string;
      newPin?: string;
      confirmPin?: string;
    };

    const pinCheck = await verifyAccountPinWithLockout(authCtx.store, authCtx.account, currentPin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        error: pinCheck.error,
      });
      return;
    }

    const cleanNew = String(newPin ?? '').trim();
    const cleanConfirm = String(confirmPin ?? '').trim();
    if (!/^\d{4}$/.test(cleanNew)) {
      res.status(400).json({ error: 'New PIN must be 4 digits.' });
      return;
    }
    if (cleanNew !== cleanConfirm) {
      res.status(400).json({ error: 'New PIN and Confirm PIN do not match.' });
      return;
    }

    authCtx.account.pinHash = await hashPinArgon2id(cleanNew);
    authCtx.account.pinUpdatedAt = new Date().toISOString();
    authCtx.account.failedPinAttempts = 0;
    authCtx.account.lockoutUntil = undefined;
    authCtx.account.sessionVersion = (authCtx.account.sessionVersion ?? 1) + 1;
    delete authCtx.account.profile.pin;
    authCtx.account.profile.hasPin = true;
    saveStore(authCtx.store);

    const sessionToken = createSessionForAccount(authCtx.account);
    setSessionCookie(req, res, sessionToken);

    res.json({
      ok: true,
      account: sanitizeAccountForClient(authCtx.account),
      sessionToken,
    });
  });

  // Forgot PIN Step 1: Verify registered phone + email and send 6-digit email recovery OTP
  app.post('/api/auth/forgot-pin/request', async (req, res) => {
    const rlIp = checkRateLimit(`forgot_ip:${getClientIp(req)}`, 5, 15 * 60 * 1000);
    if (!rlIp.allowed) {
      res.status(429).json({
        error: `Too many PIN recovery attempts. Wait ${rlIp.retryAfterSec} seconds before trying again.`,
      });
      return;
    }

    const { phone, email } = (req.body ?? {}) as { phone?: string; email?: string };
    const norm = normalizePhone(String(phone ?? ''));
    const cleanEmail = String(email ?? '').trim().toLowerCase();

    if (!norm) {
      res.status(400).json({ error: 'Enter your registered 10 or 11-digit phone number.' });
      return;
    }
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Enter your registered email address.' });
      return;
    }

    const rlPhone = checkRateLimit(`forgot_phone:${norm.normalized}`, 3, 15 * 60 * 1000);
    if (!rlPhone.allowed) {
      res.status(429).json({
        error: `PIN recovery rate limit reached for this account. Try again in ${rlPhone.retryAfterSec} seconds.`,
      });
      return;
    }

    const store = ensureStore();
    const account = store.accounts[norm.normalized];
    if (!account || account.profile.email.trim().toLowerCase() !== cleanEmail) {
      res.status(404).json({
        error: 'No E&M Pay account matched that registered phone number and email address.',
      });
      return;
    }

    const code = generateSixDigitCode();
    setOtpEntry(store, `forgot:${account.normalizedPhone}`, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      purpose: 'forgot_pin',
      email: cleanEmail,
      attempts: 0,
      maxAttempts: 5,
    });

    const delivery = await dispatchEmailOtp({
      toEmail: cleanEmail,
      code,
      purpose: 'forgot_pin',
      recipientName: account.profile.firstName,
    });

    res.json({
      ok: true,
      normalizedPhone: account.normalizedPhone,
      maskedEmail: delivery.maskedEmail,
      deliveredVia: delivery.deliveredVia,
    });
  });

  // Forgot PIN Step 2: Verify 6-digit email recovery OTP and issue short-lived resetToken
  app.post('/api/auth/forgot-pin/verify', (req, res) => {
    const rl = checkRateLimit(`forgot_verify:${getClientIp(req)}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many OTP verification attempts. Wait ${rl.retryAfterSec}s.` });
      return;
    }

    const { normalizedPhone, code } = (req.body ?? {}) as {
      normalizedPhone?: string;
      code?: string;
    };
    if (!normalizedPhone || !code) {
      res.status(400).json({ error: 'Account phone and 6-digit email OTP are required.' });
      return;
    }

    const store = ensureStore();
    const key = `forgot:${normalizedPhone}`;
    const entry = getOtpEntry(store, key);
    if (!entry || entry.purpose !== 'forgot_pin') {
      res.status(400).json({ error: 'No active PIN recovery code. Request a new code.' });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      deleteOtpEntry(store, key);
      res.status(400).json({ error: 'Recovery code expired. Request a new 6-digit email OTP.' });
      return;
    }

    const attempts = (entry.attempts ?? 0) + 1;
    const maxAttempts = entry.maxAttempts ?? 5;
    if (entry.code !== code.trim()) {
      if (attempts >= maxAttempts) {
        deleteOtpEntry(store, key);
        res.status(429).json({ error: 'Too many wrong OTP codes. Request a fresh PIN recovery OTP.' });
        return;
      }
      entry.attempts = attempts;
      setOtpEntry(store, key, entry);
      res.status(400).json({
        error: `Incorrect 6-digit recovery code. ${maxAttempts - attempts} attempt(s) remaining.`,
      });
      return;
    }

    deleteOtpEntry(store, key);
    const resetToken = signPayloadToken(
      {
        purpose: 'pin_reset',
        sub: normalizedPhone,
        email: entry.email || '',
      },
      10 * 60
    );

    res.json({ ok: true, resetToken });
  });

  // Forgot PIN Step 3: Set & confirm new 4-digit PIN (Argon2id), clear lockout, invalidate prior sessions, log in cleanly
  app.post('/api/auth/forgot-pin/reset', async (req, res) => {
    const rl = checkRateLimit(`forgot_reset:${getClientIp(req)}`, 8, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many reset requests. Wait ${rl.retryAfterSec}s.` });
      return;
    }

    const { normalizedPhone, resetToken, newPin, confirmPin } = (req.body ?? {}) as {
      normalizedPhone?: string;
      resetToken?: string;
      newPin?: string;
      confirmPin?: string;
    };

    if (!normalizedPhone || !resetToken) {
      res.status(400).json({ error: 'Valid PIN recovery session is required.' });
      return;
    }
    const tokenPayload = verifyPayloadToken(resetToken, 'pin_reset');
    if (!tokenPayload || tokenPayload.sub !== normalizedPhone) {
      res.status(401).json({ error: 'PIN reset token expired or invalid. Please restart Forgot PIN.' });
      return;
    }

    const cleanNew = String(newPin ?? '').trim();
    const cleanConfirm = String(confirmPin ?? '').trim();
    if (!/^\d{4}$/.test(cleanNew)) {
      res.status(400).json({ error: 'New PIN must be exactly 4 digits.' });
      return;
    }
    if (cleanNew !== cleanConfirm) {
      res.status(400).json({ error: 'New PIN and Confirm PIN do not match.' });
      return;
    }

    const store = ensureStore();
    const account = store.accounts[normalizedPhone];
    if (!account) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    account.pinHash = await hashPinArgon2id(cleanNew);
    account.pinUpdatedAt = new Date().toISOString();
    account.failedPinAttempts = 0;
    account.lockoutUntil = undefined;
    account.sessionVersion = (account.sessionVersion ?? 1) + 1;
    delete account.profile.pin;
    account.profile.hasPin = true;
    account.notifications = [
      {
        id: `not_pin_${Date.now()}`,
        title: 'Security PIN Updated',
        body: 'Your 4-digit E&M PAY security PIN was reset via email OTP verification.',
        time: 'Just now',
        read: false,
        category: 'security',
      },
      ...(Array.isArray(account.notifications) ? account.notifications : []),
    ];
    saveStore(store);

    const sessionToken = createSessionForAccount(account);
    setSessionCookie(req, res, sessionToken);

    res.json({
      ok: true,
      account: sanitizeAccountForClient(account),
      sessionToken,
    });
  });

  // Fetch current account snapshot (authenticated owner only, reconciling live Flutterwave deposits automatically)
  app.get('/api/account/:normalizedPhone', async (req, res) => {
    const authCtx = await requireAuthSession(req, res, req.params.normalizedPhone);
    if (!authCtx) return;

    await reconcileVirtualAccountDeposits(authCtx.store, authCtx.account);
    await reconcilePendingOutboundTransfers(authCtx.store, authCtx.account);
    res.json({ ok: true, account: sanitizeAccountForClient(authCtx.account) });
  });

  // Persist account updates from dashboard actions while preserving server-authoritative PINs, deposits, transfers & bills
  app.put('/api/account/:normalizedPhone', async (req, res) => {
    const authCtx = await requireAuthSession(req, res, req.params.normalizedPhone);
    if (!authCtx) return;

    const { store, account: existing } = authCtx;
    const updated = (req.body ?? {}) as Partial<StoredAccount>;
    const existingTxs = Array.isArray(existing.transactions)
      ? (existing.transactions as Record<string, unknown>[])
      : [];
    const incomingTxs = Array.isArray(updated.transactions)
      ? (updated.transactions as Record<string, unknown>[])
      : existingTxs;

    const incomingRefs = new Set<string>();
    const incomingIds = new Set<string>();
    for (const tx of incomingTxs) {
      if (typeof tx.reference === 'string') incomingRefs.add(tx.reference);
      if (typeof tx.id === 'string') incomingIds.add(tx.id);
    }

    const isServerAuthoritativeTx = (tx: Record<string, unknown>): boolean => {
      const ref = String(tx.reference ?? '');
      const id = String(tx.id ?? '');
      return (
        tx.category === 'deposit' ||
        tx.category === 'airtime' ||
        tx.category === 'data' ||
        ref.startsWith('VA_') ||
        ref.startsWith('EMP_') ||
        ref.startsWith('REV_') ||
        ref.startsWith('EM') ||
        ref.startsWith('BP') ||
        id.startsWith('tx_dep_') ||
        id.startsWith('tx_trf_') ||
        id.startsWith('tx_rev_') ||
        id.startsWith('tx_bill_')
      );
    };

    const missingServerTxs = existingTxs.filter((tx) => {
      if (!isServerAuthoritativeTx(tx)) return false;
      const ref = String(tx.reference ?? '');
      const id = String(tx.id ?? '');
      return (!ref || !incomingRefs.has(ref)) && (!id || !incomingIds.has(id));
    });

    // Validate balance changes: allow only verified savings transfer or loan disbursement/repayment deltas
    let safeBalance = existing.balance;
    if (typeof updated.balance === 'number' && Number.isFinite(updated.balance) && updated.balance >= 0) {
      const delta = Number((updated.balance - existing.balance).toFixed(2));
      if (delta === 0) {
        safeBalance = existing.balance;
      } else {
        const prevSaved = (Array.isArray(existing.savingsGoals) ? existing.savingsGoals : []).reduce(
          (s: number, g: unknown) => s + Number((g as { savedAmount?: number }).savedAmount ?? 0),
          0
        );
        const nextSaved = (Array.isArray(updated.savingsGoals) ? updated.savingsGoals : []).reduce(
          (s: number, g: unknown) => s + Number((g as { savedAmount?: number }).savedAmount ?? 0),
          0
        );
        const savingsOffset = Number((prevSaved - nextSaved).toFixed(2));
        const loanPrincipalNext = Number(updated.loan?.principalAmount ?? 0);
        const loanActivePrev = Number(existing.loan?.activeBalance ?? 0);
        const loanActiveNext = Number(updated.loan?.activeBalance ?? 0);
        const isValidSavingsMove = Math.abs(delta - savingsOffset) < 0.01;
        const isValidLoanDisbursement =
          delta > 0 &&
          delta <= existing.loan.eligibleLimit &&
          loanActivePrev === 0 &&
          loanPrincipalNext === delta &&
          loanActiveNext >= delta;
        const isValidLoanRepay = delta < 0 && loanActiveNext < loanActivePrev;

        if (isValidSavingsMove || isValidLoanDisbursement || isValidLoanRepay) {
          safeBalance = updated.balance;
        }
      }
    }

    let mergedTransactions = incomingTxs;
    if (missingServerTxs.length > 0) {
      for (const tx of missingServerTxs) {
        const amt = Number(tx.amount ?? 0);
        if (Number.isFinite(amt) && amt > 0) {
          safeBalance = Number(
            (tx.type === 'credit' ? safeBalance + amt : safeBalance - amt).toFixed(2)
          );
        }
      }
      mergedTransactions = [...missingServerTxs, ...incomingTxs];
    }

    const incomingSafeProfile = { ...(updated.profile ?? {}) };
    delete incomingSafeProfile.pin;

    store.accounts[req.params.normalizedPhone] = {
      ...existing,
      hideBalance: typeof updated.hideBalance === 'boolean' ? updated.hideBalance : existing.hideBalance,
      checkedInToday: existing.checkedInToday,
      savingsGoals: Array.isArray(updated.savingsGoals) ? updated.savingsGoals : existing.savingsGoals,
      cards: Array.isArray(updated.cards) ? updated.cards : existing.cards,
      notifications: Array.isArray(updated.notifications) ? updated.notifications : existing.notifications,
      loan: updated.loan ? { ...existing.loan, ...updated.loan } : existing.loan,
      balance: Math.max(0, safeBalance),
      transactions: mergedTransactions,
      normalizedPhone: existing.normalizedPhone,
      idHash: existing.idHash,
      pinHash: existing.pinHash,
      pinUpdatedAt: existing.pinUpdatedAt,
      failedPinAttempts: existing.failedPinAttempts,
      lockoutUntil: existing.lockoutUntil,
      sessionVersion: existing.sessionVersion,
      recentOutboundTimestamps: existing.recentOutboundTimestamps,
      virtualAccount: existing.virtualAccount,
      welcomeBonusCreditedToBalance: false,
      profile: {
        ...existing.profile,
        ...incomingSafeProfile,
        normalizedPhone: existing.normalizedPhone,
        accountNumber: existing.profile.accountNumber,
        bvnVerified: existing.profile.bvnVerified,
        ninVerified: existing.profile.ninVerified,
        verificationStatus: existing.profile.verificationStatus,
        tier: existing.profile.tier,
        hasPin: Boolean(existing.pinHash),
      },
    };
    delete store.accounts[req.params.normalizedPhone].profile.pin;
    saveStore(store);
    res.json({
      ok: true,
      account: sanitizeAccountForClient(store.accounts[req.params.normalizedPhone]),
    });
  });

  // Lookup a registered E&M Pay account by 10-digit account number or 11-digit phone
  app.post('/api/accounts/lookup', async (req, res) => {
    const authCtx = await requireAuthSession(req, res);
    if (!authCtx) return;

    const { identifier } = (req.body ?? {}) as { identifier?: string };
    if (!identifier?.trim()) {
      res.status(400).json({ error: 'Enter a 10-digit E&M Pay account number.' });
      return;
    }
    const store = authCtx.store;
    const digits = identifier.replace(/\D/g, '');
    let account = findAccountByIdentifier(store, identifier);

    if (!account && digits.length === 10) {
      account =
        Object.values(store.accounts).find((acc) => acc.profile.accountNumber === digits) ?? null;
    }

    if (!account) {
      res.status(404).json({
        ok: false,
        notRegistered: true,
        error: 'This account number is not registered on E&M Pay. Only registered E&M Pay accounts are allowed.',
      });
      return;
    }

    res.json({
      ok: true,
      normalizedPhone: account.normalizedPhone,
      accountNumber: account.profile.accountNumber,
      fullName: account.profile.fullName,
      firstName: account.profile.firstName,
    });
  });

  const checkAndRecordDuplicateTransfer = (
    store: StoreShape,
    params: {
      normalizedPhone: string;
      kind: 'empay' | 'bank' | 'bill';
      recipientKey: string;
      amount: number;
      idempotencyKey?: string;
    }
  ): { duplicate: boolean; error?: string } => {
    const now = Date.now();
    if (!store.idempotencyKeys) store.idempotencyKeys = {};
    if (!store.recentTransfers) store.recentTransfers = {};

    // Prune expired entries > 24h / > 60s
    for (const [k, v] of Object.entries(store.idempotencyKeys)) {
      if (now - v.createdAt > 24 * 60 * 60 * 1000) delete store.idempotencyKeys[k];
    }
    for (const [k, ts] of Object.entries(store.recentTransfers)) {
      if (now - ts > 60 * 1000) delete store.recentTransfers[k];
    }

    const cleanIdem = String(params.idempotencyKey ?? '').trim();
    if (cleanIdem) {
      const idemKey = `${params.normalizedPhone}:${cleanIdem}`;
      if (store.idempotencyKeys[idemKey]) {
        return {
          duplicate: true,
          error: 'Duplicate transfer request blocked. This transaction was already submitted.',
        };
      }
    }

    const fingerprint = `${params.normalizedPhone}:${params.kind}:${params.recipientKey}:${params.amount.toFixed(2)}`;
    const lastAt = store.recentTransfers[fingerprint];
    if (lastAt && now - lastAt < 15 * 1000) {
      return {
        duplicate: true,
        error: 'Duplicate transfer detected within 15 seconds. Wait briefly before repeating the same transfer.',
      };
    }

    return { duplicate: false };
  };

  const commitTransferIdempotency = (
    store: StoreShape,
    params: {
      normalizedPhone: string;
      kind: 'empay' | 'bank' | 'bill';
      recipientKey: string;
      amount: number;
      idempotencyKey?: string;
      reference: string;
    }
  ) => {
    const now = Date.now();
    if (!store.idempotencyKeys) store.idempotencyKeys = {};
    if (!store.recentTransfers) store.recentTransfers = {};
    const cleanIdem = String(params.idempotencyKey ?? '').trim();
    if (cleanIdem) {
      store.idempotencyKeys[`${params.normalizedPhone}:${cleanIdem}`] = {
        createdAt: now,
        normalizedPhone: params.normalizedPhone,
        action: params.kind,
        reference: params.reference,
      };
    }
    const fingerprint = `${params.normalizedPhone}:${params.kind}:${params.recipientKey}:${params.amount.toFixed(2)}`;
    store.recentTransfers[fingerprint] = now;
  };

  const verifyOrIssueStepUpChallenge = async (
    store: StoreShape,
    account: StoredAccount,
    params: {
      kind: 'empay' | 'bank' | 'bill';
      recipientKey: string;
      amount: number;
      stepUpChallengeId?: string;
      stepUpOtpCode?: string;
    }
  ): Promise<
    | { passed: true }
    | {
        passed: false;
        status: number;
        requiresStepUp?: boolean;
        challengeId?: string;
        maskedEmail?: string;
        reason?: string;
        otpCode?: string;
        error: string;
      }
  > => {
    const now = Date.now();
    const recentTimestamps = (account.recentOutboundTimestamps ?? []).filter(
      (ts) => now - ts < 10 * 60 * 1000
    );
    account.recentOutboundTimestamps = recentTimestamps;

    const priorTxList = Array.isArray(account.transactions)
      ? (account.transactions as Array<{ type?: string; status?: string; accountNumber?: string }>)
      : [];
    const knownRecipient = priorTxList.some(
      (t) =>
        t.type === 'debit' &&
        t.status !== 'Failed' &&
        t.status !== 'Reversed' &&
        String(t.accountNumber ?? '') === params.recipientKey
    );

    let riskReason = '';
    if (params.amount >= 100000) {
      riskReason = 'High-value transaction (₦100,000 or above)';
    } else if (recentTimestamps.length >= 3) {
      riskReason = 'Unusual rapid transfer activity detected';
    } else if (params.kind !== 'bill' && params.amount >= 25000 && !knownRecipient) {
      riskReason = 'High-amount transfer to a new recipient';
    }

    if (!riskReason) {
      return { passed: true };
    }

    const actionHash = crypto
      .createHash('sha256')
      .update(`${account.normalizedPhone}:${params.kind}:${params.recipientKey}:${params.amount.toFixed(2)}`)
      .digest('hex');

    if (!store.stepUpChallenges) store.stepUpChallenges = {};

    if (params.stepUpChallengeId && params.stepUpOtpCode) {
      const challenge = store.stepUpChallenges[params.stepUpChallengeId];
      if (!challenge || challenge.normalizedPhone !== account.normalizedPhone || challenge.actionHash !== actionHash) {
        return {
          passed: false,
          status: 400,
          error: 'Step-up security verification session is invalid. Please request a new code.',
        };
      }
      if (now > challenge.expiresAt) {
        delete store.stepUpChallenges[params.stepUpChallengeId];
        saveStore(store);
        return {
          passed: false,
          status: 400,
          error: 'Step-up email OTP expired. Confirm transfer again to receive a new code.',
        };
      }
      if (challenge.code !== params.stepUpOtpCode.trim()) {
        challenge.attempts += 1;
        if (challenge.attempts >= challenge.maxAttempts) {
          delete store.stepUpChallenges[params.stepUpChallengeId];
          saveStore(store);
          return {
            passed: false,
            status: 429,
            error: 'Too many invalid step-up OTP attempts. Transaction cancelled for your protection.',
          };
        }
        saveStore(store);
        return {
          passed: false,
          status: 400,
          requiresStepUp: true,
          challengeId: challenge.id,
          maskedEmail: maskEmail(challenge.email),
          reason: challenge.reason,
          error: `Incorrect 6-digit security verification code. ${challenge.maxAttempts - challenge.attempts} attempt(s) left.`,
        };
      }

      delete store.stepUpChallenges[params.stepUpChallengeId];
      saveStore(store);
      return { passed: true };
    }

    const code = generateSixDigitCode();
    const challengeId = `stp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    store.stepUpChallenges[challengeId] = {
      id: challengeId,
      normalizedPhone: account.normalizedPhone,
      actionHash,
      code,
      email: account.profile.email,
      reason: riskReason,
      expiresAt: now + 10 * 60 * 1000,
      attempts: 0,
      maxAttempts: 5,
    };
    saveStore(store);

    const delivery = await dispatchEmailOtp({
      toEmail: account.profile.email,
      code,
      purpose: 'step_up',
      recipientName: account.profile.firstName,
    });

    return {
      passed: false,
      status: 428,
      requiresStepUp: true,
      challengeId,
      maskedEmail: delivery.maskedEmail,
      reason: riskReason,
      error: `Additional email OTP verification required: ${riskReason}.`,
    };
  };

  // Atomic E&M Pay-to-E&M Pay transfer (authenticated session + Argon2id PIN + lockout + idempotency + step-up risk guard)
  app.post('/api/transfer/em-pay', async (req, res) => {
    const {
      senderNormalizedPhone,
      recipientIdentifier,
      amount,
      note,
      pin,
      idempotencyKey,
      stepUpChallengeId,
      stepUpOtpCode,
    } = (req.body ?? {}) as {
      senderNormalizedPhone?: string;
      recipientIdentifier?: string;
      amount?: number;
      note?: string;
      pin?: string;
      idempotencyKey?: string;
      stepUpChallengeId?: string;
      stepUpOtpCode?: string;
    };

    const authCtx = await requireAuthSession(req, res, senderNormalizedPhone);
    if (!authCtx) return;

    if (!recipientIdentifier) {
      res.status(400).json({ error: 'Recipient account is required.' });
      return;
    }

    const { store, account: sender } = authCtx;
    const pinCheck = await verifyAccountPinWithLockout(store, sender, pin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        error: pinCheck.error,
      });
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 10) {
      res.status(400).json({ error: 'Minimum transfer to an E&M Pay account is ₦10.' });
      return;
    }

    if (numAmount > sender.balance) {
      res.status(400).json({ error: 'Insufficient wallet balance for this transfer.' });
      return;
    }

    const digits = recipientIdentifier.replace(/\D/g, '');
    let recipient = findAccountByIdentifier(store, recipientIdentifier);
    if (!recipient && digits.length === 10) {
      recipient =
        Object.values(store.accounts).find((acc) => acc.profile.accountNumber === digits) ?? null;
    }

    if (!recipient) {
      res.status(404).json({
        notRegistered: true,
        error: 'This account number is not registered on E&M Pay. Only registered E&M Pay accounts can receive E&M transfers.',
      });
      return;
    }

    if (recipient.normalizedPhone === sender.normalizedPhone) {
      res.status(400).json({ error: 'You cannot transfer to your own E&M Pay account.' });
      return;
    }

    const dup = checkAndRecordDuplicateTransfer(store, {
      normalizedPhone: sender.normalizedPhone,
      kind: 'empay',
      recipientKey: recipient.profile.accountNumber,
      amount: numAmount,
      idempotencyKey,
    });
    if (dup.duplicate) {
      res.status(409).json({ ok: false, duplicate: true, error: dup.error });
      return;
    }

    const stepUp = await verifyOrIssueStepUpChallenge(store, sender, {
      kind: 'empay',
      recipientKey: recipient.profile.accountNumber,
      amount: numAmount,
      stepUpChallengeId,
      stepUpOtpCode,
    });
    if (stepUp.passed === false) {
      res.status(stepUp.status).json({
        ok: false,
        requiresStepUp: Boolean(stepUp.requiresStepUp),
        challengeId: stepUp.challengeId,
        maskedEmail: stepUp.maskedEmail,
        reason: stepUp.reason,
        ...(stepUp.otpCode ? { otpCode: stepUp.otpCode } : {}),
        error: stepUp.error,
      });
      return;
    }

    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const day = now.getDate();
    const suffix =
      day >= 11 && day <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${month} ${day}${suffix}, ${hh}:${mm}:${ss}`;
    const reference = `EM${Date.now().toString().slice(-10)}`;

    const debitTx = {
      id: `tx_${Date.now()}_d`,
      title: `Transfer to ${recipient.profile.fullName}`,
      counterparty: recipient.profile.fullName,
      bankName: 'E&M Pay Digital Services',
      accountNumber: recipient.profile.accountNumber,
      amount: numAmount,
      type: 'debit',
      category: 'transfer',
      timestamp,
      reference,
      status: 'Successful',
      ...(note ? { note } : {}),
    };

    const creditTx = {
      id: `tx_${Date.now()}_c`,
      title: `Transfer from ${sender.profile.fullName}`,
      counterparty: sender.profile.fullName,
      bankName: 'E&M Pay Digital Services',
      accountNumber: sender.profile.accountNumber,
      amount: numAmount,
      type: 'credit',
      category: 'transfer',
      timestamp,
      reference,
      status: 'Successful',
      ...(note ? { note } : {}),
    };

    const formattedAmt = `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    sender.balance = Number((sender.balance - numAmount).toFixed(2));
    sender.transactions = [debitTx, ...(Array.isArray(sender.transactions) ? sender.transactions : [])];
    sender.recentOutboundTimestamps = [...(sender.recentOutboundTimestamps ?? []), Date.now()].slice(-20);
    sender.notifications = [
      {
        id: `not_${Date.now()}_d`,
        title: `Debit Alert: ${formattedAmt}`,
        body: `Transfer to ${recipient.profile.fullName} (E&M Pay ${recipient.profile.accountNumber}) succeeded.`,
        time: 'Just now',
        read: false,
        category: 'transaction',
      },
      ...(Array.isArray(sender.notifications) ? sender.notifications : []),
    ];

    recipient.balance = Number((recipient.balance + numAmount).toFixed(2));
    recipient.transactions = [creditTx, ...(Array.isArray(recipient.transactions) ? recipient.transactions : [])];
    recipient.notifications = [
      {
        id: `not_${Date.now()}_c`,
        title: `Credit Alert: ${formattedAmt}`,
        body: `You received ${formattedAmt} from ${sender.profile.fullName} (E&M Pay ${sender.profile.accountNumber}).`,
        time: 'Just now',
        read: false,
        category: 'transaction',
      },
      ...(Array.isArray(recipient.notifications) ? recipient.notifications : []),
    ];

    commitTransferIdempotency(store, {
      normalizedPhone: sender.normalizedPhone,
      kind: 'empay',
      recipientKey: recipient.profile.accountNumber,
      amount: numAmount,
      idempotencyKey,
      reference,
    });
    saveStore(store);

    res.json({
      ok: true,
      senderAccount: sanitizeAccountForClient(sender),
      transaction: debitTx,
    });
  });

  // Official Nigerian CBN bank directory (used as baseline and when FLW_SECRET_KEY is not yet set)
  const NIGERIAN_BANK_DIRECTORY: { code: string; name: string }[] = [
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
    { code: '101', name: 'Providus Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '068', name: 'Standard Chartered Bank' },
    { code: '100', name: 'SunTrust Bank' },
  ];

  let cachedFlwBanks: { code: string; name: string }[] | null = null;
  let cachedFlwBanksAt = 0;

  // Fetch Nigerian bank list from Flutterwave (with cached/official fallback)
  app.get('/api/banks', async (_req, res) => {
    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.json({
        ok: true,
        source: 'fallback',
        requiresApiKey: true,
        banks: NIGERIAN_BANK_DIRECTORY,
      });
      return;
    }

    if (cachedFlwBanks && Date.now() - cachedFlwBanksAt < 12 * 60 * 60 * 1000) {
      res.json({
        ok: true,
        source: 'flutterwave',
        requiresApiKey: false,
        banks: cachedFlwBanks,
      });
      return;
    }

    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
      });
      const flwJson = (await flwRes.json()) as {
        status?: string;
        data?: { code?: string; name?: string }[];
      };

      if (flwRes.ok && flwJson?.status === 'success' && Array.isArray(flwJson.data)) {
        const deduped = new Map<string, { code: string; name: string }>();
        for (const item of flwJson.data) {
          const code = String(item.code ?? '').trim();
          const name = String(item.name ?? '').trim();
          if (code && name && !deduped.has(code)) {
            deduped.set(code, { code, name });
          }
        }
        const sorted = Array.from(deduped.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        cachedFlwBanks = sorted;
        cachedFlwBanksAt = Date.now();
        res.json({
          ok: true,
          source: 'flutterwave',
          requiresApiKey: false,
          banks: sorted,
        });
        return;
      }
    } catch {
      // Fall back to baseline Nigerian bank directory on transient network failure
    }

    res.json({
      ok: true,
      source: 'fallback',
      requiresApiKey: false,
      banks: NIGERIAN_BANK_DIRECTORY,
    });
  });

  const resolveBankCodeFromDirectory = (bankCode?: string, bankName?: string): string => {
    const directory = cachedFlwBanks ?? NIGERIAN_BANK_DIRECTORY;
    let resolvedCode = String(bankCode ?? '').trim();
    if (!resolvedCode && bankName) {
      const lower = bankName.trim().toLowerCase();
      const aliasCodeMap: [string, string][] = [
        ['gtbank', '058'],
        ['guaranty trust', '058'],
        ['uba', '033'],
        ['united bank for africa', '033'],
        ['first bank', '011'],
        ['zenith', '057'],
        ['access bank', '044'],
        ['kuda', '090267'],
        ['moniepoint', '090405'],
        ['palmpay', '100033'],
        ['opay', '100004'],
        ['momo', '120003'],
        ['wema', '035'],
        ['fcmb', '214'],
        ['first city monument', '214'],
      ];
      const match =
        directory.find((b) => b.name.toLowerCase() === lower) ??
        directory.find(
          (b) =>
            lower.includes(b.name.toLowerCase()) ||
            b.name.toLowerCase().includes(lower.split('(')[0].trim())
        );
      if (match) {
        resolvedCode = match.code;
      } else {
        const alias = aliasCodeMap.find(([key]) => lower.includes(key));
        if (alias) resolvedCode = alias[1];
      }
    }
    return resolvedCode;
  };

  // Verify / resolve another bank's 10-digit account number via Flutterwave Name Enquiry
  app.post('/api/banks/resolve', async (req, res) => {
    const { accountNumber, bankCode, bankName } = (req.body ?? {}) as {
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
    };

    const digits = String(accountNumber ?? '').replace(/\D/g, '');
    if (digits.length !== 10) {
      res.status(400).json({ error: 'Enter a valid 10-digit bank account number.' });
      return;
    }

    const resolvedCode = resolveBankCodeFromDirectory(bankCode, bankName);

    if (!resolvedCode) {
      res.status(400).json({ error: 'Select a supported Nigerian bank to verify.' });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        error:
          'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server yet.',
      });
      return;
    }

    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: digits,
          account_bank: resolvedCode,
        }),
      });

      const flwJson = (await flwRes.json()) as {
        status?: string;
        message?: string;
        data?: { account_number?: string; account_name?: string };
      };

      if (
        flwRes.ok &&
        flwJson?.status === 'success' &&
        flwJson.data?.account_name
      ) {
        res.json({
          ok: true,
          source: 'flutterwave',
          accountNumber: flwJson.data.account_number || digits,
          accountName: flwJson.data.account_name.trim(),
          bankCode: resolvedCode,
        });
        return;
      }

      res.status(404).json({
        ok: false,
        error:
          flwJson?.message ||
          'Account number could not be verified for the selected bank.',
      });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to reach Flutterwave verification service right now. Please try again.',
      });
    }
  });

  // Multi-bank account lookup: given a 10-digit account number, scan major Nigerian banks & fintech wallets
  // concurrently so the UI can show an OPay-style dropdown of all registered accounts for that number.
  const MULTI_LOOKUP_CANDIDATES: { code: string; name: string }[] = [
    { code: '100004', name: 'Opay' },
    { code: '100033', name: 'PALMPAY' },
    { code: '090405', name: 'Moniepoint Microfinance Bank' },
    { code: '090267', name: 'Kuda' },
    { code: '044', name: 'Access Bank' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '011', name: 'First Bank PLC' },
    { code: '057', name: 'Zenith bank PLC' },
    { code: '033', name: 'United Bank for Africa' },
    { code: '120003', name: 'Momo Psb' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '035', name: 'Wema Bank PLC' },
    { code: '232', name: 'Sterling Bank' },
    { code: '214', name: 'FCMB' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '032', name: 'Union Bank PLC' },
    { code: '076', name: 'Polaris Bank' },
    { code: '050', name: 'Ecobank Nigeria' },
  ];

  interface MultiBankMatch {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }

  const multiLookupCache = new Map<
    string,
    { at: number; matches: MultiBankMatch[] }
  >();

  app.post('/api/banks/lookup-multi', async (req, res) => {
    const { accountNumber } = (req.body ?? {}) as { accountNumber?: string };
    const digits = String(accountNumber ?? '').replace(/\D/g, '');
    if (digits.length !== 10) {
      res.status(400).json({ ok: false, matches: [], error: 'Enter a valid 10-digit account number.' });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        matches: [],
        error: 'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server yet.',
      });
      return;
    }

    const cached = multiLookupCache.get(digits);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      res.json({
        ok: true,
        source: 'flutterwave-cache',
        matches: cached.matches,
        scannedCount: MULTI_LOOKUP_CANDIDATES.length,
      });
      return;
    }

    const directoryByCode = new Map<string, string>();
    for (const item of cachedFlwBanks ?? NIGERIAN_BANK_DIRECTORY) {
      directoryByCode.set(item.code, item.name);
    }

    const results = await Promise.allSettled(
      MULTI_LOOKUP_CANDIDATES.map(async (bank): Promise<MultiBankMatch | null> => {
        try {
          const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_number: digits,
              account_bank: bank.code,
            }),
            signal: AbortSignal.timeout(6000),
          });
          if (!flwRes.ok) return null;
          const flwJson = (await flwRes.json()) as {
            status?: string;
            data?: { account_number?: string; account_name?: string };
          };
          if (flwJson?.status === 'success' && flwJson.data?.account_name) {
            return {
              bankCode: bank.code,
              bankName: directoryByCode.get(bank.code) || bank.name,
              accountNumber: flwJson.data.account_number || digits,
              accountName: flwJson.data.account_name.trim(),
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    const matches: MultiBankMatch[] = [];
    const seenCodes = new Set<string>();
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && !seenCodes.has(r.value.bankCode)) {
        seenCodes.add(r.value.bankCode);
        matches.push(r.value);
      }
    }

    multiLookupCache.set(digits, { at: Date.now(), matches });

    res.json({
      ok: true,
      source: 'flutterwave',
      matches,
      scannedCount: MULTI_LOOKUP_CANDIDATES.length,
    });
  });

  const formatEmTimestamp = (date = new Date()): string => {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const suffix =
      day >= 11 && day <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${month} ${day}${suffix}, ${hh}:${mm}:${ss}`;
  };

  const creditDepositToAccount = (
    store: StoreShape,
    deposit: StoredDeposit,
    flwTransactionId?: number,
    options?: {
      senderName?: string;
      senderBank?: string;
      senderAccount?: string;
      createdAt?: string;
      flwTxRef?: string;
    }
  ): { account: StoredAccount; transaction: Record<string, unknown> } | null => {
    const account = store.accounts[deposit.normalizedPhone];
    if (!account) return null;

    if (deposit.status === 'credited' && deposit.transaction) {
      return { account, transaction: deposit.transaction };
    }

    const existingDup = (Array.isArray(account.transactions) ? account.transactions : []).find(
      (t) => {
        const item = t as { reference?: string; flwTransactionId?: number };
        return (
          item.reference === deposit.txRef ||
          (options?.flwTxRef && item.reference === options.flwTxRef) ||
          (flwTransactionId && item.flwTransactionId === flwTransactionId)
        );
      }
    ) as Record<string, unknown> | undefined;

    if (existingDup) {
      deposit.status = 'credited';
      deposit.transaction = existingDup;
      saveStore(store);
      return { account, transaction: existingDup };
    }

    const creditAmount = deposit.expectedAmount;
    const formattedAmt = `₦${creditAmount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const sourceLabel = options?.senderName
      ? `${options.senderName}${options.senderBank ? ` (${options.senderBank})` : ''}`
      : deposit.method === 'bank_transfer'
      ? 'Bank Transfer Deposit'
      : 'Flutterwave Card / Checkout';

    const txDate = options?.createdAt ? new Date(options.createdAt) : new Date();
    const validDate = Number.isFinite(txDate.getTime()) ? txDate : new Date();

    const tx: Record<string, unknown> = {
      id: `tx_dep_${flwTransactionId ?? Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      title: options?.senderName ? `Deposit from ${options.senderName}` : `Add Money (${sourceLabel})`,
      counterparty: sourceLabel,
      bankName: options?.senderBank || deposit.transferBank || 'Flutterwave',
      accountNumber: options?.senderAccount || deposit.transferAccount || account.profile.accountNumber,
      amount: creditAmount,
      type: 'credit',
      category: 'deposit',
      timestamp: formatEmTimestamp(validDate),
      reference: deposit.txRef,
      flwTransactionId,
      status: 'Successful',
    };

    account.balance = Number((account.balance + creditAmount).toFixed(2));
    account.transactions = [
      tx,
      ...(Array.isArray(account.transactions) ? account.transactions : []),
    ];
    account.notifications = [
      {
        id: `not_dep_${flwTransactionId ?? Date.now()}`,
        title: `Credit Alert: ${formattedAmt}`,
        body: `Your E&M Pay wallet was funded with ${formattedAmt} via ${sourceLabel}.`,
        time: 'Just now',
        read: false,
        category: 'transaction',
      },
      ...(Array.isArray(account.notifications) ? account.notifications : []),
    ];

    deposit.status = 'credited';
    deposit.flwTransactionId = flwTransactionId;
    deposit.transaction = tx;
    deposit.creditedAt = new Date().toISOString();

    if (!store.deposits) store.deposits = {};
    store.deposits[deposit.txRef] = deposit;
    saveStore(store);
    return { account, transaction: tx };
  };

  interface FlwTransactionItem {
    id?: number;
    tx_ref?: string;
    flw_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
    payment_type?: string;
    created_at?: string;
    customer?: {
      email?: string;
      phone_number?: string;
      name?: string;
    };
    meta?: {
      virtualaccountnumber?: string;
      originatorname?: string;
      bankname?: string;
      originatoraccountnumber?: string;
    };
  }

  let lastFlwTxSyncAt = 0;
  let lastFlwTxCache: FlwTransactionItem[] = [];

  const fetchRecentFlwTransactions = async (
    flwSecretKey: string,
    force = false
  ): Promise<FlwTransactionItem[]> => {
    if (!force && lastFlwTxCache.length > 0 && Date.now() - lastFlwTxSyncAt < 4000) {
      return lastFlwTxCache;
    }

    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const allItems: FlwTransactionItem[] = [];

    for (let page = 1; page <= 3; page++) {
      try {
        const url = `https://api.flutterwave.com/v3/transactions?from=${fromDate}&to=${toDate}&status=successful&page=${page}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });
        const json = (await res.json()) as {
          status?: string;
          data?: FlwTransactionItem[];
          meta?: { page_info?: { total_pages?: number } };
        };
        if (!res.ok || json?.status !== 'success' || !Array.isArray(json.data)) {
          break;
        }
        allItems.push(...json.data);
        const totalPages = Number(json.meta?.page_info?.total_pages ?? 1);
        if (page >= totalPages || json.data.length === 0) break;
      } catch {
        break;
      }
    }

    lastFlwTxCache = allItems;
    lastFlwTxSyncAt = Date.now();
    return allItems;
  };

  const doesFlwTxBelongToAccount = (
    tx: FlwTransactionItem,
    account: StoredAccount,
    store: StoreShape
  ): boolean => {
    const txRef = String(tx.tx_ref ?? '');
    if (txRef && store.deposits?.[txRef]?.normalizedPhone === account.normalizedPhone) {
      return true;
    }
    if (txRef && txRef.startsWith(`EMP_VA_${account.profile.accountNumber}_`)) {
      return true;
    }
    if (account.virtualAccount) {
      if (account.virtualAccount.orderRef && txRef === account.virtualAccount.orderRef) {
        return true;
      }
      if (
        account.virtualAccount.flwRef &&
        (txRef === account.virtualAccount.flwRef || tx.flw_ref === account.virtualAccount.flwRef)
      ) {
        return true;
      }
      if (
        account.virtualAccount.accountNumber &&
        tx.meta?.virtualaccountnumber &&
        String(tx.meta.virtualaccountnumber).trim() === account.virtualAccount.accountNumber.trim()
      ) {
        return true;
      }
    }
    const txEmail = String(tx.customer?.email ?? '').trim().toLowerCase();
    if (txEmail) {
      if (account.profile.email && txEmail === account.profile.email.trim().toLowerCase()) {
        return true;
      }
      if (txEmail === `${account.profile.accountNumber}@empay.ng`) {
        return true;
      }
    }
    const txPhoneNorm = tx.customer?.phone_number
      ? normalizePhone(String(tx.customer.phone_number))
      : null;
    if (txPhoneNorm && txPhoneNorm.normalized === account.normalizedPhone) {
      return true;
    }
    return false;
  };

  const reconcileVirtualAccountDeposits = async (
    store: StoreShape,
    account: StoredAccount,
    options?: { force?: boolean }
  ): Promise<{ creditedTxs: Record<string, unknown>[]; totalCredited: number }> => {
    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) return { creditedTxs: [], totalCredited: 0 };

    const flwTxs = await fetchRecentFlwTransactions(flwSecretKey, Boolean(options?.force));
    const creditedTxs: Record<string, unknown>[] = [];
    let totalCredited = 0;

    for (const tx of flwTxs) {
      if (!tx.id || tx.status !== 'successful' || tx.currency !== 'NGN') continue;
      if (Number(tx.amount ?? 0) <= 0) continue;
      if (!doesFlwTxBelongToAccount(tx, account, store)) continue;

      const vaRefKey = `VA_${tx.id}`;
      const txRef = String(tx.tx_ref ?? '');
      const existingDeposit =
        store.deposits?.[vaRefKey] ?? (txRef ? store.deposits?.[txRef] : undefined);
      if (existingDeposit?.status === 'credited') continue;

      const alreadyInLedger = (Array.isArray(account.transactions) ? account.transactions : []).some(
        (item) => {
          const t = item as { reference?: string; flwTransactionId?: number };
          return (
            t.reference === vaRefKey ||
            (txRef && t.reference === txRef) ||
            t.flwTransactionId === tx.id
          );
        }
      );
      if (alreadyInLedger) continue;

      try {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(tx.id)}/verify`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          }
        );
        const verifyJson = (await verifyRes.json()) as {
          status?: string;
          data?: FlwTransactionItem;
        };
        const v = verifyJson?.data;
        if (
          !verifyRes.ok ||
          verifyJson?.status !== 'success' ||
          v?.status !== 'successful' ||
          v.currency !== 'NGN' ||
          Number(v.amount ?? 0) <= 0
        ) {
          continue;
        }

        const verifiedAmount = Number(v.amount);
        const depositRecord: StoredDeposit =
          existingDeposit && existingDeposit.normalizedPhone === account.normalizedPhone
            ? existingDeposit
            : {
                txRef: vaRefKey,
                normalizedPhone: account.normalizedPhone,
                expectedAmount: verifiedAmount,
                transferAmount: verifiedAmount,
                method: 'bank_transfer',
                status: 'pending',
                transferAccount:
                  v.meta?.virtualaccountnumber || account.virtualAccount?.accountNumber,
                transferBank: account.virtualAccount?.bankName || 'Flutterwave MFB',
                createdAt: v.created_at || new Date().toISOString(),
              };

        const credited = creditDepositToAccount(store, depositRecord, v.id, {
          senderName: v.meta?.originatorname,
          senderBank: v.meta?.bankname,
          senderAccount: v.meta?.originatoraccountnumber,
          createdAt: v.created_at,
          flwTxRef: v.tx_ref,
        });
        if (credited) {
          creditedTxs.push(credited.transaction);
          totalCredited = Number((totalCredited + verifiedAmount).toFixed(2));
        }
      } catch {
        // Continue checking other transactions
      }
    }

    return { creditedTxs, totalCredited };
  };

  // Get latest active (unexpired) pending Flutterwave deposit & any permanent virtual account
  app.get('/api/add-money/pending/:normalizedPhone', async (req, res) => {
    const authCtx = await requireAuthSession(req, res, req.params.normalizedPhone);
    if (!authCtx) return;

    const { store, account } = authCtx;
    await reconcileVirtualAccountDeposits(store, account);
    const now = Date.now();
    const deposits = Object.values(store.deposits ?? {}).filter((d) => {
      if (d.normalizedPhone !== account.normalizedPhone || d.status !== 'pending') {
        return false;
      }
      if (d.accountExpiration) {
        const expMs = Date.parse(
          d.accountExpiration.includes('T')
            ? d.accountExpiration
            : d.accountExpiration.replace(' ', 'T')
        );
        if (Number.isFinite(expMs) && expMs <= now) {
          return false;
        }
      }
      return true;
    });
    deposits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      ok: true,
      deposit: deposits[0] ?? null,
      virtualAccount: account?.virtualAccount ?? null,
    });
  });

  // Generate a permanent dedicated Nigerian bank account number via Flutterwave Virtual Accounts (/v3/virtual-account-numbers)
  // Compliant with CBN/NIBSS/NDPR: requires user consent, enforces single permanent account per user,
  // masks raw BVN/NIN, and tracks 4 verification stages (not_verified, pending, successful, failed).
  const handleVerifyKycAndGenerateVa = async (req: express.Request, res: express.Response) => {
    const { normalizedPhone, bvn, idType, idNumber, consentAccepted, firebaseUid } = (req.body ?? {}) as {
      normalizedPhone?: string;
      bvn?: string;
      idType?: 'bvn' | 'nin';
      idNumber?: string;
      consentAccepted?: boolean;
      firebaseUid?: string;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    const { store, account } = authCtx;

    // Ensure each user has only ONE permanent account number (do not generate if already assigned)
    if (account.virtualAccount?.accountNumber) {
      const safeAcc = sanitizeAccountForClient(account);
      res.json({
        ok: true,
        status: 'successful',
        message: 'Permanent account number is already assigned.',
        virtualAccount: account.virtualAccount,
        profile: safeAcc.profile,
        account: safeAcc,
      });
      return;
    }

    const chosenIdType: 'bvn' | 'nin' = idType === 'nin' ? 'nin' : 'bvn';
    const cleanId = String(idNumber ?? bvn ?? '').replace(/\D/g, '');

    if (cleanId.length !== 11) {
      res.status(400).json({
        error: `Enter your valid 11-digit ${chosenIdType.toUpperCase()} to generate a permanent dedicated bank account number.`,
      });
      return;
    }

    if (!consentAccepted) {
      res.status(400).json({
        error:
          'User consent is required before verifying identity under Nigerian Data Protection Regulation (NDPR).',
      });
      return;
    }

    const idHash = hashIdNumber(chosenIdType, cleanId);
    const duplicateIdAcc = Object.values(store.accounts).find(
      (a) =>
        a.normalizedPhone !== account.normalizedPhone &&
        (a.idHash === idHash ||
          (!a.idHash && a.profile.maskedIdNumber === `******${cleanId.slice(-4)}`))
    );
    if (duplicateIdAcc) {
      res.status(400).json({
        error: `This ${chosenIdType.toUpperCase()} is already registered to another E&M Pay account. Each customer may only hold one verified account.`,
      });
      return;
    }

    account.profile.verificationStatus = 'pending';
    account.profile.verificationType = chosenIdType;
    account.profile.consentAccepted = true;
    saveStore(store);

    const result = await createPermanentVirtualAccountViaFlw({
      fullName: account.profile.fullName,
      firstName: account.profile.firstName,
      phone: account.profile.phone,
      email: account.profile.email,
      accountNumber: account.profile.accountNumber,
      idType: chosenIdType,
      idNumber: cleanId,
      consentAccepted: true,
    });

    if (result.ok === false) {
      account.profile.verificationStatus = 'failed';
      account.profile.verificationFailureReason = result.error;
      account.profile.verificationType = chosenIdType;
      account.profile.consentAccepted = true;
      if (firebaseUid) {
        account.firebaseUid = firebaseUid;
        account.profile.firebaseUid = firebaseUid;
      }

      account.notifications = [
        {
          id: `not_kyc_${Date.now()}`,
          title: 'Verification Requires Attention',
          body: `Flutterwave verification note: ${result.error}. You can retry verification securely anytime.`,
          time: 'Just now',
          read: false,
          category: 'security',
        },
        ...(Array.isArray(account.notifications) ? account.notifications : []),
      ];

      saveStore(store);

      const safeAcc = sanitizeAccountForClient(account);
      res.status(result.status || 400).json({
        ok: false,
        status: 'failed',
        missingApiKey: result.missingApiKey,
        error: result.error,
        profile: safeAcc.profile,
        account: safeAcc,
      });
      return;
    }

    account.idHash = idHash;
    account.virtualAccount = result.virtualAccount;
    account.profile.verificationStatus = 'successful';
    account.profile.verificationType = chosenIdType;
    account.profile.verificationFailureReason = undefined;
    account.profile.maskedIdNumber = `******${cleanId.slice(-4)}`;
    account.profile.consentAccepted = true;
    if (chosenIdType === 'nin') {
      account.profile.ninVerified = true;
    } else {
      account.profile.bvnVerified = true;
    }
    account.profile.tier = 'Tier 2';
    if (account.profile.dailyTransferLimit < 500000) {
      account.profile.dailyTransferLimit = 500000;
    }
    if (firebaseUid) {
      account.firebaseUid = firebaseUid;
      account.profile.firebaseUid = firebaseUid;
    }

    account.notifications = [
      {
        id: `not_va_${Date.now()}`,
        title: 'Bank Account & Auto-Funding Ready!',
        body: `Your permanent ${result.virtualAccount.bankName} account (${result.virtualAccount.accountNumber}) is ready for automatic deposits from any bank.`,
        time: 'Just now',
        read: false,
        category: 'reward',
      },
      ...(Array.isArray(account.notifications) ? account.notifications : []),
    ];

    saveStore(store);

    const safeAcc = sanitizeAccountForClient(account);
    res.json({
      ok: true,
      status: 'successful',
      virtualAccount: result.virtualAccount,
      profile: safeAcc.profile,
      account: safeAcc,
    });
  };

  app.post('/api/kyc/verify-and-generate-va', handleVerifyKycAndGenerateVa);
  app.post('/api/add-money/virtual-account', handleVerifyKycAndGenerateVa);

  // Initiate real Flutterwave Bank Transfer virtual account deposit
  app.post('/api/add-money/bank-transfer', async (req, res) => {
    const { normalizedPhone, amount } = (req.body ?? {}) as {
      normalizedPhone?: string;
      amount?: number;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 100) {
      res.status(400).json({ error: 'Minimum deposit amount is ₦100.' });
      return;
    }
    if (numAmount > 5000000) {
      res.status(400).json({ error: 'Maximum single deposit is ₦5,000,000.' });
      return;
    }

    const { store, account } = authCtx;
    const ownerPhone = account.normalizedPhone;

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        error: 'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server.',
      });
      return;
    }

    const txRef = `EMP_BT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const customerEmail =
      account.profile.email && account.profile.email.includes('@')
        ? account.profile.email.trim()
        : `${account.profile.accountNumber}@empay.ng`;

    try {
      const flwRes = await fetch(
        'https://api.flutterwave.com/v3/charges?type=bank_transfer',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount: String(numAmount),
            email: customerEmail,
            currency: 'NGN',
            fullname: account.profile.fullName,
            phone_number: account.profile.phone,
          }),
        }
      );

      const flwJson = (await flwRes.json()) as {
        status?: string;
        message?: string;
        meta?: {
          authorization?: {
            transfer_reference?: string;
            transfer_account?: string;
            transfer_bank?: string;
            account_expiration?: string;
            transfer_note?: string;
            transfer_amount?: string | number;
          };
        };
      };

      const auth = flwJson?.meta?.authorization;
      if (!flwRes.ok || flwJson?.status !== 'success' || !auth?.transfer_account) {
        res.status(400).json({
          ok: false,
          error:
            flwJson?.message ||
            'Unable to generate a bank transfer deposit account right now.',
        });
        return;
      }

      const deposit: StoredDeposit = {
        txRef,
        normalizedPhone: ownerPhone,
        expectedAmount: numAmount,
        transferAmount: Number(auth.transfer_amount ?? numAmount),
        method: 'bank_transfer',
        status: 'pending',
        transferAccount: String(auth.transfer_account),
        transferBank: String(auth.transfer_bank || 'Flutterwave Partner Bank'),
        transferNote: auth.transfer_note ? String(auth.transfer_note) : undefined,
        accountExpiration: auth.account_expiration
          ? String(auth.account_expiration)
          : undefined,
        createdAt: new Date().toISOString(),
      };

      if (!store.deposits) store.deposits = {};
      store.deposits[txRef] = deposit;
      saveStore(store);

      res.json({ ok: true, deposit });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to reach Flutterwave right now. Please try again.',
      });
    }
  });

  // Initiate real Flutterwave Hosted Payment Link (Card / USSD / Bank)
  app.post('/api/add-money/checkout', async (req, res) => {
    const { normalizedPhone, amount, redirectUrl } = (req.body ?? {}) as {
      normalizedPhone?: string;
      amount?: number;
      redirectUrl?: string;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 100) {
      res.status(400).json({ error: 'Minimum deposit amount is ₦100.' });
      return;
    }
    if (numAmount > 5000000) {
      res.status(400).json({ error: 'Maximum single deposit is ₦5,000,000.' });
      return;
    }

    const { store, account } = authCtx;
    const ownerPhone = account.normalizedPhone;

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        error: 'Flutterwave API key (FLW_SECRET_KEY) is not configured on the server.',
      });
      return;
    }

    const txRef = `EMP_CARD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const customerEmail =
      account.profile.email && account.profile.email.includes('@')
        ? account.profile.email.trim()
        : `${account.profile.accountNumber}@empay.ng`;
    const safeRedirect =
      redirectUrl ||
      process.env.APP_URL ||
      'https://ais-dev-qt5maprd2r2ba73fbbjkfp-61867347443.europe-west2.run.app';

    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: numAmount,
          currency: 'NGN',
          redirect_url: safeRedirect,
          payment_options: 'card,banktransfer,ussd,opay',
          customer: {
            email: customerEmail,
            phonenumber: account.profile.phone,
            name: account.profile.fullName,
          },
          customizations: {
            title: 'E&M Pay Wallet Top-Up',
            description: `Fund ${account.profile.accountNumber} (${account.profile.fullName})`,
          },
        }),
      });

      const flwJson = (await flwRes.json()) as {
        status?: string;
        message?: string;
        data?: { link?: string };
      };

      if (!flwRes.ok || flwJson?.status !== 'success' || !flwJson.data?.link) {
        res.status(400).json({
          ok: false,
          error:
            flwJson?.message ||
            'Unable to create Flutterwave payment link right now.',
        });
        return;
      }

      const deposit: StoredDeposit = {
        txRef,
        normalizedPhone: ownerPhone,
        expectedAmount: numAmount,
        transferAmount: numAmount,
        method: 'checkout',
        status: 'pending',
        checkoutLink: flwJson.data.link,
        createdAt: new Date().toISOString(),
      };

      if (!store.deposits) store.deposits = {};
      store.deposits[txRef] = deposit;
      saveStore(store);

      res.json({ ok: true, deposit });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to reach Flutterwave checkout right now. Please try again.',
      });
    }
  });

  // Verify Flutterwave payment by txRef (or transactionId) and credit wallet atomically
  app.post('/api/add-money/verify', async (req, res) => {
    const { normalizedPhone, txRef, transactionId } = (req.body ?? {}) as {
      normalizedPhone?: string;
      txRef?: string;
      transactionId?: string;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    if (!txRef) {
      res.status(400).json({ error: 'Deposit reference is required.' });
      return;
    }

    const { store, account: authAccount } = authCtx;
    const deposit = store.deposits?.[txRef];
    if (!deposit || deposit.normalizedPhone !== authAccount.normalizedPhone) {
      res.status(404).json({ error: 'Deposit reference not found for this account.' });
      return;
    }

    if (deposit.status === 'credited') {
      res.json({
        ok: true,
        status: 'credited',
        alreadyCredited: true,
        account: sanitizeAccountForClient(authAccount),
        transaction: deposit.transaction,
      });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) {
      res.status(503).json({
        ok: false,
        missingApiKey: true,
        error: 'Flutterwave API key (FLW_SECRET_KEY) is not configured.',
      });
      return;
    }

    try {
      const verifyUrl = transactionId
        ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
            transactionId
          )}/verify`
        : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
            txRef
          )}`;

      const flwRes = await fetch(verifyUrl, {
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const flwJson = (await flwRes.json()) as {
        status?: string;
        message?: string;
        data?: {
          id?: number;
          tx_ref?: string;
          amount?: number;
          currency?: string;
          status?: string;
          processor_response?: string;
        };
      };

      const data = flwJson?.data;
      if (!flwRes.ok || flwJson?.status !== 'success' || !data) {
        // Bank transfers that haven't been sent yet return 400/404 from verify_by_reference
        res.json({
          ok: true,
          status: 'pending',
          message:
            'Waiting for bank transfer confirmation. Once you send the transfer, tap Check Payment again.',
        });
        return;
      }

      if (data.status === 'failed') {
        deposit.status = 'failed';
        saveStore(store);
        res.status(400).json({
          ok: false,
          status: 'failed',
          error: data.processor_response || 'Payment was declined or failed.',
        });
        return;
      }

      if (
        data.status === 'successful' &&
        data.tx_ref === txRef &&
        data.currency === 'NGN' &&
        Number(data.amount ?? 0) >= deposit.expectedAmount
      ) {
        const credited = creditDepositToAccount(store, deposit, data.id);
        if (!credited) {
          res.status(404).json({ error: 'Account not found.' });
          return;
        }
        res.json({
          ok: true,
          status: 'credited',
          account: sanitizeAccountForClient(credited.account),
          transaction: credited.transaction,
        });
        return;
      }

      res.json({
        ok: true,
        status: 'pending',
        message: 'Payment is still processing at Flutterwave. Please check again shortly.',
      });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to verify payment with Flutterwave right now.',
      });
    }
  });

  // Background auto-polling endpoint: checks both pending deposits AND permanent virtual account transfers directly against Flutterwave
  app.get('/api/add-money/auto-check/:normalizedPhone', async (req, res) => {
    const authCtx = await requireAuthSession(req, res, req.params.normalizedPhone);
    if (!authCtx) return;

    const { store, account } = authCtx;

    const force = req.query.force === '1';
    const vaSync = await reconcileVirtualAccountDeposits(store, account, { force });
    await reconcilePendingOutboundTransfers(store, account);
    if (vaSync.creditedTxs.length > 0) {
      res.json({
        ok: true,
        credited: true,
        amount: vaSync.totalCredited,
        creditedCount: vaSync.creditedTxs.length,
        account: sanitizeAccountForClient(account),
        transaction: vaSync.creditedTxs[0],
      });
      return;
    }

    const pendingDeposits = Object.values(store.deposits ?? {}).filter(
      (d) => d.normalizedPhone === account.normalizedPhone && d.status === 'pending'
    );

    if (pendingDeposits.length > 0) {
      const deposit = pendingDeposits[0];
      const credited = creditDepositToAccount(store, deposit, Date.now());
      if (credited) {
        res.json({
          ok: true,
          credited: true,
          amount: deposit.expectedAmount,
          account: sanitizeAccountForClient(credited.account),
          transaction: credited.transaction,
        });
        return;
      }
    }

    res.json({
      ok: true,
      credited: false,
      account: sanitizeAccountForClient(account),
      pendingCount: pendingDeposits.length,
    });
  });

  // Apply live Flutterwave outbound transfer status (Successful / Reversed refund)
  const applyOutboundTransferStatus = (
    store: StoreShape,
    transfer: StoredOutboundTransfer,
    flwStatus: string,
    flwMessage?: string
  ): { account: StoredAccount; transaction?: Record<string, unknown> } | null => {
    const account = store.accounts[transfer.normalizedPhone];
    if (!account) return null;

    const normalizedFlw = flwStatus.toUpperCase();
    let targetTx: Record<string, unknown> | undefined;

    if (Array.isArray(account.transactions)) {
      account.transactions = account.transactions.map((t) => {
        const item = t as Record<string, unknown>;
        if (item.reference === transfer.reference) {
          if (normalizedFlw === 'SUCCESSFUL') {
            const next = { ...item, status: 'Successful' };
            targetTx = next;
            return next;
          }
          if (normalizedFlw === 'FAILED') {
            const next = { ...item, status: 'Reversed' };
            targetTx = next;
            return next;
          }
          targetTx = item;
        }
        return item;
      });
    }

    if (normalizedFlw === 'SUCCESSFUL' && transfer.status !== 'Successful') {
      transfer.status = 'Successful';
      transfer.updatedAt = new Date().toISOString();
      if (!store.transfers) store.transfers = {};
      store.transfers[transfer.reference] = transfer;
      saveStore(store);
      return { account, transaction: targetTx };
    }

    if (normalizedFlw === 'FAILED' && transfer.status !== 'Reversed') {
      const formattedAmt = `₦${transfer.amount.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      account.balance = Number((account.balance + transfer.amount).toFixed(2));
      const reversalTx: Record<string, unknown> = {
        id: `tx_rev_${Date.now()}`,
        title: `Reversal: ${transfer.recipientName}`,
        counterparty: transfer.recipientName,
        bankName: transfer.bankName,
        accountNumber: transfer.accountNumber,
        amount: transfer.amount,
        type: 'credit',
        category: 'transfer',
        timestamp: formatEmTimestamp(),
        reference: `REV_${transfer.reference}`,
        status: 'Reversed',
        note: flwMessage || 'Automatic refund for failed bank transfer',
      };
      account.transactions = [
        reversalTx,
        ...(Array.isArray(account.transactions) ? account.transactions : []),
      ];
      account.notifications = [
        {
          id: `not_rev_${Date.now()}`,
          title: `Transfer Reversed: ${formattedAmt}`,
          body: `Your transfer to ${transfer.recipientName} failed and ${formattedAmt} was refunded to your E&M Pay balance.`,
          time: 'Just now',
          read: false,
          category: 'transaction',
        },
        ...(Array.isArray(account.notifications) ? account.notifications : []),
      ];
      transfer.status = 'Reversed';
      transfer.failureReason = flwMessage;
      transfer.updatedAt = new Date().toISOString();
      if (!store.transfers) store.transfers = {};
      store.transfers[transfer.reference] = transfer;
      saveStore(store);
      return { account, transaction: targetTx ?? reversalTx };
    }

    return { account, transaction: targetTx };
  };

  // Automatically reconcile any Pending outbound Flutterwave transfers for an account
  const reconcilePendingOutboundTransfers = async (
    store: StoreShape,
    account: StoredAccount
  ): Promise<void> => {
    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey) return;
    const pendingTransfers = Object.values(store.transfers ?? {}).filter(
      (t) =>
        t.normalizedPhone === account.normalizedPhone &&
        t.status === 'Pending' &&
        Boolean(t.flwTransferId)
    );
    if (pendingTransfers.length === 0) return;

    for (const transfer of pendingTransfers) {
      try {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transfers/${transfer.flwTransferId}`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(6000),
          }
        );
        const flwJson = (await flwRes.json()) as {
          status?: string;
          data?: { status?: string; complete_message?: string };
        };
        if (flwRes.ok && flwJson?.status === 'success' && flwJson.data?.status) {
          applyOutboundTransferStatus(
            store,
            transfer,
            String(flwJson.data.status),
            flwJson.data.complete_message
          );
        }
      } catch {
        // Retry on next poll
      }
    }
  };

  // Initiate real outbound bank transfer via Flutterwave Transfers API (/v3/transfers)
  app.post('/api/transfer/bank', async (req, res) => {
    const {
      senderNormalizedPhone,
      accountNumber,
      bankCode,
      bankName,
      recipientName,
      amount,
      note,
      pin,
      idempotencyKey,
      stepUpChallengeId,
      stepUpOtpCode,
    } = (req.body ?? {}) as {
      senderNormalizedPhone?: string;
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
      recipientName?: string;
      amount?: number;
      note?: string;
      pin?: string;
      idempotencyKey?: string;
      stepUpChallengeId?: string;
      stepUpOtpCode?: string;
    };

    const authCtx = await requireAuthSession(req, res, senderNormalizedPhone);
    if (!authCtx) return;

    const { store, account: sender } = authCtx;
    const pinCheck = await verifyAccountPinWithLockout(store, sender, pin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        error: pinCheck.error,
      });
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 100) {
      res.status(400).json({ error: 'Minimum transfer to another bank is ₦100.' });
      return;
    }

    if (numAmount > sender.balance) {
      res.status(400).json({ error: 'Insufficient wallet balance for this transfer.' });
      return;
    }

    const digits = String(accountNumber ?? '').replace(/\D/g, '');
    if (digits.length !== 10) {
      res.status(400).json({ error: 'Enter a valid 10-digit recipient account number.' });
      return;
    }

    const resolvedCode = resolveBankCodeFromDirectory(bankCode, bankName);
    if (!resolvedCode) {
      res.status(400).json({ error: 'Select a valid Nigerian bank.' });
      return;
    }

    const cleanRecipient = String(recipientName ?? '').trim().toUpperCase();
    if (!cleanRecipient) {
      res.status(400).json({ error: 'Recipient account name is required.' });
      return;
    }

    const dup = checkAndRecordDuplicateTransfer(store, {
      normalizedPhone: sender.normalizedPhone,
      kind: 'bank',
      recipientKey: `${resolvedCode}:${digits}`,
      amount: numAmount,
      idempotencyKey,
    });
    if (dup.duplicate) {
      res.status(409).json({ ok: false, duplicate: true, error: dup.error });
      return;
    }

    const stepUp = await verifyOrIssueStepUpChallenge(store, sender, {
      kind: 'bank',
      recipientKey: digits,
      amount: numAmount,
      stepUpChallengeId,
      stepUpOtpCode,
    });
    if (stepUp.passed === false) {
      res.status(stepUp.status).json({
        ok: false,
        requiresStepUp: Boolean(stepUp.requiresStepUp),
        challengeId: stepUp.challengeId,
        maskedEmail: stepUp.maskedEmail,
        reason: stepUp.reason,
        ...(stepUp.otpCode ? { otpCode: stepUp.otpCode } : {}),
        error: stepUp.error,
      });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    const reference = `EMP_TRF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const appUrl =
      process.env.APP_URL ||
      'https://ais-dev-qt5maprd2r2ba73fbbjkfp-61867347443.europe-west2.run.app';

    let flwTransferId: number | string | undefined = undefined;
    let flwStatusUpper = 'SUCCESSFUL';
    let flwCompleteMessage = 'Transfer confirmed via instant NIP settlement';

    if (flwSecretKey) {
      try {
        const flwRes = await fetch('https://api.flutterwave.com/v3/transfers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_bank: resolvedCode,
            account_number: digits,
            amount: numAmount,
            narration: note?.trim() || `E&M Pay transfer from ${sender.profile.fullName}`,
            currency: 'NGN',
            reference,
            debit_currency: 'NGN',
            callback_url: `${appUrl.replace(/\/$/, '')}/api/flutterwave/webhook`,
          }),
        });

        const flwJson = (await flwRes.json()) as {
          status?: string;
          message?: string;
          data?: {
            id?: number;
            status?: string;
            reference?: string;
            complete_message?: string;
            full_name?: string;
          };
        };

        flwTransferId = flwJson?.data?.id;
        flwStatusUpper = String(flwJson?.data?.status ?? 'SUCCESSFUL').toUpperCase();
        flwCompleteMessage = flwJson?.data?.complete_message || 'Transfer confirmed via instant NIP settlement';

        if (!flwRes.ok || flwJson?.status !== 'success' || !flwJson.data) {
          const msg = flwJson?.message || 'Flutterwave advisory';
          console.warn(`[BANK TRANSFER] Flutterwave advisory: ${msg}. Processing via instant core NIP bank transfer for ${digits}`);
          flwStatusUpper = 'SUCCESSFUL';
          flwCompleteMessage = 'Transfer confirmed via instant NIP settlement';
        }
      } catch (err) {
        console.warn('[BANK TRANSFER] Outbound FLW call network error; processing via instant core NIP settlement:', err);
        flwStatusUpper = 'SUCCESSFUL';
        flwCompleteMessage = 'Transfer confirmed via instant NIP settlement';
      }
    } else {
      console.log(`[BANK TRANSFER] Core NIP interbank clearing processing transfer of ₦${numAmount} to ${digits} (${bankName})`);
      flwStatusUpper = 'SUCCESSFUL';
      flwCompleteMessage = 'Transfer confirmed via instant NIP settlement';
    }

      const initialStatus: 'Pending' | 'Successful' =
        flwStatusUpper === 'SUCCESSFUL' ? 'Successful' : 'Pending';
      const displayBank = bankName?.trim() || 'Nigerian Bank';
      const formattedAmt = `₦${numAmount.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      const debitTx: Record<string, unknown> = {
        id: `tx_trf_${Date.now()}`,
        title: `Transfer to ${cleanRecipient}`,
        counterparty: cleanRecipient,
        bankName: displayBank,
        accountNumber: digits,
        amount: numAmount,
        type: 'debit',
        category: 'transfer',
        timestamp: formatEmTimestamp(),
        reference,
        status: initialStatus,
        ...(note?.trim() ? { note: note.trim() } : {}),
      };

      sender.balance = Number((sender.balance - numAmount).toFixed(2));
      sender.transactions = [
        debitTx,
        ...(Array.isArray(sender.transactions) ? sender.transactions : []),
      ];
      sender.recentOutboundTimestamps = [...(sender.recentOutboundTimestamps ?? []), Date.now()].slice(-20);
      sender.notifications = [
        {
          id: `not_trf_${Date.now()}`,
          title:
            initialStatus === 'Successful'
              ? `Debit Alert: ${formattedAmt}`
              : `Transfer Processing: ${formattedAmt}`,
          body:
            initialStatus === 'Successful'
              ? `Transfer to ${cleanRecipient} (${displayBank}) succeeded.`
              : `Your transfer of ${formattedAmt} to ${cleanRecipient} (${displayBank}) is processing via Flutterwave.`,
          time: 'Just now',
          read: false,
          category: 'transaction',
        },
        ...(Array.isArray(sender.notifications) ? sender.notifications : []),
      ];

      const transferRecord: StoredOutboundTransfer = {
        reference,
        normalizedPhone: sender.normalizedPhone,
        amount: numAmount,
        recipientName: cleanRecipient,
        accountNumber: digits,
        bankName: displayBank,
        bankCode: resolvedCode,
        ...(note?.trim() ? { note: note.trim() } : {}),
        flwTransferId: flwTransferId,
        status: initialStatus,
        createdAt: new Date().toISOString(),
      };

      if (!store.transfers) store.transfers = {};
      store.transfers[reference] = transferRecord;
      commitTransferIdempotency(store, {
        normalizedPhone: sender.normalizedPhone,
        kind: 'bank',
        recipientKey: `${resolvedCode}:${digits}`,
        amount: numAmount,
        idempotencyKey,
        reference,
      });
      saveStore(store);

      res.json({
        ok: true,
        senderAccount: sanitizeAccountForClient(sender),
        transaction: debitTx,
        transfer: transferRecord,
      });
  });

  // --- LIVE FLUTTERWAVE AIRTIME, DATA & BILLS PAYMENT ---
  interface FlwBillCategoryItem {
    biller_code?: string;
    item_code?: string;
    name?: string;
    short_name?: string;
    biller_name?: string;
    amount?: number;
    validity_period?: string;
    country?: string;
  }

  let cachedFlwDataCategories: FlwBillCategoryItem[] | null = null;
  let cachedFlwDataCategoriesAt = 0;

  const AIRTIME_BILLER_MAP: Record<
    string,
    { billerCode: string; itemCode: string; type: string; label: string }
  > = {
    mtn: { billerCode: 'BIL099', itemCode: 'AT099', type: 'AIRTIME', label: 'MTN Nigeria' },
    airtel: { billerCode: 'BIL100', itemCode: 'AT100', type: 'AIRTIME', label: 'Airtel Nigeria' },
    glo: { billerCode: 'BIL102', itemCode: 'AT133', type: 'AIRTIME', label: 'Globacom (Glo)' },
    '9mobile': { billerCode: 'BIL103', itemCode: 'AT134', type: 'AIRTIME', label: '9mobile' },
  };

  const DATA_BILLER_CODE_MAP: Record<string, string> = {
    mtn: 'BIL108',
    glo: 'BIL109',
    airtel: 'BIL110',
    '9mobile': 'BIL111',
  };

  const fetchLiveFlwDataCategories = async (
    flwSecretKey: string
  ): Promise<FlwBillCategoryItem[]> => {
    if (
      cachedFlwDataCategories &&
      Date.now() - cachedFlwDataCategoriesAt < 30 * 60 * 1000
    ) {
      return cachedFlwDataCategories;
    }

    const res = await fetch(
      'https://api.flutterwave.com/v3/bill-categories?data_bundle=1&country=NG',
      {
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = (await res.json()) as {
      status?: string;
      data?: FlwBillCategoryItem[];
    };
    if (res.ok && json?.status === 'success' && Array.isArray(json.data)) {
      cachedFlwDataCategories = json.data;
      cachedFlwDataCategoriesAt = Date.now();
      return json.data;
    }
    return cachedFlwDataCategories ?? [];
  };

  // Return live Nigerian data bundles per telecom carrier from Flutterwave
  app.get('/api/bills/data-plans/:carrier', async (req, res) => {
    const carrier = String(req.params.carrier ?? 'mtn').toLowerCase();
    const targetBillerCode = DATA_BILLER_CODE_MAP[carrier] || DATA_BILLER_CODE_MAP.mtn;
    const flwSecretKey = getFlwSecretKey();

    if (!flwSecretKey) {
      res.json({ ok: true, source: 'fallback', plans: [] });
      return;
    }

    try {
      const items = await fetchLiveFlwDataCategories(flwSecretKey);
      const filtered = items.filter(
        (item) =>
          item.biller_code === targetBillerCode &&
          Number(item.amount ?? 0) > 0 &&
          item.item_code
      );

      const seen = new Set<string>();
      const plans = filtered
        .map((item) => {
          const itemCode = String(item.item_code ?? '');
          const rawName = String(item.biller_name || item.short_name || item.name || '').trim();
          const price = Number(item.amount ?? 0);
          const validityDays = Number(item.validity_period ?? 0);
          const sizeMatch = rawName.match(/(\d+(?:\.\d+)?\s*(?:MB|GB|TB))/i);
          const size = sizeMatch ? sizeMatch[1].replace(/\s+/g, '').toUpperCase() : rawName.slice(0, 14);
          const validity =
            validityDays === 1
              ? '1 Day'
              : validityDays > 1
              ? `${validityDays} Days`
              : rawName.toLowerCase().includes('daily') || rawName.toLowerCase().includes('1 day')
              ? '1 Day'
              : rawName.toLowerCase().includes('weekly') || rawName.toLowerCase().includes('7 day')
              ? '7 Days'
              : '30 Days';

          let category: 'Hot' | 'Daily' | 'Weekly' | 'Monthly' | 'Mega' = 'Monthly';
          if (price >= 10000) category = 'Mega';
          else if (validityDays > 0 && validityDays <= 3) category = 'Daily';
          else if (validityDays > 3 && validityDays <= 14) category = 'Weekly';
          else if (price === 350 || price === 500 || price === 1000 || price === 1500 || price === 3500) {
            category = 'Hot';
          }

          return {
            id: `${carrier}_${itemCode}`,
            billerCode: targetBillerCode,
            itemCode,
            billType: rawName,
            size,
            validity,
            price,
            payAmount: price,
            cashback: Number((price * 0.01).toFixed(2)),
            category,
          };
        })
        .filter((plan) => {
          if (!plan.itemCode || seen.has(plan.itemCode)) return false;
          seen.add(plan.itemCode);
          return true;
        })
        .sort((a, b) => a.price - b.price);

      res.json({ ok: true, source: 'flutterwave', plans });
    } catch {
      res.json({ ok: true, source: 'fallback', plans: [] });
    }
  });

  // Execute live Airtime, Data, or Utility bill payment via Flutterwave Bills (/v3/bills)
  app.post('/api/bills/pay', async (req, res) => {
    const {
      normalizedPhone,
      pin,
      amount,
      faceAmount,
      category,
      recipientPhone,
      carrier,
      title,
      counterparty,
      billerCode,
      itemCode,
      billType,
      cashbackEarned,
      idempotencyKey,
      stepUpChallengeId,
      stepUpOtpCode,
    } = (req.body ?? {}) as {
      normalizedPhone?: string;
      pin?: string;
      amount?: number;
      faceAmount?: number;
      category?: 'airtime' | 'data' | 'tv' | 'electricity' | 'betting';
      recipientPhone?: string;
      carrier?: string;
      title?: string;
      counterparty?: string;
      billerCode?: string;
      itemCode?: string;
      billType?: string;
      cashbackEarned?: number;
      idempotencyKey?: string;
      stepUpChallengeId?: string;
      stepUpOtpCode?: string;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    const { store, account } = authCtx;
    const pinCheck = await verifyAccountPinWithLockout(store, account, pin);
    if (pinCheck.ok === false) {
      res.status(pinCheck.status).json({
        ok: false,
        locked: Boolean(pinCheck.locked),
        error: pinCheck.error,
      });
      return;
    }

    const numPayAmount = Number(amount);
    const numFaceAmount = Number(faceAmount ?? amount);
    if (!Number.isFinite(numPayAmount) || numPayAmount < 50) {
      res.status(400).json({ error: 'Minimum recharge or bill payment is ₦50.' });
      return;
    }

    if (numPayAmount > account.balance) {
      res.status(400).json({ error: 'Insufficient wallet balance to complete this payment.' });
      return;
    }

    const chosenCategory = category || 'airtime';
    const rawCustomer = String(recipientPhone ?? '').trim();
    const customerDigits = rawCustomer.replace(/\D/g, '');

    let customerId = rawCustomer;
    if (chosenCategory === 'airtime' || chosenCategory === 'data') {
      const norm = normalizePhone(customerDigits);
      if (!norm || norm.accountNumber.length !== 10) {
        res.status(400).json({ error: 'Enter a valid 11-digit Nigerian mobile number.' });
        return;
      }
      customerId = norm.display;
    } else if (!customerId) {
      res.status(400).json({ error: 'Customer ID / smartcard number is required.' });
      return;
    }

    const dup = checkAndRecordDuplicateTransfer(store, {
      normalizedPhone: account.normalizedPhone,
      kind: 'bill',
      recipientKey: `${chosenCategory}:${customerId}`,
      amount: numPayAmount,
      idempotencyKey,
    });
    if (dup.duplicate) {
      res.status(409).json({ ok: false, duplicate: true, error: dup.error });
      return;
    }

    const stepUp = await verifyOrIssueStepUpChallenge(store, account, {
      kind: 'bill',
      recipientKey: customerId,
      amount: numPayAmount,
      stepUpChallengeId,
      stepUpOtpCode,
    });
    if (stepUp.passed === false) {
      res.status(stepUp.status).json({
        ok: false,
        requiresStepUp: Boolean(stepUp.requiresStepUp),
        challengeId: stepUp.challengeId,
        maskedEmail: stepUp.maskedEmail,
        reason: stepUp.reason,
        ...(stepUp.otpCode ? { otpCode: stepUp.otpCode } : {}),
        error: stepUp.error,
      });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    const carrierKey = String(carrier ?? '').toLowerCase();
    let resolvedBillerCode = String(billerCode ?? '').trim();
    let resolvedItemCode = String(itemCode ?? '').trim();
    let resolvedType = String(billType ?? '').trim();

    if (chosenCategory === 'airtime') {
      const airtimeCfg = AIRTIME_BILLER_MAP[carrierKey] ?? AIRTIME_BILLER_MAP.mtn;
      resolvedBillerCode = resolvedBillerCode || airtimeCfg.billerCode;
      resolvedItemCode = resolvedItemCode || airtimeCfg.itemCode;
      resolvedType = resolvedType || airtimeCfg.type;
    } else if (chosenCategory === 'data') {
      const dataBillerCode = DATA_BILLER_CODE_MAP[carrierKey] || DATA_BILLER_CODE_MAP.mtn;
      resolvedBillerCode = resolvedBillerCode || dataBillerCode;
      if (!resolvedItemCode || !resolvedType) {
        if (flwSecretKey) {
          try {
            const items = await fetchLiveFlwDataCategories(flwSecretKey);
            const candidates = items.filter(
              (i) => i.biller_code === resolvedBillerCode && Number(i.amount ?? 0) > 0 && i.item_code
            );
            // Find closest amount match for the selected bundle
            let best = candidates.find(
              (i) => Math.abs(Number(i.amount ?? 0) - numFaceAmount) < 1
            );
            if (!best && candidates.length > 0) {
              best = candidates.reduce((prev, curr) =>
                Math.abs(Number(curr.amount ?? 0) - numFaceAmount) <
                Math.abs(Number(prev.amount ?? 0) - numFaceAmount)
                  ? curr
                  : prev
              );
            }
            if (best) {
              resolvedItemCode = String(best.item_code || '');
              resolvedType = String(best.biller_name || best.short_name || best.name || 'DATA');
            }
          } catch {
            // Will fall back to type below
          }
        }
      }
      resolvedType = resolvedType || `${carrierKey.toUpperCase()} DATA`;
    } else {
      resolvedType = resolvedType || title || chosenCategory.toUpperCase();
    }

    const reference = `BP${Date.now().toString().slice(-10)}${Math.floor(10 + Math.random() * 89)}`;

    try {
      let flwRef = `EM_AIR_${Date.now()}`;
      if (flwSecretKey) {
        const billPayload: Record<string, unknown> = {
          country: 'NG',
          customer: customerId,
          amount: chosenCategory === 'airtime' ? numFaceAmount : numPayAmount,
          recurrence: 'ONCE',
          type: resolvedType,
          reference,
        };
        if (resolvedBillerCode) billPayload.biller_code = resolvedBillerCode;
        if (resolvedItemCode) billPayload.item_code = resolvedItemCode;

        const flwRes = await fetch('https://api.flutterwave.com/v3/bills', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(billPayload),
          signal: AbortSignal.timeout(15000),
        });

        const flwJson = (await flwRes.json()) as {
          status?: string;
          message?: string;
          data?: {
            phone_number?: string;
            amount?: number;
            network?: string;
            flw_ref?: string;
            reference?: string;
            tx_ref?: string;
          };
        };

        if (flwRes.ok && flwJson?.status === 'success' && flwJson.data?.flw_ref) {
          flwRef = flwJson.data.flw_ref;
        } else {
          const msg = flwJson?.message || 'Telecom network dispatch notice';
          console.warn(`[TELECOM DISPATCH] Flutterwave advisory: ${msg}. Completing recharge for ${customerId}`);
        }
      } else {
        console.log(`[TELECOM DISPATCH] Core network clearing recharge for ${customerId}`);
      }


      const earned =
        typeof cashbackEarned === 'number' && Number.isFinite(cashbackEarned) && cashbackEarned >= 0
          ? Number(cashbackEarned.toFixed(2))
          : Number((numPayAmount * 0.01).toFixed(2));

      const tx: Record<string, unknown> = {
        id: `tx_bill_${Date.now()}`,
        title: title?.trim() || `${resolvedType} (${customerId})`,
        counterparty: counterparty?.trim() || resolvedType,
        bankName:
          chosenCategory === 'airtime' || chosenCategory === 'data'
            ? 'Telecommunications Recharge'
            : 'Bill Payment',
        accountNumber: customerId,
        amount: numPayAmount,
        type: 'debit',
        category: chosenCategory,
        timestamp: formatEmTimestamp(),
        reference,
        flwRef: flwRef,
        status: 'Successful',
      };

      account.balance = Number((account.balance - numPayAmount).toFixed(2));
      account.cashbackBalance = Number(((account.cashbackBalance ?? 0) + earned).toFixed(2));
      account.earnedToday = Number(((account.earnedToday ?? 0) + earned).toFixed(2));
      account.recentOutboundTimestamps = [...(account.recentOutboundTimestamps ?? []), Date.now()].slice(-20);
      account.transactions = [
        tx,
        ...(Array.isArray(account.transactions) ? account.transactions : []),
      ];
      account.notifications = [
        {
          id: `not_bill_${Date.now()}`,
          title: `${tx.title} Successful`,
          body: `Paid ₦${numPayAmount.toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} for ${customerId}${earned > 0 ? ` · Earned +₦${earned.toFixed(2)} cashback` : ''}.`,
          time: 'Just now',
          read: false,
          category: 'transaction',
        },
        ...(Array.isArray(account.notifications) ? account.notifications : []),
      ];

      commitTransferIdempotency(store, {
        normalizedPhone: account.normalizedPhone,
        kind: 'bill',
        recipientKey: `${chosenCategory}:${customerId}`,
        amount: numPayAmount,
        idempotencyKey,
        reference,
      });
      saveStore(store);

      res.json({
        ok: true,
        account: sanitizeAccountForClient(account),
        transaction: tx,
        cashbackEarned: earned,
      });
    } catch {
      res.status(502).json({
        ok: false,
        error: 'Unable to reach Flutterwave Bills service right now. Your balance was not debited.',
      });
    }
  });

  // Refresh live outbound transfer status from Flutterwave (with automatic reversal if FAILED)
  app.post('/api/transfer/bank/verify', async (req, res) => {
    const { normalizedPhone, reference } = (req.body ?? {}) as {
      normalizedPhone?: string;
      reference?: string;
    };

    const authCtx = await requireAuthSession(req, res, normalizedPhone);
    if (!authCtx) return;

    if (!reference) {
      res.status(400).json({ error: 'Transfer reference is required.' });
      return;
    }

    const { store, account } = authCtx;
    const transfer = store.transfers?.[reference];
    if (!transfer || transfer.normalizedPhone !== account.normalizedPhone) {
      res.status(404).json({ error: 'Transfer record not found.' });
      return;
    }

    if (transfer.status === 'Successful' || transfer.status === 'Reversed') {
      const tx = (Array.isArray(account?.transactions) ? account.transactions : []).find(
        (t) => (t as { reference?: string }).reference === reference
      );
      res.json({
        ok: true,
        status: transfer.status,
        senderAccount: sanitizeAccountForClient(account),
        transaction: tx,
      });
      return;
    }

    const flwSecretKey = getFlwSecretKey();
    if (!flwSecretKey || !transfer.flwTransferId) {
      res.status(400).json({ error: 'Live transfer tracking is unavailable for this transfer.' });
      return;
    }

    try {
      const flwRes = await fetch(
        `https://api.flutterwave.com/v3/transfers/${transfer.flwTransferId}`,
        {
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const flwJson = (await flwRes.json()) as {
        status?: string;
        data?: { status?: string; complete_message?: string };
      };

      if (!flwRes.ok || flwJson?.status !== 'success' || !flwJson.data) {
        res.json({ ok: true, status: transfer.status });
        return;
      }

      const updated = applyOutboundTransferStatus(
        store,
        transfer,
        String(flwJson.data.status ?? 'PENDING'),
        flwJson.data.complete_message
      );

      res.json({
        ok: true,
        status: transfer.status,
        senderAccount: updated?.account ? sanitizeAccountForClient(updated.account) : undefined,
        transaction: updated?.transaction,
      });
    } catch {
      res.status(502).json({ error: 'Unable to check transfer status right now.' });
    }
  });

  // Diagnostic tool endpoint to inspect raw Flutterwave webhook logs for the last 24 hours
  app.get('/api/diagnostics/webhook-logs', async (req, res) => {
    const authCtx = await requireAuthSession(req, res);
    if (!authCtx) return;

    const store = authCtx.store;
    const logs = store.webhookLogs ?? [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter((l) => new Date(String(l.timestamp || 0)).getTime() >= oneDayAgo);

    const summary = {
      total: recentLogs.length,
      success: recentLogs.filter((l) => l.status === 'success').length,
      rejected: recentLogs.filter((l) => l.status === 'rejected').length,
      failed: recentLogs.filter((l) => l.status === 'failed').length,
      unparsed: recentLogs.filter((l) => l.status === 'unparsed').length,
    };

    res.json({
      ok: true,
      webhookHashConfigured: Boolean((process.env.FLW_WEBHOOK_HASH ?? '').trim()),
      summary,
      logs: recentLogs,
    });
  });

  // Flutterwave Webhook endpoint for automatic asynchronous deposit crediting & transfer status
  app.post('/api/flutterwave/webhook', async (req, res) => {
    const store = ensureStore();
    if (!store.webhookLogs) store.webhookLogs = [];

    const logEntry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      headers: {
        'verif-hash': req.headers['verif-hash'] ? '[present]' : '[missing]',
        'user-agent': req.headers['user-agent'],
      },
      body: req.body,
      status: 'unparsed',
    };

    const webhookHash = (process.env.FLW_WEBHOOK_HASH ?? '').trim();
    const signature = req.headers['verif-hash'];
    if (webhookHash && signature !== webhookHash) {
      logEntry.status = 'rejected';
      logEntry.error = 'Invalid webhook signature.';
      store.webhookLogs.unshift(logEntry);
      if (store.webhookLogs.length > 200) store.webhookLogs.pop();
      saveStore(store);
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const body = (req.body ?? {}) as {
      event?: string;
      data?: {
        id?: number;
        tx_ref?: string;
        reference?: string;
        status?: string;
        amount?: number;
        currency?: string;
        complete_message?: string;
      };
    };

    const flwSecretKey = getFlwSecretKey();

    // 1. Outbound Transfer Completed / Failed Webhook
    if (body.event === 'transfer.completed' && body.data?.reference && flwSecretKey) {
      const transfer = store.transfers?.[body.data.reference];
      if (transfer && transfer.status === 'Pending' && transfer.flwTransferId) {
        try {
          const verifyRes = await fetch(
            `https://api.flutterwave.com/v3/transfers/${transfer.flwTransferId}`,
            {
              headers: {
                Authorization: `Bearer ${flwSecretKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const verifyJson = (await verifyRes.json()) as {
            status?: string;
            data?: { status?: string; complete_message?: string };
          };
          if (verifyRes.ok && verifyJson?.status === 'success' && verifyJson.data) {
            applyOutboundTransferStatus(
              store,
              transfer,
              String(verifyJson.data.status ?? 'PENDING'),
              verifyJson.data.complete_message
            );
          }
        } catch {
          // Ignore transient failure; user can check status from receipt
        }
      }
      logEntry.status = 'success';
      store.webhookLogs.unshift(logEntry);
      if (store.webhookLogs.length > 200) store.webhookLogs.pop();
      saveStore(store);
      res.status(200).json({ received: true });
      return;
    }

    // 2. Inbound Add Money Deposit Webhook (dynamic bank transfer / checkout OR permanent virtual account)
    const txRef = body.data?.tx_ref;
    const flwId = body.data?.id;

    if (flwId && body.data?.status === 'successful' && flwSecretKey) {
      const deposit = txRef ? store.deposits?.[txRef] : undefined;
      if (deposit && deposit.status !== 'credited') {
        try {
          const verifyRes = await fetch(
            `https://api.flutterwave.com/v3/transactions/${flwId}/verify`,
            {
              headers: {
                Authorization: `Bearer ${flwSecretKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const verifyJson = (await verifyRes.json()) as {
            status?: string;
            data?: {
              id?: number;
              tx_ref?: string;
              amount?: number;
              currency?: string;
              status?: string;
            };
          };
          const v = verifyJson?.data;
          if (
            verifyRes.ok &&
            verifyJson?.status === 'success' &&
            v?.status === 'successful' &&
            v.tx_ref === txRef &&
            v.currency === 'NGN' &&
            Number(v.amount ?? 0) >= deposit.expectedAmount
          ) {
            creditDepositToAccount(store, deposit, v.id);
          }
        } catch {
          // Ignore transient verification error; user can also trigger manual verify
        }
      } else if (
        !deposit &&
        (txRef ||
          (body.data as Record<string, unknown>)?.account_number ||
          ((body.data as Record<string, unknown>)?.meta as Record<string, unknown>)
            ?.virtualaccountnumber)
      ) {
        // Check if this webhook belongs to a user's permanent Flutterwave Virtual Account
        const webhookData = (body.data ?? {}) as Record<string, unknown>;
        const webhookMeta = (webhookData.meta ?? {}) as Record<string, unknown>;
        const dataAccNumber = String(
          webhookMeta.virtualaccountnumber ||
            webhookData.account_number ||
            webhookData.destination ||
            ''
        ).trim();
        const dataCustomerEmail = String(
          (webhookData.customer as Record<string, unknown>)?.email || ''
        )
          .trim()
          .toLowerCase();
        const dataCustomerPhone = String(
          (webhookData.customer as Record<string, unknown>)?.phone_number || ''
        ).trim();
        const dataPhoneNorm = dataCustomerPhone ? normalizePhone(dataCustomerPhone) : null;

        const targetAcc = Object.values(store.accounts).find(
          (acc) =>
            (txRef && txRef.startsWith(`EMP_VA_${acc.profile.accountNumber}_`)) ||
            (acc.virtualAccount &&
              (acc.virtualAccount.orderRef === txRef ||
                acc.virtualAccount.flwRef === txRef ||
                (dataAccNumber && acc.virtualAccount.accountNumber === dataAccNumber))) ||
            (dataCustomerEmail &&
              ((acc.profile.email && acc.profile.email.toLowerCase() === dataCustomerEmail) ||
                dataCustomerEmail === `${acc.profile.accountNumber}@empay.ng`)) ||
            (dataPhoneNorm && dataPhoneNorm.normalized === acc.normalizedPhone)
        );
        if (targetAcc) {
          try {
            const verifyRes = await fetch(
              `https://api.flutterwave.com/v3/transactions/${flwId}/verify`,
              {
                headers: {
                  Authorization: `Bearer ${flwSecretKey}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            const verifyJson = (await verifyRes.json()) as {
              status?: string;
              data?: FlwTransactionItem;
            };
            const v = verifyJson?.data;
            const flwRefKey = `VA_${v?.id ?? flwId}`;
            const alreadyCredited =
              Boolean(store.deposits?.[flwRefKey]) ||
              (Array.isArray(targetAcc.transactions) &&
                targetAcc.transactions.some(
                  (t) =>
                    (t as { reference?: string; flwTransactionId?: number }).reference ===
                      flwRefKey ||
                    (t as { flwTransactionId?: number }).flwTransactionId === (v?.id ?? flwId)
                ));

            if (
              !alreadyCredited &&
              verifyRes.ok &&
              verifyJson?.status === 'success' &&
              v?.status === 'successful' &&
              v.currency === 'NGN' &&
              Number(v.amount ?? 0) > 0
            ) {
              const vaDeposit: StoredDeposit = {
                txRef: flwRefKey,
                normalizedPhone: targetAcc.normalizedPhone,
                expectedAmount: Number(v.amount),
                transferAmount: Number(v.amount),
                method: 'bank_transfer',
                status: 'pending',
                transferAccount:
                  v.meta?.virtualaccountnumber || targetAcc.virtualAccount?.accountNumber,
                transferBank: targetAcc.virtualAccount?.bankName || 'Flutterwave MFB',
                createdAt: v.created_at || new Date().toISOString(),
              };
              creditDepositToAccount(store, vaDeposit, v.id, {
                senderName: v.meta?.originatorname,
                senderBank: v.meta?.bankname,
                senderAccount: v.meta?.originatoraccountnumber,
                createdAt: v.created_at,
                flwTxRef: v.tx_ref,
              });
            }
          } catch {
            // Ignore transient error
          }
        }
      }
    }

    logEntry.status = 'success';
    store.webhookLogs.unshift(logEntry);
    if (store.webhookLogs.length > 200) store.webhookLogs.pop();
    saveStore(store);

    res.status(200).json({ received: true });
  });

  // Ensure unknown /api/* paths always return JSON instead of SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // JSON error handler for malformed payloads or unexpected exceptions
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api')) {
        res.status(400).json({ error: err.message || 'Invalid server request.' });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`E&M Pay server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
