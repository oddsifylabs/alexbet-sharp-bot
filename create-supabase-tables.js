#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}

const SQL = `
-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_payment_date TIMESTAMP,
  payment_method TEXT,
  CHECK (subscription_tier IN ('free', 'monthly', 'yearly', 'lifetime'))
);

CREATE INDEX IF NOT EXISTS users_subscription_expiry 
  ON users(subscription_expiry) 
  WHERE subscription_tier != 'lifetime' AND subscription_tier != 'free';

-- =====================
-- PAYMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  amount_stars INT,
  tier TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  telegram_charge_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (tier IN ('monthly', 'yearly', 'lifetime')),
  CHECK (status IN ('pending', 'completed', 'failed')),
  CHECK (payment_method IN ('telegram_stars', 'whop'))
);

CREATE INDEX IF NOT EXISTS payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status ON payments(status);
`;

async function createTables() {
  try {
    console.log('🗄️  Creating Supabase tables...\n');
    
    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      { sql: SQL },
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
        }
      }
    );

    console.log('✅ Tables created successfully!\n');
    console.log('Created tables:');
    console.log('  ✅ users (subscription tracking)');
    console.log('  ✅ payments (payment audit trail)');
    console.log('  ✅ All indexes created\n');
    
    console.log('Next steps:');
    console.log('  1. Run: node verify-supabase.js');
    console.log('  2. Run: node telegram-bot.js');
    console.log('  3. Test in Telegram: /subscribe, /status, /export_csv');
    console.log('  4. Deploy to Railway');
    console.log('  5. Go live! 🚀\n');
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('ℹ️  Note: Supabase REST API might not support exec_sql via REST.');
      console.log('   Please create tables manually:\n');
      console.log('   1. Go to: https://supabase.io/dashboard');
      console.log('   2. Select: alexbet-sharp-bot project');
      console.log('   3. SQL Editor → New Query');
      console.log('   4. Copy the SQL from: docs/SUPABASE_SCHEMA.sql');
      console.log('   5. Click: Run button\n');
      console.log('ℹ️  Or try running with admin API instead.\n');
    } else {
      console.error('❌ Error creating tables:', error.message);
      if (error.response?.data) {
        console.error('Response:', error.response.data);
      }
    }
    process.exit(1);
  }
}

createTables();
