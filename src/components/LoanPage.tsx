import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  Lock,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type {
  LoanApplicationInfo,
  LoanState,
  Transaction,
  UserProfile,
} from '../types/banking';

interface LoanPageProps {
  balance: number;
  profile: UserProfile;
  loan: LoanState;
  onBack: () => void;
  onOpenHistory: () => void;
  onApplyLoan: (
    amount: number,
    info: LoanApplicationInfo
  ) => { error?: string; transaction?: Transaction };
  onRepayLoan: (amount: number) => string | null;
  onCompleteReceipt: (transaction: Transaction) => void;
}

const MIN_COLLECTABLE = 4000;
const PRESET_AMOUNTS = [4000, 10000, 20000, 30000];

export function calculateLoanCharges(amount: number, tenureDays: 14 | 30 | 90) {
  const interestRatePct = tenureDays === 14 ? 1.4 : tenureDays === 30 ? 2.5 : 6.0;
  const serviceFeePct = 0.8;
  const adminFeePct = 0.4;

  const interestCharge = Math.round(amount * (interestRatePct / 100));
  const serviceFee = Math.round(amount * (serviceFeePct / 100));
  const adminFee = Math.round(amount * (adminFeePct / 100));
  const totalCharges = interestCharge + serviceFee + adminFee;
  const totalRepayment = amount + totalCharges;

  return {
    interestRatePct,
    serviceFeePct,
    adminFeePct,
    interestCharge,
    serviceFee,
    adminFee,
    totalCharges,
    totalRepayment,
  };
}

