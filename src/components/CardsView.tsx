import React, { useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { BankCard } from '../types/banking';
import { OPayLogo } from './OPayLogo';

interface CardsViewProps {
  cards: BankCard[];
  onToggleFreeze: (cardId: string) => void;
  onUpdateLimit: (cardId: string, limit: number) => void;
  onCreateVirtualCard: () => void;
}

export const CardsView: React.FC<CardsViewProps> = ({
  cards,
  onToggleFreeze,
  onUpdateLimit,
  onCreateVirtualCard,
}) => {
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? '');
  const [revealDetails, setRevealDetails] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);

  const selectedCard = cards.find((c) => c.id === selectedId) ?? cards[0];

  const handleCopyPan = () => {
    if (!selectedCard) return;
    navigator.clipboard?.writeText(selectedCard.fullNumber.replace(/\s+/g, ''));
    setCopiedPan(true);
    window.setTimeout(() => setCopiedPan(false), 1800);
  };

  return (
    <div className="w-full pb-4 lg:pb-8">
      <header className="px-4 lg:px-0 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-[#1A1D23]">E&amp;M Pay Cards</h1>
          <p className="text-[12.5px] text-gray-500">Zero maintenance fees · Instant online &amp; POS pay</p>
        </div>
        <button
          type="button"
          onClick={onCreateVirtualCard}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[12.5px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Virtual Card
        </button>
      </header>

      <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {cards.length === 0 ? (
          <div className="lg:col-span-12 bg-white rounded-[18px] p-8 text-center shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-[#F5EBDD] flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6 text-[#BA7E44]" />
            </div>
            <h2 className="mt-3 text-[16px] font-bold text-[#1A1D23]">No E&amp;M Pay Cards Yet</h2>
            <p className="mt-1 text-[13px] text-gray-500 max-w-sm mx-auto">
              Create an instant Verve Virtual Card for secure online payments with zero maintenance fees.
            </p>
            <button
              type="button"
              onClick={onCreateVirtualCard}
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[13px] font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Virtual Card
            </button>
          </div>
        ) : (
        <>
        <div className="lg:col-span-6 flex flex-col gap-3.5">
          {/* Card Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedId(card.id)}
                className={`px-3.5 py-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                  selectedCard?.id === card.id
                    ? 'bg-[#BA7E44] text-white'
                    : 'bg-white text-[#374151] hover:bg-[#F5EBDD]'
                }`}
              >
                {card.label}
              </button>
            ))}
          </div>

          {selectedCard && (
            <div
              className={`relative rounded-[22px] p-5 text-white overflow-hidden shadow-md transition-all ${
                selectedCard.frozen
                  ? 'bg-slate-700'
                  : selectedCard.kind === 'Virtual'
                  ? 'bg-gradient-to-br from-[#BA7E44] via-[#9C6230] to-[#1D164B]'
                  : 'bg-gradient-to-br from-[#1D164B] via-[#272060] to-[#9C6230]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <OPayLogo size={28} />
                  <span className="text-sm font-bold tracking-tight">
                    E&amp;M Pay {selectedCard.kind}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/15">
                  {selectedCard.frozen ? 'Frozen' : selectedCard.scheme}
                </span>
              </div>

              <div className="mt-7 flex items-center justify-between gap-2">
                <div className="font-mono-tabular text-[19px] sm:text-[21px] font-semibold tracking-wider">
                  {revealDetails ? selectedCard.fullNumber : selectedCard.maskedNumber}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPan}
                  aria-label="Copy card number"
                  className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                >
                  {copiedPan ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <div className="text-[10.5px] text-white/70">CARD HOLDER</div>
                  <div className="text-[13px] font-semibold tracking-wide mt-0.5">
                    {selectedCard.holderName}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div>
                    <div className="text-[10.5px] text-white/70">EXPIRES</div>
                    <div className="font-mono-tabular text-[13px] font-semibold mt-0.5">
                      {selectedCard.expiry}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-white/70">CVV</div>
                    <div className="font-mono-tabular text-[13px] font-semibold mt-0.5">
                      {revealDetails ? selectedCard.cvv : '•••'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card Controls */}
        {selectedCard && (
          <div className="lg:col-span-6 bg-white rounded-[18px] p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] space-y-4">
            <h2 className="text-[15px] font-semibold text-[#1A1D23]">Card Controls</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRevealDetails((v) => !v)}
                className="h-12 rounded-xl bg-[#F5EBDD] hover:bg-[#F5EBDD] text-[#9C6230] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {revealDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {revealDetails ? 'Hide Card Info' : 'Show Card Info'}
              </button>

              <button
                type="button"
                onClick={() => onToggleFreeze(selectedCard.id)}
                className={`h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors ${
                  selectedCard.frozen
                    ? 'bg-[#BA7E44] text-white'
                    : 'bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48]'
                }`}
              >
                <Snowflake className="w-4 h-4" />
                {selectedCard.frozen ? 'Unfreeze Card' : 'Freeze Card'}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-[13px] mb-2">
                <span className="text-gray-600 font-medium">Daily Spending Limit</span>
                <span className="font-mono-tabular font-bold text-[#1A1D23]">
                  {formatNaira(selectedCard.dailyLimit, false)}
                </span>
              </div>
              <input
                type="range"
                min={50000}
                max={1000000}
                step={50000}
                value={selectedCard.dailyLimit}
                onChange={(e) => onUpdateLimit(selectedCard.id, Number(e.target.value))}
                className="w-full accent-[#BA7E44]"
              />
              <div className="flex justify-between text-[11px] text-gray-400 tabular-nums mt-1">
                <span>₦50,000</span>
                <span>₦500,000</span>
                <span>₦1,000,000</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F4F6F8] flex items-center gap-3 text-[12.5px] text-gray-600">
              <ShieldCheck className="w-5 h-5 text-[#BA7E44] shrink-0" />
              <span>
                Protected by 3D Secure OTP verification &amp; instant freeze controls.
              </span>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};
