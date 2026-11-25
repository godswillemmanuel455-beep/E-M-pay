import React from 'react';

interface FastDLLogoProps {
  size?: number;
  showTierBadge?: boolean;
  tierNumber?: string;
  className?: string;
}

export const OPayLogo: React.FC<FastDLLogoProps> = ({
  size = 40,
  showTierBadge = false,
  tierNumber = '2',
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="FastDL Bank Logo"
      >
        <circle cx="50" cy="50" r="46" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="39" stroke="#BA7E44" strokeWidth="8" />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fill="#1D164B"
          fontSize="22"
          fontWeight="800"
          fontFamily="Plus Jakarta Sans, sans-serif"
          letterSpacing="-1.5"
        >
          FDL
        </text>
      </svg>

      {showTierBadge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-[17px] h-[17px] rounded-full bg-gradient-to-b from-[#E5E9F0] to-[#B4BECB] border-[1.5px] border-white text-[9px] font-bold text-[#374151] shadow-xs tabular-nums"
          title={`Tier ${tierNumber}`}
        >
          {tierNumber}
        </span>
      )}
    </div>
  );
};

export const OPayWordmark: React.FC<{ iconSize?: number; textClassName?: string }> = ({
  iconSize = 34,
  textClassName = 'text-[25px]',
}) => {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <svg
        viewBox="0 0 100 100"
        width={iconSize}
        height={iconSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="42" fill="#BA7E44" />
        <text
          x="50"
          y="59"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="23"
          fontWeight="800"
          fontFamily="Plus Jakarta Sans, sans-serif"
          letterSpacing="-1"
        >
          FDL
        </text>
      </svg>
      <span className={`font-extrabold tracking-tight text-[#1D164B] leading-none ${textClassName}`}>
        FastDL <span className="text-[#BA7E44]">Bank</span>
      </span>
    </div>
  );
};
