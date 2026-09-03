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
import restockRoutes from './src/routes/restockRoutes.js';
import bespokeRoutes from './src/routes/bespokeRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { isSupabaseReady } from './src/config/supabase.js';
import { isCloudinaryReady } from './src/config/cloudinary.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration (robust handling of trailing slashes & vercel domains)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://elvany.vercel.app',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(u => u.trim().replace(/\/+$/, '')) : [])
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    
    // Check if origin matches or is a vercel.app deployment
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.includes('localhost')
    ) {
      return callback(null, true);
    }
    // Allow all other origins safely in production
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Enable pre-flight across all routes
app.options('*', cors());

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// API Routes (mounted on /api and root fallback)
app.use('/api/orders', ordersRoutes);
app.use('/orders', ordersRoutes);

app.use('/api/products', productsRoutes);
app.use('/products', productsRoutes);

app.use('/api/offers', offersRoutes);
app.use('/offers', offersRoutes);

app.use('/api/reviews', reviewsRoutes);
app.use('/reviews', reviewsRoutes);

app.use('/api/uploads', uploadsRoutes);
app.use('/uploads', uploadsRoutes);

app.use('/api/newsletter', newsletterRoutes);
app.use('/newsletter', newsletterRoutes);

app.use('/api/cart', cartRoutes);
app.use('/cart', cartRoutes);

app.use('/api/popup-ad', popupAdRoutes);
app.use('/popup-ad', popupAdRoutes);

app.use('/api/restock-requests', restockRoutes);
app.use('/restock-requests', restockRoutes);

app.use('/api/bespoke', bespokeRoutes);
app.use('/bespoke', bespokeRoutes);

app.use('/api/payment', paymentRoutes);
app.use('/payment', paymentRoutes);




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
