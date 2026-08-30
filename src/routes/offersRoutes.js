import express from 'express';
import { 
  getOffers, 
  createOffer, 
  updateOffer, 
  toggleOfferStatus, 
  deleteOffer 
} from '../controllers/offersController.js';

const router = express.Router();

router.get('/', getOffers);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.patch('/:id/toggle', toggleOfferStatus);
router.delete('/:id', deleteOffer);

export default router;

