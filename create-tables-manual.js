require('dotenv').config();
const https = require('https');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🗄️  Creating Supabase tables via REST API...\n');

// SQL statements to execute
const sqlStatements = `
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

(async () => {
  try {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;

    // Try using the PostgreSQL function approach
    const payload = {
      query: sqlStatements
    };

    console.log('Attempting to create tables...');
    console.log('Project:', hostname.split('.')[0]);

    // The Supabase REST API doesn't support raw SQL execution
    // We need to use pgAdmin or do it manually
    console.log('\n⚠️  REST API cannot execute raw SQL');
    console.log('\nTo create tables, you have two options:\n');

    console.log('OPTION 1: Manual setup (recommended)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Open Supabase Dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Create new query');
    console.log('4. Copy SQL below and paste:');
    console.log('\n' + sqlStatements);
    console.log('\n5. Click Run');
    console.log('6. Verify tables in Table Editor\n');

    console.log('OPTION 2: Using pgAdmin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. In Supabase Dashboard, click Database');
    console.log('2. Click pgAdmin');
    console.log('3. Navigate to your project database');
    console.log('4. Open SQL query window');
    console.log('5. Paste and execute the SQL above\n');

    console.log('After creating tables:');
    console.log('→ Run: node verify-supabase.js');
    console.log('→ Then: node telegram-bot.js\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
