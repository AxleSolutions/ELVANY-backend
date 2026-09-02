import express from 'express';
import {
  createBespokeDesign,
  getBespokeDesigns,
  getBespokeDesignById,
  updateBespokeDesign,
  deleteBespokeDesign
} from '../controllers/bespokeController.js';

const router = express.Router();

// Public / Customer endpoint to save bespoke configuration
router.post('/', createBespokeDesign);

// Read / Search bespoke designs
router.get('/', getBespokeDesigns);
router.get('/:id', getBespokeDesignById);

// Admin / Atelier management
router.patch('/:id', updateBespokeDesign);
router.delete('/:id', deleteBespokeDesign);

export default router;
