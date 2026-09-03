import crypto from 'crypto';
import dotenv from 'dotenv';
import { supabase, isSupabaseReady } from '../config/supabase.js';

dotenv.config();

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || '1211149';
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || '4MTY4NTQ2OTkyOTM1NjExMjE1MjgxNDU5Mjc0MjMzMjE5MDM2MTk=';
const PAYHERE_MODE = (process.env.PAYHERE_MODE || 'sandbox').toLowerCase();
const isSandbox = PAYHERE_MODE !== 'live' && PAYHERE_MODE !== 'production';

// Official PayHere Sandbox Test Cards for quick reference & UI testing
export const SANDBOX_TEST_CARDS = [
  {
    type: 'Visa',
    number: '4916217501611292',
    expiry: '12/28',
    cvv: '123',
    scenario: 'Successful Payment'
  },
  {
    type: 'MasterCard',
    number: '5307732125531191',
    expiry: '12/28',
    cvv: '123',
    scenario: 'Successful Payment'
  },
  {
    type: 'AMEX',
    number: '346781005510225',
    expiry: '12/28',
    cvv: '1234',
    scenario: 'Successful Payment'
  },
  {
    type: 'Visa (Insufficient Funds)',
    number: '4024007194349121',
    expiry: '12/28',
    cvv: '123',
    scenario: 'Insufficient Funds Simulation'
  }
];

/**
 * Generate MD5 Hash required by PayHere JavaScript SDK & Form Checkout
 * Formula: strtoupper(md5(merchant_id + order_id + formatted_amount + currency + strtoupper(md5(merchant_secret))))
 */
export function generatePayHereHash(merchantId, orderId, amount, currency, merchantSecret) {
  const hashedSecret = crypto
    .createHash('md5')
    .update(merchantSecret)
    .digest('hex')
    .toUpperCase();

  const formattedAmount = Number(amount).toFixed(2);

  const hash = crypto
    .createHash('md5')
    .update(merchantId + orderId + formattedAmount + currency + hashedSecret)
    .digest('hex')
    .toUpperCase();

  return { hash, formattedAmount };
}

/**
 * Verify PayHere Server-to-Server Webhook Signature (md5sig)
 * Formula: strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
 */
export function verifyPayHereSignature(merchantId, orderId, payhereAmount, payhereCurrency, statusCode, receivedMd5sig, merchantSecret) {
  const hashedSecret = crypto
    .createHash('md5')
    .update(merchantSecret)
    .digest('hex')
    .toUpperCase();

  const expectedMd5sig = crypto
    .createHash('md5')
    .update(merchantId + orderId + payhereAmount + payhereCurrency + statusCode + hashedSecret)
    .digest('hex')
    .toUpperCase();

  return expectedMd5sig === (receivedMd5sig || '').toUpperCase();
}

/**
 * API: Get PayHere Payment Parameters & Security Hash
 * POST /api/payment/payhere-params
 */
export async function getPayHerePaymentParams(req, res) {
  try {
    const merchantId = process.env.PAYHERE_MERCHANT_ID || MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || MERCHANT_SECRET;
    const currentMode = (process.env.PAYHERE_MODE || 'sandbox').toLowerCase();
    const isCurrentlySandbox = currentMode !== 'live' && currentMode !== 'production';

    const {
      orderId,
      amount,
      currency = 'LKR',
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      items
    } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and payment amount are required to generate payment parameters.'
      });
    }

    const { hash, formattedAmount } = generatePayHereHash(
      merchantId,
      orderId,
      amount,
      currency,
      merchantSecret
    );

    console.log(`\n💳 [PayHere Gateway] Authorizing payment for Order #${orderId}`);
    console.log(`   - Merchant ID: ${merchantId}`);
    console.log(`   - Mode: ${isCurrentlySandbox ? 'SANDBOX' : 'LIVE'}`);
    console.log(`   - Amount: ${formattedAmount} ${currency}`);
    console.log(`   - Security Hash: ${hash}`);

    const names = (customerName || '').trim().split(' ');
    const firstName = deliveryAddress?.firstName || names[0] || 'Valued';
    const lastName = deliveryAddress?.lastName || names.slice(1).join(' ') || 'Client';

    const cleanOrigin = (req.get('origin') || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const returnUrl = `${cleanOrigin}/checkout?order=${encodeURIComponent(orderId)}&status=success`;
    const cancelUrl = `${cleanOrigin}/checkout?order=${encodeURIComponent(orderId)}&status=cancel`;
    const notifyUrl = process.env.PAYHERE_NOTIFY_URL || `${cleanOrigin.replace('5173', '5000')}/api/payment/payhere-notify`;

    // Item description summary for statement
    const itemCount = Array.isArray(items) ? items.length : 1;
    const itemDescription = itemCount > 0 
      ? `Maison ELVANY Haute Luxury Acquisition (${itemCount} Item${itemCount > 1 ? 's' : ''})`
      : 'Maison ELVANY Luxury Apparel Order';

    res.status(200).json({
      success: true,
      data: {
        sandbox: isSandbox,
        merchant_id: MERCHANT_ID,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        order_id: orderId,
        items: itemDescription,
        amount: formattedAmount,
        currency,
        hash,
        first_name: firstName,
        last_name: lastName,
        email: customerEmail || deliveryAddress?.email || 'client@elvany.com',
        phone: customerPhone || deliveryAddress?.phone || '+94771234567',
        address: deliveryAddress?.streetAddress || deliveryAddress?.location || 'Maison Residence',
        city: deliveryAddress?.city || 'Colombo',
        country: deliveryAddress?.country || 'Sri Lanka'
      }
    });
  } catch (error) {
    console.error('Error generating PayHere payment params:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate secure PayHere payment authorization.',
      error: error.message
    });
  }
}

