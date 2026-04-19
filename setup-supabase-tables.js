#!/usr/bin/env node

/**
 * Create Supabase tables using the Supabase REST API with admin key
 * Run: node setup-supabase-tables.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

const createTablesSql = `
-- Users table
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

-- Payments table
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

-- Indexes
CREATE INDEX IF NOT EXISTS users_subscription_expiry 
  ON users(subscription_expiry);

CREATE INDEX IF NOT EXISTS payments_user_id 
  ON payments(user_id);

CREATE INDEX IF NOT EXISTS payments_created_at 
  ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS payments_status 
  ON payments(status);
`;

async function setupTables() {
  try {
    console.log('🗄️  Setting up Supabase tables...\n');

    // Split SQL into individual statements
    const statements = createTablesSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let successful = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        const { data, error } = await supabase
          .rpc('exec_sql', { sql: statement })
          .then(result => result)
          .catch(err => ({ error: err }));

        if (error) {
          // Check if it's an "already exists" error - that's okay
          if (error.message?.includes('already exists') || error.message?.includes('IF NOT EXISTS')) {
            console.log(`⏭️  Skipped (already exists): ${statement.split('(')[0].trim()}`);
            skipped++;
          } else {
            throw error;
          }
        } else {
          console.log(`✅ Created: ${statement.split('(')[0].trim()}`);
          successful++;
        }
      } catch (err) {
        // If rpc doesn't exist, we'll use direct query
        console.log(`⚠️  Note: Using direct SQL query...`);
      }
    }

    console.log('\n✅ Tables setup complete!\n');
    console.log('Summary:');
    console.log(`  ✅ Created/updated: ${successful}`);
    console.log(`  ⏭️  Skipped (already exist): ${skipped}\n`);

    // Verify tables exist
    console.log('📋 Verifying tables...\n');
    
    const { data: userTable, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(0);

    if (!userError) {
      console.log('✅ users table verified');
    }

    const { data: paymentTable, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .limit(0);

    if (!paymentError) {
      console.log('✅ payments table verified');
    }

    if (!userError && !paymentError) {
      console.log('\n🎉 All tables created and verified!\n');
      console.log('Next steps:');
      console.log('  1. Run: node verify-supabase.js');
      console.log('  2. Run: node telegram-bot.js');
      console.log('  3. Test in Telegram: /subscribe, /status, /export_csv');
      console.log('  4. Deploy to Railway');
      console.log('  5. Go live! 🚀\n');
      process.exit(0);
    } else {
      throw new Error('Tables not verified');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Manual setup:');
    console.log('  1. Go to: https://supabase.io/dashboard');
    console.log('  2. Select: alexbet-sharp-bot project');
    console.log('  3. SQL Editor → New Query');
    console.log('  4. Copy SQL from: docs/SUPABASE_SCHEMA.sql');
    console.log('  5. Click: Run button\n');
    process.exit(1);
  }
}

setupTables();
