import express from 'express';
import { 
  getProducts, 
  getProductBySlug, 
  createProduct, 
  updateProduct, 
  toggleProductStatus,
  deleteProduct 
} from '../controllers/productsController.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/toggle', toggleProductStatus);
router.delete('/:id', deleteProduct);


export default router;

