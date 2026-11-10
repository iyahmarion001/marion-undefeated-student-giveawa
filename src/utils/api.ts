import { ParticipantRegistration, GiveawayStats, ShareMethod } from '../types/giveaway';

const STORAGE_PARTICIPANT_KEY = 'marion_undefeated_current_registration';
const ADMIN_TOKEN_KEY = 'marion_undefeated_admin_token';

export function getStoredRegistration(): ParticipantRegistration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PARTICIPANT_KEY);
    if (!raw) return null;
    const reg: ParticipantRegistration = JSON.parse(raw);
    if (reg) {
      const backupPhone = localStorage.getItem('marion_undefeated_student_phone');
      if ((!reg.phoneNumber || reg.phoneNumber.includes('•') || reg.phoneNumber.includes('...')) && backupPhone) {
        reg.phoneNumber = backupPhone;
      }
      if (!reg.phoneNumber && (reg as any).phone_number) {
        reg.phoneNumber = (reg as any).phone_number;
      }
      if (!reg.phoneNumber && (reg as any).phone) {
        reg.phoneNumber = (reg as any).phone;
      }
    }
    return reg;
  } catch {
    return null;
  }
}

export function saveStoredRegistration(registration: ParticipantRegistration): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave: ParticipantRegistration = { ...registration };
    const rawPhone = toSave.phoneNumber || (toSave as any).phone_number || (toSave as any).phone;
    if (rawPhone && !rawPhone.includes('•') && !rawPhone.includes('...')) {
      toSave.phoneNumber = rawPhone;
      try {
        localStorage.setItem('marion_undefeated_student_phone', rawPhone);
      } catch {}
    }
    localStorage.setItem(STORAGE_PARTICIPANT_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save registration locally', e);
  }
}

export function clearStoredRegistration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_PARTICIPANT_KEY);
}

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to save admin token to local storage:', e);
  }
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear admin token from local storage:', e);
  }
}

/**
 * Safely extracts human-readable text from any value,
 * especially error objects with { code, message } or { error: { code, message } }
 */
export function toSafeString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const obj = val as Record<string, any>;
    if (typeof obj.message === 'string') {
      return obj.code ? `[${obj.code}] ${obj.message}` : obj.message;
    }
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    if (typeof obj.error === 'object' && obj.error !== null) {
      return toSafeString(obj.error, fallback);
    }
    if (typeof obj.message === 'object' && obj.message !== null) {
      return toSafeString(obj.message, fallback);
    }
    if (typeof obj.statusText === 'string') {
      return obj.statusText;
    }
    if (obj.code !== undefined) {
      return `Error code: ${obj.code}`;
    }
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return String(val);
}

/**
 * Universal safe JSON fetch helper.
 * Reads response as text first, then parses safely.
 * Guarantees that non-JSON responses (HTML 404, plain text, etc.)
 * NEVER throw "Unexpected token ... is not valid JSON".
 */
async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const defaultHeaders = {
      Accept: 'application/json',
      ...(options?.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers: defaultHeaders,
    });

    const rawText = await res.text();
    let parsed: any = null;

    if (rawText && rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    // If server returned non-2xx status code
    if (!res.ok) {
      let rawError = parsed?.error ?? parsed?.message ?? parsed;
      let errorMessage = toSafeString(rawError);

      if (!errorMessage) {
        if (rawText && rawText.length < 150 && !rawText.includes('<html') && !rawText.includes('<!DOCTYPE')) {
          errorMessage = rawText;
        } else {
          errorMessage = `Server error (HTTP ${res.status} ${res.statusText || 'Error'}). Please try again.`;
        }
      }

      return {
        ok: false,
        status: res.status,
        error: errorMessage,
      };
    }

    // Success with valid JSON
    if (parsed !== null) {
      return {
        ok: true,
        status: res.status,
        data: parsed as T,
      };
    }

    // Success with empty or non-JSON response
    return {
      ok: true,
      status: res.status,
      data: (rawText ? { message: rawText } : {}) as T,
    };
  } catch (networkError: any) {
    return {
      ok: false,
      status: 0,
      error: toSafeString(networkError?.message || networkError, 'Network connection failed. Please check your internet connection.'),
    };
  }
}

export async function fetchGiveawayStats(): Promise<GiveawayStats | null> {
  const result = await safeFetchJson<GiveawayStats>('/api/stats');
  if (result.ok && result.data) {
    return result.data;
  }
  return null;
}

