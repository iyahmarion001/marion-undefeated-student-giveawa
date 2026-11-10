// server.ts
import "dotenv/config";
import path2 from "path";
import { fileURLToPath } from "url";
import express2 from "express";

// server/app.ts
import express from "express";
import "dotenv/config";

// server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import "dotenv/config";
var memoryDb = { registrations: [], referralVisits: [] };
var databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
var pgPool = null;
var pgInitialized = false;
var lastPgError = null;
if (databaseUrl) {
  try {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 7e3
    });
    pgPool.on("error", (err) => {
      lastPgError = err?.message || String(err);
      console.warn("[PostgreSQL Pool Notice] Handled idle pool event:", lastPgError);
    });
    console.log("[PostgreSQL Pool Configured] Persistent storage active for Marion Undefeated Giveaway.");
  } catch (err) {
    lastPgError = err?.message || String(err);
    console.warn("[PostgreSQL Init Notice] Pool creation failed, using resilient fallback:", lastPgError);
    pgPool = null;
  }
}
async function initPgTables() {
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

        -- Admin credentials & settings table
        CREATE TABLE IF NOT EXISTS giveaway_admin_settings (
          key VARCHAR(64) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Safe column migrations for direct admin WhatsApp notification
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS admin_notified BOOLEAN DEFAULT FALSE;
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;
        ALTER TABLE giveaway_registrations ADD COLUMN IF NOT EXISTS notify_error TEXT;
      `);
      pgInitialized = true;
      lastPgError = null;
      console.log("[PostgreSQL Tables Verified] giveaway_registrations and giveaway_admin_settings ready.");
    } finally {
      client.release();
    }
  } catch (err) {
    lastPgError = err?.message || String(err);
    console.warn("[PostgreSQL Table Init Warning]:", lastPgError);
  }
}
function resolveDbPath() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join("/tmp", "data");
    return { dir: tmpDir, file: path.join(tmpDir, "registrations.json") };
  }
  const standardDir = path.join(process.cwd(), "data");
  return { dir: standardDir, file: path.join(standardDir, "registrations.json") };
}
function initDb() {
  const { dir, file } = resolveDbPath();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(file)) {
      const initial = { registrations: [], referralVisits: [] };
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("Filesystem init warning (using in-memory store):", err);
  }
  return file;
}
function readDb() {
  try {
    const dbFile = initDb();
    if (fs.existsSync(dbFile)) {
      const raw = fs.readFileSync(dbFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.registrations)) {
        memoryDb.registrations = parsed.registrations;
        memoryDb.referralVisits = Array.isArray(parsed.referralVisits) ? parsed.referralVisits : [];
        return memoryDb;
      }
    }
  } catch (error) {
    console.warn("Notice: Reading from memory:", error);
  }
  return memoryDb;
}
function writeDb(data) {
  memoryDb = data;
  try {
    const { dir, file } = resolveDbPath();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, file);
  } catch (error) {
    console.warn("Notice: Written to memory store (disk skipped in serverless):", error);
  }
}
function cleanStringValue(val) {
  if (val === null || val === void 0) return null;
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (typeof val.message === "string") {
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
function mapPgRowToRegistration(row) {
  return {
    id: cleanStringValue(row.id) || String(row.id || ""),
    phoneNumber: cleanStringValue(row.phone_number) || "",
    network: cleanStringValue(row.network) || "mtn",
    fullName: cleanStringValue(row.full_name) || void 0,
    department: cleanStringValue(row.department) || void 0,
    referralCode: cleanStringValue(row.referral_code) || "",
    referredBy: cleanStringValue(row.referred_by),
    registeredAt: row.registered_at instanceof Date ? row.registered_at.toISOString() : cleanStringValue(row.registered_at) || (/* @__PURE__ */ new Date()).toISOString(),
    shareConfirmed: Boolean(row.share_confirmed),
    shareMethod: cleanStringValue(row.share_method) || null,
    shareConfirmedAt: row.share_confirmed_at ? row.share_confirmed_at instanceof Date ? row.share_confirmed_at.toISOString() : cleanStringValue(row.share_confirmed_at) : null,
    shareClicks: Number(row.share_clicks || 0),
    notifyAdminClicks: Number(row.notify_admin_clicks || 0),
    status: cleanStringValue(row.status) || "Registered \u2013 Share Pending",
    rewardStatus: cleanStringValue(row.reward_status) || "pending_review",
    airtimeAmount: Number(row.airtime_amount || 200),
    adminNote: cleanStringValue(row.admin_note),
    adminNotified: Boolean(row.admin_notified),
    adminNotifiedAt: row.admin_notified_at ? row.admin_notified_at instanceof Date ? row.admin_notified_at.toISOString() : cleanStringValue(row.admin_notified_at) : null,
    notifyError: cleanStringValue(row.notify_error),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : cleanStringValue(row.updated_at) || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getAllRegistrationsAsync() {
  if (pgPool) {
    try {
      await initPgTables();
      const res = await pgPool.query("SELECT * FROM giveaway_registrations ORDER BY registered_at DESC");
      return res.rows.map(mapPgRowToRegistration);
    } catch (err) {
      console.warn("PostgreSQL query error, falling back to local store:", err);
    }
  }
  const db = readDb();
  return db.registrations;
}
async function saveRegistrationAsync(reg) {
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
        reg.updatedAt
      ];
      const res = await pgPool.query(query, values);
      return mapPgRowToRegistration(res.rows[0]);
    } catch (err) {
      console.warn("PostgreSQL write error, falling back to local store:", err);
    }
  }
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
async function markRewardAsPaidAtomicAsync(id, adminNote) {
  if (pgPool) {
    try {
      await initPgTables();
      const countRes = await pgPool.query(
        "SELECT COUNT(*) AS count FROM giveaway_registrations WHERE reward_status = 'credited' AND id != $1",
        [id]
      );
      const currentlyPaid2 = parseInt(countRes.rows[0].count, 10) || 0;
      if (currentlyPaid2 >= 50) {
        return {
          success: false,
          error: "Giveaway quota filled: All 50 airtime rewards have already been marked as paid and disbursed."
        };
      }
      const noteUpdate = adminNote !== void 0 ? adminNote : `\u20A6200 airtime credited by admin on ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`;
      const updateRes = await pgPool.query(
        `UPDATE giveaway_registrations 
         SET reward_status = 'credited', admin_note = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [noteUpdate, id]
      );
      if (updateRes.rowCount === 0) {
        return { success: false, error: "Registration record not found." };
      }
      return {
        success: true,
        registration: mapPgRowToRegistration(updateRes.rows[0])
      };
    } catch (err) {
      console.error("PostgreSQL atomic reward payment error:", err);
      return { success: false, error: err?.message || "Database error processing reward payment." };
    }
  }
  const db = readDb();
  const currentlyPaid = db.registrations.filter((r) => r.rewardStatus === "credited" && r.id !== id).length;
  if (currentlyPaid >= 50) {
    return {
      success: false,
      error: "Giveaway quota filled: All 50 airtime rewards have already been marked as paid and disbursed."
    };
  }
  const rec = db.registrations.find((r) => r.id === id);
  if (!rec) {
    return { success: false, error: "Registration record not found." };
  }
  rec.rewardStatus = "credited";
  if (adminNote !== void 0) rec.adminNote = adminNote;
  rec.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  writeDb(db);
  return { success: true, registration: rec };
}
async function findRegistrationAsync(query) {
  const cleanQuery = query.trim().toUpperCase();
  const normalizedPhone = query.replace(/\D/g, "");
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
      console.warn("PostgreSQL find error, falling back to local store:", err);
    }
  }
  return findRegistration(query);
}
async function recordReferralVisitAsync(referralCode) {
  const cleanCode = referralCode.trim().toUpperCase();
  if (pgPool) {
    try {
      await initPgTables();
      await pgPool.query(
        "INSERT INTO giveaway_referral_visits (referral_code, visited_at) VALUES ($1, $2)",
        [cleanCode, (/* @__PURE__ */ new Date()).toISOString()]
      );
      return;
    } catch (err) {
      console.warn("PostgreSQL visit log error:", err);
    }
  }
  const db = readDb();
  db.referralVisits.push({
    referralCode: cleanCode,
    visitedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  writeDb(db);
}
async function recordShareClickAsync(query) {
  const record = await findRegistrationAsync(query);
  if (record) {
    record.shareClicks = (record.shareClicks || 0) + 1;
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await saveRegistrationAsync(record);
  }
}
async function recordNotifyAdminClickAsync(query) {
  const record = await findRegistrationAsync(query);
  if (record) {
    record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await saveRegistrationAsync(record);
  }
}
function normalizeNigerianPhone(phone) {
  if (!phone) {
    return { valid: false, normalized: "", error: "Phone number is required." };
  }
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+234")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("234") && cleaned.length > 10) {
    cleaned = "0" + cleaned.slice(3);
  }
  const nigerianRegex = /^0(70|80|81|90|91)\d{8}$/;
  if (!nigerianRegex.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error: "Please enter a valid 11-digit Nigerian phone number (e.g. 08031234567, 070..., 090..., 081...)."
    };
  }
  return { valid: true, normalized: cleaned };
}
function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  const start = phone.slice(0, 4);
  const end = phone.slice(-3);
  return `${start} \u2022\u2022\u2022\u2022 ${end}`;
}
function findRegistration(query) {
  const db = readDb();
  const cleanQuery = query.trim().toUpperCase();
  const normalizedPhone = query.replace(/\D/g, "");
  return db.registrations.find((r) => {
    return r.referralCode.toUpperCase() === cleanQuery || r.phoneNumber === normalizedPhone || r.phoneNumber.endsWith(normalizedPhone) && normalizedPhone.length >= 10 || r.id === cleanQuery;
  });
}
async function getGiveawayStatsAsync() {
  const list = await getAllRegistrationsAsync();
  const totalSlots = 50;
  const totalBudget = 1e4;
  const rewardAmount = 200;
  const sharesConfirmed = list.filter((r) => r.shareConfirmed).length;
  const approvedEntries = list.filter((r) => r.rewardStatus === "approved").length;
  const airtimeCredited = list.filter((r) => r.rewardStatus === "credited").length;
  const rejectedEntries = list.filter((r) => r.rewardStatus === "declined").length;
  const pendingReview = list.filter((r) => r.shareConfirmed && r.rewardStatus === "pending_review").length;
  let totalReferralVisits = 0;
  if (pgPool) {
    try {
      const res = await pgPool.query("SELECT COUNT(*) FROM giveaway_referral_visits");
      totalReferralVisits = parseInt(res.rows[0].count, 10) || 0;
    } catch {
      totalReferralVisits = readDb().referralVisits.length;
    }
  } else {
    totalReferralVisits = readDb().referralVisits.length;
  }
  const networkCounts = {
    mtn: list.filter((r) => r.network === "mtn").length,
    airtel: list.filter((r) => r.network === "airtel").length,
    glo: list.filter((r) => r.network === "glo").length,
    "9mobile": list.filter((r) => r.network === "9mobile").length
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
    networkCounts
  };
}
function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(Buffer.from(a, "utf8")).digest();
  const hashB = crypto.createHash("sha256").update(Buffer.from(b, "utf8")).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
