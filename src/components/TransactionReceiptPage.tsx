import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  Headset,
  History,
  Image as ImageIcon,
  MessageCircle,
  Printer,
  RefreshCw,
  Share2,
  Store,
  X,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { Transaction, UserProfile } from '../types/banking';
import {
  formatReceiptParties,
  generateReceiptPdfBlob,
  generateReceiptPngBlob,
  RECEIPT_THEMES,
  triggerBlobDownload,
  type ReceiptThemeId,
} from '../utils/receiptExport';
import { OPayLogo } from './OPayLogo';

interface TransactionReceiptPageProps {
  transaction: Transaction;
  profile: UserProfile;
  onBack: () => void;
  onReportIssue: (transaction: Transaction) => void;
  onTransferAgain: (transaction: Transaction) => void;
  onViewRecords: () => void;
  onRefreshStatus?: (transaction: Transaction) => Promise<void>;
}

function getCategoryLabel(tx: Transaction): string {
  switch (tx.category) {
    case 'transfer':
      return 'Transfers';
    case 'deposit':
      return 'Add Money';
    case 'airtime':
    case 'data':
    case 'tv':
    case 'betting':
      return 'Bills & Utilities';
    case 'savings':
      return 'Savings & Wealth';
    case 'loan':
      return 'Loan Center';
    case 'reward':
      return 'Rewards & Bonus';
    default:
      return 'Transactions';
  }
}

function formatSpacedAccount(acct: string): string {
  const clean = (acct || '').trim();
  if (/^\d{10}$/.test(clean)) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return clean;
}