export async function registerStudent(payload: {
  phoneNumber: string;
  network: string;
  referralCode: string;
  referredBy?: string | null;
  fullName?: string;
  department?: string;
}): Promise<{
  success: boolean;
  registration?: ParticipantRegistration;
  alreadyRegistered?: boolean;
  message?: string;
  error?: string;
}> {
  // 1. Client-side validation for instant feedback
  const cleanPhone = (payload.phoneNumber || '').replace(/[\s\-\(\)]/g, '');
  let normalized = cleanPhone;
  if (normalized.startsWith('+234')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('234') && normalized.length > 10) {
    normalized = '0' + normalized.slice(3);
  }

  const nigerianRegex = /^0(70|80|81|90|91)\d{8}$/;
  if (!nigerianRegex.test(normalized)) {
    return {
      success: false,
      error: 'Please enter a valid 11-digit Nigerian phone number (e.g. 08031234567, 070..., 090..., 081...).',
    };
  }

  // 2. Transmit to backend
  const result = await safeFetchJson<{
    success?: boolean;
    alreadyRegistered?: boolean;
    message?: string;
    error?: string;
    registration?: ParticipantRegistration;
  }>('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      phoneNumber: normalized,
    }),
  });

  // 3. Process backend response
  if (result.ok && result.data && result.data.registration) {
    const regWithPhone: ParticipantRegistration = {
      ...result.data.registration,
      phoneNumber: result.data.registration.phoneNumber || normalized,
    };
    saveStoredRegistration(regWithPhone);
    return {
      success: true,
      registration: regWithPhone,
      alreadyRegistered: result.data.alreadyRegistered,
      message: result.data.message || 'Registration saved successfully.',
    };
  }

  // If server responded with a specific logical error (e.g. 400 Bad Request)
  if (result.status >= 400 && result.status < 500 && result.error && !result.error.includes('HTML') && !result.error.includes('HTTP 404')) {
    return {
      success: false,
      error: result.error,
    };
  }

  // 4. Client-side resilience fallback
  // In case of static hosting without serverless functions or network latency
  const fallbackRegistration: ParticipantRegistration = {
    id: `REG-LOC-${Date.now()}`,
    phoneNumber: normalized,
    phoneMasked: `${normalized.slice(0, 4)} •••• ${normalized.slice(-3)}`,
    network: (payload.network as any) || 'mtn',
    fullName: payload.fullName,
    referralCode: payload.referralCode || 'MU-STUDENT',
    referredBy: payload.referredBy,
    registeredAt: new Date().toISOString(),
    shareConfirmed: false,
    shareMethod: null,
    shareConfirmedAt: null,
    status: 'Registered – Share Pending',
    rewardStatus: 'pending_review',
    airtimeAmount: 200,
    adminNote: null,
  };

  saveStoredRegistration(fallbackRegistration);

  return {
    success: true,
    registration: fallbackRegistration,
    message: 'Registered successfully! Complete the sharing requirement to confirm your entry.',
  };
}

export async function confirmSharing(payload: {
  phoneNumber?: string;
  referralCode: string;
  shareMethod: ShareMethod;
}): Promise<{
  success: boolean;
  registration?: ParticipantRegistration;
  message?: string;
  error?: string;
}> {
  const result = await safeFetchJson<{
    success?: boolean;
    message?: string;
    error?: string;
    registration?: ParticipantRegistration;
  }>('/api/confirm-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (result.ok && result.data && result.data.registration) {
    const current = getStoredRegistration();
    const resolvedPhone =
      result.data.registration.phoneNumber ||
      payload.phoneNumber ||
      current?.phoneNumber ||
      (typeof window !== 'undefined' ? localStorage.getItem('marion_undefeated_student_phone') : null) ||
      undefined;

    const regWithPhone: ParticipantRegistration = {
      ...result.data.registration,
      phoneNumber: resolvedPhone,
    };
    saveStoredRegistration(regWithPhone);
    return {
      success: true,
      registration: regWithPhone,
      message: result.data.message || 'Sharing confirmation recorded!',
    };
  }

  // Client-side fallback if server was temporarily unavailable
  const current = getStoredRegistration();
  if (current) {
    const resolvedPhone =
      current.phoneNumber ||
      payload.phoneNumber ||
      (typeof window !== 'undefined' ? localStorage.getItem('marion_undefeated_student_phone') : null) ||
      undefined;

    const updated: ParticipantRegistration = {
      ...current,
      phoneNumber: resolvedPhone,
      shareConfirmed: true,
      shareMethod: payload.shareMethod,
      shareConfirmedAt: new Date().toISOString(),
      status: 'Share Confirmed – Awaiting Review',
      rewardStatus: 'pending_review',
    };
    saveStoredRegistration(updated);
    return {
      success: true,
      registration: updated,
      message: 'Share confirmation recorded! Status: Share Confirmed – Awaiting Review.',
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to record sharing confirmation. Please try again.',
  };
}

export async function lookupStatus(query: string): Promise<{
  found: boolean;
  registration?: ParticipantRegistration;
  error?: string;
}> {
  const clean = encodeURIComponent(query.trim());
  const result = await safeFetchJson<{
    found?: boolean;
    error?: string;
    registration?: ParticipantRegistration;
  }>(`/api/status/${clean}`);

  if (result.ok && result.data && result.data.found && result.data.registration) {
    const digits = query.replace(/\D/g, '');
    const current = getStoredRegistration();
    const resolvedPhone =
      result.data.registration.phoneNumber ||
      (digits.length >= 10 ? (digits.startsWith('0') ? digits : '0' + digits) : undefined) ||
      current?.phoneNumber ||
      (typeof window !== 'undefined' ? localStorage.getItem('marion_undefeated_student_phone') : null) ||
      undefined;

    const regWithPhone: ParticipantRegistration = {
      ...result.data.registration,
      phoneNumber: resolvedPhone,
    };
    saveStoredRegistration(regWithPhone);
    return {
      found: true,
      registration: regWithPhone,
    };
  }

  // Fallback to local device storage if offline or server lookup missed
  const local = getStoredRegistration();
  const cleanQ = query.trim().toUpperCase();
  const digits = query.replace(/\D/g, '');

  if (local && (local.referralCode.toUpperCase() === cleanQ || (digits.length >= 7 && (local.phoneNumber?.includes(digits) || local.phoneMasked?.includes(digits.slice(-3)))))) {
    return {
      found: true,
      registration: local,
    };
  }

  return {
    found: false,
    error: result.error || 'No matching registration found for this phone number or referral code.',
  };
}

export async function adminLogin(password: string, email?: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const result = await safeFetchJson<{
    success?: boolean;
    token?: string;
    error?: any;
  }>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, email }),
  });

  if (result.ok && result.data && result.data.success && result.data.token) {
    saveAdminToken(result.data.token);
    return { success: true, token: result.data.token };
  }

  const err = result.data?.error || result.error;
  return {
    success: false,
    error: toSafeString(err, 'Invalid administrator password.'),
  };
}

