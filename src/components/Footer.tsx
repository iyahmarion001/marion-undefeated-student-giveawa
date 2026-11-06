import React from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

interface FooterProps {
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  return (
    <footer className="w-full bg-[#020814] border-t border-blue-900/50 py-8 px-4 text-center">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* Brand Lockup */}
        <div className="flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="font-extrabold text-white text-base tracking-wide">
              MARION UNDEFEATED
            </span>
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
          </div>
          <p className="text-xs text-blue-300 font-medium">
            Student Airtime Giveaway · Session 2026
          </p>
        </div>

        {/* Slogan Pill / Badge from Poster */}
        <div>
          <span className="inline-block px-3 py-1 bg-white text-slate-950 font-black text-xs rounded-md shadow-sm">
            #Let's make every penny count.
          </span>
        </div>

        {/* Institution & Courtesy */}
        <div className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Delta State Polytechnic, Otefe-Oghara · Technology for Entrepreneurship
          <br />
          Courtesy of: <strong className="text-white font-semibold">IYAH MARION</strong> (Marion Undefeated)
        </div>

        {/* Required Mandatory Attribution & Admin Link */}
        <div className="pt-4 border-t border-blue-900/40 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div>
            © 2026 Marion Undefeated. All rights reserved.
          </div>

          <div className="flex items-center gap-4">
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="text-slate-400 hover:text-yellow-400 transition-colors cursor-pointer"
              >
                🔐 Administrator Console
              </button>
            )}

            <div className="flex items-center gap-1.5 text-yellow-400/90 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Powered by Marion Undefeated</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};
