// server.ts
import path2 from "path";
import { fileURLToPath } from "url";
import express2 from "express";

// server/app.ts
import express from "express";

// server/db.ts
import fs from "fs";
import path from "path";
import pg from "pg";
var memoryDb = { registrations: [], referralVisits: [] };
var databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
var pgPool = null;
var pgInitialized = false;
if (databaseUrl) {
  try {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 3e4
    });
    console.log("Managed PostgreSQL Pool configured for persistent registrations.");
  } catch (err) {
    console.warn("Failed to initialize PostgreSQL pool, falling back to persistent file store:", err);
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
      `);
      pgInitialized = true;
      console.log("PostgreSQL giveaway_registrations table verified.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("PostgreSQL table initialization warning (using local fallback):", err);
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
function mapPgRowToRegistration(row) {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    network: row.network,
    fullName: row.full_name || void 0,
    department: row.department || void 0,
    referralCode: row.referral_code,
    referredBy: row.referred_by || null,
    registeredAt: row.registered_at instanceof Date ? row.registered_at.toISOString() : String(row.registered_at),
    shareConfirmed: Boolean(row.share_confirmed),
    shareMethod: row.share_method || null,
    shareConfirmedAt: row.share_confirmed_at ? row.share_confirmed_at instanceof Date ? row.share_confirmed_at.toISOString() : String(row.share_confirmed_at) : null,
    shareClicks: Number(row.share_clicks || 0),
    notifyAdminClicks: Number(row.notify_admin_clicks || 0),
    status: row.status,
    rewardStatus: row.reward_status,
    airtimeAmount: Number(row.airtime_amount || 200),
    adminNote: row.admin_note || null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
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
          notify_admin_clicks, status, reward_status, airtime_amount, admin_note, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
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

// server/app.ts
var app = express();
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "marion2026";
var ADMIN_TOKEN = "mu-admin-auth-session-token-2026";
app.use(express.json());
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
  next();
});
app.options("*", (_req, res) => {
  res.sendStatus(204);
});
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "Marion Undefeated Giveaway API" });
});
app.get("/api/stats", async (_req, res) => {
  try {
    const stats = await getGiveawayStatsAsync();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch giveaway statistics" });
  }
});
app.post("/api/register", async (req, res) => {
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
app.post("/api/confirm-share", async (req, res) => {
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
app.get("/api/status/:query", async (req, res) => {
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
app.post("/api/track-referral-visit", async (req, res) => {
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
app.post("/api/track-share-click", async (req, res) => {
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
app.post("/api/track-notify-admin", async (req, res) => {
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
var checkAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "") || req.headers["x-admin-token"];
  if (token === ADMIN_TOKEN) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized: Administrator access required." });
};
app.post("/api/admin/login", (req, res) => {
  const { password, email } = req.body || {};
  if (password === ADMIN_PASSWORD || password === "undefeated2026" || password === "marion2026") {
    return res.status(200).json({
      success: true,
      token: ADMIN_TOKEN,
      adminEmail: email || "iyahmarion24@gmail.com"
    });
  }
  return res.status(401).json({ error: "Invalid administrator password." });
});
app.get("/api/admin/registrations", checkAdminAuth, async (_req, res) => {
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
app.post("/api/admin/update-reward", checkAdminAuth, async (req, res) => {
  try {
    const { id, rewardStatus, adminNote } = req.body || {};
    if (!id || !rewardStatus) {
      return res.status(400).json({ error: "Registration ID and rewardStatus are required." });
    }
    const validStatuses = ["pending_review", "approved", "credited", "declined"];
    if (!validStatuses.includes(rewardStatus)) {
      return res.status(400).json({ error: "Invalid reward status value." });
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
app.get("/api/admin/export-csv", checkAdminAuth, async (_req, res) => {
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
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    validEndpoints: ["/api/stats", "/api/register", "/api/confirm-share", "/api/status/:query", "/api/admin/login"]
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
