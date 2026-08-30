import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import ordersRoutes from './src/routes/ordersRoutes.js';
import productsRoutes from './src/routes/productsRoutes.js';
import offersRoutes from './src/routes/offersRoutes.js';
import reviewsRoutes from './src/routes/reviewsRoutes.js';
import uploadsRoutes from './src/routes/uploadsRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import cartRoutes from './src/routes/cartRoutes.js';
import popupAdRoutes from './src/routes/popupAdRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { isSupabaseReady } from './src/config/supabase.js';
import { isCloudinaryReady } from './src/config/cloudinary.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration (allow frontend origin)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Maison ELVANY Luxury API Server',
    database: isSupabaseReady ? 'Supabase Connected' : 'Development Fallback Mode',
    mediaStorage: isCloudinaryReady ? 'Cloudinary Connected' : 'Local Fallback Mode',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/orders', ordersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/popup-ad', popupAdRoutes);



// Global Error Handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(` ⚜  MAISON ELVANY BACKEND API SERVER RUNNING ON PORT ${PORT}`);
  console.log(` 📍 Health: http://localhost:${PORT}/api/health`);
  console.log(` 🗄  Supabase Database: ${isSupabaseReady ? '🟢 CONNECTED' : '🟡 DEV MODE (Add .env keys)'}`);
  console.log(` ☁  Cloudinary Storage: ${isCloudinaryReady ? '🟢 CONNECTED' : '🟡 DEV MODE (Add .env keys)'}`);
  console.log(`======================================================\n`);
});
