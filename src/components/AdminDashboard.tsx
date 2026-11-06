import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, LogOut, RefreshCw, Download, Search, Filter, 
  CheckCircle, Clock, AlertCircle, Phone, Copy, Check, User, 
  X, ArrowLeft, Send, Sparkles, MessageCircle, FileSpreadsheet
} from 'lucide-react';
import { 
  adminLogin, 
  fetchAdminRegistrations, 
  updateRewardStatus, 
  getStoredAdminToken, 
  saveAdminToken, 
  clearAdminToken 
} from '../utils/api';
import { GiveawayStats, SUPPORTED_NETWORKS } from '../types/giveaway';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const loadData = async (activeToken: string) => {
    setIsLoading(true);
    const result = await fetchAdminRegistrations(activeToken);
    if (result.success && result.registrations) {
      setRegistrations(result.registrations);
      if (result.stats) setStats(result.stats);
    } else {
      if (result.error?.includes('Unauthorized')) {
        clearAdminToken();
        setToken(null);
        onShowToast('Session expired. Please log in again.');
      } else {
        onShowToast(result.error || 'Failed to load records.');
      }
    }
    setIsLoading(false);
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
      setLoginError(res.error || 'Invalid administrator password.');
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setToken(null);
    setRegistrations([]);
    onShowToast('Logged out of admin dashboard.');
  };

  const handleCopyPhone = (phone: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(phone).then(() => {
        setCopiedPhone(phone);
        onShowToast(`Copied ${phone} for manual airtime top-up!`);
        setTimeout(() => setCopiedPhone(null), 2500);
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!token) return;
    const res = await updateRewardStatus(token, id, newStatus);
    if (res.success) {
      onShowToast(`Status updated to: ${newStatus}`);
      loadData(token);
    } else {
      onShowToast(res.error || 'Failed to update status.');
    }
  };

  const handleSaveNote = async (id: string) => {
    if (!token) return;
    const current = registrations.find((r) => r.id === id);
    const res = await updateRewardStatus(token, id, current?.rewardStatus || 'pending_review', noteText);
    if (res.success) {
      onShowToast('Admin note saved.');
      setEditingNoteId(null);
      loadData(token);
    } else {
      onShowToast(res.error || 'Failed to save note.');
    }
  };

  const handleExportCsv = () => {
    if (!token) return;
    window.open('/api/admin/export-csv', '_blank');
    onShowToast('Downloading airtime disbursement list CSV...');
  };

  // Filter registrations
  const filtered = registrations.filter((reg) => {
    const matchesSearch =
      reg.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.referralCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.referredBy?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesNetwork = networkFilter === 'all' || reg.network === networkFilter;

    let matchesStatus = true;
    if (statusFilter === 'confirmed') {
      matchesStatus = reg.shareConfirmed === true;
    } else if (statusFilter === 'credited') {
      matchesStatus = reg.rewardStatus === 'credited';
    } else if (statusFilter === 'pending_share') {
      matchesStatus = !reg.shareConfirmed;
    }

    return matchesSearch && matchesNetwork && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className="w-full max-w-6xl max-h-[96vh] rounded-2xl sm:rounded-3xl bg-[#061533] border border-blue-500/50 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-blue-800/60 bg-[#040e24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 id="admin-modal-title" className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Marion Undefeated – Admin Portal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                  Manual Airtime Drop
                </span>
              </h2>
              <p className="text-[11px] text-blue-300">
                Administrator: <span className="text-white font-mono">iyahmarion24@gmail.com</span>
              </p>
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
            <h3 className="text-xl font-black text-white">Administrator Sign In</h3>
            <p className="text-xs text-blue-200 mt-1 max-w-xs">
              Enter your administrator password to review registrations, confirm sharing claims, and disburse ₦200 airtime rewards.
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
                <p className="text-[11px] text-slate-400 text-left mt-1">
                  Default passcode: <code className="text-yellow-400 font-mono">marion2026</code>
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-red-950/80 border border-red-600/60 text-red-200 text-xs text-left flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{loginError}</span>
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
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Access Admin Dashboard</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Main Admin Dashboard */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#091f47] border border-blue-700/50">
                <div className="text-[11px] sm:text-xs text-blue-300 font-medium">Total Registered</div>
                <div className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                  {stats?.totalRegistered ?? registrations.length}
                </div>
                <div className="text-[10px] sm:text-[11px] text-blue-300 mt-1">
                  Unique student phone records
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#091f47] border border-blue-700/50">
                <div className="text-[11px] sm:text-xs text-yellow-300 font-medium">Shares Confirmed</div>
                <div className="text-2xl sm:text-3xl font-black text-yellow-400 tabular-nums mt-0.5">
                  {stats?.sharesConfirmed ?? registrations.filter((r) => r.shareConfirmed).length}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 mt-1">
                  Awaiting your review
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#091f47] border border-blue-700/50">
                <div className="text-[11px] sm:text-xs text-emerald-300 font-medium">Airtime Credited</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums mt-0.5">
                  {stats?.airtimeCredited ?? registrations.filter((r) => r.rewardStatus === 'credited').length}
                  <span className="text-xs text-slate-400 font-normal"> / 50</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-emerald-300 mt-1">
                  ₦{(stats?.airtimeCredited ?? 0) * 200} disbursed
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#091f47] border border-blue-700/50">
                <div className="text-[11px] sm:text-xs text-cyan-300 font-medium">Remaining Budget</div>
                <div className="text-2xl sm:text-3xl font-black text-cyan-300 tabular-nums mt-0.5">
                  ₦{10000 - ((stats?.airtimeCredited ?? 0) * 200)}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 mt-1">
                  {Math.max(0, 50 - (stats?.airtimeCredited ?? 0))} slots remaining
                </div>
              </div>

            </div>

            {/* Network Provider Breakdown Pills */}
            <div className="p-3 rounded-xl bg-[#040e24] border border-blue-800/50 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs font-bold text-slate-300">
                Telecommunications Network Breakdown:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {SUPPORTED_NETWORKS.map((net) => {
                  const count = registrations.filter((r) => r.network === net.id).length;
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

            {/* Filter & Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              <div className="flex flex-1 items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
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
                  <option value="confirmed">Shares Confirmed</option>
                  <option value="credited">Airtime Credited</option>
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
                  <span>Export CSV for Airtime Top-Up</span>
                </button>
              </div>

            </div>

            {/* Registrations Data Table */}
            <div className="rounded-2xl bg-[#040e24] border border-blue-800/60 overflow-hidden">
              <div className="px-4 py-3 bg-[#030a1c] border-b border-blue-800/60 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  Registered Participants ({filtered.length})
                </span>
                <span className="text-[11px] text-slate-400 italic">
                  Note: Airtime is sent manually by administrator using the phone number and network.
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
                        <th className="py-3 px-3">Referral Code</th>
                        <th className="py-3 px-3">Sharing Confirmation</th>
                        <th className="py-3 px-3">Reward Status</th>
                        <th className="py-3 px-3">Admin Notes</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-900/40">
                      {filtered.map((reg) => {
                        const networkObj = SUPPORTED_NETWORKS.find((n) => n.id === reg.network);
                        const isCredited = reg.rewardStatus === 'credited';

                        return (
                          <tr 
                            key={reg.id} 
                            className={`hover:bg-blue-900/20 transition-colors ${
                              isCredited ? 'bg-emerald-950/20' : ''
                            }`}
                          >
                            {/* Phone & Student Info */}
                            <td className="py-3 px-3.5 align-middle">
                              <div className="font-mono font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                                <span>{reg.phoneNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(reg.phoneNumber)}
                                  className="tap-bounce p-1 rounded hover:bg-blue-800/60 text-slate-400 hover:text-white cursor-pointer"
                                  title="Copy phone number for recharge"
                                >
                                  {copiedPhone === reg.phoneNumber ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              {reg.fullName && (
                                <div className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{reg.fullName}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Registered: {new Date(reg.registeredAt).toLocaleDateString()}
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
                                <span>{networkObj?.name || reg.network.toUpperCase()}</span>
                              </span>
                            </td>

                            {/* Referral Code & Inviter */}
                            <td className="py-3 px-3 align-middle font-mono text-[11px]">
                              <div className="text-yellow-400 font-bold">{reg.referralCode}</div>
                              {reg.referredBy ? (
                                <div className="text-[10px] text-slate-400">
                                  Invited by: <span className="text-blue-300">{reg.referredBy}</span>
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
                                        ? 'Shared to 3 Groups'
                                        : 'Shared to 10 People'}
                                    </span>
                                  </span>
                                  {reg.shareConfirmedAt && (
                                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>
                                        {new Date(reg.shareConfirmedAt).toLocaleString([], {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
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
                                    : reg.rewardStatus === 'approved'
                                    ? 'bg-blue-950 border-blue-500 text-blue-200'
                                    : reg.rewardStatus === 'declined'
                                    ? 'bg-red-950 border-red-500 text-red-300'
                                    : 'bg-amber-950 border-amber-500 text-amber-300'
                                }`}
                              >
                                <option value="pending_review">Pending Review</option>
                                <option value="approved">Approved for Airtime</option>
                                <option value="credited">Airtime Credited (₦200)</option>
                                <option value="declined">Declined</option>
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
                                    className="px-2 py-1 text-[11px] rounded bg-[#030c1d] border border-blue-600 text-white w-36"
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
                                    setNoteText(reg.adminNote || '');
                                  }}
                                  className="text-[11px] text-slate-300 hover:text-white cursor-pointer hover:underline max-w-[150px] truncate"
                                  title={reg.adminNote || 'Click to add note'}
                                >
                                  {reg.adminNote ? `📝 ${reg.adminNote}` : <span className="text-slate-500 italic">+ Add note</span>}
                                </div>
                              )}
                            </td>

                            {/* Quick Actions */}
                            <td className="py-3 px-3.5 align-middle text-right">
                              {!isCredited ? (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(reg.id, 'credited')}
                                  className="tap-bounce px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow cursor-pointer transition-colors"
                                  title="Mark ₦200 airtime as manually sent"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Mark Credited</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-emerald-400 font-bold inline-flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Credited</span>
                                </span>
                              )}
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
          <span>Marion Undefeated Giveaway Administrator Console</span>
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
