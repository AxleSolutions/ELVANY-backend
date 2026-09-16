import crypto from 'crypto';
import dotenv from 'dotenv';
import { supabase, isSupabaseReady } from '../config/supabase.js';
import { KOKO_PUBLIC_KEY, KOKO_PRIVATE_KEY } from '../config/kokoKeys.js';

dotenv.config();

const KOKO_MERCHANT_ID = process.env.KOKO_MERCHANT_ID || 'c8cca514bdfa0582cdc40c9703c71e9d';
const KOKO_API_KEY = process.env.KOKO_API_KEY || '83fA5n1xUaj8OKnX23YY5vlni5q39gBi';
const KOKO_MODE = (process.env.KOKO_MODE || 'qa').toLowerCase();
const isProduction = KOKO_MODE === 'live' || KOKO_MODE === 'prod' || KOKO_MODE === 'production';

const KOKO_API_URL = process.env.KOKO_API_URL || (isProduction
  ? 'https://prodapi.paykoko.com/api/merchants/orderCreate'
  : 'https://qaapi.paykoko.com/api/merchants/orderCreate');

const KOKO_ORDER_VIEW_URL = process.env.KOKO_ORDER_VIEW_URL || (isProduction
  ? 'https://prodapi.paykoko.com/api/merchants/orderView'
  : 'https://qaapi.paykoko.com/api/merchants/orderView');

const KOKO_SURCHARGE_PERCENT = Number(process.env.KOKO_SURCHARGE_PERCENT || 12);

/**
 * Generate RSA-SHA256 Base64 Signature for data string
 */
export function generateRsaSha256Signature(dataString, privateKeyPem = KOKO_PRIVATE_KEY) {
  try {
    const signer = crypto.createSign('SHA256');
    signer.update(dataString);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
  } catch (error) {
    console.error('[Koko Payment] RSA Signing Error:', error);
    throw new Error(`Failed to generate Koko RSA signature: ${error.message}`);
  }
}

/**
 * Verify RSA-SHA256 Signature using Koko Public Key
 */
export function verifyRsaSha256Signature(dataString, signatureBase64, publicKeyPem = KOKO_PUBLIC_KEY) {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataString);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (error) {
    console.error('[Koko Payment] RSA Verification Error:', error);
    return false;
  }
}

/**
 * Build Koko Order Creation data string per specification:
 * Concatenate: _mId + _amount + _currency + _pluginName + _pluginVersion + _returnUrl + _cancelUrl + _orderId + _reference + _firstName + _lastName + _email + _description + api_key + _responseUrl
 */
export function buildKokoDataString(params) {
  const {
    merchantId,
    amount,
    currency = 'LKR',
    pluginName = 'customapi',
    pluginVersion = '1.0.1',
    returnUrl,
    cancelUrl,
    orderId,
    reference,
    firstName = 'Customer',
    lastName = 'Guest',
    email = 'concierge@elvany.com',
    description = 'Maison ELVANY Order',
    apiKey,
    responseUrl
  } = params;

  return `${merchantId}${amount}${currency}${pluginName}${pluginVersion}${returnUrl}${cancelUrl}${orderId}${reference}${firstName}${lastName}${email}${description}${apiKey}${responseUrl}`;
}

/**
 * API: Get Koko Gateway Public Configuration
 * GET /api/payment/koko-config
 */
