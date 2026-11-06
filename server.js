// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";

// server/db.ts
import fs from "fs";
import path from "path";
var DATA_DIR = path.join(process.cwd(), "data");
var DB_FILE = path.join(DATA_DIR, "registrations.json");
function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = { registrations: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}
function readDb() {
  try {
    initDb();
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading database file, returning default:", error);
    return { registrations: [] };
  }
}
function writeDb(data) {
  try {
    initDb();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error("Error writing to database file:", error);
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
function getGiveawayStats() {
  const db = readDb();
  const list = db.registrations;
  const totalSlots = 50;
  const totalBudget = 1e4;
  const rewardAmount = 200;
  const sharesConfirmed = list.filter((r) => r.shareConfirmed).length;
  const airtimeCredited = list.filter((r) => r.rewardStatus === "credited").length;
  const pendingReview = list.filter((r) => r.shareConfirmed && r.rewardStatus === "pending_review").length;
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
    airtimeCredited,
    totalSlots,
    remainingSlots: Math.max(0, totalSlots - airtimeCredited),
    totalBudget,
    rewardAmount,
    networkCounts
  };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var isProd = process.env.NODE_ENV === "production";
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "marion2026";
var ADMIN_TOKEN = "mu-admin-auth-session-token-2026";
app.use(express.json());
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});
app.get("/api/stats", (_req, res) => {
  try {
    const stats = getGiveawayStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch giveaway statistics" });
  }
});
app.post("/api/register", (req, res) => {
  try {
    const { phoneNumber, network, referralCode, referredBy, fullName, department } = req.body;
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
    const db = readDb();
    const existing = db.registrations.find((r) => r.phoneNumber === normalizedPhone);
    if (existing) {
      return res.status(200).json({
        alreadyRegistered: true,
        message: "You have already registered for the giveaway. Here is your current participation status.",
        registration: {
          id: existing.id,
          phoneMasked: maskPhone(existing.phoneNumber),
          network: existing.network,
          fullName: existing.fullName,
          referralCode: existing.referralCode,
          referredBy: existing.referredBy,
          registeredAt: existing.registeredAt,
          shareConfirmed: existing.shareConfirmed,
          shareMethod: existing.shareMethod,
          shareConfirmedAt: existing.shareConfirmedAt,
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
      status: "Registered \u2013 Share Pending",
      rewardStatus: "pending_review",
      airtimeAmount: 200,
      adminNote: null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.registrations.push(newRecord);
    writeDb(db);
    return res.status(201).json({
      success: true,
      message: "Registration successful! Complete the sharing requirement to confirm your entry.",
      registration: {
        id: newRecord.id,
        phoneMasked: maskPhone(newRecord.phoneNumber),
        network: newRecord.network,
        fullName: newRecord.fullName,
        referralCode: newRecord.referralCode,
        referredBy: newRecord.referredBy,
        registeredAt: newRecord.registeredAt,
        shareConfirmed: newRecord.shareConfirmed,
        shareMethod: newRecord.shareMethod,
        shareConfirmedAt: newRecord.shareConfirmedAt,
        status: newRecord.status,
        rewardStatus: newRecord.rewardStatus,
        airtimeAmount: newRecord.airtimeAmount,
        adminNote: newRecord.adminNote
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error while processing registration." });
  }
});
app.post("/api/confirm-share", (req, res) => {
  try {
    const { phoneNumber, referralCode, shareMethod } = req.body;
    if (!shareMethod || shareMethod !== "groups_3" && shareMethod !== "individuals_10") {
      return res.status(400).json({
        error: "Please specify whether you shared to 3 WhatsApp groups or 10 individual people."
      });
    }
    const db = readDb();
    let record;
    if (phoneNumber) {
      const normalized = normalizeNigerianPhone(phoneNumber);
      if (normalized.valid) {
        record = db.registrations.find((r) => r.phoneNumber === normalized.normalized);
      }
    }
    if (!record && referralCode) {
      const cleanCode = String(referralCode).trim().toUpperCase();
      record = db.registrations.find((r) => r.referralCode === cleanCode);
    }
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
    writeDb(db);
    return res.json({
      success: true,
      message: "Sharing confirmation recorded! Your status is now Share Confirmed \u2013 Awaiting Review.",
      registration: {
        id: record.id,
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
        adminNote: record.adminNote
      }
    });
  } catch (error) {
    console.error("Confirm share error:", error);
    res.status(500).json({ error: "Server error while recording sharing confirmation." });
  }
});
app.get("/api/status/:query", (req, res) => {
  try {
    const query = req.params.query;
    if (!query) {
      return res.status(400).json({ error: "Search query is required." });
    }
    const record = findRegistration(query);
    if (!record) {
      return res.status(404).json({ error: "No giveaway registration found for this phone or referral code." });
    }
    res.json({
      found: true,
      registration: {
        id: record.id,
        phoneMasked: maskPhone(record.phoneNumber),
        network: record.network,
        fullName: record.fullName,
        referralCode: record.referralCode,
        referredBy: record.referredBy,
        registeredAt: record.registeredAt,
        shareConfirmed: record.shareConfirmed,
        shareMethod: record.shareMethod,
        shareConfirmedAt: record.shareConfirmedAt,
        status: record.status,
        rewardStatus: record.rewardStatus,
        airtimeAmount: record.airtimeAmount,
        adminNote: record.adminNote
      }
    });
  } catch (error) {
    console.error("Status lookup error:", error);
    res.status(500).json({ error: "Server error looking up status." });
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
  const { password, email } = req.body;
  if (password === ADMIN_PASSWORD || password === "undefeated2026" || password === "marion2026") {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      adminEmail: email || "iyahmarion24@gmail.com"
    });
  }
  return res.status(401).json({ error: "Invalid administrator password." });
});
app.get("/api/admin/registrations", checkAdminAuth, (_req, res) => {
  try {
    const db = readDb();
    const stats = getGiveawayStats();
    res.json({
      stats,
      registrations: db.registrations
    });
  } catch (error) {
    console.error("Admin fetch error:", error);
    res.status(500).json({ error: "Failed to retrieve registrations." });
  }
});
app.post("/api/admin/update-reward", checkAdminAuth, (req, res) => {
  try {
    const { id, rewardStatus, adminNote } = req.body;
    if (!id || !rewardStatus) {
      return res.status(400).json({ error: "Registration ID and rewardStatus are required." });
    }
    const validStatuses = ["pending_review", "approved", "credited", "declined"];
    if (!validStatuses.includes(rewardStatus)) {
      return res.status(400).json({ error: "Invalid reward status value." });
    }
    const db = readDb();
    const record = db.registrations.find((r) => r.id === id);
    if (!record) {
      return res.status(404).json({ error: "Registration record not found." });
    }
    record.rewardStatus = rewardStatus;
    if (adminNote !== void 0) {
      record.adminNote = adminNote;
    }
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeDb(db);
    res.json({
      success: true,
      message: `Reward status updated to ${rewardStatus}.`,
      registration: record
    });
  } catch (error) {
    console.error("Admin update reward error:", error);
    res.status(500).json({ error: "Failed to update reward status." });
  }
});
app.get("/api/admin/export-csv", checkAdminAuth, (_req, res) => {
  try {
    const db = readDb();
    const rows = [
      ["ID", "Phone Number", "Network", "Student Name", "Status", "Share Method", "Share Date", "Reward Status", "Admin Note"].join(","),
      ...db.registrations.map((r) => [
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
    res.status(500).json({ error: "Failed to generate CSV export." });
  }
});
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
    app.use(express.static(path2.join(__dirname, "dist"), {
      maxAge: "1d",
      index: false
    }));
    app.use(express.static(path2.join(__dirname, "public"), {
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
