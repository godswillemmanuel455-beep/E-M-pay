import React from 'react';
import {
  Bot,
  ChevronRight,
  Coins,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Gift,
  Hash,
  Headset,
  Hexagon,
  Settings,
  ShieldCheck,
  Store,
  User,
  Users,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { ModalType, NavTab, UserProfile } from '../types/banking';
import { OPayLogo } from './OPayLogo';

interface MeViewProps {
  profile: UserProfile;
  totalBalance: number;
  earnedToday: number;
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  onOpenModal: (modal: ModalType) => void;
  onSwitchTab: (tab: NavTab) => void;
  onSignOut: () => void;
}

export const MeView: React.FC<MeViewProps> = ({
  profile,
  totalBalance,
  earnedToday,
  hideBalance,
  onToggleHideBalance,
  onOpenModal,
  onSwitchTab,
  onSignOut,
}) => {
  const quickTools = [
    {
      label: 'Transactions',
      icon: FileText,
      onClick: () => onOpenModal({ kind: 'transactions' }),
    },
    {
      label: 'Account Limits',
      icon: Gauge,
      onClick: () => onOpenModal({ kind: 'limits' }),
    },
    {
      label: 'Security Center',
      icon: ShieldCheck,
      onClick: () => onOpenModal({ kind: 'security' }),
    },
  ];

  const accountRows = [
    {
      label: 'Bank Card/Account',
      icon: CreditCard,
      onClick: () => onSwitchTab('cards'),
    },
    {
      label: 'My BizPayment',
      icon: Store,
      onClick: () => onOpenModal({ kind: 'business' }),
    },
    {
      label: 'OJunior',
      icon: Users,
      onClick: () => onOpenModal({ kind: 'ojunior' }),
    },
    {
      label: 'E&M Pay USSD',
      icon: Hash,
      onClick: () => onOpenModal({ kind: 'ussd' }),
    },
  ];

  const assistantTopics = [
    'Successful but not credited',
    'Erroneous Transfer',
    'Internet Fraud',
    'Account Theft',
  ];

  return (
    <div className="w-full pb-4 lg:pb-8 bg-gradient-to-b from-[#E5F7EF] via-[#F4F6F8] to-[#F4F6F8] min-h-full lg:min-h-0 lg:bg-none">
      {/* Top Profile Header */}
      <header className="px-4 lg:px-0 pt-4 pb-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenModal({ kind: 'profile' })}
          className="flex items-center gap-3 text-left group min-h-[44px]"
        >
          <span className="p-0.5 rounded-full bg-white shadow-xs">
            <OPayLogo size={42} />
          </span>
          <div>
            <div className="flex items-center gap-1 text-[17px] font-semibold text-[#1A1D23] group-hover:text-[#BA7E44] transition-colors">
              <span>{profile.firstName}</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
            <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-[#F5EBDD] text-[#9C6230] text-[11px] font-semibold">
              {profile.tier}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'assistant' })}
            aria-label="Customer Support"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/5 text-[#1A1D23] transition-colors"
          >
            <Headset className="w-[21px] h-[21px] stroke-[1.9]" />
          </button>
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'settings' })}
            aria-label="Settings"
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/5 text-[#1A1D23] transition-colors"
          >
            <Hexagon className="w-[21px] h-[21px] stroke-[1.9]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#EF4444]" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-5 items-start">
        {/* Left Column */}
        <div className="lg:col-span-6 flex flex-col gap-3.5">
          {/* Total Balance Summary Card */}
          <section className="bg-white rounded-[18px] px-4 py-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-medium text-[#1A1D23]">Total Balance</span>
                <button
                  type="button"
                  onClick={onToggleHideBalance}
                  aria-label={hideBalance ? 'Show total balance' : 'Hide total balance'}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                >
                  {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'transactions' })}
                className="flex items-center gap-1 text-[16px] font-bold text-[#1A1D23] tabular-nums hover:text-[#BA7E44] transition-colors"
              >
                <span>{hideBalance ? '****' : formatNaira(totalBalance)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onSwitchTab('wealth')}
              className="pt-3 w-full flex items-center gap-2 text-left text-[13px] group"
            >
              <span className="text-gray-500">Earned Today</span>
              <span className="font-semibold text-[#BA7E44] tabular-nums">
                {hideBalance ? '****' : formatNaira(earnedToday)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </section>

          {/* 3 Quick Tools Card */}
          <section className="bg-white rounded-[18px] px-3 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] grid grid-cols-3 gap-2">
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  onClick={tool.onClick}
                  className="flex flex-col items-center justify-center gap-2 min-h-[44px] py-1 rounded-xl hover:bg-[#F4F6F8] active:scale-[0.97] transition-all"
                >
                  <span className="w-11 h-11 rounded-[14px] bg-[#F5EBDD] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#9C6230] stroke-[2]" />
                  </span>
                  <span className="text-[12.5px] font-medium text-[#1A1D23] whitespace-nowrap">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </section>

          {/* 5-Row Account Services Card */}
          <section className="bg-white rounded-[18px] divide-y divide-gray-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
            {accountRows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full px-4 py-3.5 min-h-[54px] flex items-center justify-between gap-3 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[#1A1D23] stroke-[1.8] shrink-0" />
                    <span className="text-[14.5px] font-medium text-[#1A1D23]">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              );
            })}
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-6 flex flex-col gap-3.5">
          {/* Smart Assistant Card */}
          <section className="rounded-[18px] overflow-hidden bg-[#FAF7F2] border border-[#BA7E44]/15 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'assistant' })}
              className="w-full px-4 py-3.5 bg-gradient-to-r from-[#F5EBDD] to-[#FAF7F2] flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-xs">
                  <Bot className="w-5 h-5 text-[#0284C7]" />
                </span>
                <span className="text-[15px] font-bold text-[#1A1D23]">E&amp;M Pay Smart Assistant</span>
              </div>
              <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </span>
            </button>

            <div className="p-3.5 flex flex-wrap gap-2">
              {assistantTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onOpenModal({ kind: 'assistant', topic })}
                  className="px-3.5 py-2 rounded-full bg-white hover:bg-[#F5EBDD] border border-gray-100 text-[12.5px] font-medium text-[#4B5563] hover:text-[#9C6230] transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>

          {/* Invitation Card */}
          <button
            type="button"
            onClick={() => onOpenModal({ kind: 'invitation' })}
            className="w-full bg-white rounded-[18px] px-4 py-3.5 min-h-[54px] flex items-center justify-between gap-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)] hover:bg-[#F9FAFB] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-[#1A1D23] stroke-[1.8]" />
              <span className="text-[14.5px] font-medium text-[#1A1D23]">Invitation</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] shrink-0">
              <span className="text-gray-500">Earn up to</span>
              <span className="text-[#BA7E44] font-semibold tabular-nums">₦6,300 Bonus</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          {/* Profile Info & Settings Card */}
          <section className="bg-white rounded-[18px] divide-y divide-gray-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'profile' })}
              className="w-full px-4 py-3.5 min-h-[54px] flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#1A1D23] stroke-[1.8]" />
                <span className="text-[14.5px] font-medium text-[#1A1D23]">Profile Info</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                <span>Name/NIN/BVN</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'settings' })}
              className="w-full px-4 py-3.5 min-h-[54px] flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#1A1D23] stroke-[1.8]" />
                <span className="text-[14.5px] font-medium text-[#1A1D23]">Settings</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                <span>Password/Biometrics</span>
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </section>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            className="w-full bg-white hover:bg-[#FFF5F5] active:scale-[0.99] rounded-[18px] py-3.5 min-h-[52px] text-[15px] font-semibold text-[#EF4444] shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
