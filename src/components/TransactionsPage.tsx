import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Coins,
  FileText,
  Landmark,
  Percent,
  ReceiptText,
  Search,
  Smartphone,
  Tv,
  Wifi,
  X,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { Transaction } from '../types/banking';

interface TransactionsPageProps {
  transactions: Transaction[];
  onBack: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

const TYPE_OPTIONS = [
  'All Categories',
  'Bank Deposit',
  'Transfer from',
  'Transfer to',
  'Airtime',
  'Betting',
  'Mobile Data',
  'Cash Deposit',
  'OWealth',
  'E&M Pay Card',
  'Electricity',
  'TV',
  'Remit',
  'Reversal',
  'Cash Withdraw',
  'Online Payment',
  'Add Money',
  'Savings',
  'Fixed',
  'Targets',
  'Spend & Save',
  'SafeBox',
  'USSD Charge',
  'SMS Subscription',
  'Gift Card',
  'Shield Pay',
] as const;

type TypeFilter = (typeof TYPE_OPTIONS)[number];

const STATUS_OPTIONS = [
  'All Status',
  'Successful',
  'Pending',
  'Failed',
  'To be paid',
  'Reversed',
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

function getCurrentMonthLabel(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function matchesTypeFilter(tx: Transaction, selectedType: TypeFilter): boolean {
  if (selectedType === 'All Categories') return true;

  const titleLower = tx.title.toLowerCase();
  const bankLower = tx.bankName.toLowerCase();

  switch (selectedType) {
    case 'Bank Deposit':
    case 'Cash Deposit':
    case 'Add Money':
      return tx.category === 'deposit';
    case 'Transfer from':
      return tx.category === 'transfer' && tx.type === 'credit';
    case 'Transfer to':
      return tx.category === 'transfer' && tx.type === 'debit';
    case 'Airtime':
      return tx.category === 'airtime';
    case 'Mobile Data':
      return tx.category === 'data';
    case 'Betting':
      return tx.category === 'betting';
    case 'TV':
      return tx.category === 'tv';
    case 'Electricity':
      return titleLower.includes('electricity') || titleLower.includes('power');
    case 'OWealth':
    case 'Savings':
    case 'Fixed':
    case 'Targets':
    case 'Spend & Save':
    case 'SafeBox':
      return tx.category === 'savings';
    case 'E&M Pay Card':
      return titleLower.includes('card');
    case 'Reversal':
      return tx.status === 'Reversed' || titleLower.includes('reversal');
    case 'Cash Withdraw':
      return titleLower.includes('withdraw');
    case 'Online Payment':
      return tx.category === 'transfer' || tx.category === 'tv' || tx.category === 'betting';
    case 'USSD Charge':
      return titleLower.includes('ussd');
    case 'SMS Subscription':
      return titleLower.includes('sms');
    case 'Gift Card':
      return titleLower.includes('gift');
    case 'Shield Pay':
      return titleLower.includes('shield');
    case 'Remit':
      return bankLower.includes('remit') || titleLower.includes('remit');
    default:
      return false;
  }
}

function renderTransactionIcon(tx: Transaction) {
  if (tx.category === 'loan' || tx.category === 'savings') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
        <Coins className="w-[18px] h-[18px] stroke-[2]" />
      </span>
    );
  }
  if (tx.category === 'reward') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
        <FileText className="w-[18px] h-[18px] stroke-[2]" />
      </span>
    );
  }
  if (tx.category === 'airtime') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
        <Smartphone className="w-[18px] h-[18px] stroke-[2]" />
      </span>
    );
  }
  if (tx.category === 'data') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
        <Wifi className="w-[18px] h-[18px] stroke-[2]" />
      </span>
    );
  }
  if (tx.category === 'tv' || tx.category === 'betting') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0">
        {tx.category === 'tv' ? (
          <Tv className="w-[18px] h-[18px] stroke-[2]" />
        ) : (
          <Percent className="w-[18px] h-[18px] stroke-[2]" />
        )}
      </span>
    );
  }
  if (tx.category === 'deposit' || tx.type === 'credit') {
    return (
      <span className="w-[38px] h-[38px] rounded-full bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
        {tx.category === 'deposit' ? (
          <Landmark className="w-[18px] h-[18px] stroke-[2]" />
        ) : (
          <ArrowDownLeft className="w-[18px] h-[18px] stroke-[2]" />
        )}
      </span>
    );
  }
  return (
    <span className="w-[38px] h-[38px] rounded-full bg-[#FAF7F2] text-[#BA7E44] flex items-center justify-center shrink-0">
      <ArrowUp className="w-[18px] h-[18px] stroke-[2.2]" />
    </span>
  );
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  onBack,
  onSelectTransaction,
}) => {
  const currentMonth = useMemo(() => getCurrentMonthLabel(), []);
  const [selectedType, setSelectedType] = useState<TypeFilter>('All Categories');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All Status');
  const [openDropdown, setOpenDropdown] = useState<'none' | 'types' | 'status'>('none');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const monthOptions = useMemo(() => [currentMonth, 'All Time'], [currentMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!matchesTypeFilter(tx, selectedType)) return false;
      if (selectedStatus !== 'All Status' && tx.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !tx.title.toLowerCase().includes(q) &&
          !tx.counterparty.toLowerCase().includes(q) &&
          !tx.reference.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedType, selectedStatus, searchQuery]);

  const { totalIn, totalOut } = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'credit') incoming += tx.amount;
      else outgoing += tx.amount;
    }
    return { totalIn: incoming, totalOut: outgoing };
  }, [filteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTransactions) {
      const label = tx.category.charAt(0).toUpperCase() + tx.category.slice(1);
      map.set(label, (map.get(label) ?? 0) + tx.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredTransactions]);

  const handleDownloadStatement = () => {
    if (filteredTransactions.length === 0) {
      setDownloadFeedback('No transactions to download yet.');
      window.setTimeout(() => setDownloadFeedback(null), 2200);
      return;
    }
    const headers = ['Title', 'Counterparty', 'Type', 'Amount (NGN)', 'Status', 'Timestamp', 'Reference'];
    const rows = filteredTransactions.map((tx) => [
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.counterparty.replace(/"/g, '""')}"`,
      tx.type,
      tx.amount.toFixed(2),
      tx.status,
      `"${tx.timestamp}"`,
      tx.reference,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `E&M_Pay_Transactions_${selectedMonth.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadFeedback('Statement downloaded');
    window.setTimeout(() => setDownloadFeedback(null), 2200);
  };

  const typesButtonLabel = selectedType === 'All Categories' ? 'All Types' : selectedType;
  const statusButtonLabel = selectedStatus;

  return (
    <div className="fixed inset-0 z-40 bg-[#F5F6F8] flex flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[18px] font-normal text-[#374151] tracking-tight">
            Transactions
          </h1>
        </div>

        <button
          type="button"
          onClick={handleDownloadStatement}
          className="min-h-[40px] px-2 flex items-center text-[15px] font-medium text-[#BA7E44] hover:text-[#9C6230] transition-colors"
        >
          Download
        </button>
      </header>

      {/* Filter Pills Bar */}
      <div className="relative z-30 shrink-0 bg-[#F5F6F8] px-3.5 pt-2.5 pb-2">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {/* All Types Trigger */}
          <button
            type="button"
            onClick={() =>
              setOpenDropdown((prev) => (prev === 'types' ? 'none' : 'types'))
            }
            className={`flex-1 min-w-0 h-[40px] px-3 rounded-xl bg-white flex items-center justify-center gap-1.5 text-[13.5px] font-medium transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
              openDropdown === 'types' || selectedType !== 'All Categories'
                ? 'text-[#BA7E44]'
                : 'text-[#374151]'
            }`}
          >
            <span className="truncate">{typesButtonLabel}</span>
            {openDropdown === 'types' ? (
              <ChevronUp className="w-3.5 h-3.5 fill-current shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 fill-current shrink-0 text-gray-500" />
            )}
          </button>

          {/* All Status Trigger */}
          <button
            type="button"
            onClick={() =>
              setOpenDropdown((prev) => (prev === 'status' ? 'none' : 'status'))
            }
            className={`flex-1 min-w-0 h-[40px] px-3 rounded-xl bg-white flex items-center justify-center gap-1.5 text-[13.5px] font-medium transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
              openDropdown === 'status' || selectedStatus !== 'All Status'
                ? 'text-[#BA7E44]'
                : 'text-[#374151]'
            }`}
          >
            <span className="truncate">{statusButtonLabel}</span>
            {openDropdown === 'status' ? (
              <ChevronUp className="w-3.5 h-3.5 fill-current shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 fill-current shrink-0 text-gray-500" />
            )}
          </button>

          {/* Filter / Search Toggle Button */}
          <button
            type="button"
            aria-label="Search or filter transactions"
            onClick={() => {
              setOpenDropdown('none');
              setShowSearchBar((v) => !v);
            }}
            className={`w-[40px] h-[40px] rounded-xl bg-white flex items-center justify-center shrink-0 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
              showSearchBar || searchQuery ? 'text-[#BA7E44]' : 'text-[#374151]'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
              <path d="M4 6h16" />
              <path d="M7 12h10" />
              <path d="M10 18h4" />
            </svg>
          </button>
        </div>

        {/* Optional Search Strip when right filter icon is tapped */}
        {showSearchBar && (
          <div className="max-w-2xl mx-auto mt-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient, airtime, reference..."
              autoFocus
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-white text-[13.5px] text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/30 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area + Dropdown Backdrop */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* All Types Dropdown Panel (Exact layout from Screenshot 1) */}
        {openDropdown === 'types' && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/45"
              onClick={() => setOpenDropdown('none')}
            />
            <div className="absolute top-0 inset-x-0 z-30 bg-white rounded-b-[20px] shadow-xl px-4 pt-3 pb-5 max-h-[75vh] overflow-y-auto">
              <div className="max-w-2xl mx-auto flex flex-wrap gap-2.5">
                {TYPE_OPTIONS.map((opt) => {
                  const active = selectedType === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedType(opt);
                        setOpenDropdown('none');
                      }}
                      className={`px-3.5 py-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#F5EBDD] text-[#BA7E44]'
                          : 'bg-[#F7F8FA] text-[#374151] hover:bg-[#EFF2F5]'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* All Status Dropdown Panel (Exact layout from Screenshot 2) */}
        {openDropdown === 'status' && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/45"
              onClick={() => setOpenDropdown('none')}
            />
            <div className="absolute top-0 inset-x-0 z-30 bg-white rounded-b-[20px] shadow-xl px-4 pt-3 pb-5">
              <div className="max-w-2xl mx-auto flex flex-wrap gap-2.5">
                {STATUS_OPTIONS.map((status) => {
                  const active = selectedStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(status);
                        setOpenDropdown('none');
                      }}
                      className={`px-4 py-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#F5EBDD] text-[#BA7E44]'
                          : 'bg-[#F7F8FA] text-[#374151] hover:bg-[#EFF2F5]'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Scrollable Transaction History Card (Exact layout from Screenshot 3) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-6">
          <div className="max-w-2xl mx-auto bg-white rounded-[18px] p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
            {/* Month Picker + Analysis Pill + In/Out Summary */}
            <div className="pb-3 border-b border-gray-100/80">
              <div className="flex items-center justify-between gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMonthMenu((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-[18px] font-semibold text-[#1A1D23] hover:text-[#BA7E44] transition-colors"
                  >
                    <span>{selectedMonth}</span>
                    <ChevronDown className="w-4 h-4 fill-current text-[#374151]" />
                  </button>

                  {showMonthMenu && (
                    <div className="absolute left-0 top-9 z-20 w-40 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 space-y-1">
                      {monthOptions.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setSelectedMonth(m);
                            setShowMonthMenu(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-[13px] font-medium ${
                            selectedMonth === m
                              ? 'bg-[#F5EBDD] text-[#BA7E44]'
                              : 'text-[#374151] hover:bg-[#F5F6F8]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAnalysis(true)}
                  className="px-4 py-1.5 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white text-[13px] font-semibold transition-all"
                >
                  Analysis
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-5 text-[13px] tabular-nums">
                <div>
                  <span className="text-[#9CA3AF]">In: </span>
                  <span className="font-semibold text-[#1A1D23]">{formatNaira(totalIn)}</span>
                </div>
                <div>
                  <span className="text-[#9CA3AF]">Out: </span>
                  <span className="font-semibold text-[#1A1D23]">{formatNaira(totalOut)}</span>
                </div>
              </div>
            </div>

            {/* Real User Transactions List (Zero Fake History) */}
            {filteredTransactions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                <span className="w-12 h-12 rounded-full bg-[#F5F6F8] text-gray-400 flex items-center justify-center mb-3">
                  <ReceiptText className="w-6 h-6" />
                </span>
                <div className="text-[15px] font-semibold text-[#1A1D23]">
                  {transactions.length === 0
                    ? 'No transactions yet'
                    : 'No matching transactions'}
                </div>
                <p className="mt-1 text-[12.5px] text-gray-400 max-w-xs">
                  {transactions.length === 0
                    ? 'Your deposits, transfers, airtime, data, and loan activities will appear here once you transact.'
                    : 'Try switching All Types or All Status to view other recorded transactions.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100/70">
                {filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit';
                  const statusTone =
                    tx.status === 'Successful'
                      ? 'bg-[#F5EBDD] text-[#BA7E44]'
                      : tx.status === 'Pending' || tx.status === 'To be paid'
                      ? 'bg-[#FEF3C7] text-[#D97706]'
                      : 'bg-[#FFE4E6] text-[#E11D48]';

                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => onSelectTransaction(tx)}
                      className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F9FAFB] rounded-xl px-1 -mx-1 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderTransactionIcon(tx)}
                        <div className="min-w-0">
                          <div className="text-[14.5px] font-medium text-[#1A1D23] truncate">
                            {tx.title}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[#9CA3AF] truncate">
                            {tx.timestamp}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-[15px] font-bold tabular-nums leading-snug ${
                            isCredit ? 'text-[#BA7E44]' : 'text-[#1A1D23]'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatNaira(tx.amount)}
                        </div>
                        <span
                          className={`mt-1 inline-block px-1.5 py-[1px] rounded-[4px] text-[10.5px] font-medium leading-tight ${statusTone}`}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Toast Feedback */}
      {downloadFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1A1D23] text-white text-xs font-semibold shadow-lg whitespace-nowrap">
          {downloadFeedback}
        </div>
      )}

      {/* Transaction Analysis Bottom Sheet */}
      {showAnalysis && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAnalysis(false);
          }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-[#1A1D23]">
                  Transaction Analysis ({selectedMonth})
                </h3>
                <p className="text-xs text-gray-500">
                  {filteredTransactions.length} recorded transaction
                  {filteredTransactions.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close analysis"
                onClick={() => setShowAnalysis(false)}
                className="w-8 h-8 rounded-full bg-[#F4F6F8] flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F5EBDD] p-3.5">
                <div className="text-xs font-medium text-[#9C6230]">Total Inflow</div>
                <div className="mt-1 text-[18px] font-bold text-[#BA7E44] tabular-nums">
                  +{formatNaira(totalIn)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#F5F6F8] p-3.5">
                <div className="text-xs font-medium text-gray-500">Total Outflow</div>
                <div className="mt-1 text-[18px] font-bold text-[#1A1D23] tabular-nums">
                  -{formatNaira(totalOut)}
                </div>
              </div>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                No transactions to analyze yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {categoryBreakdown.map(([cat, total]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm"
                  >
                    <span className="font-medium text-[#374151]">{cat}</span>
                    <span className="font-bold text-[#1A1D23] tabular-nums">
                      {formatNaira(total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
