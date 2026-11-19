import express from 'express';
import { getCategories, saveCategories, deleteCategory } from '../controllers/categoriesController.js';

const router = express.Router();

router.get('/', getCategories);
router.post('/', saveCategories);
router.put('/', saveCategories);
router.delete('/:id', deleteCategory);

export default router;
