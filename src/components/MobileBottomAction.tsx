import React from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';

interface MobileBottomActionProps {
  onOpenParticipate: () => void;
  onShareWhatsApp: () => void;
}

export const MobileBottomAction: React.FC<MobileBottomActionProps> = ({
  onOpenParticipate,
  onShareWhatsApp,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-2.5 bg-[#030c1d]/90 backdrop-blur-md border-t border-blue-800/60 shadow-2xl">
      <div className="max-w-md mx-auto flex items-center gap-2">
        <button
          onClick={onShareWhatsApp}
          type="button"
          aria-label="Share giveaway on WhatsApp"
          className="tap-bounce min-h-[46px] min-w-[46px] px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 flex items-center justify-center cursor-pointer transition-colors border border-emerald-300/40 shadow-md shadow-emerald-950/60"
          title="Share on WhatsApp with your unique referral link"
        >
          <MessageCircle className="w-5 h-5 fill-slate-950 text-emerald-400" />
        </button>

        <button
          onClick={onOpenParticipate}
          type="button"
          className="tap-bounce flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/25 cursor-pointer border border-yellow-300"
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>Participate · ₦200 Airtime</span>
        </button>
      </div>
    </div>
  );
};
