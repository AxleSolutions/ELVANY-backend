import dotenv from 'dotenv';
dotenv.config();

import { supabase, isSupabaseReady } from './src/config/supabase.js';
import { cloudinary, isCloudinaryReady } from './src/config/cloudinary.js';

async function testConnections() {
  console.log('\n======================================================');
  console.log(' 🔍 TESTING MAISON ELVANY EXTERNAL SERVICES');
  console.log('======================================================\n');

  // 1. Test Cloudinary
  console.log('1️⃣  Testing Cloudinary Connection...');
  if (!isCloudinaryReady) {
    console.log('❌ Cloudinary environment variables are missing.');
  } else {
    try {
      const pingResult = await cloudinary.api.ping();
      console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
      console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? 'Present (***)' : 'Missing');
      console.log('   Status:', pingResult.status === 'ok' ? '🟢 CLOUDINARY CONNECTED & AUTHENTICATED SUCCESSFULLY!' : pingResult);
    } catch (cErr) {
      console.log('❌ Cloudinary connection failed:', cErr.message);
    }
  }

  console.log('\n------------------------------------------------------\n');

  // 2. Test Supabase
  console.log('2️⃣  Testing Supabase Connection...');
  if (!isSupabaseReady) {
    console.log('❌ Supabase environment variables are missing.');
  } else {
    try {
      console.log('   Supabase URL:', process.env.SUPABASE_URL);
      
      // Ping Supabase PostgREST or Auth API
      const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
      
      if (error) {
        // If table doesn't exist yet, we still check if the server responded (which proves API auth/connection works)
        if (error.code === '42P01' || error.message.includes('relation "public.products" does not exist') || error.message.includes('not found')) {
          console.log('🟢 SUPABASE CONNECTED SUCCESSFULLY! (Project reached. Note: Tables from supabase_schema.sql need to be executed in Supabase SQL Editor if not done yet)');
        } else {
          console.log('⚠️  Supabase responded with message:', error.message, '(Code:', error.code, ')');
        }
      } else {
        console.log('🟢 SUPABASE CONNECTED & DATABASE TABLES ACCESSIBLE!');
      }

      // Test Auth ping
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (!authError) {
        console.log('   Supabase Auth Service: 🟢 Operational');
      }
    } catch (sErr) {
      console.log('❌ Supabase connection failed:', sErr.message);
    }
  }

  console.log('\n======================================================\n');
}

testConnections();
