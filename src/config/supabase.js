import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_PUBLISHABLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  '';

export const isSupabaseReady = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseReady
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      realtime: {
        transport: WebSocket
      }
    })
  : null;
