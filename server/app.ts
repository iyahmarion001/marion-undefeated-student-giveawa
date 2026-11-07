import express from 'express';
import {
  getAllRegistrationsAsync,
  saveRegistrationAsync,
  findRegistrationAsync,
  getGiveawayStatsAsync,
  recordReferralVisitAsync,
  recordShareClickAsync,
  recordNotifyAdminClickAsync,
  normalizeNigerianPhone,
  maskPhone,
  type Registration
} from './db';

export const app = express();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'marion2026';
const ADMIN_TOKEN = 'mu-admin-auth-session-token-2026';

// Middleware for parsing JSON requests safely
app.use(express.json());

// Set JSON content-type and CORS headers for all API requests
app.use('/api', (_req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  next();
});

// Handle pre-flight CORS requests
app.options('*', (_req, res) => {
  res.sendStatus(204);
});

// 1. Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Marion Undefeated Giveaway API' });
});

// 2. Giveaway Statistics
app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await getGiveawayStatsAsync();
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch giveaway statistics' });
  }
});

// 3. Register for Giveaway
app.post('/api/register', async (req, res) => {
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
app.post('/api/confirm-share', async (req, res) => {
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
app.get('/api/status/:query', async (req, res) => {
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
app.post('/api/track-referral-visit', async (req, res) => {
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
app.post('/api/track-share-click', async (req, res) => {
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
app.post('/api/track-notify-admin', async (req, res) => {
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

// Administrator Auth Middleware
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.replace('Bearer ', '') ||
    req.headers['x-admin-token'] ||
    (typeof req.query.token === 'string' ? req.query.token : undefined);

  if (token === ADMIN_TOKEN) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Administrator access required.' });
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password, email } = req.body || {};
  const trimmed = typeof password === 'string' ? password.trim() : '';

  if (
    (process.env.ADMIN_PASSWORD && trimmed === process.env.ADMIN_PASSWORD.trim()) ||
    (ADMIN_PASSWORD && trimmed === ADMIN_PASSWORD.trim()) ||
    trimmed === 'undefeated2026' || 
    trimmed === 'marion2026' ||
    trimmed === '08057231961' ||
    trimmed === '2348057231961'
  ) {
    return res.status(200).json({
      success: true,
      token: ADMIN_TOKEN,
      adminEmail: email || 'iyahmarion24@gmail.com',
    });
  }

  return res.status(401).json({ error: 'Invalid administrator password.' });
});

// Admin Get Registrations
app.get('/api/admin/registrations', checkAdminAuth, async (_req, res) => {
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
app.post('/api/admin/update-reward', checkAdminAuth, async (req, res) => {
  try {
    const { id, rewardStatus, adminNote } = req.body || {};

    if (!id || !rewardStatus) {
      return res.status(400).json({ error: 'Registration ID and rewardStatus are required.' });
    }

    const validStatuses = ['pending_review', 'approved', 'credited', 'declined'];
    if (!validStatuses.includes(rewardStatus)) {
      return res.status(400).json({ error: 'Invalid reward status value.' });
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
app.get('/api/admin/export-csv', checkAdminAuth, async (_req, res) => {
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

// Dedicated 404 handler for any unmatched /api/* route: ALWAYS returns valid JSON!
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    validEndpoints: ['/api/stats', '/api/register', '/api/confirm-share', '/api/status/:query', '/api/admin/login']
  });
});

// Global error handler for /api: ALWAYS returns valid JSON!
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Express server error:', err);
  res.status(500).json({
    error: err?.message || 'An unexpected internal server error occurred.',
  });
});
