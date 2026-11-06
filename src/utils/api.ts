import { ParticipantRegistration, GiveawayStats, ShareMethod } from '../types/giveaway';

const STORAGE_PARTICIPANT_KEY = 'marion_undefeated_current_registration';
const ADMIN_TOKEN_KEY = 'marion_undefeated_admin_token';

export function getStoredRegistration(): ParticipantRegistration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PARTICIPANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredRegistration(registration: ParticipantRegistration): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PARTICIPANT_KEY, JSON.stringify(registration));
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
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function saveAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function fetchGiveawayStats(): Promise<GiveawayStats | null> {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn('Could not fetch stats from API:', error);
    return null;
  }
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
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Registration failed.' };
    }

    if (data.registration) {
      saveStoredRegistration(data.registration);
    }

    return {
      success: true,
      registration: data.registration,
      alreadyRegistered: data.alreadyRegistered,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error connecting to registration server.' };
  }
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
  try {
    const res = await fetch('/api/confirm-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to record sharing confirmation.' };
    }

    if (data.registration) {
      saveStoredRegistration(data.registration);
    }

    return {
      success: true,
      registration: data.registration,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error while recording confirmation.' };
  }
}

export async function lookupStatus(query: string): Promise<{
  found: boolean;
  registration?: ParticipantRegistration;
  error?: string;
}> {
  try {
    const clean = encodeURIComponent(query.trim());
    const res = await fetch(`/api/status/${clean}`);
    const data = await res.json();

    if (!res.ok) {
      return { found: false, error: data.error || 'No registration found.' };
    }

    if (data.registration) {
      saveStoredRegistration(data.registration);
    }

    return { found: true, registration: data.registration };
  } catch (err: any) {
    return { found: false, error: err.message || 'Error looking up registration status.' };
  }
}

export async function adminLogin(password: string, email?: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Invalid credentials.' };
    }

    if (data.token) {
      saveAdminToken(data.token);
    }

    return { success: true, token: data.token };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login connection failed.' };
  }
}

export async function fetchAdminRegistrations(token: string): Promise<{
  success: boolean;
  registrations?: any[];
  stats?: GiveawayStats;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/registrations', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to fetch admin records.' };
    }

    return {
      success: true,
      registrations: data.registrations,
      stats: data.stats,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Admin fetch error.' };
  }
}

export async function updateRewardStatus(
  token: string,
  id: string,
  rewardStatus: string,
  adminNote?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/update-reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, rewardStatus, adminNote }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update reward status.' };
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update reward status.' };
  }
}
