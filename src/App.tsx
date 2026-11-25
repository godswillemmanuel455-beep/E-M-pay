import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Gift,
  Home,
  LogOut,
  Plus,
  Sparkles,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import { ActionModals } from './components/ActionModals';
import { AddMoneyPage } from './components/AddMoneyPage';
import { AirtimeDataPage } from './components/AirtimeDataPage';
import { AuthScreens, type BackendAccountPayload } from './components/AuthScreens';
import { BankTransferPage } from './components/BankTransferPage';
import { CardsView } from './components/CardsView';
import { GuestHomeView } from './components/GuestHomeView';
import { HomeDashboard } from './components/HomeDashboard';
import { KycVerificationModal } from './components/KycVerificationModal';
import { calculateLoanCharges } from './components/LoanPage';
import { LockScreen } from './components/LockScreen';
import { MeView } from './components/MeView';
import { OPayLogo } from './components/OPayLogo';
import { RewardsView } from './components/RewardsView';
import { SplashScreen } from './components/SplashScreen';
import { TransactionReceiptPage } from './components/TransactionReceiptPage';
import { TransactionsPage } from './components/TransactionsPage';
import { WealthView } from './components/WealthView';
import {
  ensureFirebaseAuthUser,
  syncWalletToFirestore,
  syncPrivateProfileToFirestore,
  syncTransactionToFirestore,
} from './utils/firebaseSync';
import { auth } from './firebase';
import {
  autoCheckDepositApi,
  checkSessionApi,
  clearAllCachedAccounts,
  fetchAccountSnapshotApi,
  getSavedSessionPhone,
  logoutApi,
  payBillApi,
  saveAccountSnapshotApi,
  setSavedSessionPhone,
  transferToEmPayAccountApi,
  transferToOtherBankApi,
  verifyBankTransferStatusApi,
  verifyFlwDepositApi,
  type VirtualAccountInfo,
} from './utils/authApi';
import {
  formatNaira,
  INITIAL_BENEFICIARIES,
  INITIAL_CARDS,
  INITIAL_LOAN,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROFILE,
  INITIAL_SAVINGS_GOALS,
  INITIAL_TRANSACTIONS,
} from './data/initialState';
import type {
  BankCard,
  LoanApplicationInfo,
  LoanState,
  ModalType,
  NavTab,
  NotificationItem,
  SavingsGoal,
  Transaction,
  TransactionCategory,
  UserProfile,
} from './types/banking';

interface AccountState {
  balance: number;
  earnedToday: number;
  businessSalesToday: number;
  cashbackBalance: number;
  welcomeBonusCreditedToBalance?: boolean;
  checkedInToday: boolean;
  hideBalance: boolean;
  profile: UserProfile;
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  cards: BankCard[];
  notifications: NotificationItem[];
  loan: LoanState;
  virtualAccount?: VirtualAccountInfo | null;
}

const DEFAULT_EMPTY_STATE: AccountState = {
  balance: 0,
  earnedToday: 0,
  businessSalesToday: 0,
  cashbackBalance: 0,
  welcomeBonusCreditedToBalance: false,
  checkedInToday: false,
  hideBalance: false,
  profile: INITIAL_PROFILE,
  transactions: INITIAL_TRANSACTIONS,
  savingsGoals: INITIAL_SAVINGS_GOALS,
  cards: INITIAL_CARDS,
  notifications: INITIAL_NOTIFICATIONS,
  loan: INITIAL_LOAN,
  virtualAccount: null,
};

type AuthStage = 'guest' | 'login' | 'signup' | 'authenticated' | 'locked';

function mapBackendAccountToState(acc: BackendAccountPayload): AccountState {
  return {
    balance: acc.balance,
    earnedToday: acc.earnedToday,
    businessSalesToday: acc.businessSalesToday,
    cashbackBalance: acc.cashbackBalance,
    welcomeBonusCreditedToBalance: false,
    checkedInToday: acc.checkedInToday,
    hideBalance: acc.hideBalance,
    profile: acc.profile,
    transactions: acc.transactions as Transaction[],
    savingsGoals: acc.savingsGoals as SavingsGoal[],
    cards: acc.cards as BankCard[],
    notifications: acc.notifications as NotificationItem[],
    loan: {
      eligibleLimit:
        !acc.loan?.unlocked90Days && (acc.loan?.eligibleLimit ?? 30000) > 30000
          ? 30000
          : acc.loan?.eligibleLimit ?? 30000,
      approvedPendingAmount: acc.loan?.approvedPendingAmount ?? 0,
      activeBalance: acc.loan?.activeBalance ?? 0,
      principalAmount: acc.loan?.principalAmount ?? 0,
      totalCharges: acc.loan?.totalCharges ?? 0,
      dueDate: acc.loan?.dueDate ?? '30 days from disbursement',
      interestRateMonthly: acc.loan?.interestRateMonthly ?? 3.0,
      unlocked90Days: Boolean(acc.loan?.unlocked90Days),
      application: acc.loan?.application as LoanApplicationInfo | undefined,
    },
    virtualAccount: acc.virtualAccount ?? null,
  };
}

