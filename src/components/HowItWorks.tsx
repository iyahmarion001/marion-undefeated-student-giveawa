import React from 'react';
import { Smartphone, CheckCircle, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-4 sm:py-8 md:py-12 border-t border-blue-900/30">
      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        
        {/* Section Heading: Compact on mobile, rich on desktop */}
        <div className="text-center mb-4 sm:mb-8">
          <span className="text-[11px] sm:text-xs uppercase font-bold text-yellow-400 tracking-wider">
            Quick Guide
          </span>
          <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
            How to Participate
          </h3>
          <p className="text-[11px] sm:text-sm text-blue-200 mt-0.5 max-w-lg mx-auto">
            Lightweight, straightforward 3-step drop for Delta State Polytechnic students.
          </p>
        </div>

        {/* Mobile-Optimized Short Participation Explanation (Requirement 6) */}
        <div className="md:hidden rounded-xl bg-[#081b3d] border border-blue-700/50 p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div className="text-xs text-slate-200">
              <strong className="text-white">Register Phone &amp; Network:</strong> Select MTN, Airtel, Glo, or 9mobile and enter your active line.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div className="text-xs text-slate-200">
              <strong className="text-white">Share &amp; Confirm:</strong> Share with 3 WhatsApp groups OR 10 friends, then tap <strong className="text-yellow-300">"I've Shared"</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div className="text-xs text-slate-200">
              <strong className="text-white">Admin Airtime Review:</strong> Status updates to <em>"Share Confirmed – Awaiting Review"</em> for manual ₦200 airtime drop.
            </div>
          </div>
        </div>

        {/* Desktop-Preserved 3-Card Layout */}
        <div className="hidden md:grid grid-cols-3 gap-4">
          
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-[#091b3f] border border-blue-800/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center">
                  1
                </span>
                <span className="text-[11px] font-semibold text-blue-300">Phase 1: Entry</span>
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">
                Register Your Line
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Choose your telecom network (MTN, Airtel, Glo, or 9mobile) and input your active Nigerian phone line to receive the ₦200 drop.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-800/40 text-[11px] text-yellow-300 font-medium">
              ✓ Open to old and new students
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-[#091b3f] border border-blue-800/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center">
                  2
                </span>
                <span className="text-[11px] font-semibold text-blue-300">Phase 2: Share Link</span>
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">
                Share with 3 Groups or 10 People
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share your giveaway link with either 3 WhatsApp groups or 10 friends, then tap <strong>"I've Shared"</strong> to record your entry. (Referral sign-ups are not required).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-800/40 text-[11px] text-yellow-300 font-medium">
              ✓ 50 slots available (₦200 each)
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-[#091b3f] border border-blue-800/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center">
                  3
                </span>
                <span className="text-[11px] font-semibold text-blue-300">Phase 3: Top-up</span>
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">
                Admin Review &amp; Direct Credit
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Confirmed entries are reviewed and ₦200 airtime is credited manually by the administrator to your active phone line.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-800/40 text-[11px] text-yellow-300 font-medium">
              ✓ 100% Free · No payment ever
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