export const LoanPage: React.FC<LoanPageProps> = ({
  balance,
  profile,
  loan,
  onBack,
  onOpenHistory,
  onApplyLoan,
  onRepayLoan,
  onCompleteReceipt,
}) => {
  const hasUnpaidDebt = loan.activeBalance > 0;
  const starterLimit = !loan.unlocked90Days && loan.eligibleLimit > 30000 ? 30000 : loan.eligibleLimit;
  const availableLoanLimit = hasUnpaidDebt ? 0 : starterLimit;
  const is90DaysUnlocked = Boolean(loan.unlocked90Days);

  // Application form state (simple/random details, ZERO NIN or BVN required)
  const [amount, setAmount] = useState<number>(() =>
    starterLimit >= 30000 ? 30000 : Math.max(MIN_COLLECTABLE, starterLimit)
  );
  const [tenureDays, setTenureDays] = useState<14 | 30 | 90>(30);
  const [tenureNotice, setTenureNotice] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('Self-Employed');
  const [monthlyIncome, setMonthlyIncome] = useState('₦100,000 - ₦250,000');
  const [loanPurpose, setLoanPurpose] = useState('Business & Personal');
  const [stateOfResidence, setStateOfResidence] = useState(
    profile.address ? profile.address.split(',').pop()?.trim() || 'Lagos' : 'Lagos'
  );
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [formError, setFormError] = useState('');

  // Repay state
  const [repayAmount, setRepayAmount] = useState(
    loan.activeBalance > 0 ? String(loan.activeBalance) : String(MIN_COLLECTABLE)
  );
  const [repayError, setRepayError] = useState('');

  const chargeBreakdown = calculateLoanCharges(amount, tenureDays);

  const handleAutoFillSample = () => {
    setEmploymentStatus('Business Owner');
    setMonthlyIncome('₦150,000 - ₦300,000');
    setLoanPurpose('Working Capital');
    setStateOfResidence('Lagos');
    setEmergencyName('Tunde Balogun');
    setEmergencyPhone('0803 551 9204');
    setFormError('');
  };

  const handleSelectTenure = (days: 14 | 30 | 90) => {
    if (days === 90 && !is90DaysUnlocked) {
      setTenureNotice('90 Days repayment is locked. Repay an active loan on time to unlock it.');
      return;
    }
    setTenureNotice('');
    setTenureDays(days);
  };

  const handleSubmitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (hasUnpaidDebt) {
      setFormError('You must pay off your existing debt before collecting another loan.');
      return;
    }
    if (amount < MIN_COLLECTABLE) {
      setFormError(`Minimum collectable loan is ${formatNaira(MIN_COLLECTABLE, false)}.`);
      return;
    }
    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      setFormError('Please fill in your contact name and phone number.');
      return;
    }

    const res = onApplyLoan(amount, {
      employmentStatus,
      monthlyIncome,
      loanPurpose,
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      stateOfResidence: stateOfResidence.trim() || 'Lagos',
      tenureDays,
      interestCharge: chargeBreakdown.interestCharge,
      serviceFee: chargeBreakdown.serviceFee,
      adminFee: chargeBreakdown.adminFee,
      appliedAt: 'Just now',
    });
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (res.transaction) {
      onCompleteReceipt(res.transaction);
    }
  };

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    setRepayError('');
    const num = Number(repayAmount);
    if (!num || num <= 0) {
      setRepayError('Enter a valid repayment amount.');
      return;
    }
    const err = onRepayLoan(num);
    if (err) {
      setRepayError(err);
    } else {
      const nextRemaining = Math.max(0, loan.activeBalance - num);
      setRepayAmount(nextRemaining > 0 ? String(nextRemaining) : '');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#F4F6F8] flex flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[17px] font-bold text-[#1A1D23] leading-tight">
            E&amp;M Pay Loan
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="min-h-[40px] px-2 flex items-center text-[14px] font-semibold text-[#BA7E44] hover:text-[#9C6230]"
        >
          History
        </button>
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto p-4 space-y-4 pb-8">
          {/* Loan Hero Card */}
          <section className="rounded-[20px] bg-gradient-to-br from-[#BA7E44] via-[#BA7E44] to-[#BA7E44] text-white p-5 shadow-[0_6px_20px_rgba(186,126,68,0.22)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                <ShieldCheck className="w-4 h-4" />
                <span>{hasUnpaidDebt ? 'Available Credit Locked' : 'Starter Loan Limit'}</span>
              </div>
              <span className="text-[11.5px] font-semibold text-white/90">
                No NIN or BVN Required
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[30px] font-extrabold tracking-tight tabular-nums leading-none">
                  {formatNaira(availableLoanLimit)}
                </div>
                <div className="mt-1.5 text-[12px] text-white/85">
                  Starter Limit: {formatNaira(starterLimit, false)} · Min Collectable:{' '}
                  {formatNaira(MIN_COLLECTABLE, false)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-white/80">Wallet Balance</div>
                <div className="text-[16px] font-bold tabular-nums">{formatNaira(balance)}</div>
              </div>
            </div>

            {hasUnpaidDebt && (
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-white/80">Unpaid Debt Owed: </span>
                  <span className="font-bold text-white tabular-nums">
                    {formatNaira(loan.activeBalance)}
                  </span>
                </div>
                <span className="text-white/90">Due: {loan.dueDate}</span>
              </div>
            )}
          </section>

          {/* APPLY FOR LOAN — BLOCKED IF ANY OLD DEBT IS UNPAID (EVEN PARTIAL LOAN) */}
          {!hasUnpaidDebt ? (
            <form
              onSubmit={handleSubmitApplication}
              className="bg-white rounded-[18px] p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-5"
            >
              {/* Amount Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[15.5px] font-bold text-[#1A1D23]">
                    Select Loan Amount
                  </h2>
                  <span className="text-[12px] font-semibold text-[#BA7E44] tabular-nums">
                    ₦4,000 – {formatNaira(starterLimit, false)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_AMOUNTS.filter((v) => v <= starterLimit).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`h-10 rounded-xl text-[13px] font-bold tabular-nums transition-colors border ${
                        amount === preset
                          ? 'bg-[#F5EBDD] border-[#BA7E44] text-[#9C6230]'
                          : 'bg-[#F4F6F8] border-transparent text-[#1A1D23] hover:bg-[#EBEEF2]'
                      }`}
                    >
                      ₦{preset.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F4F6F8] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Loan Amount</span>
                    <span className="text-[20px] font-extrabold text-[#1A1D23] tabular-nums">
                      {formatNaira(amount, false)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_COLLECTABLE}
                    max={starterLimit}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full accent-[#BA7E44]"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400 tabular-nums">
                    <span>Min ₦4,000</span>
                    <span>Max {formatNaira(starterLimit, false)}</span>
                  </div>
                </div>
              </div>

              {/* Repayment Days: 14 Days, 30 Days, 90 Days (Locked until paid on time) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13.5px] font-bold text-[#1A1D23]">Repayment Days</span>
                  <span className="text-[12px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#BA7E44]" />
                    Low transparent rates
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {([14, 30, 90] as const).map((days) => {
                    const isLocked = days === 90 && !is90DaysUnlocked;
                    const active = tenureDays === days && !isLocked;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => handleSelectTenure(days)}
                        className={`py-2.5 px-2 rounded-xl text-center transition-colors border flex flex-col items-center justify-center gap-0.5 ${
                          isLocked
                            ? 'bg-gray-100 border-gray-200 text-gray-400'
                            : active
                            ? 'bg-[#F5EBDD] border-[#BA7E44] text-[#9C6230]'
                            : 'bg-[#F4F6F8] border-transparent text-[#1A1D23] hover:bg-[#EBEEF2]'
                        }`}
                      >
                        <span className="text-[13px] font-bold inline-flex items-center gap-1">
                          {days === 90 &&
                            (isLocked ? (
                              <Lock className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-[#BA7E44]" />
                            ))}
                          {days} Days
                        </span>
                        {days === 90 && isLocked && (
                          <span className="text-[10px] text-gray-400 leading-tight">
                            Pay on time to unlock
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {tenureNotice && (
                  <p className="mt-2 text-[11.5px] font-medium text-amber-600">{tenureNotice}</p>
                )}

                {/* Transparent Smaller-Rate Extra Loan Charges Breakdown */}
                <div className="mt-3 rounded-2xl bg-[#F9FAFB] border border-gray-100 p-3.5 space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Loan Credited to Wallet</span>
                    <span className="font-semibold text-[#1A1D23] tabular-nums">
                      {formatNaira(amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Interest ({chargeBreakdown.interestRatePct}% for {tenureDays}d)
                    </span>
                    <span className="font-medium text-[#1A1D23] tabular-nums">
                      +{formatNaira(chargeBreakdown.interestCharge)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Service Fee ({chargeBreakdown.serviceFeePct}%)
                    </span>
                    <span className="font-medium text-[#1A1D23] tabular-nums">
                      +{formatNaira(chargeBreakdown.serviceFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Credit Protection Fee ({chargeBreakdown.adminFeePct}%)
                    </span>
                    <span className="font-medium text-[#1A1D23] tabular-nums">
                      +{formatNaira(chargeBreakdown.adminFee)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200/70 flex items-center justify-between text-[13px]">
                    <span className="font-bold text-[#1A1D23]">Total Repayment Due</span>
                    <span className="font-extrabold text-[#BA7E44] tabular-nums">
                      {formatNaira(chargeBreakdown.totalRepayment)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Simple Basic Info (NO NIN OR BVN REQUIRED) */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[14.5px] font-bold text-[#1A1D23]">
                      Application Details
                    </h3>
                    <p className="text-[11.5px] text-gray-500">
                      Fill in basic details · Loan reflects in your balance immediately
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillSample}
                    className="px-3 py-1.5 rounded-full bg-[#F5EBDD] hover:bg-[#F5EBDD] text-[#9C6230] text-[11.5px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Quick Fill
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={employmentStatus}
                      onChange={(e) => setEmploymentStatus(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-[#F4F6F8] text-sm font-medium outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    >
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Employed">Employed</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Student / Freelancer">Student / Freelancer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      Monthly Income Range
                    </label>
                    <select
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-[#F4F6F8] text-sm font-medium outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    >
                      <option value="₦30,000 - ₦100,000">₦30,000 - ₦100,000</option>
                      <option value="₦100,000 - ₦250,000">₦100,000 - ₦250,000</option>
                      <option value="₦250,000 - ₦500,000">₦250,000 - ₦500,000</option>
                      <option value="₦500,000+">₦500,000+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      Loan Purpose
                    </label>
                    <input
                      type="text"
                      value={loanPurpose}
                      onChange={(e) => setLoanPurpose(e.target.value)}
                      placeholder="e.g. Personal, Business, Bills"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      State / City
                    </label>
                    <input
                      type="text"
                      value={stateOfResidence}
                      onChange={(e) => setStateOfResidence(e.target.value)}
                      placeholder="e.g. Lagos"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      Next of Kin / Contact Name
                    </label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Enter contact name"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="e.g. 0803 000 0000"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular outline-none focus:ring-2 focus:ring-[#BA7E44]"
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-xs font-medium text-red-500">{formError}</p>
              )}

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.99] text-white text-[15px] font-semibold shadow-[0_6px_18px_rgba(186,126,68,0.24)] transition-all"
              >
                Apply &amp; Receive {formatNaira(amount, false)} to Balance
              </button>
            </form>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-[14px] font-bold text-amber-900">
                  Existing Debt Must Be Paid First
                </div>
                <p className="text-[12.5px] text-amber-800 leading-relaxed">
                  You currently owe <span className="font-bold tabular-nums">{formatNaira(loan.activeBalance)}</span>. Even if you did not collect all{' '}
                  {formatNaira(starterLimit, false)}, you must repay your existing loan in full before collecting another loan.
                </p>
              </div>
            </div>
          )}

          {/* ACTIVE LOAN REPAYMENT SECTION */}
          {hasUnpaidDebt && (
            <form
              onSubmit={handleRepay}
              className="bg-white rounded-[18px] p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1A1D23]">Active Loan Repayment</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Due: {loan.dueDate}
                    {!is90DaysUnlocked && ' · Repay on time to unlock 90 Days'}
                  </p>
                </div>
                <span className="text-[18px] font-extrabold text-[#1A1D23] tabular-nums">
                  {formatNaira(loan.activeBalance)}
                </span>
              </div>

              {(loan.principalAmount ?? 0) > 0 && (
                <div className="rounded-xl bg-[#F4F6F8] px-3.5 py-2.5 flex items-center justify-between text-xs text-gray-600 tabular-nums">
                  <span>Principal: {formatNaira(loan.principalAmount ?? 0)}</span>
                  <span>Loan Charges: {formatNaira(loan.totalCharges ?? 0)}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[0.25, 0.5, 1].map((ratio) => {
                  const val = Math.round(loan.activeBalance * ratio);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setRepayAmount(String(val))}
                      className="h-9 rounded-xl bg-[#F4F6F8] hover:bg-[#F5EBDD] text-xs font-semibold text-[#1A1D23] tabular-nums transition-colors"
                    >
                      {ratio === 1 ? 'Full' : `${ratio * 100}%`} ({formatNaira(val, false)})
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Repayment Amount (₦)
                </label>
                <input
                  type="number"
                  min={100}
                  max={loan.activeBalance}
                  value={repayAmount}
                  onChange={(e) => {
                    setRepayAmount(e.target.value);
                    setRepayError('');
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-base font-bold tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>

              {repayError && (
                <p className="text-xs font-medium text-red-500">{repayError}</p>
              )}

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[14.5px] font-semibold transition-colors"
              >
                Repay {repayAmount ? formatNaira(Number(repayAmount)) : 'Loan'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
