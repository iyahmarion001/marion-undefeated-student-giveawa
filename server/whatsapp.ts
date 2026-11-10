/**
 * Direct WhatsApp Notification Service using official WhatsApp Business Cloud API
 * (with fallback support for Twilio WhatsApp API).
 *
 * Implements server-side automated messaging directly to the administrator (08057231961)
 * without redirecting the student to WhatsApp to manually send.
 */

export interface DirectNotificationParams {
  registrationId: string;
  phoneNumber: string;
  network: string;
  airtimeAmount: number;
  referralCode: string;
  status: string;
  shareMethod?: string | null;
  adminWhatsAppNumber?: string;
}

export interface DirectNotificationResult {
  sent: boolean;
  configured: boolean;
  provider?: 'meta' | 'twilio';
  messageId?: string;
  error?: string;
  requiredConfig?: string[];
}

export async function sendDirectWhatsAppNotification(
  params: DirectNotificationParams
): Promise<DirectNotificationResult> {
  const recipient = (
    params.adminWhatsAppNumber ||
    process.env.ADMIN_WHATSAPP ||
    process.env.ADMIN_WHATSAPP_NUMBER ||
    '2348057231961'
  ).replace(/\D/g, '');

  const shareProofText =
    params.shareMethod === 'groups_3'
      ? '3 WhatsApp Groups'
      : params.shareMethod === 'individuals_10'
      ? '10 Individual People'
      : 'Self-Confirmed Sharing';

  const messageBody =
    `🎁 *MARION UNDEFEATED GIVEAWAY 2026 – NEW ENTRY*\n\n` +
    `A participant has completed the sharing requirement and submitted their entry:\n\n` +
    `📱 *Student Phone Number:* ${params.phoneNumber}\n` +
    `📶 *Network:* ${params.network.toUpperCase()}\n` +
    `💰 *Requested Airtime:* ₦${params.airtimeAmount}\n` +
    `🆔 *Registration ID:* ${params.registrationId}\n` +
    `🔑 *Referral Code:* ${params.referralCode}\n` +
    `📢 *Sharing Proof:* ${shareProofText}\n` +
    `📊 *Current Status:* ${params.status}\n\n` +
    `👉 *Review & Disburse:* ${process.env.APP_URL ? `${process.env.APP_URL}/admin` : 'Open Admin Portal to Review'}\n` +
    `#Let's make every penny count.`;

  // 1. Check Meta WhatsApp Business Cloud API Credentials
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (metaToken && metaPhoneId) {
    try {
      const url = `https://graph.facebook.com/v21.0/${metaPhoneId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody,
          },
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || `Meta Cloud API error (HTTP ${response.status})`;
        console.error('Meta WhatsApp Cloud API error:', data);
        return {
          sent: false,
          configured: true,
          provider: 'meta',
          error: errorMsg,
        };
      }

      const messageId = data?.messages?.[0]?.id || 'delivered';
      return {
        sent: true,
        configured: true,
        provider: 'meta',
        messageId,
      };
    } catch (err: any) {
      console.error('Meta WhatsApp Cloud API network error:', err);
      return {
        sent: false,
        configured: true,
        provider: 'meta',
        error: err?.message || 'Network error reaching Meta WhatsApp Cloud API',
      };
    }
  }

  // 2. Check Twilio WhatsApp Credentials as alternative supported provider
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (twilioAccountSid && twilioAuthToken && twilioFrom) {
    try {
      const cleanFrom = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
      const cleanTo = `whatsapp:+${recipient}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

      const formBody = new URLSearchParams({
        From: cleanFrom,
        To: cleanTo,
        Body: messageBody,
      });

      const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorMsg = data?.message || `Twilio error (HTTP ${response.status})`;
        return {
          sent: false,
          configured: true,
          provider: 'twilio',
          error: errorMsg,
        };
      }

      return {
        sent: true,
        configured: true,
        provider: 'twilio',
        messageId: data.sid,
      };
    } catch (err: any) {
      return {
        sent: false,
        configured: true,
        provider: 'twilio',
        error: err?.message || 'Network error reaching Twilio API',
      };
    }
  }

  // 3. Neither provider configured
  return {
    sent: false,
    configured: false,
    error: 'Direct WhatsApp Cloud API credentials are not yet configured on this server.',
    requiredConfig: [
      'WHATSAPP_ACCESS_TOKEN (Meta WhatsApp Business System User Permanent Token)',
      'WHATSAPP_PHONE_NUMBER_ID (Meta WhatsApp Business Phone Number ID)',
      'ADMIN_WHATSAPP (Recipient: 2348057231961)',
    ],
  };
}
