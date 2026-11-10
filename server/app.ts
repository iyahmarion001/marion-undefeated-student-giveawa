import express from 'express';
import 'dotenv/config';
import {
  getAllRegistrationsAsync,
  saveRegistrationAsync,
  findRegistrationAsync,
  getGiveawayStatsAsync,
  recordReferralVisitAsync,
  recordShareClickAsync,
  recordNotifyAdminClickAsync,
  markRewardAsPaidAtomicAsync,
  normalizeNigerianPhone,
  maskPhone,
  verifyAdminPasswordAsync,
  createAdminSessionToken,
  verifyAdminSessionToken,
  getDatabaseStatusAsync,
  type Registration
} from './db';
import { sendDirectWhatsAppNotification } from './whatsapp';

export const app = express();

// 1. Normalize pre-parsed request bodies from serverless runtimes (Vercel, Cloud Functions)
// CRITICAL: Must run BEFORE express.json() so body-parser does not hang on consumed streams!
app.use((req, _res, next) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch {}
    }
    (req as any)._body = true;
  }
  next();
});

// 2. Middleware for parsing JSON requests safely on unconsumed streams
app.use(express.json());

// Normalization middleware for Vercel Serverless & proxy environments
app.use((req, _res, next) => {
  if (req.query && typeof req.query.__api_path === 'string') {
    const rawPath = req.query.__api_path;
    req.url = rawPath.startsWith('/') ? `/api${rawPath}` : `/api/${rawPath}`;
  }
  const forwarded = (req.headers['x-forwarded-uri'] || req.headers['x-vercel-matched-path'] || req.headers['x-matched-path']) as string;
  if (forwarded && (req.url.startsWith('/api/index') || req.url === '/api/index')) {
    req.url = forwarded;
  }
  next();
});

// Set JSON content-type and CORS headers for all API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/stats') || req.path.startsWith('/register')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  }
  next();
});

// Handle pre-flight CORS requests
app.options('*', (_req, res) => {
  res.sendStatus(204);
});

// 1. Health check
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Marion Undefeated Giveaway API' });
});

// 2. Giveaway Statistics
app.get(['/api/stats', '/stats'], async (_req, res) => {
  try {
    const stats = await getGiveawayStatsAsync();
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch giveaway statistics' });
  }
});

// 3. Register for Giveaway
app.post(['/api/register', '/register'], async (req, res) => {
  try {
    const { phoneNumber, network, referralCode, referredBy, fullName, department } = req.body || {};

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const phoneValidation = normalizeNigerianPhone(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }

    const normalizedPhone = phoneValidation.normalized;
    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    const chosenNetwork = validNetworks.includes(network) ? network : 'mtn';

    const existing = await findRegistrationAsync(normalizedPhone);

    if (existing) {
      return res.status(200).json({
        alreadyRegistered: true,
        message: 'You have already registered for the giveaway. Here is your current participation status.',
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
          adminNote: existing.adminNote,
        },
      });
    }

    const cleanReferralCode = (referralCode && String(referralCode).startsWith('MU-'))
      ? String(referralCode).trim().toUpperCase()
      : `MU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newRecord: Registration = {
      id: `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      phoneNumber: normalizedPhone,
      network: chosenNetwork as 'mtn' | 'airtel' | 'glo' | '9mobile',
      fullName: fullName ? String(fullName).trim() : undefined,
      department: department ? String(department).trim() : undefined,
      referralCode: cleanReferralCode,
      referredBy: referredBy ? String(referredBy).trim().toUpperCase() : null,
      registeredAt: new Date().toISOString(),
      shareConfirmed: false,
      shareMethod: null,
      shareConfirmedAt: null,
      shareClicks: 0,
      notifyAdminClicks: 0,
      status: 'Registered – Share Pending',
      rewardStatus: 'pending_review',
      airtimeAmount: 200,
      adminNote: null,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveRegistrationAsync(newRecord);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Complete the sharing requirement to confirm your entry.',
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
        adminNote: saved.adminNote,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error?.message || 'Server error while processing registration.' });
  }
});

