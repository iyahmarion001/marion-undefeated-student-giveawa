import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Share2, Copy, Check, ShieldCheck, Bell, ExternalLink, 
  Users, MessageCircle, AlertCircle, Phone, CheckCircle, Clock, 
  RefreshCw, Search, ChevronRight, ArrowLeft, Send
} from 'lucide-react';
import { GIVEAWAY_INFO, SUPPORTED_NETWORKS, ParticipantRegistration, ShareMethod } from '../types/giveaway';
import { 
  getOrCreateReferralCode, 
  getReferralLink, 
  buildWhatsAppShareText, 
  getWhatsAppShareUrl,
  openWhatsAppShare,
  getReferralCodeFromUrl,
  buildAdminWhatsAppMessage,
  openAdminWhatsApp,
  ADMIN_NOTIFICATION_NUMBER
} from '../utils/referral';
import { 
  registerStudent, 
  confirmSharing, 
  lookupStatus, 
  getStoredRegistration,
  trackReferralVisit,
  trackShareClick,
  trackNotifyAdminClick
} from '../utils/api';

interface ParticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

export const ParticipationModal: React.FC<ParticipationModalProps> = ({ 
  isOpen, 
  onClose,
  onShowToast
}) => {
  // Modal View mode: 'participate' | 'check_status'
  const [activeTab, setActiveTab] = useState<'participate' | 'check_status'>('participate');

  // Registration form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>(SUPPORTED_NETWORKS[0].id);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Sharing requirement state
  const [shareMethod, setShareMethod] = useState<ShareMethod>('groups_3');
  const [isConfirmingShare, setIsConfirmingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedAdminProof, setCopiedAdminProof] = useState(false);
  const [whatsAppAttempted, setWhatsAppAttempted] = useState(false);

  // Status lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Active registration (loaded from server / storage)
  const [currentRegistration, setCurrentRegistration] = useState<ParticipantRegistration | null>(null);

  // Referral state
  const [referralCode, setReferralCode] = useState('MU-STUDENT');
  const [referralLink, setReferralLink] = useState('');
  const [incomingRef, setIncomingRef] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = getOrCreateReferralCode();
      setReferralCode(code);
      setReferralLink(getReferralLink(code));
      
      const incoming = getReferralCodeFromUrl();
      setIncomingRef(incoming);
      if (incoming) {
        trackReferralVisit(incoming);
      }

      // Check if participant already has a stored registration
      const stored = getStoredRegistration();
      if (stored) {
        setCurrentRegistration(stored);
        if (stored.network) {
          setSelectedNetwork(stored.network);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const shareText = buildWhatsAppShareText(referralLink);
  const whatsappUrl = getWhatsAppShareUrl(shareText);

  // Open WhatsApp official share
  const handleShareOnWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    setWhatsAppAttempted(true);

    // Track click
    trackShareClick(currentRegistration?.referralCode || referralCode);

    const opened = openWhatsAppShare(shareText);
    if (opened) {
      onShowToast('Opening WhatsApp... Choose 3 groups or 10 friends to share!');
    } else {
      onShowToast('If WhatsApp did not open, please use the Copy Referral Link button.');
    }
  };

  const handleCopyReferralLink = () => {
    if (navigator?.clipboard && referralLink) {
      navigator.clipboard.writeText(referralLink).then(() => {
        setCopiedLink(true);
        onShowToast('Unique referral link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handleCopyFullMessage = () => {
    if (navigator?.clipboard && shareText) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopiedMessage(true);
        onShowToast('Full WhatsApp message copied with your referral link!');
        setTimeout(() => setCopiedMessage(false), 2500);
      });
    }
  };

  // Step 1: Register Phone & Network
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsSubmittingReg(true);

    const res = await registerStudent({
      phoneNumber,
      network: selectedNetwork,
      referralCode,
      referredBy: incomingRef,
      fullName: fullName.trim() || undefined,
    });

    setIsSubmittingReg(false);

    if (res.success && res.registration) {
      setCurrentRegistration(res.registration);
      if (res.alreadyRegistered) {
        onShowToast('You are already registered! Your current participation status is shown below.');
      } else {
        onShowToast('Registration successful! Now complete the sharing step.');
      }
    } else {
      setRegError(res.error || 'Failed to submit registration. Please check your phone number.');
    }
  };

  // Step 2: "I've Shared" Confirmation
  const handleConfirmShared = async () => {
    if (!currentRegistration && !phoneNumber) {
      onShowToast('Please register your phone number first.');
      return;
    }

    setIsConfirmingShare(true);
    const res = await confirmSharing({
      phoneNumber: currentRegistration?.phoneNumber || phoneNumber,
      referralCode: currentRegistration?.referralCode || referralCode,
      shareMethod,
    });
    setIsConfirmingShare(false);

    if (res.success && res.registration) {
      setCurrentRegistration(res.registration);
      onShowToast('Share confirmation recorded! Status: Share Confirmed – Awaiting Review.');
    } else {
      onShowToast(res.error || 'Could not record share confirmation.');
    }
  };

  // Step 3: Notify Admin via WhatsApp
  const handleNotifyAdminWhatsApp = () => {
    if (!currentRegistration) return;

    // Track notify click
    trackNotifyAdminClick(currentRegistration.id);

    const msg = buildAdminWhatsAppMessage({
      id: currentRegistration.id,
      phoneNumber: currentRegistration.phoneNumber,
      phoneMasked: currentRegistration.phoneMasked,
      network: currentRegistration.network,
      referralCode: currentRegistration.referralCode,
      shareMethod: currentRegistration.shareMethod,
      shareConfirmedAt: currentRegistration.shareConfirmedAt,
      status: currentRegistration.status,
    });

    const opened = openAdminWhatsApp(msg, ADMIN_NOTIFICATION_NUMBER);
    if (opened) {
      onShowToast(`Opening WhatsApp to Admin (${ADMIN_NOTIFICATION_NUMBER})... Remember to press SEND in WhatsApp!`);
    } else {
      onShowToast('Could not open WhatsApp window. Please use Copy Proof Message below.');
    }
  };

  const handleCopyAdminProof = () => {
    if (!currentRegistration) return;
    const msg = buildAdminWhatsAppMessage({
      id: currentRegistration.id,
      phoneNumber: currentRegistration.phoneNumber,
      phoneMasked: currentRegistration.phoneMasked,
      network: currentRegistration.network,
      referralCode: currentRegistration.referralCode,
      shareMethod: currentRegistration.shareMethod,
      shareConfirmedAt: currentRegistration.shareConfirmedAt,
      status: currentRegistration.status,
    });

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(msg).then(() => {
        setCopiedAdminProof(true);
        onShowToast('Proof message copied! Send it to 2348156310125 in WhatsApp.');
        setTimeout(() => setCopiedAdminProof(false), 2500);
      });
    }
  };

  // Step 4: Lookup existing status
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;

    setLookupError(null);
    setIsLookingUp(true);

    const res = await lookupStatus(lookupQuery);
    setIsLookingUp(false);

    if (res.found && res.registration) {
      setCurrentRegistration(res.registration);
      setActiveTab('participate');
      onShowToast('Participation record loaded!');
    } else {
      setLookupError(res.error || 'No matching registration found. Please verify your phone number or referral code.');
    }
  };

  const handleRefreshStatus = async () => {
    if (!currentRegistration) return;
    const query = currentRegistration.referralCode || currentRegistration.phoneNumber;
    if (!query) return;

    const res = await lookupStatus(query);
    if (res.found && res.registration) {
      setCurrentRegistration(res.registration);
      onShowToast('Status refreshed!');
    }
  };

  const activeNetworkData = SUPPORTED_NETWORKS.find((n) => n.id === selectedNetwork);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      
      {/* Modal Container */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-[#081b3d] border border-blue-500/50 shadow-2xl max-h-[94vh] flex flex-col overflow-hidden text-slate-100"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-10 h-1.5 bg-blue-400/40 rounded-full mx-auto my-2.5" />

        {/* Modal Header */}
        <div className="px-5 py-3.5 sm:py-4 flex items-center justify-between border-b border-blue-800/60 bg-[#051430]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-950 flex items-center justify-center font-black">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h3 id="modal-title" className="text-sm sm:text-base font-extrabold text-white">
                Giveaway Participation &amp; Sharing
              </h3>
              <p className="text-[11px] text-blue-300">
                Marion Undefeated · ₦200 Airtime Drop
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-blue-900/40 cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Participate vs Check Status */}
        <div className="grid grid-cols-2 bg-[#040e24] p-1.5 border-b border-blue-800/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('participate')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'participate'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Participate &amp; Share</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('check_status')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'check_status'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-cyan-300" />
            <span>Check My Status</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* TAB 1: CHECK STATUS LOOKUP */}
          {activeTab === 'check_status' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[#061533] border border-blue-600/50 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <span>Check Your Participation Status</span>
                </h4>
                <p className="text-xs text-blue-200 leading-relaxed">
                  Enter your registered Nigerian phone number or referral code to check if your ₦200 airtime has been approved, credited, or is under review.
                </p>

                <form onSubmit={handleLookup} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Phone Number or Referral Code (e.g. 08031234567 or MU-XXXXX)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 08031234567"
                        value={lookupQuery}
                        onChange={(e) => setLookupQuery(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#030c1d] border border-blue-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-yellow-400"
                      />
                      <button
                        type="submit"
                        disabled={isLookingUp}
                        className="tap-bounce px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isLookingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        <span>Look Up</span>
                      </button>
                    </div>
                  </div>

                  {lookupError && (
                    <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-600 text-red-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                </form>
              </div>

              {currentRegistration && (
                <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-800/60 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Found active record on device</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('participate')}
                    className="text-xs font-bold text-yellow-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Participation Status</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PARTICIPATE & SHARE */}
          {activeTab === 'participate' && (
            <div className="space-y-4">
              
              {/* Incoming Referral Tag if referred */}
              {incomingRef && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-between gap-2 text-xs text-emerald-200">
                  <div className="flex items-center gap-2 truncate">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      Referred by student <strong className="text-white font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded">{incomingRef}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider shrink-0">
                    Linked &amp; Verified
                  </span>
                </div>
              )}

              {/* Status Banner IF already registered / confirmed */}
              {currentRegistration ? (
                <div className={`p-4 rounded-2xl border shadow-md space-y-3 ${
                  currentRegistration.rewardStatus === 'credited'
                    ? 'bg-gradient-to-b from-emerald-950 to-emerald-900/80 border-emerald-400'
                    : currentRegistration.rewardStatus === 'approved'
                    ? 'bg-gradient-to-b from-cyan-950 to-cyan-900/80 border-cyan-400'
                    : currentRegistration.rewardStatus === 'declined'
                    ? 'bg-gradient-to-b from-red-950 to-red-900/80 border-red-400'
                    : currentRegistration.shareConfirmed
                    ? 'bg-gradient-to-b from-[#0a234f] to-[#071838] border-yellow-400/80'
                    : 'bg-gradient-to-b from-[#091e42] to-[#051430] border-blue-600/70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">
                        Current Participation Status
                      </span>
                      <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
                        {currentRegistration.rewardStatus === 'credited' ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                            <span className="text-emerald-300">Airtime Paid (₦200 Disbursed)</span>
                          </>
                        ) : currentRegistration.rewardStatus === 'approved' ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                            <span className="text-cyan-300">Approved for Airtime</span>
                          </>
                        ) : currentRegistration.rewardStatus === 'declined' ? (
                          <>
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                            <span className="text-red-300">Entry Rejected</span>
                          </>
                        ) : currentRegistration.shareConfirmed ? (
                          <>
                            <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
                            <span className="text-yellow-300">Share Confirmed – Awaiting Review</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5 text-blue-300 shrink-0" />
                            <span className="text-blue-200">Registered – Share Pending</span>
                          </>
                        )}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefreshStatus}
                      className="tap-bounce p-1.5 rounded-lg bg-blue-900/60 text-slate-300 hover:text-white border border-blue-700/50 cursor-pointer"
                      title="Refresh current status"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-blue-800/40">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Registration ID:</span>
                      <span className="font-mono text-white text-[11px] truncate block">
                        {currentRegistration.id}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Phone Line:</span>
                      <span className="font-mono font-bold text-white">
                        {currentRegistration.phoneMasked || currentRegistration.phoneNumber}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Network Provider:</span>
                      <span className="font-bold uppercase text-yellow-300">
                        {currentRegistration.network}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Reward Amount:</span>
                      <span className="font-black text-white">₦{currentRegistration.airtimeAmount || 200} Airtime</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Confirmation Method:</span>
                      <span className="text-slate-200 font-medium">
                        {currentRegistration.shareMethod === 'groups_3'
                          ? '3 WhatsApp Groups'
                          : currentRegistration.shareMethod === 'individuals_10'
                          ? '10 Individuals'
                          : 'Pending Sharing'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Review Level:</span>
                      <span className="text-amber-300 font-medium">
                        {currentRegistration.shareConfirmed ? 'Self-Reported (Admin Review)' : 'Unconfirmed'}
                      </span>
                    </div>
                  </div>

                  {currentRegistration.shareConfirmedAt && (
                    <div className="text-[11px] text-slate-300 pt-1">
                      Confirmation recorded on:{' '}
                      <strong className="text-white">
                        {new Date(currentRegistration.shareConfirmedAt).toLocaleString()}
                      </strong>
                    </div>
                  )}

                  {currentRegistration.adminNote && (
                    <div className="p-2 rounded-lg bg-[#030a1c] border border-blue-700/50 text-[11px] text-blue-200">
                      <strong>Administrator Note:</strong> {currentRegistration.adminNote}
                    </div>
                  )}

                  {/* SECTION C: WHATSAPP NOTIFICATION TO ADMINISTRATOR (2348156310125) */}
                  {currentRegistration.shareConfirmed && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#051126] border border-emerald-500/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>Notify Administrator via WhatsApp</span>
                        </span>
                        <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                          {ADMIN_NOTIFICATION_NUMBER}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Speed up your review by sending your pre-filled registration and proof directly to the administrator on WhatsApp.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleNotifyAdminWhatsApp}
                          className="tap-bounce flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer border border-emerald-300/40"
                        >
                          <Send className="w-3.5 h-3.5 fill-slate-950 text-emerald-700" />
                          <span>Notify Admin ({ADMIN_NOTIFICATION_NUMBER})</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyAdminProof}
                          className="tap-bounce py-2 px-3 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700/60 text-blue-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-yellow-400" />
                          <span>{copiedAdminProof ? 'Proof Copied!' : 'Copy Proof Text'}</span>
                        </button>
                      </div>

                      <div className="text-[10px] text-amber-200/90 bg-amber-950/40 border border-amber-600/30 p-2 rounded-lg flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Delivery Note:</strong> WhatsApp will open addressed to <strong>{ADMIN_NOTIFICATION_NUMBER}</strong> with your prefilled details. You must press <strong>Send</strong> inside WhatsApp to deliver your notification.
                        </span>
                      </div>
                    </div>
                  )}

                  {currentRegistration.rewardStatus === 'credited' ? (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Congratulations! Your ₦200 airtime has been sent manually by the administrator. Thank you for making every penny count!
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      Airtime is distributed manually by the administrator to confirmed participants on a first-come basis across the 50 slots. You can return to this page anytime to check for updates.
                    </p>
                  )}
                </div>
              ) : (
                /* STEP 1: REGISTRATION FORM (If not registered yet) */
                <form onSubmit={handleRegister} className="p-4 rounded-2xl bg-gradient-to-b from-[#09224f] to-[#061533] border border-blue-500/50 shadow-md space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center">
                      1
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      Step 1: Enter Your Phone Number &amp; Network
                    </h4>
                  </div>

                  {/* Network Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      Select Your Mobile Network
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SUPPORTED_NETWORKS.map((network) => {
                        const isSelected = selectedNetwork === network.id;
                        return (
                          <button
                            key={network.id}
                            type="button"
                            onClick={() => setSelectedNetwork(network.id)}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-900/60 border-yellow-400 ring-1 ring-yellow-400/50'
                                : 'bg-[#051126] border-blue-800/60 hover:border-blue-600/60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: network.color }}
                              />
                              <span className="font-bold text-xs text-white truncate">
                                {network.name}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phone Number Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Your Active Nigerian Phone Number (For ₦200 Airtime)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0803 123 4567 or 070..."
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#030c1d] border border-blue-600/70 text-white font-mono text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>
                    {activeNetworkData && (
                      <p className="mt-1 text-[10px] text-blue-300">
                        {activeNetworkData.name} prefixes: {activeNetworkData.prefix}
                      </p>
                    )}
                  </div>

                  {/* Student Name (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name / Department <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Marion / Computer Science"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#030c1d] border border-blue-700 text-white text-xs focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  {regError && (
                    <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-600 text-red-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="tap-bounce w-full py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-300 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingReg ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Registering Phone...</span>
                      </>
                    ) : (
                      <span>Save &amp; Proceed to Sharing Requirement</span>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: SHARING REQUIREMENT & "I'VE SHARED" CONFIRMATION */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#09224f] to-[#061533] border border-blue-500/50 shadow-md space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      Sharing Requirement to Qualify
                    </h4>
                  </div>
                  <span className="text-[10px] text-yellow-400 font-semibold px-2 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/30 font-mono">
                    {currentRegistration?.referralCode || referralCode}
                  </span>
                </div>

                {/* Specific Rule Display */}
                <div className="p-3.5 rounded-xl bg-[#040e24] border border-yellow-400/40 space-y-1.5">
                  <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider block">
                    ★ Official Participation Rule:
                  </span>
                  <p className="text-xs text-white leading-relaxed">
                    Participants must share their giveaway link with either:
                  </p>
                  <ul className="text-xs text-slate-200 list-disc list-inside space-y-1 font-medium pl-1">
                    <li><strong className="text-yellow-400">3 WhatsApp groups</strong> (faculty, department, hostel, or coursemates), <span className="uppercase text-yellow-300 font-black">OR</span></li>
                    <li><strong className="text-yellow-400">10 individual people</strong> (coursemates or friends).</li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-blue-900/60 text-[11px] text-emerald-300 font-semibold">
                    ✓ Fair Rule: Your friends do NOT need to register through your link. We do not count referral sign-ups as a condition for airtime eligibility.
                  </div>
                </div>

                {/* WhatsApp Share Button */}
                <a
                  href={whatsappUrl}
                  onClick={handleShareOnWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-bounce w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer border border-emerald-300/40"
                >
                  <MessageCircle className="w-5 h-5 fill-slate-950 text-emerald-600" />
                  <span>Share on WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>

                {/* Fallback Copy Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyReferralLink}
                    className="tap-bounce py-2 px-3 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/50 text-blue-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-yellow-400" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFullMessage}
                    className="tap-bounce py-2 px-3 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/50 text-blue-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{copiedMessage ? 'Message Copied!' : 'Copy Message'}</span>
                  </button>
                </div>

                {/* Method Selection Radio */}
                <div className="pt-2 border-t border-blue-800/40 space-y-2">
                  <span className="block text-xs font-bold text-slate-200">
                    Select how you shared:
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      shareMethod === 'groups_3'
                        ? 'bg-blue-900/60 border-yellow-400 ring-1 ring-yellow-400/40'
                        : 'bg-[#040e24] border-blue-800/60'
                    }`}>
                      <input
                        type="radio"
                        name="share_choice"
                        checked={shareMethod === 'groups_3'}
                        onChange={() => setShareMethod('groups_3')}
                        className="text-yellow-400 focus:ring-yellow-400"
                      />
                      <span className="text-xs font-bold text-white">
                        Shared to 3 WhatsApp Groups
                      </span>
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      shareMethod === 'individuals_10'
                        ? 'bg-blue-900/60 border-yellow-400 ring-1 ring-yellow-400/40'
                        : 'bg-[#040e24] border-blue-800/60'
                    }`}>
                      <input
                        type="radio"
                        name="share_choice"
                        checked={shareMethod === 'individuals_10'}
                        onChange={() => setShareMethod('individuals_10')}
                        className="text-yellow-400 focus:ring-yellow-400"
                      />
                      <span className="text-xs font-bold text-white">
                        Shared to 10 Individuals
                      </span>
                    </label>
                  </div>
                </div>

                {/* THE "I'VE SHARED" CONFIRMATION BUTTON */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={handleConfirmShared}
                    disabled={isConfirmingShare}
                    className="tap-bounce w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-950/60 hover:from-emerald-400 hover:to-teal-300 transition-all cursor-pointer flex items-center justify-center gap-2 border border-emerald-300 disabled:opacity-50"
                  >
                    {isConfirmingShare ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Recording Confirmation...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 fill-slate-950 text-emerald-400" />
                        <span>I've Shared (Submit for Review)</span>
                      </>
                    )}
                  </button>

                  {/* Anti-Deception & Transparency Notice */}
                  <div className="p-2.5 rounded-xl bg-blue-950/70 border border-blue-700/40 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Honest Participant Confirmation:</strong> Clicking <em>"I've Shared"</em> records your confirmation and marks your entry as <strong>"Awaiting Review"</strong>. Entries are never automatically approved without administrator inspection.
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#051430] border-t border-blue-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Powered by Marion Undefeated</span>
          <button
            type="button"
            onClick={onClose}
            className="text-yellow-400 font-semibold hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