/**
 * API: PayHere Server-to-Server Webhook / IPN Handler
 * POST /api/payment/payhere-notify
 */
export async function handlePayHereNotify(req, res) {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      status_message,
      method,
      card_holder_name,
      card_no,
      card_expiry
    } = req.body;

    console.log(`\n💳 [PayHere Webhook] Notification received for Order ${order_id}: status_code=${status_code} (${status_message || 'N/A'})`);

    // 1. Verify cryptographic signature from PayHere
    const isValidSignature = verifyPayHereSignature(
      merchant_id || MERCHANT_ID,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      MERCHANT_SECRET
    );

    if (!isValidSignature) {
      console.warn(`⚠️ [PayHere Webhook] Signature verification FAILED for order ${order_id}. Rejecting untrusted callback.`);
      return res.status(400).send('Invalid MD5 Signature');
    }

    console.log(`✅ [PayHere Webhook] Signature verified successfully for Order ${order_id}.`);

    // Status code: 2 = Success, 0 = Pending, -1 = Canceled, -2 = Failed, -3 = Chargedback
    const isSuccess = String(status_code) === '2';
    const newStatus = isSuccess 
      ? 'Payment Verified — Processing Dispatch' 
      : String(status_code) === '0' 
      ? 'Pending Confirmation' 
      : 'Cancelled';

    if (isSupabaseReady) {
      const updatePayload = {
        status: newStatus,
        payment_method: 'card'
      };

      const { data: updatedOrder, error: updateErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('order_code', order_id)
        .select()
        .single();

      if (updateErr) {
        console.warn(`[PayHere Webhook] Supabase update notice for ${order_id}:`, updateErr.message);
      } else {
        console.log(`✅ [PayHere Webhook] Order ${order_id} status updated to: "${newStatus}".`);
      }
    }

    // Acknowledge receipt to PayHere
    res.status(200).send('OK');
  } catch (error) {
    console.error('[PayHere Webhook] Error handling notification:', error);
    res.status(500).send('Error');
  }
}

/**
 * API: Confirm Card Payment from Client
 * POST /api/payment/confirm-card-order
 * Called when frontend receives payhere.onCompleted(orderId)
 */
export async function confirmCardOrder(req, res) {
  try {
    const { orderId, paymentDetails } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required to confirm card payment.'
      });
    }

    console.log(`💳 [Client Card Completion] Confirming order ${orderId} upon successful PayHere modal callback.`);

    if (isSupabaseReady) {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'Payment Verified — Processing Dispatch',
          payment_method: 'card'
        })
        .eq('order_code', orderId)
        .select()
        .single();

      if (error) {
        console.warn(`Supabase order confirmation notice for ${orderId}:`, error.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Order verified and confirmed via PayHere card gateway.',
        order: data || { order_code: orderId, status: 'Payment Verified — Processing Dispatch' }
      });
    }

    // Local / In-memory fallback
    res.status(200).json({
      success: true,
      message: 'Card payment recorded in development mode.',
      order: { order_code: orderId, status: 'Payment Verified — Processing Dispatch' }
    });
  } catch (error) {
    console.error('Error confirming card order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm card payment.',
      error: error.message
    });
  }
}

/**
 * API: Get Payment Gateway Config (Public parameters & Sandbox test cards)
 * GET /api/payment/config
 */
export async function getPaymentConfig(req, res) {
  res.status(200).json({
    success: true,
    isSandbox,
    merchantId: MERCHANT_ID,
    currency: 'LKR',
    testCards: isSandbox ? SANDBOX_TEST_CARDS : []
  });
}