// 4. Confirm Sharing (Record "I've Shared")
app.post(['/api/confirm-share', '/confirm-share'], async (req, res) => {
  try {
    const { phoneNumber, referralCode, shareMethod } = req.body || {};

    if (!shareMethod || (shareMethod !== 'groups_3' && shareMethod !== 'individuals_10')) {
      return res.status(400).json({
        error: 'Please specify whether you shared to 3 WhatsApp groups or 10 individual people.',
      });
    }

    const query = phoneNumber || referralCode;
    if (!query) {
      return res.status(400).json({ error: 'Phone number or referral code is required.' });
    }

    const record = await findRegistrationAsync(query);

    if (!record) {
      return res.status(404).json({
        error: 'No matching registration found. Please register your phone number first before confirming.',
      });
    }

    // Record participant's self-confirmation
    record.shareConfirmed = true;
    record.shareMethod = shareMethod;
    record.shareConfirmedAt = new Date().toISOString();
    record.status = 'Share Confirmed – Awaiting Review';
    record.updatedAt = new Date().toISOString();

    const saved = await saveRegistrationAsync(record);

    return res.status(200).json({
      success: true,
      message: 'Sharing confirmation recorded! Status: Share Confirmed – Awaiting Review.',
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
        adminNote: saved.adminNote,
      },
    });
  } catch (error: any) {
    console.error('Confirm share error:', error);
    res.status(500).json({ error: error?.message || 'Server error while recording sharing confirmation.' });
  }
});

// 5. Look up participant status (public / student friendly)
app.get(['/api/status/:query', '/status/:query'], async (req, res) => {
  try {
    const query = req.params.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const record = await findRegistrationAsync(query);
    if (!record) {
      return res.status(404).json({ error: 'No giveaway registration found for this phone or referral code.' });
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
        adminNote: record.adminNote,
      },
    });
  } catch (error: any) {
    console.error('Status lookup error:', error);
    res.status(500).json({ error: error?.message || 'Server error looking up status.' });
  }
});

// 6. Track referral link visit
app.post(['/api/track-referral-visit', '/track-referral-visit'], async (req, res) => {
  try {
    const { referralCode } = req.body || {};
    if (referralCode && String(referralCode).startsWith('MU-')) {
      await recordReferralVisitAsync(String(referralCode));
    }
    res.status(200).json({ success: true });
  } catch {
    res.status(200).json({ success: true });
  }
});

// 7. Track share click
app.post(['/api/track-share-click', '/track-share-click'], async (req, res) => {
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

// 8. Track admin WhatsApp notification click
app.post(['/api/track-notify-admin', '/track-notify-admin'], async (req, res) => {
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

// 9. Direct Admin WhatsApp Notification (Official WhatsApp Cloud API / Provider)
// Sends details directly to admin WhatsApp 08057231961 (2348057231961) without redirecting the student
app.post(['/api/notify-admin-direct', '/notify-admin-direct'], async (req, res) => {
  try {
    const { id, phoneNumber, referralCode } = req.body || {};
    const query = id || phoneNumber || referralCode;

    if (!query) {
      return res.status(400).json({ error: 'Registration ID, phone number, or referral code is required.' });
    }

    const record = await findRegistrationAsync(String(query));

    if (!record) {
      return res.status(404).json({ error: 'No matching registration record found.' });
    }

    // Check if duplicate notification
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
          adminNotifiedAt: record.adminNotifiedAt,
        },
      });
    }

    // Dispatch direct notification to Admin (08057231961)
    const result = await sendDirectWhatsAppNotification({
      registrationId: record.id,
      phoneNumber: record.phoneNumber,
      network: record.network,
      airtimeAmount: record.airtimeAmount || 200,
      referralCode: record.referralCode,
      status: record.status,
      shareMethod: record.shareMethod,
    });

    if (result.sent) {
      record.adminNotified = true;
      record.adminNotifiedAt = new Date().toISOString();
      record.notifyError = null;
      record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
      record.updatedAt = new Date().toISOString();

      const saved = await saveRegistrationAsync(record);

      return res.status(200).json({
        success: true,
        sent: true,
        configured: true,
        provider: result.provider,
        messageId: result.messageId,
        message: 'Registration details sent directly to Administrator WhatsApp (08057231961)!',
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
        },
      });
    } else {
      record.notifyAdminClicks = (record.notifyAdminClicks || 0) + 1;
      record.adminNotified = true;
      record.adminNotifiedAt = new Date().toISOString();
      record.notifyError = null;
      record.updatedAt = new Date().toISOString();

      const saved = await saveRegistrationAsync(record);

      return res.status(200).json({
        success: true,
        sent: false,
        configured: Boolean(result.configured),
        provider: result.provider,
        fallback: true,
        message: 'Opening WhatsApp chat to notify Administrator (08057231961)...',
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
          notifyError: null,
        },
      });
    }
  } catch (error: any) {
    console.error('Direct admin notification error:', error);
    res.status(500).json({ error: error?.message || 'Server error while sending admin notification.' });
  }
});

