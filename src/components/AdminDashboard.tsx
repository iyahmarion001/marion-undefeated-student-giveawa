import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, LogOut, RefreshCw, Download, Search, Filter, 
  CheckCircle, Clock, AlertCircle, Phone, Copy, Check, User, 
  X, ArrowLeft, Send, Sparkles, MessageCircle, FileSpreadsheet, 
  ThumbsUp, ThumbsDown, DollarSign, ExternalLink, Calendar, Hash,
  Database
} from 'lucide-react';
import { 
  adminLogin, 
  fetchAdminRegistrations, 
  updateRewardStatus, 
  getStoredAdminToken, 
  saveAdminToken, 
  clearAdminToken,
  toSafeString
} from '../utils/api';
import { GiveawayStats, SUPPORTED_NETWORKS, GIVEAWAY_INFO } from '../types/giveaway';
import { ADMIN_NOTIFICATION_NUMBER } from '../utils/referral';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

const safeNetworkUpper = (net?: string | null) => {
  if (!net) return 'UNKNOWN';
  return toSafeString(net).toUpperCase();
};

const safeFormatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? toSafeString(dateStr) : d.toLocaleDateString();
  } catch {
    return '—';
  }
};

const safeFormatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? toSafeString(dateStr) : d.toLocaleString();
  } catch {
    return '—';
  }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [token, setToken] = useState<string | null>(getStoredAdminToken());
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [stats, setStats] = useState<GiveawayStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const [diagnostic, setDiagnostic] = useState<any | null>(null);
  const [isCheckingDiag, setIsCheckingDiag] = useState(false);
  const [showDiag, setShowDiag] = useState(false);

  const handleCheckDiagnostic = async () => {
    setIsCheckingDiag(true);
    setShowDiag(true);
    try {
      const res = await fetch('/api/diagnostic');
      const data = await res.json();
      setDiagnostic(data);
    } catch (e: any) {
      setDiagnostic({ error: 'Failed to contact diagnostic endpoint: ' + (e?.message || e) });
    } finally {
      setIsCheckingDiag(false);
    }
  };

  const loadData = async (activeToken: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await fetchAdminRegistrations(activeToken);
      if (result.success && result.registrations) {
        setRegistrations(Array.isArray(result.registrations) ? result.registrations : []);
        if (result.stats) setStats(result.stats);
      } else {
        const errMsg = toSafeString(result.error, 'Failed to load records.');
        if (errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('jwt')) {
          clearAdminToken();
          setToken(null);
          onShowToast('Session expired. Please log in again.');
        } else {
          setFetchError(errMsg);
          onShowToast(errMsg);
        }
      }
    } catch (err: any) {
      const errMsg = toSafeString(err?.message || err, 'Network error while contacting admin endpoint.');
      setFetchError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      loadData(token);
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    const res = await adminLogin(passwordInput, 'iyahmarion24@gmail.com');
    setIsLoggingIn(false);

    if (res.success && res.token) {
      setToken(res.token);
      onShowToast('Administrator logged in successfully.');
      loadData(res.token);
    } else {
      const err = toSafeString(res.error, 'Invalid administrator password.');
      setLoginError(err);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setToken(null);
    setRegistrations([]);
    onShowToast('Logged out of admin dashboard.');
  };

  const handleCopyPhone = (phone?: string) => {
    if (!phone) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(phone).then(() => {
        setCopiedPhone(phone);
        onShowToast(`Copied phone number ${phone} for airtime recharge!`);
        setTimeout(() => setCopiedPhone(null), 2500);
      });
    }
  };

  const handleCopyId = (id?: string) => {
    if (!id) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        setCopiedId(id);
        onShowToast(`Copied Registration ID: ${id}`);
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  const handleStatusChange = async (id?: string, newStatus?: string, defaultNote?: string) => {
    if (!id || !newStatus || !token) return;
    const res = await updateRewardStatus(token, id, newStatus, defaultNote);
    if (res.success) {
      const label = 
        newStatus === 'approved' ? 'Approved' :
        newStatus === 'credited' ? 'Marked as Paid (₦200)' :
        newStatus === 'declined' ? 'Rejected' : 'Set to Pending Review';
      onShowToast(`Student #${String(id).slice(-6)}: ${label}`);
      loadData(token);
    } else {
      onShowToast(toSafeString(res.error, 'Failed to update status.'));
    }
  };

  const handleSaveNote = async (id?: string) => {
    if (!id || !token) return;
    const current = list.find((r) => r.id === id);
    const res = await updateRewardStatus(token, id, current?.rewardStatus || 'pending_review', noteText);
    if (res.success) {
      onShowToast('Admin note saved.');
      setEditingNoteId(null);
      loadData(token);
    } else {
      onShowToast(toSafeString(res.error, 'Failed to save note.'));
    }
  };

  const handleExportCsv = () => {
    if (!token) return;
    window.open(`/api/admin/export-csv?token=${encodeURIComponent(token)}`, '_blank');
    onShowToast('Downloading airtime disbursement list CSV...');
  };

  const handleOpenStudentWhatsApp = (phoneNumber: string, name?: string) => {
    let clean = phoneNumber.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '234' + clean.slice(1);
    }
    const message = encodeURIComponent(
      `Hello ${name || 'Student'}! This is Marion Undefeated Admin regarding your ₦200 student airtime giveaway entry.`
    );
    window.open(`https://wa.me/${clean}?text=${message}`, '_blank');
  };

  // Safe registration list
  const list = Array.isArray(registrations) ? registrations.filter(Boolean) : [];

  // Filter registrations
  const filtered = list.filter((reg) => {
    if (!reg) return false;
    const phone = String(reg.phoneNumber || (reg as any).phone_number || (reg as any).phone || '');
    const name = String(reg.fullName || '');
    const ref = String(reg.referralCode || '');
    const by = String(reg.referredBy || '');
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = !q ||
      phone.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      ref.toLowerCase().includes(q) ||
      by.toLowerCase().includes(q);

    const matchesNetwork = networkFilter === 'all' || reg.network === networkFilter;

    let matchesStatus = true;
    if (statusFilter === 'pending_review') {
      matchesStatus = reg.rewardStatus === 'pending_review' && Boolean(reg.shareConfirmed);
    } else if (statusFilter === 'approved') {
      matchesStatus = reg.rewardStatus === 'approved';
    } else if (statusFilter === 'credited') {
      matchesStatus = reg.rewardStatus === 'credited';
    } else if (statusFilter === 'declined') {
      matchesStatus = reg.rewardStatus === 'declined';
    } else if (statusFilter === 'pending_share') {
      matchesStatus = !reg.shareConfirmed;
    }

    return matchesSearch && matchesNetwork && matchesStatus;
  });

  // Calculate dynamic stats
  const totalCount = stats?.totalRegistered ?? list.length;
  const pendingCount = stats?.pendingReview ?? list.filter((r) => r.shareConfirmed && r.rewardStatus === 'pending_review').length;
  const approvedCount = stats?.approvedEntries ?? list.filter((r) => r.rewardStatus === 'approved').length;
  const creditedCount = stats?.airtimeCredited ?? list.filter((r) => r.rewardStatus === 'credited').length;
  const declinedCount = stats?.rejectedEntries ?? list.filter((r) => r.rewardStatus === 'declined').length;
  const totalPaidAmount = creditedCount * 200;
  const remainingSlots = Math.max(0, 50 - creditedCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className="w-full max-w-6xl max-h-[96vh] rounded-2xl sm:rounded-3xl bg-[#061533] border border-blue-500/60 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-blue-800/60 bg-[#040e24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 id="admin-modal-title" className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Marion Undefeated – Private Admin Portal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Campaign 2026
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-blue-300">
                <span>Admin: <strong className="text-white font-mono">iyahmarion24@gmail.com</strong></span>
                <span className="hidden sm:inline">·</span>
                <span>WhatsApp Notification: <strong className="text-emerald-400 font-mono">{ADMIN_NOTIFICATION_NUMBER}</strong> (08057231961)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token && (
              <button
                onClick={handleLogout}
                type="button"
                className="tap-bounce p-2 sm:px-3 sm:py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-blue-900/40 cursor-pointer transition-colors"
              aria-label="Close admin modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!token ? (
          /* Authentication Screen */
          <div className="p-6 sm:p-12 flex flex-col items-center justify-center max-w-md mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 text-yellow-300 flex items-center justify-center mb-4 border border-yellow-400/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">Private Administrator Access</h3>
            <p className="text-xs text-blue-200 mt-1.5 max-w-sm leading-relaxed">
              Enter your secure administrator password to view student registrations, review sharing confirmations, approve entries, and manage manual ₦200 airtime payments.
            </p>

            <form onSubmit={handleLogin} className="w-full mt-6 space-y-4">
              <div>
                <label className="block text-left text-xs font-bold text-slate-300 mb-1.5">
                  Admin Passcode
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter administrator passcode"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#030c1d] border border-blue-600/60 text-white text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 font-mono"
                />
                <p className="text-[11px] text-slate-400 text-left mt-1.5">
                  Requires private <code className="text-blue-300 font-mono">ADMIN_PASSWORD</code> configured in server/Vercel settings.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-red-950/80 border border-red-600/60 text-red-200 text-xs text-left flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{toSafeString(loginError)}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-300 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Access Private Dashboard</span>
                )}
              </button>
            </form>

            {/* Safe Diagnostic Panel on Login Screen */}
            <div className="w-full mt-4 pt-4 border-t border-blue-900/40 text-left">
              <button
                type="button"
                onClick={handleCheckDiagnostic}
                disabled={isCheckingDiag}
                className="w-full py-2 px-3 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 text-xs font-semibold flex items-center justify-between border border-blue-800/40 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Check Server &amp; Database Health</span>
                </span>
                {isCheckingDiag ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <span className="text-[10px] text-slate-400">{showDiag ? 'Refresh' : 'Diagnose'}</span>
                )}
              </button>

              {showDiag && diagnostic && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-blue-800/50 text-[11px] space-y-1.5 animate-fade-in font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Environment:</span>
                    <span className="text-white font-bold">{toSafeString(diagnostic.environment, 'Vercel / Node')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className={diagnostic.database?.connectionActive ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {toSafeString(diagnostic.database?.storageEngine, 'Checking...')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">DB Connection:</span>
                    <span className={diagnostic.database?.connectionActive ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {diagnostic.database?.connectionActive ? 'Active' : 'Fallback / Standby'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ADMIN_PASSWORD:</span>
                    <span className={diagnostic.adminPasswordConfigured ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {diagnostic.adminPasswordConfigured ? 'Configured (Env)' : 'Not Configured (Required)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Session Signing Key:</span>
                    <span className={diagnostic.adminSessionKeyPersistent ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {toSafeString(diagnostic.adminSessionKeySource, 'Persistent (Env)')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin WhatsApp:</span>
                    <span className="text-blue-300 font-bold">2348057231961</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">WhatsApp API:</span>
                    <span className="text-slate-300">
                      {diagnostic.whatsappDeliveryMode ? toSafeString(diagnostic.whatsappDeliveryMode) : 'Direct Chat Fallback (Optional API)'}
                    </span>
                  </div>
                  {diagnostic.database?.lastDiagnosticMessage && (
                    <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <strong>Status:</strong> {toSafeString(diagnostic.database.lastDiagnosticMessage)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Main Admin Dashboard */
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
            
            {/* Backend connection error banner */}
            {fetchError && (
              <div className="p-3.5 sm:p-4 rounded-xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fade-in">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <strong className="text-white block sm:inline">API Connection Notice: </strong>
                    <span>{toSafeString(fetchError)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => token && loadData(token)}
                  className="tap-bounce px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection</span>
                </button>
              </div>
            )}

            {/* Top Metric Cards (5 Comprehensive Campaign Totals) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              
              {/* Total Registered */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#091f47] border border-blue-700/50">
                <div className="text-[10px] sm:text-xs text-blue-300 font-medium">Total Registered</div>
                <div className="text-xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                  {totalCount}
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">Students enrolled</div>
              </div>

              {/* Pending Reviews */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#091f47] border border-amber-500/50">
                <div className="text-[10px] sm:text-xs text-amber-300 font-medium">Awaiting Review</div>
                <div className="text-xl sm:text-3xl font-black text-amber-400 tabular-nums mt-0.5">
                  {pendingCount}
                </div>
                <div className="text-[10px] text-amber-200/80 mt-0.5">Self-confirmed shares</div>
              </div>

              {/* Approved Entries */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#091f47] border border-cyan-500/50">
                <div className="text-[10px] sm:text-xs text-cyan-300 font-medium">Approved Entries</div>
                <div className="text-xl sm:text-3xl font-black text-cyan-300 tabular-nums mt-0.5">
                  {approvedCount}
                </div>
                <div className="text-[10px] text-cyan-200/80 mt-0.5">Ready for airtime</div>
              </div>

              {/* Airtime Paid */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#091f47] border border-emerald-500/50">
                <div className="text-[10px] sm:text-xs text-emerald-300 font-medium">Airtime Paid</div>
                <div className="text-xl sm:text-3xl font-black text-emerald-400 tabular-nums mt-0.5">
                  {creditedCount} <span className="text-xs font-normal text-slate-400">/ 50</span>
                </div>
                <div className="text-[10px] text-emerald-300 font-bold mt-0.5">
                  ₦{totalPaidAmount.toLocaleString()} paid
                </div>
              </div>

              {/* Rejected Entries */}
              <div className="col-span-2 lg:col-span-1 p-3 sm:p-4 rounded-xl bg-[#091f47] border border-red-500/40">
                <div className="text-[10px] sm:text-xs text-red-300 font-medium">Rejected Entries</div>
                <div className="text-xl sm:text-3xl font-black text-red-400 tabular-nums mt-0.5">
                  {declinedCount}
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  {remainingSlots} slots remaining (₦{remainingSlots * 200})
                </div>
              </div>

            </div>

            {/* Network Breakdown Strip */}
            <div className="p-3 rounded-xl bg-[#040e24] border border-blue-800/50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300">
                Network Provider Breakdown:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {SUPPORTED_NETWORKS.map((net) => {
                  const count = list.filter((r) => (r?.network || '').toLowerCase() === net.id.toLowerCase()).length;
                  return (
                    <div
                      key={net.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${net.color}15`,
                        borderColor: `${net.color}50`,
                        color: net.textColor === '#FFFFFF' ? '#ffffff' : '#ffd000',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: net.color }} />
                      <span>{net.name}:</span>
                      <span className="text-white font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Search, Filter & Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              
              <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search phone, student name, referral code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#030c1d] border border-blue-700/60 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400"
                  />
                </div>

                {/* Network Filter */}
                <select
                  value={networkFilter}
                  onChange={(e) => setNetworkFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#030c1d] border border-blue-700/60 text-xs text-white focus:outline-none focus:border-yellow-400"
                >
                  <option value="all">All Networks</option>
                  <option value="mtn">MTN</option>
                  <option value="airtel">Airtel</option>
                  <option value="glo">Glo</option>
                  <option value="9mobile">9mobile</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#030c1d] border border-blue-700/60 text-xs text-white focus:outline-none focus:border-yellow-400"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending_review">Awaiting Review</option>
                  <option value="approved">Approved for Airtime</option>
                  <option value="credited">Airtime Paid (₦200)</option>
                  <option value="declined">Rejected Entries</option>
                  <option value="pending_share">Pending Share</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadData(token)}
                  disabled={isLoading}
                  className="tap-bounce p-2 sm:px-3 sm:py-2 rounded-xl bg-blue-900/60 hover:bg-blue-800/60 text-blue-200 border border-blue-700/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="tap-bounce px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

            </div>

            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-[#040e24] rounded-2xl border border-blue-900/50">
                  {isLoading ? 'Loading records...' : 'No registrations match your search.'}
                </div>
              ) : (
                filtered.map((reg) => {
                  const networkObj = SUPPORTED_NETWORKS.find((n) => n.id === (reg?.network || '').toLowerCase());
                  const isPaid = reg.rewardStatus === 'credited';
                  const isApproved = reg.rewardStatus === 'approved';
                  const isDeclined = reg.rewardStatus === 'declined';
                  const fullPhone = toSafeString(reg.phoneNumber || (reg as any).phone_number || (reg as any).phone);

                  return (
                    <div
                      key={reg.id}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                        isPaid
                          ? 'bg-emerald-950/30 border-emerald-500/60'
                          : isApproved
                          ? 'bg-cyan-950/30 border-cyan-500/60'
                          : isDeclined
                          ? 'bg-red-950/30 border-red-500/50'
                          : 'bg-[#040e24] border-blue-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-white text-sm whitespace-nowrap">
                            <span className="select-all tracking-wide">{fullPhone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(fullPhone)}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Copy Phone"
                            >
                              {copiedPhone === fullPhone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-blue-300 font-mono mt-0.5">
                            <span className="text-slate-400">ID:</span>
                            <span className="truncate max-w-[130px]">{toSafeString(reg.id)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(reg.id)}
                              className="p-0.5 rounded text-slate-400 hover:text-white"
                              title="Copy Registration ID"
                            >
                              {copiedId === reg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          {reg.fullName && (
                            <div className="text-xs text-slate-300 mt-0.5">
                              {toSafeString(reg.fullName)} {reg.department && `(${toSafeString(reg.department)})`}
                            </div>
                          )}
                        </div>

                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold border"
                          style={{
                            backgroundColor: `${networkObj?.color || '#0284c7'}20`,
                            borderColor: `${networkObj?.color || '#0284c7'}60`,
                            color: networkObj?.textColor === '#FFFFFF' ? '#ffffff' : '#ffd000',
                          }}
                        >
                          {networkObj?.name || safeNetworkUpper(reg.network)}
                        </span>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-blue-900/50">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Airtime:</span>
                          <span className="font-black text-white">₦{reg.airtimeAmount || 200}</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Referral Code:</span>
                          <span className="font-mono text-yellow-400 font-bold">{toSafeString(reg.referralCode)}</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Registered:</span>
                          <span className="text-slate-300">
                            {safeFormatDate(reg.registeredAt)}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Sharing Proof:</span>
                          <span className="text-slate-200">
                            {reg.shareConfirmed ? (
                              <strong className="text-emerald-300">
                                {reg.shareMethod === 'groups_3' ? '3 Groups' : '10 People'}
                              </strong>
                            ) : (
                              <span className="text-slate-400 italic">Not Confirmed</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {reg.adminNote && (
                        <div className="text-[11px] p-2 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40">
                          <strong>Note:</strong> {toSafeString(reg.adminNote)}
                        </div>
                      )}

                      {/* Action buttons on mobile */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-blue-900/50">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(reg.id, 'approved', 'Approved by Admin')}
                          className="tap-bounce flex-1 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(reg.id, 'credited', `₦200 airtime credited on ${new Date().toLocaleDateString()}`)}
                          className="tap-bounce flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Paid</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(reg.id, 'declined', 'Declined: Sharing requirement incomplete')}
                          className="tap-bounce py-1.5 px-2 rounded-lg bg-red-950/80 hover:bg-red-900/80 text-red-200 border border-red-700/60 font-semibold text-xs flex items-center justify-center gap-1"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenStudentWhatsApp(fullPhone, reg.fullName)}
                          className="tap-bounce p-1.5 rounded-lg bg-[#25D366] text-slate-950"
                          title="Contact student on WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block rounded-2xl bg-[#040e24] border border-blue-800/60 overflow-hidden">
              <div className="px-4 py-3 bg-[#030a1c] border-b border-blue-800/60 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  Student Registrations ({filtered.length} entries shown)
                </span>
                <span className="text-[11px] text-slate-400 italic">
                  Private Admin Record · Never exposed publicly
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isLoading ? 'Loading records...' : 'No student registrations match your filter criteria.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#051330] border-b border-blue-800/50 text-blue-300 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3.5">Student &amp; Phone</th>
                        <th className="py-3 px-3">Network</th>
                        <th className="py-3 px-3">Airtime</th>
                        <th className="py-3 px-3">Referral Code</th>
                        <th className="py-3 px-3">Sharing Confirmation</th>
                        <th className="py-3 px-3">Reward Status</th>
                        <th className="py-3 px-3">Admin Notes</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-900/40">
                      {filtered.map((reg) => {
                        const networkObj = SUPPORTED_NETWORKS.find((n) => n.id === (reg?.network || '').toLowerCase());
                        const isCredited = reg.rewardStatus === 'credited';
                        const isApproved = reg.rewardStatus === 'approved';
                        const isDeclined = reg.rewardStatus === 'declined';
                        const fullPhone = toSafeString(reg.phoneNumber || (reg as any).phone_number || (reg as any).phone);

                        return (
                          <tr 
                            key={reg.id} 
                            className={`hover:bg-blue-900/20 transition-colors ${
                              isCredited 
                                ? 'bg-emerald-950/20' 
                                : isApproved 
                                ? 'bg-cyan-950/20' 
                                : isDeclined 
                                ? 'bg-red-950/20' 
                                : ''
                            }`}
                          >
                            {/* Phone & Student Info */}
                            <td className="py-3 px-3.5 align-middle">
                              <div className="font-mono font-bold text-white text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap">
                                <span className="select-all tracking-wide">{fullPhone}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(fullPhone)}
                                  className="tap-bounce p-1 rounded hover:bg-blue-800/60 text-slate-400 hover:text-white cursor-pointer"
                                  title="Copy phone number for recharge"
                                >
                                  {copiedPhone === fullPhone ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentWhatsApp(fullPhone, reg.fullName)}
                                  className="p-1 rounded text-emerald-400 hover:text-emerald-300"
                                  title="Chat with student on WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-blue-300 font-mono mt-0.5">
                                <span className="text-slate-400">ID:</span>
                                <span>{toSafeString(reg.id)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyId(reg.id)}
                                  className="tap-bounce p-0.5 rounded hover:bg-blue-800/60 text-slate-400 hover:text-white cursor-pointer"
                                  title="Copy Registration ID"
                                >
                                  {copiedId === reg.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              {reg.fullName && (
                                <div className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{toSafeString(reg.fullName)}</span>
                                  {reg.department && <span className="text-slate-400">· {toSafeString(reg.department)}</span>}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{safeFormatDate(reg.registeredAt)}</span>
                              </div>
                            </td>

                            {/* Network Provider */}
                            <td className="py-3 px-3 align-middle">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
                                style={{
                                  backgroundColor: `${networkObj?.color || '#0284c7'}20`,
                                  borderColor: `${networkObj?.color || '#0284c7'}60`,
                                  color: networkObj?.textColor === '#FFFFFF' ? '#ffffff' : '#ffd000',
                                }}
                              >
                                <span 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: networkObj?.color || '#0284c7' }} 
                                />
                                <span>{networkObj?.name || safeNetworkUpper(reg.network)}</span>
                              </span>
                            </td>

                            {/* Airtime Amount */}
                            <td className="py-3 px-3 align-middle font-bold text-white text-xs">
                              ₦{reg.airtimeAmount || 200}
                            </td>

                            {/* Referral Code & Inviter */}
                            <td className="py-3 px-3 align-middle font-mono text-[11px]">
                              <div className="text-yellow-400 font-bold">{toSafeString(reg.referralCode)}</div>
                              {reg.referredBy ? (
                                <div className="text-[10px] text-slate-400">
                                  Invited by: <span className="text-blue-300">{toSafeString(reg.referredBy)}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500">Direct visitor</div>
                              )}
                            </td>

                            {/* Sharing Confirmation Status */}
                            <td className="py-3 px-3 align-middle">
                              {reg.shareConfirmed ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[11px] font-bold">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>
                                      {reg.shareMethod === 'groups_3'
                                        ? '3 WhatsApp Groups'
                                        : '10 Individuals'}
                                    </span>
                                  </span>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Proof: Self-Confirmed
                                  </div>
                                  {reg.shareConfirmedAt && (
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>
                                        {safeFormatDateTime(reg.shareConfirmedAt)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-600/50 text-slate-300 text-[10px]">
                                  <Clock className="w-3 h-3 text-yellow-400" />
                                  <span>Pending Sharing</span>
                                </span>
                              )}
                            </td>

                            {/* Reward Status Selector */}
                            <td className="py-3 px-3 align-middle">
                              <select
                                value={reg.rewardStatus}
                                onChange={(e) => handleStatusChange(reg.id, e.target.value)}
                                className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  isCredited
                                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                                    : isApproved
                                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                                    : isDeclined
                                    ? 'bg-red-950 border-red-500 text-red-300'
                                    : 'bg-amber-950 border-amber-500 text-amber-300'
                                }`}
                              >
                                <option value="pending_review">Awaiting Review</option>
                                <option value="approved">Approved</option>
                                <option value="credited">Airtime Paid (₦200)</option>
                                <option value="declined">Rejected</option>
                              </select>
                            </td>

                            {/* Admin Notes */}
                            <td className="py-3 px-3 align-middle">
                              {editingNoteId === reg.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="e.g. Sent via VTU at 11am"
                                    className="px-2 py-1 text-[11px] rounded bg-[#030c1d] border border-blue-600 text-white w-32"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveNote(reg.id)}
                                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-bold"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteId(null)}
                                    className="p-1 rounded text-slate-400 hover:text-white text-[10px]"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => {
                                    setEditingNoteId(reg.id);
                                    setNoteText(toSafeString(reg.adminNote, ''));
                                  }}
                                  className="text-[11px] text-slate-300 hover:text-white cursor-pointer hover:underline max-w-[140px] truncate"
                                  title={toSafeString(reg.adminNote, 'Click to add note')}
                                >
                                  {reg.adminNote ? `📝 ${toSafeString(reg.adminNote)}` : <span className="text-slate-500 italic">+ Note</span>}
                                </div>
                              )}
                            </td>

                            {/* Direct Quick Action Buttons */}
                            <td className="py-3 px-3.5 align-middle text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isApproved && !isCredited && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(reg.id, 'approved', 'Approved by Admin')}
                                    className="tap-bounce px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] cursor-pointer"
                                    title="Approve for airtime"
                                  >
                                    Approve
                                  </button>
                                )}

                                {!isCredited ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(reg.id, 'credited', `Airtime paid on ${new Date().toLocaleDateString()}`)}
                                    className="tap-bounce px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                    title="Mark ₦200 airtime as paid"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Mark Paid</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-400 font-bold inline-flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Paid</span>
                                  </span>
                                )}

                                {!isDeclined && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(reg.id, 'declined', 'Declined by Admin')}
                                    className="tap-bounce px-1.5 py-1 rounded bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-700/50 font-bold text-[10px] cursor-pointer"
                                    title="Reject entry"
                                  >
                                    Reject
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#040e24] border-t border-blue-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Private Administrator Console · Marion Undefeated Campaigns</span>
          <button
            type="button"
            onClick={onClose}
            className="text-yellow-400 font-semibold hover:underline cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};
