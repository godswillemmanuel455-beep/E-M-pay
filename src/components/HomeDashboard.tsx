import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Gamepad2,
  Gift,
  Headset,
  Landmark,
  LayoutGrid,
  Lock,
  Mail,
  MessageSquareText,
  PiggyBank,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Tv,
  Wifi,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { ModalType, NavTab, Transaction, UserProfile } from '../types/banking';

interface HomeDashboardProps {
  profile: UserProfile;
  balance: number;
  earnedToday: number;
  businessSalesToday: number;
  activeLoanBalance?: number;
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  latestTransaction: Transaction | undefined;
  unreadNotifications: number;
  onOpenModal: (modal: ModalType) => void;
  onSwitchTab: (tab: NavTab) => void;
  onRefresh?: () => Promise<void> | void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  balance,
  earnedToday,
  businessSalesToday,
  hideBalance,
  onToggleHideBalance,
  latestTransaction,
  unreadNotifications,
  onOpenModal,
  onSwitchTab,
  onRefresh,
}) => {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const touchStartY = useRef<number | null>(null);

  const banners = [
    {
      badge: '🎄 Season\'s Greetings • Christmas Edition',
      title: 'Christmas Welcome to E&M Pay',
      desc: 'Celebrate this festive season with seamless, instant zero-fee transfers to any Nigerian bank, automated bill payments, and secure 4-digit PIN banking.',
      actionLabel: 'Send Money to Bank',
      actionModal: { kind: 'transfer', mode: 'bank' } as ModalType,
      bg: 'from-[#2D1B0E] via-[#4A2D16] to-[#7A4B22]',
    },
    {
      badge: '⚡ Instant Airtime & Data VTU',
      title: 'VTU Airtime & Data Cashback',
      desc: 'Top up MTN, Airtel, Glo, and 9mobile instantly with guaranteed 1% instant cashback rewards credited straight to your balance.',
      actionLabel: 'Buy Airtime / Data',
      actionModal: { kind: 'bills', service: 'airtime' } as ModalType,
      bg: 'from-[#1B2A4A] via-[#1E3A8A] to-[#3B82F6]',
    },
    {
      badge: '🛡️ Bank-Grade Security',
      title: 'AES-256 Wallet Protection',
      desc: 'Your funds and personal profile are secured with biometric authentication, 2FA guardrails, and real-time transaction alerts.',
      actionLabel: 'Security Center',
      actionModal: { kind: 'security' } as ModalType,
      bg: 'from-[#064E3B] via-[#047857] to-[#10B981]',
    },
    {
      badge: '💸 Instant NIP Clearing',
      title: 'Real-Time Interbank Transfers',
      desc: 'Deposit from any bank via your permanent funding account and transfer to all Nigerian commercial banks and microfinance institutions instantly.',
      actionLabel: 'Add Money',
      actionModal: { kind: 'add-money' } as ModalType,
      bg: 'from-[#311039] via-[#581C87] to-[#7C3AED]',
    },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 5) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      const damped = Math.min(85, Math.pow(diff, 0.85));
      setPullY(damped);
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current === null || isRefreshing) return;
    const thresholdMet = pullY >= 50;
    touchStartY.current = null;
    if (thresholdMet && onRefresh) {
      setIsRefreshing(true);
      setPullY(50);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const primaryActions = [
    {
      label: 'To E&M',
      icon: MessageSquareText,
      onClick: () => onOpenModal({ kind: 'transfer', mode: 'opay' }),
    },
    {
      label: 'To Bank',
      icon: Landmark,
      onClick: () => onOpenModal({ kind: 'transfer', mode: 'bank' }),
    },
    {
      label: 'Save',
      icon: PiggyBank,
      onClick: () => onSwitchTab('wealth'),
    },
    {
      label: 'Cards',
      icon: CreditCard,
      onClick: () => onSwitchTab('cards'),
    },
  ];

  const serviceGrid = [
    {
      label: 'Airtime',
      icon: Smartphone,
      onClick: () => onOpenModal({ kind: 'bills', service: 'airtime' }),
    },
    {
      label: 'Data',
      icon: Wifi,
      onClick: () => onOpenModal({ kind: 'bills', service: 'data' }),
    },
    {
      label: 'Betting',
      icon: Gamepad2,
      onClick: () => onOpenModal({ kind: 'bills', service: 'betting' }),
    },
    {
      label: 'TV',
      icon: Tv,
      onClick: () => onOpenModal({ kind: 'bills', service: 'tv' }),
    },
    {
      label: 'Fixed',
      icon: Lock,
      onClick: () => onSwitchTab('wealth'),
    },
    {
      label: 'Cards',
      icon: CreditCard,
      onClick: () => onSwitchTab('cards'),
    },
    {
      label: 'Invitation',
      icon: Gift,
      onClick: () => onOpenModal({ kind: 'invitation' }),
    },
    {
      label: 'More',
      icon: LayoutGrid,
      onClick: () => onOpenModal({ kind: 'more-services' }),
    },
  ];

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="pb-24 pt-2 max-w-5xl mx-auto"
    >
      {/* Pull To Refresh Animated Indicator Banner */}
      {(pullY > 0 || isRefreshing) && (
        <div
          style={{ height: `${isRefreshing ? 48 : pullY}px` }}
          className="overflow-hidden transition-[height] duration-150 ease-out flex items-center justify-center bg-[#F5EBDD] text-[#9C6230] border-b border-[#BA7E44]/20 rounded-2xl mx-4 lg:mx-0 mb-2 shadow-xs"
        >
          <div className="flex items-center gap-2 text-[12.5px] font-semibold py-2">
            <RefreshCw
              className={`w-4 h-4 text-[#BA7E44] ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${pullY * 4}deg)`,
              }}
            />
            <span>
              {isRefreshing
                ? 'Refreshing balances & deposits...'
                : pullY >= 50
                ? 'Release to refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="px-4 lg:px-0 py-3 flex items-center justify-between gap-3">
        {/* User Identity / Avatar */}
        <button
          type="button"
          onClick={() => onOpenModal({ kind: 'profile' })}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity"
        >
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#BA7E44] to-[#9C6230] p-0.5 shadow-sm shrink-0">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-[#BA7E44] text-sm">
              {profile.firstName ? profile.firstName.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#BA7E44] text-white text-[9px] font-bold border border-white">
              2
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-extrabold text-[#1A1D23] uppercase truncate tracking-tight">
                Hi, {profile.firstName || 'EMMANUEL'}
              </span>
            </div>
          </div>
        </button>

        {/* Right Header Icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Dashboard"
            title="Refresh balance and transactions"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-[#1A1D23] disabled:opacity-60"
          >
            <RefreshCw
              className={`w-[19px] h-[19px] stroke-[2] ${
                isRefreshing ? 'animate-spin text-[#BA7E44]' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'assistant' })}
            aria-label="Customer Support"
            className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-[#1A1D23]"
          >
            <Headset className="w-[21px] h-[21px] stroke-[1.9]" />
            <span className="absolute -top-1 -right-0.5 px-1 py-[1px] rounded-full bg-[#FFE4E6] text-[#F43F5E] text-[8px] font-bold leading-none tracking-tight">
              HELP
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'qr' })}
            aria-label="Scan QR Code"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-[#1A1D23]"
          >
            <QrCode className="w-[21px] h-[21px] stroke-[1.9]" />
          </button>

          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'notifications' })}
            aria-label="Notifications"
            className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-[#1A1D23]"
          >
            <Bell className="w-[21px] h-[21px] stroke-[1.9]" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-0.5 min-w-[18px] px-1 py-[1.5px] rounded-full bg-[#EF4444] text-white text-[9px] font-bold leading-none text-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Responsive Dashboard Grid */}
      <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start">
        {/* Left Column */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Compact Caramel Balance Card + Attached Recent Strip */}
          <section aria-label="Account Balance" className="rounded-[20px] overflow-hidden shadow-[0_4px_14px_rgba(186,126,68,0.16)]">
            <div className="bg-gradient-to-r from-[#BA7E44] to-[#9C6230] text-white px-4 pt-3 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-white/95">Available Balance</span>
                  <button
                    type="button"
                    onClick={onToggleHideBalance}
                    aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
                    className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
                  >
                    {hideBalance ? (
                      <EyeOff className="w-3.5 h-3.5 text-white/90" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-white/90" />
                    )}
                  </button>
                </div>

                {/* Normal compact Add Money button */}
                <button
                  type="button"
                  onClick={() => onOpenModal({ kind: 'add-money' })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-white/95 active:scale-[0.98] text-[11px] font-bold text-[#9C6230] transition-all shadow-xs whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Add Money</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'transactions' })}
                className="mt-1.5 flex items-center gap-1.5 text-left group"
              >
                <span className="text-[24px] sm:text-[26px] font-extrabold tracking-tight tabular-nums leading-none font-mono-tabular">
                  {hideBalance ? '****' : formatNaira(balance)}
                </span>
                <ChevronRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="text-[12px] font-medium text-white/90 tabular-nums">
                  Earned Today{' '}
                  <span className="font-bold text-white">
                    {hideBalance ? '****' : formatNaira(earnedToday)}
                  </span>
                </div>
              </div>
            </div>

            {/* Attached Latest Transaction Strip */}
            <div className="bg-[#F5EBDD] px-4 py-2.5 flex items-center justify-between gap-2 border-t border-[#F0E5D8]">
              <button
                type="button"
                onClick={() =>
                  latestTransaction
                    ? onOpenModal({ kind: 'receipt', transaction: latestTransaction })
                    : onOpenModal({ kind: 'transactions' })
                }
                className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity"
              >
                {latestTransaction?.status === 'Pending' ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                ) : latestTransaction?.status === 'Reversed' ? (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#BA7E44] shrink-0" />
                )}
                <span className="text-[12.5px] font-medium text-[#1A1D23] truncate">
                  {latestTransaction ? latestTransaction.title : 'No transactions yet'}
                </span>
                {latestTransaction && (
                  <span className="text-[12.5px] font-bold text-[#1A1D23] tabular-nums whitespace-nowrap shrink-0">
                    {latestTransaction.type === 'debit' ? '-' : '+'}
                    {formatNaira(latestTransaction.amount)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'transactions' })}
                className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-[#BA7E44] hover:text-[#9C6230] whitespace-nowrap shrink-0 transition-colors"
              >
                Transactions
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Business Service Bar */}
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'business' })}
            className="w-full bg-white rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)] hover:shadow-[0_2px_8px_rgba(15,23,42,0.07)] transition-shadow text-left border border-gray-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#F5EBDD] flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-[#BA7E44]" />
              </span>
              <span className="text-[13.5px] font-medium text-[#1A1D23] truncate">
                Business Service - Today&apos;s Sales:{' '}
                <span className="text-[#BA7E44] font-bold tabular-nums">
                  {formatNaira(businessSalesToday)}
                </span>
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>

          {/* 4 Primary Quick Actions Card */}
          <section
            aria-label="Quick Actions"
            className="bg-white rounded-[20px] px-3 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] grid grid-cols-4 gap-2 border border-gray-100"
          >
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex flex-col items-center justify-center gap-2 min-h-[44px] py-1.5 rounded-xl hover:bg-[#F5EBDD]/50 active:scale-[0.97] transition-all group"
                >
                  <span className="w-12 h-12 rounded-[16px] bg-[#F5EBDD] group-hover:bg-[#EBDDC9] flex items-center justify-center transition-colors">
                    <Icon className="w-[22px] h-[22px] text-[#BA7E44] stroke-[2]" />
                  </span>
                  <span className="text-[13px] font-semibold text-[#1A1D23] whitespace-nowrap">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </section>

          {/* Email Alert Banner */}
          <section className="relative bg-white rounded-[20px] px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] flex items-center justify-between gap-3 border border-gray-100">
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'email' })}
              className="flex items-center gap-3.5 min-w-0 flex-1 text-left group"
            >
              <div className="relative w-12 h-12 rounded-2xl bg-[#EEF4FF] flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-[#3B82F6]" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#BA7E44] text-white flex items-center justify-center text-[9px] font-bold">
                  !
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-[14.5px] font-bold text-[#1A1D23] truncate group-hover:text-[#BA7E44] transition-colors">
                  {profile.email ? 'Email Alerts Active' : 'Take Control, Stay Informed'}
                </h2>
                <p className="text-[12.5px] text-gray-500 truncate mt-0.5">
                  {profile.email
                    ? `Statements & alerts sent to ${profile.email}`
                    : 'Add your email, get the latest from E&M Pay'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'security' })}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.97] text-white text-[12px] font-bold shadow-[0_4px_12px_rgba(186,126,68,0.25)] transition-all whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              Security
            </button>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* 8-Item Services Grid Card */}
          <section
            aria-label="Bills and Financial Services"
            className="bg-white rounded-[20px] px-3 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] grid grid-cols-4 gap-y-4 gap-x-2 border border-gray-100"
          >
            {serviceGrid.map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.label}
                  type="button"
                  onClick={service.onClick}
                  className="flex flex-col items-center justify-center gap-1.5 min-h-[44px] py-1 rounded-xl hover:bg-[#F5EBDD]/50 active:scale-[0.97] transition-all group"
                >
                  <span className="w-11 h-11 rounded-full bg-[#F5EBDD] group-hover:bg-[#EBDDC9] flex items-center justify-center transition-colors">
                    <Icon className="w-[20px] h-[20px] text-[#BA7E44] stroke-[2]" />
                  </span>
                  <span className="text-[12px] font-semibold text-[#1A1D23] whitespace-nowrap">
                    {service.label}
                  </span>
                </button>
              );
            })}
          </section>

          {/* Dynamic Auto-Sliding Promo & Welcome Banners (Slides every 3 secs) */}
          <section className={`rounded-[20px] bg-gradient-to-br ${banners[bannerIndex].bg} text-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(45,27,14,0.18)] relative overflow-hidden transition-all duration-500`}>
            {/* Ambient glowing aura */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-4 -top-4 w-28 h-28 rounded-full bg-white/10 blur-xl"
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold text-white tracking-wide uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>{banners[bannerIndex].badge}</span>
                </div>

                {/* Dot Pagination Indicators */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBannerIndex(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === bannerIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <h3 className="mt-2.5 text-[17px] sm:text-[18px] font-black tracking-tight text-white leading-snug">
                {banners[bannerIndex].title}
              </h3>
              <p className="mt-1 text-[12.5px] text-white/90 leading-relaxed min-h-[36px]">
                {banners[bannerIndex].desc}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => onOpenModal(banners[bannerIndex].actionModal)}
                  className="px-3.5 py-1.5 rounded-full bg-white text-[#1A1D23] hover:bg-white/90 text-[12px] font-bold shadow-xs active:scale-[0.98] transition-all"
                >
                  {banners[bannerIndex].actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal({ kind: 'security' })}
                  className="px-3.5 py-1.5 rounded-full bg-white/25 hover:bg-white/35 text-white text-[12px] font-semibold active:scale-[0.98] transition-all"
                >
                  Security &amp; PIN
                </button>
              </div>
            </div>
          </section>

          {/* Welcome to E&M Pay Digital Banking Banner */}
          <div className="w-full rounded-[20px] p-4 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] border border-gray-100 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-[#F5EBDD] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#BA7E44]" />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#1A1D23] truncate">
                  Welcome to E&amp;M Pay Digital Banking
                </div>
                <div className="text-[12px] text-gray-500 truncate mt-0.5">
                  Safe, verified 4-digit PIN authentication &amp; 24/7 instant NIP clearing.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'security' })}
              className="px-3 py-1.5 rounded-full bg-[#F5EBDD] hover:bg-[#BA7E44] text-[#9C6230] hover:text-white text-xs font-bold shrink-0 transition-colors"
            >
              Security
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
