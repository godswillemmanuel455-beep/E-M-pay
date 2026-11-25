import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { formatNaira } from '../data/initialState';
import type { Transaction, TransactionCategory, UserProfile } from '../types/banking';
import { fetchLiveDataPlansApi } from '../utils/authApi';
import {
  CARRIER_DIRECTORY,
  type CarrierId,
  type DataPlanOption,
  formatNigerianPhoneDisplay,
  getDataPlansForCarrier,
  identifyNigerianPhone,
  normalizeToNigerian11,
} from '../utils/nigerianTelecom';

interface AirtimeDataPageProps {
  mode: 'airtime' | 'data';
  balance: number;
  profile: UserProfile;
  transactions: Transaction[];
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenAddMoney: () => void;
  onOpenUssd: () => void;
  onOpenTvBills: () => void;
  onPayBill: (params: {
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
  }) => Promise<{ error?: string; transaction?: Transaction }>;
  onCompleteReceipt: (transaction: Transaction) => void;
}

interface AirtimePreset {
  faceValue: number;
  payValue: number;
  cashback: number;
}

const AIRTIME_PRESETS: AirtimePreset[] = [
  { faceValue: 100, payValue: 100, cashback: 1.0 },
  { faceValue: 200, payValue: 200, cashback: 2.0 },
  { faceValue: 300, payValue: 300, cashback: 3.0 },
  { faceValue: 400, payValue: 400, cashback: 4.0 },
  { faceValue: 500, payValue: 490, cashback: 4.5 },
  { faceValue: 1000, payValue: 990, cashback: 9.0 },
];

const SELECTABLE_CARRIERS: CarrierId[] = ['mtn', 'airtel', 'glo', '9mobile', 'ntel', 'smile'];

const CarrierBadge: React.FC<{ carrierId: CarrierId; size?: number }> = ({
  carrierId,
  size = 34,
}) => {
  if (carrierId === 'airtel') {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#E60000] text-white flex flex-col items-center justify-center shrink-0 shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white -mb-0.5" aria-hidden="true">
          <path d="M13.8 4.2c-3.7 0-6.8 2.8-6.8 6.4 0 1.4.4 2.7 1.2 3.7 1.3-2.6 3.5-4.3 6.2-4.6 1.9-.2 3.1.9 2.9 2.4-.2 1.6-1.8 3-4.1 3.3-1.4.2-2.7-.2-3.5-1 .6 2.9 3.1 5 6.2 5 3.6 0 6.3-2.8 6.3-6.5 0-4.9-3.6-8.7-8.4-8.7z" />
        </svg>
        <span className="text-[7px] font-bold tracking-tight leading-none">airtel</span>
      </span>
    );
  }

  if (carrierId === 'mtn') {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#FFCC00] text-[#1A1D23] flex items-center justify-center shrink-0 shadow-xs border border-[#F5B800]"
      >
        <span className="px-1 py-0.5 rounded-full border border-[#1A1D23] text-[8.5px] font-black tracking-tight leading-none">
          MTN
        </span>
      </span>
    );
  }

  if (carrierId === 'glo') {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#1E293B] text-white flex items-center justify-center shrink-0 shadow-xs"
      >
        <span className="text-[11px] font-black tracking-tight lowercase leading-none">glo</span>
      </span>
    );
  }

  if (carrierId === '9mobile') {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#BA7E44] text-white flex items-center justify-center shrink-0 shadow-xs"
      >
        <span className="text-[9px] font-extrabold tracking-tight leading-none">9mob</span>
      </span>
    );
  }

  const info = CARRIER_DIRECTORY[carrierId];
  return (
    <span
      style={{ width: size, height: size, backgroundColor: info.bgHex, color: info.textHex }}
      className="rounded-full flex items-center justify-center shrink-0 shadow-xs"
    >
      <span className="text-[9.5px] font-bold tracking-tight leading-none">{info.shortLabel}</span>
    </span>
  );
};

