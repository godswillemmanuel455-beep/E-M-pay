import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  Landmark,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import type { ModalType } from '../types/banking';

interface RewardsViewProps {
  cashbackBalance: number;
  checkedInToday: boolean;
  onClaimDailyCheckIn: () => void;
  onRedeemCashback: () => void;
  onOpenModal: (modal: ModalType) => void;
}

export const RewardsView: React.FC<RewardsViewProps> = ({
  onOpenModal,
}) => {
  const memberPerks = [
    {
      title: 'Zero-Fee Instant Bank Transfers',
      desc: 'Free, automated NIP transfers to all 700+ Nigerian commercial & microfinance banks',
      icon: Landmark,
      action: () => onOpenModal({ kind: 'transfer', mode: 'bank' }),
      cta: 'Transfer Now',
    },
    {
      title: 'Instant In-Network E&M Transfers',
      desc: 'Zero-delay, zero-charge money transfers to any registered E&M Pay phone number',
      icon: MessageSquareText,
      action: () => onOpenModal({ kind: 'transfer', mode: 'opay' }),
      cta: 'To E&M',
    },
    {
      title: 'Direct Telecom Airtime & Data',
      desc: 'Instant network delivery across MTN, Airtel, Glo & 9mobile with official receipts',
      icon: Smartphone,
      action: () => onOpenModal({ kind: 'bills', service: 'airtime' }),
      cta: 'Top Up',
    },
    {
      title: '4-Digit PIN & Account Security',
      desc: 'Bank-grade transfer verification, failed-attempt protection, and email alerts',
      icon: ShieldCheck,
      action: () => onOpenModal({ kind: 'security' }),
      cta: 'Security Settings',
    },
  ];

  return (
    <div className="w-full pb-8">
      <header className="px-4 lg:px-0 py-4">
        <h1 className="text-[20px] font-bold text-[#1A1D23] tracking-tight">
          Christmas Welcome &amp; Member Perks
        </h1>
        <p className="text-[12.5px] text-gray-500 mt-0.5">
          Transparent, secure digital banking benefits for the holiday season and beyond
        </p>
      </header>

      <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Holiday Hero + Account Info */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* 🎄 Christmas Welcome Hero Banner */}
          <div className="rounded-[20px] bg-gradient-to-br from-[#2D1B0E] via-[#4A2D16] to-[#7A4B22] text-white p-5 shadow-[0_4px_16px_rgba(45,27,14,0.18)] relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-[#BA7E44]/25 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-4 -top-4 w-28 h-28 rounded-full bg-[#EBDDC9]/10 blur-xl"
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold text-[#F5EBDD] tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#F5EBDD]" />
                <span>🎄 Season&apos;s Greetings</span>
              </div>

              <h2 className="mt-3 text-[20px] font-black tracking-tight text-white leading-snug">
                Welcome to E&amp;M Pay
              </h2>
              <p className="mt-1.5 text-[12.5px] text-[#F5EBDD]/90 leading-relaxed">
                Celebrate this festive season with seamless 24/7 transfers to all Nigerian banks, automated account deposits, and real money banking.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => onOpenModal({ kind: 'transfer', mode: 'bank' })}
                  className="px-4 py-2 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[12.5px] font-bold shadow-xs active:scale-[0.98] transition-all"
                >
                  Send to Bank
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal({ kind: 'add-money' })}
                  className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[12.5px] font-semibold active:scale-[0.98] transition-all"
                >
                  Fund Wallet
                </button>
              </div>
            </div>
          </div>

          {/* Dedicated Virtual Bank Account Card */}
          <div className="w-full rounded-[18px] p-4 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] border border-gray-100 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-[#F5EBDD] flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-[#BA7E44]" />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#1A1D23] truncate">
                  Dedicated Bank Account
                </div>
                <div className="text-[12px] text-gray-500 truncate mt-0.5">
                  Receive instant deposits from any Nigerian banking app
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'add-money' })}
              className="px-3.5 py-1.5 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-xs font-semibold shrink-0 transition-colors"
            >
              View
            </button>
          </div>
        </div>

        {/* Right Column: Member Perks List */}
        <div className="lg:col-span-7 bg-white rounded-[20px] p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[#1A1D23]">Official Banking Benefits</h2>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9C6230] bg-[#F5EBDD] px-2.5 py-0.5 rounded-md">
              Real Money 24/7
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {memberPerks.map((perk) => {
              const Icon = perk.icon;
              return (
                <div
                  key={perk.title}
                  className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-[14px] bg-[#F5EBDD] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#BA7E44] stroke-[2]" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#1A1D23] truncate">
                        {perk.title}
                      </div>
                      <div className="text-[12px] text-gray-500 truncate mt-0.5">
                        {perk.desc}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={perk.action}
                    className="px-3.5 py-1.5 rounded-full bg-[#F5EBDD] hover:bg-[#BA7E44] text-[#9C6230] hover:text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    {perk.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
