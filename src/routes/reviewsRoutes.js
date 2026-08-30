import express from 'express';
import { 
  createReview, 
  getAllReviews, 
  updateReviewStatus, 
  deleteReview 
} from '../controllers/reviewsController.js';

const router = express.Router();

router.get('/', getAllReviews);
router.post('/', createReview);
router.put('/:id', updateReviewStatus);
router.delete('/:id', deleteReview);

export default router;