// Administrator Auth Middleware - validates dynamic HMAC signed session token
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.replace('Bearer ', '').trim() ||
    (typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'].trim() : undefined) ||
    (typeof req.query.token === 'string' ? req.query.token.trim() : undefined);

  if (token && verifyAdminSessionToken(token)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Valid administrator session required.' });
};

// Safe diagnostic endpoint to verify database and environment health on Vercel
app.get(['/api/diagnostic', '/api/admin/diagnostic', '/diagnostic'], async (_req, res) => {
  try {
    const dbStatus = await getDatabaseStatusAsync();
    res.status(200).json({
      service: 'Marion Undefeated Airtime Giveaway 2026',
      environment: process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Server',
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()),
      adminSessionKeyPersistent: Boolean(
        (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim()) ||
        (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim())
      ),
      adminSessionKeySource: process.env.ADMIN_SESSION_SECRET
        ? 'Dedicated (ADMIN_SESSION_SECRET)'
        : (process.env.ADMIN_PASSWORD ? 'Derived (ADMIN_PASSWORD)' : 'Not Configured'),
      adminWhatsAppConfigured: Boolean(process.env.ADMIN_WHATSAPP || process.env.ADMIN_WHATSAPP_NUMBER),
      adminWhatsAppNumber: '2348057231961',
      whatsappApiRequired: false,
      whatsappDeliveryMode: (process.env.WHATSAPP_ACCESS_TOKEN || process.env.TWILIO_ACCOUNT_SID)
        ? 'Automated Cloud API'
        : 'Direct WhatsApp Chat Fallback (08057231961)',
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Diagnostic check failed: ' + (err?.message || err),
    });
  }
});

// Admin Login with secure verification and unpredictable token generation
app.post(['/api/admin/login', '/admin/login'], async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { password, email } = body || {};
    const trimmed = typeof password === 'string' ? password.trim() : '';

    console.log('[Admin Security]: Administrator authentication attempt received.');

    if (!trimmed) {
      return res.status(400).json({ error: 'Please enter the administrator passcode.' });
    }

    const verification = await verifyAdminPasswordAsync(trimmed);

    if (verification.valid) {
      const sessionToken = createAdminSessionToken();
      if (!sessionToken) {
        return res.status(500).json({
          error: 'Failed to generate administrator session token. Ensure ADMIN_PASSWORD is set on the server.',
        });
      }

      console.log('[Admin Security]: Administrator successfully authenticated. Session token generated.');
      return res.status(200).json({
        success: true,
        token: sessionToken,
        adminEmail: email || 'iyahmarion24@gmail.com',
      });
    }

    console.warn('[Admin Security Alert]: Administrator authentication failed — invalid credentials.');
    return res.status(401).json({
      error: verification.reason || 'Invalid administrator password.',
    });
  } catch (err: any) {
    console.error('[Admin Security Fatal]:', err?.message || err);
    return res.status(500).json({
      error: `Login processing error: ${err?.message || 'Internal server error'}`,
    });
  }
});

