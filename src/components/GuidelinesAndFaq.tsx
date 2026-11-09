import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ShieldCheck, Users, ExternalLink } from 'lucide-react';
import { GIVEAWAY_INFO } from '../types/giveaway';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How much is the airtime giveaway and who can participate?',
    answer:
      `The total airtime budget is ₦10,000, distributed as 50 individual rewards of ₦200 each. It is open to all returning and new students of Delta State Polytechnic, Otefe-Oghara.`
  },
  {
    question: 'Is any money, token, or registration fee required?',
    answer:
      'No. The Marion Undefeated Student Airtime Giveaway is 100% free of charge. You will never be asked to pay any registration fee, buying fee, or processing fee.'
  },
  {
    question: 'Who is sponsoring this giveaway?',
    answer:
      'This initiative is sponsored with love by IYAH MARION under the banner of Marion Undefeated to celebrate and support students resuming for the 2026 academic session at Delta State Polytechnic, Otefe-Oghara.'
  },
  {
    question: 'Which mobile networks in Nigeria are eligible for the ₦200 recharge?',
    answer:
      'All major Nigerian telecommunications networks are supported: MTN Nigeria, Airtel NG, Glo Mobile, and 9mobile.'
  },
  {
    question: 'Do I need to submit BVN, bank account numbers, or passwords?',
    answer:
      'NO. Absolutely never. This is strictly a mobile airtime top-up. No bank verification number (BVN), bank account number, card PIN, or personal password will ever be asked.'
  }
];

export const GuidelinesAndFaq: React.FC = () => {
  // Mobile master expansion state (Requirement 9: separate expandable section on mobile)
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="guidelines" className="py-4 sm:py-8 md:py-12 bg-[#05132d] border-t border-blue-900/30">
      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        
        {/* Mobile Expandable Header Toggle (Requirement 9) */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setIsSectionExpanded(!isSectionExpanded)}
            className="tap-bounce w-full p-4 rounded-xl bg-[#091c42] border border-blue-700/60 flex items-center justify-between text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/20 text-yellow-300 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Detailed Guidelines &amp; FAQs
                </h3>
                <p className="text-[11px] text-blue-200">
                  {isSectionExpanded ? 'Tap to collapse section' : 'Tap to read full rules & safety info'}
                </p>
              </div>
            </div>
            {isSectionExpanded ? (
              <ChevronUp className="w-5 h-5 text-yellow-400 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-yellow-400 shrink-0" />
            )}
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block text-center mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase font-bold text-yellow-400 mb-1">
            <HelpCircle className="w-4 h-4 text-yellow-400" />
            <span>TRANSPARENT GUIDELINES</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h3>
          <p className="text-sm text-blue-200 mt-1 max-w-md mx-auto">
            Everything you need to know about the Marion Undefeated Student Airtime Giveaway 2026.
          </p>
        </div>

        {/* FAQs Body: Visible on desktop, conditionally rendered on mobile */}
        <div className={`${isSectionExpanded ? 'block' : 'hidden'} md:block mt-3 md:mt-0 space-y-3`}>
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl bg-[#091c42] border border-blue-800/50 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-blue-900/30 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-yellow-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 sm:px-5 pb-3.5 pt-1 text-xs sm:text-sm text-blue-100/90 leading-relaxed border-t border-blue-800/30 bg-[#061430]/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}

          {/* Safety & Anti-Scam Notice */}
          <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-blue-950/70 border border-blue-700/40 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200 leading-relaxed">
              <span className="font-bold text-white">Safety Assurance: </span>
              This official web portal is the authentic home of the Marion Undefeated Student Airtime Giveaway 2026. We will never ask you for fees, passwords, or banking details. Remember our motto: <strong className="text-yellow-400">#Let's make every penny count.</strong>
            </div>
          </div>
        </div>

        {/* Secondary WhatsApp Community Link */}
        <div className="mt-4 sm:mt-6 p-3 rounded-xl bg-[#051126]/80 border border-emerald-800/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <Users className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-blue-200 truncate">
              Want session updates? <strong className="text-white font-medium">Join Despo Chat for More Giveaways</strong>
            </span>
          </div>

          <a
            href={GIVEAWAY_INFO.whatsappCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-bounce px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/40 rounded-lg flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>Join Chat (Optional)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>
    </section>
  );
};