export async function getKokoConfig(req, res) {
  try {
    res.json({
      success: true,
      data: {
        mode: KOKO_MODE,
        isProduction,
        merchantId: KOKO_MERCHANT_ID,
        surchargePercent: KOKO_SURCHARGE_PERCENT,
        instalmentsCount: 3,
        apiUrl: KOKO_API_URL
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API: Initiate Koko BNPL Payment Order
 * POST /api/payment/koko-initiate
 */
export async function initiateKokoOrder(req, res) {
  try {
    const {
      orderId,
      amount,
      currency = 'LKR',
      firstName = 'Customer',
      lastName = 'Guest',
      email = 'concierge@elvany.com',
      description = 'Maison ELVANY Order',
      returnUrl,
      cancelUrl,
      items = []
    } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'orderId and amount are required to initiate Koko payment.'
      });
    }

    const clientOrigin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
    const serverOrigin = `${req.protocol}://${req.get('host')}`;

    const finalReturnUrl = returnUrl || `${clientOrigin}/account?koko_status=success&orderId=${orderId}`;
    const finalCancelUrl = cancelUrl || `${clientOrigin}/checkout?koko_status=cancel&orderId=${orderId}`;
    const finalResponseUrl = process.env.KOKO_RESPONSE_URL || `${serverOrigin}/api/payment/koko-notify`;

    const formattedAmount = Number(amount).toFixed(2);
    const pluginName = 'customapi';
    const pluginVersion = '1.0.1';
    const reference = String(orderId);

    // Build the exact specification data string
    const dataString = buildKokoDataString({
      merchantId: KOKO_MERCHANT_ID,
      amount: formattedAmount,
      currency,
      pluginName,
      pluginVersion,
      returnUrl: finalReturnUrl,
      cancelUrl: finalCancelUrl,
      orderId: String(orderId),
      reference,
      firstName: (firstName || 'Customer').trim(),
      lastName: (lastName || 'Maison').trim(),
      email: (email || 'concierge@elvany.com').trim(),
      description: (description || 'Maison ELVANY Bespoke Order').trim(),
      apiKey: KOKO_API_KEY,
      responseUrl: finalResponseUrl
    });

    // Generate cryptographic RSA-SHA256 signature
    const signature = generateRsaSha256Signature(dataString);

    const payload = {
      _mId: KOKO_MERCHANT_ID,
      api_key: KOKO_API_KEY,
      _returnUrl: finalReturnUrl,
      _cancelUrl: finalCancelUrl,
      _responseUrl: finalResponseUrl,
      _amount: formattedAmount,
      _currency: currency,
      _reference: reference,
      _orderId: String(orderId),
      _pluginName: pluginName,
      _pluginVersion: pluginVersion,
      _description: description,
      _firstName: firstName,
      _lastName: lastName,
      _email: email,
      dataString: dataString,
      signature: signature
    };

    console.log(`[Koko Payment] Initiated BNPL order #${orderId} with amount LKR ${formattedAmount} (incl. ${KOKO_SURCHARGE_PERCENT}% surcharge)`);

    return res.json({
      success: true,
      data: {
        apiUrl: KOKO_API_URL,
        payload,
        surchargePercent: KOKO_SURCHARGE_PERCENT,
        formattedAmount,
        orderId: String(orderId)
      }
    });
  } catch (error) {
    console.error('[Koko Payment] Initiation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize Koko BNPL transaction.'
    });
  }
}

/**
 * API: Handle Server-to-Server Koko Payment Notification (Webhook)
 * POST /api/payment/koko-notify
 */
export async function handleKokoNotify(req, res) {
  try {
    const body = req.body || {};
    const { orderId, trnId, status, desc, signature } = body;

    console.log(`[Koko Webhook] Received notification for Order #${orderId}, trnId: ${trnId}, status: ${status}`);

    if (!orderId || !status) {
      return res.status(400).send('Missing orderId or status in Koko notification.');
    }

    const isSuccess = String(status).toUpperCase() === 'SUCCESS';

    if (isSuccess && isSupabaseReady && supabase) {
      try {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();

        const updatePayload = {
          payment_status: 'Paid',
          order_status: 'Processing',
          payment_method: 'koko',
          koko_trn_id: trnId,
          koko_status: status,
          updated_at: new Date().toISOString()
        };

        if (existingOrder) {
          await supabase
            .from('orders')
            .update(updatePayload)
            .eq('order_id', orderId);
        } else {
          // If orders table uses id or custom column
          await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId);
        }
        console.log(`[Koko Webhook] Successfully marked order #${orderId} as Paid in Supabase.`);
      } catch (dbErr) {
        console.error('[Koko Webhook] Supabase update notice:', dbErr);
      }
    }

    // Acknowledge receipt to Koko
    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Koko Webhook] Processing error:', error);
    return res.status(500).send('Webhook processing failure.');
  }
}

/**
 * API: Check / Verify Koko Order Status via Koko OrderView API
 * GET /api/payment/koko-verify/:orderId
 */
export async function verifyKokoOrder(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId parameter is required.' });
    }

    const pluginName = 'customapi';
    const pluginVersion = '1';

    // OrderView signature data string: MerchantID + PluginName + PluginVersion + OrderID + APIKey
    const viewDataString = `${KOKO_MERCHANT_ID}${pluginName}${pluginVersion}${orderId}${KOKO_API_KEY}`;
    const signature = generateRsaSha256Signature(viewDataString);

    const formParams = new URLSearchParams();
    formParams.append('_mId', KOKO_MERCHANT_ID);
    formParams.append('api_key', KOKO_API_KEY);
    formParams.append('_orderId', String(orderId));
    formParams.append('_pluginName', pluginName);
    formParams.append('_pluginVersion', pluginVersion);
    formParams.append('signature', signature);

    const kokoRes = await fetch(KOKO_ORDER_VIEW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formParams.toString()
    });

    if (!kokoRes.ok) {
      const errText = await kokoRes.text();
      return res.status(502).json({
        success: false,
        message: 'Koko OrderView API call unsuccessful.',
        error: errText
      });
    }

    const kokoData = await kokoRes.json().catch(async () => {
      const text = await kokoRes.text();
      return { raw: text };
    });

    return res.json({
      success: true,
      data: kokoData
    });
  } catch (error) {
    console.error('[Koko OrderView] Verification error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify Koko order status.'
    });
  }
}
