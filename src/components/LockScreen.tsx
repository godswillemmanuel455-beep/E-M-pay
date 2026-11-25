import React, { useState } from 'react';
import { Delete, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { verifyPinApi } from '../utils/authApi';
import { OPayLogo } from './OPayLogo';

interface LockScreenProps {
  firstName: string;
  onUnlock: () => void;
  onSignOut: () => void;
  onReplaySplash: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  firstName,
  onUnlock,
  onSignOut,
  onReplaySplash,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleDigit = async (digit: string) => {
    if (pin.length >= 4 || verifying) return;
    const next = pin + digit;
    setPin(next);
    setErrorMsg('');

    if (next.length === 4) {
      setVerifying(true);
      try {
        const res = await verifyPinApi(next);
        if (res.ok) {
          onUnlock();
          return;
        }
        setErrorMsg(res.data.error || 'Incorrect 4-digit PIN.');
        window.setTimeout(() => {
          setPin('');
        }, 350);
      } catch {
        setErrorMsg('Unable to verify PIN right now.');
        setPin('');
      } finally {
        setVerifying(false);
      }
    }
  };

  const handleDelete = () => {
    if (verifying) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden bg-[#F4F6F8] flex flex-col items-center justify-center px-5 py-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-sm border border-black/[0.04] flex flex-col items-center">
        <div className="p-2 rounded-full bg-[#F5EBDD]">
          <OPayLogo size={54} showTierBadge tierNumber="2" />
        </div>

        <h1 className="mt-4 text-lg font-bold text-[#1A1D23] tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-xs text-gray-500 text-center">
          Enter your 4-digit E&amp;M Pay security PIN
        </p>

        {/* PIN indicators */}
        <div className={`mt-6 flex items-center gap-4 ${errorMsg ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${
                errorMsg
                  ? 'bg-red-500'
                  : idx < pin.length
                  ? 'bg-[#BA7E44]'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        {errorMsg && (
          <p className="mt-2.5 text-xs font-medium text-red-500 text-center">{errorMsg}</p>
        )}

        {/* Keypad */}
        <div className="mt-7 grid grid-cols-3 gap-3 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={verifying}
              onClick={() => void handleDigit(digit)}
              className="h-13 rounded-2xl bg-[#F4F6F8] hover:bg-[#F5EBDD] active:scale-95 text-lg font-semibold text-[#1A1D23] transition-all tabular-nums flex items-center justify-center disabled:opacity-60"
            >
              {digit}
            </button>
          ))}
          <div className="h-13 rounded-2xl bg-[#F5EBDD]/60 text-[#BA7E44] flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <button
            type="button"
            disabled={verifying}
            onClick={() => void handleDigit('0')}
            className="h-13 rounded-2xl bg-[#F4F6F8] hover:bg-[#F5EBDD] active:scale-95 text-lg font-semibold text-[#1A1D23] transition-all tabular-nums flex items-center justify-center disabled:opacity-60"
          >
            0
          </button>
          <button
            type="button"
            disabled={verifying}
            onClick={handleDelete}
            aria-label="Backspace"
            className="h-13 rounded-2xl bg-[#F4F6F8] hover:bg-gray-200 active:scale-95 text-gray-600 transition-all flex items-center justify-center disabled:opacity-60"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-5 w-full h-11 rounded-xl bg-[#FAF7F2] hover:bg-[#F5EBDD] text-[#9C6230] text-xs font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Switch Account / Use Forgot PIN
        </button>

        <button
          type="button"
          onClick={onReplaySplash}
          className="mt-3 text-xs font-medium text-gray-500 hover:text-[#BA7E44] transition-colors flex items-center gap-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#BA7E44]" />
          Replay E&amp;M Pay Splash Screen
        </button>
      </div>
    </div>
  );
};