function formatOpayTimestamp(date = new Date()): string {
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const suffix =
    day >= 11 && day <= 13
      ? 'th'
      : day % 10 === 1
      ? 'st'
      : day % 10 === 2
      ? 'nd'
      : day % 10 === 3
      ? 'rd'
      : 'th';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${month} ${day}${suffix}, ${hh}:${mm}:${ss}`;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authStage, setAuthStage] = useState<AuthStage>(() =>
    getSavedSessionPhone() ? 'authenticated' : 'guest'
  );
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [modal, setModal] = useState<ModalType>({ kind: 'none' });
  const [receiptReturnToHistory, setReceiptReturnToHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [state, setState] = useState<AccountState>(DEFAULT_EMPTY_STATE);

  // Ensure Firebase user session & restore persisted E&M Pay login across page reloads
  useEffect(() => {
    void ensureFirebaseAuthUser();
    void checkSessionApi()
      .then(({ ok, account }) => {
        if (ok && account) {
          setState(mapBackendAccountToState(account));
          setAuthStage('authenticated');
        } else {
          clearAllCachedAccounts();
          setState(DEFAULT_EMPTY_STATE);
          setAuthStage('guest');
        }
      })
      .catch(() => {
        // Keep guest stage if offline
      });
  }, []);

  // Sync authenticated account changes back to the Express backend & Firebase Firestore
  const syncAccountToBackend = (nextState: AccountState) => {
    const phoneKey = nextState.profile.normalizedPhone;
    if (!phoneKey) return;
    void saveAccountSnapshotApi(phoneKey, nextState);

    if (auth.currentUser?.uid) {
      void syncWalletToFirestore(
        auth.currentUser.uid,
        nextState.profile,
        nextState.balance,
        nextState.earnedToday,
        nextState.businessSalesToday,
        nextState.cashbackBalance,
        nextState.checkedInToday,
        nextState.hideBalance,
        nextState.loan.eligibleLimit,
        nextState.loan.activeBalance,
        nextState.virtualAccount
      );
      void syncPrivateProfileToFirestore(auth.currentUser.uid, nextState.profile);
    }
  };

  // Helper to update state and persist to backend
  const commitState = (updater: (prev: AccountState) => AccountState) => {
    setState((prev) => {
      const next = updater(prev);
      syncAccountToBackend(next);
      return next;
    });
  };

  useEffect(() => {
    if (authStage !== 'authenticated' || !state.profile.normalizedPhone) return;
    const activePhone = state.profile.normalizedPhone;

    // Refresh latest snapshot & reconcile incoming Flutterwave deposits immediately
    void fetchAccountSnapshotApi(activePhone)
      .then((acc) => {
        if (acc) {
          setState(mapBackendAccountToState(acc));
        }
      })
      .catch(() => {
        // Keep active local state if offline
      });

    // Global 10-second background deposit check so dashboard reflects transfers immediately
    const runLiveDepositCheck = () => {
      void autoCheckDepositApi(activePhone).then((res) => {
        if (!res.ok || !res.data.account) return;
        const acc = res.data.account;
        if (res.data.credited && res.data.transaction) {
          setState(mapBackendAccountToState(acc));
          showToast(`Wallet funded with ${formatNaira(res.data.amount ?? 0)}`);
        } else {
          setState((prev) => {
            const latestPrev = prev.transactions[0];
            const latestAcc = (acc.transactions as Transaction[])[0];
            const hasPendingMismatch = prev.transactions.some((pt) => {
              if (pt.status !== 'Pending') return false;
              const match = (acc.transactions as Transaction[]).find(
                (at) => at.reference === pt.reference
              );
              return match && match.status !== pt.status;
            });
            if (
              prev.balance !== acc.balance ||
              prev.transactions.length !== acc.transactions.length ||
              latestPrev?.status !== latestAcc?.status ||
              hasPendingMismatch
            ) {
              return mapBackendAccountToState(acc);
            }
            return prev;
          });
        }
      });
    };

    const interval = window.setInterval(runLiveDepositCheck, 10000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        runLiveDepositCheck();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // If redirected back from Flutterwave Checkout with tx_ref, auto-verify it
    const params = new URLSearchParams(window.location.search);
    const txRef = params.get('tx_ref');
    const transactionId = params.get('transaction_id') ?? undefined;
    if (txRef && txRef.startsWith('EMP_')) {
      void verifyFlwDepositApi({
        normalizedPhone: activePhone,
        txRef,
        transactionId,
      }).then((res) => {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (res.ok && res.data.status === 'credited' && res.data.account && res.data.transaction) {
          const acc = res.data.account;
          const tx = res.data.transaction as Transaction;
          setState((prev) => ({
            ...prev,
            balance: acc.balance,
            transactions: acc.transactions as Transaction[],
            notifications: acc.notifications as NotificationItem[],
          }));
          showToast(`Wallet funded with ${formatNaira(tx.amount)}`);
          setModal({ kind: 'receipt', transaction: tx });
        }
      });
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [authStage, state.profile.normalizedPhone]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleRefreshDashboard = async () => {
    if (!state.profile.normalizedPhone) return;
    const activePhone = state.profile.normalizedPhone;
    try {
      const [acc, depRes] = await Promise.all([
        fetchAccountSnapshotApi(activePhone),
        autoCheckDepositApi(activePhone),
      ]);
      if (depRes?.ok && depRes.data?.account) {
        setState(mapBackendAccountToState(depRes.data.account));
        if (depRes.data.credited && depRes.data.transaction) {
          showToast(`Wallet funded: +${formatNaira(depRes.data.amount ?? 0)}`);
        } else {
          showToast('Account balances and transactions refreshed');
        }
      } else if (acc) {
        setState(mapBackendAccountToState(acc));
        showToast('Account balances and transactions refreshed');
      } else {
        showToast('Account refreshed');
      }
    } catch {
      showToast('Account refreshed');
    }
  };

  const handleAuthComplete = (account: BackendAccountPayload) => {
    setSavedSessionPhone(account.normalizedPhone);
    setState(mapBackendAccountToState(account));
    setAuthStage('authenticated');
    setActiveTab('home');
    showToast(`Welcome, ${account.profile.firstName}!`);
  };

  const handleSignOut = async () => {
    await logoutApi();
    setSavedSessionPhone(null);
    setState(DEFAULT_EMPTY_STATE);
    setAuthStage('guest');
    setActiveTab('home');
    setModal({ kind: 'none' });
  };

  const makeReference = (prefix = 'OP') =>
    `${prefix}${Date.now().toString().slice(-10)}`;

  const handleToggleHideBalance = () => {
    commitState((prev) => ({ ...prev, hideBalance: !prev.hideBalance }));
  };

  const handleFlwDepositCredited = (
    account: BackendAccountPayload,
    transaction: Transaction
  ) => {
    setState((prev) => ({
      ...prev,
      balance: account.balance,
      transactions: account.transactions as Transaction[],
      notifications: account.notifications as NotificationItem[],
    }));
    showToast(`Wallet funded with ${formatNaira(transaction.amount)}`);
    setModal({ kind: 'receipt', transaction });
  };

  const handleTransfer = async ({
    recipientName,
    accountNumber,
    bankName,
    bankCode,
    amount,
    note,
    pin,
  }: {
    recipientName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    amount: number;
    note?: string;
    pin: string;
  }): Promise<{ error?: string; transaction?: Transaction }> => {
    if (!amount || amount < 100) {
      return { error: 'Minimum transfer to another bank is ₦100.' };
    }
    if (amount > state.balance) {
      return { error: 'Insufficient wallet balance for this transfer.' };
    }
    const senderPhone = state.profile.normalizedPhone;
    if (!senderPhone) {
      return { error: 'Please sign in again to send a bank transfer.' };
    }

    const res = await transferToOtherBankApi({
      senderNormalizedPhone: senderPhone,
      accountNumber,
      bankCode,
      bankName,
      recipientName,
      amount,
      note,
      pin,
    });

    if (!res.ok) {
      return {
        error: res.data.error ?? 'Unable to complete bank transfer right now.',
      };
    }

    const sender = res.data.senderAccount;
    if (sender) {
      setState((prev) => ({
        ...prev,
        balance: sender.balance,
        transactions: sender.transactions as Transaction[],
        notifications: sender.notifications as NotificationItem[],
      }));
    }

    const tx = res.data.transaction as Transaction | undefined;
    if (tx) {
      showToast(
        tx.status === 'Pending'
          ? `Transfer of ${formatNaira(amount)} to ${tx.counterparty} submitted`
          : `Sent ${formatNaira(amount)} to ${tx.counterparty}`
      );
      return { transaction: tx };
    }
    return { error: 'Transfer submitted without receipt details.' };
  };

  const handleRefreshBankTransferStatus = async (tx: Transaction) => {
    if (!state.profile.normalizedPhone) return;
    const res = await verifyBankTransferStatusApi({
      normalizedPhone: state.profile.normalizedPhone,
      reference: tx.reference,
    });
    if (!res.ok) {
      showToast(res.data.error ?? 'Unable to refresh transfer status.');
      return;
    }
    if (res.data.senderAccount) {
      const sender = res.data.senderAccount;
      setState((prev) => ({
        ...prev,
        balance: sender.balance,
        transactions: sender.transactions as Transaction[],
        notifications: sender.notifications as NotificationItem[],
      }));
    }
    if (res.data.transaction) {
      const updatedTx = res.data.transaction as Transaction;
      setModal({ kind: 'receipt', transaction: updatedTx });
      showToast(
        updatedTx.status === 'Successful'
          ? 'Transfer confirmed Successful!'
          : updatedTx.status === 'Reversed'
          ? 'Transfer failed & refunded to your balance.'
          : 'Transfer is still processing at Flutterwave.'
      );
    } else {
      showToast('Transfer is still processing.');
    }
  };

  const handleEmPayTransfer = async ({
    recipientIdentifier,
    amount,
    note,
    pin,
  }: {
    recipientIdentifier: string;
    amount: number;
    note?: string;
    pin: string;
  }): Promise<{ error?: string; transaction?: Transaction }> => {
    if (!amount || amount < 10) {
      return { error: 'Minimum transfer to an E&M Pay account is ₦10.' };
    }
    if (amount > state.balance) {
      return { error: 'Insufficient wallet balance for this transfer.' };
    }
    const senderPhone = state.profile.normalizedPhone;
    if (!senderPhone) {
      return { error: 'Please sign in again to complete your E&M Pay transfer.' };
    }

    const res = await transferToEmPayAccountApi({
      senderNormalizedPhone: senderPhone,
      recipientIdentifier,
      amount,
      note,
      pin,
    });

    if (!res.ok) {
      return {
        error: res.data.error ?? 'Unable to complete E&M Pay transfer right now.',
      };
    }

    const sender = res.data.senderAccount;
    if (sender) {
      setState((prev) => ({
        ...prev,
        balance: sender.balance,
        transactions: sender.transactions as Transaction[],
        notifications: sender.notifications as NotificationItem[],
      }));
    }

    const tx = res.data.transaction as Transaction | undefined;
    if (tx) {
      showToast(`Sent ${formatNaira(amount)} to ${tx.counterparty}`);
      return { transaction: tx };
    }
    return { error: 'Transfer recorded without receipt details.' };
  };

  const handlePayBill = async ({
    title,
    counterparty,
    accountNumber,
    amount,
    faceAmount,
    category,
    carrier,
    billerCode,
    itemCode,
    billType,
    cashbackEarned,
    pin,
  }: {
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
  }): Promise<{ error?: string; transaction?: Transaction }> => {
    if (!amount || amount < 50) {
      return { error: 'Minimum recharge or bill payment is ₦50.' };
    }
    if (amount > state.balance) {
      return { error: 'Insufficient balance to complete this payment.' };
    }
    const activePhone = state.profile.normalizedPhone;
    if (!activePhone) {
      return { error: 'Please sign in again to complete this purchase.' };
    }

    const res = await payBillApi({
      normalizedPhone: activePhone,
      pin,
      amount,
      faceAmount,
      category,
      recipientPhone: accountNumber,
      carrier: carrier || 'mtn',
      title,
      counterparty,
      billerCode,
      itemCode,
      billType,
      cashbackEarned,
    });

    if (!res.ok) {
      return { error: res.data.error ?? 'Unable to complete purchase right now.' };
    }

    if (res.data.account) {
      const acc = res.data.account;
      setState((prev) => ({
        ...prev,
        balance: acc.balance,
        cashbackBalance: acc.cashbackBalance,
        earnedToday: acc.earnedToday,
        transactions: acc.transactions as Transaction[],
        notifications: acc.notifications as NotificationItem[],
      }));
    }

    const tx = res.data.transaction as Transaction | undefined;
    if (tx) {
      showToast(`${title} successful!`);
      return { transaction: tx };
    }
    return { error: 'Purchase completed without receipt details.' };
  };

  const handleMoveSavings = (
    goalId: string,
    amount: number,
    direction: 'deposit' | 'withdraw'
  ): string | null => {
    const goal = state.savingsGoals.find((g) => g.id === goalId);
    if (!goal) return 'Savings plan not found.';

    if (direction === 'deposit' && amount > state.balance) {
      return 'Insufficient Available Balance.';
    }
    if (direction === 'withdraw' && amount > goal.savedAmount) {
      return 'Amount exceeds plan balance.';
    }

    const newBalance = direction === 'deposit' ? state.balance - amount : state.balance + amount;
    const newSavedAmount =
      direction === 'deposit' ? goal.savedAmount + amount : goal.savedAmount - amount;

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      title:
        direction === 'deposit'
          ? `Saved to ${goal.title}`
          : `Withdrawn from ${goal.title}`,
      counterparty: goal.title,
      bankName: 'E&M Pay Wealth',
      accountNumber: goal.id.toUpperCase(),
      amount,
      type: direction === 'deposit' ? 'debit' : 'credit',
      category: 'savings',
      timestamp: formatOpayTimestamp(),
      reference: makeReference('OW'),
      status: 'Successful',
    };

    commitState((prev) => ({
      ...prev,
      balance: newBalance,
      savingsGoals: prev.savingsGoals.map((g) =>
        g.id === goalId ? { ...g, savedAmount: newSavedAmount } : g
      ),
      transactions: [tx, ...prev.transactions],
    }));
    return null;
  };

  const handleCreateGoal = (title: string, targetAmount: number) => {
    const newGoal: SavingsGoal = {
      id: `sav_${Date.now()}`,
      title,
      savedAmount: 0,
      targetAmount,
      interestRate: 16,
      maturityDate: 'Flexible Target',
      type: 'Target',
    };
    commitState((prev) => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, newGoal],
    }));
    showToast(`Created savings goal "${title}"`);
  };

  const handleApplyLoan = (
    amount: number,
    info: LoanApplicationInfo
  ): { error?: string; transaction?: Transaction } => {
    if (state.loan.activeBalance > 0) {
      return {
        error:
          'You have an unpaid loan debt. Pay off your existing debt in full before collecting another loan.',
      };
    }
    const starterLimit =
      !state.loan.unlocked90Days && state.loan.eligibleLimit > 30000
        ? 30000
        : state.loan.eligibleLimit;
    if (!amount || amount < 4000) {
      return { error: 'Minimum collectable loan is ₦4,000.' };
    }
    if (amount > starterLimit) {
      return { error: `Exceeds your loan limit of ${formatNaira(starterLimit)}.` };
    }
    if (info.tenureDays === 90 && !state.loan.unlocked90Days) {
      return { error: '90 Days repayment is locked until you repay an active loan on time.' };
    }

    const charges = calculateLoanCharges(amount, info.tenureDays);

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      title: 'E&M Pay Instant Loan Disbursement',
      counterparty: 'E&M Pay Loan Center',
      bankName: 'E&M Pay Credit',
      accountNumber: state.profile.accountNumber,
      amount,
      type: 'credit',
      category: 'loan',
      timestamp: formatOpayTimestamp(),
      reference: makeReference('LN'),
      status: 'Successful',
    };
    const notif: NotificationItem = {
      id: `not_${Date.now()}`,
      title: `Loan Credited: ${formatNaira(amount)}`,
      body: `${formatNaira(amount)} (${info.tenureDays} Days) credited. Total repayment incl. charges: ${formatNaira(charges.totalRepayment)}.`,
      time: 'Just now',
      read: false,
      category: 'transaction',
    };

    commitState((prev) => ({
      ...prev,
      balance: prev.balance + amount,
      loan: {
        ...prev.loan,
        eligibleLimit: starterLimit,
        approvedPendingAmount: 0,
        activeBalance: charges.totalRepayment,
        principalAmount: amount,
        totalCharges: charges.totalCharges,
        dueDate: `${info.tenureDays} days from disbursement`,
        application: {
          ...info,
          interestCharge: charges.interestCharge,
          serviceFee: charges.serviceFee,
          adminFee: charges.adminFee,
        },
      },
      transactions: [tx, ...prev.transactions],
      notifications: [notif, ...prev.notifications],
    }));
    showToast(`${formatNaira(amount)} loan credited to your balance`);
    return { transaction: tx };
  };

  const handleBorrowLoan = (amount: number): string | null => {
    const res = handleApplyLoan(amount, {
      employmentStatus: 'Self-Employed',
      monthlyIncome: '₦100,000 - ₦250,000',
      loanPurpose: 'Personal',
      emergencyName: state.profile.fullName || state.profile.firstName,
      emergencyPhone: state.profile.phone,
      stateOfResidence: 'Lagos',
      tenureDays: 30,
      appliedAt: 'Just now',
    });
    return res.error ?? null;
  };

  const handleRepayLoan = (amount: number): string | null => {
    if (!amount || amount <= 0) return 'Enter a valid repayment amount.';
    if (amount > state.balance) return 'Insufficient wallet balance.';
    const repayAmt = Math.min(amount, state.loan.activeBalance);
    const nextActive = Math.max(0, state.loan.activeBalance - repayAmt);
    const unlocked90 = Boolean(state.loan.unlocked90Days) || nextActive === 0;

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      title: 'E&M Pay Loan Repayment',
      counterparty: 'E&M Pay Loan Center',
      bankName: 'E&M Pay Credit',
      accountNumber: state.profile.accountNumber,
      amount: repayAmt,
      type: 'debit',
      category: 'loan',
      timestamp: formatOpayTimestamp(),
      reference: makeReference('LR'),
      status: 'Successful',
    };
    commitState((prev) => ({
      ...prev,
      balance: prev.balance - repayAmt,
      loan: {
        ...prev.loan,
        activeBalance: nextActive,
        principalAmount: nextActive === 0 ? 0 : prev.loan.principalAmount,
        totalCharges: nextActive === 0 ? 0 : prev.loan.totalCharges,
        unlocked90Days: unlocked90,
      },
      transactions: [tx, ...prev.transactions],
    }));
    if (nextActive === 0 && !state.loan.unlocked90Days) {
      showToast('Loan repaid on time! 90 Days repayment plan is now unlocked.');
    } else {
      showToast(`Repaid ${formatNaira(repayAmt)} toward your loan`);
    }
    return null;
  };

  const handleClaimDailyCheckIn = () => {
    showToast('Promotional bonuses are disabled. Fund your wallet via real bank transfer.');
  };

  const handleRedeemCashback = () => {
    showToast('Promotional cashback redemptions are disabled — only real Flutterwave deposits apply.');
  };

  const handleToggleFreezeCard = (cardId: string) => {
    commitState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, frozen: !c.frozen } : c)),
    }));
  };

  const handleUpdateCardLimit = (cardId: string, dailyLimit: number) => {
    commitState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, dailyLimit } : c)),
    }));
  };

  const handleCreateVirtualCard = () => {
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const newCard: BankCard = {
      id: `card_${Date.now()}`,
      label: `Virtual Card •${last4}`,
      scheme: 'Verve',
      kind: 'Virtual',
      maskedNumber: `5061 •••• •••• ${last4}`,
      fullNumber: `5061 8420 3319 ${last4}`,
      expiry: '11/30',
      cvv: String(Math.floor(100 + Math.random() * 900)),
      holderName: state.profile.fullName || state.profile.firstName,
      frozen: false,
      dailyLimit: 200000,
      currency: 'NGN',
    };
    commitState((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard],
    }));
    showToast(`Created Virtual Card ending in ${last4}`);
  };

  const handleMarkAllNotificationsRead = () => {
    commitState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  };

  const handleUpdateProfile = (patch: Partial<UserProfile>) => {
    commitState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
    showToast('Profile settings updated');
  };

  const handleSelectNavTab = (tab: NavTab) => {
    if (authStage === 'guest' && tab !== 'home') {
      setAuthStage('login');
      return;
    }
    setActiveTab(tab);
  };

  const totalWealth = state.savingsGoals.reduce((sum, g) => sum + g.savedAmount, 0);
  const totalBalance = state.balance + totalWealth;
  const unreadNotifications = state.notifications.filter((n) => !n.read).length;

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'wealth', label: 'Wealth', icon: TrendingUp },
    { id: 'cards', label: 'Cards', icon: CreditCard },
    { id: 'me', label: 'Me', icon: UserIcon },
  ];

  if (authStage === 'locked' && !showSplash) {
    return (
      <LockScreen
        firstName={state.profile.firstName}
        onUnlock={() => setAuthStage('authenticated')}
        onSignOut={handleSignOut}
        onReplaySplash={() => setShowSplash(true)}
      />
    );
  }

  if ((authStage === 'login' || authStage === 'signup') && !showSplash) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto bg-white text-[#1A1D23] select-none">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#1A1D23] text-white text-xs font-semibold shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}
        <AuthScreens
          mode={authStage}
          onSwitchMode={(nextMode) => setAuthStage(nextMode)}
          onBack={() => setAuthStage('guest')}
          onOpenHelp={() => setModal({ kind: 'assistant' })}
          onAuthComplete={handleAuthComplete}
        />
        <ActionModals
          modal={modal}
          onClose={() => setModal({ kind: 'none' })}
          onOpenModal={setModal}
          balance={state.balance}
          profile={state.profile}
          beneficiaries={INITIAL_BENEFICIARIES}
          transactions={state.transactions}
          notifications={state.notifications}
          loan={state.loan}
          onTransfer={handleTransfer}
          onPayBill={handlePayBill}
          onBorrowLoan={handleBorrowLoan}
          onRepayLoan={handleRepayLoan}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onUpdateProfile={handleUpdateProfile}
          onReplaySplash={() => setShowSplash(true)}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col lg:block lg:h-auto lg:min-h-screen lg:overflow-visible bg-[#F4F6F8] text-[#1A1D23] select-none">
      {/* Brand Splash Screen Overlay */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#1A1D23] text-white text-xs font-semibold shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Responsive Desktop + Mobile Shell */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:min-h-screen">
        {/* Desktop Left Navigation Rail */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:justify-between bg-white border-r border-gray-100 p-5 shrink-0 sticky top-0 h-screen">
          <div>
            <div className="flex items-center justify-between gap-2 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="p-0.5 rounded-full bg-[#F5EBDD]">
                  <OPayLogo
                    size={36}
                    showTierBadge={authStage === 'authenticated'}
                    tierNumber={state.profile.tier.replace(/\D/g, '') || '1'}
                  />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#1A1D23] leading-tight">E&amp;M Pay</div>
                  <div className="text-[11px] text-[#BA7E44] font-semibold">
                    {authStage === 'authenticated' ? `${state.profile.tier} Account` : 'Digital Banking'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSplash(true)}
                title="Replay Splash Screen"
                className="p-2 rounded-xl bg-[#F5EBDD] hover:bg-[#EBDDC9] text-[#BA7E44] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            <nav className="mt-5 space-y-1.5" aria-label="Main Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNavTab(item.id)}
                    className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-[14px] font-semibold transition-colors ${
                      active
                        ? 'bg-[#F5EBDD] text-[#BA7E44]'
                        : 'text-gray-600 hover:bg-[#F4F6F8] hover:text-[#1A1D23]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {authStage === 'guest' ? (
              <button
                type="button"
                onClick={() => setAuthStage('login')}
                className="mt-6 w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-[0_2px_10px_rgba(186,126,68,0.2)]"
              >
                Sign Up / Log In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModal({ kind: 'add-money' })}
                className="mt-6 w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-[0_2px_10px_rgba(186,126,68,0.2)]"
              >
                <Plus className="w-4 h-4" />
                Add Money
              </button>
            )}
          </div>

          {authStage !== 'guest' ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-[13.5px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthStage('signup')}
              className="w-full h-11 px-3.5 rounded-xl flex items-center justify-center text-[13px] font-semibold text-[#BA7E44] bg-[#F5EBDD] hover:bg-[#F5EBDD] transition-colors"
            >
              Create Account
            </button>
          )}
        </aside>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain lg:overflow-visible lg:px-8 lg:py-4">
          <div className="max-w-5xl mx-auto min-h-full">
            {activeTab === 'home' && authStage === 'guest' && (
              <GuestHomeView
                onOpenAuth={(screen) => setAuthStage(screen)}
                onOpenModal={setModal}
              />
            )}

            {activeTab === 'home' && authStage === 'authenticated' && (
              <HomeDashboard
                profile={state.profile}
                balance={state.balance}
                earnedToday={state.earnedToday}
                businessSalesToday={state.businessSalesToday}
                activeLoanBalance={state.loan.activeBalance}
                hideBalance={state.hideBalance}
                onToggleHideBalance={handleToggleHideBalance}
                latestTransaction={state.transactions[0]}
                unreadNotifications={unreadNotifications}
                onOpenModal={setModal}
                onSwitchTab={setActiveTab}
                onRefresh={handleRefreshDashboard}
              />
            )}

            {activeTab === 'rewards' && authStage === 'authenticated' && (
              <RewardsView
                cashbackBalance={state.cashbackBalance}
                checkedInToday={state.checkedInToday}
                onClaimDailyCheckIn={handleClaimDailyCheckIn}
                onRedeemCashback={handleRedeemCashback}
                onOpenModal={setModal}
              />
            )}

            {activeTab === 'wealth' && authStage === 'authenticated' && (
              <WealthView
                availableBalance={state.balance}
                savingsGoals={state.savingsGoals}
                hideBalance={state.hideBalance}
                onToggleHideBalance={handleToggleHideBalance}
                onMoveSavings={handleMoveSavings}
                onCreateGoal={handleCreateGoal}
              />
            )}

            {activeTab === 'cards' && authStage === 'authenticated' && (
              <CardsView
                cards={state.cards}
                onToggleFreeze={handleToggleFreezeCard}
                onUpdateLimit={handleUpdateCardLimit}
                onCreateVirtualCard={handleCreateVirtualCard}
              />
            )}

            {activeTab === 'me' && authStage === 'authenticated' && (
              <MeView
                profile={state.profile}
                totalBalance={totalBalance}
                earnedToday={state.earnedToday}
                hideBalance={state.hideBalance}
                onToggleHideBalance={handleToggleHideBalance}
                onOpenModal={setModal}
                onSwitchTab={setActiveTab}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        </main>

        {/* Pinned Bottom Tab Bar (Mobile & Tablet) */}
        <nav
          aria-label="Bottom Navigation"
          className="lg:hidden shrink-0 z-30 bg-white border-t border-gray-100 pb-safe"
        >
          <div className="grid grid-cols-5 h-[58px] items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNavTab(item.id)}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active ? 'text-[#BA7E44]' : 'text-[#6B7280] hover:text-[#1A1D23]'
                  }`}
                >
                  <Icon className={`w-[21px] h-[21px] ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
                  <span className={`text-[11px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Full-Page Airtime & Data Experience */}
      {authStage === 'authenticated' &&
        modal.kind === 'bills' &&
        (modal.service === 'airtime' || modal.service === 'data') && (
          <AirtimeDataPage
            mode={modal.service}
            balance={state.balance}
            profile={state.profile}
            transactions={state.transactions}
            onBack={() => setModal({ kind: 'none' })}
            onOpenHistory={() => setModal({ kind: 'transactions' })}
            onOpenAddMoney={() => setModal({ kind: 'add-money' })}
            onOpenUssd={() => setModal({ kind: 'ussd' })}
            onOpenTvBills={() => setModal({ kind: 'bills', service: 'tv' })}
            onPayBill={handlePayBill}
            onCompleteReceipt={(transaction) => setModal({ kind: 'receipt', transaction })}
          />
        )}



      {/* Full-Page E&M Pay Transactions History */}
      {authStage === 'authenticated' && modal.kind === 'transactions' && (
        <TransactionsPage
          transactions={state.transactions}
          onBack={() => {
            setReceiptReturnToHistory(false);
            setModal({ kind: 'none' });
          }}
          onSelectTransaction={(transaction) => {
            setReceiptReturnToHistory(true);
            setModal({ kind: 'receipt', transaction });
          }}
        />
      )}

      {/* Full-Page Transfer Experience (E&M Pay Registered Accounts & Other Banks) */}
      {authStage === 'authenticated' && modal.kind === 'transfer' && (
        <BankTransferPage
          mode={modal.mode}
          balance={state.balance}
          profile={state.profile}
          beneficiaries={INITIAL_BENEFICIARIES}
          transactions={state.transactions}
          onBack={() => setModal({ kind: 'none' })}
          onOpenHistory={() => setModal({ kind: 'transactions' })}
          onOpenAddMoney={() => setModal({ kind: 'add-money' })}
          onOpenWealth={() => {
            setModal({ kind: 'none' });
            setActiveTab('wealth');
          }}
          onOpenCards={() => {
            setModal({ kind: 'none' });
            setActiveTab('cards');
          }}
          onOpenBills={(service) => setModal({ kind: 'bills', service })}
          onTransfer={handleTransfer}
          onEmPayTransfer={handleEmPayTransfer}
          onCompleteReceipt={(transaction) => {
            setReceiptReturnToHistory(false);
            setModal({ kind: 'receipt', transaction });
          }}
        />
      )}

      {/* Kyc Identity Verification & Dedicated Bank Account Generation Modal */}
      {authStage === 'authenticated' && modal.kind === 'verify-kyc' && (
        <KycVerificationModal
          isOpen={true}
          profile={state.profile}
          virtualAccount={state.virtualAccount}
          initialIdType={modal.initialIdType}
          onClose={() => setModal({ kind: 'none' })}
          onVerificationComplete={(account, virtualAccount) => {
            commitState((prev) => ({
              ...prev,
              profile: account.profile,
              virtualAccount,
            }));
            showToast(`Bank account ready: ${virtualAccount.accountNumber}`);
          }}
        />
      )}

      {/* Full-Page Add Money (Flutterwave Bank Transfer & Card/USSD) */}
      {authStage === 'authenticated' && modal.kind === 'add-money' && (
        <AddMoneyPage
          balance={state.balance}
          profile={state.profile}
          initialVirtualAccount={state.virtualAccount}
          onBack={() => setModal({ kind: 'none' })}
          onOpenHistory={() => setModal({ kind: 'transactions' })}
          onDepositCredited={handleFlwDepositCredited}
          onVirtualAccountCreated={(account, virtualAccount) => {
            commitState((prev) => ({
              ...prev,
              profile: account.profile,
              virtualAccount,
            }));
            showToast(`Bank account ready: ${virtualAccount.accountNumber}`);
          }}
        />
      )}

      {/* Full-Page Transaction Details & Share Receipt */}
      {authStage === 'authenticated' && modal.kind === 'receipt' && (
        <TransactionReceiptPage
          transaction={modal.transaction}
          profile={state.profile}
          onBack={() => {
            if (receiptReturnToHistory) {
              setReceiptReturnToHistory(false);
              setModal({ kind: 'transactions' });
            } else {
              setModal({ kind: 'none' });
            }
          }}
          onReportIssue={(tx) => {
            setReceiptReturnToHistory(false);
            setModal({
              kind: 'assistant',
              topic: `Dispute for transaction ${tx.reference} (${formatNaira(tx.amount)})`,
            });
          }}
          onTransferAgain={(tx) => {
            setReceiptReturnToHistory(false);
            if (tx.category === 'deposit') {
              setModal({ kind: 'add-money' });
            } else if (tx.category === 'airtime' || tx.category === 'data') {
              setModal({ kind: 'bills', service: tx.category });
            } else if (tx.category === 'tv' || tx.category === 'betting') {
              setModal({ kind: 'bills', service: tx.category });
            } else {
              setModal({
                kind: 'transfer',
                mode: tx.bankName.includes('E&M') ? 'opay' : 'bank',
              });
            }
          }}
          onViewRecords={() => {
            setReceiptReturnToHistory(false);
            setModal({ kind: 'transactions' });
          }}
          onRefreshStatus={handleRefreshBankTransferStatus}
        />
      )}

      {/* Interactive Modals & Sheets */}
      <ActionModals
        modal={modal}
        onClose={() => setModal({ kind: 'none' })}
        onOpenModal={setModal}
        balance={state.balance}
        profile={state.profile}
        beneficiaries={INITIAL_BENEFICIARIES}
        transactions={state.transactions}
        notifications={state.notifications}
        loan={state.loan}
        onTransfer={handleTransfer}
        onPayBill={handlePayBill}
        onBorrowLoan={handleBorrowLoan}
        onRepayLoan={handleRepayLoan}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onUpdateProfile={handleUpdateProfile}
        onReplaySplash={() => setShowSplash(true)}
      />
    </div>
  );
}
