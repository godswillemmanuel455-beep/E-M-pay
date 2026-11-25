import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Delete,
  Landmark,
  Lightbulb,
  ListChecks,
  Loader2,
  Lock,
  Monitor,
  PiggyBank,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  UserPlus,
  Users,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { formatNaira, NIGERIAN_BANKS } from '../data/initialState';
import type { Beneficiary, Transaction, UserProfile } from '../types/banking';
import {
  fetchNigerianBanksApi,
  lookupAccountAcrossBanksApi,
  lookupEmPayAccountApi,
  resolveOtherBankAccountApi,
  type BankAccountMatch,
  type BankDirectoryItem,
} from '../utils/authApi';
import { OPayLogo } from './OPayLogo';

interface BankTransferPageProps {
  mode?: 'opay' | 'bank';
  balance: number;
  profile: UserProfile;
  beneficiaries: Beneficiary[];
  transactions: Transaction[];
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenAddMoney: () => void;
  onOpenWealth: () => void;
  onOpenCards?: () => void;
  onOpenBills?: (service: 'airtime' | 'data' | 'tv' | 'betting') => void;
  onTransfer: (params: {
    recipientName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    amount: number;
    note?: string;
    pin: string;
  }) =>
    | Promise<{ error?: string; transaction?: Transaction }>
    | { error?: string; transaction?: Transaction };
  onEmPayTransfer?: (params: {
    recipientIdentifier: string;
    amount: number;
    note?: string;
    pin: string;
  }) => Promise<{ error?: string; transaction?: Transaction }>;
  onCompleteReceipt: (transaction: Transaction) => void;
}

interface BankNetworkStatus {
  name: string;
  shortName: string;
  rate: number;
  status: 'Excellent' | 'Good' | 'Fair';
}

const DEFAULT_OTHER_BANKS: BankDirectoryItem[] = NIGERIAN_BANKS.filter(
  (b) => b !== 'E&M Pay Digital Services'
).map((name) => {
  const codeMap: Record<string, string> = {
    'Access Bank': '044',
    'GTBank (Guaranty Trust Bank)': '058',
    'Zenith Bank': '057',
    'First Bank of Nigeria': '011',
    'United Bank for Africa (UBA)': '033',
    'Kuda Microfinance Bank': '090267',
    'Moniepoint Microfinance Bank': '090405',
    'MoMo Payment Service Bank': '120003',
    PalmPay: '100033',
    'Fidelity Bank': '070',
    'Union Bank': '032',
    'Sterling Bank': '232',
    'Wema Bank (ALAT)': '035',
    'Stanbic IBTC Bank': '221',
    'First City Monument Bank (FCMB)': '214',
    'Polaris Bank': '076',
    'Ecobank Nigeria': '050',
  };
  return { code: codeMap[name] ?? '', name };
});

const POPULAR_BANKS: { label: string; code: string }[] = [
  { label: 'Access Bank', code: '044' },
  { label: 'Guaranty Trust Bank', code: '058' },
  { label: 'Zenith bank PLC', code: '057' },
  { label: 'First Bank PLC', code: '011' },
  { label: 'United Bank for Africa', code: '033' },
  { label: 'Moniepoint Microfinance Bank', code: '090405' },
  { label: 'Kuda', code: '090267' },
  { label: 'PALMPAY', code: '100033' },
];

function getShortBankLabel(bankName: string): string {
  const lower = bankName.toLowerCase();
  if (lower.includes('gtbank') || lower.includes('guaranty')) return 'GTBank';
  if (lower.includes('uba') || lower.includes('united bank for africa')) return 'UBA';
  if (lower.includes('first bank')) return 'FirstBank';
  if (lower.includes('zenith')) return 'Zenith';
  if (lower.includes('moniepoint')) return 'Moniepoint';
  if (lower.includes('kuda')) return 'Kuda';
  if (lower.includes('palmpay')) return 'PalmPay';
  if (lower.includes('fcmb') || lower.includes('first city monument')) return 'FCMB';
  if (lower.includes('wema')) return 'Wema Bank';
  if (lower.includes('momo')) return 'MoMo PSB';
  if (lower.includes('opay')) return 'OPay';
  return bankName;
}

const BankEmblem: React.FC<{ bankName: string; size?: number }> = ({
  bankName,
  size = 36,
}) => {
  const lower = bankName.toLowerCase();

  if (lower.includes('e&m pay')) {
    return <OPayLogo size={size} />;
  }

  if (lower.includes('moniepoint')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#F3F6FA] border border-gray-100 flex items-center justify-center shrink-0"
      >
        <span className="w-5 h-5 rounded-md bg-[#0361F0] text-white text-[11px] font-black flex items-center justify-center">
          M
        </span>
      </span>
    );
  }

  if (lower.includes('access')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center shrink-0"
      >
        <span className="text-[8.5px] font-extrabold text-[#EA580C] leading-none tracking-tight">
          access
        </span>
      </span>
    );
  }

  if (lower.includes('gtbank') || lower.includes('guaranty')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#FFF2EB] border border-[#FDBA74] flex items-center justify-center shrink-0"
      >
        <span className="w-5 h-5 rounded-sm bg-[#E04F16] text-white text-[8px] font-black flex items-center justify-center">
          GT
        </span>
      </span>
    );
  }

  if (lower.includes('zenith')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0"
      >
        <span className="text-[11px] font-black text-[#DC2626]">Z</span>
      </span>
    );
  }

  if (lower.includes('first bank')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0"
      >
        <span className="text-[10px] font-black text-[#1E3A8A]">FB</span>
      </span>
    );
  }

  if (lower.includes('uba') || lower.includes('united bank')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0"
      >
        <span className="text-[9px] font-black text-[#B91C1C]">UBA</span>
      </span>
    );
  }

  if (lower.includes('kuda')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center shrink-0"
      >
        <span className="text-[11px] font-black text-[#5B21B6]">K.</span>
      </span>
    );
  }

  if (lower.includes('palmpay')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center shrink-0"
      >
        <span className="text-[10px] font-black text-[#6D28D9]">PP</span>
      </span>
    );
  }

  if (lower.includes('opay')) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#F5EBDD] border border-[#BA7E44]/30 flex items-center justify-center shrink-0"
      >
        <span className="text-[9.5px] font-black text-[#9C6230]">OPay</span>
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-[#F5EBDD] text-[#9C6230] flex items-center justify-center shrink-0"
    >
      <Landmark className="w-[18px] h-[18px] stroke-[2]" />
    </span>
  );
};

