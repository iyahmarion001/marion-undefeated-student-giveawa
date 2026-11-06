import React from 'react';
import { X, ZoomIn } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

interface PosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosterModal: React.FC<PosterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="High-Resolution Welcome Poster View"
        className="relative max-w-2xl w-full bg-[#030c1d] rounded-2xl border border-blue-500/50 shadow-2xl p-2 sm:p-4 flex flex-col items-center"
      >
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-blue-800/60 px-2 text-xs">
          <div className="flex items-center gap-2 text-blue-200">
            <ZoomIn className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-white">Full Welcome Artwork</span>
            <span className="text-slate-400">· 100% Original Ratio</span>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-blue-900/50 transition-colors cursor-pointer"
            aria-label="Close high-res view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full Image Container */}
        <div className="w-full max-h-[80vh] overflow-auto flex items-center justify-center bg-[#051430] rounded-xl p-1">
          <img
            src={GIVEAWAY_INFO.posterPath}
            alt="Marion Undefeated - Welcome All Old and New Students Back to School - Full Poster"
            className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
          />
        </div>

        {/* Caption */}
        <div className="w-full mt-2 pt-2 border-t border-blue-800/40 flex items-center justify-between text-[11px] text-slate-400 px-2">
          <span>Delta State Polytechnic, Otefe-Oghara</span>
          <span className="text-yellow-400 font-medium">Courtesy of: IYAH MARION (Marion Undefeated)</span>
        </div>
      </div>
    </div>
  );
};