export const TransactionReceiptPage: React.FC<TransactionReceiptPageProps> = ({
  transaction,
  profile,
  onBack,
  onReportIssue,
  onTransferAgain,
  onViewRecords,
  onRefreshStatus,
}) => {
  const [view, setView] = useState<'details' | 'share'>('details');
  const [copiedRef, setCopiedRef] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [themeId, setThemeId] = useState<ReceiptThemeId>('default');
  const [busyMode, setBusyMode] = useState<'image' | 'pdf' | null>(null);
  const [shareSheet, setShareSheet] = useState<{
    kind: 'image' | 'pdf';
    filename: string;
    blob: Blob;
    previewUrl?: string;
    copiedText?: boolean;
  } | null>(null);

  const parties = useMemo(
    () => formatReceiptParties(transaction, profile),
    [transaction, profile]
  );

  const activeTheme = useMemo(
    () => RECEIPT_THEMES.find((t) => t.id === themeId) ?? RECEIPT_THEMES[0],
    [themeId]
  );

  const displayBankName = transaction.bankName.includes('FastDL')
    ? 'FastDL Bank'
    : transaction.bankName;

  const isSuccess = transaction.status === 'Successful';
  const isPending = transaction.status === 'Pending' || transaction.status === 'To be paid';

  useEffect(() => {
    if (!isPending || !onRefreshStatus) return;
    const interval = window.setInterval(() => {
      void onRefreshStatus(transaction);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [isPending, onRefreshStatus, transaction]);

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(transaction.reference);
    setCopiedRef(true);
    window.setTimeout(() => setCopiedRef(false), 1600);
  };

  const shareSummaryText = `FastDL Bank Transaction Receipt\nAmount: ${formatNaira(
    transaction.amount
  )}\nStatus: ${transaction.status}\nTo: ${parties.recipientName} (${
    parties.recipientSub
  })\nRef: ${transaction.reference}\nDate: ${transaction.timestamp}`;

  const handleShareAsImage = async () => {
    setBusyMode('image');
    try {
      const { blob, dataUrl } = await generateReceiptPngBlob(
        transaction,
        profile,
        themeId
      );
      const filename = `em-pay-receipt-${transaction.reference}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: 'E&M Pay Transaction Receipt',
            text: shareSummaryText,
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
        }
      }

      // Clean fallback sheet for desktop / environments where native share sheet isn't supported
      triggerBlobDownload(blob, filename);
      setShareSheet({
        kind: 'image',
        filename,
        blob,
        previewUrl: dataUrl,
      });
    } finally {
      setBusyMode(null);
    }
  };

  const handleShareAsPdf = async () => {
    setBusyMode('pdf');
    try {
      const blob = generateReceiptPdfBlob(transaction, profile, themeId);
      const filename = `em-pay-receipt-${transaction.reference}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: 'E&M Pay Transaction Receipt (PDF)',
            text: shareSummaryText,
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
        }
      }

      triggerBlobDownload(blob, filename);
      setShareSheet({
        kind: 'pdf',
        filename,
        blob,
      });
    } finally {
      setBusyMode(null);
    }
  };

  if (view === 'share') {
    return (
      <div className="fixed inset-0 z-50 bg-[#F5F6F8] flex flex-col overflow-hidden select-none">
        {/* Top Header matching Screenshot 2 */}
        <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setView('details')}
              aria-label="Back to transaction details"
              className="min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors shrink-0"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2]" />
            </button>
            <h1 className="text-[17px] font-semibold text-[#1A1D23] truncate">
              Share Receipt
            </h1>
          </div>
        </header>

        {/* Scrollable Receipt Card Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="max-w-md mx-auto">
            <div
              className="relative rounded-md shadow-[0_6px_24px_rgba(15,23,42,0.06)] overflow-hidden"
              style={{ backgroundColor: activeTheme.tintBg }}
            >
              {/* Scalloped Top Edge */}
              <div
                aria-hidden="true"
                className="h-3 w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 12px 0px, #F5F6F8 6px, transparent 6.5px)',
                  backgroundSize: '24px 12px',
                  backgroundRepeat: 'repeat-x',
                }}
              />

              {/* Theme Top Accent Bar */}
              {activeTheme.badgeText && (
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: activeTheme.accentHex }}
                />
              )}

              {/* Subtle Diagonal Repeating Watermark */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04] flex flex-wrap gap-10 items-center justify-center -rotate-20 scale-125"
              >
                {Array.from({ length: 18 }).map((_, idx) => (
                  <span
                    key={idx}
                    className="text-[22px] font-black tracking-tight text-[#1D1B5B] whitespace-nowrap"
                  >
                    E&amp;M Pay
                  </span>
                ))}
              </div>

              {/* Receipt Paper Content */}
              <div className="relative z-10 px-5 pt-4 pb-6 space-y-5">
                {/* Brand Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <OPayLogo size={30} />
                    <span className="text-[20px] font-extrabold tracking-tight text-[#1D1B5B]">
                      E&amp;M Pay
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[13.5px] font-medium text-[#1A1D23]">
                      Transaction Receipt
                    </div>
                    {activeTheme.badgeText && (
                      <div
                        className="text-[10px] font-bold tracking-wider uppercase"
                        style={{ color: activeTheme.accentHex }}
                      >
                        {activeTheme.badgeText}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount + Status + Date */}
                <div className="text-center pt-1 pb-2 border-b border-gray-200/80">
                  <div className="text-[28px] font-extrabold text-[#BA7E44] tabular-nums leading-tight">
                    {formatNaira(transaction.amount)}
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-[#1A1D23]">
                    {transaction.status}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-gray-500">
                    {transaction.timestamp}
                  </div>
                </div>

                {/* Parties & Transaction No */}
                <div className="space-y-4 text-[13px]">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-500 shrink-0">Recipient Details</span>
                    <div className="text-right min-w-0">
                      <div className="font-bold text-[#1A1D23] uppercase break-words">
                        {parties.recipientName}
                      </div>
                      <div className="text-gray-600 text-[12.5px] font-mono-tabular mt-0.5">
                        {parties.recipientSub}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-500 shrink-0">Sender Details</span>
                    <div className="text-right min-w-0">
                      <div className="font-bold text-[#1A1D23] uppercase break-words">
                        {parties.senderName}
                      </div>
                      <div className="text-gray-600 text-[12.5px] font-mono-tabular mt-0.5">
                        {parties.senderSub}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-500 shrink-0">Transaction No.</span>
                    <span className="text-right font-mono-tabular font-medium text-[#1A1D23] break-all">
                      {transaction.reference}
                    </span>
                  </div>

                  {transaction.note && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-gray-500 shrink-0">Remark</span>
                      <span className="text-right text-[#1A1D23] break-words">
                        {transaction.note}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer FastDL Bank Blurb */}
                <p className="pt-3 border-t border-gray-100 text-[11.5px] leading-relaxed text-gray-500">
                  FastDL Digital Banking — Fast. Secure. Reliable. Get free instant transfers, withdrawals,
                  bill payments, high savings interest, and 24/7 account protection.
                  FastDL Bank keeps every transaction fast and secure.
                </p>
              </div>

              {/* Scalloped Bottom Edge */}
              <div
                aria-hidden="true"
                className="h-3 w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 12px 12px, #F5F6F8 6px, transparent 6.5px)',
                  backgroundSize: '24px 12px',
                  backgroundRepeat: 'repeat-x',
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Theme Picker + Share Action Bar */}
        <div className="shrink-0 bg-white border-t border-gray-100">
          {/* Theme Thumbnail Strip */}
          <div className="px-3 py-2.5 flex items-center justify-start sm:justify-center gap-2.5 overflow-x-auto no-scrollbar">
            {RECEIPT_THEMES.map((t) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`w-[68px] shrink-0 rounded-xl overflow-hidden border transition-all ${
                    active
                      ? 'border-[#BA7E44] ring-1 ring-[#BA7E44]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="h-11 flex items-center justify-center px-1"
                    style={{
                      backgroundColor:
                        t.id === 'default'
                          ? '#F8FAFC'
                          : t.id === 'chop-life'
                          ? '#BA7E44'
                          : t.id === 'urgent-2k'
                          ? '#0F172A'
                          : t.id === 'christmas'
                          ? '#9C6230'
                          : '#7C4A1E',
                    }}
                  >
                    {t.id === 'default' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#1D1B5B]">
                        <OPayLogo size={14} />
                        E&amp;M
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-extrabold text-white text-center leading-tight">
                        {t.label.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div
                    className={`py-1 text-[10.5px] font-medium text-center truncate px-1 ${
                      active
                        ? 'bg-[#F5EBDD] text-[#BA7E44]'
                        : 'bg-white text-gray-600'
                    }`}
                  >
                    {t.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Share as Image | Share as PDF Footer Bar */}
          <div className="h-[54px] border-t border-gray-100 grid grid-cols-2 items-center">
            <button
              type="button"
              onClick={handleShareAsImage}
              disabled={busyMode !== null}
              className="h-full flex items-center justify-center gap-2 text-[14.5px] font-medium text-[#BA7E44] hover:bg-[#FAF7F2] active:bg-[#F5EBDD] transition-colors disabled:opacity-60"
            >
              <ImageIcon className="w-4 h-4 stroke-[2]" />
              <span>{busyMode === 'image' ? 'Preparing Image...' : 'Share as image'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareAsPdf}
              disabled={busyMode !== null}
              className="h-full border-l border-gray-100 flex items-center justify-center gap-2 text-[14.5px] font-medium text-[#BA7E44] hover:bg-[#FAF7F2] active:bg-[#F5EBDD] transition-colors disabled:opacity-60"
            >
              <Printer className="w-4 h-4 stroke-[2]" />
              <span>{busyMode === 'pdf' ? 'Preparing PDF...' : 'Share as PDF'}</span>
            </button>
          </div>
        </div>

        {/* Share Fallback Sheet (Downloads + WhatsApp / Canva / Snap guidance on Desktop) */}
        {shareSheet && (
          <div
            className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShareSheet(null);
            }}
          >
            <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1A1D23]">
                    {shareSheet.kind === 'image'
                      ? 'Receipt Image Ready'
                      : 'Receipt PDF Ready'}
                  </h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Saved as <span className="font-mono">{shareSheet.filename}</span> — ready to
                    share to WhatsApp, Snapchat, or Canva.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareSheet(null)}
                  aria-label="Close share sheet"
                  className="w-9 h-9 rounded-full bg-[#F4F6F8] flex items-center justify-center text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {shareSheet.previewUrl && (
                <div className="max-h-56 overflow-hidden rounded-2xl border border-gray-100 bg-[#F5F6F8] flex justify-center p-2">
                  <img
                    src={shareSheet.previewUrl}
                    alt="Receipt preview"
                    className="h-52 w-auto object-contain rounded-lg shadow-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => triggerBlobDownload(shareSheet.blob, shareSheet.filename)}
                  className="h-11 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {shareSheet.kind === 'image' ? 'Download PNG Image' : 'Download PDF'}
                  </span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareSummaryText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 rounded-full bg-[#F5EBDD] hover:bg-[#F5EBDD] text-[#9C6230] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Share on WhatsApp</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareSummaryText);
                  setShareSheet((prev) => (prev ? { ...prev, copiedText: true } : prev));
                }}
                className="w-full h-10 rounded-xl bg-[#F4F6F8] hover:bg-gray-200 text-xs font-semibold text-[#1A1D23] flex items-center justify-center gap-1.5"
              >
                {shareSheet.copiedText ? (
                  <Check className="w-3.5 h-3.5 text-[#BA7E44]" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                )}
                <span>
                  {shareSheet.copiedText ? 'Receipt Text Copied!' : 'Copy Receipt Summary'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* View 1: Transaction Details (matching Screenshot 1) */
  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] flex flex-col overflow-hidden select-none">
      {/* Top App Bar */}
      <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[17px] font-semibold text-[#1A1D23] truncate">
            Transaction Details
          </h1>
        </div>

        <button
          type="button"
          onClick={() => onReportIssue(transaction)}
          aria-label="Customer support"
          className="min-w-[44px] min-h-[44px] -mr-1.5 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors shrink-0"
        >
          <Headset className="w-5 h-5 stroke-[2]" />
        </button>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-6 pb-8">
        <div className="max-w-lg mx-auto space-y-3.5">
          {/* Card 1: Top Summary with Floating Center Icon */}
          <section className="relative bg-white rounded-2xl px-5 pt-9 pb-5 text-center shadow-[0_1px_4px_rgba(15,23,42,0.04)] mt-3">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[#F5EBDD] border-2 border-white flex items-center justify-center shadow-xs">
              <Store className="w-5 h-5 text-[#1A1D23] stroke-[1.9]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#BA7E44] text-white text-[8px] font-black flex items-center justify-center border border-white">
                ✓
              </span>
            </div>

            <div className="text-[15px] font-medium text-[#1A1D23] px-2 break-words">
              {transaction.title}
            </div>

            <div className="mt-2.5 text-[32px] font-extrabold text-[#1A1D23] tabular-nums tracking-tight leading-none">
              {formatNaira(transaction.amount)}
            </div>

            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="inline-flex items-center justify-center gap-1.5">
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-[#BA7E44] fill-[#BA7E44] stroke-white" />
                ) : isPending ? (
                  <Clock className="w-4 h-4 text-amber-500" />
                ) : (
                  <FileText className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-[13.5px] font-medium ${
                    isSuccess
                      ? 'text-[#BA7E44]'
                      : isPending
                      ? 'text-amber-600'
                      : 'text-red-500'
                  }`}
                >
                  {transaction.status}
                </span>
              </div>

              {isPending &&
                onRefreshStatus &&
                transaction.reference.startsWith('EMP_TRF_') && (
                  <button
                    type="button"
                    disabled={refreshingStatus}
                    onClick={async () => {
                      setRefreshingStatus(true);
                      try {
                        await onRefreshStatus(transaction);
                      } finally {
                        setRefreshingStatus(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[11.5px] font-semibold text-[#B45309] hover:bg-[#FEF3C7] disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${refreshingStatus ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {refreshingStatus ? 'Checking...' : 'Check Live Transfer Status'}
                    </span>
                  </button>
                )}
            </div>
          </section>

          {/* Card 2: Transaction Details Key-Value Breakdown */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] space-y-3.5">
            <h2 className="text-[15.5px] font-bold text-[#1A1D23]">
              Transaction Details
            </h2>

            <div className="space-y-3.5 text-[13px]">
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500 shrink-0">
                  {transaction.type === 'credit' ? 'Sender Details' : 'Recipient Details'}
                </span>
                <div className="text-right min-w-0">
                  <div className="font-medium text-[#1A1D23] uppercase break-words">
                    {transaction.counterparty}
                  </div>
                  <div className="text-gray-600 font-mono-tabular mt-0.5">
                    {displayBankName} | {formatSpacedAccount(transaction.accountNumber)}
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500 shrink-0">Transaction No.</span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="inline-flex items-center gap-1.5 text-right font-mono-tabular font-medium text-[#1A1D23] hover:text-[#BA7E44] transition-colors break-all"
                >
                  <span>{transaction.reference}</span>
                  {copiedRef ? (
                    <Check className="w-3.5 h-3.5 text-[#BA7E44] shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 shrink-0">Payment Method</span>
                <span className="inline-flex items-center gap-1 font-medium text-[#1A1D23]">
                  <span>E&amp;M Pay Wallet</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 shrink-0">Transaction Date</span>
                <span className="font-medium text-[#1A1D23] text-right">
                  {transaction.timestamp}
                </span>
              </div>

              {transaction.note && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Remark</span>
                  <span className="font-medium text-[#1A1D23] text-right break-words">
                    {transaction.note}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: More Actions */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] space-y-3.5">
            <h2 className="text-[15.5px] font-bold text-[#1A1D23]">More Actions</h2>

            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-gray-500">Category</span>
              <button
                type="button"
                onClick={onViewRecords}
                className="inline-flex items-center gap-1 font-medium text-[#1A1D23] hover:text-[#BA7E44]"
              >
                <span>{getCategoryLabel(transaction)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            <div className="pt-3 border-t border-dashed border-gray-200 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onTransferAgain(transaction)}
                className="py-1.5 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#BA7E44] hover:underline"
              >
                <span className="w-5 h-5 rounded-full bg-[#F5EBDD] flex items-center justify-center">
                  <ArrowLeftRight className="w-3 h-3 text-[#BA7E44]" />
                </span>
                <span>
                  {transaction.category === 'deposit'
                    ? 'Add Money Again'
                    : transaction.category === 'airtime' || transaction.category === 'data'
                    ? 'Buy Again'
                    : 'Transfer Again'}
                </span>
              </button>

              <button
                type="button"
                onClick={onViewRecords}
                className="py-1.5 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#BA7E44] hover:underline"
              >
                <span className="w-5 h-5 rounded-full bg-[#F5EBDD] flex items-center justify-center">
                  <History className="w-3 h-3 text-[#BA7E44]" />
                </span>
                <span>View Records</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Fixed Bottom Action Bar: Report Issue & Share Receipt */}
      <footer className="shrink-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onReportIssue(transaction)}
            className="h-[46px] rounded-full bg-[#F5EBDD] hover:bg-[#F5EBDD] active:scale-[0.98] text-[#BA7E44] text-[14.5px] font-semibold transition-all"
          >
            Report Issue
          </button>

          <button
            type="button"
            onClick={() => setView('share')}
            className="h-[46px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white text-[14.5px] font-semibold shadow-[0_6px_16px_rgba(186,126,68,0.22)] transition-all"
          >
            Share Receipt
          </button>
        </div>
      </footer>
    </div>
  );
};
