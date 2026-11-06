import React, { useState } from 'react';
import { Maximize2, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

interface WelcomePosterHeroProps {
  onOpenPosterModal: () => void;
  onOpenParticipate: () => void;
}

export const WelcomePosterHero: React.FC<WelcomePosterHeroProps> = ({
  onOpenPosterModal,
  onOpenParticipate,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section id="welcome-poster" className="relative pt-2 sm:pt-6 pb-4 sm:pb-8 md:pb-12 overflow-hidden">
      {/* Decorative ambient radial glows inspired by poster */}
      <div 
        aria-hidden="true" 
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[450px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"
      />
      <div 
        aria-hidden="true" 
        className="absolute top-36 -right-20 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 relative z-10">
        {/* Academic Session & Institution Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-300">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
            <span className="truncate">Delta State Poly, Otefe-Oghara</span>
            <span aria-hidden="true" className="text-blue-500 hidden sm:inline">·</span>
            <span className="hidden sm:inline text-yellow-400 font-bold">Session 2026</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-300 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium text-emerald-300">Official Welcome</span>
          </div>
        </div>

        {/* Poster Showcase Container - Preserves 100% original aspect ratio and appearance */}
        <div className="relative group rounded-2xl sm:rounded-3xl p-1 sm:p-2 bg-gradient-to-b from-blue-500/30 via-blue-900/20 to-yellow-500/20 border border-blue-500/40 shadow-2xl shadow-blue-950/80 backdrop-blur-sm">
          
          {/* Main Poster Frame */}
          <div className="relative w-full aspect-square max-w-[360px] sm:max-w-[560px] mx-auto rounded-xl sm:rounded-2xl overflow-hidden bg-[#051838] flex items-center justify-center">
            
            {/* Loading placeholder skeleton */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#081b3d] animate-pulse">
                <div className="w-10 h-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                <span className="text-xs text-blue-200 font-medium">Loading Welcome Poster...</span>
              </div>
            )}

            {/* Complete, uncropped original artwork */}
            <img
              src={GIVEAWAY_INFO.posterPath}
              alt="Marion Undefeated - Welcome All Old and New Students Back to School - Delta State Polytechnic Otefe, Oghara - Courtesy of Iyah Marion"
              className={`w-full h-full object-contain block transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              loading="eager"
            />

            {/* Action Bar Floating Overlay (Lightweight & Unobtrusive) */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <button
                onClick={onOpenPosterModal}
                type="button"
                className="tap-bounce flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-semibold text-white bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md rounded-lg border border-white/20 shadow-md cursor-pointer transition-all"
                title="View High-Resolution Poster"
              >
                <Maximize2 className="w-3 h-3 text-yellow-400" />
                <span className="hidden sm:inline">Inspect</span>
              </button>
            </div>

            {/* Subtle bottom badge indicating full artwork display */}
            <div className="absolute bottom-1.5 left-2 right-2 pointer-events-none flex justify-center">
              <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-blue-100 bg-slate-950/70 backdrop-blur-md rounded-md border border-blue-400/20">
                Official Artwork · Complete &amp; Preserved
              </span>
            </div>
          </div>

          {/* Quick Context Strip below image */}
          <div className="mt-2 sm:mt-3 px-2 py-1 flex items-center justify-between text-xs text-slate-300 gap-2 border-t border-blue-800/40">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-white tracking-wide truncate">IYAH MARION</span>
              <span aria-hidden="true" className="text-blue-500">·</span>
              <span className="text-yellow-400 font-semibold truncate">Marion Undefeated</span>
            </div>
            <div className="text-slate-400 font-medium italic text-[11px] sm:text-xs shrink-0">
              #Let's make every penny count.
            </div>
          </div>
        </div>

        {/* Action button below poster */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={onOpenParticipate}
            type="button"
            className="tap-bounce w-full sm:w-auto px-6 py-3 sm:py-3.5 text-sm sm:text-base font-extrabold text-slate-950 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 hover:from-yellow-300 hover:to-amber-200 rounded-xl shadow-lg shadow-yellow-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all border border-yellow-300/60"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Participate in ₦200 Airtime Giveaway</span>
          </button>

          {/* Desktop-only secondary button to keep desktop layout preserved */}
          <a
            href="#airtime-offer"
            className="hidden sm:flex w-full sm:w-auto px-5 py-3 text-sm font-semibold text-blue-200 hover:text-white bg-blue-950/60 hover:bg-blue-900/60 rounded-xl border border-blue-700/50 items-center justify-center text-center transition-colors"
          >
            View Details &amp; ₦10,000 Budget
          </a>
        </div>
      </div>
    </section>
  );
};