export const BankTransferPage: React.FC<BankTransferPageProps> = ({
  mode = 'bank',
  balance,
  profile,
  beneficiaries,
  transactions,
  onBack,
  onOpenHistory,
  onOpenAddMoney,
  onOpenWealth,
  onOpenCards,
  onOpenBills,
  onTransfer,
  onEmPayTransfer,
  onCompleteReceipt,
}) => {
  const isEmPayMode = mode === 'opay';

  const [step, setStep] = useState<'recipient' | 'amount' | 'success'>('recipient');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState(
    isEmPayMode ? 'E&M Pay Digital Services' : ''
  );
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [reviewStage, setReviewStage] = useState<'none' | 'reminder' | 'payment'>('none');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [banksDirectory, setBanksDirectory] = useState<BankDirectoryItem[]>(DEFAULT_OTHER_BANKS);
  const [bankLookupStatus, setBankLookupStatus] = useState<
    'idle' | 'checking' | 'found' | 'not_found' | 'missing_key'
  >('idle');
  const [bankLookupError, setBankLookupError] = useState('');
  const [bankVerifiedAccount, setBankVerifiedAccount] = useState<{
    accountNumber: string;
    accountName: string;
  } | null>(null);

  const [emLookupStatus, setEmLookupStatus] = useState<
    'idle' | 'checking' | 'found' | 'not_found' | 'self'
  >('idle');
  const [emLookupError, setEmLookupError] = useState('');
  const [emVerifiedAccount, setEmVerifiedAccount] = useState<{
    accountNumber: string;
    fullName: string;
  } | null>(null);

  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [showSuccessMonitor, setShowSuccessMonitor] = useState(false);

  const [multiMatchStatus, setMultiMatchStatus] = useState<
    'idle' | 'searching' | 'done' | 'missing_key' | 'error'
  >('idle');
  const [multiBankMatches, setMultiBankMatches] = useState<BankAccountMatch[]>([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const lastVerifiedFromDropdownRef = useRef<{
    accountNumber: string;
    bankCode: string;
    accountName: string;
  } | null>(null);
  const lastMultiScanDigitsRef = useRef<string>('');

  const [activeListTab, setActiveListTab] = useState<'recents' | 'connections'>('recents');
  const [showListSearch, setShowListSearch] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');

  useEffect(() => {
    if (isEmPayMode) return;
    let cancelled = false;
    void fetchNigerianBanksApi().then((res) => {
      if (cancelled || !res.banks.length) return;
      setBanksDirectory(res.banks);
    });
    return () => {
      cancelled = true;
    };
  }, [isEmPayMode]);

  useEffect(() => {
    if (isEmPayMode) return;
    const digits = accountNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      setMultiMatchStatus('idle');
      setMultiBankMatches([]);
      setShowAccountDropdown(false);
      lastMultiScanDigitsRef.current = '';
      lastVerifiedFromDropdownRef.current = null;
      return;
    }

    if (lastMultiScanDigitsRef.current === digits) {
      return;
    }
    lastMultiScanDigitsRef.current = digits;

    let cancelled = false;
    setMultiMatchStatus('searching');
    setShowAccountDropdown(true);
    setMultiBankMatches([]);

    void lookupAccountAcrossBanksApi(digits).then((res) => {
      if (cancelled) return;
      if (res.ok && Array.isArray(res.data.matches)) {
        setMultiBankMatches(res.data.matches);
        setMultiMatchStatus('done');
      } else if (res.data.missingApiKey) {
        setMultiMatchStatus('missing_key');
        setMultiBankMatches([]);
      } else {
        setMultiMatchStatus('error');
        setMultiBankMatches([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accountNumber, isEmPayMode]);

  useEffect(() => {
    if (isEmPayMode) return;
    const digits = accountNumber.replace(/\D/g, '');
    if (digits.length !== 10 || !selectedBank) {
      setBankLookupStatus('idle');
      setBankLookupError('');
      setBankVerifiedAccount(null);
      return;
    }

    const picked = lastVerifiedFromDropdownRef.current;
    if (
      picked &&
      picked.accountNumber === digits &&
      picked.bankCode &&
      picked.bankCode === selectedBankCode
    ) {
      setBankLookupStatus('found');
      setBankLookupError('');
      setBankVerifiedAccount({
        accountNumber: picked.accountNumber,
        accountName: picked.accountName,
      });
      setRecipientName(picked.accountName);
      return;
    }

    let cancelled = false;
    setBankLookupStatus('checking');
    setBankLookupError('');
    setBankVerifiedAccount(null);

    void resolveOtherBankAccountApi({
      accountNumber: digits,
      bankCode: selectedBankCode || undefined,
      bankName: selectedBank,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data.accountName) {
        setBankLookupStatus('found');
        setBankLookupError('');
        setBankVerifiedAccount({
          accountNumber: res.data.accountNumber || digits,
          accountName: res.data.accountName,
        });
        setRecipientName(res.data.accountName);
      } else if (res.data.missingApiKey) {
        setBankLookupStatus('missing_key');
        setBankLookupError(
          res.data.error ||
            'Add FLW_SECRET_KEY in server Secrets for live Flutterwave account verification.'
        );
        setBankVerifiedAccount(null);
      } else {
        setBankLookupStatus('not_found');
        setBankLookupError(
          res.data.error ||
            'Account number could not be verified at the selected bank.'
        );
        setBankVerifiedAccount(null);
        setRecipientName('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank, selectedBankCode, isEmPayMode]);

  useEffect(() => {
    if (!isEmPayMode) return;
    const digits = accountNumber.replace(/\D/g, '');
    const readyForLookup =
      digits.length === 10 || (digits.length === 11 && digits.startsWith('0'));

    if (!readyForLookup) {
      setEmLookupStatus('idle');
      setEmLookupError('');
      setEmVerifiedAccount(null);
      return;
    }

    let cancelled = false;
    setEmLookupStatus('checking');
    setEmLookupError('');
    setEmVerifiedAccount(null);

    void lookupEmPayAccountApi(digits).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data.accountNumber && res.data.fullName) {
        if (res.data.accountNumber === profile.accountNumber) {
          setEmLookupStatus('self');
          setEmLookupError('You cannot transfer to your own E&M Pay account.');
          setEmVerifiedAccount(null);
          setRecipientName('');
          return;
        }
        setEmLookupStatus('found');
        setEmLookupError('');
        setEmVerifiedAccount({
          accountNumber: res.data.accountNumber,
          fullName: res.data.fullName,
        });
        setRecipientName(res.data.fullName);
      } else {
        setEmLookupStatus('not_found');
        setEmLookupError(
          res.data.error ||
            'This account number is not registered on E&M Pay. Only registered E&M Pay accounts are allowed.'
        );
        setEmVerifiedAccount(null);
        setRecipientName('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accountNumber, isEmPayMode, profile.accountNumber]);

  const recentRecipients = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; accountNumber: string; bankName: string }[] = [];
    for (const tx of transactions) {
      const isEmTx = tx.bankName === 'E&M Pay Digital Services';
      if (
        tx.category === 'transfer' &&
        tx.type === 'debit' &&
        (isEmPayMode ? isEmTx : !isEmTx) &&
        tx.accountNumber.length === 10
      ) {
        const key = `${tx.accountNumber}|${tx.bankName}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            name: tx.counterparty,
            accountNumber: tx.accountNumber,
            bankName: tx.bankName,
          });
        }
      }
    }
    return list;
  }, [transactions, isEmPayMode]);

  const connectionsList = useMemo(() => {
    return beneficiaries
      .filter((b) => (isEmPayMode ? b.isOpay : !b.isOpay))
      .map((b) => ({
        name: b.name,
        accountNumber: b.accountNumber,
        bankName: b.bankName,
      }));
  }, [beneficiaries, isEmPayMode]);

  const activeRecords = activeListTab === 'recents' ? recentRecipients : connectionsList;

  const filteredRecords = useMemo(() => {
    if (!listSearchQuery.trim()) return activeRecords;
    const q = listSearchQuery.toLowerCase();
    return activeRecords.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.accountNumber.includes(q) ||
        item.bankName.toLowerCase().includes(q)
    );
  }, [activeRecords, listSearchQuery]);

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return banksDirectory;
    const q = bankSearch.toLowerCase();
    return banksDirectory.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q)
    );
  }, [bankSearch, banksDirectory]);

  const selectBankChoice = (bankName: string, bankCode?: string) => {
    const lower = bankName.trim().toLowerCase();
    const aliasCode =
      bankCode ||
      (lower.includes('gtbank') || lower.includes('guaranty')
        ? '058'
        : lower.includes('uba') || lower.includes('united bank for africa')
        ? '033'
        : lower.includes('first bank')
        ? '011'
        : lower.includes('zenith')
        ? '057'
        : lower.includes('access')
        ? '044'
        : lower.includes('kuda')
        ? '090267'
        : lower.includes('moniepoint')
        ? '090405'
        : lower.includes('palmpay')
        ? '100033'
        : lower.includes('momo')
        ? '120003'
        : lower.includes('wema')
        ? '035'
        : '');

    const matched =
      banksDirectory.find(
        (b) =>
          (aliasCode && b.code === aliasCode) ||
          b.name.toLowerCase() === lower ||
          b.name.toLowerCase().includes(lower.split('(')[0].trim()) ||
          lower.includes(b.name.toLowerCase())
      ) ?? null;
    setSelectedBank(matched ? matched.name : bankName);
    setSelectedBankCode(matched?.code || aliasCode || '');
    setShowBankPicker(false);
    setBankSearch('');
    setFormError('');
  };

  const resolveAliasCode = (bankName: string): string => {
    const lower = bankName.trim().toLowerCase();
    if (lower.includes('gtbank') || lower.includes('guaranty')) return '058';
    if (lower.includes('uba') || lower.includes('united bank for africa')) return '033';
    if (lower.includes('first bank')) return '011';
    if (lower.includes('zenith')) return '057';
    if (lower.includes('access')) return '044';
    if (lower.includes('kuda')) return '090267';
    if (lower.includes('moniepoint')) return '090405';
    if (lower.includes('palmpay')) return '100033';
    if (lower.includes('opay')) return '100004';
    if (lower.includes('momo')) return '120003';
    if (lower.includes('wema')) return '035';
    if (lower.includes('fidelity')) return '070';
    if (lower.includes('sterling')) return '232';
    if (lower.includes('fcmb') || lower.includes('first city monument')) return '214';
    if (lower.includes('stanbic')) return '221';
    if (lower.includes('union')) return '032';
    if (lower.includes('polaris')) return '076';
    if (lower.includes('ecobank')) return '050';
    return '';
  };

  const combinedAccountMatches = useMemo(() => {
    if (isEmPayMode || accountNumber.length !== 10) return [];
    const seenCodes = new Set<string>();
    const list: BankAccountMatch[] = [];

    for (const m of multiBankMatches) {
      const key = m.bankCode || m.bankName.toLowerCase();
      if (!seenCodes.has(key)) {
        seenCodes.add(key);
        list.push(m);
      }
    }

    for (const r of [...recentRecipients, ...connectionsList]) {
      if (r.accountNumber !== accountNumber) continue;
      const code = resolveAliasCode(r.bankName);
      const key = code || r.bankName.toLowerCase();
      if (!seenCodes.has(key)) {
        seenCodes.add(key);
        list.push({
          bankCode: code,
          bankName: r.bankName,
          accountNumber: r.accountNumber,
          accountName: r.name,
          fromRecents: true,
        });
      }
    }

    return list;
  }, [isEmPayMode, accountNumber, multiBankMatches, recentRecipients, connectionsList]);

  const handleSelectMatchedAccount = (match: BankAccountMatch) => {
    const code = match.bankCode || resolveAliasCode(match.bankName);
    lastVerifiedFromDropdownRef.current = {
      accountNumber: match.accountNumber,
      bankCode: code,
      accountName: match.accountName,
    };
    selectBankChoice(match.bankName, code);
    setRecipientName(match.accountName);
    setBankVerifiedAccount({
      accountNumber: match.accountNumber,
      accountName: match.accountName,
    });
    setBankLookupStatus('found');
    setBankLookupError('');
    setShowAccountDropdown(false);
  };

  const matchedKnownName = useMemo(() => {
    if (isEmPayMode) return '';
    if (accountNumber.length !== 10 || !selectedBank) return '';
    const fromHistory = recentRecipients.find(
      (r) => r.accountNumber === accountNumber && r.bankName === selectedBank
    );
    if (fromHistory) return fromHistory.name;
    const fromBeneficiary = connectionsList.find(
      (c) => c.accountNumber === accountNumber && c.bankName === selectedBank
    );
    return fromBeneficiary?.name ?? '';
  }, [isEmPayMode, accountNumber, selectedBank, recentRecipients, connectionsList]);

  const bankNetworkStatuses: BankNetworkStatus[] = useMemo(
    () => [
      ...(isEmPayMode
        ? [
            {
              name: 'E&M Pay Digital Services',
              shortName: 'E&M Pay Wallet',
              rate: 100.0,
              status: 'Excellent' as const,
            },
          ]
        : []),
      { name: 'Access Bank', shortName: 'Access Bank', rate: 99.6, status: 'Excellent' },
      { name: 'GTBank (Guaranty Trust Bank)', shortName: 'GTBank', rate: 99.4, status: 'Excellent' },
      { name: 'Moniepoint Microfinance Bank', shortName: 'Moniepoint MFB', rate: 99.8, status: 'Excellent' },
      { name: 'Zenith Bank', shortName: 'Zenith Bank', rate: 98.9, status: 'Excellent' },
      { name: 'United Bank for Africa (UBA)', shortName: 'UBA', rate: 98.2, status: 'Excellent' },
      { name: 'First Bank of Nigeria', shortName: 'First Bank', rate: 96.5, status: 'Good' },
      { name: 'Kuda Microfinance Bank', shortName: 'Kuda', rate: 99.2, status: 'Excellent' },
      { name: 'MoMo Payment Service Bank', shortName: 'MoMo PSB', rate: 97.4, status: 'Good' },
      { name: 'PalmPay', shortName: 'PalmPay', rate: 99.5, status: 'Excellent' },
      { name: 'Fidelity Bank', shortName: 'Fidelity Bank', rate: 95.8, status: 'Good' },
    ],
    [isEmPayMode]
  );

  const isStep1Ready = isEmPayMode
    ? emLookupStatus === 'found' && Boolean(emVerifiedAccount)
    : accountNumber.length === 10 &&
      Boolean(selectedBank) &&
      bankLookupStatus !== 'checking';

  const handleGoToAmountStep = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (isEmPayMode) {
      if (emLookupStatus !== 'found' || !emVerifiedAccount) {
        setFormError(
          emLookupError || 'Enter a valid registered E&M Pay account number to continue.'
        );
        return;
      }
      setAccountNumber(emVerifiedAccount.accountNumber);
      setRecipientName(emVerifiedAccount.fullName);
      setSelectedBank('E&M Pay Digital Services');
      setStep('amount');
      return;
    }

    if (accountNumber.length !== 10) {
      setFormError('Please enter a valid 10-digit account number.');
      return;
    }
    if (!selectedBank) {
      setFormError('Please select the recipient bank.');
      return;
    }
    if (bankLookupStatus === 'checking') {
      setFormError('Verifying bank account details, please wait...');
      return;
    }
    if (bankLookupStatus === 'found' && bankVerifiedAccount) {
      setRecipientName(bankVerifiedAccount.accountName);
    } else if (!recipientName.trim() && matchedKnownName) {
      setRecipientName(matchedKnownName);
    }
    setStep('amount');
  };

  const handleSelectRecipientRow = (rec: {
    name: string;
    accountNumber: string;
    bankName: string;
  }) => {
    setAccountNumber(rec.accountNumber);
    if (isEmPayMode) {
      setSelectedBank(rec.bankName);
      setEmVerifiedAccount({ accountNumber: rec.accountNumber, fullName: rec.name });
      setEmLookupStatus('found');
    } else {
      selectBankChoice(rec.bankName);
    }
    setRecipientName(rec.name);
    setFormError('');
    setStep('amount');
  };

  const minTransferAmount = isEmPayMode ? 10 : 100;
  const parsedAmount = Number(amount) || 0;
  const isAmountValid = parsedAmount >= minTransferAmount && parsedAmount <= 5000000;

  const getMagnitudeLabel = (val: number): string => {
    if (!Number.isFinite(val) || val < 100) return '';
    if (val >= 1000000) return 'Millions';
    if (val >= 100000) return 'Hundred Thousands';
    if (val >= 10000) return 'Ten Thousands';
    if (val >= 1000) return 'Thousands';
    return 'Hundreds';
  };

  const handleKeypadKey = (key: string) => {
    setFormError('');
    if (key === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      setAmount((prev) => {
        if (prev.includes('.')) return prev;
        return prev ? `${prev}.` : '0.';
      });
      return;
    }
    setAmount((prev) => {
      if (prev === '0') return key;
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      if (prev.replace('.', '').length >= 9) return prev;
      return `${prev}${key}`;
    });
  };

  const handleOpenReminder = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError('');
    if (!recipientName.trim()) {
      setFormError('Please enter the recipient account name.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Please enter a valid transfer amount.');
      return;
    }
    if (parsedAmount < minTransferAmount) {
      setFormError(
        isEmPayMode
          ? 'Minimum transfer to an E&M Pay account is ₦10.'
          : 'Minimum transfer to another bank is ₦100.'
      );
      return;
    }
    if (parsedAmount > balance) {
      setFormError(`Insufficient balance (${formatNaira(balance)}). Tap Add Money to top up.`);
      return;
    }
    setReviewStage('reminder');
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const num = Number(amount);
    if (!recipientName.trim()) {
      setFormError('Please enter the recipient account name.');
      return;
    }
    if (!num || num < minTransferAmount) {
      setFormError(
        isEmPayMode
          ? 'Minimum transfer to an E&M Pay account is ₦10.'
          : 'Minimum transfer to another bank is ₦100.'
      );
      return;
    }
    if (pin.length !== 4) {
      setFormError('Enter your 4-digit E&M Pay transaction PIN.');
      return;
    }

    const combinedNote = [selectedCategory ? `[${selectedCategory}]` : '', note.trim()]
      .filter(Boolean)
      .join(' ');

    if (isEmPayMode && onEmPayTransfer) {
      setSubmitting(true);
      try {
        const res = await onEmPayTransfer({
          recipientIdentifier: emVerifiedAccount?.accountNumber ?? accountNumber,
          amount: num,
          note: combinedNote || undefined,
          pin,
        });
        if (res.error) {
          setFormError(res.error);
          return;
        }
        if (res.transaction) {
          setReviewStage('none');
          setCompletedTx(res.transaction);
          setNicknameDraft(res.transaction.counterparty);
          setSavedNickname('');
          setStep('success');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await onTransfer({
        recipientName: recipientName.trim().toUpperCase(),
        accountNumber,
        bankName: selectedBank,
        bankCode: selectedBankCode || undefined,
        amount: num,
        note: combinedNote || undefined,
        pin,
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      if (res.transaction) {
        setReviewStage('none');
        setCompletedTx(res.transaction);
        setNicknameDraft(res.transaction.counterparty);
        setSavedNickname('');
        setStep('success');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // STEP 5: Exact Transfer Successful Screen (Screenshot 1) in warm brown palette
  if (step === 'success' && completedTx) {
    const isPendingTx = completedTx.status === 'Pending';
    return (
      <div className="fixed inset-0 z-40 bg-[#FAF7F2] flex flex-col overflow-y-auto select-none">
        <div className="max-w-lg mx-auto w-full px-4 pt-4 pb-10 space-y-4">
          {/* Top-right Done button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 text-[15px] font-semibold text-[#BA7E44] hover:text-[#9C6230] transition-colors"
            >
              Done
            </button>
          </div>

          {/* Centered Status Icon + Amount */}
          <div className="flex flex-col items-center text-center pt-1 pb-2">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${
                isPendingTx ? 'bg-amber-600 text-white' : 'bg-[#BA7E44] text-white'
              }`}
            >
              {isPendingTx ? (
                <Clock className="w-7 h-7 stroke-[2.4]" />
              ) : (
                <Check className="w-7 h-7 stroke-[3]" />
              )}
            </div>
            <h1 className="mt-3 text-[18px] font-medium text-[#1A1D23]">
              {isPendingTx ? 'Transfer processing' : 'Transfer successful'}
            </h1>
            <div className="mt-1.5 text-[30px] font-extrabold font-mono-tabular text-[#1A1D23] tracking-tight">
              {formatNaira(completedTx.amount)}
            </div>
            {savedNickname && (
              <div className="mt-1 text-xs font-semibold text-[#9C6230]">
                Saved as: {savedNickname}
              </div>
            )}
          </div>

          {/* Bank Credit Expectation Banner */}
          <div className="bg-white rounded-2xl px-4 py-3.5 text-center text-[12.5px] text-gray-600 leading-relaxed shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[#F0E5D8]">
            {isEmPayMode
              ? 'The recipient E&M Pay wallet has been credited immediately.'
              : isPendingTx
              ? 'Your transfer has been submitted to Flutterwave and is expected to credit within 5 minutes.'
              : 'The recipient account is expected to be credited within 5 minutes, subject to notification by the bank.'}
          </div>

          {/* Edit Nickname inline drawer if open */}
          {editingNickname && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#BA7E44]/30 flex items-center gap-2">
              <input
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="Enter recipient nickname"
                className="flex-1 h-10 px-3 rounded-xl bg-[#FAF7F2] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]/40"
              />
              <button
                type="button"
                onClick={() => {
                  setSavedNickname(nicknameDraft.trim());
                  setEditingNickname(false);
                }}
                className="h-10 px-4 rounded-xl bg-[#BA7E44] text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          )}

          {/* 2x2 Action Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onCompleteReceipt(completedTx)}
              className="bg-white hover:bg-[#F5EBDD]/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[#F0E5D8] text-left transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span className="text-[13px] font-semibold text-[#1A1D23]">Share Receipt</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddMoney}
              className="bg-white hover:bg-[#F5EBDD]/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[#F0E5D8] text-left transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span className="text-[13px] font-semibold text-[#1A1D23]">Add Money</span>
            </button>

            <button
              type="button"
              onClick={() => setEditingNickname((prev) => !prev)}
              className="bg-white hover:bg-[#F5EBDD]/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[#F0E5D8] text-left transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span className="text-[13px] font-semibold text-[#1A1D23]">Edit Nickname</span>
            </button>

            <button
              type="button"
              onClick={() => onCompleteReceipt(completedTx)}
              className="bg-white hover:bg-[#F5EBDD]/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[#F0E5D8] text-left transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center shrink-0">
                <ListChecks className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span className="text-[13px] font-semibold text-[#1A1D23]">View Details</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#F5F6F8] flex flex-col overflow-hidden select-none">
      {/* Top App Bar */}
      <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (step === 'amount') {
                setStep('recipient');
                setReviewStage('none');
                setFormError('');
              } else {
                onBack();
              }
            }}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[17px] font-semibold text-[#1A1D23] truncate">
            {isEmPayMode ? 'Transfer to E&M Pay Account' : 'Transfer to Bank Account'}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="min-h-[44px] px-2 flex items-center text-[14.5px] font-medium text-[#BA7E44] hover:text-[#9C6230] whitespace-nowrap shrink-0"
        >
          History
        </button>
      </header>

      {/* Main Scrollable Viewport */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-3.5 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-5 items-start">
            {/* Left / Primary Flow Column */}
            <div className="lg:col-span-7 space-y-3.5">
              {step === 'recipient' ? (
                <>
                  {/* Recipient Account Input Card */}
                  <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                    <h2 className="text-[16px] font-bold text-[#1A1D23]">Recipient Account</h2>

                    <form onSubmit={handleGoToAmountStep} className="mt-4 space-y-1">
                      {/* 10 Digits Account Number Row */}
                      <div className="relative flex items-center border-b border-gray-100 focus-within:border-[#BA7E44] transition-colors">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={isEmPayMode ? 11 : 10}
                          value={accountNumber}
                          onChange={(e) => {
                            const maxLen = isEmPayMode ? 11 : 10;
                            const digits = e.target.value.replace(/\D/g, '').slice(0, maxLen);
                            setAccountNumber(digits);
                            setFormError('');
                            if (digits.length < 10) {
                              setRecipientName('');
                              setShowAccountDropdown(false);
                            }
                          }}
                          onFocus={() => {
                            if (
                              !isEmPayMode &&
                              accountNumber.length === 10 &&
                              (combinedAccountMatches.length > 0 || multiMatchStatus === 'searching')
                            ) {
                              setShowAccountDropdown(true);
                            }
                          }}
                          placeholder={
                            isEmPayMode
                              ? 'Enter 10 digits E&M Account Number'
                              : 'Enter 10 digits Account Number'
                          }
                          className="w-full h-12 pr-9 bg-transparent text-[15px] font-medium font-mono-tabular text-[#1A1D23] placeholder:font-sans placeholder:font-normal placeholder:text-[#9CA3AF] outline-none"
                        />
                        {accountNumber.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAccountNumber('');
                              setRecipientName('');
                              setFormError('');
                              setShowAccountDropdown(false);
                              setMultiBankMatches([]);
                              lastMultiScanDigitsRef.current = '';
                              lastVerifiedFromDropdownRef.current = null;
                            }}
                            aria-label="Clear account number"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* OPay-Style Registered Bank Accounts Dropdown */}
                      {!isEmPayMode && accountNumber.length === 10 && showAccountDropdown && (
                        <div className="mt-2 rounded-2xl border border-[#BA7E44]/25 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.09)] overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-[#FAF7F2] border-b border-gray-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {multiMatchStatus === 'searching' ? (
                                <Loader2 className="w-3.5 h-3.5 text-[#BA7E44] animate-spin shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#BA7E44] shrink-0" />
                              )}
                              <span className="text-[12px] font-semibold text-[#1A1D23] truncate">
                                {multiMatchStatus === 'searching'
                                  ? 'Finding accounts linked to this number...'
                                  : combinedAccountMatches.length > 0
                                  ? `${combinedAccountMatches.length} registered account${
                                      combinedAccountMatches.length > 1 ? 's' : ''
                                    } found — tap to select`
                                  : multiMatchStatus === 'missing_key'
                                  ? 'Live scan unavailable — select bank below'
                                  : 'No match found in top banks'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAccountDropdown(false)}
                              aria-label="Close account suggestions"
                              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {multiMatchStatus === 'searching' && combinedAccountMatches.length === 0 ? (
                            <div className="px-4 py-5 flex flex-col items-center justify-center gap-2 text-center">
                              <Loader2 className="w-5 h-5 text-[#BA7E44] animate-spin" />
                              <p className="text-xs text-gray-500">
                                Checking OPay, PalmPay, Moniepoint, Kuda, GTBank, Access &amp; more...
                              </p>
                            </div>
                          ) : combinedAccountMatches.length > 0 ? (
                            <div className="max-h-[250px] overflow-y-auto divide-y divide-gray-100">
                              {combinedAccountMatches.map((match) => {
                                const isPicked =
                                  Boolean(selectedBank) &&
                                  ((selectedBankCode && match.bankCode === selectedBankCode) ||
                                    selectedBank.toLowerCase() === match.bankName.toLowerCase());
                                return (
                                  <button
                                    key={`${match.bankCode}-${match.bankName}`}
                                    type="button"
                                    onClick={() => handleSelectMatchedAccount(match)}
                                    className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                                      isPicked ? 'bg-[#F5EBDD]/70' : 'hover:bg-[#F9FAFB]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <BankEmblem bankName={match.bankName} size={36} />
                                      <div className="min-w-0">
                                        <div className="text-[13.5px] font-bold text-[#1A1D23] uppercase truncate">
                                          {match.accountName}
                                        </div>
                                        <div className="text-[12px] text-gray-500 truncate">
                                          {getShortBankLabel(match.bankName)} ·{' '}
                                          <span className="font-mono-tabular">
                                            {match.accountNumber}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {isPicked ? (
                                      <span className="w-5 h-5 rounded-full bg-[#BA7E44] text-white flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </span>
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-3.5 py-3 flex items-center justify-between gap-3 bg-white">
                              <span className="text-xs text-gray-500">
                                Not in quick list? Choose manually from 700+ Nigerian banks.
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAccountDropdown(false);
                                  setShowBankPicker(true);
                                }}
                                className="text-xs font-semibold text-[#BA7E44] hover:underline shrink-0"
                              >
                                Browse Banks
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bank Row: locked to E&M Pay in opay mode, or Select Bank in bank mode */}
                      {isEmPayMode ? (
                        <div className="w-full h-13 border-b border-gray-100 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <OPayLogo size={28} />
                            <span className="text-[15px] font-medium text-[#1A1D23] truncate">
                              E&amp;M Pay Digital Services
                            </span>
                          </span>
                          <span className="text-[11.5px] font-medium text-[#BA7E44] whitespace-nowrap shrink-0">
                            Registered Only
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-13 border-b border-gray-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAccountDropdown(false);
                              setShowBankPicker(true);
                            }}
                            className="flex-1 min-w-0 h-full flex items-center justify-between gap-3 text-left group"
                          >
                            {selectedBank ? (
                              <span className="flex items-center gap-2.5 min-w-0">
                                <BankEmblem bankName={selectedBank} size={28} />
                                <span className="text-[15px] font-medium text-[#1A1D23] truncate">
                                  {selectedBank}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[15px] text-[#9CA3AF] group-hover:text-gray-600 transition-colors">
                                Select Bank
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          </button>

                          {accountNumber.length === 10 &&
                            !showAccountDropdown &&
                            combinedAccountMatches.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowAccountDropdown(true)}
                                className="px-2.5 py-1 rounded-full bg-[#F5EBDD] text-[11px] font-semibold text-[#9C6230] hover:bg-[#EBDDC9] shrink-0 transition-colors"
                              >
                                {combinedAccountMatches.length} match
                                {combinedAccountMatches.length > 1 ? 'es' : ''}
                              </button>
                            )}
                        </div>
                      )}

                      {/* Resolved Account Preview / E&M Registered Account Check */}
                      {isEmPayMode && emLookupStatus === 'checking' && (
                        <div className="pt-2.5 text-xs text-gray-500">
                          Verifying registered E&amp;M Pay account...
                        </div>
                      )}
                      {isEmPayMode && emLookupStatus === 'found' && emVerifiedAccount && (
                        <div className="pt-2.5">
                          <div className="px-3 py-2 rounded-xl bg-[#F5EBDD] flex items-center justify-between gap-2 text-[12.5px] font-semibold text-[#9C6230]">
                            <span className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-[#BA7E44] shrink-0" />
                              <span className="truncate">{emVerifiedAccount.fullName}</span>
                            </span>
                            <span className="text-[11px] font-medium text-[#9C6230] shrink-0">
                              E&amp;M Verified
                            </span>
                          </div>
                        </div>
                      )}
                      {isEmPayMode &&
                        (emLookupStatus === 'not_found' || emLookupStatus === 'self') &&
                        emLookupError && (
                          <div className="pt-2.5">
                            <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[12px] font-medium text-[#BE123C]">
                              {emLookupError}
                            </div>
                          </div>
                        )}
                      {!isEmPayMode && bankLookupStatus === 'checking' && (
                        <div className="pt-2.5 text-xs text-gray-500">
                          Verifying account details via Flutterwave...
                        </div>
                      )}
                      {!isEmPayMode &&
                        bankLookupStatus === 'found' &&
                        bankVerifiedAccount && (
                          <div className="pt-2.5">
                            <div className="px-3 py-2 rounded-xl bg-[#F5EBDD] flex items-center justify-between gap-2 text-[12.5px] font-semibold text-[#9C6230]">
                              <span className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-[#BA7E44] shrink-0" />
                                <span className="truncate">{bankVerifiedAccount.accountName}</span>
                              </span>
                              <span className="text-[11px] font-medium text-[#9C6230] shrink-0">
                                Verified
                              </span>
                            </div>
                          </div>
                        )}
                      {!isEmPayMode &&
                        bankLookupStatus === 'not_found' &&
                        bankLookupError && (
                          <div className="pt-2.5">
                            <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[12px] font-medium text-[#BE123C] flex items-center justify-between gap-2">
                              <span>{bankLookupError}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  lastVerifiedFromDropdownRef.current = null;
                                  setBankLookupStatus('checking');
                                  setBankLookupError('');
                                  void resolveOtherBankAccountApi({
                                    accountNumber: accountNumber.replace(/\D/g, ''),
                                    bankCode: selectedBankCode || undefined,
                                    bankName: selectedBank,
                                  }).then((res) => {
                                    if (res.ok && res.data.accountName) {
                                      setBankLookupStatus('found');
                                      setBankLookupError('');
                                      setBankVerifiedAccount({
                                        accountNumber: res.data.accountNumber || accountNumber,
                                        accountName: res.data.accountName,
                                      });
                                      setRecipientName(res.data.accountName);
                                    } else {
                                      setBankLookupStatus('not_found');
                                      setBankLookupError(
                                        res.data.error ||
                                          'Account number could not be verified at the selected bank.'
                                      );
                                    }
                                  });
                                }}
                                className="text-[11px] font-bold text-[#9C6230] underline shrink-0"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        )}
                      {!isEmPayMode &&
                        bankLookupStatus === 'missing_key' && (
                          <div className="pt-2.5">
                            <div className="px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[11.5px] font-medium text-[#92400E]">
                              Live bank lookup requires <span className="font-mono font-semibold">FLW_SECRET_KEY</span> in Secrets. You can still enter the account name on the next step.
                            </div>
                          </div>
                        )}
                      {!isEmPayMode &&
                        bankLookupStatus !== 'found' &&
                        matchedKnownName && (
                          <div className="pt-2.5">
                            <div className="px-3 py-2 rounded-xl bg-[#F5EBDD] flex items-center gap-2 text-[12.5px] font-semibold text-[#9C6230]">
                              <CheckCircle2 className="w-4 h-4 text-[#BA7E44] shrink-0" />
                              <span className="truncate">{matchedKnownName}</span>
                            </div>
                          </div>
                        )}

                      {formError && (
                        <p className="pt-2 text-xs font-medium text-red-500">{formError}</p>
                      )}

                      {/* Next Pill Button */}
                      <div className="pt-5">
                        <button
                          type="submit"
                          disabled={!isStep1Ready}
                          className={`w-full h-[48px] rounded-full text-[15px] font-semibold text-white transition-all ${
                            isStep1Ready
                              ? 'bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] shadow-[0_6px_16px_rgba(186,126,68,0.22)]'
                              : 'bg-[#EBDDC9] text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </form>
                  </section>

                  {/* Bank Transfer Success Rate Monitor Bar */}
                  <button
                    type="button"
                    onClick={() => setShowSuccessMonitor(true)}
                    className="w-full bg-white rounded-2xl px-4 py-3.5 min-h-[54px] flex items-center justify-between gap-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)] hover:bg-[#FAFAFA] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-[#F5EBDD] flex items-center justify-center shrink-0">
                        <Monitor className="w-[18px] h-[18px] text-[#BA7E44] stroke-[2]" />
                      </span>
                      <span className="text-[14.5px] font-medium text-[#1A1D23] truncate">
                        {isEmPayMode
                          ? 'E&M Transfer Success Rate Monitor'
                          : 'Bank Transfer Success Rate Monitor'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </>
              ) : (
                /* Step 2: Exact Screenshot 4 Amount, Remark, Category + Numeric Keypad */
                <div className="space-y-3">
                  {/* Recipient Summary Header */}
                  <div className="px-1 py-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <BankEmblem bankName={selectedBank} size={42} />
                      <div className="min-w-0">
                        <div className="text-[14.5px] font-bold text-[#1A1D23] uppercase truncate">
                          {recipientName.trim()
                            ? recipientName.trim().toUpperCase()
                            : getShortBankLabel(selectedBank)}
                        </div>
                        <div className="text-[12.5px] text-gray-500 font-mono-tabular truncate">
                          {accountNumber}{' '}
                          <span className="font-sans">
                            {isEmPayMode ? 'E&M Pay Digital Services' : selectedBank}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('recipient');
                        setReviewStage('none');
                        setFormError('');
                      }}
                      className="text-xs font-semibold text-[#BA7E44] hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  {!isEmPayMode && bankLookupStatus !== 'found' && (
                    <div className="bg-white rounded-2xl p-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Recipient Account Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => {
                          setRecipientName(e.target.value);
                          setFormError('');
                        }}
                        placeholder="Enter account holder full name"
                        className="w-full h-10 px-3 rounded-xl bg-[#F4F6F8] text-sm font-semibold uppercase text-[#1A1D23] placeholder:normal-case placeholder:font-normal outline-none focus:ring-2 focus:ring-[#BA7E44]"
                      />
                    </div>
                  )}

                  {/* Amount Card */}
                  <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#1A1D23]">Amount</span>
                      <span className="text-[11.5px] text-gray-500 tabular-nums">
                        Bal: <strong className="text-[#9C6230]">{formatNaira(balance)}</strong>
                      </span>
                    </div>

                    <div className="mt-3 pb-3 border-b border-gray-100">
                      {getMagnitudeLabel(parsedAmount) && (
                        <div className="mb-1 pl-6">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#F5EBDD] text-[#9C6230] text-[10px] font-bold">
                            {getMagnitudeLabel(parsedAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[22px] font-bold text-[#1A1D23]">₦</span>
                        <input
                          type="number"
                          min={minTransferAmount}
                          step="any"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setFormError('');
                          }}
                          placeholder={`${minTransferAmount.toFixed(2)} - 5,000,000.00`}
                          className="w-full bg-transparent text-[22px] font-bold font-mono-tabular text-[#1A1D23] placeholder:text-gray-300 placeholder:font-semibold outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Preset Row matching Screenshot 4 */}
                    <div className="mt-3 grid grid-cols-5 gap-1.5 items-start">
                      {(isEmPayMode
                        ? ['100', '500', '1000', '2000', '5000']
                        : ['4000', '500', '1000', '2000', '5000']
                      ).map((preset, idx) => (
                        <div key={preset} className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAmount(preset);
                              setFormError('');
                            }}
                            className={`w-full h-8 rounded-lg text-[11.5px] font-semibold tabular-nums transition-colors ${
                              amount === preset
                                ? 'bg-[#BA7E44] text-white'
                                : 'bg-[#F5F6F8] text-[#1A1D23] hover:bg-[#F5EBDD]'
                            }`}
                          >
                            ₦{Number(preset).toLocaleString()}
                          </button>
                          {idx === 0 && (
                            <span className="-mt-1 px-1.5 py-[1px] rounded-full bg-[#4A3525] text-white text-[8.5px] font-semibold whitespace-nowrap">
                              Most frequent
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remark Card */}
                  <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                    <div className="text-[14px] font-semibold text-[#1A1D23]">Remark</div>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What's this for?(Optional)"
                      className="mt-2.5 w-full pb-2 border-b border-gray-100 bg-transparent text-[13.5px] text-[#1A1D23] placeholder:text-gray-400 outline-none focus:border-[#BA7E44]"
                    />
                  </div>

                  {/* Category Card */}
                  <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#1A1D23]">Category</span>
                      <button
                        type="button"
                        onClick={() => setShowMoreCategories((v) => !v)}
                        className="inline-flex items-center gap-0.5 text-[12px] font-medium text-gray-500 hover:text-[#BA7E44]"
                      >
                        {showMoreCategories ? 'Less' : 'More'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11.5px] text-gray-400 mt-0.5">
                      only visible to you (optional)
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {[
                        { id: 'Food', icon: Utensils },
                        { id: 'Groceries', icon: ShoppingBag },
                        { id: 'Utilities', icon: Lightbulb },
                        { id: 'Family', icon: Users },
                        ...(showMoreCategories
                          ? [
                              { id: 'Transport', icon: Landmark },
                              { id: 'Rewards', icon: Zap },
                              { id: 'Savings', icon: PiggyBank },
                              { id: 'Other', icon: ShieldCheck },
                            ]
                          : []),
                      ].map((cat) => {
                        const Icon = cat.icon;
                        const active = selectedCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              setSelectedCategory((prev) => (prev === cat.id ? '' : cat.id))
                            }
                            aria-label={cat.id}
                            title={cat.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <span
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
                                active
                                  ? 'bg-[#F5EBDD] border-[#BA7E44] text-[#9C6230]'
                                  : 'bg-[#F5F6F8] border-transparent text-[#1A1D23] hover:bg-[#F5EBDD]/50'
                              }`}
                            >
                              <Icon className="w-4 h-4 stroke-[1.9]" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formError && (
                    <p className="text-xs font-medium text-red-500 px-1">{formError}</p>
                  )}

                  {/* Custom Numeric Keypad + Tall Confirm Button matching Screenshot 4 */}
                  <div className="bg-[#F0F2F5] rounded-2xl p-2 grid grid-cols-4 gap-2">
                    {['1', '2', '3'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadKey(digit)}
                        className="h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] text-[20px] font-medium text-[#1A1D23] shadow-2xs transition-transform"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleKeypadKey('backspace')}
                      aria-label="Backspace"
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] flex items-center justify-center text-[#1A1D23] shadow-2xs transition-transform"
                    >
                      <Delete className="w-5 h-5" />
                    </button>

                    {['4', '5', '6'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadKey(digit)}
                        className="h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] text-[20px] font-medium text-[#1A1D23] shadow-2xs transition-transform"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleOpenReminder()}
                      disabled={!isAmountValid}
                      className={`row-span-3 rounded-xl text-[15px] font-semibold flex items-center justify-center transition-all ${
                        isAmountValid
                          ? 'bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white shadow-sm'
                          : 'bg-[#EBDDC9] text-[#9C6230]/70 cursor-not-allowed'
                      }`}
                    >
                      Confirm
                    </button>

                    {['7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadKey(digit)}
                        className="h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] text-[20px] font-medium text-[#1A1D23] shadow-2xs transition-transform"
                      >
                        {digit}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleKeypadKey('.')}
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] text-[20px] font-bold text-[#1A1D23] shadow-2xs transition-transform"
                    >
                      .
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadKey('0')}
                      className="col-span-2 h-12 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.97] text-[20px] font-medium text-[#1A1D23] shadow-2xs transition-transform"
                    >
                      0
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right / Recents & Connections Column */}
            <div className="lg:col-span-5">
              <section className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                {/* Recents / Connections Tab Header */}
                <div className="px-4 pt-3.5 pb-2 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-7">
                    <button
                      type="button"
                      onClick={() => setActiveListTab('recents')}
                      className={`relative pb-2 text-[15px] font-semibold transition-colors ${
                        activeListTab === 'recents'
                          ? 'text-[#BA7E44]'
                          : 'text-[#6B7280] hover:text-[#1A1D23]'
                      }`}
                    >
                      Recents
                      {activeListTab === 'recents' && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2.5px] rounded-full bg-[#BA7E44]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveListTab('connections')}
                      className={`relative pb-2 text-[15px] font-semibold transition-colors ${
                        activeListTab === 'connections'
                          ? 'text-[#BA7E44]'
                          : 'text-[#6B7280] hover:text-[#1A1D23]'
                      }`}
                    >
                      Connections
                      {activeListTab === 'connections' && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2.5px] rounded-full bg-[#BA7E44]" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowListSearch((v) => !v);
                      setListSearchQuery('');
                    }}
                    aria-label="Search recipients"
                    className="min-w-[40px] min-h-[40px] -mr-1.5 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#BA7E44] transition-colors"
                  >
                    <Search className="w-[18px] h-[18px] stroke-[2.2]" />
                  </button>
                </div>

                {/* Search Box */}
                {showListSearch && (
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-[#FAFAFA]">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={listSearchQuery}
                        onChange={(e) => setListSearchQuery(e.target.value)}
                        placeholder="Search name, bank, or account no..."
                        autoFocus
                        className="w-full h-9 pl-9 pr-3 rounded-xl bg-white border border-gray-200 text-xs text-[#1A1D23] outline-none focus:border-[#BA7E44]"
                      />
                    </div>
                  </div>
                )}

                {/* Recipient Rows or Empty State */}
                {filteredRecords.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <div className="w-11 h-11 rounded-full bg-[#F5EBDD] text-[#BA7E44] flex items-center justify-center mx-auto">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <p className="mt-3 text-[13.5px] font-semibold text-[#1A1D23]">
                      {activeListTab === 'recents'
                        ? 'No Recent Bank Transfers Yet'
                        : 'No Saved Connections Yet'}
                    </p>
                    <p className="mt-1 text-[12px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                      {listSearchQuery.trim()
                        ? 'No recipient matched your search.'
                        : 'Recipients you send money to will appear here automatically for quick 1-tap transfers.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredRecords.map((item) => (
                      <button
                        key={`${item.accountNumber}-${item.bankName}`}
                        type="button"
                        onClick={() => handleSelectRecipientRow(item)}
                        className="w-full px-4 py-3.5 min-h-[64px] flex items-center justify-between gap-3 text-left hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-[#1A1D23] leading-snug uppercase truncate">
                            {item.name}
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-gray-500 font-mono-tabular truncate">
                            {item.accountNumber}{' '}
                            <span className="font-sans">{item.bankName}</span>
                          </div>
                        </div>
                        <BankEmblem bankName={item.bankName} size={36} />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="mt-3 px-2 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-500">
                <ShieldCheck className="w-3.5 h-3.5 text-[#BA7E44]" />
                <span>Secured by E&amp;M Pay NIP Transfer Guard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Select Bank Full-Height Sheet */}
      {showBankPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBankPicker(false);
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[88vh] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-[16px] font-bold text-[#1A1D23]">Select Bank</h2>
              <button
                type="button"
                onClick={() => setShowBankPicker(false)}
                aria-label="Close bank picker"
                className="w-9 h-9 rounded-full bg-[#F4F6F8] hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search bank name..."
                  autoFocus
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F4F6F8] text-sm text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
              {!bankSearch.trim() && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2.5">
                    Frequently Used Banks
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {POPULAR_BANKS.map((bank) => {
                      const active =
                        selectedBankCode === bank.code ||
                        selectedBank.toLowerCase() === bank.label.toLowerCase();
                      return (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => selectBankChoice(bank.label, bank.code)}
                          className={`p-2.5 rounded-2xl flex flex-col items-center gap-1.5 text-center transition-colors ${
                            active
                              ? 'bg-[#F5EBDD] ring-1 ring-[#BA7E44]'
                              : 'bg-[#F8FAFC] hover:bg-[#F5EBDD]/60'
                          }`}
                        >
                          <BankEmblem bankName={bank.label} size={34} />
                          <span className="text-[11px] font-medium text-[#1A1D23] leading-tight line-clamp-1">
                            {getShortBankLabel(bank.label)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">All Banks</div>
                <div className="divide-y divide-gray-100">
                  {filteredBanks.map((bank) => {
                    const active =
                      (selectedBankCode && bank.code === selectedBankCode) ||
                      selectedBank === bank.name;
                    return (
                      <button
                        key={`${bank.code}-${bank.name}`}
                        type="button"
                        onClick={() => selectBankChoice(bank.name, bank.code)}
                        className="w-full py-3 px-1 flex items-center justify-between gap-3 text-left hover:bg-[#F9FAFB] rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BankEmblem bankName={bank.name} size={34} />
                          <span className="text-[14px] font-medium text-[#1A1D23] truncate">
                            {bank.name}
                          </span>
                        </div>
                        {active && <Check className="w-4 h-4 text-[#BA7E44] shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredBanks.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No matching bank found.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Transfer Success Rate Monitor Sheet */}
      {showSuccessMonitor && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSuccessMonitor(false);
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[82vh] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-[#1A1D23]">
                  Bank Transfer Success Rate Monitor
                </h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Live NIP bank network stability · Tap any bank to select
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSuccessMonitor(false)}
                aria-label="Close success rate monitor"
                className="w-9 h-9 rounded-full bg-[#F4F6F8] hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 divide-y divide-gray-100">
              {bankNetworkStatuses.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    selectBankChoice(item.name);
                    setShowSuccessMonitor(false);
                  }}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F9FAFB] rounded-xl px-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BankEmblem bankName={item.name} size={34} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[#1A1D23] truncate">
                        {item.shortName}
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        {item.status} transfer network
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-bold text-[#BA7E44] tabular-nums">
                      {item.rate.toFixed(1)}%
                    </div>
                    <div className="text-[10.5px] text-gray-400">Success Rate</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* STEP 3: Reminder Confirmation Sheet (Screenshot 3) */}
      {reviewStage === 'reminder' && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviewStage('none');
          }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReviewStage('none')}
                aria-label="Close reminder"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center -mt-3">
              <h2 className="text-[19px] font-bold text-[#1A1D23]">Reminder</h2>
              <p className="mt-2 text-[13px] text-gray-600 leading-relaxed max-w-xs mx-auto">
                Double check the transfer details before you proceed. Please note that successful transfers cannot be reversed.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F9FA] p-4 space-y-3 text-[13.5px]">
              <div className="font-bold text-[#1A1D23]">Transaction Details</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-[#1A1D23] uppercase text-right truncate">
                  {recipientName.trim().toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Account No.</span>
                <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                  {accountNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Bank</span>
                <span className="font-semibold text-[#1A1D23] text-right truncate">
                  {isEmPayMode ? 'E&M Pay Digital Services' : selectedBank}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3 pt-1">
                <span className="text-gray-500">Amount</span>
                <div className="text-right">
                  {getMagnitudeLabel(parsedAmount) && (
                    <div className="mb-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#F5EBDD] text-[#9C6230] text-[10px] font-bold">
                        {getMagnitudeLabel(parsedAmount)}
                      </span>
                    </div>
                  )}
                  <span className="font-extrabold font-mono-tabular text-[15px] text-[#1A1D23]">
                    {formatNaira(parsedAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setReviewStage('none')}
                className="h-12 rounded-full bg-[#F5EBDD] hover:bg-[#EBDDC9] text-[#9C6230] text-[14.5px] font-semibold transition-colors"
              >
                Recheck
              </button>
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setFormError('');
                  setReviewStage('payment');
                }}
                className="h-12 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] text-white text-[14.5px] font-semibold transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Payment Review & Payment PIN Sheet (Screenshot 2) */}
      {reviewStage === 'payment' && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setReviewStage('none');
          }}
        >
          <form
            onSubmit={handleConfirmTransfer}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => !submitting && setReviewStage('none')}
                aria-label="Close payment review"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-[12.5px] font-semibold text-[#BA7E44]">Use Payment PIN</span>
            </div>

            <div className="text-center text-[28px] font-extrabold font-mono-tabular text-[#1A1D23]">
              {formatNaira(parsedAmount)}
            </div>

            <div className="rounded-2xl bg-[#F8F9FA] p-4 space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Bank</span>
                <span className="font-semibold text-[#1A1D23] text-right truncate">
                  {isEmPayMode ? 'E&M Pay Digital Services' : selectedBank}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Account Number</span>
                <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                  {accountNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-[#1A1D23] uppercase text-right truncate">
                  {recipientName.trim().toUpperCase()}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <span className="text-gray-500">Amount</span>
                <div className="text-right">
                  {getMagnitudeLabel(parsedAmount) && (
                    <div className="mb-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#F5EBDD] text-[#9C6230] text-[10px] font-bold">
                        {getMagnitudeLabel(parsedAmount)}
                      </span>
                    </div>
                  )}
                  <span className="font-bold font-mono-tabular text-[#1A1D23]">
                    {formatNaira(parsedAmount)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Fee</span>
                <span className="font-semibold font-mono-tabular text-[#1A1D23]">₦0.00</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-gray-500">Payment Method</span>
                <span className="text-gray-500 inline-flex items-center gap-0.5">
                  All <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="rounded-2xl bg-[#F8F9FA] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1A1D23]">
                    <span className="w-5 h-5 rounded-full bg-[#F5EBDD] border-2 border-[#BA7E44] shrink-0" />
                    <span className="tabular-nums">
                      Available Balance ({formatNaira(balance)})
                    </span>
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <span className="w-5 h-5 rounded-full bg-[#BA7E44] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                </div>

                <div className="border-t border-dashed border-gray-200 pt-2 flex items-center justify-between text-[12px] text-gray-500">
                  <span>E&amp;M Wallet</span>
                  <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                    -{formatNaira(parsedAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4-Digit Payment PIN */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-[#BA7E44]" />
                Enter 4-Digit Payment PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setFormError('');
                }}
                placeholder="••••"
                className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-center text-lg font-bold tracking-[0.5em] font-mono-tabular text-[#1A1D23] outline-none focus:ring-2 focus:ring-[#BA7E44]"
              />
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-500 text-center">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || pin.length !== 4}
              className="w-full h-12 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:bg-[#EBDDC9] disabled:text-gray-500 active:scale-[0.98] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Transfer...
                </>
              ) : (
                'Pay'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
