import React, { useState } from 'react';
import { HeartHandshake, Quote, ChevronDown, ChevronUp } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

export const GoodwillMessage: React.FC = () => {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  return (
    <section id="goodwill-message" className="py-4 sm:py-8 md:py-12 bg-[#05132d] border-t border-blue-900/30">
      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c2454] to-[#071738] border border-blue-600/40 p-4 sm:p-6 md:p-8 shadow-xl shadow-blue-950/60 relative overflow-hidden">
          
          {/* Subtle watermark quote icon */}
          <Quote 
            aria-hidden="true" 
            className="absolute top-4 right-4 w-14 h-14 sm:w-20 sm:h-20 text-blue-500/10 pointer-events-none" 
          />

          <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 mb-1 sm:mb-2">
            <HeartHandshake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
            <span>WORDS FROM THE SPONSOR</span>
          </div>

          <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Welcome to Session 2026
          </h3>

          {/* Short summary on mobile */}
          <div className="mt-2 text-xs sm:text-base text-slate-200 leading-relaxed font-normal">
            <p>
              <strong className="text-white font-semibold">Marion</strong> warmly welcomes all returning and continuing students, as well as new students, to a brand-new academic session at{' '}
              <span className="text-yellow-300 font-semibold">{GIVEAWAY_INFO.institution}</span>.
            </p>
          </div>

          {/* Expandable on mobile, always visible on desktop */}
          <div className={`${isMobileExpanded ? 'block' : 'hidden'} md:block mt-3 space-y-3 text-xs sm:text-base text-blue-100/90 leading-relaxed`}>
            <p>
              May this session bring success, growth, new opportunities, and great achievements. As lectures resume, staying connected with coursemates, lecturers, and family is vital.
            </p>

            {/* 3 Core Pillars */}
            <div className="mt-4 pt-3 border-t border-blue-800/50 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#061430]/90 border border-blue-700/30">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs sm:text-sm">
                  01
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-yellow-400 font-bold uppercase tracking-wider">Learn</div>
                  <div className="text-[11px] sm:text-xs text-slate-300 font-medium">Academics &amp; Skills</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#061430]/90 border border-blue-700/30">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-yellow-500/20 text-yellow-300 flex items-center justify-center font-bold text-xs sm:text-sm">
                  02
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-yellow-400 font-bold uppercase tracking-wider">Grow</div>
                  <div className="text-[11px] sm:text-xs text-slate-300 font-medium">Personal &amp; Campus Growth</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#061430]/90 border border-blue-700/30">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs sm:text-sm">
                  03
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-yellow-400 font-bold uppercase tracking-wider">Achieve</div>
                  <div className="text-[11px] sm:text-xs text-slate-300 font-medium">Excellence in 2026</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile expand / collapse button */}
          <button
            type="button"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            className="md:hidden mt-2.5 tap-bounce text-xs font-semibold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 cursor-pointer"
          >
            <span>{isMobileExpanded ? 'Show less' : 'Read full message & pillars'}</span>
            {isMobileExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Courtesy of Stamp */}
          <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-between gap-2.5 pt-3 sm:pt-4 border-t border-blue-800/40">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Courtesy of:</div>
              <div className="text-sm sm:text-lg font-black text-white tracking-wide">
                IYAH MARION
              </div>
              <div className="inline-block px-2 py-0.5 rounded bg-yellow-400 text-slate-950 font-black text-[10px] sm:text-xs tracking-wider uppercase mt-0.5">
                Marion Undefeated
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-2.5 py-0.5 rounded bg-white text-slate-950 font-black text-[11px] sm:text-sm tracking-wide shadow-sm">
                #Let's make every penny count.
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
