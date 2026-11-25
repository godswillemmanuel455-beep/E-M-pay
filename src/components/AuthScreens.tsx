import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Copy,
  Delete,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  checkEmailVerificationApi,
  checkRegisteredApi,
  detectBvnApi,
  forgotPinRequestApi,
  forgotPinResetApi,
  forgotPinVerifyApi,
  loginAccountApi,
  registerAccountApi,
  requestOtpApi,
  verifyOtpApi,
} from '../utils/authApi';
import { OPayWordmark } from './OPayLogo';

export interface BackendAccountPayload {
  normalizedPhone: string;
  balance: number;
  earnedToday: number;
  businessSalesToday: number;
  cashbackBalance: number;
  welcomeBonusCreditedToBalance?: boolean;
  checkedInToday: boolean;
  hideBalance: boolean;
  profile: {
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
  };
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
  firebaseUid?: string;
}

interface AuthScreensProps {
  mode: 'login' | 'signup';
  onSwitchMode: (mode: 'login' | 'signup') => void;
  onBack: () => void;
  onOpenHelp: () => void;
  onAuthComplete: (account: BackendAccountPayload) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  mode,
  onSwitchMode,
  onBack,
  onOpenHelp,
  onAuthComplete,
}) => {
  // Login & Forgot PIN state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginStep, setLoginStep] = useState<
    'identifier' | 'verify' | 'forgot_request' | 'forgot_otp' | 'forgot_reset'
  >('identifier');
  const [loginFirstName, setLoginFirstName] = useState('');
  const [loginNormalizedPhone, setLoginNormalizedPhone] = useState('');
  const [loginDisplayPhone, setLoginDisplayPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotRegistered, setLoginNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot PIN recovery state
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNormalizedPhone, setForgotNormalizedPhone] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');

  // Signup state
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [signupStep, setSignupStep] = useState<'phone' | 'otp' | 'details' | 'success'>('phone');
  const [otpInput, setOtpInput] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Registration step 3 (BVN + Personal Details + Confirmed PIN)
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Male');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [idType, setIdType] = useState<'bvn' | 'nin'>('bvn');
  const [idNumber, setIdNumber] = useState('');
  const [detectingBvn, setDetectingBvn] = useState(false);
  const [bvnDetectionNote, setBvnDetectionNote] = useState('');
  const [bvnDetectedSuccess, setBvnDetectedSuccess] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [copiedVa, setCopiedVa] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [createdAccount, setCreatedAccount] = useState<BackendAccountPayload | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  // Auto-detect when the user clicks the verification link in their email
  useEffect(() => {
    if (signupStep !== 'otp' || !normalizedPhone || !signupEmail) return;
    let cancelled = false;

    const interval = window.setInterval(() => {
      void checkEmailVerificationApi({
        normalizedPhone,
        email: signupEmail.trim(),
      }).then((res) => {
        if (cancelled) return;
        if (res.ok && res.data.verified && res.data.emailVerificationToken) {
          setEmailVerificationToken(res.data.emailVerificationToken);
          setSignupStep('details');
        }
      });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [signupStep, normalizedPhone, signupEmail]);

  const isLoginValid = loginIdentifier.replace(/\D/g, '').length >= 10;
  const isSignupStep1Valid =
    signupFullName.trim().length >= 3 &&
    signupPhone.replace(/\D/g, '').length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim()) &&
    agreedTerms;

  /* ---------------- LOGIN HANDLERS ---------------- */
  const handleLoginCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoginValid || loading) return;
    setLoading(true);
    setLoginError('');
    setLoginNotRegistered(false);

    try {
      const { ok, data } = await checkRegisteredApi(loginIdentifier.trim());
      if (!ok) {
        setLoginError(data.error || 'This phone number is not registered. Please sign up first.');
        setLoginNotRegistered(Boolean(data.notRegistered));
        return;
      }
      setLoginFirstName(data.firstName || 'USER');
      setLoginNormalizedPhone(data.normalizedPhone || '');
      setLoginDisplayPhone(data.displayPhone || loginIdentifier.trim());
      setPin('');
      setLoginStep('verify');
    } catch {
      setLoginError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitPinLogin = async (enteredPin: string) => {
    setLoading(true);
    setLoginError('');
    try {
      const { ok, data } = await loginAccountApi({
        identifier: loginNormalizedPhone || loginIdentifier.trim(),
        pin: enteredPin,
      });
      if (!ok || !data.account) {
        setLoginError(data.error || 'Incorrect 4-digit PIN.');
        setPin('');
        return;
      }
      onAuthComplete(data.account);
    } catch {
      setLoginError('Login failed. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4 || loading) return;
    const next = pin + digit;
    setPin(next);
    setLoginError('');
    if (next.length === 4) {
      void submitPinLogin(next);
    }
  };

  /* ---------------- FORGOT PIN HANDLERS ---------------- */
  const openForgotPinFlow = () => {
    setForgotPhone(loginDisplayPhone || loginIdentifier || '');
    setForgotEmail('');
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPin('');
    setForgotConfirmPin('');
    setLoginError('');
    setLoginStep('forgot_request');
  };

  const handleForgotPinRequest = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setLoginError('');
    try {
      const { ok, data } = await forgotPinRequestApi({
        phone: forgotPhone.trim(),
        email: forgotEmail.trim(),
      });
      if (!ok || !data.normalizedPhone) {
        setLoginError(data.error || 'Unable to verify your registered phone and email.');
        return;
      }
      setForgotNormalizedPhone(data.normalizedPhone);
      setForgotMaskedEmail(data.maskedEmail || forgotEmail.trim());
      setForgotOtp('');
      setResendCooldown(60);
      setLoginStep('forgot_otp');
    } catch {
      setLoginError('Unable to reach server for PIN recovery.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.trim().length !== 6 || loading) return;
    setLoading(true);
    setLoginError('');
    try {
      const { ok, data } = await forgotPinVerifyApi({
        normalizedPhone: forgotNormalizedPhone,
        code: forgotOtp.trim(),
      });
      if (!ok || !data.resetToken) {
        setLoginError(data.error || 'Invalid 6-digit email OTP.');
        return;
      }
      setForgotResetToken(data.resetToken);
      setForgotNewPin('');
      setForgotConfirmPin('');
      setLoginStep('forgot_reset');
    } catch {
      setLoginError('Unable to verify recovery code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!/^\d{4}$/.test(forgotNewPin)) {
      setLoginError('New PIN must be exactly 4 digits.');
      return;
    }
    if (forgotNewPin !== forgotConfirmPin) {
      setLoginError('New PIN and Confirm PIN do not match.');
      return;
    }
    setLoading(true);
    setLoginError('');
    try {
      const { ok, data } = await forgotPinResetApi({
        normalizedPhone: forgotNormalizedPhone,
        resetToken: forgotResetToken,
        newPin: forgotNewPin,
        confirmPin: forgotConfirmPin,
      });
      if (!ok || !data.account) {
        setLoginError(data.error || 'Could not reset PIN. Please restart Forgot PIN.');
        return;
      }
      onAuthComplete(data.account);
    } catch {
      setLoginError('Unable to reset PIN right now.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SIGNUP HANDLERS ---------------- */
  const handleRequestSignupOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isSignupStep1Valid || loading) return;
    setLoading(true);
    setSignupError('');

    try {
      const { ok, data } = await requestOtpApi({
        identifier: signupPhone.trim(),
        email: signupEmail.trim(),
        purpose: 'signup',
      });
      if (!ok || !data.normalizedPhone) {
        setSignupError(data.error || 'Could not send 6-digit email verification OTP.');
        return;
      }
      setNormalizedPhone(data.normalizedPhone);
      setDisplayPhone(data.displayPhone || signupPhone.trim());
      setMaskedEmail(data.maskedEmail || signupEmail.trim());
      setEmailVerificationToken('');
      setOtpInput('');
      setResendCooldown(60);
      setSignupStep('otp');
    } catch {
      setSignupError('Unable to send verification email OTP right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.trim().length !== 6 || loading) return;
    setLoading(true);
    setSignupError('');

    try {
      const { ok, data } = await verifyOtpApi({
        normalizedPhone,
        email: signupEmail.trim(),
        code: otpInput.trim(),
      });
      if (!ok || !data.emailVerificationToken) {
        setSignupError(data.error || 'Incorrect 6-digit email OTP.');
        return;
      }
      setEmailVerificationToken(data.emailVerificationToken);
      setSignupStep('details');
    } catch {
      setSignupError('Unable to verify email OTP right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmailVerificationStatus = async () => {
    if (loading) return;
    setLoading(true);
    setSignupError('');

    try {
      const res = await checkEmailVerificationApi({
        normalizedPhone,
        email: signupEmail.trim(),
      });
      if (res.ok && res.data.verified && res.data.emailVerificationToken) {
        setEmailVerificationToken(res.data.emailVerificationToken);
        setSignupStep('details');
      } else {
        setSignupError(
          res.data?.message ||
            `Verification link has not been tapped yet. Please check your Gmail or Mail app for the email sent to ${signupEmail.trim()} and tap the link.`
        );
      }
    } catch {
      setSignupError('Unable to check verification status right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetectBvn = async () => {
    const cleanBvn = idNumber.replace(/\D/g, '');
    if (idType !== 'bvn' || cleanBvn.length !== 11 || detectingBvn) {
      setSignupError('Enter your 11-digit BVN first to detect your verified details.');
      return;
    }
    setDetectingBvn(true);
    setSignupError('');
    setBvnDetectionNote('');
    setBvnDetectedSuccess(false);

    try {
      const res = await detectBvnApi({
        bvn: cleanBvn,
        normalizedPhone,
        emailVerificationToken,
      });
      if (!res.ok) {
        setSignupError(res.data.error || 'BVN could not be verified.');
        return;
      }
      if (res.data.detected && res.data.bvnInfo) {
        const info = res.data.bvnInfo;
        if (info.fullName) setSignupFullName(info.fullName);
        if (info.dateOfBirth) {
          const parsedDate = new Date(info.dateOfBirth);
          if (!Number.isNaN(parsedDate.getTime())) {
            setDateOfBirth(parsedDate.toISOString().slice(0, 10));
          }
        }
        if (info.gender && /female/i.test(info.gender)) setGender('Female');
        else if (info.gender && /male/i.test(info.gender)) setGender('Male');
        setBvnDetectedSuccess(true);
        setBvnDetectionNote(
          `BVN Verified: ${info.fullName || 'Matched'}${info.maskedPhone ? ` · Phone ${info.maskedPhone}` : ''}`
        );
      } else {
        setBvnDetectionNote(
          res.data.message || 'Live Flutterwave BVN & bank account check will run when you submit.'
        );
      }
    } catch {
      setSignupError('Unable to reach Flutterwave BVN lookup right now.');
    } finally {
      setDetectingBvn(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = idNumber.replace(/\D/g, '');
    if (!signupFullName.trim() || !address.trim() || loading) {
      setSignupError('Enter your full name and residential address.');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setSignupError('Create a valid 4-digit numeric security PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setSignupError('Security PIN and Confirm PIN do not match.');
      return;
    }
    if (cleanId.length !== 11) {
      setSignupError(
        `Enter your valid 11-digit ${idType.toUpperCase()} to generate your real bank account number.`
      );
      return;
    }
    if (!consentAccepted) {
      setSignupError(
        'User consent is required before verifying identity under Nigerian Data Protection Regulation (NDPR).'
      );
      return;
    }
    if (!emailVerificationToken) {
      setSignupError('Email 6-digit OTP verification is required first.');
      setSignupStep('phone');
      return;
    }

    setLoading(true);
    setSignupError('');

    try {
      const { ok, data } = await registerAccountApi({
        normalizedPhone,
        emailVerificationToken,
        fullName: signupFullName.trim(),
        address: address.trim(),
        dateOfBirth,
        gender,
        email: signupEmail.trim(),
        pin: newPin,
        confirmPin,
        inviteCode: inviteCode.trim(),
        idType,
        idNumber: cleanId,
        consentAccepted: true,
      });
      if (!ok || !data.account) {
        setSignupError(data.error || 'Could not create account.');
        return;
      }
      setCreatedAccount(data.account);
      setSignupStep('success');
    } catch {
      setSignupError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'login') {
    return (
      <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-between px-5 pt-4 pb-8 max-w-md mx-auto">
        <div>
          {/* Top Bar */}
          <div className="flex items-center justify-between h-11">
            <button
              type="button"
              onClick={() => {
                setLoginError('');
                if (loginStep === 'forgot_reset') {
                  setLoginStep('forgot_otp');
                } else if (loginStep === 'forgot_otp') {
                  setLoginStep('forgot_request');
                } else if (loginStep === 'forgot_request' || loginStep === 'verify') {
                  setLoginStep('identifier');
                } else {
                  onBack();
                }
              }}
              aria-label="Go back"
              className="w-10 h-10 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#1A1D23] transition-colors"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2]" />
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className="text-[15px] font-medium text-[#BA7E44] hover:text-[#9C6230] px-2 py-1"
            >
              Help
            </button>
          </div>

          <div className="mt-5 flex justify-center">
            <OPayWordmark iconSize={34} textClassName="text-[28px]" />
          </div>

          {loginStep === 'identifier' && (
            <form onSubmit={handleLoginCheck} className="mt-9">
              <h1 className="text-[24px] font-bold text-[#1A1D23] tracking-tight">
                Log in to your account
              </h1>
              <p className="mt-1 text-xs text-gray-500">
                Sign in with your registered Nigerian phone number and 4-digit PIN
              </p>

              <div className="relative mt-6">
                <label
                  htmlFor="login-identifier"
                  className="absolute -top-2.5 left-3.5 bg-white px-1.5 text-[12px] font-medium text-[#BA7E44]"
                >
                  Registered Mobile No.
                </label>
                <input
                  id="login-identifier"
                  type="tel"
                  inputMode="numeric"
                  maxLength={14}
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value.replace(/[^\d+]/g, ''));
                    setLoginError('');
                    setLoginNotRegistered(false);
                  }}
                  placeholder="08012345678"
                  autoFocus
                  className="w-full h-[54px] px-4 rounded-xl border-[1.5px] border-[#BA7E44] text-[16px] text-[#1A1D23] bg-white outline-none focus:ring-2 focus:ring-[#BA7E44]/20 font-mono-tabular"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[13px] text-[#6B7280]">
                <span>
                  Forgot security PIN?{' '}
                  <button
                    type="button"
                    onClick={openForgotPinFlow}
                    className="text-[#BA7E44] font-semibold hover:underline"
                  >
                    Reset PIN
                  </button>
                </span>
              </div>

              {loginError && (
                <div className="mt-4 p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[13px] text-[#BE123C]">
                  <p className="font-medium">{loginError}</p>
                  {loginNotRegistered && (
                    <button
                      type="button"
                      onClick={() => {
                        const digits = loginIdentifier.replace(/\D/g, '');
                        if (digits) setSignupPhone(digits.slice(-11));
                        setLoginError('');
                        onSwitchMode('signup');
                      }}
                      className="mt-2 font-semibold text-[#BA7E44] hover:underline"
                    >
                      Get an E&amp;M Pay Account with this number →
                    </button>
                  )}
                </div>
              )}

              <div className="mt-28">
                <button
                  type="submit"
                  disabled={!isLoginValid || loading}
                  className={`w-full h-[50px] rounded-full text-[15px] font-semibold text-white transition-all ${
                    isLoginValid && !loading
                      ? 'bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] shadow-[0_6px_16px_rgba(186,126,68,0.24)]'
                      : 'bg-[#EBDDC9] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Checking...' : 'NEXT'}
                </button>
              </div>
            </form>
          )}

          {loginStep === 'verify' && (
            <div className="mt-8 flex flex-col items-center">
              <h1 className="text-[21px] font-bold text-[#1A1D23]">
                Welcome back, {loginFirstName}
              </h1>
              <p className="mt-1 text-xs text-gray-500 text-center">
                Enter your 4-digit security PIN for{' '}
                <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                  {loginDisplayPhone}
                </span>
              </p>

              <div className="mt-6 flex items-center gap-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-colors ${
                      loginError
                        ? 'bg-red-500'
                        : idx < pin.length
                        ? 'bg-[#BA7E44]'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {loginError && (
                <p className="mt-2.5 text-xs font-medium text-red-500 text-center max-w-xs">
                  {loginError}
                </p>
              )}

              <div className="mt-7 grid grid-cols-3 gap-3 w-full max-w-[280px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePinDigit(digit)}
                    className="h-12 rounded-2xl bg-[#F4F6F8] hover:bg-[#F5EBDD] active:scale-95 text-lg font-semibold text-[#1A1D23] transition-all tabular-nums disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <div className="flex items-center justify-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handlePinDigit('0')}
                  className="h-12 rounded-2xl bg-[#F4F6F8] hover:bg-[#F5EBDD] active:scale-95 text-lg font-semibold text-[#1A1D23] transition-all tabular-nums disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  aria-label="Backspace"
                  className="h-12 rounded-2xl bg-[#F4F6F8] hover:bg-gray-200 active:scale-95 text-gray-600 flex items-center justify-center disabled:opacity-50"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={openForgotPinFlow}
                className="mt-5 text-xs font-semibold text-[#BA7E44] hover:underline disabled:opacity-50"
              >
                Forgot PIN? Recover via Registered Email OTP
              </button>
            </div>
          )}

          {loginStep === 'forgot_request' && (
            <form onSubmit={handleForgotPinRequest} className="mt-8 space-y-4">
              <div>
                <h1 className="text-[22px] font-bold text-[#1A1D23]">Forgot Security PIN</h1>
                <p className="mt-1 text-xs text-gray-500">
                  Enter your registered phone number and email address to receive a 6-digit recovery OTP.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Registered Phone Number
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={forgotPhone}
                  onChange={(e) => {
                    setForgotPhone(e.target.value.replace(/[^\d+]/g, ''));
                    setLoginError('');
                  }}
                  placeholder="08012345678"
                  className="w-full h-12 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="you@example.com"
                  className="w-full h-12 px-3.5 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>

              {loginError && <p className="text-xs font-medium text-red-500">{loginError}</p>}

              <button
                type="submit"
                disabled={loading || forgotPhone.replace(/\D/g, '').length < 10 || !forgotEmail.trim()}
                className="w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:bg-[#EBDDC9] disabled:text-gray-600 text-white text-[15px] font-semibold transition-colors"
              >
                {loading ? 'Sending 6-Digit Email OTP...' : 'Send Recovery OTP'}
              </button>
            </form>
          )}

          {loginStep === 'forgot_otp' && (
            <form onSubmit={handleForgotPinVerify} className="mt-8 space-y-4">
              <div>
                <h1 className="text-[22px] font-bold text-[#1A1D23]">Verify Recovery Email OTP</h1>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-semibold text-[#1A1D23]">{forgotMaskedEmail}</span>.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={forgotOtp}
                onChange={(e) => {
                  setForgotOtp(e.target.value.replace(/\D/g, ''));
                  setLoginError('');
                }}
                placeholder="000000"
                autoFocus
                className="w-full h-14 px-4 rounded-xl bg-[#F4F6F8] text-center text-2xl font-mono-tabular font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-[#BA7E44]"
              />

              {loginError && (
                <p className="text-xs font-medium text-red-500 text-center">{loginError}</p>
              )}

              <button
                type="submit"
                disabled={forgotOtp.length !== 6 || loading}
                className="w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:bg-[#EBDDC9] disabled:text-gray-600 text-white text-[15px] font-semibold transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify Recovery OTP'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => void handleForgotPinRequest()}
                  className="text-xs font-semibold text-[#BA7E44] hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend 6-digit OTP'}
                </button>
              </div>
            </form>
          )}

          {loginStep === 'forgot_reset' && (
            <form onSubmit={handleForgotPinReset} className="mt-8 space-y-4">
              <div>
                <h1 className="text-[22px] font-bold text-[#1A1D23]">Create New 4-Digit PIN</h1>
                <p className="mt-1 text-xs text-gray-500">
                  Set and confirm a new 4-digit security PIN for login and transfers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={forgotNewPin}
                  onChange={(e) => {
                    setForgotNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setLoginError('');
                  }}
                  placeholder="••••"
                  className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-center text-lg font-mono-tabular tracking-[0.5em] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Confirm New 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={forgotConfirmPin}
                  onChange={(e) => {
                    setForgotConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setLoginError('');
                  }}
                  placeholder="••••"
                  className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-center text-lg font-mono-tabular tracking-[0.5em] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>

              {loginError && <p className="text-xs font-medium text-red-500">{loginError}</p>}

              <button
                type="submit"
                disabled={loading || forgotNewPin.length !== 4 || forgotConfirmPin.length !== 4}
                className="w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:bg-[#EBDDC9] disabled:text-gray-600 text-white text-[15px] font-semibold transition-colors"
              >
                {loading ? 'Updating Security PIN...' : 'Save New PIN & Log In'}
              </button>
            </form>
          )}
        </div>

        {/* Footer switch link */}
        <div className="pt-6 text-center text-[13.5px] text-[#4B5563]">
          <div>Don&apos;t have an E&amp;M Pay Account yet?</div>
          <button
            type="button"
            onClick={() => {
              setLoginStep('identifier');
              setLoginError('');
              onSwitchMode('signup');
            }}
            className="mt-0.5 font-semibold text-[#BA7E44] hover:underline"
          >
            Click here to get one
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- SIGN UP SCREENS ---------------- */
  if (signupStep === 'success' && createdAccount) {
    return (
      <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-between px-5 pt-8 pb-8 max-w-md mx-auto">
        <div className="flex flex-col items-center text-center mt-6">
          <div className="w-16 h-16 rounded-full bg-[#F5EBDD] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-[#BA7E44]" />
          </div>
          <h1 className="mt-5 text-[23px] font-bold text-[#1A1D23]">Sign Up Successful!</h1>
          <p className="mt-1.5 text-[13.5px] text-gray-500 max-w-xs">
            Welcome to E&amp;M Pay,{' '}
            <span className="font-semibold text-[#1A1D23]">
              {createdAccount.profile.fullName}
            </span>
            . Your wallet and security PIN are active.
          </p>

          {/* Generated Nigerian Bank Account + Balance Card */}
          <div className="mt-6 w-full rounded-[20px] overflow-hidden border border-[#BA7E44]/15 shadow-sm text-left">
            <div className="bg-[#BA7E44] text-white p-5">
              {createdAccount.virtualAccount ? (
                <>
                  <div className="text-[11.5px] text-white/85 font-medium">
                    Your Funding Bank Account ({createdAccount.virtualAccount.bankName})
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[26px] font-bold font-mono-tabular tracking-wide">
                      {createdAccount.virtualAccount.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          createdAccount.virtualAccount?.accountNumber || ''
                        );
                        setCopiedVa(true);
                        window.setTimeout(() => setCopiedVa(false), 1800);
                      }}
                      className="px-3 py-1.5 rounded-full bg-white text-[#9C6230] text-xs font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedVa ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedVa ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[11.5px] text-white/85 mt-0.5 truncate">
                    {createdAccount.virtualAccount.accountName}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-white/85 font-medium">Available Balance</div>
                  <div className="mt-1 text-[28px] font-bold tabular-nums">
                    ₦
                    {(createdAccount.balance ?? 0).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </>
              )}

              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                <span className="text-white/90">E&amp;M Pay Wallet No.</span>
                <span className="font-mono-tabular font-bold text-white">
                  {createdAccount.profile.accountNumber}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-white/90">Available Balance</span>
                <span className="font-bold text-white tabular-nums">
                  ₦
                  {(createdAccount.balance ?? 0).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <div className="bg-[#FAF7F2] px-5 py-3 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#9C6230]">
                Fund from any bank &amp; transfer to any bank
              </span>
              <span className="text-[13px] font-bold text-[#BA7E44] shrink-0">
                Verified Account
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAuthComplete(createdAccount)}
          className="w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white text-[15px] font-semibold shadow-[0_6px_16px_rgba(186,126,68,0.24)] transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-between px-5 pt-4 pb-8 max-w-md mx-auto">
      <div>
        {/* Top Bar */}
        <div className="flex items-center justify-between h-11">
          <button
            type="button"
            onClick={() => {
              if (signupStep === 'details') {
                setSignupStep('otp');
              } else if (signupStep === 'otp') {
                setSignupStep('phone');
              } else {
                onBack();
              }
            }}
            aria-label="Go back"
            className="w-10 h-10 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#1A1D23] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Help"
            className="w-10 h-10 -mr-2 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#1A1D23] transition-colors"
          >
            <HelpCircle className="w-5 h-5 stroke-[1.9]" />
          </button>
        </div>

        {signupStep === 'phone' && (
          <form onSubmit={handleRequestSignupOtp} className="mt-5 space-y-3.5">
            <div>
              <h1 className="text-[24px] font-bold text-[#1A1D23] tracking-tight">
                Get an E&amp;M Pay Account
              </h1>
              <p className="mt-1 text-xs text-gray-500">
                Register your name, unique phone number, and verify your email with a 6-digit OTP.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={signupFullName}
                onChange={(e) => {
                  setSignupFullName(e.target.value);
                  setSignupError('');
                }}
                placeholder="First Name & Last Name"
                autoFocus
                className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-[15px] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30"
              />
            </div>

            {/* +234 Phone Number Box */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mobile Phone Number *
              </label>
              <div className="bg-[#F4F6F8] rounded-xl px-4 h-[52px] flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#BA7E44]/30">
                <span
                  className="w-6 h-4 rounded-[3px] overflow-hidden flex shrink-0 border border-black/10"
                  aria-hidden="true"
                >
                  <span className="w-1/3 h-full bg-[#BA7E44]" />
                  <span className="w-1/3 h-full bg-white" />
                  <span className="w-1/3 h-full bg-[#BA7E44]" />
                </span>
                <span className="text-[15px] font-semibold text-[#1A1D23] tabular-nums shrink-0">
                  +234
                </span>
                <span className="w-px h-5 bg-gray-300 shrink-0" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  required
                  value={signupPhone}
                  onChange={(e) => {
                    setSignupPhone(e.target.value.replace(/\D/g, ''));
                    setSignupError('');
                  }}
                  placeholder="08012345678"
                  className="w-full bg-transparent text-[16px] text-[#1A1D23] placeholder:text-gray-400 outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email Address (for 6-digit OTP) *
              </label>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => {
                  setSignupEmail(e.target.value);
                  setSignupError('');
                }}
                placeholder="you@example.com"
                className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-[15px] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30"
              />
            </div>

            {/* Expandable Invitation Code Row */}
            <div className="bg-[#FAF7F2] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInvite((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#BA7E44] text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[13px] font-medium text-[#374151]">
                    Have an Invitation Code? (Optional)
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-600 transition-transform ${
                    showInvite ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showInvite && (
                <div className="px-3.5 pb-3">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter referral code (optional)"
                    className="w-full h-10 px-3 rounded-lg bg-white text-sm font-mono-tabular text-[#1A1D23] outline-none"
                  />
                </div>
              )}
            </div>

            {signupError && <p className="text-xs font-medium text-red-500">{signupError}</p>}

            <div className="pt-4 flex flex-col items-center">
              <div className="px-6 py-1.5 rounded-t-xl bg-[#FAF7F2] text-[#BA7E44] text-[12px] font-semibold">
                Instant Account &amp; Zero Transfer Fees
              </div>
              <button
                type="submit"
                disabled={!isSignupStep1Valid || loading}
                className={`w-full h-[50px] rounded-full text-[15px] font-semibold text-white transition-all ${
                  isSignupStep1Valid && !loading
                    ? 'bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] shadow-[0_6px_16px_rgba(186,126,68,0.24)]'
                    : 'bg-[#EBDDC9] text-gray-600 cursor-not-allowed'
                }`}
              >
                {loading ? 'Sending Email OTP...' : 'Send 6-Digit Email OTP'}
              </button>
            </div>

            {/* Terms Checkbox */}
            <label className="pt-1 flex items-start gap-2.5 cursor-pointer">
              <button
                type="button"
                role="checkbox"
                aria-checked={agreedTerms}
                onClick={() => setAgreedTerms((v) => !v)}
                className={`mt-0.5 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                  agreedTerms ? 'bg-[#BA7E44] text-white' : 'border-2 border-gray-300 bg-white'
                }`}
              >
                {agreedTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-[12px] text-[#4B5563] leading-snug">
                I have read, understood and agreed to the{' '}
                <span className="text-[#BA7E44] font-medium">Terms &amp; Conditions</span> and{' '}
                <span className="text-[#BA7E44] font-medium">Privacy Policy</span>.
              </span>
            </label>

            <div className="pt-3 text-center text-[14px] text-[#374151]">
              Already have an E&amp;M Pay Account?{' '}
              <button
                type="button"
                onClick={() => {
                  setSignupError('');
                  onSwitchMode('login');
                }}
                className="font-semibold text-[#BA7E44] hover:underline"
              >
                Log in
              </button>
            </div>
          </form>
        )}

        {signupStep === 'otp' && (
          <div className="mt-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#F5EBDD] flex items-center justify-center text-[#BA7E44] shadow-sm mb-3">
                <Mail className="w-8 h-8 stroke-[2]" />
              </div>
              <h1 className="text-[22px] font-bold text-[#1A1D23]">Check Your Email Inbox</h1>
              <p className="mt-1 text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                An official verification email has been sent to{' '}
                <span className="font-bold text-[#1A1D23]">{signupEmail.trim()}</span>.
                Please open your Gmail or Mail app and tap the verification link inside.
              </p>
            </div>

            {/* Waiting / auto-detection indicator */}
            <div className="rounded-2xl bg-[#FAF7F2] border border-[#BA7E44]/25 p-3.5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#BA7E44] animate-spin shrink-0" />
              <div className="text-xs text-gray-700 leading-tight">
                <span className="font-bold text-[#1A1D23] block mb-0.5">Listening For Verification</span>
                Once you click the link in your email, this screen will automatically advance.
              </div>
            </div>

            {signupError && (
              <p className="text-xs font-medium text-red-500 text-center bg-red-50 p-2.5 rounded-xl border border-red-100">
                {signupError}
              </p>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCheckEmailVerificationStatus()}
              className="w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[15px] font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Verification...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  <span>I Have Clicked The Email Link</span>
                </>
              )}
            </button>

            {/* Alternative Code Input */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-center mb-2">
                <span className="text-[11.5px] font-medium text-gray-500">
                  Or enter the 6-digit code if shown in your email:
                </span>
              </div>
              <form onSubmit={handleVerifySignupOtp} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    setSignupError('');
                  }}
                  placeholder="000000"
                  className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-center text-xl font-mono-tabular font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
                {otpInput.length === 6 && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-[#1A1D23] hover:bg-black text-white text-xs font-semibold"
                  >
                    Verify Code
                  </button>
                )}
              </form>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={() => void handleRequestSignupOtp()}
                className="text-xs font-semibold text-[#BA7E44] hover:underline disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend Verification Email (${resendCooldown}s)`
                  : 'Resend Verification Email'}
              </button>
            </div>
          </div>
        )}

        {signupStep === 'details' && (
          <form onSubmit={handleCompleteRegistration} className="mt-5 space-y-3.5">
            <div>
              <h1 className="text-[22px] font-bold text-[#1A1D23]">BVN &amp; Security PIN</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                Verify your real BVN via Flutterwave for your bank account number and set your 4-digit PIN.
              </p>
            </div>

            {/* Identity Verification (BVN or NIN) + Live Flutterwave BVN Detection */}
            <div className="rounded-2xl bg-[#FAF7F2] border border-[#BA7E44]/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1A1D23]">
                  Identity Verification ({idType.toUpperCase()}) *
                </span>
                <div className="inline-flex rounded-lg bg-white p-0.5 border border-gray-200">
                  {(['bvn', 'nin'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setIdType(type);
                        setSignupError('');
                        setBvnDetectionNote('');
                        setBvnDetectedSuccess(false);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
                        idType === type
                          ? 'bg-[#BA7E44] text-white'
                          : 'text-gray-600 hover:text-[#1A1D23]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  required
                  value={idNumber}
                  onChange={(e) => {
                    setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                    setSignupError('');
                    setBvnDetectionNote('');
                    setBvnDetectedSuccess(false);
                  }}
                  placeholder={`Enter 11-digit ${idType.toUpperCase()}`}
                  className="flex-1 h-11 px-3.5 rounded-xl bg-white border border-gray-200 text-sm font-mono-tabular text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
                {idType === 'bvn' && (
                  <button
                    type="button"
                    disabled={detectingBvn || idNumber.replace(/\D/g, '').length !== 11}
                    onClick={() => void handleDetectBvn()}
                    className="h-11 px-3 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] disabled:bg-[#EBDDC9] disabled:text-gray-500 text-white text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                  >
                    {detectingBvn ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Detect
                  </button>
                )}
              </div>

              {bvnDetectionNote && (
                <div
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                    bvnDetectedSuccess
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {bvnDetectionNote}
                </div>
              )}

              <p className="text-[11px] text-gray-500 leading-snug">
                Verified via Flutterwave to issue your permanent Nigerian funding account number.
              </p>

              <div className="pt-2 border-t border-gray-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#BA7E44] accent-[#BA7E44]"
                  />
                  <span className="text-[11px] text-[#4A3525] leading-relaxed select-none">
                    <strong>NDPR Consent:</strong> I authorize E&amp;M PAY and Flutterwave to verify my identity via NIBSS/NIMC for KYC compliance.
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                placeholder="First Name & Last Name"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Residential Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, State"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  4-Digit Security PIN *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setSignupError('');
                  }}
                  placeholder="••••"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-center text-base font-mono-tabular tracking-[0.4em] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Confirm 4-Digit PIN *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setSignupError('');
                  }}
                  placeholder="••••"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-center text-base font-mono-tabular tracking-[0.4em] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>
            </div>

            {signupError && <p className="text-xs font-medium text-red-500">{signupError}</p>}

            <button
              type="submit"
              disabled={loading || !consentAccepted}
              className="mt-2 w-full h-[50px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:opacity-50 text-white text-[15px] font-semibold shadow-[0_6px_16px_rgba(186,126,68,0.24)] transition-all"
            >
              {loading ? 'Creating & Verifying Account...' : 'Create Account & Get Bank No.'}
            </button>
          </form>
        )}
      </div>

      <div />
    </div>
  );
};
