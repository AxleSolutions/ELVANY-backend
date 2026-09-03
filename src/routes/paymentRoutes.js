import express from 'express';
import {
  getPayHerePaymentParams,
  handlePayHereNotify,
  confirmCardOrder,
  getPaymentConfig
} from '../controllers/paymentController.js';

const router = express.Router();

// Retrieve secure PayHere parameters with backend hash
router.post('/payhere-params', getPayHerePaymentParams);

// Server-to-server webhook callback from PayHere
router.post('/payhere-notify', handlePayHereNotify);

// Client confirmation after onCompleted
router.post('/confirm-card-order', confirmCardOrder);

// Gateway configuration and sandbox test card information
router.get('/config', getPaymentConfig);

export default router;
