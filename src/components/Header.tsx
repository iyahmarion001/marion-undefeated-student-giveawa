import React from 'react';
import { Sparkles } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

interface HeaderProps {
  onOpenParticipate: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenParticipate }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#030c1d]/90 backdrop-blur-md border-b border-blue-900/40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a href="#top" className="flex items-center gap-2 whitespace-nowrap shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-yellow-500/20">
            MU
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-white text-sm sm:text-base leading-tight group-hover:text-yellow-400 transition-colors">
              MARION UNDEFEATED
            </span>
            <span className="text-[10px] text-blue-300 font-medium tracking-wide">
              Airtime Giveaway 2026
            </span>
          </div>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs lg:text-sm font-medium text-slate-300">
          <a href="#welcome-poster" className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0">
            Welcome Poster
          </a>
          <a href="#airtime-offer" className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0">
            ₦200 Giveaway
          </a>
          <a href="#budget-breakdown" className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0">
            ₦10,000 Budget
          </a>
          <a href="#guidelines" className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0">
            Guidelines
          </a>
        </nav>

        {/* Zone 3: Primary Action CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenParticipate}
            type="button"
            className="tap-bounce flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 rounded-lg shadow-sm shadow-yellow-500/20 whitespace-nowrap shrink-0 cursor-pointer transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Participate</span>
          </button>
        </div>
      </div>
    </header>
  );
};
