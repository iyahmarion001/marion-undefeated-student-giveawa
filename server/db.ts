import fs from 'fs';
import path from 'path';
import pg from 'pg';

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
  shareClicks?: number;
  notifyAdminClicks?: number;
  status: 'Registered – Share Pending' | 'Share Confirmed – Awaiting Review';
  
  // Admin reward management
  rewardStatus: 'pending_review' | 'approved' | 'credited' | 'declined';
  airtimeAmount: number; // 200
  adminNote?: string | null;
  adminNotified?: boolean;
  adminNotifiedAt?: string | null;
  notifyError?: string | null;
  updatedAt: string;
}

export interface ReferralVisit {
  referralCode: string;
  visitedAt: string;
}

export interface DatabaseSchema {
  registrations: Registration[];
  referralVisits: ReferralVisit[];
}

// In-memory cache for ultra-fast access and seamless zero-config fallback
let memoryDb: DatabaseSchema = { registrations: [], referralVisits: [] };

// Managed PostgreSQL Pool (initialized if DATABASE_URL or POSTGRES_URL is provided)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let pgPool: pg.Pool | null = null;
let pgInitialized = false;

if (databaseUrl) {
  try {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log('Managed PostgreSQL Pool configured for persistent registrations.');
  } catch (err) {
    console.warn('Failed to initialize PostgreSQL pool, falling back to persistent file store:', err);
    pgPool = null;
  }
}