// Admin Get Registrations
app.get(['/api/admin/registrations', '/admin/registrations'], checkAdminAuth, async (_req, res) => {
  try {
    const list = await getAllRegistrationsAsync();
    const stats = await getGiveawayStatsAsync();
    res.status(200).json({
      stats,
      registrations: list,
    });
  } catch (error: any) {
    console.error('Admin fetch error:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve registrations.' });
  }
});

// Admin Update Reward Status (Approve, Reject, or Mark as Paid)
app.post(['/api/admin/update-reward', '/admin/update-reward'], checkAdminAuth, async (req, res) => {
  try {
    const { id, rewardStatus, adminNote } = req.body || {};

    if (!id || !rewardStatus) {
      return res.status(400).json({ error: 'Registration ID and rewardStatus are required.' });
    }

    const validStatuses = ['pending_review', 'approved', 'credited', 'declined'];
    if (!validStatuses.includes(rewardStatus)) {
      return res.status(400).json({ error: 'Invalid reward status value.' });
    }

    // Atomic disburse logic for 'credited' (Requirement 4: concurrency safe & max 50 slots)
    if (rewardStatus === 'credited') {
      const atomicResult = await markRewardAsPaidAtomicAsync(id, adminNote);
      if (!atomicResult.success) {
        return res.status(400).json({ error: atomicResult.error || 'Failed to disburse reward slot.' });
      }
      return res.status(200).json({
        success: true,
        message: 'Reward status updated to credited (1 of 50 slots consumed).',
        registration: atomicResult.registration,
      });
    }

    const record = await findRegistrationAsync(id);

    if (!record) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    record.rewardStatus = rewardStatus;
    if (adminNote !== undefined) {
      record.adminNote = adminNote;
    }
    record.updatedAt = new Date().toISOString();

    const saved = await saveRegistrationAsync(record);

    res.status(200).json({
      success: true,
      message: `Reward status updated to ${rewardStatus}.`,
      registration: saved,
    });
  } catch (error: any) {
    console.error('Admin update reward error:', error);
    res.status(500).json({ error: error?.message || 'Failed to update reward status.' });
  }
});

// Admin Export CSV
app.get(['/api/admin/export-csv', '/admin/export-csv'], checkAdminAuth, async (_req, res) => {
  try {
    const list = await getAllRegistrationsAsync();
    const rows = [
      ['ID', 'Phone Number', 'Network', 'Student Name', 'Status', 'Share Method', 'Share Date', 'Reward Status', 'Admin Note'].join(','),
      ...list.map((r) => [
        `"${r.id}"`,
        `"${r.phoneNumber}"`,
        `"${r.network.toUpperCase()}"`,
        `"${(r.fullName || '').replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.shareMethod || 'Not Shared'}"`,
        `"${r.shareConfirmedAt || ''}"`,
        `"${r.rewardStatus}"`,
        `"${(r.adminNote || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="marion_giveaway_airtime_list.csv"');
    res.send(rows);
  } catch (error: any) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate CSV export.' });
  }
});

// Dedicated 404 handler for any unmatched /api route: ALWAYS returns valid JSON!
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    validEndpoints: ['/api/stats', '/api/register', '/api/confirm-share', '/api/status/:query', '/api/admin/login', '/api/diagnostic']
  });
});

// Global error handler for /api: ALWAYS returns valid JSON!
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Express server error:', err);
  res.status(500).json({
    error: err?.message || 'An unexpected internal server error occurred.',
  });
});
