import express from 'express';
import {
  createRestockRequest,
  getRestockRequests,
  updateRestockRequestStatus,
  deleteRestockRequest
} from '../controllers/restockController.js';

const router = express.Router();

// Public / Customer endpoint to submit re-issue request
router.post('/', createRestockRequest);

// Backoffice Admin endpoints
router.get('/', getRestockRequests);
router.patch('/:id', updateRestockRequestStatus);
router.delete('/:id', deleteRestockRequest);

export default router;
