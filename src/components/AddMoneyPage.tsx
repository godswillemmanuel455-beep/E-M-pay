import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { Transaction, UserProfile } from '../types/banking';
import type { BackendAccountPayload } from './AuthScreens';
import {
  autoCheckDepositApi,
  createFlwCheckoutDepositApi,
  getFundingOverviewApi,
  verifyKycAndGenerateVirtualAccountApi,
  type VirtualAccountInfo,
} from '../utils/authApi';

interface AddMoneyPageProps {
  balance: number;
  profile: UserProfile;
  initialVirtualAccount?: VirtualAccountInfo | null;
  onBack: () => void;
  onOpenHistory: () => void;
  onDepositCredited: (account: BackendAccountPayload, transaction: Transaction) => void;
  onVirtualAccountCreated?: (
    account: BackendAccountPayload,
    virtualAccount: VirtualAccountInfo
  ) => void;
}

export const AddMoneyPage: React.FC<AddMoneyPageProps> = ({
  balance,
  profile,
  initialVirtualAccount = null,
  onBack,
  onOpenHistory,
  onDepositCredited,
  onVirtualAccountCreated,
}) => {
  const [amount, setAmount] = useState('1000');
  const [showCardTopup, setShowCardTopup] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [idType, setIdType] = useState<'bvn' | 'nin'>(
    profile.verificationType === 'nin' ? 'nin' : 'bvn'
  );
  const [idNumber, setIdNumber] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [initializing, setInitializing] = useState(!initialVirtualAccount);
  const [creatingPermanent, setCreatingPermanent] = useState(false);
  const [permanentError, setPermanentError] = useState(profile.verificationFailureReason || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountInfo | null>(
    initialVirtualAccount
  );
  const [copiedKey, setCopiedKey] = useState<'permanent' | 'share' | 'wallet' | null>(null);

  // Load existing permanent virtual account or pending transfer account
  useEffect(() => {
    if (!profile.normalizedPhone) {
      setInitializing(false);
      return;
    }

    let cancelled = false;
    if (!initialVirtualAccount) {
      setInitializing(true);
    }

    void getFundingOverviewApi(profile.normalizedPhone).then((overview) => {
      if (cancelled) return;

      const knownVa = overview.virtualAccount ?? initialVirtualAccount ?? null;
      if (knownVa) {
        setVirtualAccount(knownVa);
      }

      if (overview.deposit) {
        setAmount(String(overview.deposit.expectedAmount));
      }

      setInitializing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [profile.normalizedPhone, initialVirtualAccount]);

  // Automatic wallet funding background auto-polling every 3s
  useEffect(() => {
    if (!profile.normalizedPhone) return;

    const interval = window.setInterval(() => {
      void autoCheckDepositApi(profile.normalizedPhone).then((res) => {
        if (res.ok && res.data.credited && res.data.account && res.data.transaction) {
          onDepositCredited(res.data.account, res.data.transaction as Transaction);
          setStatusMessage(
            `Deposit of ${formatNaira(res.data.amount ?? 0)} received and credited to your wallet automatically!`
          );
        }
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [profile.normalizedPhone, onDepositCredited]);

  const handleCopy = (text: string, key: 'permanent' | 'share' | 'wallet') => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handleShareDetails = () => {
    if (!virtualAccount) return;
    const text = `E&M PAY Bank Transfer Details:\nBank: ${virtualAccount.bankName}\nAccount No: ${virtualAccount.accountNumber}\nAccount Name: ${virtualAccount.accountName || profile.fullName}`;
    if (navigator.share) {
      void navigator.share({ title: 'E&M Pay Virtual Account', text }).catch(() => {});
    } else {
      handleCopy(text, 'share');
    }
  };

  const handleCreatePermanentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermanentError('');
    const digits = idNumber.replace(/\D/g, '');

    if (digits.length !== 11) {
      setPermanentError(
        `Enter your valid 11-digit ${idType.toUpperCase()} to generate your permanent account number.`
      );
      return;
    }

    if (!consentAccepted) {
      setPermanentError(
        'User consent is required before verifying identity under Nigerian Data Protection Regulation (NDPR).'
      );
      return;
    }

    if (!profile.normalizedPhone) {
      setPermanentError('Please sign in again to verify identity.');
      return;
    }

    setCreatingPermanent(true);
    try {
      const res = await verifyKycAndGenerateVirtualAccountApi({
        normalizedPhone: profile.normalizedPhone,
        idType,
        idNumber: digits,
        consentAccepted: true,
      });

      if (!res.ok || !res.data.virtualAccount) {
        setPermanentError(
          res.data.error ||
            res.data.message ||
            'Could not generate a permanent virtual account. Please check your details and try again.'
        );
        return;
      }

      setVirtualAccount(res.data.virtualAccount);
      setIdNumber('');
      if (res.data.account) {
        onVirtualAccountCreated?.(res.data.account, res.data.virtualAccount);
      }
      setStatusMessage('Your permanent dedicated Nigerian bank account is now active!');
    } finally {
      setCreatingPermanent(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#FAF7F2] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="h-[52px] px-4 bg-white border-b border-[#F0E5D8] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center hover:bg-gray-100 text-[#1A1D23] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[17px] font-semibold text-[#1A1D23]">Add Money</h1>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="min-h-[44px] px-2 flex items-center text-[14.5px] font-semibold text-[#BA7E44] hover:text-[#9C6230] whitespace-nowrap shrink-0"
        >
          History
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-xl mx-auto w-full">
        {/* Status Toast */}
        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-[#F5EBDD] border border-[#BA7E44]/30 text-xs font-semibold text-[#9C6230] flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#BA7E44]" />
            <span className="flex-1 leading-snug">{statusMessage}</span>
          </div>
        )}

        {/* Wallet Balance & E&M Pay Account Strip */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-sm border border-[#F0E5D8] flex items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] font-medium text-gray-500">E&amp;M Pay Wallet Number</div>
            <div className="text-[19px] font-bold font-mono-tabular text-[#1A1D23] tracking-wide mt-0.5">
              {profile.accountNumber}
            </div>
            <div className="text-[11.5px] text-gray-500 mt-0.5 tabular-nums">
              Balance: <strong className="text-[#9C6230]">{formatNaira(balance)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(profile.accountNumber, 'wallet')}
            className="h-10 px-3.5 rounded-2xl bg-[#F5EBDD] hover:bg-[#EBDDC9] text-[#9C6230] text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            {copiedKey === 'wallet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'wallet' ? 'Copied' : 'Copy Wallet No.'}
          </button>
        </div>

        {/* BANK TRANSFER CARD */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#F0E5D8] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5EBDD] flex items-center justify-center text-[#BA7E44] shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[15.5px] font-bold text-[#1A1D23]">Dedicated Bank Transfer Account</h2>
                <p className="text-[12px] text-gray-500">Transfer from any Nigerian bank to fund instantly</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#BA7E44] bg-[#F5EBDD] px-2.5 py-1 rounded-full shrink-0">
              Zero Fee
            </span>
          </div>

          <div className="border-t border-dashed border-[#F0E5D8] pt-4">
            {initializing ? (
              <div className="py-6 flex items-center gap-3 justify-center text-gray-500 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-[#BA7E44]" />
                Loading your permanent virtual account...
              </div>
            ) : virtualAccount ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[12px] font-medium text-gray-500">
                    {virtualAccount.bankName} Account Number
                  </div>
                  <div className="text-[28px] font-bold font-mono-tabular tracking-wider text-[#1A1D23] mt-0.5 leading-tight">
                    {virtualAccount.accountNumber}
                  </div>
                  <div className="text-[12.5px] font-medium text-gray-600 mt-1 uppercase">
                    Account Holder: <strong className="text-[#1A1D23]">{virtualAccount.accountName || profile.fullName}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(virtualAccount.accountNumber, 'permanent')}
                    className="h-12 rounded-2xl bg-[#F5EBDD] hover:bg-[#EBDDC9] text-[#9C6230] font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-2xs"
                  >
                    {copiedKey === 'permanent' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedKey === 'permanent' ? 'Copied Number' : 'Copy Number'}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareDetails}
                    className="h-12 rounded-2xl bg-[#BA7E44] hover:bg-[#9C6230] text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Details
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!profile.normalizedPhone) return;
                    setStatusMessage('Checking Flutterwave for incoming bank transfers...');
                    void autoCheckDepositApi(profile.normalizedPhone, true).then((res) => {
                      if (res.ok && res.data.credited && res.data.account && res.data.transaction) {
                        onDepositCredited(res.data.account, res.data.transaction as Transaction);
                        setStatusMessage(
                          `⚡ Deposit of ${formatNaira(res.data.amount ?? 0)} received and credited successfully!`
                        );
                      } else {
                        setStatusMessage('No new uncredited bank transfer found yet. Transfers reflect within seconds once settled.');
                      }
                    });
                  }}
                  className="w-full h-11 rounded-2xl bg-[#F5EBDD] hover:bg-[#EBDDC9] text-[#9C6230] font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all border border-[#BA7E44]/20"
                >
                  <RefreshCw className="w-4 h-4 text-[#BA7E44]" />
                  Check for Recent Bank Transfer Deposit
                </button>

                {/* Bank Emblems Row */}
                <div className="pt-2">
                  <div className="text-[11.5px] font-medium text-gray-500 mb-2">
                    Tap bank to copy &amp; open APP
                  </div>
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                    {[
                      { name: 'Moniepoint', code: '090405', bg: 'bg-[#0361F0]', label: 'M' },
                      { name: 'Zenith Bank', code: '057', bg: 'bg-red-600', label: 'Z' },
                      { name: 'UBA', code: '033', bg: 'bg-red-700', label: 'UBA' },
                      { name: 'Kuda', code: '090267', bg: 'bg-purple-700', label: 'K.' },
                      { name: 'GTBank', code: '058', bg: 'bg-orange-600', label: 'GT' },
                    ].map((bank) => (
                      <button
                        key={bank.name}
                        type="button"
                        onClick={() => handleCopy(virtualAccount.accountNumber, 'permanent')}
                        className="flex flex-col items-center gap-1 min-w-[56px] p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                      >
                        <span className={`w-9 h-9 rounded-full ${bank.bg} text-white font-black text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}>
                          {bank.label}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-600 truncate max-w-[60px]">
                          {bank.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Automatic Transfer Info Notice */}
                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8] flex items-start gap-2.5 text-xs text-[#4A3525]">
                  <Zap className="w-4 h-4 text-[#BA7E44] shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>⚡ Automatic Deposit Active:</strong> Any transfer sent from any bank or mobile app credits your E&amp;M PAY wallet automatically within 5 seconds. No need to tap &quot;I have made payment&quot;.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePermanentAccount} className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1A1D23]">
                  <ShieldCheck className="w-5 h-5 text-[#BA7E44]" />
                  Generate Permanent Virtual Account
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  CBN and NIBSS require one-time identity verification. Choose to verify with BVN or NIN to generate your permanent account number.
                </p>

                {permanentError && (
                  <div className="p-3.5 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#BE123C] space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Verification Note:
                    </div>
                    <p>{permanentError}</p>
                  </div>
                )}

                {/* Choice: BVN vs NIN */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIdType('bvn');
                      setPermanentError('');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      idType === 'bvn'
                        ? 'border-[#BA7E44] bg-[#F5EBDD]/40 text-[#1A1D23] ring-2 ring-[#BA7E44]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Verify with BVN</span>
                    <span className="text-[10px] text-gray-500">Bank Verification No.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIdType('nin');
                      setPermanentError('');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      idType === 'nin'
                        ? 'border-[#BA7E44] bg-[#F5EBDD]/40 text-[#1A1D23] ring-2 ring-[#BA7E44]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Verify with NIN</span>
                    <span className="text-[10px] text-gray-500">National Identity No.</span>
                  </button>
                </div>

                {/* 11 Digit Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#1A1D23]">
                      11-Digit {idType.toUpperCase()}
                    </label>
                    <span className="text-[11px] font-mono-tabular text-gray-500">
                      {idNumber.length}/11
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={idNumber}
                    onChange={(e) => {
                      setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                      setPermanentError('');
                    }}
                    placeholder={`Enter your 11-digit ${idType.toUpperCase()}`}
                    className="w-full h-12 px-4 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8] text-base font-mono-tabular text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30"
                  />
                </div>

                {/* NDPR Consent */}
                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8]">
                  <label className="flex items-start gap-2.5 cursor-pointer">
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

                <button
                  type="submit"
                  disabled={creatingPermanent || idNumber.length !== 11 || !consentAccepted}
                  className="w-full h-12 rounded-2xl bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#BA7E44]/20"
                >
                  {creatingPermanent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting to Flutterwave...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify &amp; Generate Bank Account
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* TOP-UP WITH CARD / CHECKOUT CARD */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#F0E5D8] space-y-3">
          <button
            type="button"
            onClick={() => setShowCardTopup((prev) => !prev)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5EBDD] flex items-center justify-center text-[#BA7E44] shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[14.5px] font-bold text-[#1A1D23]">Top-up with Card / USSD</h3>
                <p className="text-[12px] text-gray-500">Pay via Flutterwave debit card, USSD, or bank checkout.</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${showCardTopup ? 'rotate-90' : ''}`} />
          </button>

          {showCardTopup && (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {['500', '1000', '2000', '5000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`h-9 rounded-xl text-xs font-bold tabular-nums transition-colors ${
                      amount === preset
                        ? 'bg-[#BA7E44] text-white'
                        : 'bg-[#FAF7F2] text-[#1A1D23] hover:bg-[#F5EBDD]'
                    }`}
                  >
                    ₦{Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount (min ₦100)"
                  className="flex-1 h-11 px-3.5 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8] text-sm font-bold tabular-nums text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30"
                />
                <button
                  type="button"
                  disabled={creatingCheckout || Number(amount) < 100}
                  onClick={async () => {
                    const numAmt = Number(amount);
                    if (!profile.normalizedPhone || !Number.isFinite(numAmt) || numAmt < 100) {
                      setStatusMessage('Enter at least ₦100 to top up with card.');
                      return;
                    }
                    setCreatingCheckout(true);
                    try {
                      const res = await createFlwCheckoutDepositApi({
                        normalizedPhone: profile.normalizedPhone,
                        amount: numAmt,
                        redirectUrl: window.location.href.split('?')[0],
                      });
                      if (res.ok && res.data.deposit?.checkoutLink) {
                        window.location.href = res.data.deposit.checkoutLink;
                      } else {
                        setStatusMessage(res.data.error || 'Could not start Flutterwave checkout.');
                      }
                    } finally {
                      setCreatingCheckout(false);
                    }
                  }}
                  className="h-11 px-4 rounded-2xl bg-[#BA7E44] hover:bg-[#9C6230] disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
                >
                  {creatingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Proceed to Pay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CASH DEPOSIT CARD */}
        <button
          type="button"
          onClick={() => {
            if (virtualAccount) {
              handleCopy(virtualAccount.accountNumber, 'permanent');
              setStatusMessage(`Copied ${virtualAccount.accountNumber} (${virtualAccount.bankName}) — give this number to any POS agent to deposit cash.`);
            } else {
              setStatusMessage('Verify your BVN or NIN above first to receive your permanent deposit account.');
            }
          }}
          className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-[#F0E5D8] flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F5EBDD] flex items-center justify-center text-[#BA7E44] shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[14.5px] font-bold text-[#1A1D23]">Cash Deposit via POS Agent</h3>
              <p className="text-[12px] text-gray-500">Tap to copy your dedicated bank account for agent cash deposits.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </button>
      </div>
    </div>
  );
};