function getAdminAuthSecret() {
  const adminSecret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!adminSecret || !adminSecret.trim()) {
    return "";
  }
  return crypto.createHash("sha256").update(`MarionUndefeatedAuthKey:${adminSecret.trim()}`).digest("hex");
}
async function verifyAdminPasswordAsync(inputPassword) {
  const trimmedInput = typeof inputPassword === "string" ? inputPassword.trim() : "";
  if (!trimmedInput) {
    return { valid: false, reason: "Password cannot be empty." };
  }
  const envPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : null;
  if (!envPassword) {
    console.warn("[Admin Security Alert]: ADMIN_PASSWORD environment variable is not configured. Access is strictly denied.");
    return {
      valid: false,
      reason: "Administrator authentication is not configured on the server. Please set the ADMIN_PASSWORD environment variable in your Vercel project settings."
    };
  }
  const matches = timingSafeEqualString(trimmedInput, envPassword);
  return {
    valid: matches,
    reason: matches ? void 0 : "Invalid administrator password."
  };
}
function createAdminSessionToken() {
  const secret = getAdminAuthSecret();
  if (!secret) {
    console.warn("[Admin Security Alert]: Cannot generate session token because ADMIN_PASSWORD is not configured.");
    return null;
  }
  const timestampHex = Date.now().toString(16);
  const nonceHex = crypto.randomBytes(16).toString("hex");
  const payload = `${timestampHex}.${nonceHex}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `mu_${payload}.${signature}`;
}
function verifyAdminSessionToken(token) {
  if (typeof token !== "string" || !token.startsWith("mu_")) {
    return false;
  }
  const secret = getAdminAuthSecret();
  if (!secret) {
    return false;
  }
  const raw = token.slice(3);
  const parts = raw.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [timestampHex, nonceHex, signatureHex] = parts;
  if (!timestampHex || !nonceHex || !signatureHex) {
    return false;
  }
  const issuedAt = parseInt(timestampHex, 16);
  if (isNaN(issuedAt)) {
    return false;
  }
  const MAX_TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  if (issuedAt > now + 5 * 60 * 1e3 || now - issuedAt > MAX_TOKEN_AGE_MS) {
    return false;
  }
  const payload = `${timestampHex}.${nonceHex}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return timingSafeEqualString(signatureHex, expectedSignature);
}
async function getDatabaseStatusAsync() {
  const isUrlProvided = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  let isConnected = false;
  let tableCount = 0;
  let testError = lastPgError;
  if (pgPool) {
    try {
      await Promise.race([
        (async () => {
          const client = await pgPool.connect();
          try {
            const testRes = await client.query("SELECT 1 as ping");
            isConnected = Boolean(testRes.rows && testRes.rows[0]?.ping === 1);
            try {
              const countRes = await client.query("SELECT count(*) FROM giveaway_registrations");
              tableCount = parseInt(countRes.rows[0]?.count, 10) || 0;
            } catch {
              tableCount = 0;
            }
            testError = null;
          } finally {
            client.release();
          }
        })(),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("PostgreSQL connection check timed out after 3.5s")), 3500)
        )
      ]);
    } catch (err) {
      isConnected = false;
      testError = err?.message || String(err);
    }
  }
  let fallbackCount = 0;
  try {
    fallbackCount = readDb().registrations.length;
  } catch {
    fallbackCount = 0;
  }
  return {
    databaseConfigured: isUrlProvided,
    storageEngine: isConnected ? "Supabase / PostgreSQL (Managed Persistent)" : "Resilient File / Memory Fallback",
    connectionActive: isConnected,
    tablesInitialized: pgInitialized,
    totalRecordsInDb: isConnected ? tableCount : fallbackCount,
    lastDiagnosticMessage: testError || (isConnected ? "Database connection healthy and operational." : "Operating on fallback storage mode.")
  };
}

