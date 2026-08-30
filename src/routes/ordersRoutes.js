import express from 'express';
import { 
  createOrder, 
  getOrders, 
  approvePaymentSlip, 
  rejectPaymentSlip, 
  updateOrderStatus 
} from '../controllers/ordersController.js';

const router = express.Router();

// Client Endpoints
router.post('/', createOrder);
router.get('/', getOrders);

// Admin & Concierge Slip Management Endpoints
router.patch('/:orderCode/approve-slip', approvePaymentSlip);
router.patch('/:orderCode/reject-slip', rejectPaymentSlip);
router.patch('/:orderCode/status', updateOrderStatus);

export default router;
