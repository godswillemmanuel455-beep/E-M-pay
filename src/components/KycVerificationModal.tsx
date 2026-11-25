import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import type { UserProfile } from '../types/banking';
import type { BackendAccountPayload } from './AuthScreens';
import {
  verifyKycAndGenerateVirtualAccountApi,
  type VirtualAccountInfo,
} from '../utils/authApi';

interface KycVerificationModalProps {
  isOpen: boolean;
  profile: UserProfile;
  virtualAccount?: VirtualAccountInfo | null;
  initialIdType?: 'bvn' | 'nin';
  onClose: () => void;
  onVerificationComplete: (
    account: BackendAccountPayload,
    virtualAccount: VirtualAccountInfo
  ) => void;
}

export const KycVerificationModal: React.FC<KycVerificationModalProps> = ({
  isOpen,
  profile,
  virtualAccount = null,
  initialIdType = 'bvn',
  onClose,
  onVerificationComplete,
}) => {
  const [idType, setIdType] = useState<'bvn' | 'nin'>(
    (profile.verificationType === 'nin' || initialIdType === 'nin') ? 'nin' : 'bvn'
  );
  const [idNumber, setIdNumber] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(profile.verificationFailureReason || '');
  const [copied, setCopied] = useState(false);
  const [currentVa, setCurrentVa] = useState<VirtualAccountInfo | null>(virtualAccount);

  if (!isOpen) return null;

  const currentStatus: 'not_verified' | 'pending' | 'successful' | 'failed' =
    currentVa?.accountNumber
      ? 'successful'
      : (profile.verificationStatus || 'not_verified');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = idNumber.replace(/\D/g, '');

    if (cleanId.length !== 11) {
      setError(`Please enter your valid 11-digit ${idType.toUpperCase()}.`);
      return;
    }

    if (!consentAccepted) {
      setError('You must grant consent to verify your identity under Nigerian Data Protection Regulation (NDPR).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifyKycAndGenerateVirtualAccountApi({
        normalizedPhone: profile.normalizedPhone,
        idType,
        idNumber: cleanId,
        consentAccepted: true,
      });

      if (res.ok && res.data.virtualAccount) {
        setCurrentVa(res.data.virtualAccount);
        if (res.data.account) {
          onVerificationComplete(res.data.account, res.data.virtualAccount);
        }
      } else {
        const errorMsg =
          res.data.error ||
          res.data.message ||
          'Verification failed. Please check your details and try again.';
        setError(errorMsg);
      }
    } catch {
      setError('Unable to reach Flutterwave verification services. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAccount = () => {
    if (!currentVa?.accountNumber) return;
    navigator.clipboard?.writeText(currentVa.accountNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#BA7E44]/15 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#BA7E44] to-[#9C6230] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold leading-tight">Identity Verification &amp; Bank Account</h2>
              <p className="text-[12px] text-white/80">CBN / Flutterwave KYC Virtual Account System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
          {/* Status Badge Strip */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8]">
            <span className="text-xs font-semibold text-[#4A3525]">Verification Status:</span>
            {currentStatus === 'successful' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF7F2] text-[#9C6230]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified &amp; Active
              </span>
            ) : currentStatus === 'pending' || loading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3E6] text-[#D97706] animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verification Pending
              </span>
            ) : currentStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF1F2] text-[#BE123C]">
                <AlertCircle className="w-3.5 h-3.5" />
                Verification Failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                <Info className="w-3.5 h-3.5" />
                Not Verified
              </span>
            )}
          </div>

          {/* STAGE 1: VERIFIED SUCCESSFUL */}
          {currentStatus === 'successful' && currentVa && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-[#BA7E44] to-[#9C6230] text-white p-5 shadow-lg shadow-[#BA7E44]/20">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold backdrop-blur-sm text-white">
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    ⚡ Automatic Deposit Active
                  </div>
                  <span className="text-xs text-white/80 font-medium">Single Permanent Account</span>
                </div>

                <div className="mt-4">
                  <div className="text-[12px] text-white/80 font-medium">Bank Name</div>
                  <div className="text-[17px] font-bold tracking-tight">{currentVa.bankName}</div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 bg-black/20 p-3 rounded-xl border border-white/10">
                  <div>
                    <div className="text-[11px] text-white/80">Account Number</div>
                    <div className="text-[24px] font-mono-tabular font-bold tracking-wider">
                      {currentVa.accountNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="px-3.5 py-2 rounded-xl bg-white text-[#9C6230] text-xs font-bold flex items-center gap-1.5 hover:bg-white/95 active:scale-95 transition-all shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#BA7E44]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="mt-3 text-[12px] text-white/90 truncate">
                  Account Name: <strong className="font-semibold text-white">{currentVa.accountName || profile.fullName}</strong>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF7F2] p-4 border border-[#F0E5D8] space-y-2 text-xs text-[#4A3525]">
                <div className="font-semibold text-sm text-[#1A1D23] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#BA7E44]" />
                  Zero-Fee Instant Auto-Funding
                </div>
                <p className="leading-relaxed">
                  Send money to this account from Kuda, OPay, PalmPay, GTBank, Zenith, Access, or any Nigerian banking app or USSD (*737#, *894#, etc.).
                </p>
                <p className="leading-relaxed font-medium text-[#9C6230]">
                  • Credits your E&amp;M PAY wallet automatically in under 5 seconds.
                  <br />• No need to tap &quot;I have made transfer&quot; or upload receipts.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-2xl bg-[#BA7E44] hover:bg-[#9C6230] text-white font-semibold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* STAGE 2: PENDING / SPINNER */}
          {loading && (
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#F5EBDD] flex items-center justify-center animate-spin">
                <Loader2 className="w-8 h-8 text-[#BA7E44]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1D23]">Connecting to Flutterwave KYC...</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Verifying your {idType.toUpperCase()} with official NIBSS / NIMC registries and generating your dedicated Nigerian bank account number.
                </p>
              </div>
            </div>
          )}

          {/* STAGE 3: FORM (NOT VERIFIED OR FAILED RETRY) */}
          {!loading && currentStatus !== 'successful' && (
            <form onSubmit={handleVerify} className="space-y-4">
              {/* If previously failed, show alert */}
              {error && (
                <div className="p-4 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#BE123C] space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Verification Note / Required Action:
                  </div>
                  <p className="leading-relaxed">{error}</p>
                  {error.includes('IP Whitelisting') && (
                    <div className="pt-1 text-[11px] text-[#9F1239] font-medium border-t border-[#FECDD3]/60">
                      Merchant Guide: Log in to Flutterwave Dashboard &gt; Settings &gt; Security &gt; IP Whitelist and add your server domain/IP to enable live virtual accounts.
                    </div>
                  )}
                </div>
              )}

              {/* Verified Identity matching notice */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8] text-xs text-[#4A3525] space-y-1">
                <div className="font-semibold text-[#1A1D23] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#BA7E44]" />
                  Registered Account Holder
                </div>
                <p>
                  Name on Account: <strong className="font-bold text-[#1A1D23]">{profile.fullName}</strong>
                </p>
                <p className="text-[11px] text-gray-500 leading-snug">
                  CBN and Flutterwave require that the identity information matches the registered account holder name.
                </p>
              </div>

              {/* Clear Choice: BVN vs NIN */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1D23] mb-2">
                  Select Verification Method:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIdType('bvn');
                      setError('');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      idType === 'bvn'
                        ? 'border-[#BA7E44] bg-[#F5EBDD]/40 text-[#4A3525] ring-2 ring-[#BA7E44]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Verify with BVN</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          idType === 'bvn' ? 'border-[#BA7E44] bg-[#BA7E44]' : 'border-gray-300'
                        }`}
                      >
                        {idType === 'bvn' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 block mt-1">Bank Verification Number</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIdType('nin');
                      setError('');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      idType === 'nin'
                        ? 'border-[#BA7E44] bg-[#F5EBDD]/40 text-[#4A3525] ring-2 ring-[#BA7E44]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Verify with NIN</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          idType === 'nin' ? 'border-[#BA7E44] bg-[#BA7E44]' : 'border-gray-300'
                        }`}
                      >
                        {idType === 'nin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 block mt-1">National Identity Number</span>
                  </button>
                </div>
              </div>

              {/* 11-Digit Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="kyc-id-number" className="block text-xs font-semibold text-[#1A1D23]">
                    11-Digit {idType.toUpperCase()} Number
                  </label>
                  <span className="text-[11px] font-mono-tabular text-gray-500">
                    {idNumber.length}/11 digits
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="kyc-id-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={idNumber}
                    onChange={(e) => {
                      setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                      setError('');
                    }}
                    placeholder={`Enter your 11-digit ${idType.toUpperCase()}`}
                    className="w-full h-12 px-4 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8] text-base font-mono-tabular text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30 focus:border-[#BA7E44] transition-all"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Dial <strong>*565*0#</strong> on your registered SIM to check BVN, or <strong>*346#</strong> for NIN.
                </p>
              </div>

              {/* NDPR User Consent Checkbox */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#F0E5D8]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => {
                      setConsentAccepted(e.target.checked);
                      if (e.target.checked) setError('');
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-[#BA7E44] accent-[#BA7E44] focus:ring-[#BA7E44]"
                  />
                  <span className="text-[11.5px] text-[#4A3525] leading-relaxed select-none">
                    <strong>NDPR Consent:</strong> I authorize E&amp;M PAY and Flutterwave to verify my identity via NIBSS / NIMC registries for KYC compliance. I understand that my raw {idType.toUpperCase()} is processed securely on backend servers and never exposed to other users or stored in public records.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || idNumber.length !== 11 || !consentAccepted}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#BA7E44] to-[#9C6230] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#BA7E44]/20 transition-all"
              >
                {currentStatus === 'failed' ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry Verification &amp; Generate Account
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify &amp; Generate Bank Account Number
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
