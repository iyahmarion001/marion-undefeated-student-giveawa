import fs from 'fs';
import path from 'path';

export interface Registration {
  id: string;
  phoneNumber: string; // Normalized: 08031234567
  network: 'mtn' | 'airtel' | 'glo' | '9mobile';
  fullName?: string;
  department?: string;
  referralCode: string;
  referredBy?: string | null;
  registeredAt: string;
  
  // Sharing confirmation
  shareConfirmed: boolean;
  shareMethod?: 'groups_3' | 'individuals_10' | null;
  shareConfirmedAt?: string | null;
  status: 'Registered – Share Pending' | 'Share Confirmed – Awaiting Review';
  
  // Admin reward management
  rewardStatus: 'pending_review' | 'approved' | 'credited' | 'declined';
  airtimeAmount: number; // 200
  adminNote?: string | null;
  updatedAt: string;
}

interface DatabaseSchema {
  registrations: Registration[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'registrations.json');

// Ensure database directory and file exist
function initDb(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = { registrations: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

export function readDb(): DatabaseSchema {
  try {
    initDb();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading database file, returning default:', error);
    return { registrations: [] };
  }
}

export function writeDb(data: DatabaseSchema): void {
  try {
    initDb();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

/**
 * Normalizes Nigerian phone numbers to standard 11-digit format: 080XXXXXXXX
 */
export function normalizeNigerianPhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: '', error: 'Phone number is required.' };
  }

  // Remove all non-digits except a leading +
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+234')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('234') && cleaned.length > 10) {
    cleaned = '0' + cleaned.slice(3);
  }

  // Check if it matches 11 digits starting with valid Nigerian prefixes
  const nigerianRegex = /^0(70|80|81|90|91)\d{8}$/;
  if (!nigerianRegex.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error: 'Please enter a valid 11-digit Nigerian phone number (e.g. 08031234567, 070..., 090..., 081...).',
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Masks a phone number for public or student view: 0803 •••• 567
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  const start = phone.slice(0, 4);
  const end = phone.slice(-3);
  return `${start} •••• ${end}`;
}

export function findRegistration(query: string): Registration | undefined {
  const db = readDb();
  const cleanQuery = query.trim().toUpperCase();
  const normalizedPhone = query.replace(/\D/g, '');

  return db.registrations.find((r) => {
    return (
      r.referralCode.toUpperCase() === cleanQuery ||
      r.phoneNumber === normalizedPhone ||
      (r.phoneNumber.endsWith(normalizedPhone) && normalizedPhone.length >= 10) ||
      r.id === cleanQuery
    );
  });
}

export function getGiveawayStats() {
  const db = readDb();
  const list = db.registrations;
  const totalSlots = 50;
  const totalBudget = 10000;
  const rewardAmount = 200;

  const sharesConfirmed = list.filter((r) => r.shareConfirmed).length;
  const airtimeCredited = list.filter((r) => r.rewardStatus === 'credited').length;
  const pendingReview = list.filter((r) => r.shareConfirmed && r.rewardStatus === 'pending_review').length;

  const networkCounts = {
    mtn: list.filter((r) => r.network === 'mtn').length,
    airtel: list.filter((r) => r.network === 'airtel').length,
    glo: list.filter((r) => r.network === 'glo').length,
    '9mobile': list.filter((r) => r.network === '9mobile').length,
  };

  return {
    totalRegistered: list.length,
    sharesConfirmed,
    pendingReview,
    airtimeCredited,
    totalSlots,
    remainingSlots: Math.max(0, totalSlots - airtimeCredited),
    totalBudget,
    rewardAmount,
    networkCounts,
  };
}