// server/whatsapp.ts
async function sendDirectWhatsAppNotification(params) {
  const recipient = (params.adminWhatsAppNumber || process.env.ADMIN_WHATSAPP || process.env.ADMIN_WHATSAPP_NUMBER || "2348057231961").replace(/\D/g, "");
  const shareProofText = params.shareMethod === "groups_3" ? "3 WhatsApp Groups" : params.shareMethod === "individuals_10" ? "10 Individual People" : "Self-Confirmed Sharing";
  const messageBody = `\u{1F381} *MARION UNDEFEATED GIVEAWAY 2026 \u2013 NEW ENTRY*

A participant has completed the sharing requirement and submitted their entry:

\u{1F4F1} *Student Phone:* ${params.phoneNumber}
\u{1F4F6} *Network:* ${params.network.toUpperCase()}
\u{1F4B0} *Requested Airtime:* \u20A6${params.airtimeAmount}
\u{1F194} *Registration ID:* ${params.registrationId}
\u{1F511} *Referral Code:* ${params.referralCode}
\u{1F4E2} *Sharing Proof:* ${shareProofText}
\u{1F4CA} *Current Status:* ${params.status}

\u{1F449} *Review & Disburse:* ${process.env.APP_URL ? `${process.env.APP_URL}/admin` : "Open Admin Portal to Review"}
#Let's make every penny count.`;
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (metaToken && metaPhoneId) {
    try {
      const url = `https://graph.facebook.com/v21.0/${metaPhoneId}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: messageBody
          }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.error?.message || `Meta Cloud API error (HTTP ${response.status})`;
        console.error("Meta WhatsApp Cloud API error:", data);
        return {
          sent: false,
          configured: true,
          provider: "meta",
          error: errorMsg
        };
      }
      const messageId = data?.messages?.[0]?.id || "delivered";
      return {
        sent: true,
        configured: true,
        provider: "meta",
        messageId
      };
    } catch (err) {
      console.error("Meta WhatsApp Cloud API network error:", err);
      return {
        sent: false,
        configured: true,
        provider: "meta",
        error: err?.message || "Network error reaching Meta WhatsApp Cloud API"
      };
    }
  }
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (twilioAccountSid && twilioAuthToken && twilioFrom) {
    try {
      const cleanFrom = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;
      const cleanTo = `whatsapp:+${recipient}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const formBody = new URLSearchParams({
        From: cleanFrom,
        To: cleanTo,
        Body: messageBody
      });
      const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formBody.toString()
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.message || `Twilio error (HTTP ${response.status})`;
        return {
          sent: false,
          configured: true,
          provider: "twilio",
          error: errorMsg
        };
      }
      return {
        sent: true,
        configured: true,
        provider: "twilio",
        messageId: data.sid
      };
    } catch (err) {
      return {
        sent: false,
        configured: true,
        provider: "twilio",
        error: err?.message || "Network error reaching Twilio API"
      };
    }
  }
  return {
    sent: false,
    configured: false,
    error: "Direct WhatsApp Cloud API credentials are not yet configured on this server.",
    requiredConfig: [
      "WHATSAPP_ACCESS_TOKEN (Meta WhatsApp Business System User Permanent Token)",
      "WHATSAPP_PHONE_NUMBER_ID (Meta WhatsApp Business Phone Number ID)",
      "ADMIN_WHATSAPP (Recipient: 2348057231961)"
    ]
  };
}

