import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { SavingsGoal } from '../types/banking';

interface WealthViewProps {
  availableBalance: number;
  savingsGoals: SavingsGoal[];
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  onMoveSavings: (goalId: string, amount: number, direction: 'deposit' | 'withdraw') => string | null;
  onCreateGoal: (title: string, targetAmount: number) => void;
}

export const WealthView: React.FC<WealthViewProps> = ({
  availableBalance,
  savingsGoals,
  hideBalance,
  onToggleHideBalance,
  onMoveSavings,
  onCreateGoal,
}) => {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountInput, setAmountInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  const totalWealth = savingsGoals.reduce((sum, g) => sum + g.savedAmount, 0);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoalId) return;
    const amt = Number(amountInput);
    if (!amt || amt <= 0) {
      setFeedback({ type: 'err', msg: 'Enter a valid amount above ₦0.' });
      return;
    }
    const err = onMoveSavings(activeGoalId, amt, direction);
    if (err) {
      setFeedback({ type: 'err', msg: err });
      return;
    }
    setFeedback({
      type: 'ok',
      msg:
        direction === 'deposit'
          ? `Successfully moved ${formatNaira(amt)} into savings.`
          : `Successfully withdrew ${formatNaira(amt)} to Available Balance.`,
    });
    setAmountInput('');
    window.setTimeout(() => {
      setActiveGoalId(null);
      setFeedback(null);
    }, 1100);
  };

  const handleNewGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(newGoalTarget);
    if (!newGoalTitle.trim() || !target || target < 1000) return;
    onCreateGoal(newGoalTitle.trim(), target);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setCreatingGoal(false);
  };

  return (
    <div className="w-full pb-4 lg:pb-8">
      <header className="px-4 lg:px-0 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-[#1A1D23]">Wealth &amp; Savings</h1>
          <p className="text-[12.5px] text-gray-500">Daily interest paid every morning at 6:00 AM</p>
        </div>
        <button
          type="button"
          onClick={() => setCreatingGoal((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[12.5px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </header>

      <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Wealth Summary Card */}
          <div className="rounded-[18px] bg-[#BA7E44] text-white p-5 shadow-[0_2px_12px_rgba(186,126,68,0.14)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13.5px] text-white/90 font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>Total Wealth Balance</span>
                <button
                  type="button"
                  onClick={onToggleHideBalance}
                  className="p-1 rounded-full hover:bg-white/15 transition-colors"
                >
                  {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-white/18 text-[11px] font-semibold">
                Up to 18% p.a.
              </span>
            </div>

            <div className="mt-3 text-[28px] font-bold tabular-nums">
              {hideBalance ? '****' : formatNaira(totalWealth)}
            </div>

            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-[12.5px] text-white/90">
              <span>Available Wallet</span>
              <span className="font-semibold text-white tabular-nums">
                {hideBalance ? '****' : formatNaira(availableBalance)}
              </span>
            </div>
          </div>

          {creatingGoal && (
            <form
              onSubmit={handleNewGoal}
              className="bg-white rounded-[18px] p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] space-y-3"
            >
              <h2 className="text-[14px] font-semibold text-[#1A1D23]">Create Target Savings Goal</h2>
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="Goal name (e.g. Emergency Fund)"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm outline-none focus:ring-2 focus:ring-[#BA7E44]"
                required
              />
              <input
                type="number"
                min={1000}
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                placeholder="Target amount in ₦ (min 1,000)"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F8] text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-[#BA7E44] text-white text-sm font-semibold hover:bg-[#9C6230]"
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingGoal(false)}
                  className="px-4 h-10 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Savings Plans List */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          {savingsGoals.length === 0 && (
            <div className="bg-white rounded-[18px] p-6 text-center shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
              <div className="w-11 h-11 rounded-2xl bg-[#F5EBDD] flex items-center justify-center mx-auto">
                <TrendingUp className="w-5 h-5 text-[#BA7E44]" />
              </div>
              <h2 className="mt-3 text-[15px] font-bold text-[#1A1D23]">No Savings Plans Yet</h2>
              <p className="mt-1 text-[12.5px] text-gray-500">
                Create an OWealth or Target Savings goal to earn daily interest.
              </p>
              <button
                type="button"
                onClick={() => setCreatingGoal(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[12.5px] font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Savings Plan
              </button>
            </div>
          )}
          {savingsGoals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
            const isEditing = activeGoalId === goal.id;
            return (
              <div
                key={goal.id}
                className="bg-white rounded-[18px] p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[14px] bg-[#F5EBDD] flex items-center justify-center shrink-0">
                      {goal.type === 'Fixed' ? (
                        <Lock className="w-5 h-5 text-[#BA7E44]" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-[#BA7E44]" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1A1D23]">{goal.title}</h3>
                      <p className="text-[12px] text-gray-500">
                        {goal.interestRate}% p.a. · {goal.maturityDate}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-bold text-[#1A1D23] tabular-nums">
                      {hideBalance ? '****' : formatNaira(goal.savedAmount)}
                    </div>
                    <div className="text-[11.5px] text-gray-400 tabular-nums">
                      of {formatNaira(goal.targetAmount, false)}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 h-2 rounded-full bg-[#F5EBDD] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#BA7E44] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGoalId(goal.id);
                      setDirection('deposit');
                      setFeedback(null);
                    }}
                    className="flex-1 h-10 rounded-xl bg-[#F5EBDD] hover:bg-[#F5EBDD] text-[#9C6230] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Top Up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGoalId(goal.id);
                      setDirection('withdraw');
                      setFeedback(null);
                    }}
                    className="flex-1 h-10 rounded-xl bg-[#F4F6F8] hover:bg-gray-200 text-[#1A1D23] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Withdraw
                  </button>
                </div>

                {isEditing && (
                  <form onSubmit={handleTransfer} className="mt-3.5 pt-3.5 border-t border-gray-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                      <span>
                        {direction === 'deposit'
                          ? 'Move from Available Balance'
                          : 'Withdraw to Available Balance'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveGoalId(null)}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={100}
                        step="100"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="Amount (₦)"
                        className="flex-1 h-10 px-3 rounded-xl bg-[#F4F6F8] text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#BA7E44]"
                      />
                      <button
                        type="submit"
                        className="px-4 h-10 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold"
                      >
                        Confirm
                      </button>
                    </div>
                    {feedback && (
                      <p
                        className={`text-xs font-medium ${
                          feedback.type === 'ok' ? 'text-[#BA7E44]' : 'text-red-500'
                        }`}
                      >
                        {feedback.msg}
                      </p>
                    )}
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
