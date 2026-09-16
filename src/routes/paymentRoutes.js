import express from 'express';
import {
  getPayHerePaymentParams,
  handlePayHereNotify,
  confirmCardOrder,
  getPaymentConfig
} from '../controllers/paymentController.js';
import {
  initiateKokoOrder,
  handleKokoNotify,
  verifyKokoOrder,
  getKokoConfig
} from '../controllers/kokoController.js';

const router = express.Router();

// Retrieve secure PayHere parameters with backend hash
router.post('/payhere-params', getPayHerePaymentParams);

// Server-to-server webhook callback from PayHere
router.post('/payhere-notify', handlePayHereNotify);

// Client confirmation after onCompleted
router.post('/confirm-card-order', confirmCardOrder);

// Gateway configuration and sandbox test card information
router.get('/config', getPaymentConfig);

// ==========================================
// KOKO BUY NOW PAY LATER (BNPL) ROUTES
// ==========================================

// Initiate Koko payment session with RSA signature
router.post('/koko-initiate', initiateKokoOrder);

// Koko server-to-server webhook callback
router.post('/koko-notify', handleKokoNotify);

// Verify Koko order status via orderView API
router.get('/koko-verify/:orderId', verifyKokoOrder);

// Get Koko configuration & surcharge rate
router.get('/koko-config', getKokoConfig);

export default router;
