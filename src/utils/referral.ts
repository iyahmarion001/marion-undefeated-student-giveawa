/**
 * Utility functions for participant unique referral codes,
 * referral links, and WhatsApp sharing mechanics.
 */

// The actual publicly accessible deployed application URL on Cloud Run
export const DEPLOYED_APP_URL = 'https://ais-dev-nnhflti22ouag6junyuqix-911064966292.europe-west2.run.app';

const OWN_REFERRAL_STORAGE_KEY = 'marion_undefeated_student_ref_code';
const REFERRED_BY_STORAGE_KEY = 'marion_undefeated_student_referred_by';

/**
 * Returns the reliable public base URL of the deployed application.
 * Ensures referral links always resolve to the active website.
 */
export function getBaseAppUrl(): string {
  if (typeof window === 'undefined') {
    return DEPLOYED_APP_URL;
  }

  try {
    const origin = window.location.origin;

    // If accessed through a valid HTTP or HTTPS origin that is not localhost
    if (
      origin &&
      (origin.startsWith('https://') || origin.startsWith('http://')) &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1')
    ) {
      return origin;
    }

    return DEPLOYED_APP_URL;
  } catch {
    return DEPLOYED_APP_URL;
  }
}

/**
 * Gets the persistent unique referral code for this student from localStorage,
 * or generates and saves a new unique code if none exists.
 */
export function getOrCreateReferralCode(): string {
  if (typeof window === 'undefined') return 'MU-2026';

  try {
    let code = localStorage.getItem(OWN_REFERRAL_STORAGE_KEY);
    if (!code || !code.startsWith('MU-')) {
      const characters = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let randomId = '';
      for (let i = 0; i < 5; i++) {
        randomId += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      code = `MU-${randomId}`;
      localStorage.setItem(OWN_REFERRAL_STORAGE_KEY, code);
    }
    return code;
  } catch {
    return 'MU-7K2P9';
  }
}

/**
 * Generates the full, shareable unique referral URL.
 * Guarantees that every referral link points to the actual deployed website
 * at root path / with the ?ref= query parameter.
 */
export function getReferralLink(referralCode: string): string {
  const baseUrl = getBaseAppUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}/?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Reads any incoming referral code from the URL query params or hash,
 * persists it in storage, and returns it.
 */
export function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    let code: string | null = null;

    // Check search query parameters (?ref=... or ?referral=...)
    const searchParams = new URLSearchParams(window.location.search);
    code = searchParams.get('ref') || searchParams.get('referral');

    // Check hash parameters if query wasn't preserved (#ref=...)
    if (!code && window.location.hash) {
      const hashContent = window.location.hash.replace(/^#\/?/, '');
      const hashParams = new URLSearchParams(hashContent);
      code = hashParams.get('ref') || hashParams.get('referral');
    }

    if (code) {
      const cleanCode = code.trim().toUpperCase();
      sessionStorage.setItem(REFERRED_BY_STORAGE_KEY, cleanCode);
      localStorage.setItem(REFERRED_BY_STORAGE_KEY, cleanCode);
      return cleanCode;
    }

    // Fallback to previously stored referral code if current session was referred
    const stored =
      sessionStorage.getItem(REFERRED_BY_STORAGE_KEY) ||
      localStorage.getItem(REFERRED_BY_STORAGE_KEY);
    return stored || null;
  } catch {
    return null;
  }
}

/**
 * Formats a short, compelling invitation with the participant's referral link.
 * Encourages friends to visit the website for the ₦200 airtime giveaway.
 */
export function buildWhatsAppShareText(referralLink: string): string {
  return (
    `🎁 *MARION UNDEFEATED – STUDENT AIRTIME GIVEAWAY 2026*\n\n` +
    `Hey! Check out the Marion Undefeated Student Airtime Giveaway for Delta State Polytechnic Otefe-Oghara students.\n\n` +
    `₦200 free airtime is available (50 slots, ₦10,000 total budget)!\n\n` +
    `Visit the website using my link to claim your spot:\n` +
    `👉 ${referralLink}\n\n` +
    `100% Free · No registration fee\n` +
    `#Let's make every penny count.`
  );
}

/**
 * Returns the official WhatsApp share URL WITHOUT a recipient phone number.
 * This opens WhatsApp and allows the participant to select any contact, group, or status.
 */
export function getWhatsAppShareUrl(messageText: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
}

/**
 * Triggers opening WhatsApp using the official share URL in a new window/tab.
 */
export function openWhatsAppShare(messageText: string): boolean {
  if (typeof window === 'undefined') return false;
  const url = getWhatsAppShareUrl(messageText);
  try {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    return !!newWindow;
  } catch (error) {
    console.error('Failed to open WhatsApp window:', error);
    return false;
  }
}