// server/app.ts
var app = express();
app.use((req, _res, next) => {
  if (req.body !== void 0 && req.body !== null) {
    if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
      }
    }
    req._body = true;
  }
  next();
});
app.use(express.json());
app.use((req, _res, next) => {
  if (req.query && typeof req.query.__api_path === "string") {
    const rawPath = req.query.__api_path;
    req.url = rawPath.startsWith("/") ? `/api${rawPath}` : `/api/${rawPath}`;
  }
  const forwarded = req.headers["x-forwarded-uri"] || req.headers["x-vercel-matched-path"] || req.headers["x-matched-path"];
  if (forwarded && (req.url.startsWith("/api/index") || req.url === "/api/index")) {
    req.url = forwarded;
  }
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/admin") || req.path.startsWith("/stats") || req.path.startsWith("/register")) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
  }
  next();
});
app.options("*", (_req, res) => {
  res.sendStatus(204);
});
app.get(["/health", "/api/health"], (_req, res) => {
  res.status(200).json({ status: "ok", service: "Marion Undefeated Giveaway API" });
});
app.get(["/api/stats", "/stats"], async (_req, res) => {
  try {
    const stats = await getGiveawayStatsAsync();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch giveaway statistics" });
  }
});
app.post(["/api/register", "/register"], async (req, res) => {
  try {
    const { phoneNumber, network, referralCode, referredBy, fullName, department } = req.body || {};
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const phoneValidation = normalizeNigerianPhone(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    const normalizedPhone = phoneValidation.normalized;
    const validNetworks = ["mtn", "airtel", "glo", "9mobile"];
    const chosenNetwork = validNetworks.includes(network) ? network : "mtn";
    const existing = await findRegistrationAsync(normalizedPhone);
    if (existing) {
      return res.status(200).json({
        alreadyRegistered: true,
        message: "You have already registered for the giveaway. Here is your current participation status.",
        registration: {
          id: existing.id,
          phoneNumber: existing.phoneNumber,
          phoneMasked: maskPhone(existing.phoneNumber),
          network: existing.network,
          fullName: existing.fullName,
          referralCode: existing.referralCode,
          referredBy: existing.referredBy,
          registeredAt: existing.registeredAt,
          shareConfirmed: existing.shareConfirmed,
          shareMethod: existing.shareMethod,
          shareConfirmedAt: existing.shareConfirmedAt,
          shareClicks: existing.shareClicks || 0,
          notifyAdminClicks: existing.notifyAdminClicks || 0,
          status: existing.status,
          rewardStatus: existing.rewardStatus,
          airtimeAmount: existing.airtimeAmount,
          adminNote: existing.adminNote
        }
      });
    }
    const cleanReferralCode = referralCode && String(referralCode).startsWith("MU-") ? String(referralCode).trim().toUpperCase() : `MU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newRecord = {
      id: `REG-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      phoneNumber: normalizedPhone,
      network: chosenNetwork,
      fullName: fullName ? String(fullName).trim() : void 0,
      department: department ? String(department).trim() : void 0,
      referralCode: cleanReferralCode,
      referredBy: referredBy ? String(referredBy).trim().toUpperCase() : null,
      registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
      shareConfirmed: false,
      shareMethod: null,
      shareConfirmedAt: null,
      shareClicks: 0,
      notifyAdminClicks: 0,
      status: "Registered \u2013 Share Pending",
      rewardStatus: "pending_review",
      airtimeAmount: 200,
      adminNote: null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await saveRegistrationAsync(newRecord);
    return res.status(201).json({
      success: true,
      message: "Registration successful! Complete the sharing requirement to confirm your entry.",
      registration: {
        id: saved.id,
        phoneNumber: saved.phoneNumber,
        phoneMasked: maskPhone(saved.phoneNumber),
        network: saved.network,
        fullName: saved.fullName,
        referralCode: saved.referralCode,
        referredBy: saved.referredBy,
        registeredAt: saved.registeredAt,
        shareConfirmed: saved.shareConfirmed,
        shareMethod: saved.shareMethod,
        shareConfirmedAt: saved.shareConfirmedAt,
        shareClicks: saved.shareClicks || 0,
        notifyAdminClicks: saved.notifyAdminClicks || 0,
        status: saved.status,
        rewardStatus: saved.rewardStatus,
        airtimeAmount: saved.airtimeAmount,
        adminNote: saved.adminNote
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error?.message || "Server error while processing registration." });
  }
});
app.post(["/api/confirm-share", "/confirm-share"], async (req, res) => {
  try {
    const { phoneNumber, referralCode, shareMethod } = req.body || {};
    if (!shareMethod || shareMethod !== "groups_3" && shareMethod !== "individuals_10") {
      return res.status(400).json({
        error: "Please specify whether you shared to 3 WhatsApp groups or 10 individual people."
      });
    }
    const query = phoneNumber || referralCode;
    if (!query) {
      return res.status(400).json({ error: "Phone number or referral code is required." });
    }
    const record = await findRegistrationAsync(query);
    if (!record) {
      return res.status(404).json({
        error: "No matching registration found. Please register your phone number first before confirming."
      });
    }
    record.shareConfirmed = true;
    record.shareMethod = shareMethod;
    record.shareConfirmedAt = (/* @__PURE__ */ new Date()).toISOString();
    record.status = "Share Confirmed \u2013 Awaiting Review";
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const saved = await saveRegistrationAsync(record);
    return res.status(200).json({
      success: true,
      message: "Sharing confirmation recorded! Status: Share Confirmed \u2013 Awaiting Review.",
      registration: {
        id: saved.id,
        phoneNumber: saved.phoneNumber,
        phoneMasked: maskPhone(saved.phoneNumber),
        network: saved.network,
        fullName: saved.fullName,
        referralCode: saved.referralCode,
        registeredAt: saved.registeredAt,
        shareConfirmed: saved.shareConfirmed,
        shareMethod: saved.shareMethod,
        shareConfirmedAt: saved.shareConfirmedAt,
        shareClicks: saved.shareClicks || 0,
        notifyAdminClicks: saved.notifyAdminClicks || 0,
        status: saved.status,
        rewardStatus: saved.rewardStatus,
        airtimeAmount: saved.airtimeAmount,
        adminNote: saved.adminNote
      }
    });
  } catch (error) {
    console.error("Confirm share error:", error);
    res.status(500).json({ error: error?.message || "Server error while recording sharing confirmation." });
  }
});
app.get(["/api/status/:query", "/status/:query"], async (req, res) => {
  try {
    const query = req.params.query;
    if (!query) {
      return res.status(400).json({ error: "Search query is required." });
    }
    const record = await findRegistrationAsync(query);
    if (!record) {
      return res.status(404).json({ error: "No giveaway registration found for this phone or referral code." });
    }
    res.status(200).json({
      found: true,
      registration: {
        id: record.id,
        phoneNumber: record.phoneNumber,
        phoneMasked: maskPhone(record.phoneNumber),
        network: record.network,
        fullName: record.fullName,
        referralCode: record.referralCode,
        referredBy: record.referredBy,
        registeredAt: record.registeredAt,
        shareConfirmed: record.shareConfirmed,
        shareMethod: record.shareMethod,
        shareConfirmedAt: record.shareConfirmedAt,
        shareClicks: record.shareClicks || 0,
        notifyAdminClicks: record.notifyAdminClicks || 0,
        status: record.status,
        rewardStatus: record.rewardStatus,
        airtimeAmount: record.airtimeAmount,
        adminNote: record.adminNote
      }
    });
  } catch (error) {
    console.error("Status lookup error:", error);
    res.status(500).json({ error: error?.message || "Server error looking up status." });
  }
});
app.post(["/api/track-referral-visit", "/track-referral-visit"], async (req, res) => {
  try {
    const { referralCode } = req.body || {};
    if (referralCode && String(referralCode).startsWith("MU-")) {
      await recordReferralVisitAsync(String(referralCode));
    }
    res.status(200).json({ success: true });
  } catch {
    res.status(200).json({ success: true });
  }
});
app.post(["/api/track-share-click", "/track-share-click"], async (req, res) => {
  try {
    const { query } = req.body || {};
    if (query) {
      await recordShareClickAsync(String(query));
    }
    res.status(200).json({ success: true });
  } catch {
    res.status(200).json({ success: true });
  }
});
app.post(["/api/track-notify-admin", "/track-notify-admin"], async (req, res) => {
  try {
    const { query } = req.body || {};
    if (query) {
      await recordNotifyAdminClickAsync(String(query));
    }
    res.status(200).json({ success: true });
  } catch {
    res.status(200).json({ success: true });
  }
});
app.post(["/api/notify-admin-direct", "/notify-admin-direct"], async (req, res) => {
  try {
    const { id, phoneNumber, referralCode } = req.body || {};
    const query = id || phoneNumber || referralCode;
    if (!query) {
      return res.status(400).json({ error: "Registration ID, phone number, or referral code is required." });
    }
    const record = await findRegistrationAsync(String(query));
    if (!record) {
      return res.status(404).json({ error: "No matching registration record found." });
    }
    if (record.adminNotified) {
      return res.status(200).json({
        success: true,
        sent: true,
        configured: true,
        alreadyNotified: true,
        message: `Admin was already notified of this registration on ${new Date(record.adminNotifiedAt || Date.now()).toLocaleString()}.`,
        registration: {
          id: record.id,
          phoneNumber: record.phoneNumber,
          phoneMasked: maskPhone(record.phoneNumber),
          network: record.network,
          fullName: record.fullName,
          referralCode: record.referralCode,
          registeredAt: record.registeredAt,
          shareConfirmed: record.shareConfirmed,
          shareMethod: record.shareMethod,
          shareConfirmedAt: record.shareConfirmedAt,
          status: record.status,
          rewardStatus: record.rewardStatus,
          airtimeAmount: record.airtimeAmount,
          adminNotified: record.adminNotified,
          adminNotifiedAt: record.adminNotifiedAt
        }
      });
    }
    const result = await sendDirectWhatsAppNotification({
      registrationId: record.id,
      phoneNumber: record.phoneNumber,
      network: record.network,
      airtimeAmount: record.airtimeAmount || 200,
      referralCode: record.referralCode,
      status: record.status,
      shareMethod: record.shareMethod
    });
    if (result.sent) {
      record.adminNotified = true;
      record.adminNotifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      record.notifyError = null;
      record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const saved = await saveRegistrationAsync(record);
      return res.status(200).json({
        success: true,
        sent: true,
        configured: true,
        provider: result.provider,
        messageId: result.messageId,
        message: "Registration details sent directly to Administrator WhatsApp (08057231961)!",
        registration: {
          id: saved.id,
          phoneNumber: saved.phoneNumber,
          phoneMasked: maskPhone(saved.phoneNumber),
          network: saved.network,
          fullName: saved.fullName,
          referralCode: saved.referralCode,
          registeredAt: saved.registeredAt,
          shareConfirmed: saved.shareConfirmed,
          shareMethod: saved.shareMethod,
          shareConfirmedAt: saved.shareConfirmedAt,
          status: saved.status,
          rewardStatus: saved.rewardStatus,
          airtimeAmount: saved.airtimeAmount,
          adminNotified: saved.adminNotified,
          adminNotifiedAt: saved.adminNotifiedAt
        }
      });
    } else {
      record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
      record.adminNotified = true;
      record.adminNotifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      record.notifyError = null;
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const saved = await saveRegistrationAsync(record);
      return res.status(200).json({
        success: true,
        sent: false,
        configured: Boolean(result.configured),
        provider: result.provider,
        fallback: true,
        message: "Opening WhatsApp chat to notify Administrator (08057231961)...",
        registration: {
          id: saved.id,
          phoneNumber: saved.phoneNumber,
          phoneMasked: maskPhone(saved.phoneNumber),
          network: saved.network,
          fullName: saved.fullName,
          referralCode: saved.referralCode,
          registeredAt: saved.registeredAt,
          shareConfirmed: saved.shareConfirmed,
          shareMethod: saved.shareMethod,
          shareConfirmedAt: saved.shareConfirmedAt,
          status: saved.status,
          rewardStatus: saved.rewardStatus,
          airtimeAmount: saved.airtimeAmount,
          adminNotified: saved.adminNotified,
          adminNotifiedAt: saved.adminNotifiedAt,
          notifyError: null
        }
      });
    }
  } catch (error) {
    console.error("Direct admin notification error:", error);
    res.status(500).json({ error: error?.message || "Server error while sending admin notification." });
  }
});
var checkAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "").trim() || (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"].trim() : void 0) || (typeof req.query.token === "string" ? req.query.token.trim() : void 0);
  if (token && verifyAdminSessionToken(token)) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized: Valid administrator session required." });
};
app.get(["/api/diagnostic", "/api/admin/diagnostic", "/diagnostic"], async (_req, res) => {
  try {
    const dbStatus = await getDatabaseStatusAsync();
    res.status(200).json({
      service: "Marion Undefeated Airtime Giveaway 2026",
      environment: process.env.VERCEL ? "Vercel Serverless" : "Node.js Server",
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()),
      adminSessionKeyPersistent: Boolean(
        process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim() || process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()
      ),
      adminSessionKeySource: process.env.ADMIN_SESSION_SECRET ? "Dedicated (ADMIN_SESSION_SECRET)" : process.env.ADMIN_PASSWORD ? "Derived (ADMIN_PASSWORD)" : "Not Configured",
      adminWhatsAppConfigured: Boolean(process.env.ADMIN_WHATSAPP || process.env.ADMIN_WHATSAPP_NUMBER),
      adminWhatsAppNumber: "2348057231961",
      whatsappApiRequired: false,
      whatsappDeliveryMode: process.env.WHATSAPP_ACCESS_TOKEN || process.env.TWILIO_ACCOUNT_SID ? "Automated Cloud API" : "Direct WhatsApp Chat Fallback (08057231961)",
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime())
    });
  } catch (err) {
    res.status(500).json({
      error: "Diagnostic check failed: " + (err?.message || err)
    });
  }
});
app.post(["/api/admin/login", "/admin/login"], async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
      }
    }
    const { password, email } = body || {};
    const trimmed = typeof password === "string" ? password.trim() : "";
    console.log("[Admin Security]: Administrator authentication attempt received.");
    if (!trimmed) {
      return res.status(400).json({ error: "Please enter the administrator passcode." });
    }
    const verification = await verifyAdminPasswordAsync(trimmed);
    if (verification.valid) {
      const sessionToken = createAdminSessionToken();
      if (!sessionToken) {
        return res.status(500).json({
          error: "Failed to generate administrator session token. Ensure ADMIN_PASSWORD is set on the server."
        });
      }
      console.log("[Admin Security]: Administrator successfully authenticated. Session token generated.");
      return res.status(200).json({
        success: true,
        token: sessionToken,
        adminEmail: email || "iyahmarion24@gmail.com"
      });
    }
    console.warn("[Admin Security Alert]: Administrator authentication failed \u2014 invalid credentials.");
    return res.status(401).json({
      error: verification.reason || "Invalid administrator password."
    });
  } catch (err) {
    console.error("[Admin Security Fatal]:", err?.message || err);
    return res.status(500).json({
      error: `Login processing error: ${err?.message || "Internal server error"}`
    });
  }
});
app.get(["/api/admin/registrations", "/admin/registrations"], checkAdminAuth, async (_req, res) => {
  try {
    const list = await getAllRegistrationsAsync();
    const stats = await getGiveawayStatsAsync();
    res.status(200).json({
      stats,
      registrations: list
    });
  } catch (error) {
    console.error("Admin fetch error:", error);
    res.status(500).json({ error: error?.message || "Failed to retrieve registrations." });
  }
});
app.post(["/api/admin/update-reward", "/admin/update-reward"], checkAdminAuth, async (req, res) => {
  try {
    const { id, rewardStatus, adminNote } = req.body || {};
    if (!id || !rewardStatus) {
      return res.status(400).json({ error: "Registration ID and rewardStatus are required." });
    }
    const validStatuses = ["pending_review", "approved", "credited", "declined"];
    if (!validStatuses.includes(rewardStatus)) {
      return res.status(400).json({ error: "Invalid reward status value." });
    }
    if (rewardStatus === "credited") {
      const atomicResult = await markRewardAsPaidAtomicAsync(id, adminNote);
      if (!atomicResult.success) {
        return res.status(400).json({ error: atomicResult.error || "Failed to disburse reward slot." });
      }
      return res.status(200).json({
        success: true,
        message: "Reward status updated to credited (1 of 50 slots consumed).",
        registration: atomicResult.registration
      });
    }
    const record = await findRegistrationAsync(id);
    if (!record) {
      return res.status(404).json({ error: "Registration record not found." });
    }
    record.rewardStatus = rewardStatus;
    if (adminNote !== void 0) {
      record.adminNote = adminNote;
    }
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const saved = await saveRegistrationAsync(record);
    res.status(200).json({
      success: true,
      message: `Reward status updated to ${rewardStatus}.`,
      registration: saved
    });
  } catch (error) {
    console.error("Admin update reward error:", error);
    res.status(500).json({ error: error?.message || "Failed to update reward status." });
  }
});
app.get(["/api/admin/export-csv", "/admin/export-csv"], checkAdminAuth, async (_req, res) => {
  try {
    const list = await getAllRegistrationsAsync();
    const rows = [
      ["ID", "Phone Number", "Network", "Student Name", "Status", "Share Method", "Share Date", "Reward Status", "Admin Note"].join(","),
      ...list.map((r) => [
        `"${r.id}"`,
        `"${r.phoneNumber}"`,
        `"${r.network.toUpperCase()}"`,
        `"${(r.fullName || "").replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.shareMethod || "Not Shared"}"`,
        `"${r.shareConfirmedAt || ""}"`,
        `"${r.rewardStatus}"`,
        `"${(r.adminNote || "").replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="marion_giveaway_airtime_list.csv"');
    res.send(rows);
  } catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ error: error?.message || "Failed to generate CSV export." });
  }
});
app.all(["/api", "/api/*"], (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    validEndpoints: ["/api/stats", "/api/register", "/api/confirm-share", "/api/status/:query", "/api/admin/login", "/api/diagnostic"]
  });
});
app.use((err, _req, res, _next) => {
  console.error("Express server error:", err);
  res.status(500).json({
    error: err?.message || "An unexpected internal server error occurred."
  });
});

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
var isProd = process.env.NODE_ENV === "production";
async function startServer() {
  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express2.static(path2.join(__dirname, "dist"), {
      maxAge: "1d",
      index: false
    }));
    app.use(express2.static(path2.join(__dirname, "public"), {
      maxAge: "1d"
    }));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(__dirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Marion Undefeated Giveaway app listening on port ${PORT} [Mode: ${isProd ? "Production" : "Development"}]`);
  });
}
startServer();
