import express from 'express';
import { upload } from '../middlewares/uploadMiddleware.js';
import { uploadSlip, uploadProductImage, uploadPopupAdImage } from '../controllers/uploadsController.js';

const router = express.Router();

// POST /api/uploads/slip (Uploads bank transfer payment slip to Cloudinary)
router.post('/slip', upload.single('slip'), uploadSlip);

// POST /api/uploads/image (Uploads garment product image to Cloudinary)
router.post('/image', upload.single('image'), uploadProductImage);
router.post('/product-image', upload.single('image'), uploadProductImage);

// POST /api/uploads/ad-image (Uploads entrance popup ad image to Cloudinary)
router.post('/ad-image', upload.single('image'), uploadPopupAdImage);

export default router;


