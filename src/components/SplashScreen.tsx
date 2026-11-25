import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { OPayLogo } from './OPayLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, 1850);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
      onClick={onComplete}
      role="button"
      tabIndex={0}
      aria-label="E&M Pay Splash Screen, tap to enter dashboard"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onComplete();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#BA7E44] cursor-pointer select-none"
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center"
      >
        <div className="relative flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0.45 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            className="absolute w-28 h-28 rounded-full border-2 border-white/40"
          />
          <OPayLogo size={108} className="drop-shadow-sm" />
        </div>
      </motion.div>
    </motion.div>
  );
};
