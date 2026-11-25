import React from 'react';
import {
  Coins,
  Gamepad2,
  Landmark,
  LayoutGrid,
  Lock,
  Megaphone,
  MessageSquareText,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Tv,
  Wifi,
} from 'lucide-react';
import type { ModalType } from '../types/banking';
import { OPayWordmark } from './OPayLogo';

interface GuestHomeViewProps {
  onOpenAuth: (screen: 'login' | 'signup') => void;
  onOpenModal: (modal: ModalType) => void;
}

export const GuestHomeView: React.FC<GuestHomeViewProps> = ({
  onOpenAuth,
  onOpenModal,
}) => {
  const primaryActions = [
    { label: 'To E&M Pay', icon: MessageSquareText },
    { label: 'To Bank', icon: Landmark },
    { label: 'Save', icon: PiggyBank },
    { label: 'Loan', icon: Coins },
  ];

  const serviceGrid = [
    { label: 'Airtime', icon: Smartphone },
    { label: 'Data', icon: Wifi },
    { label: 'Betting', icon: Gamepad2 },
    { label: 'TV', icon: Tv },
    { label: 'Fixed', icon: Lock },
    { label: 'Loan Center', icon: Coins },
    { label: 'Invitation', icon: Megaphone },
    { label: 'More', icon: LayoutGrid },
  ];

  return (
    <div className="relative w-full min-h-full bg-gradient-to-b from-[#FAF4EC] via-[#FDFBF7] to-[#FAF7F2] pb-8 overflow-x-hidden">
      {/* Subtle decorative floating voucher motifs in warm bronze tones */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden opacity-50" aria-hidden="true">
        <div className="absolute top-6 left-[28%] w-9 h-6 rounded-md bg-[#F5EBDD] rotate-[-28deg] blur-[1px]" />
        <div className="absolute top-24 right-[10%] w-11 h-7 rounded-md bg-[#E8D6C0] rotate-[-35deg] flex items-center justify-center shadow-xs">
          <span className="text-[11px] font-bold text-[#9C6230]">%</span>
        </div>
        <div className="absolute top-44 left-[4%] w-11 h-7 rounded-md bg-[#DBC0A3] rotate-[-38deg] flex items-center justify-center shadow-xs">
          <span className="text-[11px] font-bold text-[#9C6230]">%</span>
        </div>
        <div className="absolute top-56 right-[12%] w-10 h-6 rounded-md bg-[#F5EBDD] rotate-[-25deg] blur-[1px]" />
      </div>

      <div className="relative z-10 px-4 lg:px-0 pt-10 lg:pt-8 max-w-2xl mx-auto">
        {/* Centered Brand Wordmark & Promo CTA */}
        <section className="flex flex-col items-center text-center">
          <OPayWordmark iconSize={34} textClassName="text-[28px]" />

          <h1 className="mt-5 text-[18px] sm:text-[19px] font-normal text-[#1A1D23] leading-snug max-w-[280px]">
            Simple, fast &amp; secure <span className="font-bold">Nigerian Banking</span>
          </h1>

          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="mt-5 w-full max-w-[290px] h-[48px] rounded-full bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white text-[15px] font-semibold shadow-[0_6px_18px_rgba(186,126,68,0.24)] transition-all"
          >
            Sign Up / Log In
          </button>
        </section>

        {/* 4 Primary Quick Actions Card */}
        <section
          aria-label="Quick Actions"
          className="mt-7 bg-white rounded-[18px] px-3 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] grid grid-cols-4 gap-2"
        >
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => onOpenAuth('login')}
                className="flex flex-col items-center justify-center gap-2 min-h-[44px] py-1 rounded-xl hover:bg-[#F4F6F8] active:scale-[0.97] transition-all group"
              >
                <span className="w-11 h-11 rounded-[14px] bg-[#F5EBDD] group-hover:bg-[#F5EBDD] flex items-center justify-center transition-colors">
                  <Icon className="w-[22px] h-[22px] text-[#BA7E44] stroke-[2]" />
                </span>
                <span className="text-[12.5px] font-medium text-[#1A1D23] whitespace-nowrap">
                  {action.label}
                </span>
              </button>
            );
          })}
        </section>

        {/* 8-Item Services Grid Card */}
        <section
          aria-label="Bills and Services"
          className="relative mt-3.5 bg-white rounded-[18px] px-3 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] grid grid-cols-4 gap-y-4 gap-x-2"
        >
          {serviceGrid.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.label}
                type="button"
                onClick={() => onOpenAuth('login')}
                className="flex flex-col items-center justify-center gap-1.5 min-h-[44px] py-1 rounded-xl hover:bg-[#F4F6F8] active:scale-[0.97] transition-all group"
              >
                <span className="w-10 h-10 rounded-full bg-[#F5EBDD] group-hover:bg-[#F5EBDD] flex items-center justify-center transition-colors">
                  <Icon className="w-[19px] h-[19px] text-[#BA7E44] stroke-[2]" />
                </span>
                <span className="text-[12px] font-medium text-[#1A1D23] whitespace-nowrap">
                  {service.label}
                </span>
              </button>
            );
          })}
        </section>

        {/* Floating Click for Security Widget matching screenshot 2 */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'security' })}
            className="group flex flex-col items-center active:scale-[0.97] transition-transform"
          >
            <div className="relative flex flex-col items-center -mb-2.5 z-10">
              <div className="w-11 h-12 rounded-2xl bg-gradient-to-b from-[#BA7E44] to-[#9C6230] border-2 border-[#F5EBDD] shadow-md flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
              <div className="w-14 h-2.5 rounded-full bg-[#BA7E44]/30 -mt-1 blur-[0.5px]" />
            </div>
            <span className="relative z-20 px-3 py-1 rounded-full bg-[#BA7E44] group-hover:bg-[#9C6230] text-white text-[11px] font-semibold shadow-md whitespace-nowrap">
              Click for Security
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