export const AirtimeDataPage: React.FC<AirtimeDataPageProps> = ({
  mode,
  balance,
  profile,
  transactions,
  onBack,
  onOpenHistory,
  onOpenAddMoney,
  onOpenUssd,
  onOpenTvBills,
  onPayBill,
  onCompleteReceipt,
}) => {
  const initialDigits = profile.phone || profile.accountNumber || '';
  const [phoneInput, setPhoneInput] = useState(() =>
    initialDigits
      ? formatNigerianPhoneDisplay(identifyNigerianPhone(initialDigits).normalized11)
      : ''
  );
  const [manualCarrier, setManualCarrier] = useState<CarrierId | null>(null);
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);

  // Banner carousel state
  const [bannerIdx, setBannerIdx] = useState(0);

  // Airtime state
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPresetFace, setSelectedPresetFace] = useState<number | null>(null);

  // Data state
  const [dataTab, setDataTab] = useState<DataPlanOption['category']>('Hot');
  const [selectedDataPlanId, setSelectedDataPlanId] = useState<string>('');
  const [liveDataPlans, setLiveDataPlans] = useState<DataPlanOption[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Checkout PIN sheet state
  const [showCheckout, setShowCheckout] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [paying, setPaying] = useState(false);

  const phoneInfo = useMemo(() => identifyNigerianPhone(phoneInput), [phoneInput]);

  // Active carrier: manual override if user explicitly switched carrier (for ported numbers), else auto-detected from prefix
  const activeCarrierId: CarrierId = manualCarrier ?? phoneInfo.carrierId;
  const activeCarrier = CARRIER_DIRECTORY[activeCarrierId];

  // Fetch live Flutterwave data bundles when viewing Data tab for a recognized carrier
  useEffect(() => {
    if (mode !== 'data') return;
    const carrierToFetch =
      activeCarrierId === 'mtn' ||
      activeCarrierId === 'airtel' ||
      activeCarrierId === 'glo' ||
      activeCarrierId === '9mobile'
        ? activeCarrierId
        : 'mtn';

    let cancelled = false;
    setLoadingPlans(true);
    void fetchLiveDataPlansApi(carrierToFetch)
      .then((res) => {
        if (cancelled) return;
        setLiveDataPlans(res.plans.length > 0 ? res.plans : []);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, activeCarrierId]);

  // Recent numbers pulled only from user's own real airtime/data transactions (zero fake contacts)
  const recentNumbers = useMemo(() => {
    const seen = new Set<string>();
    const list: { phone: string; label: string; carrierId: CarrierId }[] = [];

    if (profile.phone) {
      const id = identifyNigerianPhone(profile.phone);
      if (id.normalized11) {
        seen.add(id.normalized11);
        list.push({
          phone: id.normalized11,
          label: `My Number (${profile.firstName})`,
          carrierId: id.carrierId,
        });
      }
    }

    for (const tx of transactions) {
      if (tx.category === 'airtime' || tx.category === 'data') {
        const id = identifyNigerianPhone(tx.accountNumber);
        if (id.isValidLength && !seen.has(id.normalized11)) {
          seen.add(id.normalized11);
          list.push({
            phone: id.normalized11,
            label: tx.counterparty,
            carrierId: id.carrierId,
          });
        }
      }
    }
    return list;
  }, [profile.phone, profile.firstName, transactions]);

  const allCarrierPlans = useMemo(() => {
    const fallback = getDataPlansForCarrier(activeCarrierId);
    if (liveDataPlans.length === 0) return fallback;
    // Prefer live Flutterwave plans; keep any missing category buckets populated from fallback
    const liveCats = new Set(liveDataPlans.map((p) => p.category));
    const supplements = fallback.filter((p) => !liveCats.has(p.category));
    return [...liveDataPlans, ...supplements];
  }, [activeCarrierId, liveDataPlans]);

  const dataPlans = useMemo(
    () => allCarrierPlans.filter((p) => p.category === dataTab),
    [allCarrierPlans, dataTab]
  );

  const selectedDataPlan = useMemo(() => {
    return allCarrierPlans.find((p) => p.id === selectedDataPlanId) ?? dataPlans[0] ?? null;
  }, [allCarrierPlans, selectedDataPlanId, dataPlans]);

  const handlePhoneChange = (raw: string) => {
    const rawDigits = raw.replace(/\D/g, '');
    const normalized =
      rawDigits.startsWith('234') || (rawDigits.length === 10 && /^[789]/.test(rawDigits))
        ? normalizeToNigerian11(rawDigits)
        : rawDigits.slice(0, 11);
    setPhoneInput(formatNigerianPhoneDisplay(normalized));
    // Re-enable automatic network identification whenever prefix changes
    setManualCarrier(null);
  };

  // Compute airtime pricing & cashback
  const parsedAmount = Number(customAmount.replace(/,/g, '')) || 0;
  const matchedPreset = AIRTIME_PRESETS.find((p) => p.faceValue === parsedAmount);
  const airtimeBasePay = parsedAmount;
  const rawPayable =
    mode === 'airtime' ? airtimeBasePay : selectedDataPlan ? selectedDataPlan.price : 0;
  const finalPayable = rawPayable;

  const isAirtimeReady =
    mode === 'airtime' &&
    phoneInfo.isValidLength &&
    parsedAmount >= 50 &&
    parsedAmount <= 500000;
  const isDataReady = mode === 'data' && phoneInfo.isValidLength && Boolean(selectedDataPlan);
  const canPay = mode === 'airtime' ? isAirtimeReady : isDataReady;

  const handleSelectAirtimePreset = (preset: AirtimePreset) => {
    setSelectedPresetFace(preset.faceValue);
    setCustomAmount(String(preset.faceValue));
  };

  const handleOpenCheckout = () => {
    if (!canPay) return;
    setPinInput('');
    setCheckoutError('');
    setShowCheckout(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paying) return;
    if (pinInput.length !== 4) {
      setCheckoutError('Enter your 4-digit Transaction PIN.');
      return;
    }
    if (finalPayable > balance) {
      setCheckoutError(`Insufficient balance (${formatNaira(balance)}). Add money to continue.`);
      return;
    }

    const carrierTitle =
      activeCarrierId === 'unknown' ? 'Nigerian Network' : activeCarrier.name.replace(' Nigeria', '');

    const title =
      mode === 'airtime'
        ? `${carrierTitle} Airtime ₦${parsedAmount.toLocaleString()}`
        : `${carrierTitle} ${selectedDataPlan?.size ?? ''} Data (${selectedDataPlan?.validity ?? ''})`;

    const cashbackEarned = 0;

    setPaying(true);
    setCheckoutError('');
    try {
      const res = await onPayBill({
        title,
        counterparty: carrierTitle,
        accountNumber: phoneInfo.normalized11,
        amount: finalPayable,
        faceAmount: mode === 'airtime' ? parsedAmount : selectedDataPlan?.price,
        category: mode,
        carrier: activeCarrierId === 'unknown' ? phoneInfo.carrierId : activeCarrierId,
        billerCode: mode === 'data' ? selectedDataPlan?.billerCode : undefined,
        itemCode: mode === 'data' ? selectedDataPlan?.itemCode : undefined,
        billType: mode === 'data' ? selectedDataPlan?.billType : 'AIRTIME',
        cashbackEarned,
        pin: pinInput,
      });

      if (res.error) {
        setCheckoutError(res.error);
        return;
      }

      setShowCheckout(false);
      if (res.transaction) {
        onCompleteReceipt(res.transaction);
      }
    } finally {
      setPaying(false);
    }
  };

  const banners = [
    {
      kicker: '🎄 Season’s Greetings',
      headline: 'Instant Top-Up On All Nigerian Networks',
      onClick: onOpenUssd,
    },
    {
      kicker: 'TV Expired?',
      headline: 'Bring The Entertainment Back',
      onClick: onOpenTvBills,
    },
    {
      kicker: 'Dial *955#',
      headline: 'Recharge Offline Anytime, Anywhere',
      onClick: onOpenUssd,
    },
  ];
  const currentBanner = banners[bannerIdx];

  return (
    <div className="fixed inset-0 z-40 bg-[#F4F6F8] flex flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <header className="shrink-0 bg-white px-3 sm:px-6 h-[52px] flex items-center justify-between border-b border-gray-100/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1A1D23] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <h1 className="text-[18px] font-medium text-[#1A1D23] tracking-tight">
            {mode === 'airtime' ? 'Airtime' : 'Data'}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="min-h-[40px] px-2 flex items-center text-[15px] font-medium text-[#BA7E44] hover:text-[#9C6230] transition-colors"
        >
          History
        </button>
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto pb-4">
          {/* Promo Carousel + Phone Number Identification White Header Section */}
          <div className="bg-white px-4 pt-3 pb-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            {/* Dark Warm Entertainment Banner matching screenshot */}
            <div className="relative rounded-[14px] overflow-hidden bg-gradient-to-r from-[#1A140E] via-[#3A2714] to-[#6B4523] text-white px-4 py-3.5 min-h-[88px] flex flex-col justify-center">
              {/* Warm ambient lamp glow + subtle couch silhouette matching screenshot */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-75"
                style={{
                  background:
                    'radial-gradient(circle at 82% 28%, rgba(255,196,112,0.36), transparent 50%), radial-gradient(circle at 20% 80%, rgba(186,126,68,0.18), transparent 48%)',
                }}
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 180 80"
                className="pointer-events-none absolute right-1 bottom-0 h-[82px] w-[160px] opacity-35"
              >
                <ellipse cx="95" cy="24" rx="22" ry="14" fill="#FBBF24" opacity="0.35" />
                <circle cx="52" cy="42" r="10" fill="#1F140E" />
                <path d="M36 78 C36 58, 68 58, 68 78 Z" fill="#1F140E" />
                <circle cx="88" cy="36" r="12" fill="#180F0A" />
                <path d="M68 78 C68 53, 108 53, 108 78 Z" fill="#180F0A" />
                <circle cx="122" cy="44" r="10" fill="#1F140E" />
                <path d="M106 78 C106 58, 138 58, 138 78 Z" fill="#1F140E" />
              </svg>

              <button
                type="button"
                onClick={currentBanner.onClick}
                className="relative z-10 text-left w-full pr-16"
              >
                <div className="text-[13.5px] font-bold text-[#F5EBDD] leading-tight">
                  {currentBanner.kicker}
                </div>
                <div className="text-[14px] font-bold text-white mt-0.5 leading-snug">
                  {currentBanner.headline}
                </div>
              </button>

              {/* Carousel indicator dots */}
              <div className="relative z-10 flex items-center justify-center gap-1.5 mt-2">
                {banners.map((b, i) => (
                  <button
                    key={b.kicker}
                    type="button"
                    aria-label={`Banner ${i + 1}`}
                    onClick={() => setBannerIdx(i)}
                    className={`rounded-full transition-all ${
                      bannerIdx === i ? 'w-2 h-2 bg-[#BA7E44]' : 'w-1.5 h-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Carrier Auto-Identification + Phone Number Input Row */}
            <div className="relative mt-4 flex items-center justify-between gap-2 pb-1">
              {/* Carrier Logo + Dropdown Trigger */}
              <div className="relative flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCarrierDropdown((prev) => !prev)}
                  aria-label="Select mobile network carrier"
                  className="flex items-center gap-1.5 min-h-[42px] pr-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <CarrierBadge carrierId={activeCarrierId} size={34} />
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 fill-gray-500" />
                </button>

                <span className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />

                {/* Carrier Picker Popover */}
                {showCarrierDropdown && (
                  <div className="absolute top-12 left-0 z-30 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 space-y-1">
                    <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400">
                      Network Carrier {manualCarrier ? '(Manual)' : '(Auto)'}
                    </div>
                    {SELECTABLE_CARRIERS.map((cid) => {
                      const c = CARRIER_DIRECTORY[cid];
                      const active = activeCarrierId === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => {
                            setManualCarrier(cid);
                            setShowCarrierDropdown(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-left text-[13px] font-medium transition-colors ${
                            active ? 'bg-[#F5EBDD] text-[#9C6230]' : 'hover:bg-[#F4F6F8] text-[#1A1D23]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <CarrierBadge carrierId={cid} size={26} />
                            <span>{c.name}</span>
                          </span>
                          {active && <Check className="w-4 h-4 text-[#BA7E44]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bold Formatted Phone Number Input */}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="0803 000 0000"
                  aria-label="Mobile phone number"
                  className="w-full min-w-0 bg-transparent text-[21px] sm:text-[22px] font-semibold text-[#1A1D23] tracking-wide font-mono-tabular outline-none placeholder:text-gray-300"
                />
                {phoneInput.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput('');
                      setManualCarrier(null);
                    }}
                    aria-label="Clear phone number"
                    className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Recent Numbers Dropdown + Contact Picker Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowContactsModal(true)}
                  aria-label="Recent phone numbers"
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactsModal(true)}
                  aria-label="Choose from saved or my number"
                  className="w-9 h-9 rounded-full bg-[#F5EBDD] hover:bg-[#F5EBDD] flex items-center justify-center text-[#BA7E44] transition-colors"
                >
                  <UserRound className="w-5 h-5 fill-[#BA7E44]/85 text-[#BA7E44]" />
                </button>
              </div>
            </div>

            {/* Live Carrier Number Detector Line */}
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px]">
              {phoneInfo.normalized11.length >= 4 ? (
                phoneInfo.isRecognizedCarrier ? (
                  <span className="text-[#9C6230] font-medium truncate">
                    Number Detector:{' '}
                    <span className="font-bold">
                      {activeCarrier.name}
                    </span>
                    {manualCarrier && phoneInfo.carrierId !== manualCarrier
                      ? ` (Ported from ${phoneInfo.carrier.shortLabel.toUpperCase()})`
                      : ` · Prefix ${phoneInfo.prefix}`}
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium truncate">
                    Unknown prefix — tap network icon on the left to choose
                  </span>
                )
              ) : (
                <span className="text-gray-500 truncate">
                  Auto-detects MTN, Airtel, Glo &amp; 9mobile as you type
                </span>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {profile.phone &&
                  identifyNigerianPhone(profile.phone).normalized11 !== phoneInfo.normalized11 && (
                    <button
                      type="button"
                      onClick={() => {
                        const mine = identifyNigerianPhone(profile.phone);
                        setPhoneInput(formatNigerianPhoneDisplay(mine.normalized11));
                        setManualCarrier(null);
                      }}
                      className="text-[11px] font-semibold text-[#BA7E44] hover:underline whitespace-nowrap"
                    >
                      Use My Number
                    </button>
                  )}
                {phoneInfo.normalized11.length > 0 && !phoneInfo.isValidLength && (
                  <span className="text-gray-400 tabular-nums">
                    {phoneInfo.normalized11.length}/11
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-3.5 space-y-3 mt-3">
            {/* USSD Quick Recharge Strip */}
            <button
              type="button"
              onClick={onOpenUssd}
              className="relative w-full rounded-[14px] overflow-hidden bg-gradient-to-r from-[#BA7E44] via-[#9C6230] to-[#BA7E44] px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-[0_2px_8px_rgba(186,126,68,0.16)] text-left"
            >
              <div className="leading-tight shrink-0">
                <div className="text-[10.5px] font-semibold text-white/90">
                  {mode === 'airtime' ? 'Low on Airtime?' : 'Need Data Fast?'}
                </div>
                <div className="text-[16px] sm:text-[17px] font-extrabold text-white tracking-tight">
                  Simply Dial
                </div>
              </div>

              <div className="relative flex items-center bg-[#231F54] text-white rounded-full px-3.5 py-1.5 shadow-sm">
                <span className="text-[14px] sm:text-[15px] font-extrabold tracking-tight tabular-nums">
                  {mode === 'airtime' ? '*955*3*amount#' : '*955*4*amount#'}
                </span>
                <Sparkles className="w-4 h-4 text-[#FACC15] fill-[#FACC15] -mt-3 -mr-1 ml-1 shrink-0" />
              </div>
            </button>

            {/* Main Top up / Data Plans Card */}
            <section className="bg-white rounded-[16px] p-4 shadow-[0_1px_6px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-[#1A1D23]">
                  {mode === 'airtime' ? 'Top up' : 'Data Plans'}
                </h2>
                <span className="text-[12px] text-gray-500 tabular-nums">
                  Bal: <span className="font-semibold text-[#1A1D23]">{formatNaira(balance)}</span>
                </span>
              </div>

              {/* 🎄 Christmas Welcome Recharge Banner */}
              <div className="mt-3 rounded-[16px] bg-gradient-to-r from-[#2D1B0E] via-[#4A2D16] to-[#7A4B22] text-white p-3.5 shadow-sm relative overflow-hidden flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold text-[#F5EBDD] uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-[#F5EBDD]" />
                    <span>🎄 Christmas Welcome Recharge</span>
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-white truncate">
                    Instant Value on MTN, Airtel, Glo &amp; 9mobile
                  </div>
                  <div className="text-[11px] text-[#F5EBDD]/80 truncate">
                    Direct automated telecom clearing &amp; verified digital receipts
                  </div>
                </div>
                <span className="shrink-0 text-right px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-bold text-[#F5EBDD]">
                  24/7 Live
                </span>
              </div>

              {mode === 'airtime' ? (
                /* EXACT 3x2 AIRTIME AMOUNT GRID FROM SCREENSHOT */
                <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                  {AIRTIME_PRESETS.map((item) => {
                    const isSelected =
                      selectedPresetFace === item.faceValue && parsedAmount === item.faceValue;
                    return (
                      <button
                        key={item.faceValue}
                        type="button"
                        onClick={() => handleSelectAirtimePreset(item)}
                        className={`rounded-[12px] py-3.5 px-2 flex flex-col items-center justify-center text-center transition-all border ${
                          isSelected
                            ? 'bg-[#F5EBDD] border-[#BA7E44] shadow-xs'
                            : 'bg-[#F7F8FA] border-transparent hover:bg-[#EEF2F6]'
                        }`}
                      >
                        <div className="text-[18px] font-bold text-[#1A1D23] tabular-nums leading-tight">
                          ₦ {item.faceValue.toLocaleString()}
                        </div>
                        {item.payValue < item.faceValue && (
                          <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">
                            Pay ₦{item.payValue.toLocaleString()}
                          </div>
                        )}
                        <div
                          className={`text-[11px] font-medium text-[#BA7E44] tabular-nums ${
                            item.payValue < item.faceValue ? 'mt-0.5' : 'mt-2'
                          }`}
                        >
                          ₦{item.cashback.toFixed(2)} Cashback
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* FULL DATA PAGE: CATEGORY TABS + CARRIER-TAILORED DATA BUNDLES */
                <div className="mt-3.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-100">
                    {(['Hot', 'Daily', 'Weekly', 'Monthly', 'Mega'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setDataTab(tab);
                          setSelectedDataPlanId('');
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                          dataTab === tab
                            ? 'bg-[#BA7E44] text-white'
                            : 'bg-[#F4F6F8] text-gray-600 hover:text-[#1A1D23]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {loadingPlans && liveDataPlans.length === 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#BA7E44]" />
                      Loading live {activeCarrier.shortLabel.toUpperCase()} bundles...
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {dataPlans.map((plan) => {
                      const active = selectedDataPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedDataPlanId(plan.id)}
                          className={`rounded-[12px] py-3 px-2 flex flex-col items-center justify-center text-center transition-all border ${
                            active
                              ? 'bg-[#F5EBDD] border-[#BA7E44] shadow-xs'
                              : 'bg-[#F7F8FA] border-transparent hover:bg-[#EEF2F6]'
                          }`}
                        >
                          <div className="text-[17px] font-bold text-[#1A1D23] tabular-nums leading-tight">
                            {plan.size}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{plan.validity}</div>
                          <div className="text-[12.5px] font-bold text-[#1A1D23] tabular-nums mt-1">
                            Pay ₦{plan.payAmount.toLocaleString()}
                          </div>
                          <div className="text-[10.5px] font-medium text-[#BA7E44] tabular-nums mt-0.5">
                            ₦{plan.cashback.toFixed(2)} Cashback
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Pay Bar matching screenshot */}
      <footer className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {mode === 'airtime' ? (
            <div className="flex-1 flex items-center gap-2 border-b border-gray-200 focus-within:border-[#BA7E44] pb-1.5 transition-colors">
              <span className="text-[18px] font-bold text-[#1A1D23]">₦</span>
              <input
                type="number"
                min={50}
                max={500000}
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedPresetFace(null);
                }}
                placeholder="50-500,000"
                aria-label="Airtime amount"
                className="w-full bg-transparent text-[20px] font-semibold text-[#1A1D23] tabular-nums outline-none placeholder:text-gray-300"
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] text-gray-500 truncate">
                {selectedDataPlan
                  ? `${activeCarrier.shortLabel.toUpperCase()} · ${selectedDataPlan.size} (${selectedDataPlan.validity})`
                  : 'Select a data plan'}
              </div>
              <div className="text-[20px] font-bold text-[#1A1D23] tabular-nums leading-tight">
                ₦{finalPayable.toLocaleString()}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!canPay}
            onClick={handleOpenCheckout}
            className={`min-w-[126px] h-[46px] px-5 rounded-full text-[15px] font-semibold transition-all whitespace-nowrap shrink-0 ${
              canPay
                ? 'bg-[#BA7E44] hover:bg-[#9C6230] active:scale-[0.98] text-white shadow-[0_4px_14px_rgba(186,126,68,0.28)]'
                : 'bg-[#EBDDC9] text-gray-600 cursor-not-allowed'
            }`}
          >
            {canPay && finalPayable > 0 ? `Pay ₦${finalPayable.toLocaleString()}` : 'Pay'}
          </button>
        </div>
      </footer>

      {/* Contacts / Recent Numbers Sheet */}
      {showContactsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowContactsModal(false);
          }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#1A1D23]">Select Mobile Number</h3>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="w-8 h-8 rounded-full bg-[#F4F6F8] flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recentNumbers.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No saved or recent numbers yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentNumbers.map((entry) => (
                  <button
                    key={entry.phone}
                    type="button"
                    onClick={() => {
                      setPhoneInput(formatNigerianPhoneDisplay(entry.phone));
                      setManualCarrier(null);
                      setShowContactsModal(false);
                    }}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F4F6F8] px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CarrierBadge carrierId={entry.carrierId} size={32} />
                      <div>
                        <div className="text-[14px] font-semibold text-[#1A1D23]">
                          {entry.label}
                        </div>
                        <div className="text-[12.5px] font-mono-tabular text-gray-500">
                          {formatNigerianPhoneDisplay(entry.phone)} ·{' '}
                          {CARRIER_DIRECTORY[entry.carrierId].name}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Payment Confirmation + 4-Digit PIN Sheet */}
      {showCheckout && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCheckout(false);
          }}
        >
          <form
            onSubmit={handleConfirmPayment}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-[#1A1D23]">Confirm Payment</h3>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="w-8 h-8 rounded-full bg-[#F4F6F8] flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2">
              <div className="text-[28px] font-extrabold text-[#1A1D23] tabular-nums">
                {formatNaira(finalPayable)}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F4F6F8] p-3.5 space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Product</span>
                <span className="font-semibold text-[#1A1D23]">
                  {mode === 'airtime'
                    ? `${activeCarrier.shortLabel.toUpperCase()} Airtime (₦${parsedAmount.toLocaleString()})`
                    : `${activeCarrier.shortLabel.toUpperCase()} Data ${selectedDataPlan?.size ?? ''}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Recipient Number</span>
                <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                  {phoneInfo.formatted}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Wallet Balance</span>
                <span className="font-mono-tabular font-semibold text-[#1A1D23]">
                  {formatNaira(balance)}
                </span>
              </div>
            </div>

            {balance < finalPayable ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                <div className="text-xs font-medium text-amber-800">
                  Your wallet balance ({formatNaira(balance)}) is lower than {formatNaira(finalPayable)}.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckout(false);
                    onOpenAddMoney();
                  }}
                  className="w-full h-10 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Money to Wallet
                </button>
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#BA7E44]" />
                  Enter 4-Digit Transaction PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setCheckoutError('');
                  }}
                  placeholder="••••"
                  className="w-full h-12 px-4 rounded-xl bg-[#F4F6F8] text-center text-lg font-bold tracking-[0.5em] font-mono-tabular outline-none focus:ring-2 focus:ring-[#BA7E44]"
                />
              </div>
            )}

            {checkoutError && (
              <p className="text-xs font-medium text-red-500 text-center">{checkoutError}</p>
            )}

            {balance >= finalPayable && (
              <button
                type="submit"
                disabled={paying}
                className="w-full h-12 rounded-full bg-[#BA7E44] hover:bg-[#9C6230] disabled:opacity-60 text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Purchase...
                  </>
                ) : (
                  `Pay ${formatNaira(finalPayable)}`
                )}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