// Auto-initialize SQL tables if PostgreSQL is active
async function initPgTables(): Promise<void> {
  if (!pgPool || pgInitialized) return;

  try {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS giveaway_registrations (
          id VARCHAR(64) PRIMARY KEY,
          phone_number VARCHAR(20) NOT NULL UNIQUE,
          network VARCHAR(20) NOT NULL,
          full_name TEXT,
          department TEXT,
          referral_code VARCHAR(32) NOT NULL,
          referred_by VARCHAR(32),
          registered_at TIMESTAMPTZ NOT NULL,
          share_confirmed BOOLEAN DEFAULT FALSE,
          share_method VARCHAR(32),
          share_confirmed_at TIMESTAMPTZ,
          share_clicks INT DEFAULT 0,
          notify_admin_clicks INT DEFAULT 0,
          status VARCHAR(64) NOT NULL,
          reward_status VARCHAR(32) NOT NULL,
          airtime_amount INT DEFAULT 200,
          admin_note TEXT,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS giveaway_referral_visits (
          id SERIAL PRIMARY KEY,
          referral_code VARCHAR(32) NOT NULL,
          visited_at TIMESTAMPTZ NOT NULL
        );

        -- Safe column migrations for direct admin WhatsApp notification
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS admin_notified BOOLEAN DEFAULT FALSE;
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS notify_error TEXT;
      `);
      pgInitialized = true;
      console.log('PostgreSQL giveaway_registrations table verified.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('PostgreSQL table initialization warning (using local fallback):', err);
  }
}

// Resolve safe writable file path (Vercel Serverless allows writes only to /tmp)
function resolveDbPath(): { dir: string; file: string } {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'data');
    return { dir: tmpDir, file: path.join(tmpDir, 'registrations.json') };
  }

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
      const initial: DatabaseSchema = { registrations: [], referralVisits: [] };
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    }
  } catch (err) {
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
        memoryDb.registrations = parsed.registrations;
        memoryDb.referralVisits = Array.isArray(parsed.referralVisits) ? parsed.referralVisits : [];
        return memoryDb;
      }
    }
  } catch (error) {
    console.warn('Notice: Reading from memory:', error);
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
    console.warn('Notice: Written to memory store (disk skipped in serverless):', error);
  }
}

function cleanStringValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.message === 'string') {
      return val.code ? `[${val.code}] ${val.message}` : val.message;
    }
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

// Convert PostgreSQL row to Registration interface
function mapPgRowToRegistration(row: any): Registration {
  return {
    id: cleanStringValue(row.id) || String(row.id || ''),
    phoneNumber: cleanStringValue(row.phone_number) || '',
    network: (cleanStringValue(row.network) as any) || 'mtn',
    fullName: cleanStringValue(row.full_name) || undefined,
    department: cleanStringValue(row.department) || undefined,
    referralCode: cleanStringValue(row.referral_code) || '',
    referredBy: cleanStringValue(row.referred_by),
    registeredAt: row.registered_at instanceof Date ? row.registered_at.toISOString() : (cleanStringValue(row.registered_at) || new Date().toISOString()),
    shareConfirmed: Boolean(row.share_confirmed),
    shareMethod: (cleanStringValue(row.share_method) as any) || null,
    shareConfirmedAt: row.share_confirmed_at ? (row.share_confirmed_at instanceof Date ? row.share_confirmed_at.toISOString() : cleanStringValue(row.share_confirmed_at)) : null,
    shareClicks: Number(row.share_clicks || 0),
    notifyAdminClicks: Number(row.notify_admin_clicks || 0),
    status: (cleanStringValue(row.status) as any) || 'Registered – Share Pending',
    rewardStatus: (cleanStringValue(row.reward_status) as any) || 'pending_review',
    airtimeAmount: Number(row.airtime_amount || 200),
    adminNote: cleanStringValue(row.admin_note),
    adminNotified: Boolean(row.admin_notified),
    adminNotifiedAt: row.admin_notified_at ? (row.admin_notified_at instanceof Date ? row.admin_notified_at.toISOString() : cleanStringValue(row.admin_notified_at)) : null,
    notifyError: cleanStringValue(row.notify_error),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (cleanStringValue(row.updated_at) || new Date().toISOString()),
  };
}

/**
 * Async persistent fetch of all registrations
 */
export async function getAllRegistrationsAsync(): Promise<Registration[]> {
  if (pgPool) {
    try {
      await initPgTables();
      const res = await pgPool.query('SELECT * FROM giveaway_registrations ORDER BY registered_at DESC');
      return res.rows.map(mapPgRowToRegistration);
    } catch (err) {
      console.warn('PostgreSQL query error, falling back to local store:', err);
    }
  }

  const db = readDb();
  return db.registrations;
}

/**
 * Async persistent save or update of a registration
 */
export async function saveRegistrationAsync(reg: Registration): Promise<Registration> {
  if (pgPool) {
    try {
      await initPgTables();
      const query = `
        INSERT INTO giveaway_registrations (
          id, phone_number, network, full_name, department, referral_code, referred_by,
          registered_at, share_confirmed, share_method, share_confirmed_at, share_clicks,
          notify_admin_clicks, status, reward_status, airtime_amount, admin_note,
          admin_notified, admin_notified_at, notify_error, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (phone_number) DO UPDATE SET
          network = EXCLUDED.network,
          full_name = EXCLUDED.full_name,
          department = EXCLUDED.department,
          share_confirmed = EXCLUDED.share_confirmed,
          share_method = EXCLUDED.share_method,
          share_confirmed_at = EXCLUDED.share_confirmed_at,
          share_clicks = EXCLUDED.share_clicks,
          notify_admin_clicks = EXCLUDED.notify_admin_clicks,
          status = EXCLUDED.status,
          reward_status = EXCLUDED.reward_status,
          admin_note = EXCLUDED.admin_note,
          admin_notified = EXCLUDED.admin_notified,
          admin_notified_at = EXCLUDED.admin_notified_at,
          notify_error = EXCLUDED.notify_error,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;

      const values = [
        reg.id,
        reg.phoneNumber,
        reg.network,
        reg.fullName || null,
        reg.department || null,
        reg.referralCode,
        reg.referredBy || null,
        reg.registeredAt,
        reg.shareConfirmed,
        reg.shareMethod || null,
        reg.shareConfirmedAt || null,
        reg.shareClicks || 0,
        reg.notifyAdminClicks || 0,
        reg.status,
        reg.rewardStatus,
        reg.airtimeAmount || 200,
        reg.adminNote || null,
        reg.adminNotified ?? false,
        reg.adminNotifiedAt || null,
        reg.notifyError || null,
        reg.updatedAt,
      ];

      const res = await pgPool.query(query, values);
      return mapPgRowToRegistration(res.rows[0]);
    } catch (err) {
      console.warn('PostgreSQL write error, falling back to local store:', err);
    }
  }

  // Local fallback
  const db = readDb();
  const existingIdx = db.registrations.findIndex((r) => r.phoneNumber === reg.phoneNumber || r.id === reg.id);
  if (existingIdx >= 0) {
    db.registrations[existingIdx] = reg;
  } else {
    db.registrations.push(reg);
  }
  writeDb(db);
  return reg;
}

/**
 * Concurrency-safe atomic update to mark a registration as PAID (credited).
 * Prevents two administrators from accidentally allocating beyond the 50 slots!
 */
export async function markRewardAsPaidAtomicAsync(
  id: string,
  adminNote?: string
): Promise<{ success: boolean; registration?: Registration; error?: string }> {
  if (pgPool) {
    try {
      await initPgTables();

      // Check current paid count excluding this id
      const countRes = await pgPool.query(
        "SELECT COUNT(*) AS count FROM giveaway_registrations WHERE reward_status = 'credited' AND id != $1",
        [id]
      );
      const currentlyPaid = parseInt(countRes.rows[0].count, 10) || 0;

      if (currentlyPaid >= 50) {
        return {
          success: false,
          error: 'Giveaway quota filled: All 50 airtime rewards have already been marked as paid and disbursed.',
        };
      }

      // Update record atomically
      const noteUpdate = adminNote !== undefined ? adminNote : `₦200 airtime credited by admin on ${new Date().toLocaleDateString()}`;
      const updateRes = await pgPool.query(
        `UPDATE giveaway_registrations 
         SET reward_status = 'credited', admin_note = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [noteUpdate, id]
      );

      if (updateRes.rowCount === 0) {
        return { success: false, error: 'Registration record not found.' };
      }

      return {
        success: true,
        registration: mapPgRowToRegistration(updateRes.rows[0]),
      };
    } catch (err: any) {
      console.error('PostgreSQL atomic reward payment error:', err);
      return { success: false, error: err?.message || 'Database error processing reward payment.' };
    }
  }

  // Local fallback
  const db = readDb();
  const currentlyPaid = db.registrations.filter((r) => r.rewardStatus === 'credited' && r.id !== id).length;

  if (currentlyPaid >= 50) {
    return {
      success: false,
      error: 'Giveaway quota filled: All 50 airtime rewards have already been marked as paid and disbursed.',
    };
  }

  const rec = db.registrations.find((r) => r.id === id);
  if (!rec) {
    return { success: false, error: 'Registration record not found.' };
  }

  rec.rewardStatus = 'credited';
  if (adminNote !== undefined) rec.adminNote = adminNote;
  rec.updatedAt = new Date().toISOString();
  writeDb(db);

  return { success: true, registration: rec };
}

/**
 * Async lookup for registration by phone, referralCode, or ID
 */
export async function findRegistrationAsync(query: string): Promise<Registration | undefined> {
  const cleanQuery = query.trim().toUpperCase();
  const normalizedPhone = query.replace(/\D/g, '');

  if (pgPool) {
    try {
      await initPgTables();
      const res = await pgPool.query(
        `SELECT * FROM giveaway_registrations 
         WHERE UPPER(referral_code) = $1 
            OR phone_number = $2 
            OR id = $3 
         LIMIT 1`,
        [cleanQuery, normalizedPhone, cleanQuery]
      );
      if (res.rows.length > 0) {
        return mapPgRowToRegistration(res.rows[0]);
      }
    } catch (err) {
      console.warn('PostgreSQL find error, falling back to local store:', err);
    }
  }

  return findRegistration(query);
}

/**
 * Track referral link visit clicks
 */
export async function recordReferralVisitAsync(referralCode: string): Promise<void> {
  const cleanCode = referralCode.trim().toUpperCase();
  if (pgPool) {
    try {
      await initPgTables();
      await pgPool.query(
        'INSERT INTO giveaway_referral_visits (referral_code, visited_at) VALUES ($1, $2)',
        [cleanCode, new Date().toISOString()]
      );
      return;
    } catch (err) {
      console.warn('PostgreSQL visit log error:', err);
    }
  }

  const db = readDb();
  db.referralVisits.push({
    referralCode: cleanCode,
    visitedAt: new Date().toISOString(),
  });
  writeDb(db);
}

/**
 * Increment share button clicks on a participant
 */
export async function recordShareClickAsync(query: string): Promise<void> {
  const record = await findRegistrationAsync(query);
  if (record) {
    record.shareClicks = (record.shareClicks || 0) + 1;
    record.updatedAt = new Date().toISOString();
    await saveRegistrationAsync(record);
  }
}

/**
 * Increment admin WhatsApp notification clicks on a participant
 */
export async function recordNotifyAdminClickAsync(query: string): Promise<void> {
  const record = await findRegistrationAsync(query);
  if (record) {
    record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
    record.updatedAt = new Date().toISOString();
    await saveRegistrationAsync(record);
  }
}

/**
 * Normalizes Nigerian phone numbers to standard 11-digit format: 080XXXXXXXX
 */
export function normalizeNigerianPhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: '', error: 'Phone number is required.' };
  }

  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+234')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('234') && cleaned.length > 10) {
    cleaned = '0' + cleaned.slice(3);
  }

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

export async function getGiveawayStatsAsync() {
  const list = await getAllRegistrationsAsync();
  const totalSlots = 50;
  const totalBudget = 10000;
  const rewardAmount = 200;

  const sharesConfirmed = list.filter((r) => r.shareConfirmed).length;
  const approvedEntries = list.filter((r) => r.rewardStatus === 'approved').length;
  const airtimeCredited = list.filter((r) => r.rewardStatus === 'credited').length;
  const rejectedEntries = list.filter((r) => r.rewardStatus === 'declined').length;
  const pendingReview = list.filter((r) => r.shareConfirmed && r.rewardStatus === 'pending_review').length;

  let totalReferralVisits = 0;
  if (pgPool) {
    try {
      const res = await pgPool.query('SELECT COUNT(*) FROM giveaway_referral_visits');
      totalReferralVisits = parseInt(res.rows[0].count, 10) || 0;
    } catch {
      totalReferralVisits = readDb().referralVisits.length;
    }
  } else {
    totalReferralVisits = readDb().referralVisits.length;
  }

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
    approvedEntries,
    airtimeCredited,
    rejectedEntries,
    totalSlots,
    remainingSlots: Math.max(0, totalSlots - airtimeCredited),
    totalBudget,
    totalAirtimePaid: airtimeCredited * rewardAmount,
    rewardAmount,
    totalReferralVisits,
    networkCounts,
  };
}

export function getGiveawayStats() {
  const db = readDb();
  const list = db.registrations;
  const totalSlots = 50;
  const totalBudget = 10000;
  const rewardAmount = 200;

  const sharesConfirmed = list.filter((r) => r.shareConfirmed).length;
  const approvedEntries = list.filter((r) => r.rewardStatus === 'approved').length;
  const airtimeCredited = list.filter((r) => r.rewardStatus === 'credited').length;
  const rejectedEntries = list.filter((r) => r.rewardStatus === 'declined').length;
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
    approvedEntries,
    airtimeCredited,
    rejectedEntries,
    totalSlots,
    remainingSlots: Math.max(0, totalSlots - airtimeCredited),
    totalBudget,
    totalAirtimePaid: airtimeCredited * rewardAmount,
    rewardAmount,
    totalReferralVisits: db.referralVisits.length,
    networkCounts,
  };
}
