import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Gauge,
  Hash,
  Plane,
  QrCode,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { formatNaira, NIGERIAN_BANKS } from '../data/initialState';
import type {
  Beneficiary,
  LoanState,
  ModalType,
  NotificationItem,
  Transaction,
  TransactionCategory,
  UserProfile,
} from '../types/banking';
import { OPayLogo } from './OPayLogo';
import { changePinApi } from '../utils/authApi';

interface ActionModalsProps {
  modal: ModalType;
  onClose: () => void;
  onOpenModal: (modal: ModalType) => void;
  balance: number;
  profile: UserProfile;
  beneficiaries: Beneficiary[];
  transactions: Transaction[];
  notifications: NotificationItem[];
  loan: LoanState;
  onTransfer: (params: {
    recipientName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    amount: number;
    note?: string;
    pin: string;
  }) =>
    | Promise<{ error?: string; transaction?: Transaction }>
    | { error?: string; transaction?: Transaction };
  onPayBill: (params: {
    title: string;
    counterparty: string;
    accountNumber: string;
    amount: number;
    faceAmount?: number;
    category: TransactionCategory;
    carrier?: string;
    billerCode?: string;
    itemCode?: string;
    billType?: string;
    cashbackEarned?: number;
    pin: string;
  }) =>
    | Promise<{ error?: string; transaction?: Transaction }>
    | { error?: string; transaction?: Transaction };
  onBorrowLoan: (amount: number) => string | null;
  onRepayLoan: (amount: number) => string | null;
  onMarkAllNotificationsRead: () => void;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onReplaySplash: () => void;
}

export const ActionModals: React.FC<ActionModalsProps> = ({
  modal,
  onClose,
  onOpenModal,
  balance,
  profile,
  beneficiaries,
  transactions,
  notifications,
  loan,
  onTransfer,
  onPayBill,
  onBorrowLoan,
  onRepayLoan,
  onMarkAllNotificationsRead,
  onUpdateProfile,
  onReplaySplash,
}) => {
  if (modal.kind === 'none') return null;
  if (modal.kind === 'bills' && (modal.service === 'airtime' || modal.service === 'data')) {
    return null;
  }
  if (modal.kind === 'loan' || modal.kind === 'transactions' || modal.kind === 'receipt') {
    return null;
  }
  if (modal.kind === 'transfer' || modal.kind === 'add-money') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-150">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <ModalBody
          modal={modal}
          onClose={onClose}
          onOpenModal={onOpenModal}
          balance={balance}
          profile={profile}
          beneficiaries={beneficiaries}
          transactions={transactions}
          notifications={notifications}
          loan={loan}
          onTransfer={onTransfer}
          onPayBill={onPayBill}
          onBorrowLoan={onBorrowLoan}
          onRepayLoan={onRepayLoan}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onUpdateProfile={onUpdateProfile}
          onReplaySplash={onReplaySplash}
        />
      </div>
    </div>
  );
};

