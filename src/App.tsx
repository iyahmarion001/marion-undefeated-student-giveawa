/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { WelcomePosterHero } from './components/WelcomePosterHero';
import { AirtimeAnnouncement } from './components/AirtimeAnnouncement';
import { GoodwillMessage } from './components/GoodwillMessage';
import { HowItWorks } from './components/HowItWorks';
import { GuidelinesAndFaq } from './components/GuidelinesAndFaq';
import { Footer } from './components/Footer';
import { ParticipationModal } from './components/ParticipationModal';
import { PosterModal } from './components/PosterModal';
import { MobileBottomAction } from './components/MobileBottomAction';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Check, Info } from 'lucide-react';
import { 
  getOrCreateReferralCode, 
  getReferralLink, 
  buildWhatsAppShareText, 
  openWhatsAppShare 
} from './utils/referral';

export default function App() {
  const [isParticipateOpen, setIsParticipateOpen] = useState(false);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path === '/admin' ||
      path.startsWith('/admin') ||
      hash === '#admin' ||
      hash === '#/admin' ||
      search.includes('admin=true') ||
      search.includes('admin=1')
    );
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAdminRoute = () => {
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        const search = window.location.search.toLowerCase();

        if (
          path === '/admin' ||
          path.startsWith('/admin') ||
          hash === '#admin' ||
          hash === '#/admin' ||
          search.includes('admin=true') ||
          search.includes('admin=1')
        ) {
          setIsAdminOpen(true);
        }
      };

      checkAdminRoute();
      window.addEventListener('hashchange', checkAdminRoute);
      window.addEventListener('popstate', checkAdminRoute);
      return () => {
        window.removeEventListener('hashchange', checkAdminRoute);
        window.removeEventListener('popstate', checkAdminRoute);
      };
    }
  }, []);

  const handleOpenAdmin = () => {
    setIsAdminOpen(true);
    if (typeof window !== 'undefined' && !window.location.hash.includes('admin')) {
      try {
        window.history.pushState(null, '', '#admin');
      } catch {}
    }
  };

  const handleCloseAdmin = () => {
    setIsAdminOpen(false);
    if (typeof window !== 'undefined') {
      try {
        if (window.location.pathname.startsWith('/admin')) {
          window.history.pushState(null, '', '/');
        } else if (window.location.hash.includes('admin')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch {}
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleShareWhatsApp = () => {
    const code = getOrCreateReferralCode();
    const link = getReferralLink(code);
    const text = buildWhatsAppShareText(link);
    
    // Open WhatsApp using official share format (no recipient phone number)
    const opened = openWhatsAppShare(text);
    if (opened) {
      showToast('Opening WhatsApp... Choose any contact, group, or status!');
    } else {
      // If browser blocked popup or WhatsApp cannot open, open modal to show visible Copy button
      setIsParticipateOpen(true);
      showToast('If WhatsApp did not open, use the Copy Referral Link button.');
    }
  };

  return (
    <div id="top" className="min-h-screen bg-[#030c1d] text-slate-100 flex flex-col selection:bg-yellow-400 selection:text-slate-950 pb-16 md:pb-0">
      
      {/* Top Header */}
      <Header 
        onOpenParticipate={() => setIsParticipateOpen(true)} 
        onOpenAdmin={handleOpenAdmin}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Section 1: The uploaded poster as the main welcome banner */}
        <WelcomePosterHero
          onOpenPosterModal={() => setIsPosterModalOpen(true)}
          onOpenParticipate={() => setIsParticipateOpen(true)}
        />

        {/* Section 2: ₦200 Giveaway Announcement & ₦10,000 Budget Breakdown with WhatsApp sharing & referral */}
        <AirtimeAnnouncement
          onOpenParticipate={() => setIsParticipateOpen(true)}
          onShowToast={showToast}
        />

        {/* Section 3: Goodwill Welcome Message from Iyah Marion */}
        <GoodwillMessage />

        {/* Section 4: Simple 3-step drop mechanics */}
        <HowItWorks />

        {/* Section 5: Guidelines & FAQs */}
        <GuidelinesAndFaq />
      </main>

      {/* Footer with Administrator link */}
      <Footer onOpenAdmin={handleOpenAdmin} />

      {/* Mobile Sticky Thumb Action Bar with WhatsApp Share & Participate */}
      <MobileBottomAction
        onOpenParticipate={() => setIsParticipateOpen(true)}
        onShareWhatsApp={handleShareWhatsApp}
      />

      {/* Participation & Referral Briefing Modal */}
      <ParticipationModal
        isOpen={isParticipateOpen}
        onClose={() => setIsParticipateOpen(false)}
        onShowToast={showToast}
      />

      {/* Full Artwork Zoom Modal */}
      <PosterModal
        isOpen={isPosterModalOpen}
        onClose={() => setIsPosterModalOpen(false)}
      />

      {/* Administrator Review & Airtime Disbursement Dashboard */}
      <ErrorBoundary fallbackTitle="Private Admin Dashboard Error">
        <AdminDashboard
          isOpen={isAdminOpen}
          onClose={handleCloseAdmin}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Toast Notification */}
      {toastMessage && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-50 px-4 py-3 rounded-xl bg-slate-900/95 border border-yellow-400/80 text-white text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-fade-in"
        >
          <Check className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
