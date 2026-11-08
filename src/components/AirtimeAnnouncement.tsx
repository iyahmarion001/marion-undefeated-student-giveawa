import React, { useState, useEffect } from 'react';
import { 
  Gift, Zap, ShieldCheck, ArrowRight, Copy, Check, MessageCircle, 
  ExternalLink, UserCheck, Users 
} from 'lucide-react';
import { SUPPORTED_NETWORKS, GiveawayStats } from '../types/giveaway';
import { 
  getOrCreateReferralCode, 
  getReferralLink, 
  buildWhatsAppShareText, 
  openWhatsAppShare,
  getReferralCodeFromUrl 
} from '../utils/referral';
import { fetchGiveawayStats } from '../utils/api';

interface AirtimeAnnouncementProps {
  onOpenParticipate: () => void;
  onShowToast: (message: string) => void;
}

export const AirtimeAnnouncement: React.FC<AirtimeAnnouncementProps> = ({
  onOpenParticipate,
  onShowToast,
}) => {
  const [referralCode, setReferralCode] = useState('MU-STUDENT');
  const [referralLink, setReferralLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [incomingRef, setIncomingRef] = useState<string | null>(null);
  const [stats, setStats] = useState<GiveawayStats | null>(null);

  const loadStats = async () => {
    const data = await fetchGiveawayStats();
    if (data) {
      setStats(data);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = getOrCreateReferralCode();
      setReferralCode(code);
      setReferralLink(getReferralLink(code));
      setIncomingRef(getReferralCodeFromUrl());
      loadStats();

      // Poll periodically and on window focus
      const timer = setInterval(loadStats, 15000);
      const handleFocus = () => loadStats();
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(timer);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  const totalSlots = stats?.totalSlots || 50;
  const airtimeCredited = stats?.airtimeCredited || 0;
  const remainingSlots = stats ? Math.max(0, totalSlots - airtimeCredited) : 50;
  const isFull = stats !== null && remainingSlots <= 0;

  const handleWhatsAppShare = () => {
    const text = buildWhatsAppShareText(referralLink);
    const opened = openWhatsAppShare(text);
    if (opened) {
      onShowToast('Opening WhatsApp... Choose any contact, group, or status!');
    } else {
      onShowToast('If WhatsApp did not open, click Copy Referral Link below.');
    }
  };

  const handleCopyLink = () => {
    if (navigator?.clipboard && referralLink) {
      navigator.clipboard.writeText(referralLink).then(() => {
        setCopiedLink(true);
        onShowToast('Referral link copied! Share with your friends.');
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  return (
    <section id="airtime-offer" className="py-4 sm:py-8 md:py-12 border-t border-blue-900/30">
      <div className="max-w-4xl mx-auto px-3 sm:px-6">

        {/* Incoming Referral Tag if visitor arrived via friend's link */}
        {incomingRef && (
          <div className="mb-3 sm:mb-6 p-2.5 sm:p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs sm:text-sm text-emerald-200">
            <div className="flex items-center gap-1.5 truncate">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                Invited with referral code:{' '}
                <strong className="text-white font-mono bg-emerald-900/60 px-1 py-0.5 rounded">
                  {incomingRef}
                </strong>
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-300 font-semibold shrink-0">
              Eligible for ₦200
            </span>
          </div>
        )}

        {/* Section Intro Kicker: Compact on mobile, rich on desktop */}
        <div className="text-center mb-4 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-400 mb-1">
            <Zap className="w-3.5 h-3.5 fill-yellow-400" />
            <span>STUDENT AIRTIME GIVEAWAY</span>
          </div>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight text-balance">
            ₦200 Airtime Drop per Student
          </h2>
          <p className="mt-1 text-xs sm:text-base text-blue-200/90 max-w-xl mx-auto text-balance">
            Welcome gesture for returning and new students at Delta State Polytechnic, Otefe-Oghara by Iyah Marion.
          </p>
        </div>

        {/* Primary ₦200 Airtime Highlight Card */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#0e2759] to-[#081738] border border-blue-500/50 p-4 sm:p-6 md:p-8 shadow-xl shadow-blue-950/70 overflow-hidden">
          
          {/* Subtle background glow */}
          <div 
            aria-hidden="true" 
            className="absolute top-0 right-0 w-56 h-56 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" 
          />

          {/* Giveaway Full Banner (Requirement 4) */}
          {isFull && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                <span>GIVEAWAY FULL: All 50 student rewards (₦10,000) have been claimed and distributed!</span>
              </div>
              <span className="text-[11px] uppercase bg-red-900/80 px-2 py-0.5 rounded text-white font-black shrink-0">
                0 Slots Left
              </span>
            </div>
          )}

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            
            {/* Left: ₦200 Offer Statement */}
            <div className="text-center md:text-left flex-1 w-full">
              
              {/* Prominent Live Available Rewards Counter Badge (Requirement 4) */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider mb-2 border shadow-sm ${
                isFull
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : remainingSlots <= 10
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
              }`}>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>
                  {isFull
                    ? 'GIVEAWAY FULL · 0 OF 50 SLOTS REMAINING'
                    : `${remainingSlots} OF 50 AIRTIME REWARDS REMAINING`}
                </span>
              </div>

              <div className="mt-0.5 flex items-baseline justify-center md:justify-start gap-2">
                <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
                  ₦200
                </span>
                <span className="text-base sm:text-xl font-bold text-yellow-400">
                  Airtime Reward
                </span>
              </div>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md mx-auto md:mx-0">
                Direct mobile airtime for students across all major telecom networks in Nigeria. 100% free of charge. Each reward paid reduces the 50 slots by exactly 1.
              </p>

              {/* Supported Networks Pills */}
              <div className="mt-3 pt-3 border-t border-blue-800/50">
                <div className="text-[11px] sm:text-xs font-semibold text-blue-300 mb-1.5">
                  Supported Networks:
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 sm:gap-2">
                  {SUPPORTED_NETWORKS.map((net) => (
                    <div
                      key={net.id}
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-bold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${net.color}20`,
                        borderColor: `${net.color}60`,
                        color: net.textColor === '#FFFFFF' ? '#ffffff' : '#ffd000'
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                        style={{ backgroundColor: net.color }}
                      />
                      <span>{net.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Quick Action & Slot Summary */}
            <div className="w-full md:w-auto flex flex-col items-center gap-2 shrink-0">
              {/* Dynamic Live Quota Box (Requirement 4) */}
              <div className="w-full sm:w-64 p-3.5 rounded-xl bg-[#040e24]/90 border border-blue-600/50 text-center shadow-inner">
                <div className="text-xs text-blue-300 font-medium">Live Available Rewards</div>
                <div className={`text-2xl font-black tabular-nums mt-0.5 ${isFull ? 'text-red-400' : 'text-white'}`}>
                  {isFull ? 'Giveaway Full' : `${remainingSlots} Slots Left`}
                </div>
                <div className="text-[11px] text-yellow-400 font-semibold mt-1">
                  {airtimeCredited} of 50 Paid ({Math.round((airtimeCredited / totalSlots) * 100)}% Claimed)
                </div>
              </div>

              {/* Primary Participate Button - High Prominence on all screens */}
              <button
                onClick={onOpenParticipate}
                type="button"
                className={`tap-bounce w-full sm:w-64 py-3 sm:py-3.5 px-5 font-black text-sm sm:text-base rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                  isFull
                    ? 'bg-blue-900/80 hover:bg-blue-800 text-yellow-300 border-yellow-400/50'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 shadow-yellow-500/30 border-yellow-300'
                }`}
              >
                <span>{isFull ? 'Check Participation Status' : 'Participate Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Official Share on WhatsApp Button */}
              <button
                onClick={handleWhatsAppShare}
                type="button"
                className="tap-bounce w-full sm:w-64 py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all border border-emerald-300/40"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950 text-emerald-500" />
                <span>Share on WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </button>

              {/* Fallback Copy Referral Link Button */}
              <button
                onClick={handleCopyLink}
                type="button"
                className="tap-bounce w-full sm:w-64 py-2 px-3 bg-blue-950/80 hover:bg-blue-900 text-blue-200 hover:text-white text-xs font-semibold rounded-lg border border-blue-700/50 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Referral Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Copy Referral Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop-Only Budget Breakdown: Preserved on desktop, omitted on mobile per Requirement 5 */}
        <div id="budget-breakdown" className="hidden md:block mt-8 pt-6">
          <div className="rounded-2xl bg-[#091a3c]/90 border border-blue-700/40 p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-800/60">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-400" />
                  <span>Transparent Airtime Budget Breakdown</span>
                </h3>
                <p className="text-xs sm:text-sm text-blue-200 mt-0.5">
                  Clear, honest allocation sponsored by Marion Undefeated.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1 bg-yellow-400/10 border border-yellow-400/30 rounded-lg text-yellow-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-yellow-400" />
                <span>Zero Entry Fee · 100% Sponsored</span>
              </div>
            </div>

            {/* 3 Metric Cards with Tabular Rigor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
              
              {/* Card 1: Total Budget */}
              <div className="p-4 rounded-xl bg-[#061430] border border-blue-800/50">
                <div className="text-xs font-medium text-blue-300">Total Airtime Budget</div>
                <div className="text-2xl sm:text-3xl font-black text-yellow-400 tabular-nums mt-1">
                  ₦10,000
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Dedicated sponsor pool for the academic session welcome.
                </div>
              </div>

              {/* Card 2: Individual Reward */}
              <div className="p-4 rounded-xl bg-[#061430] border border-blue-800/50">
                <div className="text-xs font-medium text-blue-300">Reward Per Student</div>
                <div className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-1">
                  ₦200
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Instant mobile recharge on your active phone line.
                </div>
              </div>

              {/* Card 3: Remaining Available Slots (Requirement 4) */}
              <div className="p-4 rounded-xl bg-[#061430] border border-blue-800/50">
                <div className="text-xs font-medium text-blue-300">Remaining Available Rewards</div>
                <div className={`text-2xl sm:text-3xl font-black tabular-nums mt-1 ${isFull ? 'text-red-400' : 'text-cyan-300'}`}>
                  {isFull ? '0 Slots' : `${remainingSlots} Slots`}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  {airtimeCredited} paid · {remainingSlots} remaining (₦{remainingSlots * 200} budget left).
                </div>
              </div>
            </div>

            {/* Visual 50 Slots Visualizer */}
            <div className="mt-5 p-4 rounded-xl bg-[#051128] border border-blue-900/60">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-semibold text-slate-200">
                  Reward Quota Visualization: 50 Student Slots
                </span>
                <span className={`font-bold tabular-nums ${isFull ? 'text-red-400' : 'text-yellow-400'}`}>
                  {remainingSlots} / 50 Available ({airtimeCredited} Paid)
                </span>
              </div>

              {/* 50 visual slot dots grid (Credited slots turn emerald / checkmark) */}
              <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
                {Array.from({ length: 50 }).map((_, i) => {
                  const isPaid = i < airtimeCredited;
                  return (
                    <div
                      key={i}
                      className={`h-3.5 sm:h-4 rounded-sm flex items-center justify-center text-[8px] font-bold border transition-colors ${
                        isPaid
                          ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                          : 'bg-gradient-to-r from-yellow-400/80 to-amber-500/80 border-yellow-300/40 text-slate-950'
                      }`}
                      title={`Slot #${i + 1}: ${isPaid ? '₦200 Paid to Student' : '₦200 Airtime Available'}`}
                    >
                      <span className="hidden sm:inline">{isPaid ? 'PAID' : i + 1}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                    <span className="text-emerald-300 font-bold">{airtimeCredited} Paid</span>
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" />
                    <span className="text-yellow-300 font-bold">{remainingSlots} Available</span>
                  </span>
                </span>
                <span className="text-blue-300">Strict 50-slot budget (₦10,000 max)</span>
              </div>
            </div>

            {/* Prominent Desco Chat WhatsApp Invitation (Requirement 4 & 5) */}
            <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#03152c] to-[#042042] border border-emerald-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                    <span>Join Desco Chat for More Giveaways</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    Stay connected with Delta State Poly Otefe-Oghara students for upcoming drops.
                  </p>
                </div>
              </div>

              <a
                href="https://chat.whatsapp.com/FFF0LzGU0lwK87cMv9KUDB?s=cl&p=a&iam=2"
                target="_blank"
                rel="noopener noreferrer"
                className="tap-bounce w-full sm:w-auto px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-[#25D366]/20 transition-all cursor-pointer"
              >
                <span>Join Desco Chat</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
