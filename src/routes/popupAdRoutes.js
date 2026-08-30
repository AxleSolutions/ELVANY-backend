import express from 'express';
import { getPopupAd, updatePopupAd } from '../controllers/popupAdController.js';

const router = express.Router();

router.get('/', getPopupAd);
router.put('/', updatePopupAd);
router.post('/', updatePopupAd);

export default router;
