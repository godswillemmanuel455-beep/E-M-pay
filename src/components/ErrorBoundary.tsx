import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { OPayLogo } from './OPayLogo';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Unexpected application error';
    const isQuotaError =
      raw.includes('Quota exceeded') || raw.includes('resource-exhausted');
    let friendly = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        friendly = `${parsed.operationType ?? 'Operation'} on ${parsed.path ?? 'database'}: ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: friendly, isQuotaError };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FFF1F2] flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-[#E11D48]" />
            </div>
            <div className="flex justify-center">
              <OPayLogo size={36} />
            </div>
            <h1 className="text-lg font-bold text-[#1A1D23]">
              {this.state.isQuotaError ? 'Daily Database Quota Reached' : 'Something Went Wrong'}
            </h1>
            <p className="text-xs text-gray-600 leading-relaxed break-words">
              {this.state.isQuotaError
                ? 'Firestore free-tier daily quota was exceeded and will reset tomorrow. You can review quota options in the Firebase Console.'
                : this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-xl bg-[#BA7E44] hover:bg-[#9C6230] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
