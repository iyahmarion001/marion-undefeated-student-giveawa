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

export interface DatabaseSchema {
  registrations: Registration[];
}

// In-memory cache for ultra-fast access and fallback in read-only / serverless runtimes
let memoryDb: DatabaseSchema = { registrations: [] };
let memoryInitialized = false;

// Resolve safe writable directory (Vercel Serverless allows writes only to /tmp)
function resolveDbPath(): { dir: string; file: string } {
  // If running in Vercel or AWS Lambda environment
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'data');
    return { dir: tmpDir, file: path.join(tmpDir, 'registrations.json') };
  }

  // Standard environment
  const standardDir = path.join(process.cwd(), 'data');
  return { dir: standardDir, file: path.join(standardDir, 'registrations.json') };
}

// Ensure database directory and file exist safely
function initDb(): string {
  const { dir, file } = resolveDbPath();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(file)) {
      const initial: DatabaseSchema = { registrations: [] };
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    }
  } catch (err) {
    // If filesystem is read-only, we fall back to memoryDb smoothly
    console.warn('Filesystem init warning (using in-memory store):', err);
  }
  return file;
}

export function readDb(): DatabaseSchema {
  try {
    const dbFile = initDb();
    if (fs.existsSync(dbFile)) {
      const raw = fs.readFileSync(dbFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.registrations)) {
        memoryDb = parsed;
        memoryInitialized = true;
        return memoryDb;
      }
    }
  } catch (error) {
    console.warn('Notice: Reading from in-memory store:', error);
  }

  return memoryDb;
}

export function writeDb(data: DatabaseSchema): void {
  memoryDb = data;
  try {
    const { dir, file } = resolveDbPath();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, file);
  } catch (error) {
    console.warn('Notice: Written to in-memory store (disk skipped in serverless):', error);
  }
}

/**
 * Normalizes Nigerian phone numbers to standard 11-digit format: 080XXXXXXXX
 */
export function normalizeNigerianPhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: '', error: 'Phone number is required.' };
  }

  // Remove all spaces, hyphens, and parentheses
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