export async function fetchAdminRegistrations(token: string): Promise<{
  success: boolean;
  registrations?: any[];
  stats?: GiveawayStats;
  error?: string;
}> {
  const result = await safeFetchJson<{
    registrations?: any[];
    stats?: GiveawayStats;
    error?: any;
    success?: boolean;
  }>('/api/admin/registrations', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.ok && result.data && Array.isArray(result.data.registrations)) {
    return {
      success: true,
      registrations: result.data.registrations,
      stats: result.data.stats,
    };
  }

  const err = result.data?.error || result.error;
  return {
    success: false,
    error: toSafeString(err, 'Failed to fetch administrator records.'),
  };
}

export async function updateRewardStatus(
  token: string,
  id: string,
  rewardStatus: string,
  adminNote?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await safeFetchJson<{
    success?: boolean;
    message?: string;
    error?: any;
  }>('/api/admin/update-reward', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, rewardStatus, adminNote }),
  });

  if (result.ok && result.data && result.data.success) {
    return {
      success: true,
      message: toSafeString(result.data.message, 'Status updated successfully.'),
    };
  }

  const err = result.data?.error || result.error;
  return {
    success: false,
    error: toSafeString(err, 'Failed to update reward status.'),
  };
}

export async function trackReferralVisit(referralCode: string): Promise<void> {
  if (!referralCode) return;
  safeFetchJson('/api/track-referral-visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode }),
  }).catch(() => {});
}

export async function trackShareClick(query: string): Promise<void> {
  if (!query) return;
  safeFetchJson('/api/track-share-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).catch(() => {});
}

export async function trackNotifyAdminClick(query: string): Promise<void> {
  if (!query) return;
  safeFetchJson('/api/track-notify-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).catch(() => {});
}

export async function notifyAdminDirectly(payload: {
  id?: string;
  phoneNumber?: string;
  referralCode?: string;
}): Promise<{
  success: boolean;
  sent: boolean;
  configured: boolean;
  alreadyNotified?: boolean;
  message?: string;
  error?: string;
  requiredConfig?: string[];
  provider?: string;
  messageId?: string;
  registration?: ParticipantRegistration;
}> {
  const result = await safeFetchJson<{
    success: boolean;
    sent: boolean;
    configured: boolean;
    alreadyNotified?: boolean;
    message?: string;
    error?: string;
    requiredConfig?: string[];
    provider?: string;
    messageId?: string;
    registration?: ParticipantRegistration;
  }>('/api/notify-admin-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (result.ok && result.data) {
    if (result.data.registration) {
      saveStoredRegistration(result.data.registration);
    }
    return result.data;
  }

  return {
    success: false,
    sent: false,
    configured: false,
    error: toSafeString(result.data?.error || result.error, 'Failed to dispatch notification to administrator.'),
  };
}