const ModalHeader: React.FC<{ title: string; subtitle?: string; onClose: () => void }> = ({
  title,
  subtitle,
  onClose,
}) => (
  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
    <div>
      <h2 className="text-[16px] font-bold text-[#1A1D23]">{title}</h2>
      {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label="Close modal"
      className="w-9 h-9 rounded-full bg-[#F4F6F8] hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

const ModalBody: React.FC<ActionModalsProps> = (props) => {
  const { modal, onClose, onOpenModal, balance, profile } = props;

  if (modal.kind === 'transfer') {
    return <TransferSheet {...props} mode={modal.mode} />;
  }
  if (modal.kind === 'bills') {
    return <BillsSheet {...props} service={modal.service} />;
  }
  if (modal.kind === 'transactions') {
    return <TransactionsSheet {...props} />;
  }
  if (modal.kind === 'receipt') {
    return <ReceiptSheet transaction={modal.transaction} onClose={onClose} />;
  }
  if (modal.kind === 'loan') {
    return <LoanSheet {...props} />;
  }
  if (modal.kind === 'notifications') {
    return <NotificationsSheet {...props} />;
  }
  if (modal.kind === 'assistant') {
    return <AssistantSheet initialTopic={modal.topic} onClose={onClose} />;
  }
  if (modal.kind === 'qr') {
    return <QrSheet profile={profile} onClose={onClose} onPayDemo={() => onOpenModal({ kind: 'transfer', mode: 'opay' })} />;
  }
  if (modal.kind === 'email') {
    return <EmailSheet profile={profile} onSave={(email) => props.onUpdateProfile({ email })} onClose={onClose} />;
  }
  if (modal.kind === 'security') {
    return <SecuritySheet profile={profile} onUpdateProfile={props.onUpdateProfile} onClose={onClose} />;
  }
  if (modal.kind === 'invitation') {
    return <InvitationSheet profile={profile} onClose={onClose} />;
  }
  if (modal.kind === 'limits') {
    return <LimitsSheet profile={profile} onUpdateProfile={props.onUpdateProfile} onClose={onClose} />;
  }
  if (modal.kind === 'profile') {
    return <ProfileSheet profile={profile} onClose={onClose} />;
  }
  if (modal.kind === 'settings') {
    return (
      <SettingsSheet
        profile={profile}
        onUpdateProfile={props.onUpdateProfile}
        onReplaySplash={() => {
          onClose();
          props.onReplaySplash();
        }}
        onClose={onClose}
      />
    );
  }
  if (modal.kind === 'more-services') {
    return (
      <>
        <ModalHeader title="All Services" subtitle="Bills, lifestyle & financial tools" onClose={onClose} />
        <div className="p-5 grid grid-cols-3 gap-3 overflow-y-auto">
          {[
            { label: 'Electricity', icon: Zap, action: () => onOpenModal({ kind: 'bills', service: 'tv' }) },
            { label: 'Internet', icon: Smartphone, action: () => onOpenModal({ kind: 'bills', service: 'data' }) },
            { label: 'Flight', icon: Plane, action: () => onOpenModal({ kind: 'bills', service: 'betting' }) },
            { label: 'OJunior', icon: Users, action: () => onOpenModal({ kind: 'ojunior' }) },
            { label: 'USSD *955#', icon: Hash, action: () => onOpenModal({ kind: 'ussd' }) },
            { label: 'BizPayment', icon: Store, action: () => onOpenModal({ kind: 'business' }) },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="p-3.5 rounded-2xl bg-[#F4F6F8] hover:bg-[#F5EBDD] flex flex-col items-center gap-2 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xs">
                  <Icon className="w-5 h-5 text-[#BA7E44]" />
                </span>
                <span className="text-[12.5px] font-medium text-[#1A1D23]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }
  if (modal.kind === 'business') {
    return (
      <>
        <ModalHeader title="My BizPayment" subtitle="Merchant collections & POS settlement" onClose={onClose} />
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-2xl bg-[#F5EBDD] p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[#9C6230] font-medium">Instant Settlement Wallet</div>
              <div className="text-xl font-bold text-[#1A1D23] tabular-nums mt-1">
                {formatNaira(balance)}
              </div>
            </div>
            <Store className="w-8 h-8 text-[#BA7E44]" />
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Accept real customer bank transfers straight into your E&amp;M Pay funding account with instant Flutterwave verification.
          </p>
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'add-money' })}
            className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold transition-colors"
          >
            Show Funding Account Number
          </button>
        </div>
      </>
    );
  }
  if (modal.kind === 'ussd') {
    return (
      <>
        <ModalHeader title="E&M Pay USSD Banking" subtitle="Bank offline anytime without data" onClose={onClose} />
        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="p-4 rounded-2xl bg-[#F5EBDD] text-center">
            <div className="text-xs text-[#9C6230] font-medium">Main Dial Code</div>
            <div className="text-2xl font-mono-tabular font-bold text-[#1A1D23] mt-1">*955#</div>
          </div>
          {[
            { label: 'Send Money', code: '*955*1*Amount*Account#' },
            { label: 'Buy Airtime (Self)', code: '*955*3*Amount#' },
            { label: 'Check Balance', code: '*955*0#' },
          ].map((row) => (
            <div key={row.label} className="p-3 rounded-xl bg-[#F4F6F8] flex items-center justify-between text-sm">
              <span className="font-medium text-[#1A1D23]">{row.label}</span>
              <span className="font-mono-tabular font-semibold text-[#BA7E44]">{row.code}</span>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (modal.kind === 'ojunior') {
    return (
      <>
        <ModalHeader title="OJunior Teen Account" subtitle="Teach smart spending & savings early" onClose={onClose} />
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F5EBDD] to-[#FDF6E4]">
            <h3 className="text-[15px] font-bold text-[#1A1D23]">Allowance &amp; Parental Controls</h3>
            <p className="text-[12.5px] text-gray-600 mt-1">
              Create a supervised sub-account with weekly allowance rules and instant transaction alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold"
          >
            Got It
          </button>
        </div>
      </>
    );
  }

  return null;
};

/* --- Sub-modals --- */

const TransferSheet: React.FC<ActionModalsProps & { mode: 'opay' | 'bank' }> = ({
  mode,
  balance,
  beneficiaries,
  profile,
  onTransfer,
  onOpenModal,
  onClose,
}) => {
  const filteredBeneficiaries = beneficiaries.filter((b) =>
    mode === 'opay' ? b.isOpay : !b.isOpay
  );
  const [accountNumber, setAccountNumber] = useState(
    filteredBeneficiaries[0]?.accountNumber ?? ''
  );
  const [recipientName, setRecipientName] = useState(
    filteredBeneficiaries[0]?.name ?? ''
  );
  const [bankName, setBankName] = useState(
    mode === 'opay'
      ? 'E&M Pay Digital Services'
      : filteredBeneficiaries[0]?.bankName ?? NIGERIAN_BANKS[1]
  );
  const [amount, setAmount] = useState('1000');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handlePickBeneficiary = (b: Beneficiary) => {
    setAccountNumber(b.accountNumber);
    setRecipientName(b.name);
    setBankName(b.bankName);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!accountNumber.trim() || accountNumber.trim().length < 10) {
      setError('Enter a valid 10-digit account or E&M Pay phone number.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Enter the recipient account name.');
      return;
    }
    if (!num || num <= 0) {
      setError('Enter a transfer amount above ₦0.');
      return;
    }
    const res = await onTransfer({
      recipientName: recipientName.trim().toUpperCase(),
      accountNumber: accountNumber.trim(),
      bankName,
      amount: num,
      note: note.trim() || undefined,
      pin,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.transaction) {
      onOpenModal({ kind: 'receipt', transaction: res.transaction });
    }
  };

  return (
    <>
      <ModalHeader
        title={mode === 'opay' ? 'Transfer to E&M Pay Account' : 'Transfer to Bank Account'}
        subtitle={`Available: ${formatNaira(balance)}`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto">
        {filteredBeneficiaries.length > 0 && (
          <div>
            <div className="text-[12px] font-medium text-gray-500 mb-2">Recent Recipients</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filteredBeneficiaries.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handlePickBeneficiary(b)}
                  className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-colors ${
                    accountNumber === b.accountNumber
                      ? 'bg-[#F5EBDD] border-[#BA7E44] text-[#9C6230]'
                      : 'bg-[#F4F6F8] border-transparent text-[#1A1D23]'
                  }`}
                >
                  <div className="text-[12px] font-semibold">{b.name}</div>
                  <div className="text-[10.5px] font-mono-tabular text-gray-500">
                    {b.accountNumber}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'bank' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Select Bank</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[#F4F6F8] text-sm font-medium outline-none focus:ring-2 focus:ring-[#BA7E44]"
            >
              {NIGERIAN_BANKS.filter((b) => b !== 'E&M Pay Digital Services').map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {mode === 'opay' ? 'E&M Pay Phone / Account No.' : 'Account Number'}
            </label>
            <input
              type="text"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setAccountNumber(v);
                if (v.length === 10 && !recipientName) {
                  setRecipientName('VERIFIED RECIPIENT');
                }
              }}
              placeholder="10-digit number"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Account holder name"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₦)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {['1000', '2000', '5000', '10000'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`h-8 rounded-lg text-xs font-semibold tabular-nums ${
                  amount === preset
                    ? 'bg-[#BA7E44] text-white'
                    : 'bg-[#F4F6F8] text-[#1A1D23]'
                }`}
              >
                ₦{Number(preset).toLocaleString()}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={50}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-base font-bold tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remark (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              4-Digit PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <button
          type="submit"
          className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold transition-colors"
        >
          Confirm Transfer ({amount ? formatNaira(Number(amount)) : '₦0.00'})
        </button>
      </form>
    </>
  );
};

const BillsSheet: React.FC<
  ActionModalsProps & { service: 'airtime' | 'data' | 'tv' | 'betting' }
> = ({ service, balance, profile, onPayBill, onOpenModal, onClose }) => {
  const providers: Record<string, string[]> = {
    airtime: ['MTN', 'Airtel', 'Glo', '9mobile'],
    data: ['MTN Data', 'Airtel Data', 'Glo Data', '9mobile Data'],
    tv: ['DStv', 'GOtv', 'StarTimes', 'Showmax'],
    betting: ['SportyBet', 'Bet9ja', '1xBet', 'BetKing'],
  };

  const titles: Record<string, string> = {
    airtime: 'Buy Airtime',
    data: 'Buy Mobile Data',
    tv: 'Cable TV & Utilities',
    betting: 'Betting Wallet Top-Up',
  };

  const [provider, setProvider] = useState(providers[service][0]);
  const [customerRef, setCustomerRef] = useState(
    service === 'airtime' || service === 'data' ? profile.accountNumber : '7048291033'
  );
  const [amount, setAmount] = useState(service === 'tv' ? '4500' : '1000');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dataPlans = [
    { label: '1.5GB · 30 Days', price: '1000' },
    { label: '4.5GB · 30 Days', price: '2500' },
    { label: '10GB · 30 Days', price: '4000' },
    { label: '20GB · 30 Days', price: '6500' },
  ];

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!customerRef.trim()) {
      setError('Enter phone or customer ID.');
      return;
    }
    if (!num || num <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (pin.length !== 4) {
      setError('Enter your 4-digit Transaction PIN.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await onPayBill({
        title: `${provider} (${customerRef.trim()})`,
        counterparty: provider,
        accountNumber: customerRef.trim(),
        amount: num,
        category: service,
        carrier: provider.toLowerCase(),
        pin,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.transaction) {
        onOpenModal({ kind: 'receipt', transaction: res.transaction });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModalHeader
        title={titles[service]}
        subtitle={`Wallet Balance: ${formatNaira(balance)}`}
        onClose={onClose}
      />
      <form onSubmit={handlePay} className="p-5 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
          {providers[service].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
                provider === p
                  ? 'bg-[#BA7E44] text-white'
                  : 'bg-[#F4F6F8] text-[#1A1D23] hover:bg-[#F5EBDD]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {service === 'tv'
              ? 'Smartcard / IUC Number'
              : service === 'betting'
              ? 'Betting User ID'
              : 'Phone Number'}
          </label>
          <input
            type="text"
            value={customerRef}
            onChange={(e) => setCustomerRef(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        {service === 'data' ? (
          <div className="grid grid-cols-2 gap-2">
            {dataPlans.map((plan) => (
              <button
                key={plan.label}
                type="button"
                onClick={() => setAmount(plan.price)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  amount === plan.price
                    ? 'bg-[#F5EBDD] border-[#BA7E44]'
                    : 'bg-[#F4F6F8] border-transparent'
                }`}
              >
                <div className="text-xs font-semibold text-[#1A1D23]">{plan.label}</div>
                <div className="text-xs font-bold text-[#BA7E44] tabular-nums mt-0.5">
                  {formatNaira(Number(plan.price), false)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₦)</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['500', '1000', '2000', '5000'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`h-8 rounded-lg text-xs font-semibold tabular-nums ${
                    amount === preset
                      ? 'bg-[#BA7E44] text-white'
                      : 'bg-[#F4F6F8] text-[#1A1D23]'
                  }`}
                >
                  ₦{Number(preset).toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-base font-bold tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">4-Digit Transaction PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
            placeholder="••••"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm font-mono-tabular tracking-[0.4em] outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {submitting ? 'Processing Payment...' : `Pay ${formatNaira(Number(amount || 0))}`}
        </button>
      </form>
    </>
  );
};

const TransactionsSheet: React.FC<ActionModalsProps> = ({
  transactions,
  onOpenModal,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [query, setQuery] = useState('');

  const filtered = transactions.filter((tx) => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (
      query.trim() &&
      !tx.title.toLowerCase().includes(query.toLowerCase()) &&
      !tx.counterparty.toLowerCase().includes(query.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <>
      <ModalHeader title="Transactions" subtitle={`${transactions.length} recorded entries`} onClose={onClose} />
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipient or bill..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
            />
          </div>
          <div className="flex bg-[#F4F6F8] p-1 rounded-xl shrink-0">
            {(['all', 'credit', 'debit'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filter === tab ? 'bg-white text-[#BA7E44] shadow-xs' : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.map((tx) => (
            <button
              key={tx.id}
              type="button"
              onClick={() => onOpenModal({ kind: 'receipt', transaction: tx })}
              className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F9FAFB] rounded-xl px-2 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'credit'
                      ? 'bg-[#F5EBDD] text-[#BA7E44]'
                      : 'bg-[#F4F6F8] text-[#1A1D23]'
                  }`}
                >
                  {tx.type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[#1A1D23] truncate">
                    {tx.title}
                  </div>
                  <div className="text-[11.5px] text-gray-500">{tx.timestamp}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`text-[13.5px] font-bold tabular-nums ${
                    tx.type === 'credit' ? 'text-[#BA7E44]' : 'text-[#1A1D23]'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '-'}
                  {formatNaira(tx.amount)}
                </div>
                <div className="text-[11px] text-[#BA7E44] font-medium">{tx.status}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No matching transactions.</p>
          )}
        </div>
      </div>
    </>
  );
};

const ReceiptSheet: React.FC<{ transaction: Transaction; onClose: () => void }> = ({
  transaction,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <ModalHeader title="Transaction Receipt" onClose={onClose} />
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="rounded-2xl bg-[#FAF7F2] p-5 text-center">
          <div className="w-11 h-11 rounded-full bg-[#BA7E44] text-white flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="mt-2.5 text-xs font-semibold text-[#9C6230] uppercase tracking-wide">
            {transaction.status}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#1A1D23] tabular-nums">
            {transaction.type === 'credit' ? '+' : '-'}
            {formatNaira(transaction.amount)}
          </div>
          <div className="mt-1 text-xs text-gray-600">{transaction.title}</div>
        </div>

        <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 text-[13px]">
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Counterparty</span>
            <span className="font-semibold text-[#1A1D23] text-right">{transaction.counterparty}</span>
          </div>
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Bank / Provider</span>
            <span className="font-medium text-[#1A1D23] text-right">{transaction.bankName}</span>
          </div>
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Account / Ref ID</span>
            <span className="font-mono-tabular font-medium text-[#1A1D23]">
              {transaction.accountNumber}
            </span>
          </div>
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Date &amp; Time</span>
            <span className="font-medium text-[#1A1D23]">{transaction.timestamp}</span>
          </div>
          <div className="px-4 py-2.5 flex justify-between items-center gap-2">
            <span className="text-gray-500">Transaction Ref</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(transaction.reference);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#BA7E44]"
            >
              {transaction.reference}
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </>
  );
};

const LoanSheet: React.FC<ActionModalsProps> = ({
  loan,
  onBorrowLoan,
  onRepayLoan,
  onClose,
}) => {
  const [amount, setAmount] = useState('25000');
  const [msg, setMsg] = useState('');

  const remainingLimit = Math.max(0, loan.eligibleLimit - loan.activeBalance);

  return (
    <>
      <ModalHeader title="E&M Pay Loan Center" subtitle="Instant cash credit up to ₦30,000" onClose={onClose} />
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="rounded-2xl bg-[#BA7E44] text-white p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/85">Available Loan Limit</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">
              {formatNaira(remainingLimit, false)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/85">Active Loan</div>
            <div className="text-base font-bold tabular-nums mt-0.5">
              {formatNaira(loan.activeBalance)}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-gray-600">Loan Amount (₦)</label>
          <input
            type="number"
            min={1000}
            max={remainingLimit || loan.activeBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-base font-bold tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
          {msg && <p className="text-xs font-medium text-red-500">{msg}</p>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                const err = onBorrowLoan(Number(amount));
                if (err) setMsg(err);
                else onClose();
              }}
              className="flex-1 h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold"
            >
              Borrow to Wallet
            </button>
            {loan.activeBalance > 0 && (
              <button
                type="button"
                onClick={() => {
                  const err = onRepayLoan(Math.min(Number(amount), loan.activeBalance));
                  if (err) setMsg(err);
                  else onClose();
                }}
                className="flex-1 h-11 rounded-xl bg-[#F5EBDD] text-[#9C6230] text-sm font-semibold"
              >
                Repay Loan
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const NotificationsSheet: React.FC<ActionModalsProps> = ({
  notifications,
  onMarkAllNotificationsRead,
  onClose,
}) => (
  <>
    <ModalHeader title="Notifications" subtitle="Account alerts & activity" onClose={onClose} />
    <div className="p-4 space-y-2.5 overflow-y-auto">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onMarkAllNotificationsRead}
          className="text-xs font-semibold text-[#BA7E44] hover:underline"
        >
          Mark all as read
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {notifications.map((item) => (
          <div key={item.id} className="py-3 flex items-start gap-3">
            <span
              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                item.read ? 'bg-gray-200' : 'bg-[#BA7E44]'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-[#1A1D23]">{item.title}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{item.time}</span>
              </div>
              <p className="text-[12.5px] text-gray-600 mt-0.5">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

const AssistantSheet: React.FC<{ initialTopic?: string; onClose: () => void }> = ({
  initialTopic,
  onClose,
}) => {
  const initialReplies: Record<string, string> = {
    'Successful but not credited':
      'NIP interbank transfers usually settle within 1–5 minutes. Share your 12-digit Transaction Reference to run an instant status trace.',
    'Erroneous Transfer':
      'If funds were sent to the wrong account, we can file an immediate recall request with the receiving bank. Provide the Transaction Reference below.',
    'Internet Fraud':
      'Your account protection is active. We can freeze outgoing transfers immediately and lock suspicious sessions.',
    'Account Theft':
      'Tap "Freeze Account" in Security Center or confirm your BVN details here to reset all device sessions immediately.',
  };

  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string }[]>(() => {
    const base: { from: 'bot' | 'user'; text: string }[] = [
      {
        from: 'bot',
        text: 'Hello! I am E&M Pay Smart Assistant. How can I help with your account today?',
      },
    ];
    if (initialTopic) {
      base.push({ from: 'user', text: initialTopic });
      base.push({
        from: 'bot',
        text: initialReplies[initialTopic] ?? 'I have opened a priority ticket for your request.',
      });
    }
    return base;
  });
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setMessages((prev) => [
      ...prev,
      { from: 'user', text },
      {
        from: 'bot',
        text: `Thanks — we logged "${text}" under your support queue. Expected response time: under 2 minutes.`,
      },
    ]);
    setInput('');
  };

  return (
    <>
      <ModalHeader title="E&M Pay Smart Assistant" subtitle="24/7 Account & Dispute Support" onClose={onClose} />
      <div className="p-4 space-y-3 overflow-y-auto max-h-[55vh]">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                m.from === 'user'
                  ? 'bg-[#BA7E44] text-white rounded-br-xs'
                  : 'bg-[#F4F6F8] text-[#1A1D23] rounded-bl-xs'
              }`}
            >
              {m.from === 'bot' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#BA7E44] mb-1">
                  <Bot className="w-3.5 h-3.5" />
                  Support Bot
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your issue or reference..."
          className="flex-1 h-10 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="w-10 h-10 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
};

const QrSheet: React.FC<{ profile: UserProfile; onClose: () => void; onPayDemo: () => void }> = ({
  profile,
  onClose,
  onPayDemo,
}) => (
  <>
    <ModalHeader title="QR Pay & Receive" subtitle="Scan or share your E&M Pay QR" onClose={onClose} />
    <div className="p-5 flex flex-col items-center space-y-4">
      <div className="p-5 rounded-3xl bg-[#F5EBDD] flex flex-col items-center">
        <div className="p-4 rounded-2xl bg-white shadow-xs">
          <QrCode className="w-36 h-36 text-[#1A1D23] stroke-[1.5]" />
        </div>
        <div className="mt-3 text-sm font-bold text-[#1A1D23]">{profile.fullName}</div>
        <div className="text-xs font-mono-tabular text-[#9C6230]">{profile.accountNumber}</div>
      </div>
      <button
        type="button"
        onClick={onPayDemo}
        className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold"
      >
        Send Money via Account / Phone
      </button>
    </div>
  </>
);

const EmailSheet: React.FC<{
  profile: UserProfile;
  onSave: (email: string) => void;
  onClose: () => void;
}> = ({ profile, onSave, onClose }) => {
  const [email, setEmail] = useState(profile.email);
  return (
    <>
      <ModalHeader title="Stay Informed" subtitle="Link email for monthly statements & security alerts" onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          onSave(email.trim());
          onClose();
        }}
        className="p-5 space-y-4"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
        />
        <button
          type="submit"
          className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold"
        >
          Save Email Address
        </button>
      </form>
    </>
  );
};

const SecuritySheet: React.FC<{
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
}> = ({ profile, onUpdateProfile, onClose }) => (
  <>
    <ModalHeader title="Security Center" subtitle="Real-time account protection" onClose={onClose} />
    <div className="p-5 space-y-3">
      <div className="p-4 rounded-2xl bg-[#F5EBDD] flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-[#BA7E44] shrink-0" />
        <div>
          <div className="text-sm font-bold text-[#1A1D23]">Account Protected</div>
          <div className="text-xs text-[#9C6230]">BVN, NIN &amp; Device Guard are active</div>
        </div>
      </div>

      <label className="p-3.5 rounded-xl bg-[#F4F6F8] flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-[#1A1D23]">Biometric Login &amp; Pay</span>
        <input
          type="checkbox"
          checked={profile.biometricsEnabled}
          onChange={(e) => onUpdateProfile({ biometricsEnabled: e.target.checked })}
          className="w-5 h-5 accent-[#BA7E44]"
        />
      </label>

      <label className="p-3.5 rounded-xl bg-[#F4F6F8] flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-[#1A1D23]">2FA High-Value Transfer Guard</span>
        <input
          type="checkbox"
          checked={profile.twoFactorEnabled}
          onChange={(e) => onUpdateProfile({ twoFactorEnabled: e.target.checked })}
          className="w-5 h-5 accent-[#BA7E44]"
        />
      </label>

      <button
        type="button"
        onClick={onClose}
        className="w-full h-11 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold"
      >
        Done
      </button>
    </div>
  </>
);

const InvitationSheet: React.FC<{ profile: UserProfile; onClose: () => void }> = ({
  profile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const code = `EMP-${profile.firstName.slice(0, 4)}82`;
  return (
    <>
      <ModalHeader title="Invitation Bonus" subtitle="Earn up to ₦6,300 inviting friends" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F5EBDD] to-[#FDF6E4] flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600">Your Referral Code</div>
            <div className="text-xl font-mono-tabular font-bold text-[#1A1D23] mt-0.5">{code}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#BA7E44] text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </>
  );
};

const LimitsSheet: React.FC<{
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
}> = ({ profile, onUpdateProfile, onClose }) => (
  <>
    <ModalHeader title="Account Limits" subtitle={`${profile.tier} Verified Account`} onClose={onClose} />
    <div className="p-5 space-y-4">
      <div className="p-4 rounded-2xl bg-[#F4F6F8] space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Single Transfer Limit</span>
          <span className="font-mono-tabular font-semibold">₦200,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Daily Transfer Limit</span>
          <span className="font-mono-tabular font-semibold text-[#BA7E44]">
            {formatNaira(profile.dailyTransferLimit, false)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Maximum Balance</span>
          <span className="font-semibold">Unlimited</span>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">Adjust Daily Limit</div>
        <input
          type="range"
          min={100000}
          max={1000000}
          step={50000}
          value={profile.dailyTransferLimit}
          onChange={(e) => onUpdateProfile({ dailyTransferLimit: Number(e.target.value) })}
          className="w-full accent-[#BA7E44]"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full h-11 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold"
      >
        Save Limit
      </button>
    </div>
  </>
);

const ProfileSheet: React.FC<{ profile: UserProfile; onClose: () => void }> = ({
  profile,
  onClose,
}) => (
  <>
    <ModalHeader title="Profile Info" subtitle="KYC & Verification Details" onClose={onClose} />
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F5EBDD]">
        <OPayLogo size={42} showTierBadge tierNumber={profile.tier.replace(/\D/g, '') || '1'} />
        <div>
          <div className="text-sm font-bold text-[#1A1D23]">{profile.fullName || profile.firstName}</div>
          <div className="text-xs text-[#9C6230] font-medium">{profile.tier} Account</div>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
        <div className="px-4 py-2.5 flex justify-between gap-2">
          <span className="text-gray-500">Account Number</span>
          <span className="font-mono-tabular font-semibold">{profile.accountNumber}</span>
        </div>
        <div className="px-4 py-2.5 flex justify-between gap-2">
          <span className="text-gray-500">Phone</span>
          <span className="font-mono-tabular">{profile.phone}</span>
        </div>
        {profile.address && (
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500 shrink-0">Address</span>
            <span className="text-right font-medium text-[#1A1D23]">{profile.address}</span>
          </div>
        )}
        {profile.dateOfBirth && (
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Date of Birth</span>
            <span className="font-mono-tabular">{profile.dateOfBirth}</span>
          </div>
        )}
        {profile.gender && (
          <div className="px-4 py-2.5 flex justify-between gap-2">
            <span className="text-gray-500">Gender</span>
            <span>{profile.gender}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full h-11 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold"
      >
        Close
      </button>
    </div>
  </>
);

const SettingsSheet: React.FC<{
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onReplaySplash: () => void;
  onClose: () => void;
}> = ({ onReplaySplash, onClose }) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      setErrorMsg('All PIN fields must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('New PIN and Confirm PIN do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await changePinApi({ currentPin, newPin, confirmPin });
      if (!res.ok) {
        setErrorMsg(res.data.error || 'Could not update security PIN.');
        return;
      }
      setSuccessMsg('Security PIN updated successfully!');
      window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setErrorMsg('Unable to reach server to update PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader title="Security Settings" subtitle="Change 4-Digit Security PIN" onClose={onClose} />
      <form onSubmit={handleSavePin} className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Current 4-Digit PIN *
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            required
            value={currentPin}
            onChange={(e) => {
              setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setErrorMsg('');
            }}
            placeholder="••••"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-center font-mono-tabular tracking-widest text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            New 4-Digit PIN *
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            required
            value={newPin}
            onChange={(e) => {
              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setErrorMsg('');
            }}
            placeholder="••••"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-center font-mono-tabular tracking-widest text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Confirm New 4-Digit PIN *
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            required
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setErrorMsg('');
            }}
            placeholder="••••"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-center font-mono-tabular tracking-widest text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
          />
        </div>

        {errorMsg && <p className="text-xs font-medium text-red-500">{errorMsg}</p>}
        {successMsg && <p className="text-xs font-medium text-emerald-600">{successMsg}</p>}

        <button
          type="submit"
          disabled={loading || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
          className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {loading ? 'Updating PIN...' : 'Save New Security PIN'}
        </button>

        <button
          type="button"
          onClick={onReplaySplash}
          className="w-full h-10 rounded-xl bg-[#F5EBDD] hover:bg-[#F5EBDD] text-[#9C6230] text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" />
          Replay E&amp;M Pay Splash Screen
        </button>
      </form>
    </>
  );
};
