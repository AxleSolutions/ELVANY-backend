import express from 'express';
import { getCart, saveCart } from '../controllers/cartController.js';

const router = express.Router();

router.get('/', getCart);
router.post('/', saveCart);
router.put('/', saveCart);

export default router;
